// The "Зареди сценарий" list. Picking a case fills every slider at once.
import type { Store } from '../climate/state.ts';
import { applyScenario, type Scenario } from '../climate/scenarios.ts';

export function openScenarioPicker(store: Store, scenarios: Scenario[]): void {
  const dialog = document.querySelector<HTMLDialogElement>('#scenario-dialog')!;
  const current = store.get().scenarioId;

  dialog.replaceChildren();
  const title = document.createElement('h2');
  title.id = 'scenario-dialog-title';
  title.textContent = 'Зареди сценарий';
  const intro = document.createElement('p');
  intro.className = 'muted';
  intro.textContent = 'Изборът попълва всички настройки наведнъж. След това можеш да ги местиш ръчно.';

  const list = document.createElement('ul');
  list.className = 'scenario-list';
  for (const sc of scenarios) {
    const item = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'scenario-option';
    if (sc.id === current) btn.setAttribute('aria-current', 'true');
    const name = document.createElement('strong');
    name.textContent = sc.name;
    const desc = document.createElement('span');
    desc.textContent = sc.description;
    btn.append(name, desc);
    btn.addEventListener('click', () => {
      store.set(applyScenario(sc));
      dialog.close();
    });
    item.append(btn);
    list.append(item);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'button';
  close.textContent = 'Затвори';
  close.addEventListener('click', () => dialog.close());

  dialog.append(title, intro, list, close);
  dialog.showModal();
}
