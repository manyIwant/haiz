# HAIZ INNER WORLD · Walk-in Classroom (V1)

Status: **experimental design candidate**, 2026-10-25. Do not publish as a surveyed reproduction or a production APK.

## Why this is a different experience

STILLROOM remains the deliberately lightweight local-first 2.5D focus space. The new `world/room/immersive/` is a **separate, optional, actual WebGL interior** that proves a believable spatial transition: campus → room → study desk. It does not replace or copy a proprietary Unity project.

The app builds a fictional 14 × 11 m classroom with physics-inspired material and light response; building proportions and window view are **illustrative**, not a claim about a real classroom's interior.

## Visual foundation

- Meter-scaled architecture, doorways/wall piers, PBR roof/plaster/timber/terrazzo, shadeable desks and glass.
- Reuses material texture files already present and sourced in the HAIZ repository; locally bundled campus HDR lighting is optional and gracefully falls back.
- A warm late-sunbreak, a desaturated humid monsoon and a quiet morning all transform the same environment rather than rebuilding it.
- Real WebGL sunlight and shadow mapping (quality-tier budget), cloud sky shader, exponential-distance fog, depth-preserving window glass and conservative rain outside the building.
- Building facade silhouettes and instanced foliage create near/middle/distant visual layers.
- Responsive framing, large focus-state labels, no remote analytics, no live school weather, no school login.

The comparison target is the cinematic quality of *Dream Road* weather/lighting screenshots, not its vehicles or maps. The user-supplied APK is **not** redistributed or imported; the scene uses original geometry and preexisting locally attributed HAIZ textures.

## Interaction contract

1. Desktop: click to enter; mouse lock and WASD/arrows; escape releases pointer lock.
2. Mobile: left touch pad moves; drag the right screen half to look around. Manual quality cycle is available.
3. Weather grades are manually selected with on-screen buttons (keyboard 1–3).
4. `坐下来，开始专注` animates a local camera to a desk; the next action **navigates to the existing STILLROOM** for notes/timer, retaining existing stored notes by origin. This is a deliberate page transition, **not yet a zero-reload world streaming bridge**.
5. All rendering details remain local. If WebGL fails, the explicit fallback links to the accessible non-3D focus tool.

## GPU, mobile and accessibility limits

- The scene supports low / balanced / high quality tiers, bounding DPR to 1.0 / 1.35 / 1.8 and reducing rain and foliage. Only one directional shadow caster is used.
- Frame pacing is sampled after entry and sustained slow periods lower the tier; gradual recovery is capped by initial device hints. A manual tier selection opts out of auto changes.
- Reduce Motion disables procedural rain and forces initial low quality.
- Real-device FPS, heat, battery, memory and GPU context-loss recovery are **not** yet proven. WebGL context-loss handler currently shows an interruption message; full GPU resource reinitialization requires a reload.
- Materials from `assets/walk/textures` and local HDR are reused rather than uploading game assets.
- WebGL screenshots in automated CI prove that a Chromium software renderer can draw the scene, **not** a measured 30/60 FPS on the user's vivo S10.

## Visual quality gates

Record scene screenshots for sunbreak, monsoon, morning on the same 1440×900 reference camera, plus a 390×844 touch viewport. Compare:
- Natural contrast; no clipped white desktops or uniformly smooth surfaces.
- Wet ground darkens and regains texture; warm sunlight direction reads on architecture rather than an orange post-processing filter.
- Foreground desk detail, recognizable classroom scale, depth through the window, foliage which does not look like low-poly toys.
- Labels never obstruct the ability to initiate first-person play, control weather, use focus, or reach the return link.
- No cross-origin asset requests, runtime exceptions or missing local texture files.

## Remaining work toward genuinely high-end quality

The next major leap requires authored, high-fidelity photogrammetry-inspired modular architecture (with permission), consistently UV-unwrapped surfaces, physically baked global illumination / lightmaps, light probe approximation, instanced repeated furniture and meshes, compressed KTX2 textures and LOD streaming. The current classroom is a live art-direction prototype, **not equivalent to Unity URP on all devices**.

Keep comparisons grounded in fixed-camera output and measured GPU times. Do not add fake bloom, heavy SSAO or unstable SSR just to claim game-level fidelity.

## Licensing

Existing source attribution is retained in `world/room/SOURCE.md`, `world/stillroom/SOURCE.md`, `assets/walk/models/NOTICE.md` and `windowsill/SOURCE.md`. No *Dream Road* code, textures, sound, models or other proprietary assets are included.
