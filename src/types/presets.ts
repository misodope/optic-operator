export type FramingPresetId = 'talking-head' | 'walk-and-talk' | 'locked';

export interface FramingPresetConfig {
  deadZoneX: number;
  deadZoneY: number;
  targetEyeY: number;
  preferredShoulderVisibility: number;
  maxPanSpeed: number;
  maxZoomSpeed: number;
  panResponseMs: number;
  zoomResponseMs: number;
  minQualityScale: number;
  minDetectionConfidence: number;
  lostSubjectHoldMs: number;
  lostSubjectWidenAfterMs: number;
}

export interface FramingPreset {
  id: FramingPresetId;
  label: string;
  description: string;
  config: FramingPresetConfig;
}

export const FRAMING_PRESETS: FramingPreset[] = [
  {
    id: 'talking-head',
    label: 'Talking Head',
    description: 'Stable face-and-shoulders framing for direct-to-camera videos.',
    config: {
      deadZoneX: 0.035,
      deadZoneY: 0.03,
      targetEyeY: 0.32,
      preferredShoulderVisibility: 0.72,
      maxPanSpeed: 0.45,
      maxZoomSpeed: 0.18,
      panResponseMs: 420,
      zoomResponseMs: 900,
      minQualityScale: 1,
      minDetectionConfidence: 0.45,
      lostSubjectHoldMs: 500,
      lostSubjectWidenAfterMs: 1200,
    },
  },
  {
    id: 'walk-and-talk',
    label: 'Walk & Talk',
    description: 'More responsive framing with wider safety margins for movement.',
    config: {
      deadZoneX: 0.06,
      deadZoneY: 0.05,
      targetEyeY: 0.34,
      preferredShoulderVisibility: 0.62,
      maxPanSpeed: 0.85,
      maxZoomSpeed: 0.25,
      panResponseMs: 300,
      zoomResponseMs: 650,
      minQualityScale: 1,
      minDetectionConfidence: 0.4,
      lostSubjectHoldMs: 300,
      lostSubjectWidenAfterMs: 900,
    },
  },
  {
    id: 'locked',
    label: 'Locked',
    description: 'Minimal correction for a mostly static creator shot.',
    config: {
      deadZoneX: 0.1,
      deadZoneY: 0.08,
      targetEyeY: 0.32,
      preferredShoulderVisibility: 0.75,
      maxPanSpeed: 0.18,
      maxZoomSpeed: 0.08,
      panResponseMs: 1200,
      zoomResponseMs: 1500,
      minQualityScale: 1,
      minDetectionConfidence: 0.5,
      lostSubjectHoldMs: 900,
      lostSubjectWidenAfterMs: 1800,
    },
  },
];
