import type { RecordingState } from '../../types/recording';

export interface RecordingStoreState {
  recording: RecordingState;
}

export interface RecordingStoreActions {
  reset: () => void;
  setRecording: (recording: Partial<RecordingState>) => void;
}

export type RecordingStore = RecordingStoreState & RecordingStoreActions;
