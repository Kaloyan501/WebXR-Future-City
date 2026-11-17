import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { TAG_COLOR, TAG_LABEL, type Content, type Layer, type Pin } from '../content';
import { FONT_URL } from '../scene/font';

export type VrAction =
  | { type: 'layer'; layer: Layer }
  | { type: 'scenario'; index: number }
  | { type: 'toggleDetails' }
  | { type: 'closeCard' };

interface VrButton {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
}

const BTN_IDLE = 0x2a313c;
const BTN_ACTIVE = 0x3b6ea8;

function makeText(
  str: string,
  size: number,
  color: number,
  opts: { maxWidth?: number; anchorX?: 'left' | 'center' | 'right'; anchorY?: 'top' | 'middle' } = {},
): Text {
  const t = new Text();
  t.font = FONT_URL;
  t.text = str;
  t.fontSize = size;
  t.color = color;
  t.anchorX = opts.anchorX ?? 'left';
  t.anchorY = opts.anchorY ?? 'top';
  if (opts.maxWidth) t.maxWidth = opts.maxWidth;
  t.lineHeight = 1.3;
  t.sync();
  return t;
}

/**
 * In-scene UI for immersive mode (DOM overlays are not shown inside a VR session):
 * a toolbar for layers and scenarios, and a floating info card for the selected pin.
 * Sizes here are in metres.
 */
export class VrUI {
  readonly group = new THREE.Group();

  /** Upright control panel; main.ts positions it. (The group itself stays at the origin so the card can use world coordinates.) */
  readonly toolbar = new THREE.Group();
  private readonly layerButtons = new Map<Layer, VrButton>();
  private readonly scenarioButtons: VrButton[] = [];

  private readonly card = new THREE.Group();
  private readonly cardBg: THREE.Mesh;
  private readonly cardClose: THREE.Mesh;
  private readonly cardTags: Text;
  private readonly cardTitle: Text;
  private readonly cardBody: Text;
  private readonly cardHint: Text;
  private pin: Pin | null = null;
  private showingDetails = false;

  constructor(content: Content) {
    this.group.visible = false;

    // Upright panel, scaled up because it floats behind the model at roughly eye height.
    this.toolbar.scale.setScalar(1.5);
    this.group.add(this.toolbar);

    const layers: [string, Layer][] = [
      ['All', 'all'],
      ['Geography', 'geo'],
      ['Biology', 'bio'],
    ];
    layers.forEach(([label, layer], i) => {
      const b = this.makeButton(label, { type: 'layer', layer }, (i - 1) * 0.15, 0.03);
      this.layerButtons.set(layer, b);
    });
    content.scenarios.forEach((s, i) => {
      const x = (i - (content.scenarios.length - 1) / 2) * 0.15;
      this.scenarioButtons.push(this.makeButton(s.label, { type: 'scenario', index: i }, x, -0.03));
    });

    // Info card.
    this.cardBg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.56, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x141a22, transparent: true, opacity: 0.94 }),
    );
    this.cardBg.userData.action = { type: 'toggleDetails' } satisfies VrAction;
    this.card.add(this.cardBg);

    this.cardClose = new THREE.Mesh(
      new THREE.PlaneGeometry(0.05, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x3a2a2a }),
    );
    this.cardClose.position.set(0.25, 0.17, 0.003);
    this.cardClose.userData.action = { type: 'closeCard' } satisfies VrAction;
    const x = makeText('X', 0.026, 0xffffff, { anchorX: 'center', anchorY: 'middle' });
    x.position.z = 0.002;
    this.cardClose.add(x);
    this.card.add(this.cardClose);

    this.cardTags = makeText('', 0.016, 0xe8a33d, { maxWidth: 0.44 });
    this.cardTags.position.set(-0.26, 0.175, 0.003);
    this.cardTitle = makeText('', 0.027, 0xffffff, { maxWidth: 0.44 });
    this.cardTitle.position.set(-0.26, 0.15, 0.003);
    this.cardBody = makeText('', 0.0185, 0xd0d6e0, { maxWidth: 0.52 });
    this.cardBody.position.set(-0.26, 0.085, 0.003);
    this.cardHint = makeText('', 0.014, 0x7f8a9b, { maxWidth: 0.52 });
    this.cardHint.position.set(-0.26, -0.175, 0.003);
    this.card.add(this.cardTags, this.cardTitle, this.cardBody, this.cardHint);

    this.card.visible = false;
    this.group.add(this.card);
  }

  private makeButton(label: string, action: VrAction, x: number, y: number): VrButton {
    const material = new THREE.MeshBasicMaterial({ color: BTN_IDLE });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.05), material);
    mesh.position.set(x, y, 0);
    mesh.userData.action = action;
    const text = makeText(label, 0.017, 0xffffff, { anchorX: 'center', anchorY: 'middle' });
    text.position.z = 0.002;
    mesh.add(text);
    this.toolbar.add(mesh);
    return { mesh, material };
  }

  /** Everything the controller ray can currently hit in the UI. */
  pickables(): THREE.Object3D[] {
    const list: THREE.Object3D[] = [
      ...[...this.layerButtons.values()].map((b) => b.mesh),
      ...this.scenarioButtons.map((b) => b.mesh),
    ];
    if (this.card.visible) list.push(this.cardBg, this.cardClose);
    return list;
  }

  setLayerActive(layer: Layer): void {
    for (const [l, b] of this.layerButtons) b.material.color.setHex(l === layer ? BTN_ACTIVE : BTN_IDLE);
  }

  setScenarioActive(index: number): void {
    this.scenarioButtons.forEach((b, i) => b.material.color.setHex(i === index ? BTN_ACTIVE : BTN_IDLE));
  }

  showCard(pin: Pin, worldPos: THREE.Vector3): void {
    this.pin = pin;
    this.showingDetails = false;
    this.refreshCard();
    this.moveCard(worldPos);
    this.card.visible = true;
  }

  /** Float the card 30 cm above a pin. Called every frame because the model can be rotated or scaled while a card is open. */
  moveCard(worldPos: THREE.Vector3): void {
    this.card.position.copy(worldPos).add(new THREE.Vector3(0, 0.3, 0));
  }

  hideCard(): void {
    this.pin = null;
    this.card.visible = false;
  }

  toggleDetails(): void {
    this.showingDetails = !this.showingDetails;
    this.refreshCard();
  }

  private refreshCard(): void {
    const pin = this.pin;
    if (!pin) return;
    this.cardTags.text = pin.tags.map((t) => TAG_LABEL[t]).join('  /  ');
    this.cardTags.color = TAG_COLOR[pin.tags[0]];
    this.cardTitle.text = `${pin.id}. ${pin.title}`;
    this.cardBody.text = this.showingDetails ? pin.details : pin.summary;
    this.cardHint.text = this.showingDetails ? 'Point at the card and select to go back' : 'Point at the card and select for more';
    for (const t of [this.cardTags, this.cardTitle, this.cardBody, this.cardHint]) t.sync();
    // Body starts below the title; two-line titles need a bit more room.
    this.cardBody.position.y = pin.title.length > 26 ? 0.075 : 0.105;
  }

  update(cameraWorldPosition: THREE.Vector3): void {
    if (this.card.visible) this.card.lookAt(cameraWorldPosition);
  }
}
