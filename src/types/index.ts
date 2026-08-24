export * from './camera';
export * from './presets';
export * from './recording';
export * from './tracking';

import type { MediaPermissionState } from './camera';
import type { RecordingCaptureHandle, RecordingState } from './recording';

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
    startCapture: (mimeType: string) => Promise<RecordingCaptureHandle>;
    appendCaptureChunk: (captureId: string, chunk: Uint8Array) => Promise<void>;
    finishCapture: (captureId: string) => Promise<string>;
    cancelCapture: (captureId: string) => Promise<void>;
  };
  files: {
    getDefaultSessionDirectory: () => Promise<string>;
  };
}
