// Град 2100 page on top of the 3D city: top bar with section links and bar toggles, the scrolling
// section column (left), the settings panel (right), the live sky behind the city, rain and snow in
// front of it, and the climate weather on the 3D scene itself. Kaloyan's existing controls
// (#title, #layers, #scenario, #card) are moved into this layout, never recreated, so initDomUI keeps working.
import './climate.css';
import type * as THREE from 'three';
import climateScenarios from '../../content/climate-scenarios.json';
import { createStore, DEFAULT_STATE, type Store } from '../climate/state.ts';
import type { Scenario } from '../climate/scenarios.ts';
import { visualsFor } from '../climate/visuals.ts';
import { weatherLook } from '../climate/weatherLook.ts';
import { applyWeather } from '../scene/weather.ts';
import { mountPanel } from './climate-panel.ts';
import { mountCitySection } from './sections/city.ts';
import { inputOf, mountSky } from './sky.ts';

const SECTIONS: { id: string; title: string; pending?: string }[] = [
  { id: 'city', title: 'Градът' },
  { id: 'production', title: 'География и производство', pending: 'кои начини за отглеждане на храна са възможни и какво струват.' },
  { id: 'biology', title: 'Биология', pending: 'растения и животни, които виреят при тези условия.' },
  { id: 'foods', title: 'Храни', pending: 'хранителните вещества и типичното ядене за този климат.' },
  { id: 'menu', title: 'Дневно меню', pending: 'Меню А срещу Меню Б за четири хранения.' },
  { id: 'numbers', title: 'Храната в числа', pending: 'колко плодове и зеленчуци са нужни на града и пътят от фермата до масата.' },
  { id: 'lifestyle', title: 'Начин на живот', pending: 'продължителност на живота и риск от болести.' },
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
  const toggles = el('div', { class: 'bar-toggles' });
  const sectionsToggle = el('button', { type: 'button', 'aria-pressed': 'true', 'aria-controls': 'content' }, 'Раздели');
  const settingsToggle = el('button', { type: 'button', 'aria-pressed': 'true', 'aria-controls': 'panel' }, 'Настройки');
  toggles.append(sectionsToggle, settingsToggle);
  topnav.append(brand, nav, toggles);

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

  // Bar toggles: hide the sections or the settings to show the whole city, then re-fit the 3D view.
  const bindToggle = (button: HTMLButtonElement, cls: string) => {
    button.addEventListener('click', () => {
      const hidden = body.classList.toggle(cls);
      button.setAttribute('aria-pressed', String(!hidden));
      window.dispatchEvent(new Event('resize'));
    });
  };
  bindToggle(sectionsToggle, 'hide-sections');
  bindToggle(settingsToggle, 'hide-settings');

  // A plain mouse wheel over the city scrolls the page; Ctrl+wheel (or a trackpad pinch) zooms the city.
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.target === canvas && !e.ctrlKey) e.stopPropagation();
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

  const freeArea = (): FreeArea => {
    const top = topnav.getBoundingClientRect().bottom;
    const left = body.classList.contains('hide-sections') ? 0 : content.getBoundingClientRect().right + 16;
    const right = body.classList.contains('hide-settings') ? window.innerWidth : panel.getBoundingClientRect().left - 16;
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
