import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { CameraPreview } from './CameraPreview';
import { DeviceSelector } from './DeviceSelector';
import { VerticalPreview } from './VerticalPreview';
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
        deviceLabel="Test Capture Camera"
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

  it('renders the vertical source placeholder until a stream is ready', () => {
    const markup = renderToStaticMarkup(
      <VerticalPreview
        preset={{
          id: 'talking-head',
          label: 'Talking Head',
          description: 'Stable framing.',
          config: {
            deadZoneX: 0.03,
            deadZoneY: 0.03,
            targetEyeY: 0.32,
            preferredShoulderVisibility: 0.7,
            bodyFollowGain: 1,
            leftPanGain: 1,
            leftPanSpeedMultiplier: 1,
            maxPanSpeed: 0.4,
            maxZoomSpeed: 0.2,
            panResponseMs: 400,
            zoomResponseMs: 800,
            minQualityScale: 1,
            minDetectionConfidence: 0.4,
            lostSubjectHoldMs: 500,
            lostSubjectWidenAfterMs: 1000,
          },
        }}
        sourceStatus="idle"
        streamInfo={null}
        videoRef={{ current: null }}
      />,
    );

    expect(markup).toContain('Waiting for a source');
    expect(markup).toContain('9:16');
  });
});
