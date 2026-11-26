// "География и производство": five ways to grow food, how well each fits the current settings,
// and the best combination of three (never a single winner, spec).
import type { CityState } from './state.ts';
import { levelsOf, type Levels } from './levels.ts';

export type MethodLabel = 'Подходящо' | 'С компромис' | 'Неподходящо';

export interface MethodDef {
  id: string;
  name: string;
  /** Resource use: 0 много ниска, 1 ниска, 2 средна, 3 висока. */
  use: { water: number; land: number; energy: number };
  conditions: { rule: string; text: string }[];
  limit: string;
  provides: string;
  newProblem: string;
}

export interface MethodRating {
  id: string;
  label: MethodLabel;
  /** Texts of the conditions that are not met. */
  missing: string[];
  def: MethodDef;
}

const RULES: Record<string, (s: CityState, lv: Levels) => boolean> = {
  landAtLeast30: (s) => s.land >= 30,
  waterAtLeast30: (s) => s.water >= 30,
  temp5to32: (s) => s.temp >= 5 && s.temp <= 32,
  windUnder40: (s) => s.windSpeed < 40,
  coldOrDry: (_s, lv) => lv.temp === 'Студено' || lv.humidity === 'Сухо',
  energyAtLeast30: (s) => s.energy >= 30,
  landUnder30: (s) => s.land < 30,
  energyAtLeast50: (s) => s.energy >= 50,
  waterUnder30: (s) => s.water < 30,
  waterAtLeast70: (s) => s.water >= 70,
};

const LABELS: MethodLabel[] = ['Подходящо', 'С компромис', 'Неподходящо'];

/** All conditions met → Подходящо; one missed → С компромис; two or more → Неподходящо. */
export function methodRatings(s: CityState, defs: MethodDef[]): MethodRating[] {
  const lv = levelsOf(s);
  return defs.map((def) => {
    const missing = def.conditions.filter((c) => !RULES[c.rule]?.(s, lv)).map((c) => c.text);
    return { id: def.id, label: LABELS[Math.min(missing.length, 2)], missing, def };
  });
}

const resourceUse = (d: MethodDef) => d.use.water + d.use.land + d.use.energy;

/** The three best-fitting methods: fewest missed conditions first, then the lowest resource use. */
export function topCombination(s: CityState, defs: MethodDef[]): MethodRating[] {
  return methodRatings(s, defs)
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r.missing.length - b.r.missing.length || resourceUse(a.r.def) - resourceUse(b.r.def) || a.i - b.i)
    .slice(0, 3)
    .map((x) => x.r);
}
