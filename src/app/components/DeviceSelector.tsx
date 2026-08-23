import { useCameraStore } from '../../store/camera';

export function DeviceSelector() {
  const status = useCameraStore((state) => state.status);

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
      <select id="camera-device" className="select-control" disabled>
        <option>No camera devices detected</option>
      </select>
      <p className="field-help">
        Device enumeration arrives in Phase 2. The production target is the S9
        micro-HDMI capture-card feed.
      </p>
      <div className="connection-note">
        <span className="connection-dot" />
        {status === 'idle'
          ? 'Waiting for a camera connection'
          : 'Camera setup in progress'}
      </div>
    </section>
  );
}
