import { create } from 'zustand';

import { createPresetsActions } from './actions';
import { initialPresetsState } from './state';
import type { PresetsStore } from './types';

export const usePresetsStore = create<PresetsStore>((set) => ({
  ...initialPresetsState,
  ...createPresetsActions(set),
}));

export type { PresetsStore } from './types';
