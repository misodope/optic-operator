import {
  FaceLandmarker,
  FilesetResolver,
  GestureRecognizer,
  PoseLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

import type {
  MediaPipeWorkerRequest,
  MediaPipeWorkerResponse,
  SerializedDetectionResult,
} from './mediapipe';
import {
  DEFAULT_TRACKING_FEATURES,
  type LandmarkPoint,
  type TrackingFeatures,
} from '../../../types/tracking';

let faceLandmarker: FaceLandmarker | null = null;
let poseLandmarker: PoseLandmarker | null = null;
let gestureRecognizer: GestureRecognizer | null = null;
let enabledFeatures: TrackingFeatures = { ...DEFAULT_TRACKING_FEATURES };

const copyLandmarks = (landmarks: NormalizedLandmark[][]): LandmarkPoint[][] =>
  landmarks.map((candidate) =>
    candidate.map((landmark) => ({
      x: landmark.x,
      y: landmark.y,
      z: landmark.z,
      visibility: landmark.visibility,
    })),
  );

const closeLandmarkers = (): void => {
  faceLandmarker?.close();
  poseLandmarker?.close();
  gestureRecognizer?.close();
  faceLandmarker = null;
  poseLandmarker = null;
  gestureRecognizer = null;
};

const ensureModuleFactory = async (wasmPath: string): Promise<void> => {
  const loaderUrl = new URL(
    'vision_wasm_module_internal.js',
    `${wasmPath.replace(/\/$/, '')}/`,
  );
  const module = (await import(/* @vite-ignore */ loaderUrl.href)) as {
    default?: unknown;
  };
  const workerGlobal = globalThis as typeof globalThis & {
    ModuleFactory?: unknown;
  };
  const factory = module.default ?? workerGlobal.ModuleFactory;

  if (typeof factory !== 'function') {
    throw new Error(
      `The MediaPipe WASM loader did not expose ModuleFactory from ${loaderUrl.href}.`,
    );
  }

  workerGlobal.ModuleFactory = factory;
};

const handleMessage = async (request: MediaPipeWorkerRequest): Promise<void> => {
  let phase = 'starting MediaPipe';

  try {
    if (request.type === 'init') {
      closeLandmarkers();
      enabledFeatures = { ...DEFAULT_TRACKING_FEATURES, ...request.features };
      if (!enabledFeatures.face && !enabledFeatures.body && !enabledFeatures.gestures) {
        phase = 'ready with tracking disabled';
        self.postMessage({ type: 'ready' } satisfies MediaPipeWorkerResponse);
        return;
      }
      // The worker itself is an ES module. Use MediaPipe's module loader so the
      // WASM factory is registered in this worker rather than relying on the
      // CommonJS/UMD loader path.
      phase = 'loading MediaPipe WASM loader';
      await ensureModuleFactory(request.assets.wasm);
      phase = 'resolving MediaPipe WASM files';
      const vision = await FilesetResolver.forVisionTasks(request.assets.wasm, true);
      // We register the module factory ourselves below. Clearing the loader path
      // prevents each task from re-importing the already-cached module and losing
      // the factory between face and pose initialization.
      const localVision = { ...vision, wasmLoaderPath: '' };
      if (enabledFeatures.face) {
        phase = 'loading face model';
        faceLandmarker = await FaceLandmarker.createFromOptions(localVision, {
          baseOptions: { modelAssetPath: request.assets.face },
          runningMode: 'VIDEO',
          // The MVP follows one primary creator. Limiting the task to one face
          // reduces inference work and avoids switching between candidates.
          numFaces: 1,
          minFaceDetectionConfidence: 0.2,
          minFacePresenceConfidence: 0.2,
          minTrackingConfidence: 0.2,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
      }
      if (enabledFeatures.body) {
        phase = 'loading pose model';
        // MediaPipe consumes and clears the global factory after creating a task.
        // Re-register it before creating the second task in this worker.
        await ensureModuleFactory(request.assets.wasm);
        poseLandmarker = await PoseLandmarker.createFromOptions(localVision, {
          baseOptions: { modelAssetPath: request.assets.pose },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.4,
          minPosePresenceConfidence: 0.4,
          minTrackingConfidence: 0.4,
          outputSegmentationMasks: false,
        });
      }
      if (enabledFeatures.gestures) {
        phase = 'loading gesture model';
        await ensureModuleFactory(request.assets.wasm);
        gestureRecognizer = await GestureRecognizer.createFromOptions(localVision, {
          baseOptions: { modelAssetPath: request.assets.gesture },
          runningMode: 'VIDEO',
          numHands: 1,
          // Keep detection sensitive enough to find a creator's hand farther
          // from the camera. The renderer applies its own geometry and timing
          // gates before allowing a zoom command.
          minHandDetectionConfidence: 0.3,
          minHandPresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
        });
      }
      phase = 'running inference';
      self.postMessage({ type: 'ready' } satisfies MediaPipeWorkerResponse);
      return;
    }

    if (request.type === 'dispose') {
      closeLandmarkers();
      self.postMessage({ type: 'disposed' } satisfies MediaPipeWorkerResponse);
      return;
    }

    const faceResult = faceLandmarker
      ? faceLandmarker.detectForVideo(request.frame, request.timestampMs)
      : null;
    const poseResult = poseLandmarker
      ? poseLandmarker.detectForVideo(request.frame, request.timestampMs)
      : null;
    const gestureResult = gestureRecognizer
      ? gestureRecognizer.recognizeForVideo(request.frame, request.timestampMs)
      : null;
    const result: SerializedDetectionResult = {
      type: 'result',
      requestId: request.requestId,
      timestampMs: request.timestampMs,
      faceLandmarks: faceResult ? copyLandmarks(faceResult.faceLandmarks) : [],
      poseLandmarks: poseResult ? copyLandmarks(poseResult.landmarks) : [],
      handLandmarks: gestureResult ? copyLandmarks(gestureResult.landmarks) : [],
      // A detected hand can have no useful handedness score. The renderer
      // applies the geometric size gate and temporal debounce separately.
      handConfidence: gestureResult?.handedness[0]?.[0]?.score ?? 0,
    };
    request.frame.close();
    self.postMessage(result satisfies MediaPipeWorkerResponse);
  } catch (error: unknown) {
    if (request.type === 'detect') {
      request.frame.close();
    }
    self.postMessage({
      type: 'error',
      message: `${phase}: ${error instanceof Error ? error.message : String(error)}`,
      ...(request.type === 'detect' ? { requestId: request.requestId } : {}),
    } satisfies MediaPipeWorkerResponse);
  }
};

self.onmessage = (event: MessageEvent<MediaPipeWorkerRequest>): void => {
  void handleMessage(event.data);
};
