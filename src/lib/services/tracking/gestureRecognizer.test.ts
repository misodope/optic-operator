import { describe, expect, it } from 'vitest';

import { classifyPinchZoom, isHandInGestureZone } from './gestureRecognizer';

const hand = (thumbIndexDistance: number) => {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  landmarks[0] = { x: 0, y: 0 };
  landmarks[9] = { x: 0, y: 1 };
  landmarks[4] = { x: 0, y: 0.5 };
  landmarks[8] = { x: thumbIndexDistance, y: 0.5 };
  return landmarks;
};

describe('pinch gesture recognition', () => {
  it('recognizes a close thumb and index finger as zoom out', () => {
    expect(classifyPinchZoom(hand(0.4), 0.9).command).toBe('zoom-out');
    expect(classifyPinchZoom(hand(0.4), 0.9).zoomIntent).toBe(-1);
  });

  it('recognizes a spread thumb and index finger as zoom in', () => {
    expect(classifyPinchZoom(hand(1.1), 0.9).command).toBe('zoom-in');
    expect(classifyPinchZoom(hand(1.1), 0.9).zoomIntent).toBe(1);
  });

  it('leaves a neutral hand without a zoom command', () => {
    expect(classifyPinchZoom(hand(0.75), 0.9)).toMatchObject({
      command: 'none',
      zoomIntent: 0,
      confidence: 0.9,
    });
  });

  it('uses hysteresis so an active gesture does not flicker at its boundary', () => {
    expect(classifyPinchZoom(hand(0.6), 0.9, 'zoom-out').command).toBe('zoom-out');
    expect(classifyPinchZoom(hand(0.95), 0.9, 'zoom-in').command).toBe('zoom-in');
  });

  it('ignores low-confidence and tiny hand candidates', () => {
    expect(classifyPinchZoom(hand(0.4), 0.2).command).toBe('none');

    const tinyHand = hand(0.4).map((landmark) => ({
      x: landmark.x * 0.02,
      y: landmark.y * 0.02,
    }));
    expect(classifyPinchZoom(tinyHand, 0.9).command).toBe('none');
  });

  it('keeps a lowered hand outside the gesture zone', () => {
    const loweredHand = hand(0.4).map((landmark) => ({
      x: landmark.x,
      y: landmark.y + 0.86,
    }));
    expect(isHandInGestureZone(loweredHand)).toBe(false);
  });
});
