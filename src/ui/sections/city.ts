// Section 1 "Градът": the city's name and story, the current climate readings,
// and a day/night temperature chart. Everything updates from the shared state.
import type { CityState, Store } from '../../climate/state.ts';
import { dayCurve } from '../../climate/dayCurve.ts';
import { formatNumber, formatSetting, isWarning, levelsOf, type Levels } from '../../climate/levels.ts';
import { matchesScenario, type Scenario } from '../../climate/scenarios.ts';
import { openScenarioPicker } from '../scenario-picker.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Chart geometry (viewBox units). The temperature axis is fixed, so the curve visibly moves up and down.
const CH = { w: 340, h: 190, left: 34, right: 12, top: 14, bottom: 28, tMin: -25, tMax: 55 };
const xOf = (hour: number) => CH.left + (hour / 24) * (CH.w - CH.left - CH.right);
const yOf = (t: number) => CH.top + ((CH.tMax - t) / (CH.tMax - CH.tMin)) * (CH.h - CH.top - CH.bottom);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

interface Reading {
  label: string;
  value: (s: CityState) => string;
  level?: keyof Levels;
}

const DIR_FROM: Record<string, string> = {
  С: 'север', СИ: 'североизток', И: 'изток', ЮИ: 'югоизток', Ю: 'юг', ЮЗ: 'югозапад', З: 'запад', СЗ: 'северозапад',
};

const READINGS: Reading[] = [
  { label: 'Температура', value: (s) => `${formatNumber(s.temp)} °C`, level: 'temp' },
  { label: 'Влажност', value: (s) => `${formatNumber(s.humidity)} %`, level: 'humidity' },
  { label: 'Вятър', value: (s) => `${formatNumber(s.windSpeed)} км/ч`, level: 'wind' },
  {
    label: 'Посока',
    value: (s) => (s.windDir ? `от ${DIR_FROM[s.windDir]} (${formatSetting('windDir', s)})` : 'без посока'),
  },
  { label: 'Въздух (AQI)', value: (s) => formatNumber(s.aqi), level: 'aqi' },
  { label: 'UV индекс', value: (s) => formatNumber(s.uv), level: 'uv' },
];

function buildChart(): { root: SVGSVGElement; update(s: CityState, lv: Levels): void } {
  const root = svgEl('svg', { viewBox: `0 0 ${CH.w} ${CH.h}`, class: 'daychart', role: 'img' });
  const title = svgEl('title', {});
  root.append(title);

  for (const t of [-20, 0, 20, 40]) {
    root.append(
      svgEl('line', { x1: CH.left, x2: CH.w - CH.right, y1: yOf(t), y2: yOf(t), class: t === 0 ? 'axis-zero' : 'axis-grid' }),
    );
    const label = svgEl('text', { x: CH.left - 6, y: yOf(t) + 4, 'text-anchor': 'end', class: 'axis-label' });
    label.textContent = `${formatNumber(t)}°`;
    root.append(label);
  }
  for (const h of [0, 6, 12, 18, 24]) {
    const label = svgEl('text', { x: xOf(h), y: CH.h - 8, 'text-anchor': 'middle', class: 'axis-label' });
    label.textContent = `${h} ч`;
    root.append(label);
  }

  const area = svgEl('path', { class: 'curve-area' });
  const line = svgEl('path', { class: 'curve-line' });
  const maxDot = svgEl('circle', { r: 4, class: 'curve-dot' });
  const minDot = svgEl('circle', { r: 4, class: 'curve-dot' });
  const maxLabel = svgEl('text', { class: 'curve-label', 'text-anchor': 'middle', 'data-role': 'max' });
  const minLabel = svgEl('text', { class: 'curve-label', 'text-anchor': 'middle', 'data-role': 'min' });
  root.append(area, line, maxDot, minDot, maxLabel, minLabel);

  return {
    root,
    update(s, lv) {
      const pts = dayCurve(s.temp, lv.humidity);
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${xOf(p.hour).toFixed(1)} ${yOf(p.temp).toFixed(1)}`).join(' ');
      line.setAttribute('d', d);
      area.setAttribute('d', `${d} L${xOf(24)} ${yOf(CH.tMin)} L${xOf(0)} ${yOf(CH.tMin)} Z`);
      const max = pts.reduce((a, b) => (b.temp > a.temp ? b : a));
      const min = pts.reduce((a, b) => (b.temp < a.temp ? b : a));
      for (const [dot, label, p, dy, word] of [
        [maxDot, maxLabel, max, -10, 'макс'],
        [minDot, minLabel, min, 20, 'мин'],
      ] as const) {
        dot.setAttribute('cx', xOf(p.hour).toFixed(1));
        dot.setAttribute('cy', yOf(p.temp).toFixed(1));
        label.setAttribute('x', xOf(p.hour).toFixed(1));
        label.setAttribute('y', (yOf(p.temp) + dy).toFixed(1));
        label.textContent = `${word} ${formatNumber(p.temp)} °C`;
      }
      title.textContent = `Температура през денонощието: от ${formatNumber(min.temp)} °C около ${min.hour} ч до ${formatNumber(max.temp)} °C около ${max.hour} ч.`;
    },
  };
}

export function mountCitySection(section: HTMLElement, store: Store, scenarios: Scenario[]): void {
  section.replaceChildren();

  const head = el('div', 'city-head');
  const titleWrap = el('div');
  const heading = el('h2');
  heading.id = 'city-title';
  const modified = el('p', 'city-modified', 'Стойностите са променени ръчно.');
  const desc = el('p', 'city-desc');
  titleWrap.append(heading, modified, desc);
  const load = el('button', 'button', 'Зареди сценарий');
  load.type = 'button';
  load.addEventListener('click', () => openScenarioPicker(store, scenarios));
  head.append(titleWrap, load);

  const body = el('div', 'city-body');
  const dl = el('dl', 'readings');
  const rows = READINGS.map((r) => {
    const dt = el('dt', undefined, r.label);
    const dd = el('dd');
    const value = el('span', 'reading-value');
    const level = el('span', 'level');
    dd.append(value);
    if (r.level) dd.append(' · ', level);
    dl.append(dt, dd);
    return { r, value, level };
  });

  const figure = el('figure', 'daychart-wrap');
  const chart = buildChart();
  const caption = el('figcaption', 'muted', 'Опростен модел на денонощието: най-топло е около 15 ч, най-студено около 3 ч.');
  figure.append(chart.root, caption);
  body.append(dl, figure);

  section.append(head, body);

  store.subscribe((s) => {
    const lv = levelsOf(s);
    const sc = scenarios.find((x) => x.id === s.scenarioId);
    heading.textContent = sc?.name ?? 'Град 2100';
    desc.textContent = sc?.description ?? '';
    modified.hidden = !sc || matchesScenario(s, sc);
    for (const { r, value, level } of rows) {
      value.textContent = r.value(s);
      if (!r.level) continue;
      level.textContent = lv[r.level];
      level.className = isWarning(r.level, lv) ? 'level level-warn' : 'level';
    }
    chart.update(s, lv);
  });
}
