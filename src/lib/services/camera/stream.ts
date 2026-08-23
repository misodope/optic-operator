import type { CameraError, CameraStreamInfo } from '../../../types/camera';
import { calculateAspectRatio } from '../../utils/aspectRatio';
import {
  CameraServiceError,
  type MediaDevicesAdapter,
  toCameraServiceError,
} from './devices';

export interface OpenCameraStreamOptions {
  mediaDevices: Pick<MediaDevicesAdapter, 'getUserMedia'>;
  videoDeviceId: string;
  audioDeviceId?: string | null;
}

const requestedVideoConstraints = (videoDeviceId: string): MediaTrackConstraints => ({
  deviceId: { exact: videoDeviceId },
  width: { ideal: 3840 },
  height: { ideal: 2160 },
  frameRate: { ideal: 30, max: 30 },
});

const fallbackVideoConstraints = (videoDeviceId: string): MediaTrackConstraints => ({
  deviceId: { exact: videoDeviceId },
});

const audioConstraints = (
  audioDeviceId?: string | null,
): MediaTrackConstraints | false =>
  audioDeviceId ? { deviceId: { exact: audioDeviceId } } : false;

export const openCameraStream = async ({
  mediaDevices,
  videoDeviceId,
  audioDeviceId,
}: OpenCameraStreamOptions): Promise<MediaStream> => {
  const requested = {
    video: requestedVideoConstraints(videoDeviceId),
    audio: audioConstraints(audioDeviceId),
  } satisfies MediaStreamConstraints;

  try {
    return await mediaDevices.getUserMedia(requested);
  } catch (error) {
    const normalized = toCameraServiceError(error);
    if (normalized.code !== 'CONSTRAINTS_UNSATISFIED') {
      throw normalized;
    }
  }

  try {
    return await mediaDevices.getUserMedia({
      video: fallbackVideoConstraints(videoDeviceId),
      audio: audioConstraints(audioDeviceId),
    });
  } catch (error) {
    throw toCameraServiceError(error);
  }
};

const streamDeviceId = (stream: MediaStream): string =>
  stream.getVideoTracks()[0]?.getSettings().deviceId ?? '';

export const readStreamInfo = (
  video: Pick<HTMLVideoElement, 'videoWidth' | 'videoHeight'>,
  stream: MediaStream,
): CameraStreamInfo => {
  const track = stream.getVideoTracks()[0];
  if (!track) {
    throw new CameraServiceError(
      'NO_DEVICE',
      'The selected source has no video track.',
    );
  }

  const settings = track.getSettings();
  const width = video.videoWidth || settings.width || 0;
  const height = video.videoHeight || settings.height || 0;

  if (width <= 0 || height <= 0) {
    throw new CameraServiceError(
      'CAPTURE_ERROR',
      'The camera did not report usable video dimensions after loading metadata.',
    );
  }

  const audioTrack = stream.getAudioTracks()[0];

  return {
    width,
    height,
    frameRate: settings.frameRate ?? null,
    aspectRatio: calculateAspectRatio(width, height),
    deviceId: settings.deviceId ?? streamDeviceId(stream),
    audioDeviceId: audioTrack?.getSettings().deviceId ?? null,
  };
};

export const attachStreamToVideo = async (
  video: HTMLVideoElement,
  stream: MediaStream,
): Promise<CameraStreamInfo> => {
  video.srcObject = stream;

  if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
    await new Promise<void>((resolve, reject) => {
      const handleMetadata = (): void => {
        video.removeEventListener('loadedmetadata', handleMetadata);
        video.removeEventListener('error', handleError);
        resolve();
      };
      const handleError = (): void => {
        video.removeEventListener('loadedmetadata', handleMetadata);
        video.removeEventListener('error', handleError);
        reject(
          new CameraServiceError('CAPTURE_ERROR', 'The camera preview could not load.'),
        );
      };

      video.addEventListener('loadedmetadata', handleMetadata, { once: true });
      video.addEventListener('error', handleError, { once: true });
    });
  }

  await video.play();
  return readStreamInfo(video, stream);
};

export const stopMediaStream = (stream: MediaStream | null): void => {
  stream?.getTracks().forEach((track) => track.stop());
};

export const monitorStream = (
  stream: MediaStream,
  onEnded: (error: CameraError) => void,
): (() => void) => {
  let called = false;
  const handleEnded = (): void => {
    if (called) {
      return;
    }

    called = true;
    onEnded({
      code: 'STREAM_ENDED',
      message: 'The camera stream ended. Reconnect the source to continue.',
    });
  };

  stream.getTracks().forEach((track) => track.addEventListener('ended', handleEnded));

  return () => {
    stream
      .getTracks()
      .forEach((track) => track.removeEventListener('ended', handleEnded));
  };
};
