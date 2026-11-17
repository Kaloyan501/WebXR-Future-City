import * as THREE from 'three';

/** Plate is GRID x GRID tiles, 1 unit per tile, centred on the origin. */
export const GRID = 24;
const HALF = GRID / 2;

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Placeholder terrain: high inland plateau (west) falling steeply into the sea (east). */
export function terrainHeight(x: number, z: number): number {
  const inland = 2.0 - 0.047 * (x + HALF); // x=-12 -> 2.0, x=5 -> 1.2
  const coast = 1.2 - 0.214 * (x - 5); // x=5 -> 1.2, x=12 -> -0.3
  const wobble = 0.1 * Math.sin(z * 0.7) * Math.cos(x * 0.5);
  return Math.max((x < 5 ? inland : coast) + wobble, 0.05);
}

/** Height pins and buildings stand on (never below the "today" shoreline). */
export function groundHeight(x: number, z: number): number {
  return Math.max(terrainHeight(x, z), 0.35);
}

export interface City {
  group: THREE.Group;
  setWaterLevel(level: number, instant?: boolean): void;
  update(dt: number): void;
}

export function buildCity(initialWaterLevel: number): City {
  const group = new THREE.Group();
  group.name = 'city';
  const rng = mulberry32(2126);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // Base slab under the whole plate.
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(GRID + 0.6, 0.6, GRID + 0.6),
    new THREE.MeshStandardMaterial({ color: 0x2b323c, roughness: 0.9 }),
  );
  slab.position.y = -0.3;
  group.add(slab);

  // Terrain tiles (also roads).
  const tiles = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }),
    GRID * GRID,
  );
  const buildingSpots: { x: number; z: number; h: number }[] = [];
  const treeSpots: { x: number; z: number; h: number }[] = [];

  let n = 0;
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const x = i - HALF + 0.5;
      const z = j - HALF + 0.5;
      const h = terrainHeight(x, z);
      const isLand = h > 0.4;
      const isRoad = isLand && (i % 4 === 0 || j % 4 === 0);

      dummy.position.set(x, h / 2, z);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      tiles.setMatrixAt(n, dummy.matrix);

      if (isRoad) color.setHex(0x4a4f57);
      else if (h > 1.3) color.setHex(0x7aa860);
      else if (h > 0.75) color.setHex(0x8fb36a);
      else if (h > 0.4) color.setHex(0xd8c690);
      else color.setHex(0xb59f6e);
      tiles.setColorAt(n, color);
      n++;

      if (isLand && !isRoad) {
        const r = rng();
        if (r < 0.55) buildingSpots.push({ x, z, h });
        else if (r < 0.8) treeSpots.push({ x, z, h });
      }
    }
  }
  tiles.instanceColor!.needsUpdate = true;
  group.add(tiles);

  // Buildings: taller toward the middle of the plate.
  const palette = [0xe6e2d8, 0xd5d9de, 0xc9b8a6, 0xf0ece4, 0xb8c4cf];
  const buildings = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
    buildingSpots.length,
  );
  buildingSpots.forEach((s, k) => {
    const centre = 1 - Math.min(Math.hypot(s.x, s.z) / HALF, 1);
    const bh = 0.3 + rng() * 0.5 + centre * 0.9;
    const w = 0.55 + rng() * 0.25;
    dummy.position.set(s.x, s.h + bh / 2, s.z);
    dummy.scale.set(w, bh, w);
    dummy.updateMatrix();
    buildings.setMatrixAt(k, dummy.matrix);
    buildings.setColorAt(k, color.setHex(palette[Math.floor(rng() * palette.length)]));
  });
  buildings.instanceColor!.needsUpdate = true;
  group.add(buildings);

  // Trees: simple cones.
  const trees = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.28, 0.7, 7),
    new THREE.MeshStandardMaterial({ color: 0x3f7d4a, roughness: 0.9 }),
    treeSpots.length,
  );
  treeSpots.forEach((s, k) => {
    const sc = 0.8 + rng() * 0.6;
    dummy.position.set(s.x + (rng() - 0.5) * 0.3, s.h + 0.35 * sc, s.z + (rng() - 0.5) * 0.3);
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix();
    trees.setMatrixAt(k, dummy.matrix);
  });
  group.add(trees);

  // Water plane; its height is driven by the scenario slider.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(GRID, GRID).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0x3a8fc7,
      transparent: true,
      opacity: 0.55,
      roughness: 0.2,
      depthWrite: false,
    }),
  );
  water.renderOrder = 5;
  water.position.y = initialWaterLevel;
  group.add(water);

  let target = initialWaterLevel;

  return {
    group,
    setWaterLevel(level, instant = false) {
      target = level;
      if (instant) water.position.y = level;
    },
    update(dt) {
      // Ease towards the target level (about one second to settle).
      water.position.y += (target - water.position.y) * Math.min(dt * 4, 1);
    },
  };
}
