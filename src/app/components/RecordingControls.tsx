import { useRecordingStore } from '../../store/recording';

export function RecordingControls() {
  const status = useRecordingStore((state) => state.recording.status);

  return (
    <section
      className="control-card control-card-recording"
      aria-labelledby="recording-controls-title"
    >
      <div className="control-card-heading">
        <div>
          <p className="eyebrow">CAPTURE</p>
          <h2 id="recording-controls-title">Recording</h2>
        </div>
        <span className="control-index">03</span>
      </div>
      <div className="recording-state">
        <span className="recording-light" />
        <span>
          {status === 'idle' ? 'Ready when your source is connected' : status}
        </span>
      </div>
      <button className="record-button" type="button" disabled>
        <span className="record-button-icon" />
        Start recording
      </button>
      <p className="field-help">
        Phase 1 is focused on the shell. Recording becomes available after camera
        validation and the vertical renderer are connected.
      </p>
    </section>
  );
}
