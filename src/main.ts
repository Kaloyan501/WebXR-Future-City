import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import './style.css';
import { content, type Layer } from './content';
import { GRID, buildCity } from './scene/city';
import { loadPlacements, occupiedTiles } from './scene/models';
import { createPins } from './scene/pins';
import { initDomUI } from './ui/cards-dom';
import { VrUI, type VrAction } from './ui/cards-vr';
import { installEmulatorIfNeeded } from './xr/emulator';

// --- VR placement: the 24-tile plate becomes a ~1 m model on a table-height plinth ---
const VR_SCALE = 0.96 / GRID; // the plate is ~0.96 m wide, whatever GRID is
const PLINTH_HEIGHT = 0.85;
const VR_DISTANCE = 1.3;
// Right thumbstick: left/right rotates the model, up/down zooms it.
const VR_MIN_SCALE = 0.5 / GRID; // ~0.5 m wide
const VR_MAX_SCALE = 1.5 / GRID; // ~1.5 m wide
const STICK_DEADZONE = 0.15;
const ROTATE_SPEED = 1.6; // rad/s at full deflection
const ZOOM_SPEED = 0.9; // e-folds/s at full deflection

// --- Desktop isometric camera ---
const ISO_POLAR = Math.atan(Math.SQRT2); // true isometric elevation (~54.7 deg from vertical)
const VIEW_HALF_HEIGHT = GRID * 0.54;

