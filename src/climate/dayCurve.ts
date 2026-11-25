// A simple day/night temperature model for the chart in "Градът".
// The set temperature is the daily mean; dry air swings more between day and night, humid air less.
import type { Levels } from './levels.ts';

const AMPLITUDE: Record<Levels['humidity'], number> = { Сухо: 8, Нормално: 6, Влажно: 4 };
const PEAK_HOUR = 15;

export function dayCurve(temp: number, humidityLevel: Levels['humidity']): { hour: number; temp: number }[] {
  const amp = AMPLITUDE[humidityLevel];
  return Array.from({ length: 25 }, (_, hour) => ({
    hour,
    temp: temp + amp * Math.cos((2 * Math.PI * (hour - PEAK_HOUR)) / 24),
  }));
}
