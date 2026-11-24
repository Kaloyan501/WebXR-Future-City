import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { TAG_COLOR, type Layer, type Pin } from '../content';
import { groundHeight } from './city';
import { FONT_URL } from './font';

export interface PinItem {
  data: Pin;
  group: THREE.Group;
  head: THREE.Mesh;
  hit: THREE.Mesh;
  label: Text;
  material: THREE.MeshStandardMaterial;
  enabled: boolean;
}

export interface Pins {
  group: THREE.Group;
  items: PinItem[];
  byId(id: number): PinItem | undefined;
  /** Hit-test targets for pins that are currently enabled by the layer filter. */
  hitMeshes(): THREE.Mesh[];
  setLayer(layer: Layer): void;
  setSelected(id: number | null): void;
  /** Make number labels face the viewer. */
  billboard(cameraQuaternion: THREE.Quaternion): void;
}

export function createPins(pins: Pin[]): Pins {
  const group = new THREE.Group();
  group.name = 'pins';
  const parentQ = new THREE.Quaternion();

  const headGeo = new THREE.SphereGeometry(0.55, 24, 16);
  const stemGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 8);
  // Larger invisible sphere so pins are easy to hit with a controller or a pinch.
  const hitGeo = new THREE.SphereGeometry(1.1, 12, 8);
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

  const items: PinItem[] = pins.map((p) => {
    const [x, z] = p.position;
    const lift = p.lift ?? 2.4;
    const g = new THREE.Group();
    g.position.set(x, groundHeight(x, z), z);

    const c = TAG_COLOR[p.tags[0]];
    const material = new THREE.MeshStandardMaterial({
      color: c,
      emissive: c,
      emissiveIntensity: 0.25,
      roughness: 0.4,
      transparent: true,
    });

    const stem = new THREE.Mesh(stemGeo, material);
    stem.scale.y = lift;
    stem.position.y = lift / 2;

    const head = new THREE.Mesh(headGeo, material);
    head.position.y = lift + 0.4;

    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.position.copy(head.position);
    hit.userData.pinId = p.id;

    // Number above the pin, matching the numbering on the printed model.
    const label = new Text();
    label.font = FONT_URL;
    label.text = String(p.id);
    label.fontSize = 0.8;
    label.color = 0xffffff;
    label.anchorX = 'center';
    label.anchorY = 'middle';
    label.outlineWidth = 0.07;
    label.outlineColor = 0x000000;
    label.position.set(0, lift + 1.5, 0);
    label.sync();

    g.add(stem, head, hit, label);
    group.add(g);
    return { data: p, group: g, head, hit, label, material, enabled: true };
  });

  return {
    group,
    items,
    byId: (id) => items.find((it) => it.data.id === id),
    hitMeshes: () => items.filter((it) => it.enabled && it.group.visible).map((it) => it.hit),
    setLayer(layer) {
      for (const it of items) {
        it.enabled = layer === 'all' || it.data.tags.includes(layer);
        it.material.opacity = it.enabled ? 1 : 0.18;
        it.label.fillOpacity = it.enabled ? 1 : 0.2;
        it.label.outlineOpacity = it.enabled ? 1 : 0.2;
      }
    },
    setSelected(id) {
      for (const it of items) {
        const sel = it.data.id === id;
        it.head.scale.setScalar(sel ? 1.4 : 1);
        it.material.emissiveIntensity = sel ? 0.9 : 0.25;
      }
    },
    billboard(q) {
      // The model can be rotated in VR, so convert the camera rotation into each label's parent space.
      for (const it of items) {
        it.group.getWorldQuaternion(parentQ).invert();
        it.label.quaternion.copy(parentQ).multiply(q);
      }
    },
  };
}
