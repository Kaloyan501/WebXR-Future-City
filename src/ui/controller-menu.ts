import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { FONT_URL } from '../scene/font';

const MENU_OFFSET = new THREE.Vector3(0, 0.17, -0.2);

/** Small Troika HUD attached to the target-ray space of the controller that opened it. */
export class ControllerMenu {
  readonly group = new THREE.Group();

  /** `content` replaces the EXAMPLE placeholder; the background is sized to it. */
  constructor(content?: { object: THREE.Object3D; width: number; height: number }) {
    this.group.name = 'controller-menu';
    this.group.visible = false;

    const background = new THREE.Mesh(
      new THREE.PlaneGeometry(content?.width ?? 0.2, content?.height ?? 0.09),
      new THREE.MeshBasicMaterial({
        color: 0x141a22,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );

    if (content) {
      this.group.add(background, content.object);
      return;
    }

    const label = new Text();
    label.font = FONT_URL;
    label.text = 'EXAMPLE';
    label.fontSize = 0.04;
    label.color = 0xffffff;
    label.anchorX = 'center';
    label.anchorY = 'middle';
    label.position.z = 0.002;
    label.sync();

    this.group.add(background, label);
  }

  /** Toggle the menu in front of the controller, keeping it parented to that controller. */
  toggle(controllerRay: THREE.Object3D): void {
    if (this.group.visible) {
      this.hide();
      return;
    }

    controllerRay.add(this.group);
    this.group.position.copy(MENU_OFFSET);
    this.group.quaternion.identity();
    this.group.scale.setScalar(1);
    this.group.visible = true;
  }

  hide(): void {
    this.group.visible = false;
    this.group.removeFromParent();
  }
}
