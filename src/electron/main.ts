import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

import { registerDeviceIpcHandlers } from './ipc/devices';
import { registerRecordingIpcHandlers } from './ipc/recording';

if (started) {
  app.quit();
}

const IPC_CHANNELS = {
  getVersion: 'app:get-version',
  getDefaultSessionDirectory: 'files:get-default-session-directory',
} as const;

const registerIpcHandlers = (): void => {
  ipcMain.handle(IPC_CHANNELS.getVersion, () => app.getVersion());
  ipcMain.handle(IPC_CHANNELS.getDefaultSessionDirectory, () => app.getPath('videos'));
};

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    title: 'Optic Operator',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.on(
    'console-message',
    (_event, level, message, line, sourceId) => {
      console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
    },
  );

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

app.whenReady().then(() => {
  registerIpcHandlers();
  registerDeviceIpcHandlers();
  registerRecordingIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
