# HAIZ INNER WORLD V5 — a room that has been lived in

**Status:** Draft art/interaction study on top of V4 PR #18. No main branch changes, no release.

## Editorial intent

The HAIZ concept classroom should feel inhabited, humid, quiet, and structurally plausible. A shader effect or a large number of particles is not the same as realism. This pass adds objects with honest physical size and a small dynamic rain-glass response, keeping the existing editorial UI and stillroom transition intact.

## Delivered in code

- **Eight translucent-looking but opaque physically shaded fabric panels**: shared curved/pleated PlaneGeometry at the real 2.34m windows, distributed with one GPU InstancedMesh. The cloth's sinusoidal depth and varying gathering produces real normal highlights without expensive cloth simulation. All eight panels use one material and one instanced call. Four rail cylinders form another one-call instance.
- **Four rainy glass panels**: a single InstancedMesh with a small WebGL1 fragment shader. Weather controls a continuous wetness uniform, streaks drift down glass in the monsoon; sunbreak yields very faint remnants, clear mornings have no rain. The low-quality tier switches the shader's transparent draw off entirely. No high-resolution scene textures, no postprocessing SSAO/SSR/refraction, no external API or particle animation.
- **Human-scale classroom storytelling:** slim AC condenser cover and louvered outflow, mechanical wall clock, soft continuous curtain rails, a pair of glazing ventilation rails. Muted finishes and physically plausible dimensions rather than decorative glowing objects.
- Existing PBR room, UV2 authored ambient-floor map, hero workstation, three climates, instanced architecture, study mode and fallback unchanged.

## QA contract

- `room-life.js` syntax validated under the immersive-classroom GitHub workflow.
- Browser QA checks eight instanced fabric panels and four rain glazing panes, requires human-scale props to be present, and tests the monsoon weather shader uniform after changing the actual on-screen tab.
- Native mobile packager's SHA256 manifest now requires the new local scene module; offline packaging must still work.
- Real Chromium browser screenshots required at 1440×900 and 390×844 under the three climates, including the seated first-person hero desk view. The action passes only if no network failures or uncaught exceptions.
- Draw call/triangle count is a GPU submission proxy; SwiftShader Chromium isn't evidence of real-device FPS. In the V4 predecessor there were approximately 110 desktop / 79 mobile-viewport calls and 717 static boxes batched into 24 groups. Measure V5 against these.
- Mobile native API33/35 + iOS simulator remain independent gates. On V4 head, API33 and API35 both succeeded, iOS was queued at last inspection; do not infer iOS success.

## Boundaries

This is a **non-measured, original concept classroom** inspired by tropical climate and school life. It is not a scanned 海南中学 building, not Dream Road assets, not physics-based transparent glass refraction, not Blender Cycle-baked global illumination, and not an end-to-end phone performance approval.

## Next serious threshold

Obtain photos/dimensions authorized by the school, artist-author mesh with measured shapes, properly UV-unwrapped building glass/frames, and run an offline bake with real area lights into physically grounded lightmaps. Profile the resulting GLB, texture memory and shaded triangle cost on a real Android handset over sustained 10-minute scenes; keep the current fast WebGL fallback.
