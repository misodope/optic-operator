import { describe, expect, it, vi } from 'vitest';

import { CameraController } from '../../camera-controller';
import { FRAMING_PRESETS } from '../../../types/presets';
import { renderVerticalCrop, VERTICAL_OUTPUT } from './verticalCropRenderer';

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

describe('vertical crop renderer', () => {
  it('renders an exact 1080×1920 destination and preserves crop calculations', () => {
    const controller = new CameraController();
    const state = controller.update({
      subject: null,
      source: { width: 3840, height: 2160 },
      output: VERTICAL_OUTPUT,
      preset: FRAMING_PRESETS[0].config,
      nowMs: 0,
    });
    const { canvas, context } = makeCanvas();
    const source = {} as CanvasImageSource;

    const result = renderVerticalCrop({
      canvas,
      source,
      sourceDimensions: { width: 3840, height: 2160 },
      controllerState: state,
    });

    expect(canvas.width).toBe(1080);
    expect(canvas.height).toBe(1920);
    expect(context.drawImage).toHaveBeenCalledWith(
      source,
      expect.closeTo(1312.5),
      0,
      expect.closeTo(1215),
      2160,
      0,
      0,
      1080,
      1920,
    );
    expect(result.qualityScale).toBeCloseTo(1.125);
    expect(result.qualityState).toBe('good');
  });

  it('marks a 1080p horizontal source below the vertical output target', () => {
    const controller = new CameraController();
    const state = controller.update({
      subject: null,
      source: { width: 1920, height: 1080 },
      output: VERTICAL_OUTPUT,
      preset: FRAMING_PRESETS[0].config,
      nowMs: 0,
    });
    const { canvas } = makeCanvas();

    const result = renderVerticalCrop({
      canvas,
      source: {} as CanvasImageSource,
      sourceDimensions: { width: 1920, height: 1080 },
      controllerState: state,
    });

    expect(result.qualityScale).toBeCloseTo(0.5625);
    expect(result.qualityState).toBe('below-target');
  });

  it('supports mirrored rendering without changing crop geometry', () => {
    const controller = new CameraController();
    const state = controller.update({
      subject: null,
      source: { width: 3840, height: 2160 },
      output: VERTICAL_OUTPUT,
      preset: FRAMING_PRESETS[0].config,
      nowMs: 0,
    });
    const { canvas, context } = makeCanvas();

    renderVerticalCrop({
      canvas,
      source: {} as CanvasImageSource,
      sourceDimensions: { width: 3840, height: 2160 },
      controllerState: state,
      mirrored: true,
    });

    expect(context.translate).toHaveBeenCalledWith(1080, 0);
    expect(context.scale).toHaveBeenCalledWith(-1, 1);
  });
});
