// Град 2100 page on top of the 3D city: top bar with section links and bar toggles, the scrolling
// section column (left), the settings panel (right), the live sky behind the city, rain and snow in
// front of it, and the climate weather on the 3D scene itself. Kaloyan's existing controls
// (#title, #layers, #scenario, #card) are moved into this layout, never recreated, so initDomUI keeps working.
import './climate.css';
import type * as THREE from 'three';
import climateScenarios from '../../content/climate-scenarios.json';
import diseasesData from '../../content/diseases.json';
import mealsData from '../../content/meals.json';
import type { DiseaseDef } from '../climate/health.ts';
import type { MealsData } from '../climate/menu.ts';
import { createStore, DEFAULT_STATE, type Store } from '../climate/state.ts';
import type { Scenario } from '../climate/scenarios.ts';
import { visualsFor } from '../climate/visuals.ts';
import { weatherLook } from '../climate/weatherLook.ts';
import { applyWeather } from '../scene/weather.ts';
import { mountPanel } from './climate-panel.ts';
import { mountCitySection } from './sections/city.ts';
import { mountLifestyleSection } from './sections/lifestyle.ts';
import { mountMenuSection } from './sections/menu.ts';
import { inputOf, mountSky } from './sky.ts';

const SECTIONS: { id: string; title: string; pending?: string }[] = [
  { id: 'city', title: 'Градът' },
  { id: 'production', title: 'География и производство', pending: 'кои начини за отглеждане на храна са възможни и какво струват.' },
  { id: 'biology', title: 'Биология', pending: 'растения и животни, които виреят при тези условия.' },
  { id: 'foods', title: 'Храни', pending: 'хранителните вещества и типичното ядене за този климат.' },
  { id: 'menu', title: 'Дневно меню' },
  { id: 'numbers', title: 'Храната в числа', pending: 'колко плодове и зеленчуци са нужни на града и пътят от фермата до масата.' },
  { id: 'lifestyle', title: 'Начин на живот' },
];

// three.js writes these into its VR/AR buttons; the site is in Bulgarian.
const XR_TEXT: Record<string, string> = {
  'ENTER VR': 'ВЛЕЗ ВЪВ VR',
  'EXIT VR': 'ИЗЛЕЗ ОТ VR',
  'VR NOT SUPPORTED': 'VR НЕ СЕ ПОДДЪРЖА',
  'VR NOT ALLOWED': 'VR НЕ Е РАЗРЕШЕН',
  'START AR': 'СТАРТИРАЙ AR',
  'STOP AR': 'СПРИ AR',
  'AR NOT SUPPORTED': 'AR НЕ СЕ ПОДДЪРЖА',
  'AR NOT ALLOWED': 'AR НЕ Е РАЗРЕШЕН',
};

