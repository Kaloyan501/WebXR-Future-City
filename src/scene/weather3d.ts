// Climate effects on the 3D city: rain, snow, clouds, wind streaks, smog, the sun and steam from the
// power plants. The group lives inside the model's `world`, so everything scales with the plate in VR.
import * as THREE from 'three';
import { GRID } from './city';
import { CLOUD_EDGE, cloudEdgeFade, steamRate, sunGlow, windStreaks } from '../climate/scene3d.ts';

export interface WeatherTargets {
  /** 0..1 */
  rain: number;
  /** 0..1 */
  snow: number;
  /** Where the wind blows to, as a unit vector on the plate (east is +x, north is −z). */
  windX: number;
  windZ: number;
  windSpeed: number;
  /** 0..1, how many clouds. */
  cloudiness: number;
  cloudColor: string;
  /** 0..1, smog strength. */
  smog: number;
  /** 0..11 */
  uv: number;
  /** 0..100 */
  energy: number;
}

export interface Weather3D {
  group: THREE.Group;
  set(t: WeatherTargets): void;
  /** Point sizes are in pixels on the desktop (orthographic) and in metres in VR. */
  setVR(vr: boolean): void;
  update(dt: number): void;
}

const HALF = GRID / 2;
const TOP = 15;
const GROUND = 0.6; // top of the base slab
const MAX_RAIN = 1400;
const MAX_SNOW = 900;
const MAX_SMOG = 700;
const MAX_STREAKS = 80;
const CLOUDS = 5;
const STEAM_PER_PLANT = 28;
const MAX_PLANTS = 24;
const SUN_POS = new THREE.Vector3(9, 11, -14); // upper right of the desktop view, behind the model in VR

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** A soft round dot, used for snowflakes, smog and steam. */
function dotTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** The sun: a bright core with a wide warm halo, drawn additively so it glows. */
function sunTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,252,235,1)');
  grad.addColorStop(0.18, 'rgba(255,244,200,1)');
  grad.addColorStop(0.3, 'rgba(255,226,150,0.55)');
  grad.addColorStop(0.6, 'rgba(255,205,120,0.18)');
  grad.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function points(max: number, color: number, opacity: number, map: THREE.Texture, withAlpha = false) {
  const pos = new Float32Array(max * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  let colors: Float32Array | null = null;
  if (withAlpha) {
    colors = new Float32Array(max * 4);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 4).setUsage(THREE.DynamicDrawUsage));
  }
  geo.setDrawRange(0, 0);
  const mat = new THREE.PointsMaterial({
    color,
    size: 3,
    map,
    transparent: true,
    opacity,
    depthWrite: false,
    vertexColors: withAlpha,
  });
  const obj = new THREE.Points(geo, mat);
  obj.frustumCulled = false;
  return { pos, colors, geo, mat, obj };
}

