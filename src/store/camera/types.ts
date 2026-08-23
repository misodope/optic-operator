import type {
  CameraDevice,
  CameraError,
  CameraStatus,
  CameraStreamInfo,
  MediaPermissionState,
  PermissionKind,
} from '../../types/camera';

export interface CameraStoreState {
  status: CameraStatus;
  videoDevices: CameraDevice[];
  audioDevices: CameraDevice[];
  selectedDeviceId: string | null;
  selectedDeviceLabel: string | null;
  selectedAudioDeviceId: string | null;
  selectedAudioDeviceLabel: string | null;
  permissionState: {
    camera: MediaPermissionState;
    microphone: MediaPermissionState;
  };
  streamInfo: CameraStreamInfo | null;
  error: CameraError | null;
}

export interface CameraStoreActions {
  setDevices: (videoDevices: CameraDevice[], audioDevices: CameraDevice[]) => void;
  selectDevice: (deviceId: string, label: string) => void;
  selectAudioDevice: (deviceId: string | null, label: string | null) => void;
  setPermissionState: (kind: PermissionKind, state: MediaPermissionState) => void;
  setStatus: (status: CameraStatus) => void;
  setStreamInfo: (streamInfo: CameraStreamInfo | null) => void;
  setError: (error: CameraError | null) => void;
}

export type CameraStore = CameraStoreState & CameraStoreActions;
