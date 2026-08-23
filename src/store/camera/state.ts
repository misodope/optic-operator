import type { CameraStoreState } from './types';

export const initialCameraState: CameraStoreState = {
  status: 'idle',
  selectedDeviceId: null,
  selectedDeviceLabel: null,
  streamInfo: null,
  error: null,
};
