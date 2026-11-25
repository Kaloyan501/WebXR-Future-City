// "Храни": the most common meal under the current conditions, and what each nutrient does.
import type { CityState } from './state.ts';
import { levelsOf, type Levels } from './levels.ts';

export interface FoodsData {
  typical: { rule: string; name: string; drink: string; why: string }[];
  nutrients: { name: string; role: string; examples: string }[];
}

const RULES: Record<string, (s: CityState, lv: Levels) => boolean> = {
  cold: (_s, lv) => lv.temp === 'Студено',
  temperate: (_s, lv) => lv.temp === 'Умерено',
  warm: (_s, lv) => lv.temp === 'Топло' || lv.temp === 'Жега',
  humidWater: (s, lv) => lv.humidity === 'Влажно' && s.water > 70,
  landUnder30: (s) => s.land < 30,
};

/** If several rows match, the lower one wins (spec). */
export function typicalMeal(s: CityState, data: FoodsData): FoodsData['typical'][number] {
  const lv = levelsOf(s);
  let found = data.typical[0];
  for (const row of data.typical) if (RULES[row.rule]?.(s, lv)) found = row;
  return found;
}
