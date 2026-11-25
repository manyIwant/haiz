# Third-Party Open-Source Attributions & Licenses

NIANLUN Interaction Lab 002 explicitly follows the HAIZ principle of **not reinventing the wheel** and stands on the shoulders of the following open-source projects. All license terms and copyright notices are preserved below.

| Library / Source | Version | License | Author / Repository | Role in NIANLUN 002 |
| --- | --- | --- | --- | --- |
| **d3-force** | `3.0.1` | ISC | Mike Bostock · https://github.com/d3/d3-force | Velocity Verlet spatial yielding & collision physics in Experiment I |
| **d3-delaunay** | `6.0.6` | ISC | Mike Bostock / Mapbox · https://github.com/d3/d3-delaunay | 60fps Voronoi cellular membrane tessellation in Experiment II |
| **d3-fisheye** | `2.1.2` | BSD-3-Clause | Duane Millar Barlow · https://github.com/duaneatat/d3-fisheye | Smooth Sarkar-Brown radial optical distortion in Experiment II |
| **d3-hierarchy** | `3.1.3` | ISC | Mike Bostock · https://github.com/d3/d3-hierarchy | Polar hierarchy & partition subdivision in Experiment IV |
| **d3-shape** | `3.2.0` | ISC | Mike Bostock · https://github.com/d3/d3-shape | Annular arc geometry generation in Experiment IV |
| **d3-interpolate** | `3.0.1` | ISC | Mike Bostock · https://github.com/d3/d3-interpolate | Interruptible polar domain interpolation in Experiment IV |
| **d3-ease** | `3.0.1` | ISC | Mike Bostock · https://github.com/d3/d3-ease | Easing utilities |
| **flubber** | `0.4.2` | MIT | Noah Veltman · https://github.com/veltman/flubber | Smooth 2D SVG shape morphing (seed blob ↔ squircle aperture) in Experiment I |
| **GSAP** | `3.15.1` | GSAP Standard "No Charge" License | GreenSock / Webflow · https://gsap.com/community/standard-license/ | Elastic spring overshoot, optical focal lock, and interruptible transitions |
| **Kando `GestureDetector`** | Adapted from `main` | MIT | Simon Schneegans · https://github.com/kando-menu/kando | Corner-turn & pause marking-menu gesture recognition in `src/kando-gesture.js` (Experiment III) |

## Architectural / Conceptual Inspirations (No code copied directly)

- **Codrops Elastic SVG Elements** (https://github.com/codrops/ElasticSVGElements) & **Organic Shape Morph Ideas** (https://github.com/codrops/ShapeMorphIdeas) — Inspired the elastic spring overshoot and organic boundary breathing in Experiment I.
- **Mike Bostock's Fisheye Distortion** (https://bost.ocks.org/mike/fisheye/) — Inspired the Focus+Context cellular membrane paradigm in Experiment II.
- **Zumerlab Orbit** (https://github.com/zumerlab/orbit, MIT) — Studied for radial layout architecture and angular coordinate conventions.
- **HAIZ Fucheng Campus Dataset** (`data/buildings.json`, `docs/lanren-rings-20261114.md`) — Provided authentic campus landmark relative bearings and historical climate/solar anchors.
