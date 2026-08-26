import type { TrackingFeatures } from '../../types/tracking';

type TrackingFeature = keyof TrackingFeatures;

interface TrackingControlsProps {
  features: TrackingFeatures;
  onToggle: (feature: TrackingFeature) => void;
}

const TRACKING_OPTIONS: Array<{
  feature: TrackingFeature;
  label: string;
  description: string;
}> = [
  { feature: 'face', label: 'Face', description: 'Head framing and face box' },
  { feature: 'body', label: 'Body', description: 'Shoulders and torso movement' },
  { feature: 'gestures', label: 'Gestures', description: 'Hand zoom controls' },
];

export function TrackingControls({ features, onToggle }: TrackingControlsProps) {
  return (
    <div className="tracking-options">
      <p className="tracking-options-label">Tracking sources</p>
      <div className="tracking-toggle-grid">
        {TRACKING_OPTIONS.map((option) => {
          const enabled = features[option.feature];
          return (
            <button
              className={`tracking-toggle ${enabled ? 'tracking-toggle-active' : ''}`}
              type="button"
              aria-pressed={enabled}
              title={option.description}
              onClick={() => onToggle(option.feature)}
            >
              <span className="tracking-toggle-dot" />
              <span className="tracking-toggle-copy">
                <span>{option.label}</span>
                <small>{enabled ? 'On' : 'Off'}</small>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
