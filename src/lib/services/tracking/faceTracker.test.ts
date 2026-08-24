import { describe, expect, it } from 'vitest';

import {
  combineTrackingResults,
  normalizeFaceLandmarks,
  normalizePoseLandmarks,
} from './faceTracker';
import type { LandmarkPoint } from '../../../types/tracking';

const faceCandidate = (visibility = 0.9): LandmarkPoint[] => {
  const landmarks = Array.from({ length: 468 }, (_, index) => ({
    x: 0.35 + (index % 10) * 0.01,
    y: 0.2 + (index % 12) * 0.01,
    visibility,
  }));
  landmarks[33] = { x: 0.44, y: 0.3, visibility };
  landmarks[263] = { x: 0.56, y: 0.31, visibility };
  return landmarks;
};

const poseCandidate = (visibility = 0.9): LandmarkPoint[] => {
  const landmarks = Array.from({ length: 33 }, (_, index) => ({
    x: 0.3 + (index % 5) * 0.05,
    y: 0.25 + (index % 7) * 0.04,
    visibility,
  }));
  landmarks[11] = { x: 0.38, y: 0.48, visibility };
  landmarks[12] = { x: 0.62, y: 0.48, visibility };
  landmarks[23] = { x: 0.43, y: 0.8, visibility };
  landmarks[24] = { x: 0.57, y: 0.8, visibility };
  return landmarks;
};

describe('tracking normalization', () => {
  it('normalizes a face into eye and face measurements', () => {
    const face = normalizeFaceLandmarks([faceCandidate()]);

    expect(face).toMatchObject({
      centerX: expect.closeTo(0.5, 0.04),
      eyeX: 0.5,
      eyeY: 0.305,
      eyesDetected: true,
      confidence: expect.closeTo(0.9, 0.01),
    });
  });

  it('does not discard a face when the model reports zero visibility values', () => {
    const face = normalizeFaceLandmarks([faceCandidate(0)]);

    expect(face?.eyesDetected).toBe(true);
    expect(face?.confidence).toBeGreaterThan(0.8);
  });

  it('falls back to the face bounds when one eye is missing', () => {
    const candidate = faceCandidate();
    candidate.length = 100;

    const face = normalizeFaceLandmarks([candidate]);

    expect(face).not.toBeNull();
    expect(face?.eyesDetected).toBe(false);
    expect(face?.eyeX).toBe(face?.centerX);
    expect(face?.confidence).toBeLessThan(0.9);
  });

  it('clamps out-of-range landmarks and chooses the strongest face', () => {
    const lowConfidence = faceCandidate(0.2);
    const highConfidence = faceCandidate(0.95);
    highConfidence[33] = { x: -0.4, y: 1.4, visibility: 0.95 };

    const face = normalizeFaceLandmarks([lowConfidence, highConfidence]);

    expect(face?.confidence).toBeGreaterThan(0.9);
    expect(face?.landmarks[33]).toMatchObject({ x: 0, y: 1 });
  });

  it('reports missing shoulders and low visibility explicitly', () => {
    const candidate = poseCandidate(0.25);
    candidate.length = 12;

    const pose = normalizePoseLandmarks([candidate]);

    expect(pose?.shoulderCenterX).toBeNull();
    expect(pose?.shoulderWidth).toBeNull();
    expect(pose?.shoulderVisibility).toBe(0);
    expect(pose?.confidence).toBeLessThan(0.4);
  });

  it('combines face and pose into one primary subject state', () => {
    const face = normalizeFaceLandmarks([faceCandidate()]);
    const pose = normalizePoseLandmarks([poseCandidate()]);

    const subject = combineTrackingResults({ face, pose, timestampMs: 1234 });

    expect(subject).toMatchObject({
      detected: true,
      x: face?.centerX,
      eyeY: face?.eyeY,
      shoulderCenterX: 0.5,
      shoulderWidth: 0.24,
      timestampMs: 1234,
    });
  });

  it('returns an explicit no-detection state', () => {
    const subject = combineTrackingResults({ face: null, pose: null, timestampMs: 42 });

    expect(subject).toMatchObject({ detected: false, confidence: 0, timestampMs: 42 });
  });
});
