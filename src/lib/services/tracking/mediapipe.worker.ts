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

const clampUnit = (value: number): number => Math.max(0, Math.min(1, value));

const boundedRoi = (center: number, size: number): { start: number; end: number } => {
  const boundedSize = Math.max(0.01, Math.min(1, size));
  const start = clampUnit(center - boundedSize / 2);
  const adjustedStart = Math.min(start, 1 - boundedSize);
  return { start: adjustedStart, end: adjustedStart + boundedSize };
};

const faceRegionOfInterest = (
  poseLandmarks: NormalizedLandmark[][],
): { left: number; top: number; right: number; bottom: number } | undefined => {
  const landmarks = poseLandmarks[0];
  const nose = landmarks?.[0];
  const leftShoulder = landmarks?.[11];
  const rightShoulder = landmarks?.[12];

  if (!nose || !leftShoulder || !rightShoulder) {
    return undefined;
  }

  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
  // A generous upper-body ROI makes the face larger to the detector when the
  // creator is farther from the camera, while preserving enough headroom for
  // pose noise and different body proportions.
  const roiWidth = Math.max(0.22, Math.min(0.55, shoulderWidth * 1.35));
  const roiHeight = Math.max(0.28, Math.min(0.6, roiWidth * 1.25));
  const horizontal = boundedRoi(nose.x, roiWidth);
  const vertical = boundedRoi(nose.y + roiHeight * 0.05, roiHeight);

  return {
    left: horizontal.start,
    top: vertical.start,
    right: horizontal.end,
    bottom: vertical.end,
  };
};

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
      // We register the module factory ourselves below. Clearing the loader path
      // prevents each task from re-importing the already-cached module and losing
      // the factory between face and pose initialization.
      const localVision = { ...vision, wasmLoaderPath: '' };
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

    const poseResult = poseLandmarker.detectForVideo(
      request.frame,
      request.timestampMs,
    );
    const faceRoi = faceRegionOfInterest(poseResult.landmarks);
    const faceResult = faceLandmarker.detectForVideo(
      request.frame,
      request.timestampMs,
      faceRoi ? { regionOfInterest: faceRoi } : undefined,
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
