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

export interface Store {
  get(): CityState;
  /** Merges the patch and notifies subscribers, but only if a value actually changed. */
  set(patch: Partial<CityState>): void;
  /** Calls fn right away with the current state, then on every change. Returns an unsubscribe function. */
  subscribe(fn: (s: CityState) => void): () => void;
}

export function createStore(initial: CityState): Store {
  let state: CityState = { ...initial };
  const listeners = new Set<(s: CityState) => void>();

  return {
    get: () => state,
    set(patch) {
      const changed = (Object.keys(patch) as (keyof CityState)[]).some((k) => patch[k] !== state[k]);
      if (!changed) return;
      state = { ...state, ...patch };
      for (const fn of listeners) fn(state);
    },
    subscribe(fn) {
      listeners.add(fn);
      fn(state);
      return () => listeners.delete(fn);
    },
  };
}
