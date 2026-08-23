export type CameraStatus =
  'idle' | 'permission-required' | 'connecting' | 'ready' | 'disconnected' | 'error';

export type MediaPermissionState = 'unknown' | 'granted' | 'denied' | 'prompt';

export type CameraDeviceKind = 'videoinput' | 'audioinput';

export type PermissionKind = 'camera' | 'microphone';

export type CameraErrorCode =
  | 'PERMISSION_DENIED'
  | 'PERMISSION_REQUEST_FAILED'
  | 'NO_DEVICE'
  | 'CONSTRAINTS_UNSATISFIED'
  | 'NOT_READABLE'
  | 'STREAM_ENDED'
  | 'CAPTURE_ERROR'
  | 'INVALID_PERMISSION_KIND'
  | 'UNKNOWN';

export interface CameraError {
  code: CameraErrorCode;
  message: string;
}

export interface CameraDevice {
  deviceId: string;
  label: string;
  kind: CameraDeviceKind;
}

export interface CameraStreamInfo {
  width: number;
  height: number;
  frameRate: number | null;
  aspectRatio: number;
  deviceId: string;
  audioDeviceId: string | null;
}
