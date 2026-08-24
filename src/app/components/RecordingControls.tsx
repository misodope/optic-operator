import { useRecordingStore } from '../../store/recording';

interface RecordingControlsProps {
  canStart: boolean;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
}

const formatElapsed = (elapsedMs: number): string => {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const statusLabel = (status: string): string => {
  switch (status) {
    case 'preparing':
      return 'Preparing capture';
    case 'recording':
      return 'Recording';
    case 'stopping':
      return 'Saving recording';
    case 'complete':
      return 'Recording saved';
    case 'failed':
      return 'Recording failed';
    default:
      return 'Ready to record';
  }
};

export function RecordingControls({
  canStart,
  onStart,
  onStop,
  onCancel,
}: RecordingControlsProps) {
  const status = useRecordingStore((state) => state.recording.status);
  const elapsedMs = useRecordingStore((state) => state.recording.elapsedMs);
  const outputPath = useRecordingStore((state) => state.recording.outputPath);
  const error = useRecordingStore((state) => state.recording.error);
  const isRecording = status === 'recording';
  const isBusy = status === 'preparing' || status === 'stopping';

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
        <span
          className={`recording-light ${isRecording ? 'recording-light-active' : ''}`}
        />
        <span>
          {isRecording
            ? `${statusLabel(status)} · ${formatElapsed(elapsedMs)}`
            : statusLabel(status)}
        </span>
      </div>
      <button
        className={`record-button ${isRecording ? 'record-button-stop' : ''}`}
        type="button"
        disabled={!canStart || isBusy}
        onClick={isRecording ? onStop : onStart}
      >
        <span className="record-button-icon" />
        {isRecording ? 'Stop recording' : 'Start recording'}
      </button>
      {(isRecording || isBusy) && (
        <button
          className="text-button recording-cancel"
          type="button"
          onClick={onCancel}
        >
          Cancel capture
        </button>
      )}
      {outputPath && <p className="recording-output">Saved: {outputPath}</p>}
      {error ? (
        <p className="error-message" role="alert">
          {error}
        </p>
      ) : (
        <p className="field-help">
          Captures the processed 1080 × 1920 vertical frame with the selected audio
          input. The first capture format is WebM.
        </p>
      )}
    </section>
  );
}
