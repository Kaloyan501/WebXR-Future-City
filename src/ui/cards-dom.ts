import { TAG_COLOR, TAG_LABEL, cssColor, type Content, type Layer, type Pin } from '../content';

function $<T extends HTMLElement = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
}

export interface DomHandlers {
  onLayer(layer: Layer): void;
  onScenario(index: number): void;
  onClose(): void;
}

/** Desktop and mobile overlay: header, layer toggle, scenario slider and the pin card. */
export function initDomUI(content: Content, handlers: DomHandlers) {
  $('#title').textContent = content.site.title;
  $('#site').textContent = content.site.location;

  const layerButtons = [...document.querySelectorAll<HTMLButtonElement>('#layers button')];
  for (const b of layerButtons) {
    b.addEventListener('click', () => handlers.onLayer(b.dataset.layer as Layer));
  }

  const range = $<HTMLInputElement>('#scenario-range');
  const scenarioLabel = $('#scenario-label');
  range.max = String(content.scenarios.length - 1);
  range.addEventListener('input', () => handlers.onScenario(Number(range.value)));

  const card = $('#card');
  const cardTags = $('#card-tags');
  const cardTitle = $('#card-title');
  const cardSummary = $('#card-summary');
  const cardDetails = $('#card-details');
  $('#card-close').addEventListener('click', () => handlers.onClose());

  return {
    showCard(pin: Pin | null) {
      if (!pin) {
        card.hidden = true;
        return;
      }
      cardTags.replaceChildren(
        ...pin.tags.map((t) => {
          const chip = document.createElement('span');
          chip.className = 'chip';
          chip.textContent = TAG_LABEL[t];
          chip.style.background = cssColor(TAG_COLOR[t]);
          return chip;
        }),
      );
      cardTitle.textContent = `${pin.id}. ${pin.title}`;
      cardSummary.textContent = pin.summary;
      cardDetails.textContent = pin.details;
      card.hidden = false;
    },
    setLayer(layer: Layer) {
      for (const b of layerButtons) b.classList.toggle('active', b.dataset.layer === layer);
    },
    setScenario(index: number) {
      range.value = String(index);
      scenarioLabel.textContent = content.scenarios[index].label;
    },
  };
}
