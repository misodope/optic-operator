import type { RecordingStoreState } from './types';

export const initialRecordingState: RecordingStoreState = {
  recording: {
    status: 'idle',
    elapsedMs: 0,
    outputPath: null,
    error: null,
  },
};
