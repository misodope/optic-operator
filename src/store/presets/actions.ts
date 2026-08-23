import type { PresetsStoreActions, PresetsStoreState } from './types';

type SetState = (
  updater:
    | Partial<PresetsStoreState>
    | ((state: PresetsStoreState) => Partial<PresetsStoreState>),
) => void;

export const createPresetsActions = (set: SetState): PresetsStoreActions => ({
  selectPreset: (selectedPreset) => set({ selectedPreset }),
});
