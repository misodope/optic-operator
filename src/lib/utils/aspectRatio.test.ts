import { describe, expect, it } from 'vitest';

import {
  calculateAspectRatio,
  formatAspectRatio,
  isLowResolution,
} from './aspectRatio';

describe('aspect ratio helpers', () => {
  it('calculates and formats common source ratios', () => {
    expect(calculateAspectRatio(3840, 2160)).toBe(16 / 9);
    expect(formatAspectRatio(16 / 9)).toBe('16:9');
    expect(formatAspectRatio(9 / 16)).toBe('9:16');
  });

  it('handles invalid dimensions safely', () => {
    expect(calculateAspectRatio(0, 1080)).toBe(0);
    expect(formatAspectRatio(0)).toBe('Unknown');
    expect(isLowResolution(1280, 720)).toBe(true);
    expect(isLowResolution(3840, 2160)).toBe(false);
  });
});
