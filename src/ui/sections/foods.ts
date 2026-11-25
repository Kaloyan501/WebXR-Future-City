// Section "Храни": the most common meal under the current conditions (plate and drink on a table,
// with an arrow to the menu), what each nutrient does, and examples for this climate.
import type { Store } from '../../climate/state.ts';
import { typicalMeal, type FoodsData } from '../../climate/foods.ts';
import { dailyMenu, type MealsData } from '../../climate/menu.ts';
import { el, svgEl } from '../dom.ts';

/** A plate and a glass on a table, in the same simple line style as the rest of the page. */
function mealIcon(): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 120 70', class: 'meal-icon', 'aria-hidden': 'true' });
  svg.append(
    svgEl('line', { x1: 4, y1: 60, x2: 116, y2: 60 }),
    svgEl('ellipse', { cx: 48, cy: 50, rx: 34, ry: 8 }),
    svgEl('ellipse', { cx: 48, cy: 47, rx: 22, ry: 4.5 }),
    svgEl('path', { d: 'M88 22 L92 58 L104 58 L108 22 Z' }),
    svgEl('line', { x1: 89.5, y1: 34, x2: 106.5, y2: 34 }),
  );
  return svg;
}

export function mountFoodsSection(section: HTMLElement, store: Store, foods: FoodsData, meals: MealsData): void {
  section.replaceChildren();
  const title = el('h2', undefined, 'Храни');
  title.id = 'foods-title';

  const card = el('div', 'typical');
  const cardText = el('div');
  const mealName = el('p', 'typical-name');
  const mealDrink = el('p', 'typical-drink');
  const mealWhy = el('p', 'muted');
  const toMenu = el('a', 'to-menu', 'Към дневното меню ↓');
  toMenu.href = '#menu';
  cardText.append(el('p', 'typical-label', 'Най-срещаното ядене при тези условия'), mealName, mealDrink, mealWhy, toMenu);
  card.append(mealIcon(), cardText);

  const nutrientsTitle = el('h3', undefined, 'Хранителните вещества и тяхната роля');
  const nutrients = el('dl', 'nutrients');
  for (const n of foods.nutrients) {
    const dd = el('dd');
    dd.append(`${n.role}. `, el('span', 'muted', `Например: ${n.examples}.`));
    nutrients.append(el('dt', undefined, n.name), dd);
  }

  const examplesTitle = el('h3', undefined, 'Примери за този климат');
  const examples = el('ul', 'examples');

  section.append(title, card, nutrientsTitle, nutrients, examplesTitle, examples);

  store.subscribe((s) => {
    const t = typicalMeal(s, foods);
    mealName.textContent = t.name;
    mealDrink.textContent = `+ ${t.drink}`;
    mealWhy.textContent = t.why;

    const m = dailyMenu(s, meals);
    const full = meals.dishes[m.B.lunch];
    const poor = meals.dishes[m.A.lunch];
    const fullLi = el('li');
    fullLi.append(el('b', undefined, 'Пълноценен обяд: '), `${full.name}. `, el('span', 'muted', full.pros[0] ?? ''));
    const poorLi = el('li');
    poorLi.append(el('b', undefined, 'Непълноценен обяд: '), `${poor.name}. `, el('span', 'muted', poor.cons[0] ?? ''));
    examples.replaceChildren(fullLi, poorLi);
  });
}
