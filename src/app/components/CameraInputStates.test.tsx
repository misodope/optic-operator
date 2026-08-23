import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { CameraPreview } from './CameraPreview';
import { DeviceSelector } from './DeviceSelector';
import { initialCameraState } from '../../store/camera/state';
import { useCameraStore } from '../../store/camera';

const props = {
  deviceLabel: null,
  streamInfo: null,
  error: null,
  videoRef: { current: null },
  onReconnect: () => undefined,
};

describe('camera input UI states', () => {
  beforeEach(() => {
    useCameraStore.setState(initialCameraState);
  });

  it('renders the empty state and setup action', () => {
    const markup = renderToStaticMarkup(
      <DeviceSelector
        onStartSetup={() => undefined}
        onRefresh={() => undefined}
        onCameraChange={() => undefined}
        onAudioChange={() => undefined}
        onReconnect={() => undefined}
      />,
    );

    expect(markup).toContain('No camera devices detected');
    expect(markup).toContain('Find cameras');
  });

  it.each([
    ['permission-required', 'Camera permission required'],
    ['connecting', 'Connecting to camera'],
    ['error', 'No camera connected'],
  ] as const)('renders the %s camera state', (status, expected) => {
    useCameraStore.setState({ status });
    const markup = renderToStaticMarkup(<CameraPreview {...props} status={status} />);

    expect(markup).toContain(expected);
  });

  it('renders ready metadata and error messaging', () => {
    const streamInfo = {
      width: 3840,
      height: 2160,
      frameRate: 30,
      aspectRatio: 16 / 9,
      deviceId: 'capture-card',
      audioDeviceId: 'capture-audio',
    };
    const markup = renderToStaticMarkup(
      <CameraPreview
        {...props}
        status="ready"
        deviceLabel="S9 Capture Card"
        streamInfo={streamInfo}
      />,
    );

    expect(markup).toContain('3840 × 2160');
    expect(markup).toContain('30.0 fps');
    expect(markup).toContain('16:9');

    const errorMarkup = renderToStaticMarkup(
      <CameraPreview
        {...props}
        status="error"
        error={{ code: 'NOT_READABLE', message: 'Capture device is busy.' }}
      />,
    );
    expect(errorMarkup).toContain('Capture device is busy.');
  });
});
