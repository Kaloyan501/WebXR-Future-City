// Presentation mode for the projector: both bars slide away, the five scenarios play one after
// another and the city turns slowly. A large caption names the scenario and its key values.
// The button again (or Esc) stops it and brings the bars back as they were.
import type { Store } from '../climate/state.ts';
import { applyScenario, nextScenarioId, type Scenario } from '../climate/scenarios.ts';
import { formatSetting } from '../climate/levels.ts';
import { el } from './dom.ts';

export const STEP_MS = 8000;

export interface PresentationDeps {
  store: Store;
  scenarios: Scenario[];
  button: HTMLButtonElement;
  /** Shows or hides a side bar ('hide-sections' / 'hide-settings'); returns whether it was hidden before. */
  setBar(cls: 'hide-sections' | 'hide-settings', hidden: boolean): boolean;
  /** Turns the slow rotation of the city on or off. */
  rotate(on: boolean): void;
  reducedMotion: boolean;
}

export function setupPresentation(d: PresentationDeps): { active(): boolean } {
  const ids = d.scenarios.map((s) => s.id);
  const caption = el('div', 'presenting');
  caption.id = 'presenting';
  caption.hidden = true;
  caption.setAttribute('aria-live', 'polite');
  const name = el('p', 'presenting-name');
  const values = el('div', 'presenting-values');
  const dots = el('div', 'presenting-dots');
  const dotEls = ids.map(() => dots.appendChild(el('span')));
  caption.append(name, values, dots);
  document.body.append(caption);

  let timer = 0;
  let on = false;
  let restore = { sections: false, settings: false };

  const show = (id: string) => {
    const sc = d.scenarios.find((s) => s.id === id)!;
    d.store.set(applyScenario(sc));
    const s = d.store.get();
    name.textContent = sc.name;
    values.replaceChildren(
      ...([
        ['Температура', 'temp'],
        ['Вода', 'water'],
        ['Въздух (AQI)', 'aqi'],
      ] as const).map(([label, key]) => {
        const [value, word] = formatSetting(key, s).split(' · ');
        const item = el('span', 'presenting-value');
        item.append(el('span', 'presenting-label', label), el('b', undefined, value), ` ${word}`);
        return item;
      }),
    );
    dotEls.forEach((dot, i) => dot.classList.toggle('on', ids[i] === id));
  };

  const stop = () => {
    if (!on) return;
    on = false;
    window.clearInterval(timer);
    caption.hidden = true;
    d.button.textContent = 'Представяне';
    d.button.setAttribute('aria-pressed', 'false');
    d.setBar('hide-sections', restore.sections);
    d.setBar('hide-settings', restore.settings);
    d.rotate(false);
  };

  const start = () => {
    on = true;
    restore = { sections: d.setBar('hide-sections', true), settings: d.setBar('hide-settings', true) };
    d.button.textContent = 'Спри представянето';
    d.button.setAttribute('aria-pressed', 'true');
    caption.hidden = false;
    show(ids[0]);
    timer = window.setInterval(() => show(nextScenarioId(ids, d.store.get().scenarioId)), STEP_MS);
    d.rotate(!d.reducedMotion);
  };

  d.button.addEventListener('click', () => (on ? stop() : start()));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && on) stop();
  });

  return { active: () => on };
}
