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
  timestampMs: number;
}

export interface TrackingSample {
  timestampMs: number;
  sourceFrameIndex: number;
  subject: SubjectState | null;
  cropCenterX: number;
  cropCenterY: number;
  zoom: number;
}
