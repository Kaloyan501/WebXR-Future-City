// Pure mapping from the (tweened) settings to everything the background draws.
// No DOM here, so every rule from the spec's "Динамичен фон" table can be tested.
import type { WindDir } from './state.ts';

export interface VisualInput {
  temp: number;
  humidity: number;
  windSpeed: number;
  /** Horizontal wind component, −1 (blowing to the left) … 1 (blowing to the right). */
  windX: number;
  aqi: number;
  uv: number;
  water: number;
  land: number;
  energy: number;
}

export interface Visuals {
  skyTop: string;
  skyBottom: string;
  cloudColor: string;
  sunRadius: number;
  sunGlow: number;
  shadowOpacity: number;
  cloudVx: number;
  treeBendDeg: number;
  smog: number;
  fog: number;
  saturation: number;
  rain: number;
  snowfall: number;
  snowRoofs: number;
  shimmer: number;
  riverHeight: number;
  riverColor: string;
  fieldFraction: number;
  rooftopFarms: number;
  litWindows: number;
  solar: number;
  turbines: number;
  turbineRpm: number;
}

/**
 * The compass gives where the wind comes FROM. The viewer looks north at the city,
 * so east is on the right: a west wind (З) pushes clouds to the right.
 */
export function windXOf(dir: WindDir): number {
  const D = Math.SQRT1_2;
  switch (dir) {
    case 'З': return 1;
    case 'СЗ': case 'ЮЗ': return Math.round(D * 100) / 100;
    case 'И': return -1;
    case 'СИ': case 'ЮИ': return -Math.round(D * 100) / 100;
    default: return 0;
  }
}

/**
 * The full wind direction on the plate: where the wind blows TO, as a unit vector.
 * East is +x and north is −z, so a north wind (С) blows towards +z.
 */
export function windVecOf(dir: WindDir): { x: number; z: number } {
  const D = Math.round(Math.SQRT1_2 * 100) / 100;
  switch (dir) {
    case 'З': return { x: 1, z: 0 };
    case 'И': return { x: -1, z: 0 };
    case 'С': return { x: 0, z: 1 };
    case 'Ю': return { x: 0, z: -1 };
    case 'СЗ': return { x: D, z: D };
    case 'СИ': return { x: -D, z: D };
    case 'ЮЗ': return { x: D, z: -D };
    case 'ЮИ': return { x: -D, z: -D };
    default: return { x: 0, z: 0 };
  }
}

// Sky colour stops by temperature: cold blue → light blue → warm yellow-orange.
const SKY_STOPS: { t: number; top: string; bottom: string }[] = [
  { t: -15, top: '#7d93b0', bottom: '#d3dbe6' },
  { t: 5, top: '#6a9bd1', bottom: '#d6e6f3' },
  { t: 18, top: '#4f9ad9', bottom: '#cfe7f7' },
  { t: 30, top: '#e0a45e', bottom: '#f7dcae' },
  { t: 45, top: '#d9783a', bottom: '#f4c58a' },
];
const SMOG_COLOR = '#8c8068';
const OVERCAST_COLOR = '#9aa6ad';
const STORM_CLOUD = '#a7b0b7';
const RIVER_DRY = '#9b8a62';
const RIVER_FULL = '#3d7fb8';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}

export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex([0, 1, 2].map((i) => ca[i] + (cb[i] - ca[i]) * t) as [number, number, number]);
}

function skyAt(temp: number): { top: string; bottom: string } {
  const first = SKY_STOPS[0];
  const last = SKY_STOPS[SKY_STOPS.length - 1];
  if (temp <= first.t) return first;
  if (temp >= last.t) return last;
  const i = SKY_STOPS.findIndex((s) => s.t > temp);
  const a = SKY_STOPS[i - 1];
  const b = SKY_STOPS[i];
  const t = (temp - a.t) / (b.t - a.t);
  return { top: mixHex(a.top, b.top, t), bottom: mixHex(a.bottom, b.bottom, t) };
}

export function visualsFor(v: VisualInput): Visuals {
  // Strong wind blows part of the smog away.
  const smog = clamp01((v.aqi - 40) / 220) * (1 - 0.5 * clamp01(v.windSpeed / 60));
  // Humid, rainy weather is overcast: a greyer sky, darker clouds and a weaker sun glow.
  const overcast = clamp01((v.humidity - 70) / 25);
  const sky = skyAt(v.temp);
  const top = mixHex(sky.top, OVERCAST_COLOR, overcast * 0.65);
  const bottom = mixHex(sky.bottom, OVERCAST_COLOR, overcast * 0.5);

  return {
    skyTop: mixHex(top, SMOG_COLOR, smog * 0.7),
    skyBottom: mixHex(bottom, SMOG_COLOR, smog * 0.7),
    cloudColor: mixHex('#ffffff', STORM_CLOUD, overcast),
    sunRadius: 28 + 4 * v.uv,
    sunGlow: (0.15 + 0.04 * v.uv) * (1 - 0.6 * overcast),
    shadowOpacity: 0.05 + 0.04 * v.uv,
    cloudVx: v.windX * (4 + 1.6 * v.windSpeed),
    treeBendDeg: v.windX * Math.min(v.windSpeed, 80) * 0.3,
    smog,
    fog: clamp01((v.humidity - 70) / 25),
    saturation: v.humidity < 30 ? 0.55 + 0.45 * clamp01(v.humidity / 30) : 1,
    rain: v.humidity > 85 && v.temp > 0 ? clamp01((v.humidity - 85) / 15 + 0.2) : 0,
    snowfall: v.humidity > 70 && v.temp <= 0 ? clamp01((v.humidity - 70) / 30 + 0.2) : 0,
    snowRoofs: clamp01(-v.temp / 3),
    shimmer: clamp01((v.temp - 32) / 8),
    riverHeight: 8 + 0.82 * v.water,
    riverColor: mixHex(RIVER_DRY, RIVER_FULL, clamp01(v.water / 100)),
    fieldFraction: clamp01(v.land / 100),
    rooftopFarms: 1 - smoothstep(25, 35, v.land),
    litWindows: 0.1 + 0.8 * clamp01(v.energy / 100),
    solar: smoothstep(25, 35, v.energy),
    turbines: smoothstep(65, 75, v.energy),
    turbineRpm: 2 * v.windSpeed,
  };
}
