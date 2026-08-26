import {
  combineTrackingResults,
  normalizeFaceLandmarks,
  normalizePoseLandmarks,
} from './faceTracker';
import {
  classifyPinchZoom,
  createNeutralGestureState,
  isHandInGestureZone,
  isUsableHand,
} from './gestureRecognizer';
import {
  DEFAULT_TRACKING_FEATURES,
  type FaceTrackingSummary,
  type GestureState,
  type LandmarkPoint,
  type PoseTrackingSummary,
  type RuntimeTrackingStatus,
  type SubjectState,
  type TrackingFeatures,
  type TrackingDiagnostics,
} from '../../../types/tracking';
import { clamp } from '../../utils/clamp';

export interface ModelAssetPaths {
  wasm: string;
  face: string;
  pose: string;
  gesture: string;
}

export const DEFAULT_MODEL_ASSETS: ModelAssetPaths = {
  wasm: 'models/wasm',
  face: 'models/face_landmarker.task',
  pose: 'models/pose_landmarker_lite.task',
  gesture: 'models/gesture_recognizer.task',
};

export interface SerializedDetectionResult {
  type: 'result';
  requestId: number;
  timestampMs: number;
  faceLandmarks: LandmarkPoint[][];
  poseLandmarks: LandmarkPoint[][];
  handLandmarks: LandmarkPoint[][];
  handConfidence: number;
}

export type MediaPipeWorkerRequest =
  | { type: 'init'; assets: ModelAssetPaths; features: TrackingFeatures }
  | { type: 'detect'; requestId: number; timestampMs: number; frame: ImageBitmap }
  | { type: 'dispose' };

export type MediaPipeWorkerResponse =
  | { type: 'ready' }
  | SerializedDetectionResult
  | { type: 'error'; message: string; requestId?: number }
  | { type: 'disposed' };

export interface MediaPipeWorkerLike {
  postMessage(message: MediaPipeWorkerRequest, transfer?: Transferable[]): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<MediaPipeWorkerResponse>) => void,
  ): void;
  removeEventListener(
    type: 'message',
    listener: (event: MessageEvent<MediaPipeWorkerResponse>) => void,
  ): void;
  terminate(): void;
}

export interface TrackingResult {
  subject: SubjectState;
  diagnostics: TrackingDiagnostics;
  timestampMs: number;
}

export interface MediaPipeTrackerOptions {
  modelAssets?: ModelAssetPaths;
  features?: Partial<TrackingFeatures>;
  worker?: MediaPipeWorkerLike;
  workerFactory?: () => MediaPipeWorkerLike;
  imageBitmapFactory?: (video: HTMLVideoElement) => Promise<ImageBitmap>;
  onResult?: (result: TrackingResult) => void;
  onError?: (error: Error) => void;
}

type TrackerLifecycle = 'idle' | 'initializing' | 'ready' | 'disposed' | 'error';

const toError = (message: string): Error => new Error(message);

const statusForSubject = (subject: SubjectState): RuntimeTrackingStatus => {
  if (!subject.detected) {
    return 'lost';
  }
  return subject.confidence >= 0.45 ? 'tracking' : 'low-confidence';
};

// Keep the last usable face briefly when MediaPipe misses an individual frame.
// This prevents the virtual camera and debug box from flickering during normal
// motion, while still allowing the subject to be considered lost promptly.
const FACE_HOLD_MS = 2000;

const translateFaceWithPose = (
  face: FaceTrackingSummary,
  previousPose: PoseTrackingSummary | null,
  currentPose: PoseTrackingSummary | null,
): FaceTrackingSummary => {
  const hasPreviousAnchor =
    previousPose?.shoulderCenterX !== null &&
    previousPose?.shoulderCenterX !== undefined &&
    previousPose?.shoulderCenterY !== null &&
    previousPose?.shoulderCenterY !== undefined;
  const hasCurrentAnchor =
    currentPose?.shoulderCenterX !== null &&
    currentPose?.shoulderCenterX !== undefined &&
    currentPose?.shoulderCenterY !== null &&
    currentPose?.shoulderCenterY !== undefined;

  if (!hasPreviousAnchor || !hasCurrentAnchor) {
    return face;
  }

  // Shoulder movement is a useful fallback when the face detector misses a
  // frame. Damp the translation slightly because pose landmarks are noisier
  // than face landmarks.
  const translationX =
    ((currentPose.shoulderCenterX ?? 0) - (previousPose.shoulderCenterX ?? 0)) * 0.65;
  const translationY =
    ((currentPose.shoulderCenterY ?? 0) - (previousPose.shoulderCenterY ?? 0)) * 0.65;

  return {
    ...face,
    landmarks: face.landmarks.map((landmark) => ({
      ...landmark,
      x: clamp(landmark.x + translationX, 0, 1),
      y: clamp(landmark.y + translationY, 0, 1),
    })),
    centerX: clamp(face.centerX + translationX, 0, 1),
    centerY: clamp(face.centerY + translationY, 0, 1),
    eyeX: clamp(face.eyeX + translationX, 0, 1),
    eyeY: clamp(face.eyeY + translationY, 0, 1),
    confidence: Math.min(face.confidence, 0.75),
  };
};

