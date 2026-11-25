// Deterministic city layout for the background, so the skyline looks the same on every load.

export const SCENE_W = 1600;
export const SCENE_H = 900;
export const FAR_BASE = 650;
export const NEAR_BASE = 690;

export interface Building {
  x: number;
  w: number;
  h: number;
  layer: 'far' | 'near';
  solar: boolean;
  farm: boolean;
  /** Window positions relative to the building's top-left; bucket 0–9 decides at which energy level it lights up. */
  windows: { x: number; y: number; bucket: number }[];
}

/** Small seeded random generator (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function row(rand: () => number, layer: 'far' | 'near'): Building[] {
  const out: Building[] = [];
  let x = -10;
  while (x < SCENE_W) {
    const near = layer === 'near';
    const w = Math.round(near ? 46 + rand() * 54 : 40 + rand() * 50);
    const h = Math.round(near ? 80 + rand() * 150 : 60 + rand() * 120);
    const windows: Building['windows'] = [];
    if (near) {
      const cols = Math.floor((w - 10) / 16);
      const rows = Math.floor((h - 26) / 20);
      const padX = (w - cols * 16 + 10) / 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          windows.push({ x: Math.round(padX + c * 16), y: 14 + r * 20, bucket: Math.floor(rand() * 10) });
        }
      }
    }
    out.push({ x, w, h, layer, solar: near && rand() < 0.45, farm: near && rand() < 0.5, windows });
    x += w + Math.round(near ? 10 + rand() * 26 : rand() * 10);
  }
  return out;
}

export function generateSkyline(seed: number): Building[] {
  const rand = mulberry32(seed);
  return [...row(rand, 'far'), ...row(rand, 'near')];
}
