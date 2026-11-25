import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_STATE } from '../../src/climate/state.ts';
import { applyScenario, matchesScenario, SLIDER_RANGES, type Scenario } from '../../src/climate/scenarios.ts';

const scenarios: Scenario[] = JSON.parse(
  readFileSync(new URL('../../content/climate-scenarios.json', import.meta.url), 'utf8'),
);
const byId = (id: string) => scenarios.find((s) => s.id === id)!;
const DIRS = ['С', 'СИ', 'И', 'ЮИ', 'Ю', 'ЮЗ', 'З', 'СЗ', null];

test('five unique scenarios', () => {
  assert.equal(scenarios.length, 5);
  assert.equal(new Set(scenarios.map((s) => s.id)).size, 5);
  for (const s of scenarios) {
    assert.ok(s.name.length > 0 && s.description.length > 0, s.id);
  }
});

test('values within slider ranges', () => {
  for (const s of scenarios) {
    for (const [key, value] of Object.entries(s.values)) {
      if (key === 'windDir') {
        assert.ok(DIRS.includes(value as string | null), `${s.id} windDir ${value}`);
        continue;
      }
      const r = SLIDER_RANGES[key as keyof typeof SLIDER_RANGES];
      assert.ok(r, `${s.id}: unknown key ${key}`);
      assert.ok((value as number) >= r.min && (value as number) <= r.max, `${s.id} ${key}=${value}`);
    }
  }
});

test('scenario values match the spec table', () => {
  assert.deepEqual(byId('temperate').values, { temp: 18, humidity: 55, windSpeed: 15, windDir: 'З', aqi: 40, uv: 5, water: 60, land: 50, energy: 60 });
  assert.deepEqual(byId('hot-summer').values, { temp: 41, humidity: 25, windSpeed: 5, windDir: 'Ю', aqi: 120, uv: 10, water: 20, land: 40, energy: 50 });
  assert.deepEqual(byId('winter-smog').values, { temp: -5, humidity: 85, windSpeed: 2, windDir: null, aqi: 240, uv: 1, water: 70, land: 50, energy: 40 });
  assert.deepEqual(byId('megacity').values, { temp: 24, humidity: 60, windSpeed: 10, windDir: 'И', aqi: 110, uv: 6, water: 40, land: 10, energy: 80 });
  assert.deepEqual(byId('coastal').values, { temp: 29, humidity: 90, windSpeed: 45, windDir: 'ЮЗ', aqi: 30, uv: 8, water: 90, land: 60, energy: 40 });
});

test('default scenario equals the default state', () => {
  assert.ok(matchesScenario(DEFAULT_STATE, byId('temperate')));
});

test('apply then matches', () => {
  const hot = byId('hot-summer');
  const s = { ...DEFAULT_STATE, ...applyScenario(hot) };
  assert.equal(s.scenarioId, 'hot-summer');
  assert.ok(matchesScenario(s, hot));
});

test('edit breaks match', () => {
  const hot = byId('hot-summer');
  const s = { ...DEFAULT_STATE, ...applyScenario(hot), temp: 30 };
  assert.equal(matchesScenario(s, hot), false);
});

test('apply keeps population', () => {
  assert.equal('population' in applyScenario(byId('megacity')), false);
});
