import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

import { app } from 'electron';

const resolveFfmpegPath = (): string => {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'ffmpeg')
    : path.resolve(process.cwd(), 'node_modules/ffmpeg-static/ffmpeg');
};

export const convertCaptureToMp4 = (
  inputPath: string,
  outputPath: string,
): Promise<void> =>
  new Promise((resolve, reject) => {
    let stderr = '';
    let settled = false;

    const fail = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    let encoder: ChildProcess;
    try {
      encoder = spawn(
        resolveFfmpegPath(),
        [
          '-y',
          '-i',
          inputPath,
          '-map',
          '0:v:0',
          '-map',
          '0:a:0?',
          '-c:v',
          'libx264',
          '-preset',
          'medium',
          '-crf',
          '18',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-b:a',
          '192k',
          '-movflags',
          '+faststart',
          outputPath,
        ],
        { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true },
      );
    } catch (error: unknown) {
      fail(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    encoder.stderr?.on('data', (chunk: Buffer | string) => {
      stderr = `${stderr}${chunk}`.slice(-8_000);
    });

    encoder.once('error', (error) => {
      fail(new Error(`FFmpeg could not start: ${error.message}`));
    });
    encoder.once('close', (code) => {
      if (code === 0) {
        settled = true;
        resolve();
        return;
      }

      const details = stderr.trim();
      fail(
        new Error(
          `FFmpeg could not create the MP4${details ? `: ${details}` : ` (exit code ${code ?? 'unknown'})`}`,
        ),
      );
    });
  });
