// Water on the 3D city: the sea on the +x side, whose coastline moves inland with the sea-level
// scenario, and two reservoirs that fill up or dry out with the available water. Both animate.
import * as THREE from 'three';
import { GRID } from './city';
import { coastX, lakeFill } from '../climate/water.ts';

export interface WaterSystem {
  group: THREE.Group;
  /** Sea level from Kaloyan's scenarios (0.3 today, 0.6 in 50 years, 0.95 in 100 years). */
  setSeaLevel(level: number): void;
  /** Available water, 0–100 %. */
  setAvailability(water: number): void;
  update(dt: number): void;
}

const HALF = GRID / 2;
const SLAB_TOP = 0.6;
const SEA_DEPTH = 0.22;
// Reservoirs sit off the diagonal where the placed models stand.
const LAKES = [
  { x: -7.5, z: 4.5, r: 2.4 },
  { x: -3, z: -8, r: 2 },
];

export function createWaterSystem(): WaterSystem {
  const group = new THREE.Group();
  group.name = 'climate-water';

  const waterMat = new THREE.MeshStandardMaterial({ color: 0x3a8fc7, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.88 });

  // Sea: a slab of water from the coastline to the +x edge of the plate.
  const sea = new THREE.Mesh(new THREE.BoxGeometry(1, SEA_DEPTH, GRID), waterMat);
  sea.position.y = SLAB_TOP + SEA_DEPTH / 2;
  const shore = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.03, GRID),
    new THREE.MeshStandardMaterial({ color: 0xd8c690, roughness: 0.95 }),
  );
  shore.position.y = SLAB_TOP + 0.015;

  // Reservoirs: a dry basin with water that grows and rises when there is more water.
  const lakes = LAKES.map((l) => {
    const bed = new THREE.Mesh(
      new THREE.CylinderGeometry(l.r, l.r, 0.04, 40),
      new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 1 }),
    );
    bed.position.set(l.x, SLAB_TOP + 0.02, l.z);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 40), waterMat);
    water.position.set(l.x, SLAB_TOP, l.z);
    group.add(bed, water);
    return { ...l, water };
  });

  group.add(sea, shore);

  let seaTarget = coastX(0.3);
  let seaNow = seaTarget;
  let fillTarget = lakeFill(60);
  let fillNow = fillTarget;
  let t = 0;

  const placeSea = () => {
    const width = HALF - seaNow;
    sea.scale.x = Math.max(width, 0.001);
    sea.position.x = seaNow + width / 2;
    shore.position.x = seaNow - 0.25;
  };
  const placeLakes = () => {
    for (const l of lakes) {
      const r = l.r * (0.15 + 0.85 * Math.sqrt(fillNow));
      const h = 0.02 + 0.14 * fillNow;
      l.water.scale.set(r, h, r);
      l.water.position.y = SLAB_TOP + 0.04 + h / 2 + Math.sin(t * 1.3 + l.x) * 0.006;
      l.water.visible = fillNow > 0.01;
    }
  };
  placeSea();
  placeLakes();

  return {
    group,
    setSeaLevel(level) {
      seaTarget = coastX(level);
    },
    setAvailability(water) {
      fillTarget = lakeFill(water);
    },
    update(dt) {
      t += dt;
      // The coast creeps inland or back (~2 units a second); lakes fill and drain smoothly.
      seaNow += Math.sign(seaTarget - seaNow) * Math.min(Math.abs(seaTarget - seaNow), dt * 2);
      fillNow += Math.sign(fillTarget - fillNow) * Math.min(Math.abs(fillTarget - fillNow), dt * 0.6);
      placeSea();
      sea.position.y = SLAB_TOP + SEA_DEPTH / 2 + Math.sin(t * 0.9) * 0.015;
      placeLakes();
    },
  };
}
