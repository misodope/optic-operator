import { describe, expect, it, vi } from 'vitest';

import {
  enumerateDevices,
  normalizeMediaDevices,
  requestMediaPermissions,
  subscribeToDeviceChanges,
  toCameraServiceError,
} from './devices';

const device = (kind: MediaDeviceKind, deviceId: string, label = '') =>
  ({ kind, deviceId, label }) as MediaDeviceInfo;

describe('camera device service', () => {
  it('returns empty video and audio lists when no devices are present', async () => {
    const result = await enumerateDevices({
      enumerateDevices: vi.fn().mockResolvedValue([]),
      getUserMedia: vi.fn(),
    });

    expect(result).toEqual({ video: [], audio: [] });
  });

  it('keeps device ids stable and makes duplicate labels distinguishable', () => {
    const result = normalizeMediaDevices([
      device('videoinput', 'camera-1', 'USB Camera'),
      device('videoinput', 'camera-2', 'USB Camera'),
      device('audioinput', 'mic-1', 'Room Mic'),
      device('audioinput', 'mic-2', 'Room Mic'),
    ]);

    expect(result.video).toEqual([
      { deviceId: 'camera-1', label: 'USB Camera', kind: 'videoinput' },
      { deviceId: 'camera-2', label: 'USB Camera (2)', kind: 'videoinput' },
    ]);
    expect(result.audio[1]?.deviceId).toBe('mic-2');
    expect(result.audio[1]?.label).toBe('Room Mic (2)');
  });

  it('provides fallback labels before macOS permission reveals labels', () => {
    const result = normalizeMediaDevices([
      device('videoinput', 'camera-1'),
      device('audioinput', 'mic-1'),
    ]);

    expect(result.video[0]?.label).toBe('Camera 1');
    expect(result.audio[0]?.label).toBe('Audio input 1');
  });

  it('normalizes permission denial into a stable service error', async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException('denied', 'NotAllowedError'));

    await expect(
      requestMediaPermissions({ getUserMedia }, { camera: true, microphone: false }),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('subscribes and unsubscribes from device changes', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const mediaDevices = {
      enumerateDevices: vi.fn(),
      getUserMedia: vi.fn(),
      addEventListener,
      removeEventListener,
    };
    const listener = vi.fn();
    const unsubscribe = subscribeToDeviceChanges(mediaDevices, listener);

    expect(addEventListener).toHaveBeenCalledWith('devicechange', listener);
    unsubscribe();
    expect(removeEventListener).toHaveBeenCalledWith('devicechange', listener);
  });

  it('maps capture failures without exposing raw error details', () => {
    expect(
      toCameraServiceError(new DOMException('busy', 'NotReadableError')),
    ).toMatchObject({
      code: 'NOT_READABLE',
      message: 'The selected capture device could not be read.',
    });
  });
});
