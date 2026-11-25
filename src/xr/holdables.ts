import * as THREE from 'three';

const HOLD_SIZE = 0.15; // metres: longest side of a model while it is in the hand
const HOLD_OFFSET = new THREE.Vector3(0, 0.05, -0.3); // model centre relative to the laser origin: floats ahead of the controller, clear of its mesh
const LASER_LENGTH = 3; // metres; matches the line drawn on each controller
const BOX_PAD = 0.01; // metres of slack around a model's bounds, so thin parts are still easy to hit
const RETURN_RATE = 14; // 1/s, exponential ease back to the tile

interface Holdable {
  root: THREE.Object3D;
  pinId?: number;
  home: { parent: THREE.Object3D; pos: THREE.Vector3; quat: THREE.Quaternion; scale: THREE.Vector3 };
  hand: number | null;
  returning: boolean;
}

export interface HoldCallbacks {
  onGrab(pinId: number | undefined, hand: number): void;
  onRelease(pinId: number | undefined, hand: number): void;
}

/** Squeeze while the controller's laser crosses a placed model to pick it up; squeeze again to drop it, and it eases back to its tile. */
export class Holdables {
  private readonly items: Holdable[] = [];
  private readonly held = new Map<number, Holdable>();
  private readonly box = new THREE.Box3();
  private readonly v = new THREE.Vector3();
  private readonly hit = new THREE.Vector3();
  private readonly ray = new THREE.Ray();
  private readonly q = new THREE.Quaternion();
  private readonly rays: THREE.Object3D[];
  private readonly cb: HoldCallbacks;

  /** `rays`: controller target-ray spaces (the laser; a held model attaches here). Filled in as controllers appear. */
  constructor(rays: THREE.Object3D[], cb: HoldCallbacks) {
    this.rays = rays;
    this.cb = cb;
  }

  add(root: THREE.Object3D, pinId?: number): void {
    this.items.push({
      root,
      pinId,
      home: { parent: root.parent!, pos: root.position.clone(), quat: root.quaternion.clone(), scale: root.scale.clone() },
      hand: null,
      returning: false,
    });
  }

  isHolding(hand: number): boolean {
    return this.held.has(hand);
  }

  /** Returns true if a model was grabbed (or this hand already holds one), so the caller can skip other squeeze actions. */
  tryGrab(hand: number): boolean {
    if (this.held.has(hand)) return true;
    const laser = this.rays[hand];
    if (!laser) return false;

    // Hit test: the laser (a ray along the controller's -Z) against each free model's bounds; nearest hit wins.
    laser.getWorldPosition(this.ray.origin);
    laser.getWorldQuaternion(this.q);
    this.ray.direction.set(0, 0, -1).applyQuaternion(this.q);

    let best: Holdable | null = null;
    let bestD = LASER_LENGTH;
    for (const it of this.items) {
      if (it.hand !== null) continue;
      this.box.setFromObject(it.root).expandByScalar(BOX_PAD);
      if (!this.ray.intersectBox(this.box, this.hit)) continue;
      const d = this.hit.distanceTo(this.ray.origin);
      if (d < bestD) {
        best = it;
        bestD = d;
      }
    }
    if (!best) {
      console.info(`[hold] hand ${hand}: laser hit nothing (${this.items.length} holdable)`);
      return false;
    }

    // attach() keeps the world transform; then size it for the hand and centre it at HOLD_OFFSET on the laser.
    const size = this.box.setFromObject(best.root).getSize(new THREE.Vector3());
    const k = HOLD_SIZE / Math.max(size.x, size.y, size.z);
    laser.attach(best.root);
    best.root.scale.multiplyScalar(k); // the laser space's world scale is 1
    best.root.quaternion.identity();
    best.root.position.set(0, 0, 0);
    laser.updateWorldMatrix(true, true);
    this.box.setFromObject(best.root);
    best.root.position.sub(laser.worldToLocal(this.box.getCenter(this.v))).add(HOLD_OFFSET);

    best.hand = hand;
    best.returning = false;
    this.held.set(hand, best);
    this.cb.onGrab(best.pinId, hand);
    return true;
  }

  release(hand: number): void {
    const it = this.held.get(hand);
    if (!it) return;
    this.held.delete(hand);
    it.hand = null;
    it.returning = true;
    it.home.parent.attach(it.root); // world pose preserved; update() eases the local pose back to the tile
    this.cb.onRelease(it.pinId, hand);
  }

  releaseAll(): void {
    for (const hand of [...this.held.keys()]) this.release(hand);
  }

  /** World position of the model currently held for this pin, if any. */
  heldPosition(pinId: number, out: THREE.Vector3): boolean {
    for (const it of this.held.values()) {
      if (it.pinId === pinId) {
        it.root.getWorldPosition(out);
        return true;
      }
    }
    return false;
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-RETURN_RATE * dt);
    for (const it of this.items) {
      if (!it.returning) continue;
      it.root.position.lerp(it.home.pos, k);
      it.root.quaternion.slerp(it.home.quat, k);
      it.root.scale.lerp(it.home.scale, k);
      if (it.root.position.distanceTo(it.home.pos) < 1e-3) {
        it.root.position.copy(it.home.pos);
        it.root.quaternion.copy(it.home.quat);
        it.root.scale.copy(it.home.scale);
        it.returning = false;
      }
    }
  }
}
