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
  assert.deepEqual(byId('temperate').values, { temp: 18, humidity: 55, windSpeed: 15, windDir: 'З', aqi: 40, uv: 5, water: 60, population: 100000, energy: 60 });
  assert.deepEqual(byId('hot-summer').values, { temp: 41, humidity: 25, windSpeed: 5, windDir: 'Ю', aqi: 120, uv: 10, water: 20, population: 170000, energy: 50 });
  assert.deepEqual(byId('winter-smog').values, { temp: -5, humidity: 85, windSpeed: 2, windDir: null, aqi: 240, uv: 1, water: 70, population: 100000, energy: 40 });
  assert.deepEqual(byId('megacity').values, { temp: 24, humidity: 60, windSpeed: 10, windDir: 'И', aqi: 110, uv: 6, water: 40, population: 800000, energy: 80 });
  assert.deepEqual(byId('coastal').values, { temp: 29, humidity: 90, windSpeed: 45, windDir: 'ЮЗ', aqi: 30, uv: 8, water: 90, population: 60000, energy: 40 });
});

test('free land in the scenarios stays close to the spec table', () => {
  const land = (id: string) => applyScenario(byId(id)).land;
  assert.equal(land('temperate'), 50);
  assert.equal(land('hot-summer'), 40);
  assert.equal(land('winter-smog'), 50);
  assert.ok(land('megacity')! < 30);
  assert.equal(land('coastal'), 60);
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

test('apply sets the population and the free land that follows from it', () => {
  const p = applyScenario(byId('megacity'));
  assert.equal(p.population, 800000);
  assert.equal(p.land, 9);
});

test('every scenario respects the humidity cap', async () => {
  const { maxHumidity } = await import('../../src/climate/state.ts');
  for (const sc of scenarios) assert.ok(sc.values.humidity <= maxHumidity(sc.values.temp), sc.id);
});

test('presentation steps through the scenarios and wraps around', async () => {
  const { nextScenarioId } = await import('../../src/climate/scenarios.ts');
  const ids = scenarios.map((s) => s.id);
  assert.equal(nextScenarioId(ids, 'temperate'), 'hot-summer');
  assert.equal(nextScenarioId(ids, 'coastal'), 'temperate');
  assert.equal(nextScenarioId(ids, 'unknown'), 'temperate');
});
