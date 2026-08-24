import { app, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { RecordingState } from '../../types/recording';

export const RECORDING_IPC_CHANNELS = {
  getState: 'recording:get-state',
  startCapture: 'recording:start-capture',
  appendCaptureChunk: 'recording:append-capture-chunk',
  finishCapture: 'recording:finish-capture',
  cancelCapture: 'recording:cancel-capture',
} as const;

interface ActiveCapture {
  temporaryPath: string;
  outputPath: string;
  writeQueue: Promise<void>;
}

const activeCaptures = new Map<string, ActiveCapture>();

const defaultRecordingState: RecordingState = {
  status: 'idle',
  elapsedMs: 0,
  outputPath: null,
  error: null,
};

const isMimeType = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('video/');

const extensionForMimeType = (mimeType: string): string =>
  mimeType.includes('mp4') ? 'mp4' : 'webm';

const isCaptureId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 80;

const isByteArray = (value: unknown): value is Uint8Array =>
  value instanceof Uint8Array;

const recordingsDirectory = (): string =>
  path.join(app.getPath('videos'), 'Optic Operator');

const uniqueOutputPath = async (extension: string): Promise<string> => {
  const directory = recordingsDirectory();
  await mkdir(directory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(
    directory,
    `optic-operator-${timestamp}-${randomUUID().slice(0, 8)}.${extension}`,
  );
};

const captureFor = (captureId: string): ActiveCapture => {
  const capture = activeCaptures.get(captureId);
  if (!capture) {
    throw new Error('The recording capture is no longer active.');
  }
  return capture;
};

export const registerRecordingIpcHandlers = (): void => {
  ipcMain.handle(RECORDING_IPC_CHANNELS.getState, () => defaultRecordingState);

  ipcMain.handle(
    RECORDING_IPC_CHANNELS.startCapture,
    async (_event, mimeType: unknown) => {
      if (!isMimeType(mimeType)) {
        throw new Error('The recording format is invalid.');
      }

      const extension = extensionForMimeType(mimeType);
      const outputPath = await uniqueOutputPath(extension);
      const captureId = randomUUID();
      const temporaryPath = `${outputPath}.part`;
      await writeFile(temporaryPath, Buffer.alloc(0));
      activeCaptures.set(captureId, {
        temporaryPath,
        outputPath,
        writeQueue: Promise.resolve(),
      });

      return { captureId, outputPath };
    },
  );

  ipcMain.handle(
    RECORDING_IPC_CHANNELS.appendCaptureChunk,
    async (_event, captureId: unknown, chunk: unknown) => {
      if (!isCaptureId(captureId) || !isByteArray(chunk)) {
        throw new Error('The recording chunk is invalid.');
      }

      const capture = captureFor(captureId);
      capture.writeQueue = capture.writeQueue.then(() =>
        appendFile(capture.temporaryPath, Buffer.from(chunk)),
      );
      await capture.writeQueue;
    },
  );

  ipcMain.handle(
    RECORDING_IPC_CHANNELS.finishCapture,
    async (_event, captureId: unknown) => {
      if (!isCaptureId(captureId)) {
        throw new Error('The recording capture ID is invalid.');
      }

      const capture = captureFor(captureId);
      await capture.writeQueue;
      await rename(capture.temporaryPath, capture.outputPath);
      activeCaptures.delete(captureId);
      return capture.outputPath;
    },
  );

  ipcMain.handle(
    RECORDING_IPC_CHANNELS.cancelCapture,
    async (_event, captureId: unknown) => {
      if (!isCaptureId(captureId)) {
        throw new Error('The recording capture ID is invalid.');
      }

      const capture = captureFor(captureId);
      try {
        await capture.writeQueue;
      } finally {
        await unlink(capture.temporaryPath).catch(() => undefined);
        activeCaptures.delete(captureId);
      }
    },
  );
};
