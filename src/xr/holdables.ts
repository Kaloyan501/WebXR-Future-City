import * as THREE from 'three';

const HOLD_SIZE = 0.15; // metres: longest side of a model while it is in the hand
const HOLD_OFFSET = new THREE.Vector3(0, 0.02, -0.08); // model centre relative to the grip origin
const REACH = 0.06; // metres from the grip to the model's bounding box that still counts as touching it
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

/** Squeeze next to a placed model to carry it on the controller; releasing eases it back to its tile. */
export class Holdables {
  private readonly items: Holdable[] = [];
  private readonly held = new Map<number, Holdable>();
  private readonly box = new THREE.Box3();
  private readonly v = new THREE.Vector3();

  private readonly grips: THREE.Object3D[];
  private readonly cb: HoldCallbacks;

  constructor(grips: THREE.Object3D[], cb: HoldCallbacks) {
    this.grips = grips;
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

  /** Returns true if a model was grabbed (or this hand already holds one), so the caller can skip other squeeze actions. */
  tryGrab(hand: number): boolean {
    if (this.held.has(hand)) return true;
    const grip = this.grips[hand];
    grip.getWorldPosition(this.v);

    let best: Holdable | null = null;
    let bestD = REACH;
    for (const it of this.items) {
      if (it.hand !== null) continue;
      const d = this.box.setFromObject(it.root).distanceToPoint(this.v);
      if (d < bestD) {
        best = it;
        bestD = d;
      }
    }
    if (!best) return false;

    // attach() keeps the world transform; then size it for the hand and centre it on the grip.
    const size = this.box.setFromObject(best.root).getSize(new THREE.Vector3());
    const k = HOLD_SIZE / Math.max(size.x, size.y, size.z);
    grip.attach(best.root);
    best.root.scale.multiplyScalar(k); // the grip's world scale is 1
    best.root.quaternion.identity();
    best.root.position.set(0, 0, 0);
    grip.updateWorldMatrix(true, true);
    this.box.setFromObject(best.root);
    best.root.position.sub(grip.worldToLocal(this.box.getCenter(this.v))).add(HOLD_OFFSET);

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
