// Section "Биология": every species is listed; those that cannot live under the current
// settings fade to grey with a short reason.
import type { Store } from '../../climate/state.ts';
import { speciesStatus, type SpeciesDef } from '../../climate/species.ts';
import { el } from '../dom.ts';

export function mountBiologySection(section: HTMLElement, store: Store, defs: SpeciesDef[]): void {
  section.replaceChildren();
  const title = el('h2', undefined, 'Биология');
  title.id = 'biology-title';
  const intro = el('p', 'section-intro');
  intro.setAttribute('aria-live', 'polite');

  const list = el('ul', 'species');
  const rows = new Map(
    defs.map((d) => {
      const li = el('li', 'sp');
      const head = el('div', 'sp-head');
      head.append(el('span', 'sp-name', d.name), el('span', 'sp-kind', d.kind));
      const status = el('span', 'sp-status');
      li.append(head, el('p', 'sp-trait', d.trait), status);
      list.append(li);
      return [d.id, { li, status }] as const;
    }),
  );

  section.append(title, intro, list);

  store.subscribe((s) => {
    let thriving = 0;
    for (const d of defs) {
      const st = speciesStatus(s, d);
      const row = rows.get(d.id)!;
      row.li.classList.toggle('sp-off', !st.ok);
      row.status.textContent = st.ok ? 'вирее' : `не вирее · ${st.reason}`;
      if (st.ok) thriving++;
    }
    intro.textContent = `При тези условия виреят ${thriving} от ${defs.length} вида.`;
  });
}
