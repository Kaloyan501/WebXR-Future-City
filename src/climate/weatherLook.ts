// How the settings change the 3D scene itself: sunlight and haze over the city model.
// Pure numbers and colours, so it can be tested without three.js.
import { mixHex, type Visuals } from './visuals.ts';

export interface WeatherLook {
  sunIntensity: number;
  sunColor: string;
  hemiSky: string;
  /** 0 = clear air, 1 = thick smog or fog. */
  haze: number;
  fogColor: string;
  fogNear: number;
  fogFar: number;
}

const SMOG_COLOR = '#8c8068';

function sunColorAt(temp: number): string {
  if (temp <= 18) return mixHex('#dfe8ff', '#ffffff', Math.max(0, (temp + 15) / 33));
  return mixHex('#ffffff', '#ffd9a8', Math.min(1, (temp - 18) / 27));
}

export function weatherLook(v: Visuals, s: { temp: number; uv: number }): WeatherLook {
  const haze = Math.max(v.smog, 0.8 * v.fog);
  const smogShare = v.smog / (v.smog + v.fog + 1e-6);
  return {
    sunIntensity: (0.9 + 0.15 * s.uv) * (1 - 0.4 * haze),
    sunColor: sunColorAt(s.temp),
    hemiSky: v.skyTop,
    haze,
    fogColor: mixHex(v.skyBottom, SMOG_COLOR, smogShare),
    // The desktop camera sits ~69 units from the plate centre; thicker haze starts closer.
    fogNear: 140 - 85 * haze,
    fogFar: 220 - 115 * haze,
  };
}
