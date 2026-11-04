# Abyssal Submersibles

A scroll-driven three.js website for a (fictional) deep-ocean submarine company. The layout and visual
language follow [seasgeosciences.com](https://seasgeosciences.com/): dark navy and coral palette, Clash Display /
DM Sans / JetBrains Mono type, a radar-dial loader, a glass pill nav, staggered value cards, a fleet
carousel, a particle globe, a glass contact card and a giant footer wordmark.

The whole page is one continuous dive. Scrolling takes the camera from a dusk ocean surface down to the
Challenger Deep (10,935 m), with a depth / pressure / temperature HUD on the way down.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build in dist/
npm run preview   # serve the production build
```

## What's in the 3D scene

All geometry is procedural — there are no model, texture or audio files.

| File | What it does |
| --- | --- |
| `src/gl/Submarine.js` | Lathed hull with an anechoic-tile bump map, sail, X-form stern planes, pump-jet with spinning rotor, floodlights with volumetric beams and spotlights, nav lights, hotspot anchors |
| `src/gl/Ocean.js` | Gerstner-style swell, Fresnel sky reflection from above, Snell's window and total internal reflection from below, dusk sky dome, god rays |
| `src/gl/Particles.js` | Marine snow that wraps around the camera, plus bubble trails from the propulsor |
| `src/gl/Seabed.js` | fBm terrain with a trench, rocks, glowing sonar contour lines and a sweeping ping |
| `src/gl/Globe.js` | Dotted Earth with dive-site markers and animated arcs from the home port |
| `src/gl/TitleSign.js` | The giant "ABYSSAL" wordmark standing on the horizon |
| `src/gl/World.js` | Renderer, lights, depth-based fog and light falloff, bloom post-processing |
| `src/timeline.js` | Scroll → camera / submarine keyframes, one per section |

UI modules live in `src/ui/` (loader text scramble, word-mask reveals, carousel, HUD, menu, procedural
WebAudio ambience with sonar pings, 3D hotspot labels).

## Editing content

- Section copy is plain HTML in `index.html`.
- Fleet vehicles (names, specs, SVG blueprints) and heritage cards are in `src/ui/art.js`.
- To move the camera or submarine for a section, edit its keyframe in `src/timeline.js`.
