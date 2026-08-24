import {
  combineTrackingResults,
  normalizeFaceLandmarks,
  normalizePoseLandmarks,
} from './faceTracker';
import type {
  LandmarkPoint,
  RuntimeTrackingStatus,
  SubjectState,
  TrackingDiagnostics,
} from '../../../types/tracking';

export interface ModelAssetPaths {
  wasm: string;
  face: string;
  pose: string;
}

export const DEFAULT_MODEL_ASSETS: ModelAssetPaths = {
  wasm: 'models/wasm',
  face: 'models/face_landmarker.task',
  pose: 'models/pose_landmarker_lite.task',
};

export interface SerializedDetectionResult {
  type: 'result';
  requestId: number;
  timestampMs: number;
  faceLandmarks: LandmarkPoint[][];
  poseLandmarks: LandmarkPoint[][];
}

export type MediaPipeWorkerRequest =
  | { type: 'init'; assets: ModelAssetPaths }
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

const localAssetUrl = (assetPath: string): string => {
  if (typeof document === 'undefined') {
    return assetPath;
  }
  return new URL(assetPath, document.baseURI).toString();
};

export const resolveLocalModelAssets = (
  assets: ModelAssetPaths = DEFAULT_MODEL_ASSETS,
): ModelAssetPaths => {
  const paths = [assets.wasm, assets.face, assets.pose];
  if (paths.some((path) => /^https?:\/\//i.test(path))) {
    throw new Error('MediaPipe assets must be bundled local application files.');
  }

  return {
    wasm: localAssetUrl(assets.wasm),
    face: localAssetUrl(assets.face),
    pose: localAssetUrl(assets.pose),
  };
};

const createDefaultWorker = (): MediaPipeWorkerLike =>
  new Worker(new URL('./mediapipe.worker.ts', import.meta.url), {
    type: 'module',
  }) as MediaPipeWorkerLike;

export class MediaPipeTracker {
  private readonly worker: MediaPipeWorkerLike;

  private readonly modelAssets: ModelAssetPaths;

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

  private readonly handleMessageBound = (
    event: MessageEvent<MediaPipeWorkerResponse>,
  ): void => {
    this.handleMessage(event.data);
  };

  constructor(options: MediaPipeTrackerOptions = {}) {
    this.modelAssets = resolveLocalModelAssets(options.modelAssets);
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
    this.worker.postMessage({ type: 'init', assets: this.modelAssets });
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
    const face = normalizeFaceLandmarks(response.faceLandmarks);
    const pose = normalizePoseLandmarks(response.poseLandmarks);
    const subject = combineTrackingResults({
      face,
      pose,
      timestampMs: response.timestampMs,
    });
    const diagnostics: TrackingDiagnostics = {
      status: statusForSubject(subject),
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
      error: null,
    };

    this.onResult?.({ subject, diagnostics, timestampMs: response.timestampMs });
    this.dispatchPending();
  }

  private reportError(error: unknown): void {
    const normalized = error instanceof Error ? error : new Error(String(error));
    this.onError?.(normalized);
  }
}
