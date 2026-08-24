import { clamp } from '../utils/clamp';

export const smoothTowards = (
  current: number,
  target: number,
  deltaMs: number,
  responseMs: number,
  maxSpeedPerSecond: number,
): number => {
  if (deltaMs <= 0 || current === target) {
    return current;
  }

  const response = Math.max(1, responseMs);
  const alpha = 1 - Math.exp(-deltaMs / response);
  const eased = current + (target - current) * alpha;
  const maxDelta = Math.max(0, maxSpeedPerSecond) * (deltaMs / 1000);

  return clamp(eased, current - maxDelta, current + maxDelta);
};

export const smoothPoint = (
  current: { x: number; y: number },
  target: { x: number; y: number },
  deltaMs: number,
  responseMs: number,
  maxSpeedPerSecond: number,
): { x: number; y: number } => ({
  x: smoothTowards(current.x, target.x, deltaMs, responseMs, maxSpeedPerSecond),
  y: smoothTowards(current.y, target.y, deltaMs, responseMs, maxSpeedPerSecond),
});
