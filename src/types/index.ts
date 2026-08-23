export * from './camera';
export * from './presets';
export * from './recording';
export * from './tracking';

import type { MediaPermissionState } from './camera';

export interface OpticOperatorApi {
  app: {
    getVersion: () => Promise<string>;
  };
  devices: {
    getPermissionState: (
      kind: 'camera' | 'microphone',
    ) => Promise<MediaPermissionState>;
    requestPermission: (kind: 'camera' | 'microphone') => Promise<{
      granted: boolean;
      state: MediaPermissionState;
      error: import('./camera').CameraError | null;
    }>;
  };
  recording: {
    getState: () => Promise<RecordingState>;
  };
  files: {
    getDefaultSessionDirectory: () => Promise<string>;
  };
}
