// The one source of truth for the whole page: every section re-renders from this object.

export type WindDir = 'С' | 'СИ' | 'И' | 'ЮИ' | 'Ю' | 'ЮЗ' | 'З' | 'СЗ' | null;

export interface CityState {
  temp: number;
  humidity: number;
  windSpeed: number;
  windDir: WindDir;
  aqi: number;
  uv: number;
  water: number;
  land: number;
  energy: number;
  population: number;
  chosenMenu: 'A' | 'B' | null;
  scenarioId: string;
}

export const DEFAULT_STATE: CityState = {
  temp: 18,
  humidity: 55,
  windSpeed: 15,
  windDir: 'З',
  aqi: 40,
  uv: 5,
  water: 60,
  land: 50,
  energy: 60,
  population: 100000,
  chosenMenu: null,
  scenarioId: 'temperate',
};

/** Hot air can't stay this humid: 100 % up to 30 °C, then 4 % less per degree (40 % at 45 °C). */
export function maxHumidity(temp: number): number {
  return temp <= 30 ? 100 : Math.max(40, Math.round(100 - (temp - 30) * 4));
}

/** Free land follows the population: more residents, more built-up land (10 000 → 95 %, 100 000 → 50 %, 1 000 000 → 5 %). */
export function freeLand(population: number): number {
  const land = 95 - 45 * Math.log10(Math.max(population, 1) / 10000);
  return Math.round(Math.min(95, Math.max(5, land)));
}

/** Keeps the settings consistent: humidity capped in heat, free land derived from the population. */
export function normalize(s: CityState): CityState {
  const humidity = Math.min(s.humidity, maxHumidity(s.temp));
  const land = freeLand(s.population);
  return humidity === s.humidity && land === s.land ? s : { ...s, humidity, land };
}

export interface Store {
  get(): CityState;
  /** Merges the patch and notifies subscribers, but only if a value actually changed. */
  set(patch: Partial<CityState>): void;
  /** Calls fn right away with the current state, then on every change. Returns an unsubscribe function. */
  subscribe(fn: (s: CityState) => void): () => void;
}

export function createStore(initial: CityState): Store {
  let state: CityState = normalize({ ...initial });
  const listeners = new Set<(s: CityState) => void>();

  return {
    get: () => state,
    set(patch) {
      const next = normalize({ ...state, ...patch });
      const changed = (Object.keys(next) as (keyof CityState)[]).some((k) => next[k] !== state[k]);
      if (!changed) return;
      state = next;
      for (const fn of listeners) fn(state);
    },
    subscribe(fn) {
      listeners.add(fn);
      fn(state);
      return () => listeners.delete(fn);
    },
  };
}
