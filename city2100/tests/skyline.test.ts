import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSkyline, SCENE_W } from '../ui/skyline.ts';

test('same seed, same skyline', () => {
  assert.deepEqual(generateSkyline(2100), generateSkyline(2100));
});

test('near and far rows span the whole width', () => {
  const b = generateSkyline(2100);
  for (const layer of ['near', 'far'] as const) {
    const row = b.filter((x) => x.layer === layer);
    assert.ok(row.length > 8, `${layer} has ${row.length} buildings`);
    assert.ok(Math.min(...row.map((x) => x.x)) <= 20, `${layer} starts late`);
    assert.ok(Math.max(...row.map((x) => x.x + x.w)) >= SCENE_W - 20, `${layer} ends early`);
  }
});

test('windows only on near buildings, buckets 0..9', () => {
  const b = generateSkyline(2100);
  assert.ok(b.filter((x) => x.layer === 'far').every((x) => x.windows.length === 0));
  const wins = b.filter((x) => x.layer === 'near').flatMap((x) => x.windows);
  assert.ok(wins.length > 200);
  assert.ok(wins.every((w) => Number.isInteger(w.bucket) && w.bucket >= 0 && w.bucket <= 9));
});

test('some roofs get solar panels and some get farms', () => {
  const near = generateSkyline(2100).filter((x) => x.layer === 'near');
  assert.ok(near.some((x) => x.solar) && near.some((x) => !x.solar));
  assert.ok(near.some((x) => x.farm) && near.some((x) => !x.farm));
});
