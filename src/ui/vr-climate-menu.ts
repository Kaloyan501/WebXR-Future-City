// Climate panel for the VR controller menu (DOM is not visible inside a headset):
// switch between the five scenarios and read the key values on the hand.
// Point at it with the other controller and press the trigger.
import * as THREE from 'three';
import type { Text } from 'troika-three-text';
import type { Store } from '../climate/state.ts';
import { applyScenario, nextScenarioId, type Scenario } from '../climate/scenarios.ts';
import { formatSetting } from '../climate/levels.ts';
import { lifespan } from '../climate/health.ts';
import { makeText } from './cards-vr';

export const PANEL_W = 0.28;
export const PANEL_H = 0.17;

const BTN = 0x1f4d3a;

export class ClimateVrMenu {
  readonly panel = new THREE.Group();
  private readonly buttons: THREE.Mesh[] = [];
  private readonly name: Text;
  private readonly lines: Text[];
  private readonly store: Store;
  private readonly scenarios: Scenario[];

  constructor(store: Store, scenarios: Scenario[]) {
    this.store = store;
    this.scenarios = scenarios;
    this.panel.name = 'climate-vr-menu';
    const left = -PANEL_W / 2 + 0.012;
    const top = PANEL_H / 2 - 0.01;

    const title = makeText('Климат · Град 2100', 0.012, 0x9fc5b2, { anchorX: 'left', anchorY: 'top' });
    title.position.set(left, top, 0.002);

    const ids = scenarios.map((s) => s.id);
    const prev = this.button('‹', -PANEL_W / 2 + 0.028, top - 0.04, () => {
      const i = ids.indexOf(this.store.get().scenarioId);
      this.load(ids[(i - 1 + ids.length) % ids.length]);
    });
    const next = this.button('›', PANEL_W / 2 - 0.028, top - 0.04, () => this.load(nextScenarioId(ids, this.store.get().scenarioId)));
    this.name = makeText('', 0.015, 0xffffff, { anchorX: 'center', anchorY: 'middle', maxWidth: PANEL_W - 0.09 });
    this.name.position.set(0, top - 0.04, 0.002);

    this.lines = [0, 1, 2, 3].map((i) => {
      const t = makeText('', 0.012, 0xe8ecf2, { anchorX: 'left', anchorY: 'top' });
      t.position.set(left, top - 0.068 - i * 0.022, 0.002);
      return t;
    });

    this.panel.add(title, prev, next, this.name, ...this.lines);
    store.subscribe(() => this.refresh());
  }

  /** The buttons, but only while the menu is actually shown. */
  pickables(): THREE.Object3D[] {
    for (let o: THREE.Object3D | null = this.panel; o; o = o.parent) if (!o.visible) return [];
    return this.panel.parent ? this.buttons : [];
  }

  /** Runs the button the controller ray hit. */
  press(object: THREE.Object3D): void {
    const run = object.userData.climateAction as (() => void) | undefined;
    run?.();
  }

  private load(id: string): void {
    const sc = this.scenarios.find((s) => s.id === id);
    if (sc) this.store.set(applyScenario(sc));
  }

  private button(label: string, x: number, y: number, run: () => void): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.036, 0.032), new THREE.MeshBasicMaterial({ color: BTN }));
    mesh.position.set(x, y, 0.001);
    mesh.userData.climateAction = run;
    const text = makeText(label, 0.024, 0xffffff, { anchorX: 'center', anchorY: 'middle' });
    text.position.z = 0.002;
    mesh.add(text);
    this.buttons.push(mesh);
    return mesh;
  }

  private refresh(): void {
    const s = this.store.get();
    const sc = this.scenarios.find((x) => x.id === s.scenarioId);
    this.name.text = sc?.name ?? 'Град 2100';
    const texts = [
      `Температура: ${formatSetting('temp', s)}`,
      `Вода: ${formatSetting('water', s)}`,
      `Въздух (AQI): ${formatSetting('aqi', s)}`,
      `Живот: ${String(lifespan(s).years).replace('.', ',')} години`,
    ];
    this.lines.forEach((t, i) => (t.text = texts[i]));
    for (const t of [this.name, ...this.lines]) t.sync();
  }
}
