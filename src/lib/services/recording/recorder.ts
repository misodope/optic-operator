export const RECORDING_FRAME_RATE = 30;

export const RECORDING_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
] as const;

export interface CanvasRecorderOptions {
  canvas: HTMLCanvasElement;
  audioTracks?: MediaStreamTrack[];
  onChunk: (chunk: Blob) => Promise<void>;
  mimeType?: string;
  frameRate?: number;
}

export interface CanvasRecorder {
  readonly mimeType: string;
  start: () => void;
  stop: () => Promise<void>;
  cancel: () => Promise<void>;
}

export const selectRecordingMimeType = (
  isSupported: (mimeType: string) => boolean = (mimeType) =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType),
): string => {
  const supported = RECORDING_MIME_TYPES.find((mimeType) => isSupported(mimeType));
  if (!supported) {
    throw new Error(
      'This Electron runtime does not support a compatible recording format.',
    );
  }
  return supported;
};

export const createCanvasRecorder = ({
  canvas,
  audioTracks = [],
  onChunk,
  mimeType: requestedMimeType,
  frameRate = RECORDING_FRAME_RATE,
}: CanvasRecorderOptions): CanvasRecorder => {
  const videoStream = canvas.captureStream(frameRate);
  const stream = new MediaStream(
    [videoStream.getVideoTracks()[0], ...audioTracks].filter(Boolean),
  );
  const mimeType = requestedMimeType ?? selectRecordingMimeType();
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 12_000_000,
    audioBitsPerSecond: 192_000,
  });

  let pendingWrites = Promise.resolve();
  let writeError: Error | null = null;
  let stopPromise: Promise<void> | null = null;
  let stopResolve: (() => void) | null = null;
  let stopReject: ((error: Error) => void) | null = null;

  const finishStop = (): void => {
    void pendingWrites.then(() => {
      stream.getTracks().forEach((track) => track.stop());
      if (writeError) {
        stopReject?.(writeError);
      } else {
        stopResolve?.();
      }
      stopResolve = null;
      stopReject = null;
    });
  };

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size === 0) {
      return;
    }
    pendingWrites = pendingWrites
      .then(() => onChunk(event.data))
      .catch((error: unknown) => {
        writeError = error instanceof Error ? error : new Error(String(error));
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      });
  });

  recorder.addEventListener('error', (event) => {
    const error = (event as Event & { error?: Error }).error;
    writeError = error ?? new Error('The recording encoder failed.');
  });
  recorder.addEventListener('stop', finishStop);

  return {
    mimeType,
    start: () => {
      if (recorder.state !== 'inactive') {
        throw new Error('The recording has already started.');
      }
      recorder.start(1000);
    },
    stop: () => {
      if (stopPromise) {
        return stopPromise;
      }
      stopPromise = new Promise<void>((resolve, reject) => {
        stopResolve = resolve;
        stopReject = reject;
        if (recorder.state === 'inactive') {
          finishStop();
          return;
        }
        recorder.stop();
      });
      return stopPromise;
    },
    cancel: () => {
      return (
        stopPromise ??
        (recorder.state === 'inactive'
          ? Promise.resolve()
          : new Promise<void>((resolve, reject) => {
              stopPromise = new Promise<void>((innerResolve, innerReject) => {
                stopResolve = innerResolve;
                stopReject = innerReject;
              });
              recorder.stop();
              void stopPromise.then(resolve).catch(reject);
            }))
      );
    },
  };
};
