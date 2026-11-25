// Smoothly moves a set of numbers to new targets (~0.8 s), so the background never jumps.
// Retargeting mid-flight continues from wherever the values are now, with a single frame loop.

export interface Tween<T extends Record<string, number>> {
  to(target: T): void;
  snap(target: T): void;
  current(): T;
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createTween<T extends Record<string, number>>(
  initial: T,
  durationMs: number,
  onFrame: (v: T) => void,
  raf: (cb: (t: number) => void) => number = (cb) => requestAnimationFrame(cb),
  now: () => number = () => performance.now(),
): Tween<T> {
  let from: T = { ...initial };
  let target: T = { ...initial };
  let cur: T = { ...initial };
  let start = 0;
  let running = false;

  const frame = () => {
    const t = Math.min(1, (now() - start) / durationMs);
    const e = easeInOutCubic(t);
    const next = { ...cur };
    for (const k of Object.keys(target) as (keyof T)[]) {
      next[k] = (t >= 1 ? target[k] : from[k] + (target[k] - from[k]) * e) as T[keyof T];
    }
    cur = next;
    onFrame({ ...cur });
    if (t < 1) raf(frame);
    else running = false;
  };

  return {
    to(next) {
      from = { ...cur };
      target = { ...next };
      start = now();
      if (!running) {
        running = true;
        raf(frame);
      }
    },
    snap(next) {
      from = { ...next };
      target = { ...next };
      cur = { ...next };
      start = now() - durationMs; // any frame still queued finishes immediately
      onFrame({ ...cur });
    },
    current: () => ({ ...cur }),
  };
}
