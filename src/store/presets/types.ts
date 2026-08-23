import type { FramingPresetId } from '../../types/presets';

export interface PresetsStoreState {
  selectedPreset: FramingPresetId;
}

export interface PresetsStoreActions {
  selectPreset: (selectedPreset: FramingPresetId) => void;
}

export type PresetsStore = PresetsStoreState & PresetsStoreActions;
