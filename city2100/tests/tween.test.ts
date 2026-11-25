import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTween } from '../core/tween.ts';

/** A fake clock + requestAnimationFrame so tween timing is deterministic. */
function fakeFrames() {
  let time = 0;
  let queue: ((t: number) => void)[] = [];
  return {
    now: () => time,
    raf: (cb: (t: number) => void) => {
      queue.push(cb);
      return queue.length;
    },
    pending: () => queue.length,
    step(ms: number) {
      time += ms;
      const run = queue;
      queue = [];
      for (const cb of run) cb(time);
    },
  };
}

test('reaches target', () => {
  const f = fakeFrames();
  let last = { x: 0 };
  const tw = createTween({ x: 0 }, 800, (v) => (last = v), f.raf, f.now);
  tw.to({ x: 10 });
  for (let i = 0; i < 60; i++) f.step(16);
  assert.equal(last.x, 10);
  assert.equal(tw.current().x, 10);
  assert.equal(f.pending(), 0, 'loop stops once the target is reached');
});

test('retarget keeps one loop', () => {
  const f = fakeFrames();
  const tw = createTween({ x: 0 }, 800, () => {}, f.raf, f.now);
  for (let i = 1; i <= 5; i++) tw.to({ x: i * 10 });
  assert.ok(f.pending() <= 1, `pending frames: ${f.pending()}`);
  f.step(16);
  tw.to({ x: 99 });
  assert.ok(f.pending() <= 1, `pending frames after retarget: ${f.pending()}`);
});

test('retarget from current', () => {
  const f = fakeFrames();
  const values: number[] = [];
  const tw = createTween({ x: 0 }, 800, (v) => values.push(v.x), f.raf, f.now);
  tw.to({ x: 100 });
  for (let i = 0; i < 25; i++) f.step(16); // ~400 ms, halfway
  const before = tw.current().x;
  assert.ok(before > 20 && before < 80, `halfway value ${before}`);
  tw.to({ x: -100 });
  f.step(16);
  const after = tw.current().x;
  assert.ok(Math.abs(after - before) < 2, `jumped from ${before} to ${after}`);
});

test('snap is instant', () => {
  const f = fakeFrames();
  let last = { x: 0 };
  const tw = createTween({ x: 0 }, 800, (v) => (last = v), f.raf, f.now);
  tw.snap({ x: 42 });
  assert.equal(last.x, 42);
  assert.equal(tw.current().x, 42);
  assert.equal(f.pending(), 0);
});