async function main(): Promise<void> {
  // Must run before VRButton is created so it sees the emulated XR support.
  await installEmulatorIfNeeded();

  const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');

  const scene = new THREE.Scene();
  scene.background = null;
  renderer.setClearColor(0x000000, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(10, 20, 8);
  scene.add(sun);

  // Everything that belongs to the model lives in `world`, which is scaled in VR.
  const world = new THREE.Group();
  scene.add(world);
  const city = buildCity(content.scenarios[0].waterLevel, occupiedTiles(content.placements));
  const pins = createPins(content.pins);
  world.add(city.group, pins.group);
  //world.add(pins.group);
  // Models load in the background, so a slow or missing file never blocks the UI.
  void loadPlacements(content.placements).then((models) => world.add(models));

  // VR-only props: plinth, floor disc and in-scene UI.
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, PLINTH_HEIGHT, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x3a4350, roughness: 0.8 }),
  );
  plinth.position.set(0, PLINTH_HEIGHT / 2, -VR_DISTANCE);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(3, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x1a212b, roughness: 1 }),
  );
  plinth.visible = false;
  floor.visible = false;
  scene.add(plinth, floor);

  const vr = new VrUI(content);
  // Control panel floats behind the model at about eye height, so nobody has to look down for it.
  vr.toolbar.position.set(0, 1.3, -VR_DISTANCE - 0.7);
  scene.add(vr.group);

  // Desktop camera.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
  camera.position.set(40, 40, 40);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.8, 0);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minPolarAngle = controls.maxPolarAngle = ISO_POLAR;
  controls.minZoom = 0.6;
  controls.maxZoom = 3;
  controls.update();

  function resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    // Keep the whole plate visible on narrow (portrait) screens too.
    const halfH = Math.max(VIEW_HALF_HEIGHT, (GRID * 0.8) / aspect);
    camera.left = -halfH * aspect;
    camera.right = halfH * aspect;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // --- State changes (single place, so desktop UI, VR UI and pins never drift apart) ---
  let selectedId: number | null = null;

  const selectPin = (id: number | null): void => {
    selectedId = id;
    pins.setSelected(id);
    const item = id === null ? undefined : pins.byId(id);
    if (renderer.xr.isPresenting) {
      dom.showCard(null);
      if (item) vr.showCard(item.data, item.head.getWorldPosition(new THREE.Vector3()));
      else vr.hideCard();
    } else {
      vr.hideCard();
      dom.showCard(item?.data ?? null);
    }
  };

  const setLayer = (layer: Layer): void => {
    pins.setLayer(layer);
    dom.setLayer(layer);
    vr.setLayerActive(layer);
    if (selectedId !== null && !pins.byId(selectedId)?.enabled) selectPin(null);
  };

  const setScenario = (index: number): void => {
    city.setWaterLevel(content.scenarios[index].waterLevel);
    dom.setScenario(index);
    vr.setScenarioActive(index);
  };

  const dom = initDomUI(content, {
    onLayer: setLayer,
    onScenario: setScenario,
    onClose: () => selectPin(null),
  });
  setLayer('all');
  setScenario(0);

  const runVrAction = (a: VrAction): void => {
    switch (a.type) {
      case 'layer':
        setLayer(a.layer);
        break;
      case 'scenario':
        setScenario(a.index);
        break;
      case 'toggleDetails':
        vr.toggleDetails();
        break;
      case 'closeCard':
        selectPin(null);
        break;
    }
  };

  // --- Picking (shared by mouse/touch and XR controllers or hand pinch) ---
  const raycaster = new THREE.Raycaster();

  const handlePick = (): void => {
    const inVR = renderer.xr.isPresenting;
    if (inVR) {
      const ui = raycaster.intersectObjects(vr.pickables(), false)[0];
      if (ui) {
        runVrAction(ui.object.userData.action as VrAction);
        return;
      }
    }
    const hit = raycaster.intersectObjects(pins.hitMeshes(), false)[0];
    if (hit) {
      const id = hit.object.userData.pinId as number;
      selectPin(!inVR && id === selectedId ? null : id);
    } else if (!inVR) {
      selectPin(null); // click on empty space closes the card on desktop
    }
  };

  const ndc = new THREE.Vector2();
  const rayFromPointer = (e: PointerEvent): void => {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  };

  let downX = 0;
  let downY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    downX = e.clientX;
    downY = e.clientY;
  });
  canvas.addEventListener('pointerup', (e) => {
    if (renderer.xr.isPresenting) return;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return; // it was a drag (orbit)
    rayFromPointer(e);
    handlePick();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.buttons !== 0) return;
    rayFromPointer(e);
    canvas.style.cursor = raycaster.intersectObjects(pins.hitMeshes(), false).length ? 'pointer' : 'default';
  });

  // --- XR input: controllers, and hands (a pinch fires the same select event) ---
  const controllerModels = new XRControllerModelFactory();
  const handModels = new XRHandModelFactory();
  const tempMatrix = new THREE.Matrix4();

  for (let i = 0; i < 2; i++) {
    const ray = renderer.xr.getController(i);
    ray.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -3)]),
        new THREE.LineBasicMaterial({ color: 0xffffff }),
      ),
    );
    ray.addEventListener('selectstart', () => {
      tempMatrix.identity().extractRotation(ray.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(ray.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
      handlePick();
    });
    scene.add(ray);

    const grip = renderer.xr.getControllerGrip(i);
    grip.add(controllerModels.createControllerModel(grip));
    scene.add(grip);

    const hand = renderer.xr.getHand(i);
    hand.add(handModels.createHandModel(hand, 'mesh'));
    scene.add(hand);
  }

  renderer.xr.addEventListener('sessionstart', () => {
    world.rotation.y = 0;
    world.scale.setScalar(VR_SCALE);
    world.position.set(0, PLINTH_HEIGHT, -VR_DISTANCE);
    //UNCOMMENT THIS IF AR TEST BLOWS UP
    //plinth.visible = floor.visible = vr.group.visible = true;
    const ar = renderer.xr.getSession()!.environmentBlendMode !== 'opaque';
    plinth.visible = floor.visible = !ar;
    vr.group.visible = true;
    selectPin(null);
  });
  renderer.xr.addEventListener('sessionend', () => {
    world.rotation.y = 0;
    world.scale.setScalar(1);
    world.position.set(0, 0, 0);
    plinth.visible = floor.visible = vr.group.visible = false;
    selectPin(null);
    resize();
  });

  const arButton = ARButton.createButton(renderer, { optionalFeatures: ['hit-test', 'anchors', 'local-floor'] });
  arButton.style.left = 'calc(50% + 70px)';
  document.body.appendChild(arButton);
  document.body.appendChild(VRButton.createButton(renderer));

  // --- Render loop (setAnimationLoop is required for XR) ---
  const timer = new THREE.Timer();
  const camPos = new THREE.Vector3();
  const camQuat = new THREE.Quaternion();
  const pinPos = new THREE.Vector3();

  // Right thumbstick (xr-standard axes 2 and 3): rotate and zoom the table-top model.
  const applyStick = (dt: number): void => {
    const session = renderer.xr.getSession();
    if (!session) return;
    const dead = (v: number): number => (Math.abs(v) < STICK_DEADZONE ? 0 : v);
    for (const src of session.inputSources) {
      if (src.handedness !== 'right' || !src.gamepad) continue;
      const x = dead(src.gamepad.axes[2] ?? 0);
      const y = dead(src.gamepad.axes[3] ?? 0);
      world.rotation.y -= x * ROTATE_SPEED * dt;
      const s = world.scale.x * Math.exp(-y * ZOOM_SPEED * dt); // stick up is negative y
      world.scale.setScalar(THREE.MathUtils.clamp(s, VR_MIN_SCALE, VR_MAX_SCALE));
    }
  };

  renderer.setAnimationLoop((time) => {
    timer.update(time);
    const dt = Math.min(timer.getDelta(), 0.1);
    if (renderer.xr.isPresenting) {
      applyStick(dt);
      const open = selectedId === null ? undefined : pins.byId(selectedId);
      if (open) vr.moveCard(open.head.getWorldPosition(pinPos));
    } else {
      controls.update();
    }
    const viewCamera = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
    viewCamera.getWorldPosition(camPos);
    viewCamera.getWorldQuaternion(camQuat);
    city.update(dt);
    pins.billboard(camQuat);
    vr.update(camPos);
    renderer.render(scene, camera);
  });
}

main().catch((err) => console.error(err));
