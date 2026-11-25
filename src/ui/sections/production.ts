// Section "География и производство": five ways to grow food with their water, land and energy
// needs, a label computed from the settings, and the best combination of three (never one winner).
import type { Store } from '../../climate/state.ts';
import { methodRatings, topCombination, type MethodDef, type MethodLabel } from '../../climate/methods.ts';
import { el } from '../dom.ts';

const USE_WORD = ['Много ниска', 'Ниска', 'Средна', 'Висока'];
const LABEL_CLASS: Record<MethodLabel, string> = {
  Подходящо: 'tag tag-ok',
  'С компромис': 'tag tag-mid',
  Неподходящо: 'tag tag-bad',
};

export function mountProductionSection(section: HTMLElement, store: Store, defs: MethodDef[]): void {
  section.replaceChildren();
  const title = el('h2', undefined, 'География и производство');
  title.id = 'production-title';
  const intro = el('p', 'section-intro', 'Пет начина за отглеждане на храна. Етикетът се изчислява от настройките.');

  const list = el('ul', 'methods');
  const rows = new Map(
    defs.map((d) => {
      const li = el('li', 'method');
      const top = el('div', 'method-top');
      const label = el('span', 'tag');
      top.append(el('span', 'method-name', d.name), label);
      const uses = el('div', 'uses');
      for (const [key, word] of [['water', 'Вода'], ['land', 'Земя'], ['energy', 'Енергия']] as const) {
        const u = el('div', 'use');
        const bar = el('span', 'use-bar');
        const fill = el('span', 'use-fill');
        fill.style.width = `${25 + d.use[key] * 25}%`;
        bar.append(fill);
        u.append(el('span', 'use-name', word), bar, el('span', 'use-word', USE_WORD[d.use[key]]));
        uses.append(u);
      }
      const limit = el('p', 'method-limit muted', `Ограничение: ${d.limit}`);
      const missing = el('p', 'method-missing');
      li.append(top, uses, limit, missing);
      list.append(li);
      return [d.id, { label, missing }] as const;
    }),
  );

  const comboTitle = el('h3', undefined, 'Най-добра комбинация от три начина');
  const combo = el('ol', 'combo');
  const fairness = el('p', 'muted', 'Никой начин не е безусловно най-устойчив: всеки решава един проблем и създава друг.');

  section.append(title, intro, list, comboTitle, combo, fairness);

  store.subscribe((s) => {
    for (const r of methodRatings(s, defs)) {
      const row = rows.get(r.id)!;
      row.label.textContent = r.label;
      row.label.className = LABEL_CLASS[r.label];
      row.missing.textContent = r.missing.length ? `Липсва: ${r.missing.join('; ')}.` : '';
      row.missing.hidden = r.missing.length === 0;
    }
    combo.replaceChildren(
      ...topCombination(s, defs).map((r) => {
        const li = el('li');
        const top = el('div', 'method-top');
        top.append(el('span', 'method-name', r.def.name), el('span', LABEL_CLASS[r.label], r.label));
        const gives = el('p');
        gives.append(el('b', undefined, 'Осигурява: '), r.def.provides);
        const problem = el('p');
        problem.append(el('b', undefined, 'Нов проблем: '), r.def.newProblem);
        li.append(top, gives, problem);
        return li;
      }),
    );
  });
}
