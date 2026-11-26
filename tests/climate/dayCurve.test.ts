import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayCurve } from '../../src/climate/dayCurve.ts';

const span = (pts: { temp: number }[]) => Math.max(...pts.map((p) => p.temp)) - Math.min(...pts.map((p) => p.temp));

test('25 points', () => {
  const pts = dayCurve(18, 'Нормално');
  assert.equal(pts.length, 25);
  assert.deepEqual(pts.map((p) => p.hour), Array.from({ length: 25 }, (_, h) => h));
});

test('peak at 15h', () => {
  const pts = dayCurve(18, 'Нормално');
  const max = pts.reduce((a, b) => (b.temp > a.temp ? b : a));
  assert.equal(max.hour, 15);
  assert.ok(Math.abs(max.temp - 24) < 1e-9);
});

test('amplitude by humidity', () => {
  assert.ok(Math.abs(span(dayCurve(18, 'Сухо')) - 16) < 1e-9);
  assert.ok(Math.abs(span(dayCurve(18, 'Нормално')) - 12) < 1e-9);
  assert.ok(Math.abs(span(dayCurve(18, 'Влажно')) - 8) < 1e-9);
});

test('mean is set temp', () => {
  const pts = dayCurve(-5, 'Влажно').slice(0, 24);
  const mean = pts.reduce((a, p) => a + p.temp, 0) / pts.length;
  assert.ok(Math.abs(mean - -5) < 0.01, `mean ${mean}`);
});
