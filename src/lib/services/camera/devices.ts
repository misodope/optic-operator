import type {
  CameraDevice,
  CameraErrorCode,
  PermissionKind,
} from '../../../types/camera';

export interface MediaDevicesAdapter {
  enumerateDevices: () => Promise<MediaDeviceInfo[]>;
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  addEventListener?: MediaDevices['addEventListener'];
  removeEventListener?: MediaDevices['removeEventListener'];
}

export interface EnumeratedDevices {
  video: CameraDevice[];
  audio: CameraDevice[];
}

export class CameraServiceError extends Error {
  readonly code: CameraErrorCode;

  constructor(code: CameraErrorCode, message: string) {
    super(message);
    this.name = 'CameraServiceError';
    this.code = code;
  }
}

const getDefaultMediaDevices = (): MediaDevicesAdapter => {
  if (!globalThis.navigator?.mediaDevices) {
    throw new CameraServiceError(
      'CAPTURE_ERROR',
      'This environment does not expose camera and microphone devices.',
    );
  }

  return globalThis.navigator.mediaDevices;
};

const displayLabel = (device: MediaDeviceInfo, index: number): string => {
  if (device.label.trim()) {
    return device.label.trim();
  }

  const typeLabel = device.kind === 'videoinput' ? 'Camera' : 'Audio input';
  return `${typeLabel} ${index + 1}`;
};

const withUniqueLabels = (devices: CameraDevice[]): CameraDevice[] => {
  const seen = new Map<string, number>();

  return devices.map((device) => {
    const count = (seen.get(device.label) ?? 0) + 1;
    seen.set(device.label, count);

    return {
      ...device,
      label: count === 1 ? device.label : `${device.label} (${count})`,
    };
  });
};

export const normalizeMediaDevices = (
  devices: MediaDeviceInfo[],
): EnumeratedDevices => {
  const video = devices
    .filter((device) => device.kind === 'videoinput')
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: displayLabel(device, index),
      kind: 'videoinput' as const,
    }));
  const audio = devices
    .filter((device) => device.kind === 'audioinput')
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: displayLabel(device, index),
      kind: 'audioinput' as const,
    }));

  return {
    video: withUniqueLabels(video),
    audio: withUniqueLabels(audio),
  };
};

export const enumerateDevices = async (
  mediaDevices: MediaDevicesAdapter = getDefaultMediaDevices(),
): Promise<EnumeratedDevices> => {
  try {
    return normalizeMediaDevices(await mediaDevices.enumerateDevices());
  } catch {
    throw new CameraServiceError(
      'CAPTURE_ERROR',
      'The available camera and microphone devices could not be read.',
    );
  }
};

export const requestMediaPermissions = async (
  mediaDevices: Pick<MediaDevicesAdapter, 'getUserMedia'> = getDefaultMediaDevices(),
  options: { camera?: boolean; microphone?: boolean } = {
    camera: true,
    microphone: true,
  },
): Promise<void> => {
  const stream = await mediaDevices
    .getUserMedia({
      video: options.camera ?? true,
      audio: options.microphone ?? true,
    })
    .catch((error: unknown) => {
      throw toCameraServiceError(error);
    });

  stream.getTracks().forEach((track) => track.stop());
};

export const subscribeToDeviceChanges = (
  mediaDevices: MediaDevicesAdapter,
  listener: () => void,
): (() => void) => {
  mediaDevices.addEventListener?.('devicechange', listener);

  return () => mediaDevices.removeEventListener?.('devicechange', listener);
};

export const toCameraServiceError = (error: unknown): CameraServiceError => {
  if (error instanceof CameraServiceError) {
    return error;
  }

  const name = error instanceof DOMException ? error.name : '';
  const message =
    error instanceof Error ? error.message : 'The camera operation failed.';

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new CameraServiceError(
        'PERMISSION_DENIED',
        'Camera or microphone permission was denied.',
      );
    case 'NotFoundError':
      return new CameraServiceError(
        'NO_DEVICE',
        'The selected camera or microphone is no longer available.',
      );
    case 'OverconstrainedError':
      return new CameraServiceError('CONSTRAINTS_UNSATISFIED', message);
    case 'NotReadableError':
    case 'AbortError':
      return new CameraServiceError(
        'NOT_READABLE',
        'The selected capture device could not be read.',
      );
    default:
      return new CameraServiceError('CAPTURE_ERROR', message);
  }
};

export const permissionKindForDevice = (kind: CameraDevice['kind']): PermissionKind =>
  kind === 'videoinput' ? 'camera' : 'microphone';
