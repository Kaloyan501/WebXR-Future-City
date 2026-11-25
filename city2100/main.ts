import { createStore, DEFAULT_STATE } from './core/state.ts';
import type { Scenario } from './core/scenarios.ts';
import scenariosData from './data/scenarios.json';
import { mountBackground } from './ui/background.ts';
import { mountPanel } from './ui/panel.ts';

const scenarios = scenariosData as Scenario[];
const store = createStore(DEFAULT_STATE);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

mountBackground(document.querySelector<HTMLElement>('#bg')!, store, { reducedMotion });
mountPanel(document.querySelector<HTMLElement>('#panel')!, store, scenarios);
