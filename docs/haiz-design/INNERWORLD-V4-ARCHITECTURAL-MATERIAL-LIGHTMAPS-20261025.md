# HAIZ INNER WORLD V4 — Architecture material response & pre-authored local lightmaps

**Date:** 2026-10-25. **Branch:** `feat/innerworld-architectural-lightmaps-v4-20261025`. **Status:** independent Draft PR on top of V3 PR #17, no merge/deploy.

## What changed in the actual browser scene

The V3 corridor-facing building already had 51 windows but still read as a flat building diagram. V4 improves it by adding:
- Original localized PBR material groups for weathered plaster, stone sills, projecting cornices and tiled courtyard. Exterior diffuse albedo, normal relief and roughness are separate locally shipped HAIZ texture maps. The wall stays matte and avoids uniform reflective glazing.
- Physical geometry at each bay: window-side reveals, independent raised projecting sills and narrow glazing reflections, plus load-bearing downpipe dimensions and subtle individual weathering strips. The **existing GPU instance grouping** batches repeated bay geometry to keep CPU draw submissions small.
- A room-floor `MeshStandardMaterial.aoMap` with a separate `uv2` attribute (copied from the validated top-face UVs), applying a **512 × 512 authored, local static ambient-occlusion atlas** instead of rendering a full-screen SSAO pass. This captures near-wall darkness and the footprint of the 12 desk locations at low cost, without collapsing all ambient light.
- A pre-authored **512 × 512 local SVG window-bounce atlas** that replaces V3's loop calculating 65,536 RGBA pixels via Canvas on every room startup. It is the same floor-plane single overlay and is dynamically dimmed for monsoon or morning weather; no repeated CPU baking or remote asset requests.

### Important lighting accuracy statement

**These are artist-authored, analytical occlusion and diffuse-bounce approximations. They are not Monte Carlo path-traced GI, Cycles light bakes, physical irradiance probes, HDRP or true indoor PBR global illumination.** The V4 improvement is a physically **motivated** static floor AO using the real `aoMap/uv2` material interface and a small preauthored window-atlas with the correct lighting direction. It should not be represented as exact physical radiometry or Dream Road parity. True offline surface lightmaps would require proper UV2 unwrap, room mesh, Blender/Cycles/other baker, and approved architectural source measurements.

## Real rendering and budgets

Measured on the first fully integrated V4 WebGL build, via real Chromium software WebGL screenshots, [CI run 40168051397](https://github.com/manyIwant/haiz/actions/runs/40168051397).

| Fixed view | V3.1 | V4 | Notes |
| --- | ---: | ---: | --- |
| Desktop 1440 × 900 draw calls | 105 | **110** | +5 with new materials / depth |
| Mobile 390 × 844 draw calls | 75 | **79** | +4 with detail; no physical phone benchmark |

- Existing 496 opaque boxes batched in 19 groups (V3.1) became **717 static boxes in 24 groups** (V4), for 693 potentially avoided primitive draw submissions.
- V4 first-run screenshot test passed for three weather presets, seating close-up, pointer/touch navigation, static UV2 floor AO material, localized PBR exterior, no missing network requests, no JS exceptions.
- Actual device frame-time, thermal and battery tests remain outstanding. WebGL's `fps:60` diagnostics in software Chromium must **not** be interpreted as real vivo/iPhone FPS.

## Optimization / integrity

- The source of exterior color/normal/roughness is HAIZ's existing original local `plaster-*.jpg` and `terrazzo-*.jpg` textures, not a copied Unity game.
- The two new tiny lightmaps are local, text-based SVGs; valid test server MIME, bundled with `world` source and made available offline. No GLSL screen-space GI expensive passes, no loading external CDNs.
- Geometry is constructed exactly once, then passed through the existing static instancer. All authored hero furniture and LOD constraints stay intact.
- The lightmap UV2 for a box is an intermediate approximation. Once an unwrapped architectural GLB is available, bake lightmap texture for its real UV2 rather than copying UV0.

## Open native QA

The previous PR #17 native smoke passed web-assets/android-build and Android API 33, but Android API 35 failed at `real application ready assignments` while a **Quickstep (Android launcher) ANR system dialog** was present in the CI screenshot. That is evidence of emulator/system-test instability, not proof that HAIZ failed to boot or navigated correctly. Do not change app assertions to green based on a cosmetic fix. Full stable Android 33/35 and iOS simulator checks on the **new V4 PR** remain mandatory before release.

## Next threshold

1. Offline native AO/lightmaps for correctly unwrapped, authored architectural GLBs using physically based baker.
2. Reference-photo matched facades and accurate tropical planting composition rather than invented school dimensions.
3. Geometry/texture LOD for nearby hero props, KTX2 compressed maps when packaging tests permit.
4. Real vivo S10 API13 system WebView runs, over 10 minutes continuous and cold starts, including a full scene-to-STILLROOM handoff.
