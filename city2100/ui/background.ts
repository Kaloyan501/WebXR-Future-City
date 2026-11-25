// The live sky-and-city scene behind the whole page. Every setting changes something here,
// always as a ~0.8 s transition (instant when the viewer prefers reduced motion).
import type { CityState, Store } from '../core/state.ts';
import { createTween } from '../core/tween.ts';
import { mixHex, visualsFor, windXOf, type VisualInput, type Visuals } from '../core/visuals.ts';
import { createParticles } from './particles.ts';
import { FAR_BASE, NEAR_BASE, SCENE_H, SCENE_W, generateSkyline, mulberry32, type Building } from './skyline.ts';

export const TRANSITION_MS = 800;

const SUN = { x: 1010, y: 170 };
const HILL_BASE = 660;
const TURBINES = [
  { x: 860, y: 572 },
  { x: 985, y: 556 },
  { x: 1115, y: 580 },
];
const STRIP_TOP = 692;
const STRIP_BOTTOM = 762;
const TREE_BASE = 716;
const RIVER_MID = 838;
const NEAR_COLORS = ['#2d3c43', '#33444b', '#283840', '#30414a'];

interface Cloud {
  el: SVGGElement;
  x: number;
  y: number;
  speed: number;
}

function inputOf(s: CityState): VisualInput {
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

function svgMarkup(buildings: Building[]): string {
  const rand = mulberry32(42);
  const far = buildings.filter((b) => b.layer === 'far');
  const near = buildings.filter((b) => b.layer === 'near');
  const top = (b: Building) => (b.layer === 'near' ? NEAR_BASE : FAR_BASE) - b.h;

  const farRects = far.map((b) => `<rect x="${b.x}" y="${top(b)}" width="${b.w}" height="${b.h}"/>`).join('');
  const nearRects = near
    .map((b, i) => `<rect x="${b.x}" y="${top(b)}" width="${b.w}" height="${b.h}" fill="${NEAR_COLORS[i % NEAR_COLORS.length]}"/>`)
    .join('');

  const darkWindows: string[] = [];
  const lit: string[][] = Array.from({ length: 10 }, () => []);
  for (const b of near) {
    for (const w of b.windows) {
      const r = `<rect x="${b.x + w.x}" y="${top(b) + w.y}" width="6" height="9"/>`;
      darkWindows.push(r);
      lit[w.bucket].push(r);
    }
  }
  const litGroups = lit.map((rs, i) => `<g class="win" data-bucket="${i}" opacity="0">${rs.join('')}</g>`).join('');

  const farms = near
    .filter((b) => b.farm)
    .map((b) => {
      const y = top(b);
      const bushes = Array.from({ length: Math.max(2, Math.floor(b.w / 18)) }, (_, k) =>
        `<circle cx="${b.x + 9 + k * 18}" cy="${y - 9}" r="6"/>`).join('');
      return `<rect x="${b.x + 3}" y="${y - 6}" width="${b.w - 6}" height="6" fill="#5c8a3c"/><g fill="#76a84a">${bushes}</g>`;
    })
    .join('');

  const solar = near
    .filter((b) => b.solar)
    .map((b) => {
      const y = top(b);
      const n = Math.max(1, Math.floor((b.w - 10) / 20));
      return Array.from({ length: n }, (_, k) => {
        const x = b.x + 8 + k * 20;
        return `<polygon points="${x},${y} ${x + 15},${y} ${x + 11},${y - 8} ${x - 4},${y - 8}"/>`;
      }).join('');
    })
    .join('');

  const snow = near.map((b) => `<rect x="${b.x - 2}" y="${top(b) - 5}" width="${b.w + 4}" height="8" rx="3"/>`).join('');
  const shadows = near
    .map((b) => `<polygon points="${b.x},${NEAR_BASE} ${b.x + b.w},${NEAR_BASE} ${b.x + b.w + 28},${NEAR_BASE + 24} ${b.x + 28},${NEAR_BASE + 24}"/>`)
    .join('');

  const houses: string[] = [];
  for (let x = 4; x < SCENE_W; x += 34) {
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

  const turbines = TURBINES.map(
    (t) =>
      `<line x1="${t.x}" y1="${t.y}" x2="${t.x}" y2="${t.y - 170}" stroke="#e9eef0" stroke-width="5"/>` +
      `<g class="rotor" data-x="${t.x}" data-y="${t.y - 170}" transform="translate(${t.x},${t.y - 170})">` +
      [0, 120, 240].map((a) => `<path d="M0 0 L-4 -10 L0 -58 L4 -10 Z" transform="rotate(${a})"/>`).join('') +
      `<circle r="5"/></g>`,
  ).join('');

  const clouds = Array.from({ length: 7 }, (_, i) => {
    const x = Math.round(i * 260 + rand() * 120);
    const y = Math.round(80 + rand() * 230);
    const s = (0.6 + rand() * 0.6).toFixed(2);
    return `<g class="cloud" data-x="${x}" data-y="${y}" data-speed="${s}" transform="translate(${x},${y})">${cloudMarkup(rand)}</g>`;
  }).join('');

  return `
<svg id="scene" viewBox="0 0 ${SCENE_W} ${SCENE_H}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
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

  <rect width="${SCENE_W}" height="${SCENE_H}" fill="url(#sky-grad)"/>
  <circle id="sun-glow" cx="${SUN.x}" cy="${SUN.y}" r="150" fill="url(#sun-glow-grad)"/>
  <circle id="sun-disc" cx="${SUN.x}" cy="${SUN.y}" r="48" fill="#fff3c4"/>
  <g id="clouds" fill="#ffffff" fill-opacity="0.88">${clouds}</g>

  <path id="hill" d="M700 ${HILL_BASE} C 800 560, 1000 520, 1300 ${HILL_BASE} Z" fill="#7f9a77"/>
  <g id="turbines" opacity="0" fill="#f3f5f6" stroke="#c7cfd4" stroke-width="1">${turbines}</g>

  <g id="far">${farRects}</g>
  <rect id="smog" x="0" y="220" width="${SCENE_W}" height="520" fill="url(#smog-grad)" opacity="0"/>

  <rect id="ground" x="0" y="${NEAR_BASE}" width="${SCENE_W}" height="${SCENE_H - NEAR_BASE}" fill="#7a9a55"/>
  <g id="houses">${houses.join('')}</g>
  <rect id="field" x="0" y="${STRIP_TOP}" width="800" height="${STRIP_BOTTOM - STRIP_TOP + 2}" fill="url(#furrows)"/>

  <g id="near-wrap">
    <g id="near">${nearRects}</g>
    <g id="windows-dark" fill="#3e505a">${darkWindows.join('')}</g>
    <g id="windows-lit" fill="#ffd27a">${litGroups}</g>
    <g id="farms" opacity="0">${farms}</g>
    <g id="solar" opacity="0" fill="#2b4a7a" stroke="#9fb6d6" stroke-width="1">${solar}</g>
    <g id="snow" opacity="0" fill="#ffffff">${snow}</g>
  </g>
  <g id="shadows" fill="#1e2a22" opacity="0">${shadows}</g>
  <rect id="smog-front" x="0" y="300" width="${SCENE_W}" height="470" fill="url(#smog-grad)" opacity="0"/>

  <g id="trees">${trees.join('')}</g>

  <rect id="riverbed" x="0" y="${RIVER_MID - 48}" width="${SCENE_W}" height="96" fill="#b9a877" opacity="0.7"/>
  <rect id="river" x="0" y="${RIVER_MID - 20}" width="${SCENE_W}" height="40"/>

  <rect id="fog" x="0" y="470" width="${SCENE_W}" height="${SCENE_H - 470}" fill="url(#fog-grad)" opacity="0"/>
  <rect id="dust" x="0" y="0" width="${SCENE_W}" height="${SCENE_H}" fill="#e3d2a8" opacity="0"/>
</svg>
<canvas id="particles"></canvas>`;
}

export function mountBackground(root: HTMLElement, store: Store, opts: { reducedMotion: boolean }): void {
  root.innerHTML = svgMarkup(generateSkyline(2100));

  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const svg = $<SVGSVGElement>('#scene');
  const skyTop = $<SVGStopElement>('#sky-top');
  const skyBottom = $<SVGStopElement>('#sky-bottom');
  const sunDisc = $<SVGCircleElement>('#sun-disc');
  const sunGlow = $<SVGCircleElement>('#sun-glow');
  const far = $<SVGGElement>('#far');
  const cloudLayer = $<SVGGElement>('#clouds');
  const smog = $<SVGRectElement>('#smog');
  const smogFront = $<SVGRectElement>('#smog-front');
  const fog = $<SVGRectElement>('#fog');
  const dust = $<SVGRectElement>('#dust');
  const field = $<SVGRectElement>('#field');
  const river = $<SVGRectElement>('#river');
  const nearWrap = $<SVGGElement>('#near-wrap');
  const shimmerMap = $<SVGFEDisplacementMapElement>('#shimmer-map');
  const shimmerNoise = $<SVGFETurbulenceElement>('#shimmer-noise');
  const groups = {
    shadows: $<SVGGElement>('#shadows'),
    farms: $<SVGGElement>('#farms'),
    solar: $<SVGGElement>('#solar'),
    snow: $<SVGGElement>('#snow'),
    turbines: $<SVGGElement>('#turbines'),
  };
  const windowBuckets = [...root.querySelectorAll<SVGGElement>('#windows-lit .win')];
  const trees = [...root.querySelectorAll<SVGGElement>('.tree')];
  const rotors = [...root.querySelectorAll<SVGGElement>('.rotor')].map((el) => ({
    el,
    x: Number(el.dataset.x),
    y: Number(el.dataset.y),
    angle: Math.random() * 120,
  }));
  const clouds: Cloud[] = [...root.querySelectorAll<SVGGElement>('.cloud')].map((el) => ({
    el,
    x: Number(el.dataset.x),
    y: Number(el.dataset.y),
    speed: Number(el.dataset.speed),
  }));

  const particles = opts.reducedMotion ? null : createParticles($<HTMLCanvasElement>('#particles'));
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
    sunDisc.setAttribute('r', vis.sunRadius.toFixed(1));
    sunGlow.setAttribute('r', (vis.sunRadius * 3.2).toFixed(1));
    sunGlow.setAttribute('opacity', Math.min(1, vis.sunGlow * 1.6).toFixed(3));
    far.setAttribute('fill', mixHex('#7d93a6', vis.skyBottom, 0.35));
    cloudLayer.setAttribute('fill', vis.cloudColor);
    smog.setAttribute('opacity', vis.smog.toFixed(3));
    smogFront.setAttribute('opacity', (vis.smog * 0.5).toFixed(3));
    fog.setAttribute('opacity', vis.fog.toFixed(3));
    dust.setAttribute('opacity', ((1 - vis.saturation) * 0.55).toFixed(3));
    svg.style.filter = vis.saturation < 1 ? `saturate(${vis.saturation.toFixed(3)})` : '';
    field.setAttribute('width', (vis.fieldFraction * SCENE_W).toFixed(1));
    river.setAttribute('y', (RIVER_MID - vis.riverHeight / 2).toFixed(1));
    river.setAttribute('height', vis.riverHeight.toFixed(1));
    river.setAttribute('fill', vis.riverColor);
    groups.shadows.setAttribute('opacity', vis.shadowOpacity.toFixed(3));
    groups.farms.setAttribute('opacity', vis.rooftopFarms.toFixed(3));
    groups.solar.setAttribute('opacity', vis.solar.toFixed(3));
    groups.snow.setAttribute('opacity', vis.snowRoofs.toFixed(3));
    groups.turbines.setAttribute('opacity', vis.turbines.toFixed(3));
    windowBuckets.forEach((g, i) => {
      g.setAttribute('opacity', Math.min(1, Math.max(0, vis.litWindows * 10 - i)).toFixed(3));
    });
    if (vis.shimmer > 0.02 && !opts.reducedMotion) {
      nearWrap.setAttribute('filter', 'url(#shimmer)');
      shimmerMap.setAttribute('scale', (vis.shimmer * 3.5).toFixed(2));
    } else {
      nearWrap.removeAttribute('filter');
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
      if (c.x > SCENE_W + 220) c.x -= SCENE_W + 440;
      if (c.x < -220) c.x += SCENE_W + 440;
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
