import type { FramingPreset } from '../../types';

interface VerticalPreviewProps {
  preset: FramingPreset;
}

export function VerticalPreview({ preset }: VerticalPreviewProps) {
  return (
    <section
      className="preview-card preview-card-vertical"
      aria-label="Vertical preview"
    >
      <div className="preview-card-header">
        <div>
          <p className="eyebrow">OUTPUT</p>
          <h2>Vertical frame</h2>
        </div>
        <span className="format-badge">9:16</span>
      </div>
      <div className="vertical-preview-wrap">
        <div className="vertical-preview">
          <div className="vertical-preview-lines" />
          <div className="vertical-preview-message">
            <span className="preview-icon">✦</span>
            <strong>Waiting for a source</strong>
            <span>{preset.label} preset selected</span>
          </div>
        </div>
      </div>
      <p className="preview-caption">Target export: 1080 × 1920 at 30 fps.</p>
    </section>
  );
}
