import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cloudEdgeFade, steamRate, sunGlow, windStreaks } from '../../src/climate/scene3d.ts';

test('a higher UV index means a bigger, brighter sun', () => {
  assert.ok(sunGlow(10).scale > sunGlow(2).scale);
  assert.ok(sunGlow(10).opacity > sunGlow(2).opacity);
  assert.ok(sunGlow(11).opacity <= 1);
});

test('steam follows the energy the plants produce', () => {
  assert.equal(steamRate(0), 0);
  assert.equal(steamRate(100), 1);
  assert.ok(steamRate(80) > steamRate(40));
});

test('wind streaks need a direction and some wind', () => {
  assert.equal(windStreaks(60, 0, 0), 0, 'no direction');
  assert.equal(windStreaks(5, 1, 0), 0, 'calm');
  assert.ok(windStreaks(45, 0.71, -0.71) > windStreaks(20, 1, 0));
  assert.ok(windStreaks(100, 1, 0) <= 1);
});

test('clouds fade out before they reach the edge, so the loop is invisible', () => {
  assert.equal(cloudEdgeFade(0, 0), 1);
  assert.equal(cloudEdgeFade(17, 0), 0);
  assert.equal(cloudEdgeFade(0, -17), 0);
  const mid = cloudEdgeFade(15, 3);
  assert.ok(mid > 0 && mid < 1);
});
