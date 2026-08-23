export type CameraStatus =
  'idle' | 'permission-required' | 'connecting' | 'ready' | 'disconnected' | 'error';

export type MediaPermissionState = 'unknown' | 'granted' | 'denied' | 'prompt';

export interface CameraDevice {
  deviceId: string;
  label: string;
  kind: 'videoinput' | 'audioinput';
}

export interface CameraStreamInfo {
  width: number;
  height: number;
  frameRate: number | null;
  aspectRatio: number;
  deviceId: string;
}
