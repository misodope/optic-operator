interface CameraPreviewProps {
  deviceLabel: string | null;
  status:
    'idle' | 'permission-required' | 'connecting' | 'ready' | 'disconnected' | 'error';
}

export function CameraPreview({ deviceLabel, status }: CameraPreviewProps) {
  const hasSource = status === 'ready';

  return (
    <section className="preview-card preview-card-source" aria-label="Camera preview">
      <div className="preview-card-header">
        <div>
          <p className="eyebrow">SOURCE</p>
          <h2>Camera feed</h2>
        </div>
        <span className={`status-pill status-${status}`}>
          {status.replace('-', ' ')}
        </span>
      </div>
      <div className="source-preview">
        {hasSource ? (
          <div className="source-placeholder source-placeholder-active">
            <span className="source-grid" />
            <strong>{deviceLabel ?? 'Selected camera'}</strong>
            <span>Live source preview will appear here.</span>
          </div>
        ) : (
          <div className="source-placeholder">
            <div className="camera-glyph" aria-hidden="true">
              ◉
            </div>
            <strong>No camera connected</strong>
            <span>Connect the LUMIX S9 through an HDMI capture card to begin.</span>
          </div>
        )}
      </div>
      <p className="preview-caption">
        The raw source stays separate from the vertical composition so input quality is
        always visible.
      </p>
    </section>
  );
}
