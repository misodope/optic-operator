import type { CameraStoreActions, CameraStoreState } from './types';

type SetState = (
  updater:
    | Partial<CameraStoreState>
    | ((state: CameraStoreState) => Partial<CameraStoreState>),
) => void;

export const createCameraActions = (set: SetState): CameraStoreActions => ({
  setDevices: (videoDevices, audioDevices) => set({ videoDevices, audioDevices }),
  selectDevice: (selectedDeviceId, selectedDeviceLabel) =>
    set({ selectedDeviceId, selectedDeviceLabel, error: null }),
  selectAudioDevice: (selectedAudioDeviceId, selectedAudioDeviceLabel) =>
    set({ selectedAudioDeviceId, selectedAudioDeviceLabel, error: null }),
  setPermissionState: (kind, state) =>
    set((current) => ({
      permissionState: { ...current.permissionState, [kind]: state },
    })),
  setStatus: (status) => set({ status }),
  setStreamInfo: (streamInfo) => set({ streamInfo }),
  setError: (error) => set({ error, status: error ? 'error' : 'idle' }),
});
