// Section "Дневно меню": Menu Б vs Menu А for four meals, dish breakdowns, and the audience vote
// that decides which menu the "Начин на живот" section uses.
import type { Store } from '../../climate/state.ts';
import { dailyMenu, dishTotals, SLOTS, voteResult, type Dish, type MealsData } from '../../climate/menu.ts';
import { el } from '../dom.ts';

const BAND_NAME = { cold: 'студен', temperate: 'умерен', warm: 'топъл' } as const;


const num = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',');

function openDish(dialog: HTMLDialogElement, dish: Dish, note: string): void {
  const t = dishTotals(dish);
  dialog.replaceChildren();
  const h = el('h2', undefined, dish.name);
  h.id = 'dish-dialog-title';
  const drink = el('p', 'muted', `Напитка: ${dish.drink}`);

  const table = el('table', 'dish-table');
  const head = el('tr');
  for (const c of ['Съставка', 'г', 'kcal', 'Белтъци', 'Въглехидрати', 'Мазнини']) head.append(el('th', undefined, c));
  const thead = el('thead');
  thead.append(head);
  const tbody = el('tbody');
  for (const i of dish.ingredients) {
    const tr = el('tr');
    tr.append(
      el('td', undefined, i.name),
      el('td', undefined, num(i.grams)),
      el('td', undefined, num(i.kcal)),
      el('td', undefined, `${num(i.protein)} г`),
      el('td', undefined, `${num(i.carbs)} г`),
      el('td', undefined, `${num(i.fat)} г`),
    );
    tbody.append(tr);
  }
  const tfoot = el('tfoot');
  const total = el('tr');
  total.append(
    el('th', undefined, 'Общо'),
    el('td'),
    el('td', undefined, num(t.kcal)),
    el('td', undefined, `${num(t.protein)} г`),
    el('td', undefined, `${num(t.carbs)} г`),
    el('td', undefined, `${num(t.fat)} г`),
  );
  tfoot.append(total);
  table.append(thead, tbody, tfoot);

  const extra = el('p', undefined, `Фибри: ${num(t.fiber)} г · Вода: около ${num(dish.water)} мл`);

  const lists = el('div', 'pros-cons');
  const pros = el('div');
  pros.append(el('h3', undefined, 'Плюсове'));
  const pl = el('ul');
  for (const p of dish.pros) pl.append(el('li', undefined, p));
  pros.append(pl);
  const cons = el('div');
  cons.append(el('h3', undefined, 'Минуси'));
  const cl = el('ul');
  if (dish.cons.length === 0) cl.append(el('li', 'muted', 'Няма съществени минуси по хранителни вещества.'));
  for (const c of dish.cons) cl.append(el('li', undefined, c));
  cons.append(cl);
  lists.append(pros, cons);

  const close = el('button', 'button', 'Затвори');
  close.type = 'button';
  close.addEventListener('click', () => dialog.close());
  dialog.append(h, drink, table, extra, lists, el('p', 'dish-note muted', note), close);
  dialog.showModal();
}

export function mountMenuSection(section: HTMLElement, store: Store, data: MealsData): void {
  section.replaceChildren();
  const title = el('h2', undefined, 'Дневно меню');
  title.id = 'menu-title';
  const intro = el('p', 'section-intro');

  const table = el('table', 'menu-table');
  const head = el('tr');
  head.append(el('th', undefined, 'Хранене'), el('th', undefined, 'Меню Б · балансирано'), el('th', undefined, 'Меню А · удобно'));
  const thead = el('thead');
  thead.append(head);
  const tbody = el('tbody');
  const cells = SLOTS.map((slot) => {
    const tr = el('tr');
    const th = el('th', undefined, data.slots[slot]);
    th.scope = 'row';
    const b = el('td');
    const a = el('td');
    tr.append(th, b, a);
    tbody.append(tr);
    return { slot, a, b };
  });
  table.append(thead, tbody);

  const notes = el('ul', 'menu-notes');

  const dialog = el('dialog', 'dish-dialog');
  dialog.setAttribute('aria-labelledby', 'dish-dialog-title');

  // Audience vote: counts live in the page; the winner becomes the chosen menu.
  const vote = el('div', 'vote');
  vote.append(el('h3', undefined, 'Публиката избира'));
  const votes = { A: 0, B: 0 };
  const row = el('div', 'vote-row');
  const voteB = el('button', 'button');
  const voteA = el('button', 'button');
  const reset = el('button', 'button-quiet', 'Нулирай');
  for (const b of [voteB, voteA, reset]) b.type = 'button';
  row.append(voteB, voteA, reset);
  const result = el('p', 'vote-result');
  result.setAttribute('aria-live', 'polite');
  vote.append(row, result);

  const renderVotes = () => {
    voteB.textContent = `Меню Б · ${votes.B}`;
    voteA.textContent = `Меню А · ${votes.A}`;
    const chosen = voteResult(votes.A, votes.B);
    result.textContent = chosen
      ? `Избрано: Меню ${chosen === 'A' ? 'А' : 'Б'}. Виж как това променя „Начин на живот“.`
      : votes.A + votes.B > 0
        ? 'Равен брой гласове – още няма избрано меню.'
        : 'Гласувайте с бутоните. Избраното меню влияе на „Начин на живот“.';
    store.set({ chosenMenu: chosen });
  };
  voteB.addEventListener('click', () => { votes.B++; renderVotes(); });
  voteA.addEventListener('click', () => { votes.A++; renderVotes(); });
  reset.addEventListener('click', () => { votes.A = 0; votes.B = 0; renderVotes(); });
  renderVotes();

  section.append(title, intro, table, notes, vote, dialog);

  const dishButton = (id: string, changed: boolean) => {
    const dish = data.dishes[id];
    const btn = el('button', 'dish');
    btn.type = 'button';
    btn.append(el('span', 'dish-name', dish.name), el('span', 'dish-drink', `+ ${dish.drink}`));
    if (changed) btn.append(el('span', 'dish-changed', 'заменено според условията'));
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.addEventListener('click', () => openDish(dialog, dish, data.note));
    return btn;
  };

  store.subscribe((s) => {
    const m = dailyMenu(s, data);
    intro.textContent = `Меню за ${BAND_NAME[m.band]} климат. Натисни ястие, за да видиш калориите и хранителните вещества.`;
    for (const c of cells) {
      c.b.replaceChildren(dishButton(m.B[c.slot], m.changed.includes(c.slot)));
      c.a.replaceChildren(dishButton(m.A[c.slot], false));
    }
    notes.replaceChildren(...m.notes.map((n) => el('li', n.warning ? 'note-warn' : undefined, n.text)));
    notes.hidden = m.notes.length === 0;
  });
}
