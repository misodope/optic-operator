export const lerp = (start: number, end: number, amount: number): number =>
  start + (end - start) * amount;
