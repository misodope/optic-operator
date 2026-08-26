import { clamp } from '../utils/clamp';
import type { FramingPresetConfig } from '../../types/presets';
import type { SubjectState } from '../../types/tracking';
import type { Dimensions, NormalizedRect, QualityState } from './types';

export const FRAME_SCALE_MIN = 0.85;
export const FRAME_SCALE_MAX = 1.15;
export const FRAME_SCALE_DEFAULT = 1;

export const calculateBaseCropSize = (
  source: Dimensions,
  output: Dimensions,
): { width: number; height: number } => {
  if (
    source.width <= 0 ||
    source.height <= 0 ||
    output.width <= 0 ||
    output.height <= 0
  ) {
    return { width: 0, height: 0 };
  }

  const sourceAspect = source.width / source.height;
  const outputAspect = output.width / output.height;

  if (sourceAspect >= outputAspect) {
    return { width: outputAspect / sourceAspect, height: 1 };
  }

  return { width: 1, height: sourceAspect / outputAspect };
};

export const calculateCropRect = (
  centerX: number,
  centerY: number,
  zoom: number,
  baseCrop: { width: number; height: number },
): NormalizedRect => {
  const safeZoom = Math.max(1, zoom);
  const width = baseCrop.width > 0 ? baseCrop.width / safeZoom : 0;
  const height = baseCrop.height > 0 ? baseCrop.height / safeZoom : 0;
  const safeCenterX = clamp(centerX, width / 2, 1 - width / 2);
  const safeCenterY = clamp(centerY, height / 2, 1 - height / 2);

  return {
    x: safeCenterX - width / 2,
    y: safeCenterY - height / 2,
    width,
    height,
  };
};

export const calculateQualityScale = (
  crop: NormalizedRect,
  source: Dimensions,
  output: Dimensions,
): number => {
  if (
    source.width <= 0 ||
    source.height <= 0 ||
    output.width <= 0 ||
    output.height <= 0
  ) {
    return 0;
  }

  return Math.min(
    (crop.width * source.width) / output.width,
    (crop.height * source.height) / output.height,
  );
};

export const qualityStateForScale = (qualityScale: number): QualityState => {
  if (qualityScale >= 1) {
    return 'good';
  }
  if (qualityScale >= 0.85) {
    return 'caution';
  }
  return 'below-target';
};

export const calculateMaxQualityZoom = (
  baseCrop: { width: number; height: number },
  source: Dimensions,
  output: Dimensions,
  minimumQualityScale: number,
): number => {
  const baseQuality = calculateQualityScale(
    { x: 0, y: 0, width: baseCrop.width, height: baseCrop.height },
    source,
    output,
  );

  if (baseQuality <= 0 || minimumQualityScale <= 0) {
    return 1;
  }

  return Math.max(1, baseQuality / minimumQualityScale);
};

export const calculateTargetZoom = (
  subject: SubjectState | null,
  preset: FramingPresetConfig,
  baseCrop: { width: number; height: number },
  maxQualityZoom: number,
  framingScale = FRAME_SCALE_DEFAULT,
): number => {
  if (!subject?.detected || !subject.shoulderWidth || baseCrop.width <= 0) {
    return 1;
  }

  const shoulderVisibility = clamp(preset.preferredShoulderVisibility, 0.25, 1);
  const requestedZoom =
    (subject.shoulderWidth / (baseCrop.width * shoulderVisibility)) *
    clamp(framingScale, FRAME_SCALE_MIN, FRAME_SCALE_MAX);

  return clamp(requestedZoom, 1, maxQualityZoom);
};
