import raw from '../content/content.json';

export type Tag = 'geo' | 'bio';
export type Layer = 'all' | Tag;

export interface Pin {
  id: number;
  title: string;
  tags: Tag[];
  /** Tile coordinates on the city plate, x and z in [-12, 12]. */
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

export interface Content {
  site: { title: string; location: string; note: string };
  scenarios: Scenario[];
  pins: Pin[];
}

export const content = raw as unknown as Content;

export const TAG_LABEL: Record<Tag, string> = { geo: 'Geography', bio: 'Biology' };
export const TAG_COLOR: Record<Tag, number> = { geo: 0xe8a33d, bio: 0x4caf7a };

export const cssColor = (hex: number): string => '#' + hex.toString(16).padStart(6, '0');
