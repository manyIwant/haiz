# Campus Journal 03 · Design notes

## Visual direction

Warm paper `#f1eee4`, forest ink `#243f35`, clay `#a05035`, pale citron `#c3c985`. Existing campus photography, generous serif Chinese typography, local Sora labels, asymmetrical editorial columns and image-led transitions. The site is a campus journal and a portal into an explorable model.

Research references (inspiration, no copied website artwork or protected source):

- https://www.awwwards.com/sites/siena-film-foundation — editorial motion, film-strip rhythm and cream/ink typography.
- https://www.awwwards.com/sites/active-theory-v6 — immersive spatial storytelling and navigation.
- https://blog.playstation.com/2024/10/17/horizon-zero-dawn-remastered-a-deep-dive-into-its-enhancements/ — consistency of foliage, surfaces and lighting; a visual direction reference, not an engine or asset import.
- https://www.guerrilla-games.com/read/siggraph-live-decima — real-time environment features must fit performance and memory budgets.
- https://github.com/Soromytko/godot-open-world — instancing, spatial partitions and distance-dependent detail.
- https://github.com/DigitallyTailored/Godot-Open-World-Database — nearby scene content and chunk visibility.
- https://github.com/mrdoob/three.js/blob/dev/examples/games_fps.html — first-person interaction/collision reference.
- https://github.com/Abdulrezak-halid/3d-classroom — classroom furnishing reference; no code or model copied.

This is a browser prototype with representative architecture and imagined ground-floor interiors. It does not claim to reproduce AAA game rendering, use ray tracing, or reproduce surveyed room layouts.

## Materials

Poly Haven CC0 material sources (license: https://polyhaven.com/license):

- https://polyhaven.com/a/terrazzo_tiles
- https://polyhaven.com/a/plastered_wall_04
- https://polyhaven.com/a/wood_table_001
- https://polyhaven.com/a/aerial_grass_rock
- https://polyhaven.com/a/concrete_floor_02
- https://polyhaven.com/a/kloofendal_48d_partly_cloudy — used for illumination/reflection, not as a Hainan landscape background.

Albedo images use sRGB encoding; normal and roughness maps remain linear. Ground surfaces repeat at a scale derived from world dimensions. Interiors retain their own texture scale. Leaves use alpha-tested instanced cards with matched alpha shadow materials. HDR is prefiltered through Three.js PMREM; a daylight fallback remains available.

## Generated foliage asset

- Tool: built-in image generation, transparent-background mode.
- Final project path: `assets/walk/textures/terminalia-leaves.webp`
- Original project asset, generated for this repository, resized to 768px WebP with alpha retained. It is not a photograph of an actual campus tree.
- Consumed by `assets/walk/interiors.js` (loader) and `assets/walk/world.js` (instanced foliage).

Final prompt:

> Use case: photorealistic-natural. Asset type: alpha-cutout foliage cluster texture for a realistic Three.js tropical campus tree, not a standalone illustration. Generate one dense but airy irregular leafy branch cluster of Terminalia catappa (tropical almond) and broad tropical evergreen leaves, photographed with a telephoto camera against a genuinely transparent background. Show approximately 35–60 mature broad oval green leaves in layered overlapping clusters on slender natural brown twigs; realistic visible veins, a few slightly browned edges, subtle leaf-size variations. Neutral diffuse daylight with warm transmitted light through some leaves, restrained natural olive and deep green coloration. Front and slightly oblique facing leaves, lit equally enough to work from either side. Fill central 85% of a square frame, silhouette gently feathered with individual leaves and genuine transparent gaps. No tree trunk, no pot, no ground, no sky, no white outline, no hard rectangular edges, no text or watermark. This is a production 3D foliage billboard texture: photographic botanical detail, not CGI blobs, not cartoon, not a full tree.

## Content model

Original source-linked news remains archival, with its recorded date and source URL. Items without source URLs are shown as pending verification. Existing `demo` flags remain visible as sample summaries. Club names, proposals and activities are invented and carry sample labels. The radio column contains fictional, non-personal micro-stories. No real pupil is depicted or made the subject of a rumor.

Saves, personal choices and notes use only the `haiz.journal.v3.*` localStorage namespace. Notes are rendered as text nodes, not HTML. There is no account service or public posting backend.
