import { describe, expect, it } from 'vitest';

import { CameraController } from './controller';
import { applyDeadZone } from './deadZone';
import { smoothTowards } from './smoothing';
import { calculateBaseCropSize, calculateCropRect } from './zoom';
import { FRAMING_PRESETS } from '../../types/presets';

const source = { width: 3840, height: 2160 };
const output = { width: 1080, height: 1920 };
const preset = FRAMING_PRESETS[0].config;

const subject = (timestampMs: number, overrides = {}) => ({
  detected: true,
  confidence: 0.95,
  x: 0.5,
  y: 0.42,
  eyeY: 0.32,
  shoulderWidth: 0.3,
  shoulderCenterX: 0.5,
  shoulderVisibility: 0.9,
  timestampMs,
  ...overrides,
});

describe('camera controller', () => {
  it('calculates a 9:16 crop from a 4K 16:9 source', () => {
    const crop = calculateBaseCropSize(source, output);

    expect(crop.width).toBeCloseTo(0.31640625);
    expect(crop.height).toBe(1);
    expect(crop.width * source.width).toBeCloseTo(1215);
    expect(crop.height * source.height).toBe(2160);
  });

  it('clamps the crop rectangle at every source edge', () => {
    const crop = calculateCropRect(0, 1, 1.1, { width: 0.3, height: 0.8 });

    expect(crop.x).toBe(0);
    expect(crop.y + crop.height).toBeCloseTo(1);
    expect(crop.width).toBeCloseTo(0.3 / 1.1);
    expect(crop.height).toBeCloseTo(0.8 / 1.1);
  });

  it('keeps small movement inside the dead zone', () => {
    expect(applyDeadZone({ x: 0.5, y: 0.5 }, { x: 0.52, y: 0.52 }, 0.05, 0.05)).toEqual(
      {
        x: 0.5,
        y: 0.5,
      },
    );
    expect(applyDeadZone({ x: 0.5, y: 0.5 }, { x: 0.62, y: 0.5 }, 0.05, 0.05)).toEqual({
      x: 0.57,
      y: 0.5,
    });
  });

  it('uses time-based smoothing and respects maximum velocity', () => {
    const first = smoothTowards(0, 1, 100, 400, 0.4);
    const second = smoothTowards(first, 1, 900, 400, 0.4);

    expect(first).toBeCloseTo(0.04);
    expect(second - first).toBeLessThanOrEqual(0.36 + Number.EPSILON);
    expect(second).toBeLessThan(1);
  });

  it('centers a source when no subject fixture is available', () => {
    const controller = new CameraController();
    const state = controller.update({
      subject: null,
      source,
      output,
      preset,
      nowMs: 0,
    });

    expect(state.trackingStatus).toBe('disabled');
    expect(state.crop.x).toBeCloseTo((1 - state.crop.width) / 2);
    expect(state.crop.y).toBe(0);
    expect(state.qualityState).toBe('good');
  });

  it('smoothly follows a detected subject without snapping', () => {
    const controller = new CameraController();
    controller.update({ subject: subject(0), source, output, preset, nowMs: 0 });
    const state = controller.update({
      subject: subject(33, { x: 0.8, shoulderCenterX: 0.82 }),
      source,
      output,
      preset,
      nowMs: 33,
    });

    expect(state.trackingStatus).toBe('tracking');
    expect(state.targetCropCenterX).toBeGreaterThan(0.7);
    expect(state.cropCenterX).toBeLessThan(state.targetCropCenterX);
    expect(state.crop.x).toBeGreaterThanOrEqual(0);
    expect(state.crop.x + state.crop.width).toBeLessThanOrEqual(1);
  });

  it('uses the same horizontal response for matching left and right moves', () => {
    const leftController = new CameraController();
    const rightController = new CameraController();

    leftController.update({ subject: subject(0), source, output, preset, nowMs: 0 });
    rightController.update({ subject: subject(0), source, output, preset, nowMs: 0 });

    const left = leftController.update({
      subject: subject(33, { x: 0.25, shoulderCenterX: 0.25 }),
      source,
      output,
      preset,
      nowMs: 33,
    });
    const right = rightController.update({
      subject: subject(33, { x: 0.75, shoulderCenterX: 0.75 }),
      source,
      output,
      preset,
      nowMs: 33,
    });

    expect(0.5 - left.cropCenterX).toBeCloseTo(right.cropCenterX - 0.5);
  });

  it('amplifies directional torso movement in Walk & Talk mode', () => {
    const walkAndTalk = FRAMING_PRESETS.find(
      (candidate) => candidate.id === 'walk-and-talk',
    )?.config;

    expect(walkAndTalk).toBeDefined();

    const controller = new CameraController();
    controller.update({
      subject: subject(0),
      source,
      output,
      preset: walkAndTalk!,
      nowMs: 0,
    });
    const state = controller.update({
      subject: subject(33, { x: 0.5, shoulderCenterX: 0.35 }),
      source,
      output,
      preset: walkAndTalk!,
      nowMs: 33,
    });

    expect(state.targetCropCenterX).toBeLessThan(0.47);
  });

  it('holds the last good state, then widens on tracking loss', () => {
    const controller = new CameraController();
    controller.update({ subject: subject(0), source, output, preset, nowMs: 0 });
    const held = controller.update({
      subject: null,
      source,
      output,
      preset,
      nowMs: preset.lostSubjectHoldMs,
    });
    const widened = controller.update({
      subject: null,
      source,
      output,
      preset,
      nowMs: preset.lostSubjectWidenAfterMs + 100,
    });

    expect(held.trackingStatus).toBe('lost');
    expect(widened.trackingStatus).toBe('lost');
    expect(widened.zoom).toBeLessThanOrEqual(held.zoom);
  });

  it('handles invalid source dimensions without throwing', () => {
    const controller = new CameraController();
    const state = controller.update({
      subject: null,
      source: { width: 0, height: 0 },
      output,
      preset,
      nowMs: 0,
    });

    expect(state.qualityState).toBe('below-target');
    expect(state.crop.width).toBe(0);
  });
});
