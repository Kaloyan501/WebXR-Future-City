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

## Notes

- Pin positions are tile coordinates, x and z in [-12, 12]. Pin numbers match the numbering planned for the 3D print.
- VR scale: the plate is scaled to about 1 m (`VR_SCALE` in `main.ts`) and placed on a table-height plinth.
- 3D text uses the bundled `public/fonts/LiberationSans-Regular.ttf` (SIL OFL, covers Latin and Cyrillic) so it works offline. Controller and hand models are still fetched from a CDN at runtime; without internet you get the pointer ray only.
- Replacing the placeholder city: export a GLB from Blender, then
  `npx gltf-transform optimize assets-src/city.glb public/models/city.glb --compress meshopt`
  and load it with `GLTFLoader` + `MeshoptDecoder` in place of `buildCity`. Keep `groundHeight()` in sync with your model so pins sit on the ground.
- All card text is draft. Verify facts and add sources before the demo.
