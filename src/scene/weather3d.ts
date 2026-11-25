// Rain, snow and drifting clouds over the 3D city. The group lives inside the model's `world`,
// so it scales with the plate in VR as well as on the desktop.
import * as THREE from 'three';
import { GRID } from './city';

export interface WeatherTargets {
  /** 0..1 */
  rain: number;
  /** 0..1 */
  snow: number;
  /** −1..1, horizontal wind component (east is +x). */
  windX: number;
  windSpeed: number;
  /** 0..1, how many clouds. */
  cloudiness: number;
  cloudColor: string;
}

export interface Weather3D {
  group: THREE.Group;
  set(t: WeatherTargets): void;
  /** Point size is in pixels on the desktop (orthographic) and in metres in VR. */
  setVR(vr: boolean): void;
  update(dt: number): void;
}

const HALF = GRID / 2;
const TOP = 15;
const GROUND = 0.6; // top of the base slab
const MAX_RAIN = 1400;
const MAX_SNOW = 900;
const CLOUDS = 5;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function createWeather3D(): Weather3D {
  const group = new THREE.Group();
  group.name = 'climate-weather';

  // Rain: short streaks (line segments), slanted by the wind.
  const rainPos = new Float32Array(MAX_RAIN * 6);
  const rainSpeed = new Float32Array(MAX_RAIN);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3).setUsage(THREE.DynamicDrawUsage));
  rainGeo.setDrawRange(0, 0);
  const rain = new THREE.LineSegments(
    rainGeo,
    new THREE.LineBasicMaterial({ color: 0xcfdbe6, transparent: true, opacity: 0.6, depthWrite: false }),
  );
  rain.frustumCulled = false;

  // Snow: round points with a gentle sway.
  const snowPos = new Float32Array(MAX_SNOW * 3);
  const snowPhase = new Float32Array(MAX_SNOW);
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3).setUsage(THREE.DynamicDrawUsage));
  snowGeo.setDrawRange(0, 0);
  const snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: 3, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false });
  const snow = new THREE.Points(snowGeo, snowMat);
  snow.frustumCulled = false;

  // Clouds: a few puffs of spheres high above the plate.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
  const puff = new THREE.SphereGeometry(1, 12, 8);
  const clouds: { g: THREE.Group; speed: number }[] = [];
  for (let i = 0; i < CLOUDS; i++) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(puff, cloudMat);
      const r = rand(0.6, 1.1);
      m.scale.set(r * 1.4, r * 0.45, r);
      m.position.set(k * 0.9 - n * 0.45, rand(-0.1, 0.2), rand(-0.4, 0.4));
      g.add(m);
    }
    g.position.set(rand(-HALF - 4, HALF + 4), rand(13, 15), rand(-HALF + 2, HALF - 2));
    g.visible = false;
    group.add(g);
    clouds.push({ g, speed: rand(0.7, 1.3) });
  }

  group.add(rain, snow);

  let target: WeatherTargets = { rain: 0, snow: 0, windX: 0, windSpeed: 0, cloudiness: 0, cloudColor: '#ffffff' };
  let rainCount = 0;
  let snowCount = 0;

  const spawnRain = (i: number, anywhere: boolean) => {
    const x = rand(-HALF, HALF);
    const z = rand(-HALF, HALF);
    const y = anywhere ? rand(GROUND, TOP) : TOP;
    rainPos.set([x, y, z, x, y + 0.7, z], i * 6);
    rainSpeed[i] = rand(16, 22);
  };
  const spawnSnow = (i: number, anywhere: boolean) => {
    snowPos.set([rand(-HALF, HALF), anywhere ? rand(GROUND, TOP) : TOP, rand(-HALF, HALF)], i * 3);
    snowPhase[i] = rand(0, Math.PI * 2);
  };

  return {
    group,
    set(t) {
      target = t;
      cloudMat.color.set(t.cloudColor);
    },
    setVR(vr) {
      snowMat.size = vr ? 0.006 : 3;
    },
    update(dt) {
      const drift = target.windX * (0.4 + target.windSpeed * 0.06);

      // Ease the number of drops and flakes towards the target, so showers start and stop gradually.
      const wantRain = Math.round(target.rain * MAX_RAIN);
      const wantSnow = Math.round(target.snow * MAX_SNOW);
      const step = Math.max(1, Math.ceil(800 * dt));
      for (let n = 0; n < step && rainCount < wantRain; n++) spawnRain(rainCount++, true);
      for (let n = 0; n < step && snowCount < wantSnow; n++) spawnSnow(snowCount++, true);
      if (rainCount > wantRain) rainCount = Math.max(wantRain, rainCount - step);
      if (snowCount > wantSnow) snowCount = Math.max(wantSnow, snowCount - step);

      for (let i = 0; i < rainCount; i++) {
        const o = i * 6;
        const dy = rainSpeed[i] * dt;
        const dx = drift * 3 * dt;
        rainPos[o + 1] -= dy;
        rainPos[o + 4] -= dy;
        rainPos[o] += dx;
        if (rainPos[o] > HALF) rainPos[o] -= GRID;
        if (rainPos[o] < -HALF) rainPos[o] += GRID;
        // The top of the streak follows the (possibly wrapped) bottom, leaning against the wind.
        rainPos[o + 3] = rainPos[o] - drift * 0.08;
        rainPos[o + 5] = rainPos[o + 2];
        if (rainPos[o + 1] < GROUND) spawnRain(i, false);
      }
      for (let i = 0; i < snowCount; i++) {
        const o = i * 3;
        snowPhase[i] += dt * 1.5;
        snowPos[o] += (drift + Math.sin(snowPhase[i]) * 0.3) * dt;
        snowPos[o + 1] -= 1.6 * dt;
        if (snowPos[o + 1] < GROUND) spawnSnow(i, false);
        if (snowPos[o] > HALF) snowPos[o] -= GRID;
        if (snowPos[o] < -HALF) snowPos[o] += GRID;
      }
      rainGeo.setDrawRange(0, rainCount * 2);
      snowGeo.setDrawRange(0, snowCount);
      rainGeo.attributes.position.needsUpdate = rainCount > 0;
      snowGeo.attributes.position.needsUpdate = snowCount > 0;

      const shown = Math.round(target.cloudiness * CLOUDS);
      clouds.forEach((c, i) => {
        c.g.visible = i < shown;
        if (!c.g.visible) return;
        c.g.position.x += drift * c.speed * dt;
        if (c.g.position.x > HALF + 6) c.g.position.x -= GRID + 12;
        if (c.g.position.x < -HALF - 6) c.g.position.x += GRID + 12;
      });
    },
  };
}
