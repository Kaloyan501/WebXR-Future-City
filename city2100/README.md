# Град 2100: website

An interactive model of the fictional "Град 2100". Sliders for climate, resources and population change the live background and every section of the page. It is built for a desktop or projector (1920×1080).

It lives next to the VR city and is published at `…/WebXR-Future-City/city2100/`.

## Run

```bash
npm run dev          # then open http://localhost:5173/city2100/
node --test 'city2100/tests/*.test.ts'
npm run build        # builds both the VR page and this site into dist/
```

## Change the content without touching code

- `data/scenarios.json` holds the "Зареди сценарий" cases. Each one has an `id`, a `name`, a `description` and `values` (temp, humidity, windSpeed, windDir, aqi, uv, water, land, energy).
- More data files (species, meals, methods, diseases) will follow as the other sections are built.

## Where things are

| Path | What |
| --- | --- |
| `core/` | State, level words, scenarios, background maths. Pure code with no page access, so it's covered by tests. |
| `ui/` | Settings panel, scenario picker, live background, page sections. |
| `fonts/` | Manrope (SIL OFL), bundled so the site works without internet. |
