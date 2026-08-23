export interface SubjectState {
  detected: boolean;
  confidence: number;
  x: number;
  y: number;
  eyeY: number;
  shoulderWidth: number | null;
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
