/** Creates an element with an optional class and text. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Creates an SVG element with attributes. */
export function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** Bulgarian decimal comma and thousands spacing: 14600 → "14 600", 0.4 → "0,4". */
export function bgNumber(n: number, maxDecimals = 1): string {
  const fixed = Math.abs(n).toFixed(maxDecimals).replace(/\.?0+$/, '');
  const [int, dec] = fixed.split('.');
  const spaced = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (n < 0 ? '−' : '') + spaced + (dec ? ',' + dec : '');
}
