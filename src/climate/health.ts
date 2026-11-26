// "Начин на живот": disease risks and life expectancy. A simplified teaching model, not a forecast.
import type { CityState } from './state.ts';
import { levelsOf, type Levels } from './levels.ts';

export type RiskLevel = 'Нисък' | 'Среден' | 'Висок';

export interface DiseaseDef {
  id: string;
  name: string;
  conditions: { rule: string; why: string }[];
  /** Shown when no condition is met. */
  safe: string;
}

export interface DiseaseRisk {
  id: string;
  name: string;
  level: RiskLevel;
  /** 0, 1 or 2 steps above low. */
  steps: number;
  why: string;
}

// The spec's conditions. Data names the rule; the check lives here.
const RULES: Record<string, (s: CityState, lv: Levels) => boolean> = {
  aqiOver50: (s) => s.aqi > 50,
  aqiOver150: (s) => s.aqi > 150,
  humidCold: (_s, lv) => lv.humidity === 'Влажно' && lv.temp === 'Студено',
  heat: (_s, lv) => lv.temp === 'Жега',
  menuA: (s) => s.chosenMenu === 'A',
  waterUnder30: (s) => s.water < 30,
  uvOver7: (s) => s.uv > 7,
  uvOver9: (s) => s.uv > 9,
  tempOver25: (s) => s.temp > 25,
  humidityOver70: (s) => s.humidity > 70,
  energyUnder30: (s) => s.energy < 30,
  mosquito: (s) => s.temp > 25 && s.humidity > 70,
  tempUnderMinus5: (s) => s.temp < -5,
  stormCold: (_s, lv) => lv.wind === 'Буря' && lv.temp === 'Студено',
  uvUnder3: (s) => s.uv < 3,
};

const LEVELS: RiskLevel[] = ['Нисък', 'Среден', 'Висок'];

const sentence = (parts: string[]) => {
  const text = parts.join('; ');
  return text.charAt(0).toUpperCase() + text.slice(1) + '.';
};

/** Each met condition raises the risk one step (low → medium → high). */
export function diseaseRisks(s: CityState, defs: DiseaseDef[]): DiseaseRisk[] {
  const lv = levelsOf(s);
  return defs.map((d) => {
    const met = d.conditions.filter((c) => RULES[c.rule]?.(s, lv));
    const steps = Math.min(met.length, 2);
    return {
      id: d.id,
      name: d.name,
      level: LEVELS[steps],
      steps,
      why: met.length ? sentence(met.map((c) => c.why)) : d.safe,
    };
  });
}

export interface Lifespan {
  base: number;
  years: number;
  factors: { label: string; delta: number }[];
}

export const LIFESPAN_BASE = 78;

/** Base 78 years plus or minus each factor from the spec, kept between 60 and 90. */
export function lifespan(s: CityState): Lifespan {
  const lv = levelsOf(s);
  const factors: Lifespan['factors'] = [];
  if (s.aqi > 150) factors.push({ label: 'Силен смог (AQI над 150)', delta: -3 });
  else if (s.aqi >= 50) factors.push({ label: 'Замърсен въздух (AQI 50–150)', delta: -1 });
  if (lv.temp === 'Жега') factors.push({ label: 'Жега над 32 °C', delta: -1.5 });
  if (s.temp < -5) factors.push({ label: 'Студ под −5 °C', delta: -0.5 });
  if (s.uv > 7) factors.push({ label: 'UV индекс над 7', delta: -0.5 });
  if (s.water < 30) factors.push({ label: 'Вода под 30 %', delta: -2 });
  if (s.energy < 30) factors.push({ label: 'Енергия под 30 %', delta: -1 });
  if (s.chosenMenu === 'B') factors.push({ label: 'Публиката избра Меню Б', delta: 2 });
  if (s.chosenMenu === 'A') factors.push({ label: 'Публиката избра Меню А', delta: -2 });
  const raw = factors.reduce((sum, f) => sum + f.delta, LIFESPAN_BASE);
  return { base: LIFESPAN_BASE, years: Math.min(90, Math.max(60, raw)), factors };
}
