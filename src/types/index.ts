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
  };
  recording: {
    getState: () => Promise<RecordingState>;
  };
  files: {
    getDefaultSessionDirectory: () => Promise<string>;
  };
}
