// "Храната в числа": the fruit and vegetable calculator and the farm-to-table chain.
import type { CityState } from './state.ts';
import { levelsOf } from './levels.ts';

/** WHO guide: 400 g of fruit and vegetables per person per day. */
export const KG_PER_PERSON = 0.4;

export function produceNeed(population: number): { kgPerDay: number; tonnesPerDay: number; tonnesPerYear: number } {
  const kgPerDay = Math.round(population * KG_PER_PERSON);
  const tonnesPerDay = kgPerDay / 1000;
  return { kgPerDay, tonnesPerDay, tonnesPerYear: Math.round(tonnesPerDay * 365 * 10) / 10 };
}

export type LinkId = 'resources' | 'farm' | 'storage' | 'kitchen' | 'eating' | 'waste';

/** The links the current settings make hard (spec): little water or energy → resources and farm; heat or humidity over 70 % → storage. */
export function weakLinks(s: CityState): LinkId[] {
  const lv = levelsOf(s);
  const out: LinkId[] = [];
  if (s.water < 30 || s.energy < 30) out.push('resources', 'farm');
  if (lv.temp === 'Жега' || s.humidity > 70) out.push('storage');
  return out;
}
