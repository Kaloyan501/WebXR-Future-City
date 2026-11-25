// Turns exact numbers into the level words from the spec ("Студено", "Жега", ...).
// Section rules read these words, not the raw numbers.
import type { CityState } from './state.ts';

export interface Levels {
  temp: 'Студено' | 'Умерено' | 'Топло' | 'Жега';
  humidity: 'Сухо' | 'Нормално' | 'Влажно';
  wind: 'Тихо' | 'Умерено' | 'Буря';
  aqi: 'Добро' | 'Средно' | 'Лошо';
  uv: 'Нисък' | 'Среден' | 'Висок';
  water: 'Дефицит' | 'Норма' | 'Изобилие';
  land: 'Малко' | 'Норма' | 'Много';
  energy: 'Оскъдна' | 'Норма' | 'Изобилна';
}

/** Picks low below `lo`, high above `hi`, mid otherwise (both bounds inclusive in mid). */
function band<L, M, H>(v: number, lo: number, hi: number, low: L, mid: M, high: H): L | M | H {
  if (v < lo) return low;
  if (v > hi) return high;
  return mid;
}

export function levelsOf(s: CityState): Levels {
  return {
    temp: s.temp < 5 ? 'Студено' : s.temp <= 25 ? 'Умерено' : s.temp <= 32 ? 'Топло' : 'Жега',
    humidity: band(s.humidity, 30, 70, 'Сухо', 'Нормално', 'Влажно'),
    wind: band(s.windSpeed, 10, 40, 'Тихо', 'Умерено', 'Буря'),
    aqi: band(s.aqi, 50, 150, 'Добро', 'Средно', 'Лошо'),
    uv: band(s.uv, 3, 7, 'Нисък', 'Среден', 'Висок'),
    water: band(s.water, 30, 70, 'Дефицит', 'Норма', 'Изобилие'),
    land: band(s.land, 30, 70, 'Малко', 'Норма', 'Много'),
    energy: band(s.energy, 30, 70, 'Оскъдна', 'Норма', 'Изобилна'),
  };
}

const WARNING_WORDS = new Set<string>(['Жега', 'Буря', 'Лошо', 'Висок', 'Дефицит', 'Оскъдна']);

/** Adverse levels get the orange accent; everything else stays green. */
export function isWarning(key: keyof Levels, lv: Levels): boolean {
  return WARNING_WORDS.has(lv[key]);
}

export type SettingKey =
  | 'temp' | 'humidity' | 'windSpeed' | 'windDir' | 'aqi' | 'uv' | 'water' | 'land' | 'energy' | 'population';

/** Bulgarian number format: non-breaking space between thousands, real minus sign. */
export function formatNumber(n: number): string {
  const digits = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (n < 0 ? '−' : '') + digits;
}

export function formatSetting(key: SettingKey, s: CityState): string {
  const lv = levelsOf(s);
  switch (key) {
    case 'temp': return `${formatNumber(s.temp)} °C · ${lv.temp}`;
    case 'humidity': return `${formatNumber(s.humidity)} % · ${lv.humidity}`;
    case 'windSpeed': return `${formatNumber(s.windSpeed)} km/h · ${lv.wind}`;
    case 'windDir': return s.windDir ?? 'Без посока';
    case 'aqi': return `${formatNumber(s.aqi)} · ${lv.aqi}`;
    case 'uv': return `${formatNumber(s.uv)} · ${lv.uv}`;
    case 'water': return `${formatNumber(s.water)} % · ${lv.water}`;
    case 'land': return `${formatNumber(s.land)} % · ${lv.land}`;
    case 'energy': return `${formatNumber(s.energy)} % · ${lv.energy}`;
    case 'population': return `${formatNumber(s.population)} жители`;
  }
}