export interface FreeArea {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ClimatePage {
  store: Store;
  /** The part of the window not covered by the top bar and the two side bars, in CSS pixels. */
  freeArea(): FreeArea;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

export function mountClimatePage(opts: {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
}): ClimatePage {
  const scenarios = climateScenarios as Scenario[];
  const store = createStore(DEFAULT_STATE);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body;
  const canvas = opts.renderer.domElement;

  // Sky behind the transparent 3D canvas, rain and snow in front of it.
  const bg = el('div', { id: 'bg', 'aria-hidden': 'true' });
  const particles = el('canvas', { id: 'particles', 'aria-hidden': 'true' });
  body.prepend(bg);
  canvas.after(particles);

  // Top bar: the existing title, the section links, the two bar toggles.
  const topnav = el('header', { class: 'topnav' });
  const brand = el('a', { class: 'brand', href: '#city' });
  const title = document.querySelector<HTMLElement>('#title');
  if (title) brand.append(title);
  const nav = el('nav', { 'aria-label': 'Раздели' });
  for (const s of SECTIONS) nav.append(el('a', { href: `#${s.id}` }, s.title));
  // Each toggle sits on the side of the bar it controls.
  const sectionsToggle = el('button', { type: 'button', class: 'bar-toggle', 'aria-pressed': 'true', 'aria-controls': 'content' }, 'Раздели');
  const settingsToggle = el('button', { type: 'button', class: 'bar-toggle bar-toggle-right', 'aria-pressed': 'true', 'aria-controls': 'panel' }, 'Настройки');
  topnav.append(sectionsToggle, brand, nav, settingsToggle);

  // Left: the scrolling section sheets.
  const content = el('main', { id: 'content' });
  for (const s of SECTIONS) {
    const section = el('section', { id: s.id, class: 'sheet', 'aria-labelledby': `${s.id}-title` });
    if (s.pending) {
      section.append(el('h2', { id: `${s.id}-title` }, s.title), el('p', { class: 'pending' }, `В процес на изработка: ${s.pending}`));
    }
    content.append(section);
  }

  // Right: the settings panel, with Kaloyan's layer buttons and sea-level slider as a "Карта" group.
  const panel = el('aside', { id: 'panel', 'aria-label': 'Настройки' });
  const dialog = el('dialog', { id: 'scenario-dialog', 'aria-labelledby': 'scenario-dialog-title' });
  body.append(topnav, content, panel, dialog);
  mountPanel(panel, store, scenarios);

  const mapGroup = el('fieldset', { class: 'panel-group' });
  mapGroup.append(el('legend', {}, 'Карта'));
  const seaLevel = document.querySelector<HTMLElement>('#scenario');
  const layers = document.querySelector<HTMLElement>('#layers');
  if (seaLevel) {
    const row = el('div', { class: 'control' });
    row.append(seaLevel);
    mapGroup.append(row);
  }
  if (layers) {
    const row = el('div', { class: 'control' });
    row.append(el('span', { class: 'control-label' }, 'Показвай точки'), layers);
    mapGroup.append(row);
  }
  panel.append(mapGroup);

  // Kaloyan's sea-level slider gets the same green fill as the others, also when VR changes it.
  const seaRange = document.querySelector<HTMLInputElement>('#scenario-range');
  const seaLabel = document.querySelector<HTMLElement>('#scenario-label');
  const syncSeaFill = () => {
    if (!seaRange) return;
    const max = Number(seaRange.max) || 1;
    seaRange.style.setProperty('--fill', `${(Number(seaRange.value) / max) * 100}%`);
  };
  seaRange?.addEventListener('input', syncSeaFill);
  if (seaLabel) new MutationObserver(syncSeaFill).observe(seaLabel, { childList: true, characterData: true, subtree: true });
  syncSeaFill();

  const citySection = content.querySelector<HTMLElement>('#city')!;
  mountCitySection(citySection, store, scenarios);
  mountMenuSection(content.querySelector<HTMLElement>('#menu')!, store, mealsData as MealsData);
  mountLifestyleSection(content.querySelector<HTMLElement>('#lifestyle')!, store, diseasesData as DiseaseDef[], reducedMotion);
  mountSky(bg, particles, store, { reducedMotion });

  // Climate weather on the 3D scene (sunlight, haze); re-applied when entering or leaving VR.
  const applyScene = () => {
    const s = store.get();
    applyWeather(weatherLook(visualsFor(inputOf(s)), s), {
      scene: opts.scene,
      sun: opts.sun,
      hemi: opts.hemi,
      inVR: opts.renderer.xr.isPresenting,
    });
  };
  store.subscribe(applyScene);
  opts.renderer.xr.addEventListener('sessionstart', applyScene);
  opts.renderer.xr.addEventListener('sessionend', applyScene);

  // Bar toggles: the bars slide away (CSS) and the city glides into the freed space, because the
  // 3D view is re-fitted on every frame of the slide from the bars' live positions.
  const SLIDE_MS = 420;
  let slideUntil = 0;
  const followSlide = () => {
    window.dispatchEvent(new Event('resize'));
    if (performance.now() < slideUntil) requestAnimationFrame(followSlide);
  };
  const bindToggle = (button: HTMLButtonElement, cls: string) => {
    button.addEventListener('click', () => {
      const hidden = body.classList.toggle(cls);
      button.setAttribute('aria-pressed', String(!hidden));
      const running = performance.now() < slideUntil;
      slideUntil = performance.now() + (reducedMotion ? 0 : SLIDE_MS);
      if (!running) followSlide();
    });
  };
  bindToggle(sectionsToggle, 'hide-sections');
  bindToggle(settingsToggle, 'hide-settings');
  // One last re-fit when a slide really ends, so the city settles exactly in place.
  for (const bar of [content, panel]) {
    bar.addEventListener('transitionend', (e) => {
      if (e.target === bar && e.propertyName === 'transform') window.dispatchEvent(new Event('resize'));
    });
  }

  // A plain mouse wheel over the city scrolls the page; Ctrl+wheel (or a trackpad pinch) zooms the city.
  window.addEventListener(
    'wheel',
    (e) => {
      // With the sections hidden there is nothing to scroll, so the wheel zooms the city as before.
      if (e.target === canvas && !e.ctrlKey && !body.classList.contains('hide-sections')) e.stopPropagation();
    },
    { capture: true },
  );

  // Bulgarian text on the three.js VR/AR buttons, which rewrite their own labels.
  const translateXr = () => {
    for (const b of document.querySelectorAll<HTMLElement>('#xr-bar button, #xr-bar a')) {
      const t = b.textContent?.trim() ?? '';
      if (XR_TEXT[t]) b.textContent = XR_TEXT[t];
    }
  };
  new MutationObserver(translateXr).observe(body, { childList: true, subtree: true, characterData: true });

  // Live positions, so the result follows the bars while they slide in or out.
  const freeArea = (): FreeArea => {
    const top = topnav.getBoundingClientRect().bottom;
    const c = content.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const left = c.right > 0 ? c.right + 16 : 0;
    const right = p.left < window.innerWidth ? p.left - 16 : window.innerWidth;
    return { left, right: Math.max(right, left + 200), top, bottom: window.innerHeight };
  };

  // Keep the VR/AR buttons centred under the city.
  const placeXrBar = () => {
    const f = freeArea();
    body.style.setProperty('--free-center', `${(f.left + f.right) / 2}px`);
  };
  window.addEventListener('resize', placeXrBar);
  placeXrBar();

  return { store, freeArea };
}
