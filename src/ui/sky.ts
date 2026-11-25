// The live sky and landscape behind the 3D city: sky colour, sun, clouds, smog, fog, hills with
// wind turbines, a solar field, fields or houses, trees, a river and snow on the ground.
// Every setting changes something here as a ~0.8 s transition (instant with reduced motion).
// There is deliberately no city in it: the 3D model in front is the city.
import type { CityState, Store } from '../climate/state.ts';
import { createTween } from '../climate/tween.ts';
import { mixHex, visualsFor, windXOf, type VisualInput, type Visuals } from '../climate/visuals.ts';
import { createParticles } from './particles.ts';

export const TRANSITION_MS = 800;

const W = 1600;
const H = 900;
const SUN = { x: 1180, y: 150 };
const GROUND_TOP = 690;
const STRIP_TOP = 692;
const STRIP_BOTTOM = 762;
const TREE_BASE = 716;
const RIVER_MID = 838;
const TURBINES = [
  { x: 210, y: 640 },
  { x: 330, y: 628 },
  { x: 1270, y: 626 },
  { x: 1400, y: 640 },
];

/** Small seeded random generator, so the landscape looks the same on every load. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function inputOf(s: CityState): VisualInput {
  return {
    temp: s.temp,
    humidity: s.humidity,
    windSpeed: s.windSpeed,
    windX: windXOf(s.windDir),
    aqi: s.aqi,
    uv: s.uv,
    water: s.water,
    land: s.land,
    energy: s.energy,
  };
}

function cloudMarkup(rand: () => number): string {
  const parts: string[] = [];
  const n = 3 + Math.floor(rand() * 2);
  for (let i = 0; i < n; i++) {
    const rx = 40 + rand() * 40;
    parts.push(`<ellipse cx="${Math.round(i * 46 - n * 20)}" cy="${Math.round(-rand() * 22)}" rx="${Math.round(rx)}" ry="${Math.round(rx * 0.55)}"/>`);
  }
  return parts.join('');
}

function svgMarkup(): string {
  const rand = mulberry32(42);

  const houses: string[] = [];
  for (let x = 4; x < W; x += 34) {
    const h = 16 + Math.round(rand() * 10);
    houses.push(
      `<rect x="${x}" y="${STRIP_BOTTOM - h}" width="26" height="${h}" fill="#d8d0c0"/>` +
        `<polygon points="${x - 2},${STRIP_BOTTOM - h} ${x + 13},${STRIP_BOTTOM - h - 10} ${x + 28},${STRIP_BOTTOM - h}" fill="#9a6a52"/>`,
    );
  }

  const trees: string[] = [];
  for (let i = 0; i < 18; i++) {
    const x = Math.round(30 + i * 92 + rand() * 30);
    const r = Math.round(13 + rand() * 7);
    trees.push(
      `<g transform="translate(${x},${TREE_BASE})"><g class="tree">` +
        `<rect x="-2.5" y="-20" width="5" height="20" fill="#5b4632"/>` +
        `<circle cx="0" cy="${-20 - r + 4}" r="${r}" fill="#4f7a3a"/>` +
        `<circle cx="${Math.round(r * 0.45)}" cy="${-20 - r}" r="${Math.round(r * 0.7)}" fill="#5d8a44"/>` +
        `</g></g>`,
    );
  }

  const solar: string[] = [];
  for (let row = 0; row < 3; row++) {
    for (let x = 1120 + row * 8; x < 1460; x += 26) {
      const y = STRIP_TOP + 14 + row * 18;
      solar.push(`<polygon points="${x},${y + 10} ${x + 20},${y + 10} ${x + 16},${y} ${x - 4},${y}"/>`);
    }
  }

  const turbines = TURBINES.map(
    (t) =>
      `<line x1="${t.x}" y1="${t.y}" x2="${t.x}" y2="${t.y - 150}" stroke="#e9eef0" stroke-width="5"/>` +
      `<g class="rotor" data-x="${t.x}" data-y="${t.y - 150}" transform="translate(${t.x},${t.y - 150})">` +
      [0, 120, 240].map((a) => `<path d="M0 0 L-4 -10 L0 -52 L4 -10 Z" transform="rotate(${a})"/>`).join('') +
      `<circle r="5"/></g>`,
  ).join('');

  const clouds = Array.from({ length: 7 }, (_, i) => {
    const x = Math.round(i * 260 + rand() * 120);
    const y = Math.round(70 + rand() * 230);
    const s = (0.6 + rand() * 0.6).toFixed(2);
    return `<g class="cloud" data-x="${x}" data-y="${y}" data-speed="${s}" transform="translate(${x},${y})">${cloudMarkup(rand)}</g>`;
  }).join('');

  return `
<svg id="sky-scene" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
      <stop id="sky-top" offset="0"/>
      <stop id="sky-bottom" offset="0.72"/>
    </linearGradient>
    <radialGradient id="sun-glow-grad">
      <stop offset="0" stop-color="#fff6d8" stop-opacity="1"/>
      <stop offset="1" stop-color="#fff6d8" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="smog-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8c8068" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#8c8068" stop-opacity="0.8"/>
      <stop offset="1" stop-color="#7a6f59" stop-opacity="0.95"/>
    </linearGradient>
    <linearGradient id="fog-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#eef2f3" stop-opacity="0"/>
      <stop offset="0.45" stop-color="#eef2f3" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#eef2f3" stop-opacity="0.6"/>
    </linearGradient>
    <pattern id="furrows" width="28" height="12" patternUnits="userSpaceOnUse">
      <rect width="28" height="12" fill="#88ab5c"/>
      <path d="M0 10.5 H28" stroke="#6e9046" stroke-width="2"/>
    </pattern>
    <filter id="shimmer" x="-2%" y="-5%" width="104%" height="110%">
      <feTurbulence id="shimmer-noise" type="turbulence" baseFrequency="0.012 0.09" numOctaves="1" seed="7" result="noise"/>
      <feDisplacementMap id="shimmer-map" in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#sky-grad)"/>
  <circle id="sun-glow" cx="${SUN.x}" cy="${SUN.y}" r="150" fill="url(#sun-glow-grad)"/>
  <circle id="sun-disc" cx="${SUN.x}" cy="${SUN.y}" r="48" fill="#fff3c4"/>
  <g id="clouds" fill="#ffffff" fill-opacity="0.88">${clouds}</g>

  <g id="landscape">
    <path id="far-hills" d="M0 640 C 180 590, 360 600, 520 630 C 700 660, 900 600, 1100 615 C 1300 630, 1450 590, 1600 620 L1600 ${GROUND_TOP} L0 ${GROUND_TOP} Z"/>
    <path id="hill" d="M80 ${GROUND_TOP} C 200 600, 380 590, 520 ${GROUND_TOP} Z M1140 ${GROUND_TOP} C 1260 596, 1430 600, 1560 ${GROUND_TOP} Z" fill="#7f9a77"/>
    <g id="turbines" opacity="0" fill="#f3f5f6" stroke="#c7cfd4" stroke-width="1">${turbines}</g>
    <rect id="smog" x="0" y="220" width="${W}" height="520" fill="url(#smog-grad)" opacity="0"/>
    <rect id="ground" x="0" y="${GROUND_TOP}" width="${W}" height="${H - GROUND_TOP}" fill="#7a9a55"/>
    <g id="houses">${houses.join('')}</g>
    <rect id="field" x="0" y="${STRIP_TOP}" width="800" height="${STRIP_BOTTOM - STRIP_TOP + 2}" fill="url(#furrows)"/>
    <g id="solar" opacity="0" fill="#2b4a7a" stroke="#9fb6d6" stroke-width="1">${solar.join('')}</g>
  </g>
  <rect id="ground-snow" x="0" y="${GROUND_TOP}" width="${W}" height="${H - GROUND_TOP}" fill="#f4f7f9" opacity="0"/>

  <g id="trees">${trees.join('')}</g>

  <rect id="riverbed" x="0" y="${RIVER_MID - 48}" width="${W}" height="96" fill="#b9a877" opacity="0.7"/>
  <rect id="river" x="0" y="${RIVER_MID - 20}" width="${W}" height="40"/>

  <rect id="fog" x="0" y="470" width="${W}" height="${H - 470}" fill="url(#fog-grad)" opacity="0"/>
  <rect id="dust" x="0" y="0" width="${W}" height="${H}" fill="#e3d2a8" opacity="0"/>
</svg>`;
}

/**
 * Mounts the sky into `root` (behind the 3D canvas). Rain and snow go to `particleCanvas`,
 * which sits in front of the 3D city so it rains over the model too.
 */