const localAssetUrl = (assetPath: string): string => {
  if (typeof document === 'undefined') {
    return assetPath;
  }
  return new URL(assetPath, document.baseURI).toString();
};

export const resolveLocalModelAssets = (
  assets: ModelAssetPaths = DEFAULT_MODEL_ASSETS,
): ModelAssetPaths => {
  const paths = [assets.wasm, assets.face, assets.pose, assets.gesture];
  if (paths.some((path) => /^https?:\/\//i.test(path))) {
    throw new Error('MediaPipe assets must be bundled local application files.');
  }

  return {
    wasm: localAssetUrl(assets.wasm),
    face: localAssetUrl(assets.face),
    pose: localAssetUrl(assets.pose),
    gesture: localAssetUrl(assets.gesture),
  };
};

const createDefaultWorker = (): MediaPipeWorkerLike =>
  new Worker(new URL('./mediapipe.worker.ts', import.meta.url), {
    type: 'module',
  }) as MediaPipeWorkerLike;

export class MediaPipeTracker {
  private readonly worker: MediaPipeWorkerLike;

  private readonly modelAssets: ModelAssetPaths;

  private readonly features: TrackingFeatures;

  private readonly imageBitmapFactory: (
    video: HTMLVideoElement,
  ) => Promise<ImageBitmap>;

  private readonly onResult?: (result: TrackingResult) => void;

  private readonly onError?: (error: Error) => void;

  private lifecycle: TrackerLifecycle = 'idle';

  private initializePromise: Promise<void> | null = null;

  private initializeResolve: (() => void) | null = null;

  private initializeReject: ((error: Error) => void) | null = null;

  private requestId = 0;

  private lastRequestedTimestampMs = -Infinity;

  private lastResultTimestampMs = -Infinity;

  private lastAppliedRequestId = 0;

  private inFlight = false;

  private pendingFrame: { frame: ImageBitmap; timestampMs: number } | null = null;

  private staleResultsDropped = 0;

  private resultCount = 0;

  private firstResultAtMs: number | null = null;

  private lastReportedFaceLandmarkCount = -1;

  private lastReportedPoseLandmarkCount = -1;

  private lastFace: FaceTrackingSummary | null = null;

  private lastFacePose: PoseTrackingSummary | null = null;

  private lastFaceTimestampMs = -Infinity;

  private lastGesture: GestureState = createNeutralGestureState();

  private lastGestureTimestampMs = -Infinity;

  private gestureCandidate: GestureState = createNeutralGestureState();

  private gestureCandidateTimestampMs = -Infinity;

  private gestureHandSinceMs = -Infinity;

  private gestureArmed = false;

  private readonly handleMessageBound = (
    event: MessageEvent<MediaPipeWorkerResponse>,
  ): void => {
    this.handleMessage(event.data);
  };

  constructor(options: MediaPipeTrackerOptions = {}) {
    this.modelAssets = resolveLocalModelAssets(options.modelAssets);
    this.features = { ...DEFAULT_TRACKING_FEATURES, ...options.features };
    this.worker = options.worker ?? options.workerFactory?.() ?? createDefaultWorker();
    this.imageBitmapFactory =
      options.imageBitmapFactory ?? ((video) => createImageBitmap(video));
    this.onResult = options.onResult;
    this.onError = options.onError;
    this.worker.addEventListener('message', this.handleMessageBound);
  }

  getStatus(): TrackerLifecycle {
    return this.lifecycle;
  }

  async initialize(): Promise<void> {
    if (this.lifecycle === 'ready') {
      return;
    }
    if (this.lifecycle === 'disposed') {
      throw new Error('MediaPipe tracker has been disposed.');
    }
    if (this.initializePromise) {
      return this.initializePromise;
    }

    this.lifecycle = 'initializing';
    this.initializePromise = new Promise<void>((resolve, reject) => {
      this.initializeResolve = resolve;
      this.initializeReject = reject;
    });
    this.worker.postMessage({
      type: 'init',
      assets: this.modelAssets,
      features: this.features,
    });
    return this.initializePromise;
  }

  submitFrame(frame: ImageBitmap, timestampMs: number): boolean {
    if (this.lifecycle !== 'ready' || !Number.isFinite(timestampMs)) {
      frame.close();
      return false;
    }
    if (timestampMs <= this.lastRequestedTimestampMs) {
      frame.close();
      this.staleResultsDropped += 1;
      return false;
    }

    this.lastRequestedTimestampMs = timestampMs;
    this.enqueueFrame(frame, timestampMs);
    return true;
  }

  submitVideoFrame(video: HTMLVideoElement, timestampMs: number): boolean {
    if (this.lifecycle !== 'ready' || !Number.isFinite(timestampMs)) {
      return false;
    }
    if (timestampMs <= this.lastRequestedTimestampMs) {
      this.staleResultsDropped += 1;
      return false;
    }

    this.lastRequestedTimestampMs = timestampMs;
    void this.imageBitmapFactory(video)
      .then((frame) => {
        if (timestampMs < this.lastRequestedTimestampMs || this.lifecycle !== 'ready') {
          frame.close();
          this.staleResultsDropped += 1;
          return;
        }
        this.enqueueFrame(frame, timestampMs);
      })
      .catch((error: unknown) => {
        this.reportError(error);
      });
    return true;
  }

  dispose(): void {
    if (this.lifecycle === 'disposed') {
      return;
    }
    this.pendingFrame?.frame.close();
    this.pendingFrame = null;
    this.worker.removeEventListener('message', this.handleMessageBound);
    if (this.lifecycle === 'ready' || this.lifecycle === 'initializing') {
      this.worker.postMessage({ type: 'dispose' });
    }
    this.worker.terminate();
    this.lifecycle = 'disposed';
    this.initializeReject?.(new Error('MediaPipe tracker was disposed.'));
    this.initializeResolve = null;
    this.initializeReject = null;
  }

  private enqueueFrame(frame: ImageBitmap, timestampMs: number): void {
    if (this.inFlight) {
      this.pendingFrame?.frame.close();
      if (this.pendingFrame) {
        this.staleResultsDropped += 1;
      }
      this.pendingFrame = { frame, timestampMs };
      return;
    }

    this.dispatchFrame(frame, timestampMs);
  }

  private dispatchFrame(frame: ImageBitmap, timestampMs: number): void {
    this.inFlight = true;
    this.requestId += 1;
    this.worker.postMessage(
      {
        type: 'detect',
        requestId: this.requestId,
        timestampMs,
        frame,
      },
      [frame],
    );
  }

  private dispatchPending(): void {
    if (this.inFlight || !this.pendingFrame || this.lifecycle !== 'ready') {
      return;
    }
    const pending = this.pendingFrame;
    this.pendingFrame = null;
    this.dispatchFrame(pending.frame, pending.timestampMs);
  }

  private handleMessage(response: MediaPipeWorkerResponse): void {
    if (response.type === 'ready') {
      this.lifecycle = 'ready';
      this.initializeResolve?.();
      this.initializeResolve = null;
      this.initializeReject = null;
      return;
    }

    if (response.type === 'error') {
      const error = toError(response.message);
      if (response.requestId === undefined) {
        this.lifecycle = 'error';
        this.initializeReject?.(error);
        this.initializeResolve = null;
        this.initializeReject = null;
      } else {
        this.inFlight = false;
      }
      this.reportError(error);
      this.dispatchPending();
      return;
    }

    if (response.type !== 'result') {
      return;
    }

    this.inFlight = false;
    if (
      response.requestId <= this.lastAppliedRequestId ||
      response.timestampMs <= this.lastResultTimestampMs
    ) {
      this.staleResultsDropped += 1;
      this.dispatchPending();
      return;
    }

    this.lastAppliedRequestId = response.requestId;
    this.lastResultTimestampMs = response.timestampMs;
    this.resultCount += 1;
    this.firstResultAtMs ??= response.timestampMs;
    const pose = this.features.body
      ? normalizePoseLandmarks(response.poseLandmarks)
      : null;
    const detectedFace = this.features.face
      ? normalizeFaceLandmarks(response.faceLandmarks)
      : null;
    if (detectedFace) {
      this.lastFace = detectedFace;
      this.lastFaceTimestampMs = response.timestampMs;
      this.lastFacePose = pose;
    }
    const face =
      detectedFace ??
      (this.lastFace && response.timestampMs - this.lastFaceTimestampMs <= FACE_HOLD_MS
        ? translateFaceWithPose(this.lastFace, this.lastFacePose, pose)
        : null);
    const subject = combineTrackingResults({
      face,
      pose,
      timestampMs: response.timestampMs,
    });
    const rawHandLandmarks = this.features.gestures
      ? (response.handLandmarks[0] ?? [])
      : [];
    const usableHand =
      this.features.gestures && isUsableHand(rawHandLandmarks, response.handConfidence);
    const handInGestureZone = usableHand && isHandInGestureZone(rawHandLandmarks);
    let detectedGesture = handInGestureZone
      ? classifyPinchZoom(
          rawHandLandmarks,
          response.handConfidence,
          this.lastGesture.command,
        )
      : createNeutralGestureState();
    if (handInGestureZone) {
      if (this.gestureHandSinceMs === -Infinity) {
        this.gestureHandSinceMs = response.timestampMs;
      }
      if (response.timestampMs - this.gestureHandSinceMs >= 150) {
        this.gestureArmed = true;
      }
    } else {
      this.gestureHandSinceMs = -Infinity;
      this.gestureArmed = false;
    }
    if (!this.gestureArmed) {
      detectedGesture = createNeutralGestureState();
    }
    const gesture = this.resolveGesture(detectedGesture, response.timestampMs);
    const diagnostics: TrackingDiagnostics = {
      status:
        this.features.face || this.features.body
          ? statusForSubject(subject)
          : 'disabled',
      confidence: subject.confidence,
      subject,
      lastResultTimestampMs: response.timestampMs,
      inferenceFps:
        this.firstResultAtMs === response.timestampMs
          ? 0
          : (this.resultCount * 1000) /
            Math.max(
              1,
              response.timestampMs - (this.firstResultAtMs ?? response.timestampMs),
            ),
      staleResultsDropped: this.staleResultsDropped,
      faceLandmarkCount: face?.landmarks.length ?? 0,
      poseLandmarkCount: pose?.landmarks.length ?? 0,
      handLandmarks: usableHand ? rawHandLandmarks : null,
      gesture,
      error: null,
    };

    const faceLandmarkCount = diagnostics.faceLandmarkCount;
    const poseLandmarkCount = diagnostics.poseLandmarkCount;
    if (
      this.resultCount <= 3 ||
      faceLandmarkCount !== this.lastReportedFaceLandmarkCount ||
      poseLandmarkCount !== this.lastReportedPoseLandmarkCount
    ) {
      console.info(
        `[MediaPipeTracker] face landmarks=${faceLandmarkCount}, pose landmarks=${poseLandmarkCount}, gesture=${gesture.command}, confidence=${Math.round(subject.confidence * 100)}%`,
      );
      this.lastReportedFaceLandmarkCount = faceLandmarkCount;
      this.lastReportedPoseLandmarkCount = poseLandmarkCount;
    }

    this.onResult?.({ subject, diagnostics, timestampMs: response.timestampMs });
    this.dispatchPending();
  }

  private resolveGesture(next: GestureState, timestampMs: number): GestureState {
    const gestureActivationMs = 400;
    const gestureReleaseHoldMs = 100;

    if (next.command === 'none') {
      this.gestureCandidate = createNeutralGestureState();
      if (
        this.lastGesture.command !== 'none' &&
        timestampMs - this.lastGestureTimestampMs <= gestureReleaseHoldMs
      ) {
        return this.lastGesture;
      }
      this.lastGesture = createNeutralGestureState();
      return this.lastGesture;
    }

    if (this.lastGesture.command === next.command) {
      this.lastGesture = next;
      this.lastGestureTimestampMs = timestampMs;
      return next;
    }

    if (this.gestureCandidate.command !== next.command) {
      this.gestureCandidate = next;
      this.gestureCandidateTimestampMs = timestampMs;
    }

    if (timestampMs - this.gestureCandidateTimestampMs >= gestureActivationMs) {
      this.lastGesture = next;
      this.lastGestureTimestampMs = timestampMs;
      this.gestureCandidate = createNeutralGestureState();
      return next;
    }

    if (
      this.lastGesture.command !== 'none' &&
      timestampMs - this.lastGestureTimestampMs <= gestureReleaseHoldMs
    ) {
      return this.lastGesture;
    }

    return createNeutralGestureState();
  }

  private reportError(error: unknown): void {
    const normalized = error instanceof Error ? error : new Error(String(error));
    console.error(`[MediaPipeTracker] ${normalized.message}`);
    this.onError?.(normalized);
  }
}
