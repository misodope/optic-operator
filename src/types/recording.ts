export type RecordingStatus =
  'idle' | 'preparing' | 'recording' | 'stopping' | 'complete' | 'failed';

export interface RecordingState {
  status: RecordingStatus;
  elapsedMs: number;
  outputPath: string | null;
  error: string | null;
}

export interface RecordingCaptureHandle {
  captureId: string;
  outputPath: string;
}
