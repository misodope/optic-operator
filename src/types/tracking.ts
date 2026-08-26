export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
}

export interface TrackingFeatures {
  face: boolean;
  body: boolean;
  gestures: boolean;
}

export const DEFAULT_TRACKING_FEATURES: TrackingFeatures = {
  face: true,
  body: true,
  gestures: true,
};

export interface FaceTrackingSummary {
  landmarks: LandmarkPoint[];
  centerX: number;
  centerY: number;
  eyeX: number;
  eyeY: number;
  width: number;
  height: number;
  confidence: number;
  eyesDetected: boolean;
}

export interface PoseTrackingSummary {
  landmarks: LandmarkPoint[];
  shoulderCenterX: number | null;
  shoulderCenterY: number | null;
  shoulderWidth: number | null;
  shoulderVisibility: number;
  torsoVisibility: number;
  confidence: number;
}

export interface SubjectState {
  detected: boolean;
  confidence: number;
  x: number;
  y: number;
  eyeY: number;
  shoulderWidth: number | null;
  shoulderCenterX?: number | null;
  shoulderCenterY?: number | null;
  shoulderVisibility?: number;
  faceWidth?: number | null;
  faceHeight?: number | null;
  lastSeenTimestampMs?: number | null;
  lost?: boolean;
  reacquired?: boolean;
  face?: FaceTrackingSummary | null;
  pose?: PoseTrackingSummary | null;
  timestampMs: number;
}

export type RuntimeTrackingStatus =
  'disabled' | 'initializing' | 'tracking' | 'low-confidence' | 'lost' | 'error';

export type GestureCommand = 'none' | 'zoom-in' | 'zoom-out';

export interface GestureState {
  command: GestureCommand;
  /** Normalized intent: -1 zooms out, 1 zooms in, 0 releases manual zoom. */
  zoomIntent: number;
  confidence: number;
  pinchDistance: number | null;
  label: string | null;
}

export interface TrackingDiagnostics {
  status: RuntimeTrackingStatus;
  confidence: number;
  subject: SubjectState | null;
  lastResultTimestampMs: number | null;
  inferenceFps: number;
  staleResultsDropped: number;
  faceLandmarkCount: number;
  poseLandmarkCount: number;
  handLandmarks: LandmarkPoint[] | null;
  gesture: GestureState;
  error: string | null;
}

export interface TrackingSample {
  timestampMs: number;
  sourceFrameIndex: number;
  subject: SubjectState | null;
  cropCenterX: number;
  cropCenterY: number;
  zoom: number;
}
