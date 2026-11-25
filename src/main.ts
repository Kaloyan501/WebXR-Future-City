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
import { ControllerMenu } from './ui/controller-menu';
import { installEmulatorIfNeeded } from './xr/emulator';
import { Holdables } from './xr/holdables';

// --- VR placement: the 24-tile plate becomes a ~1 m model on a table-height plinth ---
const VR_SCALE = 0.96 / GRID; // the plate is ~0.96 m wide, whatever GRID is
const PLINTH_HEIGHT = 0.85;
const VR_DISTANCE = 1.3;
const TOOLBAR_BEHIND = 0.7; // metres the toolbar sits behind the plinth centre
const MOVE_SPEED = 1.0; // m/s at full left-stick deflection
const HELD_CARD_DISTANCE = 0.3; // metres the info card sits beyond a model held in the hand, measured away from the head
const GRAB_RADIUS = 1.0; // metres from the plinth centre within which a grip squeeze picks it up
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
  world.add(city.group);
  //world.add(pins.group);
  // Models load in the background, so a slow or missing file never blocks the UI.
  const placed = loadPlacements(content.placements).then((models) => {
    world.add(models);
    return models;
  });

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
  const controllerMenu = new ControllerMenu();
  let menuButtonWasPressed = false;
  let menuLogged = false;
  // Control panel floats behind the model at about eye height, so nobody has to look down for it.
  vr.toolbar.position.set(0, 1.3, -VR_DISTANCE - 0.7);
  scene.add(vr.group);

  // Movable stage: plinth, model and toolbar share one horizontal offset (grip-drag in XR).
  const stageOffset = new THREE.Vector3();
  let stageYaw = 0; // plinth + toolbar heading (left controller X/Y); the plate rides on the plinth
  let plateYaw = 0; // extra plate-only turn relative to the plinth (right stick)
  const applyStage = (): void => {
    plinth.position.set(stageOffset.x, PLINTH_HEIGHT / 2, -VR_DISTANCE + stageOffset.z);
    world.position.set(stageOffset.x, PLINTH_HEIGHT, -VR_DISTANCE + stageOffset.z);
    world.rotation.y = stageYaw + plateYaw;
    const yaw = stageYaw;
    plinth.rotation.y = yaw;
    // The toolbar orbits the plinth centre and keeps facing out from the same side of it.
    vr.toolbar.position.set(
      stageOffset.x - TOOLBAR_BEHIND * Math.sin(yaw),
      1.3,
      -VR_DISTANCE + stageOffset.z - TOOLBAR_BEHIND * Math.cos(yaw),
    );
    vr.toolbar.rotation.y = yaw;
  };

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
  let dragRay: THREE.Object3D | null = null; // controller currently carrying the stage
  const rays: THREE.Object3D[] = [];

  // Squeeze with the laser on a placed model to pick it up, squeeze again to drop it. While held, its pin orb is hidden and the pin's card floats beyond it.
  const holdables = new Holdables(rays, {
    onGrab: (pinId) => {
      const item = pinId === undefined ? undefined : pins.byId(pinId);
      if (!item) return;
      item.group.visible = false;
      selectPin(pinId!);
    },
    onRelease: (pinId) => {
      const item = pinId === undefined ? undefined : pins.byId(pinId);
      if (!item) return;
      item.group.visible = true;
      if (selectedId === pinId) selectPin(null);
    },
  });
  void placed.then((models) => {
    for (const m of models.children) if (m.userData.holdable) holdables.add(m, m.userData.pinId as number | undefined);
  });
  const rayPos = new THREE.Vector3();
  const dragStart = new THREE.Vector3();
  const dragStartOffset = new THREE.Vector3();

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
    // Squeeze (grip) near the plinth to pick it up; it follows the controller on the floor plane.
    ray.addEventListener('squeezestart', () => {
      if (holdables.isHolding(i)) {
        holdables.release(i); // second squeeze drops it
        return;
      }
      if (holdables.tryGrab(i)) return; // a model under the laser wins over dragging the plinth
      ray.getWorldPosition(rayPos);
      if (Math.hypot(rayPos.x - plinth.position.x, rayPos.z - plinth.position.z) > GRAB_RADIUS) return;
      dragRay = ray;
      dragStart.copy(rayPos);
      dragStartOffset.copy(stageOffset);
    });
    ray.addEventListener('squeezeend', () => {
      if (dragRay === ray) dragRay = null;
    });
    ray.addEventListener('connected', (e) => {
      ray.userData.inputSource = (e as unknown as { data: XRInputSource }).data;
    });
    ray.addEventListener('disconnected', () => {
      ray.userData.inputSource = undefined;
    });
    scene.add(ray);
    rays.push(ray);

    const grip = renderer.xr.getControllerGrip(i);
    grip.add(controllerModels.createControllerModel(grip));
    scene.add(grip);

    const hand = renderer.xr.getHand(i);
    hand.add(handModels.createHandModel(hand, 'mesh'));
    scene.add(hand);
  }

  renderer.xr.addEventListener('sessionstart', () => {
    controllerMenu.hide();
    menuButtonWasPressed = false;
    stageYaw = plateYaw = 0;
    world.scale.setScalar(VR_SCALE);
  stageOffset.set(0, 0, 0);
  applyStage();
    const ar = renderer.xr.getSession()!.environmentBlendMode !== 'opaque';
    plinth.visible = true;
    floor.visible = !ar;
    vr.group.visible = true;
    selectPin(null);

  
    const base = renderer.xr.getReferenceSpace() as XRReferenceSpace | null;
    if (base) renderer.xr.setReferenceSpace(base.getOffsetReferenceSpace(new XRRigidTransform({ x: 0, y: -1.6, z: 0 })));
  });
  renderer.xr.addEventListener('sessionend', () => {
    xrLogged = false;
    xrFrames = 0;
    dragRay = null;
    holdables.releaseAll();
    controllerMenu.hide();
    menuButtonWasPressed = false;
    stageYaw = plateYaw = 0;
    world.rotation.y = 0;
    world.scale.setScalar(1);
    world.position.set(0, 0, 0);
    plinth.visible = floor.visible = vr.group.visible = false;
    plinth.rotation.y = 0;
    selectPin(null);
    resize();
  });

  const arButton = ARButton.createButton(renderer, { optionalFeatures: ['hit-test', 'anchors', 'local-floor'] });
  const vrButton = VRButton.createButton(renderer);
  // three.js restyles its buttons asynchronously (after isSessionSupported resolves), which
  // overwrites inline `left`. Lay them out with a flex container and static positioning instead.
  const xrBar = document.createElement('div');
  xrBar.id = 'xr-bar';
  xrBar.style.cssText =
    'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);display:flex;gap:12px;z-index:999';
  for (const b of [vrButton, arButton]) {
    b.style.setProperty('position', 'static', 'important');
    b.style.setProperty('left', 'auto', 'important');
    xrBar.appendChild(b);
  }
  document.body.appendChild(xrBar);

  // --- Render loop (setAnimationLoop is required for XR) ---
  const timer = new THREE.Timer();
  const camPos = new THREE.Vector3();
  const camQuat = new THREE.Quaternion();
  const pinPos = new THREE.Vector3();
  const cardDir = new THREE.Vector3();
  let xrLogged = false;
  let xrFrames = 0;

  // Right thumbstick (xr-standard axes 2 and 3): rotate and zoom the table-top model.
  const applyStick = (dt: number): void => {
    const session = renderer.xr.getSession();
    if (!session) return;
    const dead = (v: number): number => (Math.abs(v) < STICK_DEADZONE ? 0 : v);
    for (const src of session.inputSources) {
      if (src.handedness !== 'right' || !src.gamepad) continue;
      const x = dead(src.gamepad.axes[2] ?? 0);
      const y = dead(src.gamepad.axes[3] ?? 0);
      plateYaw -= x * ROTATE_SPEED * dt;
      const s = world.scale.x * Math.exp(-y * ZOOM_SPEED * dt); // stick up is negative y
      world.scale.setScalar(THREE.MathUtils.clamp(s, VR_MIN_SCALE, VR_MAX_SCALE));
    }
  };

  // Left controller: thumbstick moves the stage relative to where you are looking; Y turns it left, X turns it right.
  const moveDir = new THREE.Vector3();
  const applyLeft = (dt: number): void => {
    const session = renderer.xr.getSession();
    if (!session) return;
    const dead = (v: number): number => (Math.abs(v) < STICK_DEADZONE ? 0 : v);
    let leftControllerFound = false;
    for (const src of session.inputSources) {
      if (src.handedness !== 'left' || !src.gamepad) continue;
      leftControllerFound = true;
      const x = dead(src.gamepad.axes[2] ?? 0);
      const y = dead(src.gamepad.axes[3] ?? 0);
      if (x !== 0 || y !== 0) {
        // Forward = the head's facing direction flattened onto the floor; stick up is negative y.
        moveDir.set(0, 0, -1).applyQuaternion(camQuat);
        moveDir.y = 0;
        if (moveDir.lengthSq() > 1e-6) {
          moveDir.normalize();
          stageOffset.x += (-moveDir.z * x - moveDir.x * y) * MOVE_SPEED * dt;
          stageOffset.z += (moveDir.x * x - moveDir.z * y) * MOVE_SPEED * dt;
        }
      }
      // xr-standard buttons: 4 = X, 5 = Y on the left Touch controller.
      if (src.gamepad.buttons[5]?.pressed) stageYaw += ROTATE_SPEED * dt;
      if (src.gamepad.buttons[4]?.pressed) stageYaw -= ROTATE_SPEED * dt;

      // xr-standard layout of the Touch controllers: buttons[7] is the left Menu (hamburger) button, buttons[3] the
      // thumbstick click. Quest's system may keep the Menu press for itself and never report it to the page, so the
      // thumbstick click toggles the menu too.
      if (!menuLogged) {
        menuLogged = true;
        console.info(`[menu] left controller profiles=${src.profiles.join(',')} buttons=${src.gamepad.buttons.length}`);
      }
      const menuPressed = (src.gamepad.buttons[7]?.pressed ?? false) || (src.gamepad.buttons[3]?.pressed ?? false);
      if (menuPressed && !menuButtonWasPressed) {
        const controllerRay = rays.find((r) => r.userData.inputSource === src);
        console.info(`[menu] toggle (ray ${controllerRay ? 'found' : 'MISSING'})`);
        if (controllerRay) controllerMenu.toggle(controllerRay);
      }
      menuButtonWasPressed = menuPressed;
    }
    if (!leftControllerFound) menuButtonWasPressed = false;
  };

  renderer.setAnimationLoop((time) => {
    timer.update(time);
    const dt = Math.min(timer.getDelta(), 0.1);
    if (renderer.xr.isPresenting) {
      if (dragRay) {
        dragRay.getWorldPosition(rayPos);
        stageOffset.set(dragStartOffset.x + rayPos.x - dragStart.x, 0, dragStartOffset.z + rayPos.z - dragStart.z);
        applyStage();
      }
      applyStick(dt);
      applyLeft(dt);
      applyStage(); // after all input, so the plinth rotation and offsets are applied every frame
      const open = selectedId === null ? undefined : pins.byId(selectedId);
      if (open) {
        if (holdables.heldPosition(open.data.id, pinPos)) {
          // Keep the card out of the user's face: push it past the model, away from the head.
          pinPos.addScaledVector(cardDir.subVectors(pinPos, camPos).normalize(), HELD_CARD_DISTANCE);
        } else {
          open.head.getWorldPosition(pinPos);
        }
        vr.moveCard(pinPos);
      }
    } else {
      controls.update();
    }
    const viewCamera = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
    viewCamera.getWorldPosition(camPos);
    viewCamera.getWorldQuaternion(camQuat);
    // The XR camera pose only updates after the first render, so wait a few frames before reading it.
    if (renderer.xr.isPresenting && !xrLogged && ++xrFrames > 30) {
      xrLogged = true;
      console.info('[xr] head y:', camPos.y.toFixed(2), 'plate y:', world.position.y.toFixed(2), 'plinth:', plinth.visible);
    }
    holdables.update(dt);
    city.update(dt);
    pins.billboard(camQuat);
    vr.update(camPos);
    renderer.render(scene, camera);
  });
}

main().catch((err) => console.error(err));
