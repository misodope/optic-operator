import type { CameraStatus, CameraStreamInfo } from '../../types/camera';

export interface CameraStoreState {
  status: CameraStatus;
  selectedDeviceId: string | null;
  selectedDeviceLabel: string | null;
  streamInfo: CameraStreamInfo | null;
  error: string | null;
}

export interface CameraStoreActions {
  selectDevice: (deviceId: string, label: string) => void;
  setStatus: (status: CameraStatus) => void;
  setStreamInfo: (streamInfo: CameraStreamInfo | null) => void;
  setError: (error: string | null) => void;
}

export type CameraStore = CameraStoreState & CameraStoreActions;
