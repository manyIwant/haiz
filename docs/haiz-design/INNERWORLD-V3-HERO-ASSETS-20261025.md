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


## V3.1 follow-up: visual and actual-device fixes

A rendering review of the original V3.0 seated-camera screenshot showed a repeated toy skyline and overly pale empty courtyard. The scene now replaces five distant, nearly identical rectangular buildings with one **original conceptual** 58-metre wide, three-level teaching-wing composition: continuous sheltered gallery, distinct eaves, recessed window/column hierarchy, central vertical landmark, subdued masonry and a paved/landscaped forecourt at believable viewing distance. It is deliberately not described as the actual measured 海南中学 architecture.

The scene continues to use the existing bundled HAIZ paving atlas plus locally authored geometry. No copied game geometry or WebGL network calls.

**Furniture overlap:** formerly the hero set was instantiated on top of a second primitive chair, desk top and duplicate leg framework. The redundant base geometry is now omitted only for that detailed workstation. Ordinary 11 student desks remain cheap, instanced primitives.

**Low tier fidelity:** first V3 incorrectly hid the complete hero chair and lamp when toggling to low quality. The refined LOD hides the pen body/cap, surface tea, cup handle, lamp socket and chair trim, *not* primary desk/chair/lamp silhouette. Browser QA now asserts hero-essential visibility after a real quality toggle.

**Actual native QA reliability:** review of the API 33 failure artifact showed a working native app screenshot still on the study screen, despite the scripted dock tap. The tester incorrectly treated the whole Android display as the WebView when projecting touch Y positions. `mAppBounds` from Android activities explicitly reveals a status-bar start at y=136 pixels on the 1080×2340 emulator. Test taps now map actual DOM element coordinates to native app bounds, not the status/navigation bars. Capture and UI readiness assertions are preserved.

All these are engineering improvements, not device GPU/fps benchmarks or proof of visual parity with Dream Road.
