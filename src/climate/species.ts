// "Биология": which plants and animals can live in the city now, and why not.
import type { CityState } from './state.ts';

type Param = 'humidity' | 'water' | 'land' | 'aqi' | 'windSpeed';

export interface SpeciesDef {
  id: string;
  name: string;
  kind: string;
  /** Temperature range in °C, both ends included. */
  temp: [number, number];
  /** min: at least; max: at most; lt: strictly below. */
  conditions: { param: Param; min?: number; max?: number; lt?: number }[];
  trait: string;
}

const TOO_LOW: Record<Param, string> = {
  humidity: 'твърде сухо',
  water: 'твърде малко вода',
  land: 'твърде малко свободна земя',
  aqi: '',
  windSpeed: '',
};

const TOO_HIGH: Record<Param, string> = {
  humidity: 'твърде влажно',
  water: 'твърде много вода',
  land: '',
  aqi: 'твърде замърсен въздух',
  windSpeed: 'твърде силен вятър',
};

export function speciesStatus(s: CityState, sp: SpeciesDef): { ok: true } | { ok: false; reason: string } {
  if (s.temp < sp.temp[0]) return { ok: false, reason: 'твърде студено' };
  if (s.temp > sp.temp[1]) return { ok: false, reason: 'твърде горещо' };
  for (const c of sp.conditions) {
    const v = s[c.param];
    if (c.min !== undefined && v < c.min) return { ok: false, reason: TOO_LOW[c.param] };
    if (c.max !== undefined && v > c.max) return { ok: false, reason: TOO_HIGH[c.param] };
    if (c.lt !== undefined && v >= c.lt) return { ok: false, reason: TOO_HIGH[c.param] };
  }
  return { ok: true };
}
