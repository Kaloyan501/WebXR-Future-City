// Section "Храната в числа": how much fruit and vegetables the city needs (step by step, with a
// self-check), and the live farm-to-table chain where the link the settings strain turns orange.
import type { Store } from '../../climate/state.ts';
import { produceNeed, weakLinks, KG_PER_PERSON, type LinkId } from '../../climate/numbers.ts';
import { bgNumber, el, svgEl } from '../dom.ts';

const BOX_W = 180;
const BOX_H = 70;
// Two rows, read clockwise like the spec's diagram.
const LINKS: { id: LinkId; title: string; sub: string; x: number; y: number }[] = [
  { id: 'resources', title: 'Вода и енергия', sub: 'плъзгачи Вода и Енергия', x: 0, y: 10 },
  { id: 'farm', title: 'Градска ферма', sub: 'начини за отглеждане', x: 210, y: 10 },
  { id: 'storage', title: 'Събиране и съхранение', sub: 'риск при жега и влага', x: 420, y: 10 },
  { id: 'kitchen', title: 'Кухня / пазар', sub: 'какво има за менютата', x: 420, y: 160 },
  { id: 'eating', title: 'Хранене', sub: '4 хранения с напитка', x: 210, y: 160 },
  { id: 'waste', title: 'Отпадъци', sub: '', x: 0, y: 160 },
];

function chainSvg() {
  const svg = svgEl('svg', { viewBox: '0 0 600 240', class: 'chain', role: 'img' });
  const title = svgEl('title');
  svg.append(title);
  const defs = svgEl('defs');
  const marker = svgEl('marker', { id: 'chain-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
  marker.append(svgEl('path', { d: 'M0 0 L10 5 L0 10 Z', class: 'chain-head' }));
  defs.append(marker);
  svg.append(defs);

  const arrow = (d: string, cls = 'chain-arrow') => svgEl('path', { d, class: cls, 'marker-end': 'url(#chain-arrow)' });
  const mid = BOX_H / 2;
  svg.append(
    arrow(`M${BOX_W} ${10 + mid} H208`),
    arrow(`M${210 + BOX_W} ${10 + mid} H418`),
    arrow(`M${420 + BOX_W / 2} ${10 + BOX_H} V158`),
    arrow(`M420 ${160 + mid} H${210 + BOX_W + 2}`),
    arrow(`M210 ${160 + mid} H${BOX_W + 2}`),
  );
  const compost = arrow(`M${BOX_W / 2} 160 V125 H${210 + BOX_W / 2} V${10 + BOX_H + 2}`, 'chain-arrow chain-compost');
  const compostLabel = svgEl('text', { x: 196, y: 120, 'text-anchor': 'middle', class: 'chain-compost-label' });
  compostLabel.textContent = 'компост и годни остатъци';
  svg.append(compost, compostLabel);

  const boxes = new Map(
    LINKS.map((l) => {
      const g = svgEl('g', { class: 'chain-box' });
      g.append(svgEl('rect', { x: l.x + 1, y: l.y, width: BOX_W - 2, height: BOX_H, rx: 8 }));
      const t = svgEl('text', { x: l.x + BOX_W / 2, y: l.y + 30, 'text-anchor': 'middle', class: 'chain-title' });
      t.textContent = l.title;
      const sub = svgEl('text', { x: l.x + BOX_W / 2, y: l.y + 52, 'text-anchor': 'middle', class: 'chain-sub' });
      sub.textContent = l.sub;
      g.append(t, sub);
      svg.append(g);
      return [l.id, { g, sub }] as const;
    }),
  );
  return { svg, title, boxes, compost, compostLabel };
}

export function mountNumbersSection(section: HTMLElement, store: Store): void {
  section.replaceChildren();
  const title = el('h2', undefined, 'Храната в числа');
  title.id = 'numbers-title';
  const intro = el('p', 'section-intro', `Ориентир на СЗО: ${bgNumber(KG_PER_PERSON * 1000)} g плодове и зеленчуци на човек на ден.`);

  const calc = el('div', 'calc');
  const people = el('p', 'calc-people');
  const step1 = el('p', 'calc-step');
  const step2 = el('p', 'calc-step');
  const result = el('p', 'calc-result');
  result.setAttribute('aria-live', 'polite');
  const check = el('button', 'button', 'Самопроверка');
  check.type = 'button';
  const checkText = el('p', 'calc-check');
  check.addEventListener('click', () => {
    store.set({ population: 10000 });
    checkText.textContent = 'Проверка: 10 000 жители × 0,4 kg = 4 000 kg = 4 t на ден. Сметката е вярна.';
  });
  const note = el('p', 'muted', 'Това не е прогноза за реалното търсене и не включва загубите при производството.');
  calc.append(people, step1, step2, result, check, checkText, note);

  const chainTitle = el('h3', undefined, 'От ферма до маса');
  const chain = chainSvg();
  const toggleRow = el('label', 'switch');
  const toggle = el('input');
  toggle.type = 'checkbox';
  toggleRow.append(toggle, el('span', undefined, 'Планиране и компостиране'));
  const legend = el('p', 'muted', 'Оранжево: звеното, което настройките затрудняват.');

  section.append(title, intro, calc, chainTitle, chain.svg, toggleRow, legend);

  const renderChain = (weak: LinkId[]) => {
    for (const [id, b] of chain.boxes) b.g.classList.toggle('weak', weak.includes(id));
    const planned = toggle.checked;
    chain.compost.classList.toggle('on', planned);
    chain.compostLabel.classList.toggle('on', planned);
    chain.boxes.get('waste')!.sub.textContent = planned ? 'по-малко с планиране' : 'много изхвърлена храна';
    const names = LINKS.filter((l) => weak.includes(l.id)).map((l) => l.title);
    chain.title.textContent = names.length
      ? `От ферма до маса. Затруднени звена: ${names.join(', ')}.`
      : 'От ферма до маса. Нито едно звено не е затруднено.';
  };
  let lastWeak: LinkId[] = [];
  toggle.addEventListener('change', () => renderChain(lastWeak));

  store.subscribe((s) => {
    const n = produceNeed(s.population);
    people.textContent = `Жители: ${bgNumber(s.population)} (променят се в панела „Население“)`;
    step1.textContent = `${bgNumber(s.population)} × ${bgNumber(KG_PER_PERSON)} kg = ${bgNumber(n.kgPerDay)} kg = ${bgNumber(n.tonnesPerDay)} t на ден`;
    step2.textContent = `${bgNumber(n.tonnesPerDay)} t × 365 дни ≈ ${bgNumber(n.tonnesPerYear, 0)} t на година`;
    result.textContent = `Градът има нужда от ${bgNumber(n.tonnesPerDay)} t плодове и зеленчуци всеки ден.`;
    if (s.population !== 10000) checkText.textContent = '';
    lastWeak = weakLinks(s);
    renderChain(lastWeak);
  });
}
