import { create } from 'zustand';

import { createRecordingActions } from './actions';
import { initialRecordingState } from './state';
import type { RecordingStore } from './types';

export const useRecordingStore = create<RecordingStore>((set) => ({
  ...initialRecordingState,
  ...createRecordingActions(set),
}));

export type { RecordingStore } from './types';
