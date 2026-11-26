import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STATE } from '../../src/climate/state.ts';
import { visualsFor, windXOf, type VisualInput } from '../../src/climate/visuals.ts';
import { weatherLook } from '../../src/climate/weatherLook.ts';

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
const look = (patch: Partial<VisualInput>) => {
  const v = { ...base, ...patch };
  return weatherLook(visualsFor(v), v);
};

test('stronger UV, brighter sun', () => {
  assert.ok(look({ uv: 10 }).sunIntensity > look({ uv: 2 }).sunIntensity);
});

test('heat warms the sun colour, cold cools it', () => {
  assert.equal(look({ temp: 45 }).sunColor, '#ffd9a8');
  assert.equal(look({ temp: 18 }).sunColor, '#ffffff');
  assert.equal(look({ temp: -15 }).sunColor, '#dfe8ff');
});

test('smog brings the fog closer', () => {
  const clean = look({ aqi: 20 });
  const smog = look({ aqi: 240, windSpeed: 2 });
  assert.ok(smog.haze > clean.haze);
  assert.ok(smog.fogNear < clean.fogNear);
  assert.ok(smog.fogFar < clean.fogFar);
  assert.ok(smog.fogNear < smog.fogFar);
});

test('clear air has no haze', () => {
  const l = look({});
  assert.ok(l.haze < 0.02, `haze ${l.haze}`);
  assert.ok(l.fogNear >= 139);
});

test('hazy weather dims the sun', () => {
  assert.ok(look({ aqi: 240, windSpeed: 2 }).sunIntensity < look({ aqi: 20 }).sunIntensity);
});

test('hemisphere sky follows the sky colour', () => {
  const input = { ...base, temp: 41 };
  const v = visualsFor(input);
  assert.equal(weatherLook(v, input).hemiSky, v.skyTop);
});