export function mountSky(
  root: HTMLElement,
  particleCanvas: HTMLCanvasElement,
  store: Store,
  opts: { reducedMotion: boolean },
): void {
  root.innerHTML = svgMarkup();

  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const svg = $<SVGSVGElement>('#sky-scene');
  const skyTop = $<SVGStopElement>('#sky-top');
  const skyBottom = $<SVGStopElement>('#sky-bottom');
  const sunDisc = $<SVGCircleElement>('#sun-disc');
  const sunGlow = $<SVGCircleElement>('#sun-glow');
  const cloudLayer = $<SVGGElement>('#clouds');
  const farHills = $<SVGPathElement>('#far-hills');
  const smog = $<SVGRectElement>('#smog');
  const fog = $<SVGRectElement>('#fog');
  const dust = $<SVGRectElement>('#dust');
  const field = $<SVGRectElement>('#field');
  const river = $<SVGRectElement>('#river');
  const groundSnow = $<SVGRectElement>('#ground-snow');
  const landscape = $<SVGGElement>('#landscape');
  const shimmerMap = $<SVGFEDisplacementMapElement>('#shimmer-map');
  const shimmerNoise = $<SVGFETurbulenceElement>('#shimmer-noise');
  const solarGroup = $<SVGGElement>('#solar');
  const turbineGroup = $<SVGGElement>('#turbines');
  const trees = [...root.querySelectorAll<SVGGElement>('.tree')];
  const rotors = [...root.querySelectorAll<SVGGElement>('.rotor')].map((el) => ({
    el,
    x: Number(el.dataset.x),
    y: Number(el.dataset.y),
    angle: Math.random() * 120,
  }));
  const clouds = [...root.querySelectorAll<SVGGElement>('.cloud')].map((el) => ({
    el,
    x: Number(el.dataset.x),
    y: Number(el.dataset.y),
    speed: Number(el.dataset.speed),
  }));

  const particles = opts.reducedMotion ? null : createParticles(particleCanvas);
  let vis: Visuals = visualsFor(inputOf(store.get()));
  let windSpeed = store.get().windSpeed;

  const setTrees = (sway: (i: number) => number) => {
    trees.forEach((t, i) => t.setAttribute('transform', `skewX(${(-(vis.treeBendDeg + sway(i))).toFixed(2)})`));
  };

  const apply = (v: VisualInput) => {
    vis = visualsFor(v);
    windSpeed = v.windSpeed;
    skyTop.setAttribute('stop-color', vis.skyTop);
    skyBottom.setAttribute('stop-color', vis.skyBottom);
    cloudLayer.setAttribute('fill', vis.cloudColor);
    sunDisc.setAttribute('r', vis.sunRadius.toFixed(1));
    sunGlow.setAttribute('r', (vis.sunRadius * 3.2).toFixed(1));
    sunGlow.setAttribute('opacity', Math.min(1, vis.sunGlow * 1.6).toFixed(3));
    farHills.setAttribute('fill', mixHex('#8fa79a', vis.skyBottom, 0.45));
    smog.setAttribute('opacity', vis.smog.toFixed(3));
    fog.setAttribute('opacity', vis.fog.toFixed(3));
    dust.setAttribute('opacity', ((1 - vis.saturation) * 0.55).toFixed(3));
    svg.style.filter = vis.saturation < 1 ? `saturate(${vis.saturation.toFixed(3)})` : '';
    field.setAttribute('width', (vis.fieldFraction * W).toFixed(1));
    river.setAttribute('y', (RIVER_MID - vis.riverHeight / 2).toFixed(1));
    river.setAttribute('height', vis.riverHeight.toFixed(1));
    river.setAttribute('fill', vis.riverColor);
    groundSnow.setAttribute('opacity', (vis.snowRoofs * 0.8).toFixed(3));
    solarGroup.setAttribute('opacity', vis.solar.toFixed(3));
    turbineGroup.setAttribute('opacity', vis.turbines.toFixed(3));
    if (vis.shimmer > 0.02 && !opts.reducedMotion) {
      landscape.setAttribute('filter', 'url(#shimmer)');
      shimmerMap.setAttribute('scale', (vis.shimmer * 3.5).toFixed(2));
    } else {
      landscape.removeAttribute('filter');
    }
    particles?.set(vis.rain, vis.snowfall, v.windX);
    if (opts.reducedMotion) setTrees(() => 0);
  };

  const tween = createTween(inputOf(store.get()), TRANSITION_MS, apply);
  tween.snap(inputOf(store.get()));
  store.subscribe((s) => (opts.reducedMotion ? tween.snap(inputOf(s)) : tween.to(inputOf(s))));

  if (opts.reducedMotion) return;

  // One loop for everything that moves continuously: clouds, rotors, tree sway, heat shimmer.
  let last = 0;
  const loop = (t: number) => {
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    for (const c of clouds) {
      c.x += vis.cloudVx * c.speed * dt;
      if (c.x > W + 220) c.x -= W + 440;
      if (c.x < -220) c.x += W + 440;
      c.el.setAttribute('transform', `translate(${c.x.toFixed(1)},${c.y})`);
    }
    for (const r of rotors) {
      r.angle = (r.angle + vis.turbineRpm * 3 * dt) % 360;
      r.el.setAttribute('transform', `translate(${r.x},${r.y}) rotate(${r.angle.toFixed(1)})`);
    }
    const swayAmp = Math.min(1.5, windSpeed / 20);
    setTrees((i) => Math.sin(t / 600 + i * 0.9) * swayAmp);
    if (vis.shimmer > 0.02) {
      shimmerNoise.setAttribute('baseFrequency', `0.012 ${(0.08 + 0.02 * Math.sin(t / 250)).toFixed(4)}`);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
