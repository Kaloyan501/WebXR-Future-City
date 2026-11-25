# Climate City 2126 (WebXR scaffold)

Three.js + Vite + TypeScript. One scene, two ways to view it: isometric on desktop/mobile, and a table-top model with floating cards in VR (Meta Quest 3S via the Quest Browser).

## Setup

```bash
npm i three troika-three-text
npm i -D @types/three iwer @iwer/devui @gltf-transform/cli meshoptimizer
npm run dev
```

Delete the template leftovers: `src/counter.ts`, `src/assets/`.

## Testing

- **Desktop, no headset:** `npm run dev`. In dev builds an in-page emulator (IWER + DevUI) installs itself when no real VR is available, so the **ENTER VR** button works and the DevUI panel moves the headset and controllers. It is stripped from production builds.
- **Real Quest 3S over USB (hot reload):** enable developer mode, then
  `adb reverse tcp:5173 tcp:5173` and open `http://localhost:5173` in the Quest Browser. Remote DevTools: `chrome://inspect` on the laptop.
- **Production check:** `npm run build && npm run preview`, or deploy `dist/` to GitHub Pages/Netlify (HTTPS is required for WebXR).

## Where things live

| Path | What |
| --- | --- |
| `content/content.json` | Single source of truth: site, scenarios (water levels), pins (id, tags, tile position, card text). Edit this, not the code. |
| `src/scene/city.ts` | Placeholder procedural city (24x24 tiles) with terrain, roads, buildings, trees, water. Replace with your GLB later. |
| `src/scene/pins.ts` | Pins and number labels, layer filtering (Geography/Biology), selection. |
| `src/ui/cards-dom.ts` | Desktop/mobile overlay (header, layer toggle, scenario slider, card). |
| `src/ui/cards-vr.ts` | In-scene VR toolbar and floating card (DOM does not show in VR). |
| `src/xr/emulator.ts` | Dev-only emulator install. |
| `src/main.ts` | Renderer, isometric camera, picking, XR input, VR placement. |
| `content/climate-scenarios.json` | The five ready-made climate scenarios behind "Зареди сценарий" (temperature, humidity, wind, AQI, UV, water, land, energy). |
| `content/meals.json`, `diseases.json`, `species.json`, `methods.json`, `foods.json` | Text and numbers for the Град 2100 sections (menus and nutrition, disease risks, species, ways to grow food, nutrients). Edit these, not the code. |
| `src/climate/` | Climate settings: state, level words, scenarios, background maths, transitions, sunlight and haze. Pure code with tests in `tests/climate/` (`node --test 'tests/climate/*.test.ts'`). |
| `src/ui/climate-page.ts` | Град 2100 page over the 3D city: top bar, section column, settings panel, bar toggles, presentation mode. Moves the existing title, layer buttons, sea-level slider and card into that layout. |
| `src/ui/sections/` | The seven Град 2100 sections. `src/ui/vr-climate-menu.ts` is the climate panel in the A-button controller menu. |
| `src/scene/weather.ts`, `weather3d.ts` | Climate on the 3D model: sunlight, haze, rain, snow and clouds (also in VR). |
| `src/ui/sky.ts` | Sky colour behind the 3D city. |

## Notes

- Pin positions are tile coordinates, x and z in [-12, 12]. Pin numbers match the numbering planned for the 3D print.
- VR scale: the plate is scaled to about 1 m (`VR_SCALE` in `main.ts`) and placed on a table-height plinth.
- 3D text uses the bundled `public/fonts/LiberationSans-Regular.ttf` (SIL OFL, covers Latin and Cyrillic) so it works offline. Controller and hand models are still fetched from a CDN at runtime; without internet you get the pointer ray only.
- All card text is draft. Verify facts and add sources before the demo.

## Placing 3D models on tiles

Models are GLB files in `public/models/`, listed under `placements` in `content/content.json`:

```json
"placements": [
  { "model": "models/house.glb", "tile": [10, 12] },
  { "model": "models/tower.glb", "tile": [4, 4], "rotation": 90, "scale": 1.2 },
  { "model": "models/park.glb",  "tile": [14, 6], "span": [2, 2] }
]
```

- `tile` is `[col, row]`, 0-based. In the isometric view `[0, 0]` is the top corner of the plate, `col` grows towards the lower right (the sea) and `row` towards the lower left. A pin at world `[x, z]` sits on tile `[floor(x + GRID/2), floor(z + GRID/2)]`, so existing pins are handy landmarks.
- Every model is scaled to fit inside its footprint (`span`, default 1x1 tile), keeping its proportions, centred on the footprint and standing on the terrain. Model origin and units do not matter. Export with +Y up.
- `rotation` is degrees about the vertical axis and is applied before fitting, so 90 swaps the footprint's width and depth.
- `scale` multiplies the fitted size (above 1 overflows the tile). `offsetY` lifts the model.
- Tiles covered by a model get no procedural building or tree. Roads stay, and the model stands on them.
- A multi-tile model stands on the highest terrain tile under its footprint.
- A model that is missing, broken or outside the grid is skipped with a console warning; the rest still load.
- Compress for the Quest: `npx gltf-transform optimize in.glb public/models/out.glb --compress meshopt --texture-compress webp` (meshopt is decoded automatically).

## Changing the grid size

`GRID` in `src/scene/city.ts` is the only number to change. The VR scale and zoom limits and the desktop camera framing in `main.ts` are derived from it, and tile maths goes through `tileToWorld`. Still hand-tuned for 24, so check them after changing it:

- `terrainHeight()` in `city.ts`: the coastline is fixed at x = 5, so a much smaller plate loses its beach and sea.
- Roads are every 4th row and column (`i % 4`, `j % 4` in `buildCity`).
- Pin `position`s in `content.json` are world units, so they do not move with the grid. Keep them within +-GRID/2.
- The desktop camera sits at (40, 40, 40) with a far plane of 300. That is fine up to about GRID = 48. Beyond that, move it back.
