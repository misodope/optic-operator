const KNOWN_ASPECT_RATIOS: Array<[number, string]> = [
  [16 / 9, '16:9'],
  [4 / 3, '4:3'],
  [3 / 2, '3:2'],
  [9 / 16, '9:16'],
  [1, '1:1'],
];

export const calculateAspectRatio = (width: number, height: number): number => {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return 0;
  }

  return width / height;
};

export const formatAspectRatio = (aspectRatio: number): string => {
  const known = KNOWN_ASPECT_RATIOS.find(
    ([value]) => Math.abs(value - aspectRatio) < 0.02,
  );

  return known?.[1] ?? (aspectRatio > 0 ? `${aspectRatio.toFixed(2)}:1` : 'Unknown');
};

export const isLowResolution = (
  width: number,
  height: number,
  minimumWidth = 1920,
  minimumHeight = 1080,
): boolean => width < minimumWidth || height < minimumHeight;
