import raw from '../content/content.json';

export type Tag = 'geo' | 'bio';
export type Layer = 'all' | Tag;

export interface Pin {
  id: number;
  title: string;
  tags: Tag[];
  /** World position [x, z] on the plate, each in [-GRID/2, GRID/2]. Tile [col, row] has its centre at x = col - GRID/2 + 0.5. */
  position: [number, number];
  /** Optional stem height in tile units. */
  lift?: number;
  summary: string;
  details: string;
}

export interface Scenario {
  label: string;
  year: number;
  waterLevel: number;
}

/** A 3D model (GLB) placed on the tile grid. */
export interface Placement {
  /** Path under public/, e.g. "models/house.glb". */
  model: string;
  /** [col, row], 0-based. Col runs along +x, row along +z. For multi-tile models, the lowest-index corner. */
  tile: [number, number];
  /** Tiles covered as [cols, rows]. Default [1, 1]. The model is scaled to fit inside this footprint. */
  span?: [number, number];
  /** Degrees about the vertical axis. Default 0. */
  rotation?: number;
  /** Multiplier on top of the fit-to-footprint scale. Default 1; above 1 overflows the footprint. */
  scale?: number;
  /** Extra lift in world units (e.g. for a raised foundation). Default 0. */
  offsetY?: number;
}

export interface Content {
  site: { title: string; location: string; note: string };
  scenarios: Scenario[];
  placements: Placement[];
  pins: Pin[];
}

// `placements` may be missing from older content files.
const file = raw as unknown as Omit<Content, 'placements'> & { placements?: Placement[] };
export const content: Content = { ...file, placements: file.placements ?? [] };

export const TAG_LABEL: Record<Tag, string> = { geo: 'Geography', bio: 'Biology' };
export const TAG_COLOR: Record<Tag, number> = { geo: 0xe8a33d, bio: 0x4caf7a };

export const cssColor = (hex: number): string => '#' + hex.toString(16).padStart(6, '0');
