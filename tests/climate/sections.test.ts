import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_STATE, type CityState } from '../../src/climate/state.ts';
import { applyScenario, type Scenario } from '../../src/climate/scenarios.ts';
import { produceNeed, weakLinks } from '../../src/climate/numbers.ts';
import { speciesStatus, type SpeciesDef } from '../../src/climate/species.ts';
import { methodRatings, topCombination, type MethodDef } from '../../src/climate/methods.ts';
import { typicalMeal, type FoodsData } from '../../src/climate/foods.ts';

const read = <T>(f: string): T => JSON.parse(readFileSync(new URL(`../../content/${f}`, import.meta.url), 'utf8'));
const scenarios = read<Scenario[]>('climate-scenarios.json');
const species = read<SpeciesDef[]>('species.json');
const methods = read<MethodDef[]>('methods.json');
const foods = read<FoodsData>('foods.json');
const at = (id: string, patch: Partial<CityState> = {}): CityState => ({
  ...DEFAULT_STATE,
  ...applyScenario(scenarios.find((s) => s.id === id)!),
  ...patch,
});

// ---------- Храната в числа ----------

test('produce need: 100 000 residents eat 40 t a day', () => {
  assert.deepEqual(produceNeed(100000), { kgPerDay: 40000, tonnesPerDay: 40, tonnesPerYear: 14600 });
});

test('produce need self-check: 10 000 residents → 4 t', () => {
  assert.equal(produceNeed(10000).tonnesPerDay, 4);
});

test('farm chain: no weak link in the temperate city', () => {
  assert.deepEqual(weakLinks(at('temperate')), []);
});

test('farm chain: hot summer strains resources, the farm and storage', () => {
  assert.deepEqual(weakLinks(at('hot-summer')), ['resources', 'farm', 'storage']);
});

test('farm chain: humid coast strains storage only', () => {
  assert.deepEqual(weakLinks(at('coastal')), ['storage']);
});

// ---------- Биология ----------

const status = (s: CityState, id: string) => speciesStatus(s, species.find((x) => x.id === id)!);

test('fourteen species from the spec', () => {
  assert.equal(species.length, 14);
});

test('temperate city: most species thrive, with reasons for the rest', () => {
  const s = at('temperate');
  assert.equal(status(s, 'wheat').ok, true);
  assert.deepEqual(status(s, 'rice'), { ok: false, reason: 'твърде студено' });
  assert.deepEqual(status(s, 'opuntia'), { ok: false, reason: 'твърде влажно' });
  assert.deepEqual(status(s, 'mosquito'), { ok: false, reason: 'твърде сухо' });
  assert.equal(status(s, 'sparrow').ok, true);
});

test('winter smog: lichens vanish in polluted air', () => {
  assert.deepEqual(status(at('winter-smog'), 'lichen'), { ok: false, reason: 'твърде замърсен въздух' });
  assert.equal(status(at('winter-smog'), 'sparrow').ok, true);
});

test('hot summer: the cactus thrives, the olive is too hot', () => {
  assert.equal(status(at('hot-summer'), 'opuntia').ok, true);
  assert.deepEqual(status(at('hot-summer'), 'olive'), { ok: false, reason: 'твърде горещо' });
});

test('storm stops the bees', () => {
  assert.deepEqual(status(at('coastal'), 'bee'), { ok: false, reason: 'твърде силен вятър' });
});

// ---------- География и производство ----------

const rating = (s: CityState, id: string) => methodRatings(s, methods).find((m) => m.id === id)!;

test('five production methods', () => {
  assert.equal(methods.length, 5);
});

test('temperate city: open fields fit, fermentation does not', () => {
  const s = at('temperate');
  assert.equal(rating(s, 'open-fields').label, 'Подходящо');
  assert.equal(rating(s, 'greenhouse').label, 'С компромис');
  assert.equal(rating(s, 'fermentation').label, 'Неподходящо');
  assert.ok(rating(s, 'fermentation').missing.length === 2);
});

test('megacity: the vertical farm fits', () => {
  assert.equal(rating(at('megacity'), 'vertical').label, 'Подходящо');
});

test('hot summer: greenhouse fits, open fields do not', () => {
  assert.equal(rating(at('hot-summer'), 'greenhouse').label, 'Подходящо');
  assert.equal(rating(at('hot-summer'), 'open-fields').label, 'Неподходящо');
});

test('top combination: three methods, best fit first, then lower resource use', () => {
  assert.deepEqual(topCombination(at('temperate'), methods).map((m) => m.id), ['open-fields', 'vertical', 'greenhouse']);
  assert.deepEqual(topCombination(at('megacity'), methods).map((m) => m.id), ['vertical', 'fermentation', 'greenhouse']);
  assert.deepEqual(topCombination(at('hot-summer'), methods).map((m) => m.id), ['greenhouse', 'fermentation', 'vertical']);
});

// ---------- Храни ----------

test('typical meal follows the rows, the lower row wins', () => {
  assert.match(typicalMeal(at('temperate'), foods).name, /Мусака/);
  assert.match(typicalMeal(at('winter-smog'), foods).name, /Бобена чорба/);
  assert.match(typicalMeal(at('hot-summer'), foods).name, /Таратор/);
  assert.match(typicalMeal(at('coastal'), foods).name, /Риба с ориз/);
  assert.match(typicalMeal(at('megacity'), foods).name, /Бургер/);
});

test('nutrient roles are listed', () => {
  assert.ok(foods.nutrients.length >= 6);
  for (const n of foods.nutrients) assert.ok(n.name && n.role && n.examples, n.name);
});
