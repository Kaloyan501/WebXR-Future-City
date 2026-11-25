import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_STATE, type CityState } from '../../src/climate/state.ts';
import { applyScenario, type Scenario } from '../../src/climate/scenarios.ts';
import { diseaseRisks, lifespan, type DiseaseDef } from '../../src/climate/health.ts';

const read = <T>(f: string): T => JSON.parse(readFileSync(new URL(`../../content/${f}`, import.meta.url), 'utf8'));
const diseases = read<DiseaseDef[]>('diseases.json');
const scenarios = read<Scenario[]>('climate-scenarios.json');
const at = (id: string, patch: Partial<CityState> = {}): CityState => ({
  ...DEFAULT_STATE,
  ...applyScenario(scenarios.find((s) => s.id === id)!),
  ...patch,
});
const risk = (s: CityState, id: string) => diseaseRisks(s, diseases).find((r) => r.id === id)!;

test('nine diseases from the spec', () => {
  assert.equal(diseases.length, 9);
});

test('temperate city: every risk is low', () => {
  for (const r of diseaseRisks(at('temperate'), diseases)) assert.equal(r.level, 'Нисък', r.id);
});

test('winter smog: breathing high, heart and vitamin D medium', () => {
  assert.equal(risk(at('winter-smog'), 'respiratory').level, 'Висок');
  assert.equal(risk(at('winter-smog'), 'cardio').level, 'Среден');
  assert.equal(risk(at('winter-smog'), 'vitaminD').level, 'Среден');
  assert.equal(risk(at('winter-smog'), 'hypothermia').level, 'Нисък', '−5 °C is not below −5');
});

test('hot summer: heatstroke and skin high', () => {
  assert.equal(risk(at('hot-summer'), 'heatstroke').level, 'Висок');
  assert.equal(risk(at('hot-summer'), 'skin').level, 'Висок');
  assert.equal(risk(at('hot-summer'), 'cardio').level, 'Среден');
});

test('coastal city: food poisoning high, mosquitoes medium', () => {
  assert.equal(risk(at('coastal'), 'foodPoisoning').level, 'Висок');
  assert.equal(risk(at('coastal'), 'mosquito').level, 'Среден');
});

test('menu А raises heart and obesity risk', () => {
  assert.equal(risk(at('temperate', { chosenMenu: 'A' }), 'obesity').level, 'Среден');
  assert.equal(risk(at('temperate', { chosenMenu: 'A' }), 'cardio').level, 'Среден');
  assert.equal(risk(at('temperate', { chosenMenu: 'B' }), 'obesity').level, 'Нисък');
});

test('each risk says why', () => {
  const r = risk(at('winter-smog'), 'respiratory');
  assert.ok(r.why.length > 0);
  assert.ok(risk(at('temperate'), 'respiratory').why.length > 0, 'low risks explain too');
});

test('lifespan: base 78 in the temperate city', () => {
  const l = lifespan(at('temperate'));
  assert.equal(l.years, 78);
  assert.equal(l.base, 78);
});

test('lifespan: hot summer loses 5 years', () => {
  // AQI 120 −1, heat −1.5, UV 10 −0.5, water 20 −2
  assert.equal(lifespan(at('hot-summer')).years, 73);
});

test('lifespan: winter smog loses 3 years to the air', () => {
  assert.equal(lifespan(at('winter-smog')).years, 75);
  assert.equal(lifespan(at('winter-smog', { temp: -10 })).years, 74.5);
});

test('lifespan: the chosen menu adds or takes 2 years', () => {
  assert.equal(lifespan(at('temperate', { chosenMenu: 'B' })).years, 80);
  assert.equal(lifespan(at('temperate', { chosenMenu: 'A' })).years, 76);
});

test('lifespan lists only the factors that apply', () => {
  const f = lifespan(at('hot-summer')).factors;
  assert.deepEqual(f.map((x) => x.delta), [-1, -1.5, -0.5, -2]);
});

test('lifespan stays between 60 and 90', () => {
  const worst = lifespan({ ...DEFAULT_STATE, aqi: 300, temp: 45, uv: 11, water: 0, energy: 0, chosenMenu: 'A' });
  assert.ok(worst.years >= 60 && worst.years <= 90);
});
