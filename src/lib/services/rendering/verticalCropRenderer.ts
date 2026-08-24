import type { CameraControllerState, Dimensions } from '../../camera-controller/types';
import {
  calculateQualityScale,
  qualityStateForScale,
} from '../../camera-controller/zoom';
import { renderCanvasFrame } from './canvasRenderer';

export const VERTICAL_OUTPUT: Dimensions = {
  width: 1080,
  height: 1920,
};

export interface VerticalCropRenderOptions {
  canvas: HTMLCanvasElement;
  source: CanvasImageSource;
  sourceDimensions: Dimensions;
  controllerState: CameraControllerState;
  output?: Dimensions;
  mirrored?: boolean;
}

export interface VerticalCropRenderResult {
  cropPixels: { x: number; y: number; width: number; height: number };
  qualityScale: number;
  qualityState: ReturnType<typeof qualityStateForScale>;
}

export const renderVerticalCrop = ({
  canvas,
  source,
  sourceDimensions,
  controllerState,
  output = VERTICAL_OUTPUT,
  mirrored = false,
}: VerticalCropRenderOptions): VerticalCropRenderResult => {
  if (canvas.width !== output.width) {
    canvas.width = output.width;
  }
  if (canvas.height !== output.height) {
    canvas.height = output.height;
  }

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The vertical preview could not create a 2D rendering context.');
  }

  renderCanvasFrame({
    context,
    source,
    sourceDimensions,
    sourceRect: controllerState.crop,
    output,
    mirrored,
  });

  const cropPixels = {
    x: controllerState.crop.x * sourceDimensions.width,
    y: controllerState.crop.y * sourceDimensions.height,
    width: controllerState.crop.width * sourceDimensions.width,
    height: controllerState.crop.height * sourceDimensions.height,
  };
  const qualityScale = calculateQualityScale(
    controllerState.crop,
    sourceDimensions,
    output,
  );

  return {
    cropPixels,
    qualityScale,
    qualityState: qualityStateForScale(qualityScale),
  };
};
