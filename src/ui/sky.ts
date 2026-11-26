// The sky behind the 3D city: a plain colour gradient that follows temperature, humidity and smog.
// The 3D model itself is the scene (rain, snow and clouds live in 3D); nothing else is drawn here.
// It is painted from the shared climate transition in climate-page.ts, in step with the 3D weather.
import type { CityState } from '../climate/state.ts';
import { visualsFor, windVecOf, type VisualInput } from '../climate/visuals.ts';

/** The numbers the climate transition eases between: the visual inputs plus the wind's north–south part. */
export type ClimateLook = VisualInput & { windZ: number };

export function lookOf(s: CityState): ClimateLook {
  const wind = windVecOf(s.windDir);
  return {
    temp: s.temp,
    humidity: s.humidity,
    windSpeed: s.windSpeed,
    windX: wind.x,
    windZ: wind.z,
    aqi: s.aqi,
    uv: s.uv,
    water: s.water,
    land: s.land,
    energy: s.energy,
  };
}

/** Paints the sky gradient into `root`, behind the transparent 3D canvas. */
export function createSky(root: HTMLElement): { apply(v: VisualInput): void } {
  return {
    apply(v) {
      const vis = visualsFor(v);
      root.style.background = `linear-gradient(180deg, ${vis.skyTop} 0%, ${vis.skyBottom} 75%)`;
    },
  };
}
