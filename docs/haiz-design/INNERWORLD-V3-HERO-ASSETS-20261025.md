# HAIZ INNER WORLD · V3 hero-furniture art pass

**Status:** Draft art-direction prototype, 2026-10-25. Child of PR #15. Not deployed.

## What was actually delivered

- A hero workstation with beveled tabletop and edge band rather than only six-sided blocks.
- A physically legible journal, thin-page block and spine, pen cap, lathed porcelain tea vessel with handle, segmented desk lamp and soft chair upholstery.
- A single 256² **static analytic window-bounce atlas** sampled on the floor; no realtime global-illumination solver or additional full-screen postprocessing pass.
- Quality tiers hide nonessential hero ornament on *low* while keeping load-bearing geometry and the existing instanced classroom intact.
- An explicit second camera capture in Chromium CI after the user clicks “坐下来”, to test the actual desk composition rather than just the front-of-room view.
- Improved directional/ambient contrast after reading the actual first V3 screenshot.
- Android UI automation uses actual Android input `adb shell input tap`, targeting element positions resolved from the real CDP-inspected WebView; screenshots come from `screencap -p`. All readiness/offline/note assertions continue to run through CDP.

## Rendering budget / acceptance

Compared with PR #15's instanced baseline (102 calls on desktop, 58 on phone-sized viewport) the first fully rendered V3 scene with hero models and bounce atlas used:

- 1440 × 900: **112 draw calls**, with 286 box meshes in 15 instanced groups.
- 390 × 844: **61 draw calls** at balanced quality.

These were recorded in real Chromium WebGL before the final contrast pass, with the same 3-weather screenshots. Numbers are GPU draw submissions, not thermal, actual device FPS or comparable Apple Silicon GPU frame times.

**Art issue found by viewing first V3 rendered screenshot:** scene remains flatter and brighter than the targeted atmospheric game reference. Follow-up commit adjusts ACES exposure, outdoor-facing plaster albedo and direct/ambient ratios. Test the changed image before accepting.

## What we have **not** done

Blender is **not installed** on the connected Mac. The current additions are original procedural Three.js geometry and a generated analytic texture, not Blender-baked Cycles GI, an authored full UV lightmap, or reconstructed measured 海南中学 room data. We did not redistribute `梦想之路` / Dream Road assets. Its artistic standard is a benchmark, **not a claim of parity**.

## Next real quality threshold

An artist-generated desk/room GLB with optimized UVs and true AO/lightmaps, material texture atlases, three LODs, meshopt/Draco/KTX2 as appropriate, then rendering/footprint measurements on the actual vivo S10. The scene should keep a small lightweight fallback for unsupported WebGL devices.

CI should not be green-lit purely for feature existence: inspect weather and close-up screenshots for clipped highlights, unreadable title, unrealistic geometry, and any desk overlap.
