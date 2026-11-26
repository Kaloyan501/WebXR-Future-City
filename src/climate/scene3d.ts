// Small pure rules for the 3D weather effects (kept apart from three.js so they can be tested).

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** The sun sprite: bigger and brighter with a higher UV index. */
export function sunGlow(uv: number): { scale: number; opacity: number } {
  return { scale: 4 + uv * 0.9, opacity: Math.min(1, 0.35 + uv * 0.06) };
}

/** Share of the steam the power plants give off, from the energy setting (0–100 %). */
export function steamRate(energy: number): number {
  return clamp01(energy / 100);
}

/** Share of the wind streaks shown: none without a direction or below ~8 km/h. */
export function windStreaks(windSpeed: number, windX: number, windZ: number): number {
  if (Math.hypot(windX, windZ) < 0.1) return 0;
  return clamp01((windSpeed - 8) / 50);
}

/** Clouds shrink away towards the edge of the plate and are moved to the other side at 17 units. */
export const CLOUD_EDGE = 17;
export function cloudEdgeFade(x: number, z: number): number {
  return 1 - smoothstep(13, CLOUD_EDGE, Math.max(Math.abs(x), Math.abs(z)));
}
