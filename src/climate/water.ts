// Water rules for the 3D city (pure, tested): where the coast is for a sea level, and how full the lakes are.

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

// Kaloyan's sea-level scenarios (content.json): today 0.3, +50 years 0.6, +100 years 0.95.
// The sea lies on the +x side of the plate (his original coastline was at x = 5).
const COAST: [number, number][] = [
  [0.3, 8],
  [0.6, 5],
  [0.95, 1],
];

/** x of the coastline on the plate for a sea level: the higher the sea, the further inland. */
export function coastX(level: number): number {
  if (level <= COAST[0][0]) return COAST[0][1];
  for (let i = 1; i < COAST.length; i++) {
    const [l1, x1] = COAST[i];
    if (level <= l1) {
      const [l0, x0] = COAST[i - 1];
      return Math.round((x0 + ((level - l0) / (l1 - l0)) * (x1 - x0)) * 100) / 100;
    }
  }
  return COAST[COAST.length - 1][1];
}

/** How full the reservoirs are (0 dry … 1 full) for the available water (0–100 %). */
export function lakeFill(water: number): number {
  return clamp(water / 100, 0, 1);
}
