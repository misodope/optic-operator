import {
  FaceLandmarker,
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

import type {
  MediaPipeWorkerRequest,
  MediaPipeWorkerResponse,
  SerializedDetectionResult,
} from './mediapipe';
import type { LandmarkPoint } from '../../../types/tracking';

let faceLandmarker: FaceLandmarker | null = null;
let poseLandmarker: PoseLandmarker | null = null;

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
  faceLandmarker = null;
  poseLandmarker = null;
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
      // The worker itself is an ES module. Use MediaPipe's module loader so the
      // WASM factory is registered in this worker rather than relying on the
      // CommonJS/UMD loader path.
      phase = 'loading MediaPipe WASM loader';
      await ensureModuleFactory(request.assets.wasm);
      phase = 'resolving MediaPipe WASM files';
      const vision = await FilesetResolver.forVisionTasks(request.assets.wasm, true);
      phase = 'loading face model';
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: request.assets.face },
        runningMode: 'VIDEO',
        numFaces: 2,
        minFaceDetectionConfidence: 0.45,
        minFacePresenceConfidence: 0.45,
        minTrackingConfidence: 0.45,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
      phase = 'loading pose model';
      poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: request.assets.pose },
        runningMode: 'VIDEO',
        numPoses: 2,
        minPoseDetectionConfidence: 0.4,
        minPosePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
        outputSegmentationMasks: false,
      });
      phase = 'running inference';
      self.postMessage({ type: 'ready' } satisfies MediaPipeWorkerResponse);
      return;
    }

    if (request.type === 'dispose') {
      closeLandmarkers();
      self.postMessage({ type: 'disposed' } satisfies MediaPipeWorkerResponse);
      return;
    }

    if (!faceLandmarker || !poseLandmarker) {
      throw new Error('MediaPipe tracker is not initialized.');
    }

    const faceResult = faceLandmarker.detectForVideo(
      request.frame,
      request.timestampMs,
    );
    const poseResult = poseLandmarker.detectForVideo(
      request.frame,
      request.timestampMs,
    );
    const result: SerializedDetectionResult = {
      type: 'result',
      requestId: request.requestId,
      timestampMs: request.timestampMs,
      faceLandmarks: copyLandmarks(faceResult.faceLandmarks),
      poseLandmarks: copyLandmarks(poseResult.landmarks),
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
