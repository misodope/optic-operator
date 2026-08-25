import type { FramingPresetConfig } from '../../types/presets';
import type { SubjectState } from '../../types/tracking';

export interface Dimensions {
  width: number;
  height: number;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type QualityState = 'good' | 'caution' | 'below-target';

export type TrackingStatus = 'disabled' | 'tracking' | 'low-confidence' | 'lost';

export interface CameraControllerInput {
  subject: SubjectState | null;
  source: Dimensions;
  output: Dimensions;
  preset: FramingPresetConfig;
  nowMs: number;
  gestureZoom?: number;
}

export interface CameraControllerState {
  cropCenterX: number;
  cropCenterY: number;
  zoom: number;
  targetCropCenterX: number;
  targetCropCenterY: number;
  targetZoom: number;
  crop: NormalizedRect;
  qualityScale: number;
  qualityState: QualityState;
  trackingStatus: TrackingStatus;
  lastSubjectTimestampMs: number | null;
  updatedAtMs: number;
}
