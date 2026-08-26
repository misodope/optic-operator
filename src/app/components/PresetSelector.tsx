import { FRAMING_PRESETS } from '../../types';
import { FRAME_SCALE_MAX, FRAME_SCALE_MIN } from '../../lib/camera-controller/zoom';
import { usePresetsStore } from '../../store/presets';
import type { TrackingFeatures } from '../../types/tracking';
import { TrackingControls } from './TrackingControls';

interface PresetSelectorProps {
  trackingFeatures: TrackingFeatures;
  onToggleTrackingFeature: (feature: keyof TrackingFeatures) => void;
  framingScale: number;
  onFramingScaleChange: (scale: number) => void;
}

export function PresetSelector({
  trackingFeatures,
  onToggleTrackingFeature,
  framingScale,
  onFramingScaleChange,
}: PresetSelectorProps) {
  const selectedPreset = usePresetsStore((state) => state.selectedPreset);
  const selectPreset = usePresetsStore((state) => state.selectPreset);
  const preset =
    FRAMING_PRESETS.find((item) => item.id === selectedPreset) ?? FRAMING_PRESETS[0];

  return (
    <section className="control-card" aria-labelledby="preset-selector-title">
      <div className="control-card-heading">
        <div>
          <p className="eyebrow">FRAMING</p>
          <h2 id="preset-selector-title">Camera behavior</h2>
        </div>
        <span className="control-index">02</span>
      </div>
      <label className="field-label" htmlFor="framing-preset">
        Preset
      </label>
      <select
        id="framing-preset"
        className="select-control"
        value={selectedPreset}
        onChange={(event) => selectPreset(event.target.value as typeof selectedPreset)}
      >
        {FRAMING_PRESETS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <p className="field-help">{preset.description}</p>
      <div className="scale-control">
        <div className="scale-control-heading">
          <label className="scale-control-label" htmlFor="framing-scale">
            Frame scale
          </label>
          <output htmlFor="framing-scale">{framingScale.toFixed(2)}×</output>
        </div>
        <input
          id="framing-scale"
          className="scale-range"
          type="range"
          min={FRAME_SCALE_MIN}
          max={FRAME_SCALE_MAX}
          step="0.01"
          value={framingScale}
          onChange={(event) => onFramingScaleChange(Number(event.target.value))}
          aria-describedby="framing-scale-help"
        />
        <div className="scale-range-labels" aria-hidden="true">
          <span>Wider</span>
          <span>Tighter</span>
        </div>
        <p id="framing-scale-help" className="scale-control-help">
          Fine-tunes the tracked crop. Quality protection still applies.
        </p>
      </div>
      <div className="preset-specs">
        <span>Eyes near upper third</span>
        <span>Smooth motion control</span>
      </div>
      <TrackingControls
        features={trackingFeatures}
        onToggle={onToggleTrackingFeature}
      />
    </section>
  );
}
