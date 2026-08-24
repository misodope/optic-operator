import { clamp } from '../utils/clamp';
import type { SubjectState } from '../../types/tracking';
import { applyDeadZone } from './deadZone';
import { createInitialControllerState } from './state';
import { smoothPoint, smoothTowards } from './smoothing';
import type {
  CameraControllerInput,
  CameraControllerState,
  NormalizedPoint,
} from './types';
import {
  calculateBaseCropSize,
  calculateCropRect,
  calculateMaxQualityZoom,
  calculateQualityScale,
  calculateTargetZoom,
  qualityStateForScale,
} from './zoom';

const isTrackableSubject = (
  subject: SubjectState | null,
  minimumConfidence: number,
): boolean =>
  Boolean(
    subject?.detected &&
    !subject.lost &&
    subject.confidence >= minimumConfidence &&
    Number.isFinite(subject.x) &&
    Number.isFinite(subject.eyeY),
  );

const subjectTarget = (
  subject: SubjectState,
  preset: CameraControllerInput['preset'],
  cropSize: { width: number; height: number },
  zoom: number,
): NormalizedPoint => {
  const faceX = clamp(subject.x, 0, 1);
  const shoulderVisibility = subject.shoulderVisibility ?? 0;
  const hasReliableShoulders =
    subject.shoulderCenterX !== null &&
    subject.shoulderCenterX !== undefined &&
    shoulderVisibility >= 0.5;
  const centeredX = hasReliableShoulders
    ? faceX * 0.65 + clamp(subject.shoulderCenterX ?? faceX, 0, 1) * 0.35
    : faceX;
  const currentCropHeight = cropSize.height / Math.max(1, zoom);

  return {
    x: clamp(centeredX, 0, 1),
    y: clamp(subject.eyeY + currentCropHeight * (0.5 - preset.targetEyeY), 0, 1),
  };
};

export class CameraController {
  private state: CameraControllerState | null = null;

  private lastDetectedAtMs: number | null = null;

  reset(): void {
    this.state = null;
    this.lastDetectedAtMs = null;
  }

  getState(): CameraControllerState | null {
    return this.state;
  }

  update(input: CameraControllerInput): CameraControllerState {
    const { source, output, preset, subject, nowMs } = input;
    const baseCrop = calculateBaseCropSize(source, output);
    const previous = this.state ?? createInitialControllerState(nowMs);
    const deltaMs = Math.max(0, nowMs - previous.updatedAtMs);
    const validSource = baseCrop.width > 0 && baseCrop.height > 0;
    const trackable =
      validSource && isTrackableSubject(subject, preset.minDetectionConfidence);
    const targetZoomLimit = calculateMaxQualityZoom(
      baseCrop,
      source,
      output,
      preset.minQualityScale,
    );

    let targetCropCenter = {
      x: previous.targetCropCenterX,
      y: previous.targetCropCenterY,
    };
    let targetZoom = previous.targetZoom;
    let trackingStatus: CameraControllerState['trackingStatus'] = 'disabled';
    let lastSubjectTimestampMs = previous.lastSubjectTimestampMs;

    if (trackable && subject) {
      const nextZoom = calculateTargetZoom(subject, preset, baseCrop, targetZoomLimit);
      targetCropCenter = subjectTarget(subject, preset, baseCrop, nextZoom);
      targetCropCenter = applyDeadZone(
        { x: previous.cropCenterX, y: previous.cropCenterY },
        targetCropCenter,
        preset.deadZoneX,
        preset.deadZoneY,
      );
      targetZoom = nextZoom;
      trackingStatus = 'tracking';
      this.lastDetectedAtMs = nowMs;
      lastSubjectTimestampMs = subject.timestampMs;
    } else if (subject?.detected && validSource) {
      trackingStatus = 'low-confidence';
    } else if (validSource && this.lastDetectedAtMs !== null) {
      const timeSinceDetection = nowMs - this.lastDetectedAtMs;
      trackingStatus = 'lost';
      if (timeSinceDetection > preset.lostSubjectHoldMs) {
        targetZoom = 1;
      }
      if (timeSinceDetection > preset.lostSubjectWidenAfterMs) {
        targetCropCenter = { x: previous.cropCenterX, y: previous.cropCenterY };
      }
    }

    const nextCenter = smoothPoint(
      { x: previous.cropCenterX, y: previous.cropCenterY },
      targetCropCenter,
      deltaMs,
      preset.panResponseMs,
      preset.maxPanSpeed,
    );
    const nextZoom = smoothTowards(
      previous.zoom,
      clamp(targetZoom, 1, targetZoomLimit),
      deltaMs,
      preset.zoomResponseMs,
      preset.maxZoomSpeed,
    );
    const crop = calculateCropRect(nextCenter.x, nextCenter.y, nextZoom, baseCrop);
    const qualityScale = calculateQualityScale(crop, source, output);

    this.state = {
      cropCenterX: nextCenter.x,
      cropCenterY: nextCenter.y,
      zoom: nextZoom,
      targetCropCenterX: targetCropCenter.x,
      targetCropCenterY: targetCropCenter.y,
      targetZoom,
      crop,
      qualityScale,
      qualityState: qualityStateForScale(qualityScale),
      trackingStatus,
      lastSubjectTimestampMs,
      updatedAtMs: nowMs,
    };

    return this.state;
  }
}
