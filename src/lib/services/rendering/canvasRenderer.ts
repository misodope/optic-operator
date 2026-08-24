import type { Dimensions, NormalizedRect } from '../../camera-controller/types';

export interface CanvasRenderOptions {
  context: CanvasRenderingContext2D;
  source: CanvasImageSource;
  sourceDimensions: Dimensions;
  sourceRect: NormalizedRect;
  output: Dimensions;
  mirrored?: boolean;
}

export const normalizedRectToPixels = (
  rect: NormalizedRect,
  source: Dimensions,
): NormalizedRect => ({
  x: rect.x * source.width,
  y: rect.y * source.height,
  width: rect.width * source.width,
  height: rect.height * source.height,
});

export const renderCanvasFrame = ({
  context,
  source,
  sourceDimensions,
  sourceRect,
  output,
  mirrored = false,
}: CanvasRenderOptions): void => {
  const crop = normalizedRectToPixels(sourceRect, sourceDimensions);
  context.clearRect(0, 0, output.width, output.height);
  context.save();

  if (mirrored) {
    context.translate(output.width, 0);
    context.scale(-1, 1);
  }

  context.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    output.width,
    output.height,
  );
  context.restore();
};
