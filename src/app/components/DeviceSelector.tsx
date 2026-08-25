import { useCameraStore } from '../../store/camera';

interface DeviceSelectorProps {
  onStartSetup: () => void;
  onRefresh: () => void;
  onCameraChange: (deviceId: string) => void;
  onAudioChange: (deviceId: string) => void;
  onReconnect: () => void;
}

export function DeviceSelector({
  onStartSetup,
  onRefresh,
  onCameraChange,
  onAudioChange,
  onReconnect,
}: DeviceSelectorProps) {
  const {
    status,
    videoDevices,
    audioDevices,
    selectedDeviceId,
    selectedAudioDeviceId,
    permissionState,
    error,
  } = useCameraStore();
  const isBusy = status === 'connecting';
  const cameraPermissionDenied = permissionState.camera === 'denied';

  return (
    <section className="control-card" aria-labelledby="device-selector-title">
      <div className="control-card-heading">
        <div>
          <p className="eyebrow">INPUT</p>
          <h2 id="device-selector-title">Camera & audio</h2>
        </div>
        <span className="control-index">01</span>
      </div>
      <label className="field-label" htmlFor="camera-device">
        Camera source
      </label>
      <select
        id="camera-device"
        className="select-control"
        value={selectedDeviceId ?? ''}
        disabled={isBusy || videoDevices.length === 0}
        onChange={(event) => onCameraChange(event.target.value)}
      >
        {videoDevices.length === 0 ? (
          <option value="">No camera devices detected</option>
        ) : (
          videoDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))
        )}
      </select>
      <label className="field-label" htmlFor="audio-device">
        Audio input <span className="optional-label">(optional)</span>
      </label>
      <select
        id="audio-device"
        className="select-control"
        value={selectedAudioDeviceId ?? ''}
        disabled={isBusy || audioDevices.length === 0}
        onChange={(event) => onAudioChange(event.target.value)}
      >
        {audioDevices.length === 0 ? (
          <option value="">No audio inputs detected</option>
        ) : (
          <option value="">No audio track</option>
        )}
        {audioDevices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>
      <p className="field-help">
        Start setup to grant access. Direct camera feeds and OBS Virtual Camera are
        supported, and the app uses the negotiated source mode.
      </p>
      <div className="device-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={onStartSetup}
          disabled={isBusy}
        >
          {cameraPermissionDenied ? 'Open camera permissions' : 'Find cameras'}
        </button>
        <button
          className="text-button"
          type="button"
          onClick={onRefresh}
          disabled={isBusy}
        >
          Refresh devices
        </button>
        {status === 'disconnected' && (
          <button className="text-button" type="button" onClick={onReconnect}>
            Reconnect
          </button>
        )}
      </div>
      <div className="connection-note">
        <span className="connection-dot" />
        {cameraPermissionDenied
          ? 'Camera permission is denied in macOS System Settings'
          : status === 'idle'
            ? 'Waiting for a camera connection'
            : status === 'connecting'
              ? 'Connecting to selected source'
              : status === 'ready'
                ? 'Camera source ready'
                : 'Camera setup needs attention'}
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error.message}
        </p>
      )}
    </section>
  );
}
