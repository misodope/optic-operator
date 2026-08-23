export type FramingPresetId = 'talking-head' | 'walk-and-talk' | 'locked';

export interface FramingPreset {
  id: FramingPresetId;
  label: string;
  description: string;
}

export const FRAMING_PRESETS: FramingPreset[] = [
  {
    id: 'talking-head',
    label: 'Talking Head',
    description: 'Stable face-and-shoulders framing for direct-to-camera videos.',
  },
  {
    id: 'walk-and-talk',
    label: 'Walk & Talk',
    description: 'More responsive framing with wider safety margins for movement.',
  },
  {
    id: 'locked',
    label: 'Locked',
    description: 'Minimal correction for a mostly static creator shot.',
  },
];
