import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STATE } from '../../src/climate/state.ts';
import { visualsFor, windXOf, type VisualInput } from '../../src/climate/visuals.ts';

const base: VisualInput = {
  temp: DEFAULT_STATE.temp,
  humidity: DEFAULT_STATE.humidity,
  windSpeed: DEFAULT_STATE.windSpeed,
  windX: windXOf(DEFAULT_STATE.windDir),
  aqi: DEFAULT_STATE.aqi,
  uv: DEFAULT_STATE.uv,
  water: DEFAULT_STATE.water,
  land: DEFAULT_STATE.land,
  energy: DEFAULT_STATE.energy,
};
const v = (patch: Partial<VisualInput>) => visualsFor({ ...base, ...patch });

test('snow on roofs below zero', () => {
  assert.ok(v({ temp: -10 }).snowRoofs > 0.9);
  assert.equal(v({ temp: 18 }).snowRoofs, 0);
});

test('shimmer only in heat', () => {
  assert.ok(v({ temp: 41 }).shimmer > 0);
  assert.equal(v({ temp: 30 }).shimmer, 0);
});

test('rain vs snowfall', () => {
  const rain = v({ humidity: 90, temp: 10 });
  assert.ok(rain.rain > 0);
  assert.equal(rain.snowfall, 0);
  const snow = v({ humidity: 85, temp: -5 });
  assert.ok(snow.snowfall > 0);
  assert.equal(snow.rain, 0);
  const dry = v({ humidity: 60, temp: 10 });
  assert.equal(dry.rain, 0);
  assert.equal(dry.snowfall, 0);
});

test('fog above 70', () => {
  assert.ok(v({ humidity: 80 }).fog > 0);
  assert.equal(v({ humidity: 50 }).fog, 0);
});

test('wind thins smog', () => {
  assert.ok(v({ aqi: 240, windSpeed: 2 }).smog > v({ aqi: 240, windSpeed: 60 }).smog);
  assert.equal(v({ aqi: 20 }).smog, 0);
});

test('smog turns the sky grey-brown', () => {
  assert.notEqual(v({ aqi: 240 }).skyTop, v({ aqi: 20 }).skyTop);
});

test('temperature colours the sky', () => {
  const cold = v({ temp: -15 }).skyBottom;
  const hot = v({ temp: 45 }).skyBottom;
  assert.equal(cold, '#d3dbe6');
  assert.equal(hot, '#f4c58a');
});

test('uv sizes sun', () => {
  assert.ok(v({ uv: 10 }).sunRadius > v({ uv: 2 }).sunRadius);
  assert.ok(v({ uv: 10 }).shadowOpacity > v({ uv: 2 }).shadowOpacity);
});

test('water sets river', () => {
  assert.ok(v({ water: 20 }).riverHeight < v({ water: 90 }).riverHeight);
  assert.notEqual(v({ water: 5 }).riverColor, v({ water: 95 }).riverColor);
});

test('low land rooftop farms', () => {
  const lv = v({ land: 10 });
  assert.equal(lv.rooftopFarms, 1);
  assert.equal(lv.fieldFraction, 0.1);
  assert.equal(v({ land: 60 }).rooftopFarms, 0);
});

test('energy tiers', () => {
  assert.deepEqual([v({ energy: 20 }).solar, v({ energy: 20 }).turbines], [0, 0]);
  assert.deepEqual([v({ energy: 50 }).solar, v({ energy: 50 }).turbines], [1, 0]);
  assert.deepEqual([v({ energy: 90 }).solar, v({ energy: 90 }).turbines], [1, 1]);
  assert.ok(v({ energy: 90 }).litWindows > v({ energy: 20 }).litWindows);
});

test('wind direction', () => {
  assert.equal(windXOf('З'), 1);
  assert.equal(windXOf('И'), -1);
  assert.equal(windXOf('С'), 0);
  assert.ok(v({ windX: 1, windSpeed: 30 }).cloudVx > 0);
  assert.ok(v({ windX: -1, windSpeed: 30 }).cloudVx < 0);
});

test('calm wind', () => {
  assert.equal(windXOf(null), 0);
  const calm = v({ windX: windXOf(null), windSpeed: 2 });
  assert.equal(calm.cloudVx, 0);
  assert.equal(calm.treeBendDeg, 0);
});

test('stronger wind bends trees more', () => {
  assert.ok(Math.abs(v({ windX: 1, windSpeed: 60 }).treeBendDeg) > Math.abs(v({ windX: 1, windSpeed: 10 }).treeBendDeg));
});

test('dry desaturates', () => {
  assert.ok(v({ humidity: 20 }).saturation < 1);
  assert.equal(v({ humidity: 55 }).saturation, 1);
});

const saturationOf = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const max = Math.max(...c);
  return max === 0 ? 0 : (max - Math.min(...c)) / max;
};

test('rain greys the sky and darkens clouds', () => {
  const dry = v({ temp: 29, humidity: 55 });
  const storm = v({ temp: 29, humidity: 90 });
  assert.ok(saturationOf(storm.skyTop) < saturationOf(dry.skyTop) * 0.8, `${dry.skyTop} vs ${storm.skyTop}`);
  assert.equal(dry.cloudColor, '#ffffff');
  assert.notEqual(storm.cloudColor, '#ffffff');
  assert.ok(storm.sunGlow < dry.sunGlow);
});

test('wind blows away from the compass direction it comes from (east = +x, north = −z)', async () => {
  const { windVecOf } = await import('../../src/climate/visuals.ts');
  const r = (v: { x: number; z: number }) => ({ x: Math.round(v.x * 100) / 100 + 0, z: Math.round(v.z * 100) / 100 + 0 });
  assert.deepEqual(r(windVecOf('З')), { x: 1, z: 0 });
  assert.deepEqual(r(windVecOf('И')), { x: -1, z: 0 });
  assert.deepEqual(r(windVecOf('С')), { x: 0, z: 1 });
  assert.deepEqual(r(windVecOf('Ю')), { x: 0, z: -1 });
  assert.deepEqual(r(windVecOf('СЗ')), { x: 0.71, z: 0.71 });
  assert.deepEqual(r(windVecOf('ЮИ')), { x: -0.71, z: -0.71 });
  assert.deepEqual(r(windVecOf(null)), { x: 0, z: 0 });
  assert.equal(windVecOf('ЮЗ').x, windXOf('ЮЗ'), 'x matches the old horizontal component');
});