export function createWeather3D(): Weather3D {
  const group = new THREE.Group();
  group.name = 'climate-weather';
  const dot = dotTexture();

  // Rain: short streaks, leaning with the wind.
  const rainPos = new Float32Array(MAX_RAIN * 6);
  const rainSpeed = new Float32Array(MAX_RAIN);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3).setUsage(THREE.DynamicDrawUsage));
  rainGeo.setDrawRange(0, 0);
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xcfdbe6, transparent: true, opacity: 0.6, depthWrite: false }));
  rain.frustumCulled = false;

  // Snow, smog and steam: soft round points.
  const snow = points(MAX_SNOW, 0xffffff, 0.95, dot);
  const snowPhase = new Float32Array(MAX_SNOW);
  const smog = points(MAX_SMOG, 0x8c8068, 0.55, dot);
  const smogPhase = new Float32Array(MAX_SMOG);
  const steam = points(MAX_PLANTS * STEAM_PER_PLANT, 0xf4f6f8, 1, dot, true);
  const steamAge = new Float32Array(MAX_PLANTS * STEAM_PER_PLANT).fill(99);
  const steamLife = new Float32Array(MAX_PLANTS * STEAM_PER_PLANT).fill(1);
  const pointSizes: [THREE.PointsMaterial, number, number][] = [
    [snow.mat, 3, 0.006],
    [smog.mat, 6, 0.012],
    [steam.mat, 9, 0.018],
  ];
  for (const [m, px] of pointSizes) m.size = px;

  // Wind streaks: thin lines racing across the city in the wind direction.
  const streakPos = new Float32Array(MAX_STREAKS * 6);
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3).setUsage(THREE.DynamicDrawUsage));
  streakGeo.setDrawRange(0, 0);
  const streaks = new THREE.LineSegments(streakGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }));
  streaks.frustumCulled = false;
  const streakAt = new Float32Array(MAX_STREAKS * 3);
  for (let i = 0; i < MAX_STREAKS; i++) streakAt.set([rand(-HALF, HALF), rand(1, 7), rand(-HALF, HALF)], i * 3);

  // Clouds: solid puffs (no see-through faces), growing in and shrinking away at the edges.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const puff = new THREE.SphereGeometry(1, 14, 10);
  const clouds: { g: THREE.Group; speed: number; amount: number }[] = [];
  for (let i = 0; i < CLOUDS; i++) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(puff, cloudMat);
      const r = rand(0.6, 1.1);
      m.scale.set(r * 1.4, r * 0.55, r);
      m.position.set(k * 0.9 - n * 0.45, rand(-0.1, 0.2), rand(-0.4, 0.4));
      g.add(m);
    }
    g.position.set(rand(-HALF, HALF), rand(13, 15), rand(-HALF, HALF));
    g.scale.setScalar(0.001);
    group.add(g);
    clouds.push({ g, speed: rand(0.7, 1.3), amount: 0 });
  }

  // Sun: grows and brightens with the UV index.
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  sun.position.copy(SUN_POS);

  group.add(rain, snow.obj, smog.obj, steam.obj, streaks, sun);

  let target: WeatherTargets = { rain: 0, snow: 0, windX: 0, windZ: 0, windSpeed: 0, cloudiness: 0, cloudColor: '#ffffff', smog: 0, uv: 5, energy: 60 };
  let rainCount = 0;
  let snowCount = 0;
  let emitters: THREE.Vector3[] = [];
  let emitterClock = 1;
  const box = new THREE.Box3();
  const tmp = new THREE.Vector3();

  const spawnRain = (i: number, anywhere: boolean) => {
    const x = rand(-HALF, HALF);
    const z = rand(-HALF, HALF);
    const y = anywhere ? rand(GROUND, TOP) : TOP;
    rainPos.set([x, y, z, x, y + 0.7, z], i * 6);
    rainSpeed[i] = rand(16, 22);
  };
  const spawnSnow = (i: number, anywhere: boolean) => {
    snow.pos.set([rand(-HALF, HALF), anywhere ? rand(GROUND, TOP) : TOP, rand(-HALF, HALF)], i * 3);
    snowPhase[i] = rand(0, Math.PI * 2);
  };
  const wrap = (arr: Float32Array, o: number) => {
    if (arr[o] > HALF) arr[o] -= GRID;
    if (arr[o] < -HALF) arr[o] += GRID;
    if (arr[o + 2] > HALF) arr[o + 2] -= GRID;
    if (arr[o + 2] < -HALF) arr[o + 2] += GRID;
  };
  for (let i = 0; i < MAX_SMOG; i++) {
    smog.pos.set([rand(-HALF, HALF), rand(0.8, 9), rand(-HALF, HALF)], i * 3);
    smogPhase[i] = rand(0, Math.PI * 2);
  }

  /** Steam rises from the top of each placed model (Kaloyan's power plants). */
  const findEmitters = () => {
    const placements = group.parent?.getObjectByName('placements');
    if (!placements || !group.parent) return;
    emitters = placements.children.slice(0, MAX_PLANTS).map((m) => {
      box.setFromObject(m);
      box.getCenter(tmp);
      tmp.y = box.max.y;
      return group.parent!.worldToLocal(tmp.clone());
    });
  };

  return {
    group,
    set(t) {
      target = t;
      cloudMat.color.set(t.cloudColor);
    },
    setVR(vr) {
      for (const [m, px, metres] of pointSizes) m.size = vr ? metres : px;
    },
    update(dt) {
      const strength = 0.4 + target.windSpeed * 0.06;
      const dx = target.windX * strength;
      const dz = target.windZ * strength;
      const step = Math.max(1, Math.ceil(800 * dt));

      // Rain and snow ease in and out, then fall with the wind.
      const wantRain = Math.round(target.rain * MAX_RAIN);
      const wantSnow = Math.round(target.snow * MAX_SNOW);
      for (let n = 0; n < step && rainCount < wantRain; n++) spawnRain(rainCount++, true);
      for (let n = 0; n < step && snowCount < wantSnow; n++) spawnSnow(snowCount++, true);
      if (rainCount > wantRain) rainCount = Math.max(wantRain, rainCount - step);
      if (snowCount > wantSnow) snowCount = Math.max(wantSnow, snowCount - step);

      for (let i = 0; i < rainCount; i++) {
        const o = i * 6;
        const fall = rainSpeed[i] * dt;
        rainPos[o] += dx * 3 * dt;
        rainPos[o + 2] += dz * 3 * dt;
        rainPos[o + 1] -= fall;
        wrap(rainPos, o);
        // The top of the streak follows the (possibly wrapped) bottom, leaning against the wind.
        rainPos[o + 3] = rainPos[o] - dx * 0.08;
        rainPos[o + 4] = rainPos[o + 1] + 0.7;
        rainPos[o + 5] = rainPos[o + 2] - dz * 0.08;
        if (rainPos[o + 1] < GROUND) spawnRain(i, false);
      }
      for (let i = 0; i < snowCount; i++) {
        const o = i * 3;
        snowPhase[i] += dt * 1.5;
        snow.pos[o] += (dx + Math.sin(snowPhase[i]) * 0.3) * dt;
        snow.pos[o + 2] += (dz + Math.cos(snowPhase[i]) * 0.3) * dt;
        snow.pos[o + 1] -= 1.6 * dt;
        wrap(snow.pos, o);
        if (snow.pos[o + 1] < GROUND) spawnSnow(i, false);
      }
      rainGeo.setDrawRange(0, rainCount * 2);
      snow.geo.setDrawRange(0, snowCount);
      rainGeo.attributes.position.needsUpdate = rainCount > 0;
      snow.geo.attributes.position.needsUpdate = snowCount > 0;

      // Smog: brown haze particles drifting slowly with the wind; more with a worse AQI.
      const smogCount = Math.round(target.smog * MAX_SMOG);
      for (let i = 0; i < smogCount; i++) {
        const o = i * 3;
        smogPhase[i] += dt * 0.4;
        smog.pos[o] += (dx * 0.3 + Math.sin(smogPhase[i]) * 0.15) * dt;
        smog.pos[o + 2] += (dz * 0.3 + Math.cos(smogPhase[i]) * 0.15) * dt;
        wrap(smog.pos, o);
      }
      smog.geo.setDrawRange(0, smogCount);
      smog.geo.attributes.position.needsUpdate = smogCount > 0;

      // Wind streaks: more and faster with stronger wind.
      const streakCount = Math.round(windStreaks(target.windSpeed, target.windX, target.windZ) * MAX_STREAKS);
      const streakSpeed = 4 + target.windSpeed * 0.25;
      for (let i = 0; i < streakCount; i++) {
        const o = i * 3;
        streakAt[o] += target.windX * streakSpeed * dt;
        streakAt[o + 2] += target.windZ * streakSpeed * dt;
        wrap(streakAt, o);
        const p = i * 6;
        streakPos.set([streakAt[o], streakAt[o + 1], streakAt[o + 2], streakAt[o] - target.windX * 1.6, streakAt[o + 1], streakAt[o + 2] - target.windZ * 1.6], p);
      }
      streakGeo.setDrawRange(0, streakCount * 2);
      streakGeo.attributes.position.needsUpdate = streakCount > 0;

      // Clouds: the count follows the humidity; each grows or shrinks instead of popping in.
      clouds.forEach((c, i) => {
        const want = i < target.cloudiness * CLOUDS ? 1 : 0;
        c.amount += Math.sign(want - c.amount) * Math.min(Math.abs(want - c.amount), dt * 0.8);
        c.g.position.x += dx * c.speed * dt;
        c.g.position.z += dz * c.speed * dt;
        if (Math.abs(c.g.position.x) > CLOUD_EDGE) c.g.position.x -= Math.sign(c.g.position.x) * 2 * CLOUD_EDGE;
        if (Math.abs(c.g.position.z) > CLOUD_EDGE) c.g.position.z -= Math.sign(c.g.position.z) * 2 * CLOUD_EDGE;
        const s = c.amount * cloudEdgeFade(c.g.position.x, c.g.position.z);
        c.g.scale.setScalar(Math.max(s, 0.001));
        c.g.visible = s > 0.01;
      });

      // Sun: size and brightness from the UV index, dimmed by smog.
      const glow = sunGlow(target.uv);
      sun.scale.setScalar(glow.scale);
      sun.material.opacity = glow.opacity * (1 - 0.5 * target.smog);

      // Steam from the power plants: more energy, more steam.
      emitterClock += dt;
      // Look every frame until the models have loaded, then once a second (models can be picked up in VR).
      if (emitterClock > 1 || emitters.length === 0) {
        emitterClock = 0;
        findEmitters();
      }
      const perPlant = Math.round(steamRate(target.energy) * STEAM_PER_PLANT);
      const colors = steam.colors!;
      let drawn = 0;
      emitters.forEach((e, k) => {
        for (let j = 0; j < STEAM_PER_PLANT; j++) {
          const i = k * STEAM_PER_PLANT + j;
          const o = i * 3;
          steamAge[i] += dt;
          if (steamAge[i] > steamLife[i]) {
            if (j >= perPlant) {
              steam.pos[o + 1] = -999;
              continue;
            }
            steamAge[i] = 0;
            steamLife[i] = rand(1.6, 3);
            steam.pos.set([e.x + rand(-0.25, 0.25), e.y, e.z + rand(-0.25, 0.25)], o);
          }
          steam.pos[o] += dx * 0.5 * dt;
          steam.pos[o + 1] += 1.1 * dt;
          steam.pos[o + 2] += dz * 0.5 * dt;
          const life = steamAge[i] / steamLife[i];
          colors.set([1, 1, 1, Math.max(0, 0.75 * (1 - life))], i * 4);
          drawn = Math.max(drawn, i + 1);
        }
      });
      steam.geo.setDrawRange(0, drawn);
      steam.geo.attributes.position.needsUpdate = drawn > 0;
      steam.geo.attributes.color.needsUpdate = drawn > 0;
    },
  };
}
