// The settings panel on the right: ten controls that drive the whole page.
import { maxHumidity, type CityState, type Store, type WindDir } from '../climate/state.ts';
import { formatNumber, formatSetting, isWarning, levelsOf, type Levels, type SettingKey } from '../climate/levels.ts';
import { SLIDER_RANGES, type Scenario } from '../climate/scenarios.ts';
import { openScenarioPicker } from './scenario-picker.ts';

type SliderKey = Exclude<SettingKey, 'windDir'>;

interface SliderDef {
  key: SliderKey;
  label: string;
  level?: keyof Levels;
  /** Small text under the slider; a function is re-evaluated on every change (empty hides it). */
  hint?: (s: CityState) => string;
}

type Row = SliderDef | 'compass';

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: 'Климат',
    rows: [
      { key: 'temp', label: 'Температура', level: 'temp' },
      {
        key: 'humidity',
        label: 'Влажност',
        level: 'humidity',
        hint: (s) => (maxHumidity(s.temp) < 100 ? `При ${formatNumber(s.temp)} °C влажността е най-много ${maxHumidity(s.temp)} %.` : ''),
      },
      { key: 'windSpeed', label: 'Сила на вятъра', level: 'wind' },
      'compass',
      { key: 'aqi', label: 'Качество на въздуха (AQI)', level: 'aqi' },
      { key: 'uv', label: 'UV индекс', level: 'uv' },
    ],
  },
  {
    title: 'Ресурси',
    rows: [
      { key: 'water', label: 'Налична вода', level: 'water' },
      { key: 'energy', label: 'Енергия', level: 'energy' },
    ],
  },
  {
    title: 'Население',
    rows: [
      {
        key: 'population',
        label: 'Жители',
        hint: (s) => `Повече жители – по-малко свободна земя: сега ${s.land} %. Използва се и в калкулатора за храна.`,
      },
    ],
  },
];

// Compass laid out as a 3×3 grid, north on top; the centre is "no direction".
const COMPASS: (WindDir | 'none')[] = ['СЗ', 'С', 'СИ', 'З', 'none', 'И', 'ЮЗ', 'Ю', 'ЮИ'];
const DIR_NAMES: Record<Exclude<WindDir, null>, string> = {
  С: 'север', СИ: 'североизток', И: 'изток', ЮИ: 'югоизток',
  Ю: 'юг', ЮЗ: 'югозапад', З: 'запад', СЗ: 'северозапад',
};

/** Writes "41 °C · Жега" into an <output>, with the level word as its own element so it can turn orange. */
function renderValue(out: HTMLOutputElement, text: string, warn: boolean): void {
  const [value, word] = text.split(' · ');
  if (word === undefined) {
    out.textContent = text;
    return;
  }
  const lvl = document.createElement('span');
  lvl.className = warn ? 'level level-warn' : 'level';
  lvl.textContent = word;
  out.replaceChildren(`${value} · `, lvl);
}

export function mountPanel(root: HTMLElement, store: Store, scenarios: Scenario[]): void {
  root.replaceChildren();

  const head = document.createElement('div');
  head.className = 'panel-head';
  const h = document.createElement('h2');
  h.textContent = 'Настройки';
  const load = document.createElement('button');
  load.type = 'button';
  load.className = 'button';
  load.textContent = 'Зареди сценарий';
  load.addEventListener('click', () => openScenarioPicker(store, scenarios));
  head.append(h, load);
  root.append(head);

  const updaters: ((s: CityState, lv: Levels) => void)[] = [];

  for (const group of GROUPS) {
    const fs = document.createElement('fieldset');
    fs.className = 'panel-group';
    const legend = document.createElement('legend');
    legend.textContent = group.title;
    fs.append(legend);

    for (const row of group.rows) {
      if (row === 'compass') {
        fs.append(buildCompass(store, updaters));
        continue;
      }
      fs.append(buildSlider(row, store, updaters));
    }
    root.append(fs);
  }

  store.subscribe((s) => {
    const lv = levelsOf(s);
    for (const u of updaters) u(s, lv);
  });
}

function buildSlider(def: SliderDef, store: Store, updaters: ((s: CityState, lv: Levels) => void)[]): HTMLElement {
  const range = SLIDER_RANGES[def.key];
  const id = `set-${def.key}`;

  const wrap = document.createElement('div');
  wrap.className = 'control';
  const top = document.createElement('div');
  top.className = 'control-top';
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = def.label;
  const out = document.createElement('output');
  out.htmlFor.add(id);
  top.append(label, out);

  const input = document.createElement('input');
  input.type = 'range';
  input.id = id;
  input.min = String(range.min);
  input.max = String(range.max);
  input.step = String(range.step);
  input.addEventListener('input', () => store.set({ [def.key]: Number(input.value) }));

  wrap.append(top, input);
  const hint = document.createElement('p');
  hint.className = 'control-hint';
  if (def.hint) {
    wrap.append(hint);
  }

  updaters.push((s, lv) => {
    const v = s[def.key];
    if (Number(input.value) !== v) input.value = String(v);
    const text = formatSetting(def.key, s);
    input.setAttribute('aria-valuetext', text);
    input.style.setProperty('--fill', `${((v - range.min) / (range.max - range.min)) * 100}%`);
    renderValue(out, text, def.level ? isWarning(def.level, lv) : false);
    if (def.hint) {
      hint.textContent = def.hint(s);
      hint.hidden = hint.textContent === '';
    }
  });
  return wrap;
}

function buildCompass(store: Store, updaters: ((s: CityState, lv: Levels) => void)[]): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'control';
  const top = document.createElement('div');
  top.className = 'control-top';
  const label = document.createElement('span');
  label.className = 'control-label';
  label.id = 'compass-label';
  label.textContent = 'Посока на вятъра';
  const out = document.createElement('output');
  out.id = 'compass-value';
  top.append(label, out);

  const grid = document.createElement('div');
  grid.className = 'compass';
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-labelledby', 'compass-label');

  const buttons: { dir: WindDir; el: HTMLButtonElement }[] = [];
  for (const cell of COMPASS) {
    const dir: WindDir = cell === 'none' ? null : cell;
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = dir ?? '—';
    b.setAttribute('aria-label', dir ? `Вятър от ${DIR_NAMES[dir]}` : 'Без посока (тихо)');
    if (!dir) b.classList.add('compass-calm');
    b.addEventListener('click', () => store.set({ windDir: dir }));
    buttons.push({ dir, el: b });
    grid.append(b);
  }

  const hint = document.createElement('p');
  hint.className = 'control-hint';
  hint.textContent = 'Посоката, от която духа вятърът. Заводската зона е на изток.';

  const row = document.createElement('div');
  row.className = 'compass-row';
  row.append(grid, hint);
  wrap.append(top, row);
  updaters.push((s) => {
    out.textContent = formatSetting('windDir', s);
    for (const { dir, el } of buttons) el.setAttribute('aria-pressed', String(dir === s.windDir));
  });
  return wrap;
}
