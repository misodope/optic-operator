export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
}

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

export interface TrackingDiagnostics {
  status: RuntimeTrackingStatus;
  confidence: number;
  subject: SubjectState | null;
  lastResultTimestampMs: number | null;
  inferenceFps: number;
  staleResultsDropped: number;
  faceLandmarkCount: number;
  poseLandmarkCount: number;
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
