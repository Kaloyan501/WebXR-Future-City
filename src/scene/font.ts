/**
 * Bundled font (Liberation Sans, SIL OFL; covers Latin and Cyrillic) so 3D text works offline.
 * Without this, troika downloads fonts from a CDN at runtime, which fails on a venue Wi-Fi.
 */
export const FONT_URL = `${import.meta.env.BASE_URL}fonts/LiberationSans-Regular.ttf`;
