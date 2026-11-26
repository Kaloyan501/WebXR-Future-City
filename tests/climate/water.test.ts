import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { coastX, lakeFill } from '../../src/climate/water.ts';

const content = JSON.parse(readFileSync(new URL('../../content/content.json', import.meta.url), 'utf8'));

test('the coastline moves inland as the sea rises (his three sea-level scenarios)', () => {
  const [today, plus50, plus100] = content.scenarios.map((s: { waterLevel: number }) => coastX(s.waterLevel));
  assert.equal(today, 8);
  assert.equal(plus50, 5);
  assert.equal(plus100, 1);
});

test('the coastline stays on the plate for any level', () => {
  assert.equal(coastX(0), 8);
  assert.equal(coastX(2), 1);
});

test('lakes fill with the available water', () => {
  assert.equal(lakeFill(0), 0);
  assert.equal(lakeFill(100), 1);
  assert.ok(lakeFill(70) > lakeFill(20));
  assert.ok(lakeFill(50) > 0.4 && lakeFill(50) < 0.6);
});
