// The ready-made cases behind "Зареди сценарий". The data lives in data/scenarios.json,
// so new scenarios can be added without touching code.
import type { CityState } from './state.ts';
import type { SettingKey } from './levels.ts';

export type ScenarioValues = Pick<
  CityState,
  'temp' | 'humidity' | 'windSpeed' | 'windDir' | 'aqi' | 'uv' | 'water' | 'land' | 'energy'
>;

export interface Scenario {
  id: string;
  name: string;
  description: string;
  values: ScenarioValues;
}

const SCENARIO_KEYS: (keyof ScenarioValues)[] = [
  'temp', 'humidity', 'windSpeed', 'windDir', 'aqi', 'uv', 'water', 'land', 'energy',
];

/** The state patch that loads a scenario. Population is left as it is. */
export function applyScenario(sc: Scenario): Partial<CityState> {
  return { ...sc.values, scenarioId: sc.id };
}

/** True while every scenario value is still untouched. */
export function matchesScenario(s: CityState, sc: Scenario): boolean {
  return SCENARIO_KEYS.every((k) => s[k] === sc.values[k]);
}

export const SLIDER_RANGES: Record<Exclude<SettingKey, 'windDir'>, { min: number; max: number; step: number }> = {
  temp: { min: -15, max: 45, step: 1 },
  humidity: { min: 10, max: 100, step: 1 },
  windSpeed: { min: 0, max: 100, step: 1 },
  aqi: { min: 0, max: 300, step: 5 },
  uv: { min: 0, max: 11, step: 1 },
  water: { min: 0, max: 100, step: 1 },
  land: { min: 0, max: 100, step: 1 },
  energy: { min: 0, max: 100, step: 1 },
  population: { min: 10000, max: 1000000, step: 10000 },
};

/** The scenario after `currentId`, wrapping around; the first one if `currentId` is not in the list. */
export function nextScenarioId(ids: string[], currentId: string): string {
  const i = ids.indexOf(currentId);
  return ids[i < 0 ? 0 : (i + 1) % ids.length];
}
