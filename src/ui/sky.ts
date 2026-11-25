// The sky behind the 3D city: a plain colour gradient that follows temperature, humidity and smog.
// The 3D model itself is the scene (rain, snow and clouds live in 3D); nothing else is drawn here.
// Every change is a ~0.8 s transition (instant with reduced motion).
import type { CityState, Store } from '../climate/state.ts';
import { createTween } from '../climate/tween.ts';
import { visualsFor, windXOf, type VisualInput } from '../climate/visuals.ts';

export const TRANSITION_MS = 800;

export function inputOf(s: CityState): VisualInput {
  return {
    temp: s.temp,
    humidity: s.humidity,
    windSpeed: s.windSpeed,
    windX: windXOf(s.windDir),
    aqi: s.aqi,
    uv: s.uv,
    water: s.water,
    land: s.land,
    energy: s.energy,
  };
}

/** Paints the sky into `root`, behind the transparent 3D canvas. */
export function mountSky(root: HTMLElement, store: Store, opts: { reducedMotion: boolean }): void {
  const apply = (v: VisualInput) => {
    const vis = visualsFor(v);
    root.style.background = `linear-gradient(180deg, ${vis.skyTop} 0%, ${vis.skyBottom} 75%)`;
  };

  const tween = createTween(inputOf(store.get()), TRANSITION_MS, apply);
  tween.snap(inputOf(store.get()));
  store.subscribe((s) => (opts.reducedMotion ? tween.snap(inputOf(s)) : tween.to(inputOf(s))));
}
