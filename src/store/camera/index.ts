import { create } from 'zustand';

import { createCameraActions } from './actions';
import { initialCameraState } from './state';
import type { CameraStore } from './types';

export const useCameraStore = create<CameraStore>((set) => ({
  ...initialCameraState,
  ...createCameraActions(set),
}));

export type { CameraStore } from './types';
