import type { CameraStoreActions, CameraStoreState } from './types';

type SetState = (
  updater:
    | Partial<CameraStoreState>
    | ((state: CameraStoreState) => Partial<CameraStoreState>),
) => void;

export const createCameraActions = (set: SetState): CameraStoreActions => ({
  selectDevice: (selectedDeviceId, selectedDeviceLabel) =>
    set({ selectedDeviceId, selectedDeviceLabel, error: null }),
  setStatus: (status) => set({ status }),
  setStreamInfo: (streamInfo) => set({ streamInfo }),
  setError: (error) => set({ error, status: error ? 'error' : 'idle' }),
});
