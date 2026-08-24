import { clamp } from '../utils/clamp';
import type { NormalizedPoint } from './types';

export const applyDeadZone = (
  current: NormalizedPoint,
  target: NormalizedPoint,
  deadZoneX: number,
  deadZoneY: number,
): NormalizedPoint => {
  const deltaX = target.x - current.x;
  const deltaY = target.y - current.y;
  const outsideX = Math.max(0, Math.abs(deltaX) - Math.max(0, deadZoneX));
  const outsideY = Math.max(0, Math.abs(deltaY) - Math.max(0, deadZoneY));

  return {
    x: clamp(current.x + Math.sign(deltaX) * outsideX, 0, 1),
    y: clamp(current.y + Math.sign(deltaY) * outsideY, 0, 1),
  };
};
