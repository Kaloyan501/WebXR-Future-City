import { createStore, DEFAULT_STATE } from './core/state.ts';
import type { Scenario } from './core/scenarios.ts';
import scenariosData from './data/scenarios.json';
import { mountPanel } from './ui/panel.ts';

const scenarios = scenariosData as Scenario[];
const store = createStore(DEFAULT_STATE);

mountPanel(document.querySelector<HTMLElement>('#panel')!, store, scenarios);
