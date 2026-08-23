import { describe, expect, it, vi } from 'vitest';

import {
  monitorStream,
  openCameraStream,
  readStreamInfo,
  stopMediaStream,
} from './stream';

interface FakeTrack {
  kind: 'video' | 'audio';
  stopped: boolean;
  getSettings: () => MediaTrackSettings;
  stop: () => void;
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
  emit: (type: string) => void;
}

const createTrack = (
  kind: FakeTrack['kind'],
  settings: MediaTrackSettings,
): FakeTrack => {
  const listeners = new Map<string, Set<EventListener>>();
  const track: FakeTrack = {
    kind,
    stopped: false,
    getSettings: () => settings,
    stop: () => {
      track.stopped = true;
    },
    addEventListener: (type, listener) => {
      const current = listeners.get(type) ?? new Set<EventListener>();
      current.add(listener);
      listeners.set(type, current);
    },
    removeEventListener: (type, listener) => listeners.get(type)?.delete(listener),
    emit: (type) =>
      listeners.get(type)?.forEach((listener) => listener(new Event(type))),
  };

  return track;
};

const createStream = (videoTrack: FakeTrack, audioTrack?: FakeTrack): MediaStream =>
  ({
    getVideoTracks: () => [videoTrack],
    getAudioTracks: () => (audioTrack ? [audioTrack] : []),
    getTracks: () => (audioTrack ? [videoTrack, audioTrack] : [videoTrack]),
  }) as unknown as MediaStream;

describe('camera stream service', () => {
  it('requests the 4K/30 target and falls back when it is not supported', async () => {
    const stream = createStream(createTrack('video', { deviceId: 'camera-1' }));
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('unsupported', 'OverconstrainedError'))
      .mockResolvedValueOnce(stream);

    await expect(
      openCameraStream({ mediaDevices: { getUserMedia }, videoDeviceId: 'camera-1' }),
    ).resolves.toBe(stream);

    expect(getUserMedia).toHaveBeenNthCalledWith(1, {
      video: {
        deviceId: { exact: 'camera-1' },
        width: { ideal: 3840 },
        height: { ideal: 2160 },
        frameRate: { ideal: 30, max: 30 },
      },
      audio: false,
    });
    expect(getUserMedia).toHaveBeenNthCalledWith(2, {
      video: { deviceId: { exact: 'camera-1' } },
      audio: false,
    });
  });

  it('stores actual video metadata instead of requested dimensions', () => {
    const videoTrack = createTrack('video', {
      deviceId: 'capture-card',
      width: 1920,
      height: 1080,
      frameRate: 29.97,
    });
    const audioTrack = createTrack('audio', { deviceId: 'capture-audio' });
    const stream = createStream(videoTrack, audioTrack);

    const info = readStreamInfo({ videoWidth: 1280, videoHeight: 720 }, stream);

    expect(info).toEqual({
      width: 1280,
      height: 720,
      frameRate: 29.97,
      aspectRatio: 1280 / 720,
      deviceId: 'capture-card',
      audioDeviceId: 'capture-audio',
    });
  });

  it('stops every track when the source is replaced', () => {
    const videoTrack = createTrack('video', {});
    const audioTrack = createTrack('audio', {});
    const stream = createStream(videoTrack, audioTrack);

    stopMediaStream(stream);

    expect(videoTrack.stopped).toBe(true);
    expect(audioTrack.stopped).toBe(true);
  });

  it('reports ended tracks once and supports listener cleanup', () => {
    const videoTrack = createTrack('video', {});
    const stream = createStream(videoTrack);
    const onEnded = vi.fn();
    const cleanup = monitorStream(stream, onEnded);

    videoTrack.emit('ended');
    videoTrack.emit('ended');
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(onEnded).toHaveBeenCalledWith({
      code: 'STREAM_ENDED',
      message: 'The camera stream ended. Reconnect the source to continue.',
    });

    cleanup();
    expect(() => videoTrack.emit('ended')).not.toThrow();
  });
});
