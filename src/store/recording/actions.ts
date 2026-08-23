import type { RecordingStoreActions, RecordingStoreState } from './types';

type SetState = (
  updater:
    | Partial<RecordingStoreState>
    | ((state: RecordingStoreState) => Partial<RecordingStoreState>),
) => void;

export const createRecordingActions = (set: SetState): RecordingStoreActions => ({
  reset: () =>
    set({ recording: { status: 'idle', elapsedMs: 0, outputPath: null, error: null } }),
  setRecording: (recording) =>
    set((state) => ({ recording: { ...state.recording, ...recording } })),
});
