import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_STATE, type CityState } from '../../src/climate/state.ts';
import { applyScenario, type Scenario } from '../../src/climate/scenarios.ts';
import { climateBand, dailyMenu, dishTotals, voteResult, SLOTS, type MealsData } from '../../src/climate/menu.ts';

const read = <T>(f: string): T => JSON.parse(readFileSync(new URL(`../../content/${f}`, import.meta.url), 'utf8'));
const meals = read<MealsData>('meals.json');
const scenarios = read<Scenario[]>('climate-scenarios.json');
const at = (id: string): CityState => ({ ...DEFAULT_STATE, ...applyScenario(scenarios.find((s) => s.id === id)!) });

test('climate band follows the temperature level', () => {
  assert.equal(climateBand('Студено'), 'cold');
  assert.equal(climateBand('Умерено'), 'temperate');
  assert.equal(climateBand('Топло'), 'warm');
  assert.equal(climateBand('Жега'), 'warm');
});

test('every menu cell and correction points at a real dish', () => {
  for (const band of ['cold', 'temperate', 'warm'] as const) {
    for (const menu of ['A', 'B'] as const) {
      for (const slot of SLOTS) assert.ok(meals.dishes[meals.menus[band][menu][slot]], `${band} ${menu} ${slot}`);
    }
  }
  for (const c of meals.corrections) if (c.dish) assert.ok(meals.dishes[c.dish], c.id);
  for (const [id, d] of Object.entries(meals.dishes)) {
    assert.ok(d.ingredients.length > 0 && d.drink && Array.isArray(d.pros) && Array.isArray(d.cons), id);
  }
});

test('temperate city: base menu, no corrections', () => {
  const m = dailyMenu(at('temperate'), meals);
  assert.equal(m.band, 'temperate');
  assert.equal(m.B.lunch, meals.menus.temperate.B.lunch);
  assert.deepEqual(m.changed, []);
  assert.deepEqual(m.notes, []);
});

test('winter smog: vitamin D breakfast and antioxidant snack in menu Б', () => {
  const m = dailyMenu(at('winter-smog'), meals);
  assert.equal(m.band, 'cold');
  assert.equal(m.B.breakfast, meals.corrections.find((c) => c.id === 'lowUv')!.dish);
  assert.equal(m.B.snack, meals.corrections.find((c) => c.id === 'badAir')!.dish);
  assert.deepEqual(m.A, meals.menus.cold.A, 'menu А never changes');
  assert.deepEqual(m.changed, ['breakfast', 'snack']);
  assert.equal(m.notes.length, 2);
});

test('hot summer: water-rich snack and a low-water dinner', () => {
  const m = dailyMenu(at('hot-summer'), meals);
  assert.equal(m.band, 'warm');
  assert.equal(m.B.snack, meals.corrections.find((c) => c.id === 'highUvHeat')!.dish);
  assert.equal(m.B.dinner, meals.corrections.find((c) => c.id === 'lowWater')!.dish);
});

test('coastal city: storage warning is flagged', () => {
  const m = dailyMenu(at('coastal'), meals);
  const warn = m.notes.filter((n) => n.warning);
  assert.equal(warn.length, 1);
  assert.match(warn[0].text, /хладилник/);
});

test('megacity: lunch from the vertical farm', () => {
  assert.equal(dailyMenu(at('megacity'), meals).B.lunch, meals.corrections.find((c) => c.id === 'lowLand')!.dish);
});

test('dish totals add up the ingredients', () => {
  const t = dishTotals({ name: 'x', drink: 'вода', water: 0, pros: [], cons: [], ingredients: [
    { name: 'a', grams: 10, kcal: 100, protein: 1, carbs: 2, fat: 3, fiber: 4 },
    { name: 'b', grams: 20, kcal: 50, protein: 5, carbs: 6, fat: 7, fiber: 8 },
  ] });
  assert.deepEqual(t, { kcal: 150, protein: 6, carbs: 8, fat: 10, fiber: 12 });
});

test('the audience vote picks the menu with more votes', () => {
  assert.equal(voteResult(3, 5), 'B');
  assert.equal(voteResult(5, 3), 'A');
  assert.equal(voteResult(4, 4), null);
  assert.equal(voteResult(0, 0), null);
});
