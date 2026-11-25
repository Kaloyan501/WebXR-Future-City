// "Дневно меню": Menu А (convenient) vs Menu Б (balanced) for four meals. The base menu follows
// the temperature level; other settings swap a dish in Menu Б and add a note (spec).
import type { CityState } from './state.ts';
import { levelsOf, type Levels } from './levels.ts';

export const SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
export type Slot = (typeof SLOTS)[number];
export type ClimateBand = 'cold' | 'temperate' | 'warm';
export type CorrectionId = 'badAir' | 'highUvHeat' | 'lowUv' | 'lowWater' | 'lowLand' | 'spoilage';

export interface Ingredient {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface Dish {
  name: string;
  drink: string;
  /** Approximate water in the meal and drink, ml. */
  water: number;
  ingredients: Ingredient[];
  pros: string[];
  cons: string[];
}

export interface MealsData {
  note: string;
  slots: Record<Slot, string>;
  menus: Record<ClimateBand, { A: Record<Slot, string>; B: Record<Slot, string> }>;
  corrections: { id: CorrectionId; slot?: Slot; dish?: string; note: string; warning?: boolean }[];
  dishes: Record<string, Dish>;
}

export interface DailyMenu {
  band: ClimateBand;
  A: Record<Slot, string>;
  B: Record<Slot, string>;
  /** Menu Б slots replaced by a correction, in meal order. */
  changed: Slot[];
  notes: { text: string; warning: boolean }[];
}

export function climateBand(temp: Levels['temp']): ClimateBand {
  if (temp === 'Студено') return 'cold';
  if (temp === 'Умерено') return 'temperate';
  return 'warm';
}

const CONDITIONS: Record<CorrectionId, (s: CityState, lv: Levels) => boolean> = {
  badAir: (s) => s.aqi > 150,
  highUvHeat: (s, lv) => s.uv > 7 || lv.temp === 'Жега',
  lowUv: (s) => s.uv < 3,
  lowWater: (s) => s.water < 30,
  lowLand: (s) => s.land < 30,
  spoilage: (s) => s.temp > 25 && s.humidity > 70,
};

export function dailyMenu(s: CityState, data: MealsData): DailyMenu {
  const lv = levelsOf(s);
  const band = climateBand(lv.temp);
  const B = { ...data.menus[band].B };
  const changed = new Set<Slot>();
  const notes: DailyMenu['notes'] = [];
  for (const c of data.corrections) {
    if (!CONDITIONS[c.id](s, lv)) continue;
    notes.push({ text: c.note, warning: !!c.warning });
    if (c.slot && c.dish && B[c.slot] !== c.dish) {
      B[c.slot] = c.dish;
      changed.add(c.slot);
    }
  }
  return { band, A: { ...data.menus[band].A }, B, changed: SLOTS.filter((x) => changed.has(x)), notes };
}

export function dishTotals(d: Dish): { kcal: number; protein: number; carbs: number; fat: number; fiber: number } {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const i of d.ingredients) {
    t.kcal += i.kcal;
    t.protein += i.protein;
    t.carbs += i.carbs;
    t.fat += i.fat;
    t.fiber += i.fiber;
  }
  const r = (x: number) => Math.round(x * 10) / 10;
  return { kcal: r(t.kcal), protein: r(t.protein), carbs: r(t.carbs), fat: r(t.fat), fiber: r(t.fiber) };
}

/** The menu with more votes wins; a tie (or no votes) means no menu is chosen. */
export function voteResult(a: number, b: number): 'A' | 'B' | null {
  if (a === b) return null;
  return a > b ? 'A' : 'B';
}
