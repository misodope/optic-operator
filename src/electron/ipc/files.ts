import { app, ipcMain, shell } from 'electron';
import path from 'node:path';

export const FILES_IPC_CHANNELS = {
  getDefaultSessionDirectory: 'files:get-default-session-directory',
  revealInFinder: 'files:reveal-in-finder',
} as const;

const recordingsDirectory = (): string =>
  path.resolve(app.getPath('videos'), 'Optic Operator');

const isPathInRecordingsDirectory = (candidatePath: string): boolean => {
  const relativePath = path.relative(
    recordingsDirectory(),
    path.resolve(candidatePath),
  );
  return (
    relativePath !== '' &&
    !relativePath.startsWith('..') &&
    !path.isAbsolute(relativePath)
  );
};

export const registerFilesIpcHandlers = (): void => {
  ipcMain.handle(FILES_IPC_CHANNELS.getDefaultSessionDirectory, () =>
    app.getPath('videos'),
  );

  ipcMain.handle(FILES_IPC_CHANNELS.revealInFinder, (_event, filePath: unknown) => {
    if (typeof filePath !== 'string' || !isPathInRecordingsDirectory(filePath)) {
      throw new Error('Only Optic Operator recording paths can be opened in Finder.');
    }

    shell.showItemInFolder(path.resolve(filePath));
  });
};
