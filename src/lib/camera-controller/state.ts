import type { CameraControllerState } from './types';

export const createInitialControllerState = (nowMs = 0): CameraControllerState => ({
  cropCenterX: 0.5,
  cropCenterY: 0.5,
  zoom: 1,
  targetCropCenterX: 0.5,
  targetCropCenterY: 0.5,
  targetZoom: 1,
  crop: { x: 0, y: 0, width: 1, height: 1 },
  qualityScale: 0,
  qualityState: 'below-target',
  trackingStatus: 'disabled',
  lastSubjectTimestampMs: null,
  updatedAtMs: nowMs,
});
