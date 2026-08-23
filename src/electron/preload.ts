import { contextBridge, ipcRenderer } from 'electron';

import type { OpticOperatorApi } from '../types';

const opticOperatorApi: OpticOperatorApi = {
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version') as Promise<string>,
  },
  devices: {
    getPermissionState: (kind) =>
      ipcRenderer.invoke('devices:get-permission-state', kind),
    requestPermission: (kind) => ipcRenderer.invoke('devices:request-permission', kind),
  },
  recording: {
    getState: () => ipcRenderer.invoke('recording:get-state'),
  },
  files: {
    getDefaultSessionDirectory: () =>
      ipcRenderer.invoke('files:get-default-session-directory'),
  },
};

contextBridge.exposeInMainWorld('opticOperator', opticOperatorApi);
