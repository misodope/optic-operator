import { ipcMain, systemPreferences } from 'electron';

import type {
  CameraError,
  MediaPermissionState,
  PermissionKind,
} from '../../types/camera';

export const DEVICE_IPC_CHANNELS = {
  getPermissionState: 'devices:get-permission-state',
  requestPermission: 'devices:request-permission',
} as const;

const isPermissionKind = (value: unknown): value is PermissionKind =>
  value === 'camera' || value === 'microphone';

const mapPermissionState = (status: string): MediaPermissionState => {
  switch (status) {
    case 'granted':
      return 'granted';
    case 'denied':
    case 'restricted':
      return 'denied';
    case 'not-determined':
      return 'prompt';
    default:
      return 'unknown';
  }
};

const getPermissionState = (kind: PermissionKind): MediaPermissionState => {
  if (process.platform !== 'darwin') {
    return 'unknown';
  }

  return mapPermissionState(systemPreferences.getMediaAccessStatus(kind));
};

const permissionError = (message: string): CameraError => ({
  code: 'PERMISSION_REQUEST_FAILED',
  message,
});

export const registerDeviceIpcHandlers = (): void => {
  ipcMain.handle(DEVICE_IPC_CHANNELS.getPermissionState, (_event, kind: unknown) => {
    if (!isPermissionKind(kind)) {
      return 'unknown' satisfies MediaPermissionState;
    }

    try {
      return getPermissionState(kind);
    } catch {
      return 'unknown' satisfies MediaPermissionState;
    }
  });

  ipcMain.handle(
    DEVICE_IPC_CHANNELS.requestPermission,
    async (_event, kind: unknown) => {
      if (!isPermissionKind(kind)) {
        return {
          granted: false,
          state: 'unknown' satisfies MediaPermissionState,
          error: permissionError('The requested media permission is not supported.'),
        };
      }

      if (process.platform !== 'darwin') {
        return {
          granted: false,
          state: 'unknown' satisfies MediaPermissionState,
          error: null,
        };
      }

      try {
        const granted = await systemPreferences.askForMediaAccess(kind);
        return { granted, state: getPermissionState(kind), error: null };
      } catch {
        return {
          granted: false,
          state: getPermissionState(kind),
          error: permissionError(
            'macOS could not complete the media permission request.',
          ),
        };
      }
    },
  );
};
