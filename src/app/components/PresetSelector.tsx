import { FRAMING_PRESETS } from '../../types';
import { usePresetsStore } from '../../store/presets';

export function PresetSelector() {
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
      <div className="preset-specs">
        <span>Eyes near upper third</span>
        <span>Smooth motion control</span>
      </div>
    </section>
  );
}
