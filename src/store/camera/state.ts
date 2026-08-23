import type { CameraStoreState } from './types';

export const initialCameraState: CameraStoreState = {
  status: 'idle',
  videoDevices: [],
  audioDevices: [],
  selectedDeviceId: null,
  selectedDeviceLabel: null,
  selectedAudioDeviceId: null,
  selectedAudioDeviceLabel: null,
  permissionState: {
    camera: 'unknown',
    microphone: 'unknown',
  },
  streamInfo: null,
  error: null,
};
