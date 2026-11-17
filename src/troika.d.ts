// Minimal typings for the troika-three-text properties this project uses.
// (The package's bundled typings do not model Text as a THREE.Mesh.)
declare module 'troika-three-text' {
  import type { Mesh } from 'three';

  export class Text extends Mesh {
    text: string;
    fontSize: number;
    font: string | null;
    color: number | string;
    anchorX: number | string;
    anchorY: number | string;
    maxWidth: number;
    lineHeight: number | string;
    outlineWidth: number | string;
    outlineColor: number | string;
    outlineOpacity: number;
    fillOpacity: number;
    /** Re-typesets the text; call after changing any text property. */
    sync(callback?: () => void): void;
    dispose(): void;
  }
}
