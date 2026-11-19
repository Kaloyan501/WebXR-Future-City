import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { Placement } from '../content';
import { GRID, tileKey, tileToWorld } from './city';

// GLBs exported with `gltf-transform ... --compress meshopt` need the decoder.
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

// One download and parse per file, however many times it is placed.
const cache = new Map<string, Promise<THREE.Object3D>>();

function load(path: string): Promise<THREE.Object3D> {
  let p = cache.get(path);
  if (!p) {
    p = loader
      .loadAsync(`${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`)
      .then((g) => g.scene)
      .catch((e: unknown) => {
        cache.delete(path); // allow a retry after the file is fixed
        // A missing file usually shows up as a JSON parse error (the dev server answers with index.html).
        throw new Error(`could not load or parse public/${path}: ${e instanceof Error ? e.message : String(e)}`);
      });
    cache.set(path, p);
  }
  return p;
}

const spanOf = (p: Placement): [number, number] => p.span ?? [1, 1];

/** Keys (see `tileKey`) of every tile covered by the placements. Synchronous, so the city can skip them. */
export function occupiedTiles(placements: Placement[]): Set<string> {
  const tiles = new Set<string>();
  for (const p of placements) {
    const [col, row] = p.tile;
    const [w, d] = spanOf(p);
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) tiles.add(tileKey(col + i, row + j));
  }
  return tiles;
}

/**
 * Fit the model inside its footprint (keeping proportions), centre it on the footprint
 * and stand it on the terrain.
 */
async function place(p: Placement): Promise<THREE.Object3D> {
  const [col, row] = p.tile;
  const [w, d] = spanOf(p);
  if (col < 0 || row < 0 || col + w > GRID || row + d > GRID) {
    throw new Error(`tile [${col}, ${row}] with span [${w}, ${d}] is outside the ${GRID}x${GRID} grid`);
  }

  const inner = (await load(p.model)).clone(true);
  inner.rotation.y = THREE.MathUtils.degToRad(p.rotation ?? 0); // rotate first: it changes the footprint
  const holder = new THREE.Group();
  holder.name = p.model;
  holder.add(inner);
  holder.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(holder);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const fitX = size.x > 1e-6 ? w / size.x : Infinity;
  const fitZ = size.z > 1e-6 ? d / size.z : Infinity;
  const fit = (Number.isFinite(Math.min(fitX, fitZ)) ? Math.min(fitX, fitZ) : 1) * (p.scale ?? 1);

  // Stand on the highest tile under the footprint so the model never sinks into the terrain.
  let ground = 1;
  /*for (let i = 0; i < w; i++) {
    for (let j = 0; j < d; j++) {
      const [tx, tz] = tileToWorld(col + i, row + j);
      ground = Math.max(ground, terrainHeight(tx, tz));
    }
  }
  */
  const [x0, z0] = tileToWorld(col, row);
  holder.scale.setScalar(fit);
  holder.position.set(
    x0 + (w - 1) / 2 - center.x * fit,
    ground + (p.offsetY ?? 0) - box.min.y * fit,
    z0 + (d - 1) / 2 - center.z * fit,
  );
  return holder;
}

/** Load and place every model. A failing model is logged and skipped; the rest still appear. */
export async function loadPlacements(placements: Placement[]): Promise<THREE.Group> {
  const group = new THREE.Group();
  group.name = 'placements';
  const results = await Promise.allSettled(placements.map(place));
  results.forEach((res, i) => {
    if (res.status === 'fulfilled') group.add(res.value);
    else console.warn(`[models] could not place "${placements[i].model}":`, res.reason);
  });
  return group;
}
