# HAIZ INNER WORLD · Material Depth & GPU Budget — V2

Date: 2026-10-25 · Branch: `feat/immersive-material-depth-and-instancing-20261025` · Review-only.

## Goal

Make the original first-person study room visually more grounded **without adding the latency, thermal cost or unlicensed commercial assets of a copied Unity game**.

The visual reference remains the user-provided *Dream Road / 梦想之路* screenshots. That game has richer authored architecture, better environment material response and much more nuanced sky/atmospheric light. These improvements narrow the engineering gap; they **do not mean HAIZ has achieved Dream Road-equivalent fidelity**.

## Measured before/after: real Chromium WebGL

Identical 1440×900 and 390×844 camera/view settings, weather and version of HAIZ except scene batching. Test uses Linux Chromium 151's software WebGL renderer. Values are WebGL *draw calls*, **not real-device FPS**.

| View | Before | With static GPU instancing | Reduction |
| --- | ---: | ---: | ---: |
| Desktop 1440×900 | 352 | 102 | 250 (~71%) |
| Mobile-size 390×844 | 166 | 58 | 108 (~65%) |

The batching pass replaces **292 meshes with 16 InstancedMesh batches**, saving a calculated 276 mesh draw submissions before camera culling. The observed 250/108 reduction differs from 276 because view frustum and shadow passes affect real draw-call counts. The attached Chromium CI enforces `instancedBoxes>=60`, `geometryBatches>=4`, `drawCallsSaved>=55` and desktop `drawCalls<230`.

**Why this is safe for appearance**: every original BoxGeometry world transform and size is retained in the new instance matrix; material references, normals and UV range are unchanged. Only opaque, static, compatible box surfaces with matching material/shadow/render order are grouped. Dynamic lamp pick targets, alpha-blended glass, weather sky and moving rain are excluded. The batcher runs once after building the room, never per frame.

## Added contact depth

One reusable 128×128 soft radial alpha texture and one instanced floor plane per desk group add a gentle contact shadow beneath tables/chairs. This is a cheap local approximation, **not baked global illumination or physically accurate ambient occlusion**. It stays visible at low quality, where dynamic sunlight shadows may be disabled. The actual ambient/shadow intensity needs visual review on physical devices.

## Exterior foliage refinement

Use the existing original HAIZ `terminalia-leaves.webp` transparency atlas on cross-plane tropical foliage clusters, with an instance budget of 75 / 140 / 240 for low / balanced / high. The test suite must verify that the asset is locally served, shader builds cleanly and draw calls remain inside budget.

## Android capture reliability

Previously the API 33 emulator booted the actual native WebView and completed readiness checks but timed out on Chrome DevTools Protocol's `Page.captureScreenshot` at `initial-screenshot`. The test now uses `adb exec-out screencap -p` to capture the **actual compositor output**, validates a PNG signature, while still performing WebView UI, offline, private-note persistence and JS exception assertions over CDP. This avoids silently dropping screenshot evidence or turning the emulator test into an HTML-only check.

This is a fix for a **specific observed QA harness stall**, not proof of native performance or resolution of unrelated Android bugs.

## What remains necessary for commercial-grade spatial fidelity

1. **Source-verified architecture:** measured facade dimensions and ethically sourced photography/reference materials; mark fictional rooms as concepts.
2. **Authored high-poly-to-low-poly assets:** believable rounded edges, desk metal thickness, upholstery, architectural bevels and trim, ideally made in Blender. Retopologize and unwrap; ship LOD meshes rather than many hero meshes.
3. **Offline lighting bake:** diffuse GI and window-cavity occlusion as authored lightmap/probe data on *static* geometry, separate from time-of-day direct sunlight; expose daylight controls without conflicting baked shadows.
4. **Roughness-driven microdetail:** correct color space for albedo and normal/roughness; distinguish polished ceramic, humid paint, aged stone and wet outdoor paving. Avoid a global glossy floor.
5. **Asset budgets:** KTX2 textures, mesh compression and incremental room-to-campus streaming. Use the measured 250 draw-call desktop saving for real geometry and material value, **not hundreds of decorative particle layers**.
6. **Real hardware acceptance:** Android 13 vivo S10 cold/warm start, battery/temperature, frame-time p95, 10+ minutes exploration and scene-to-STILLROOM handoff; iOS hardware acceptance when signed device testing becomes available.

## Evidence and rights

- [Baseline working 3D scene CI (draw calls 352/166)](https://github.com/manyIwant/haiz/actions/runs/40163051038)
- [Geometry batching CI (102/58)](https://github.com/manyIwant/haiz/actions/runs/40164475244)
- [Dream Road APK read-only notes](../haiz-audit/DREAM-ROAD-APK-STUDY-20261025.md)
- [Original spatial room design contract](IMMERSIVE-ROOM-V1-20261025.md)

No APK assets, unlicensed textures, models, audio or reverse-engineered proprietary implementations are present in HAIZ; only original geometry and the existing locally documented HAIZ material bank are used.
