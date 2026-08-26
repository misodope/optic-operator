import { describe, expect, it, vi } from 'vitest';

import { CameraController } from '../../camera-controller';
import { FRAMING_PRESETS } from '../../../types/presets';
import { HORIZONTAL_OUTPUT, renderHorizontalCrop } from './horizontalCropRenderer';

const makeCanvas = () => {
  const context = {
    clearRect: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    restore: vi.fn(),
  };
  const canvas = {
    width: 1,
    height: 1,
    getContext: vi.fn().mockReturnValue(context),
  } as unknown as HTMLCanvasElement;

  return { canvas, context };
};

describe('horizontal crop renderer', () => {
  it('renders an exact 1920×1080 destination for a 4K source', () => {
    const controller = new CameraController();
    const state = controller.update({
      subject: null,
      source: { width: 3840, height: 2160 },
      output: HORIZONTAL_OUTPUT,
      preset: FRAMING_PRESETS[0].config,
      nowMs: 0,
    });
    const { canvas, context } = makeCanvas();
    const source = {} as CanvasImageSource;

    const result = renderHorizontalCrop({
      canvas,
      source,
      sourceDimensions: { width: 3840, height: 2160 },
      controllerState: state,
    });

    expect(canvas.width).toBe(1920);
    expect(canvas.height).toBe(1080);
    expect(context.drawImage).toHaveBeenCalledWith(
      source,
      0,
      0,
      3840,
      2160,
      0,
      0,
      1920,
      1080,
    );
    expect(result.qualityScale).toBeCloseTo(2);
    expect(result.qualityState).toBe('good');
  });

  it('marks a 1080p source as good for the horizontal output target', () => {
    const controller = new CameraController();
    const state = controller.update({
      subject: null,
      source: { width: 1920, height: 1080 },
      output: HORIZONTAL_OUTPUT,
      preset: FRAMING_PRESETS[0].config,
      nowMs: 0,
    });
    const { canvas } = makeCanvas();

    const result = renderHorizontalCrop({
      canvas,
      source: {} as CanvasImageSource,
      sourceDimensions: { width: 1920, height: 1080 },
      controllerState: state,
    });

    expect(result.qualityScale).toBeCloseTo(1);
    expect(result.qualityState).toBe('good');
  });
});
