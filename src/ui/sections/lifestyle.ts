// Section "Начин на живот": life expectancy (counts to its new value) and disease risks.
// A simplified teaching model; the disclaimer is always shown.
import type { Store } from '../../climate/state.ts';
import { createTween } from '../../climate/tween.ts';
import { diseaseRisks, lifespan, type DiseaseDef } from '../../climate/health.ts';
import { el } from '../dom.ts';


/** 74.5 → "74,5"; 76 → "76"; with a real minus/plus sign when asked. */
function years(v: number, signed = false): string {
  const half = Math.round(v * 2) / 2;
  const abs = Math.abs(half);
  const text = abs % 1 ? abs.toFixed(1).replace('.', ',') : String(abs);
  if (!signed) return (half < 0 ? '−' : '') + text;
  return (half < 0 ? '−' : '+') + text;
}

export function mountLifestyleSection(section: HTMLElement, store: Store, defs: DiseaseDef[], reducedMotion: boolean): void {
  section.replaceChildren();
  const title = el('h2', undefined, 'Начин на живот');
  title.id = 'lifestyle-title';

  const big = el('div', 'lifespan');
  const value = el('span', 'lifespan-value', '78');
  big.append(value, el('span', 'lifespan-unit', ' години'));
  const caption = el('p', 'muted', 'Очаквана средна продължителност на живота в града');
  const factors = el('ul', 'factors');
  const disclaimer = el(
    'p',
    'disclaimer',
    'Опростен учебен модел. Реалната продължителност на живота зависи от много повече фактори. Теглата на факторите са избрани за нагледност, не са измерени.',
  );

  const risksTitle = el('h3', undefined, 'Риск от болести');
  const risks = el('ul', 'risks');

  section.append(title, big, caption, factors, disclaimer, risksTitle, risks);

  // One row per disease, kept between updates so the bars change colour smoothly.
  const rows = new Map(
    defs.map((d) => {
      const li = el('li', 'risk');
      const top = el('div', 'risk-top');
      const level = el('span', 'level');
      top.append(el('span', 'risk-name', d.name), level);
      const bar = el('div', 'risk-bar');
      bar.setAttribute('role', 'img');
      const segments = [0, 1, 2].map(() => el('span'));
      bar.append(...segments);
      const why = el('p', 'risk-why muted');
      li.append(top, bar, why);
      risks.append(li);
      return [d.id, { li, level, bar, segments, why }] as const;
    }),
  );

  const counter = createTween({ v: 78 }, 900, (x) => { value.textContent = years(x.v); });

  store.subscribe((s) => {
    const l = lifespan(s);
    if (reducedMotion) counter.snap({ v: l.years });
    else counter.to({ v: l.years });

    factors.replaceChildren();
    const baseRow = el('li');
    baseRow.append(el('span', undefined, 'База на модела'), el('b', undefined, years(l.base)));
    factors.append(baseRow);
    if (l.factors.length === 0) factors.append(el('li', 'muted', 'Нищо не променя базата при тези условия.'));
    for (const f of l.factors) {
      const li = el('li');
      li.append(el('span', undefined, f.label), el('b', f.delta < 0 ? 'delta-minus' : 'delta-plus', years(f.delta, true)));
      factors.append(li);
    }

    for (const r of diseaseRisks(s, defs)) {
      const row = rows.get(r.id)!;
      row.li.className = `risk risk-${r.steps}`;
      row.level.textContent = r.level;
      row.level.className = r.steps === 2 ? 'level level-warn' : 'level';
      row.bar.setAttribute('aria-label', `Риск: ${r.level}`);
      row.segments.forEach((seg, i) => seg.classList.toggle('on', i <= r.steps));
      row.why.textContent = r.why;
    }
  });
}
