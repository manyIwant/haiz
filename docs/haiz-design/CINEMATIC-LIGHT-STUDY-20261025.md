# HAIZ · 光影导演 / Cinematic Lighting Study

Date: 2026-10-25 · Status: experimental, **not a physical or photogrammetric reconstruction**.

## Reference, not reproduction

The user-supplied *Dream Road / 梦想之路* APK contains separate Unity scene variants for highway day, fog, night, rain, morning, and related free-roam locations. Gameplay screenshots publicly available for *Dream Road: Online* show three visual ideas worth translating into a school setting:

1. **Dark storm mass against a narrow luminous horizon.** Large, softly stratified atmospheric shapes give scenes depth without dense particles everywhere.
2. **Material response, not generic blur.** Wet asphalt looks darker and reflects broad light sources; environmental lighting also changes metal, glass and distant architecture.
3. **Composition before effects.** The sky, road and city silhouettes provide near/middle/far planes and a strong eye-level perspective.

These are general cinematic principles. This project does not copy game scenes, models, materials, source code or music. Public screenshots may differ from the particular Vivo-distributed APK, which was only inspected statically.

## New original HAIZ presets

| Scene | Architectural intention | Technical parameters |
|---|---|---|
| 晨光 (existing) | Quiet, readable foliage and school architecture | Clean sky, warm directional shadow, dry stone |
| 雨后 (existing) | Overcast tropical humidity | Neutral light, wet pavement and softer distant fog |
| 薄暮 (existing) | A late warm sun | Low-angle golden light and warm horizon |
| **雨隙金光 / Sunbreak** | A slit of late gold through retreating cloud, over freshly wet courtyard | slate-blue upper sky, apricot horizon, warm low-angle light, wet=.92, cloud=.69, minimal lingering rain |
| **海岛骤雨 / Monsoon** | Heavy, bluish tropical air swallowing distant architecture | cloud=.93, rain=.72, wet=1, closer fog, soft cool diffuse light |

The preset values remain adjustable through the existing cloud/rain/wet sliders; the two new presets never query or pretend to represent live weather.

## Why this modifies the *existing* spatial engine

The existing campus already has metric-aligned PBR material studies for stone, glazed tile, plaster, timber and glazing, plus wet-surface GGX modulation, one procedural cloud shell, roof-aware rain columns, water reflection, and three quality tiers. These were better foundations than adding a second large texture pipeline or a new, unrelated Unity runtime.

This iteration adds **only two coherent atmospheric configurations** and one bounded cloud-rim shading term. No new commercial assets, third-party SDK, WebGL reflection pass or permanent particle system were introduced.

The HUD's quiet “换一种天光” control cycles through scenes without interrupting walking or camera takeover. The pause menu preserves direct, keyboard-accessible preset selection.

## Visual acceptance criteria

- **Sunbreak:** low warm side-light must be visible on wet stone and glazed roofing; it must not wash out foliage, text or photographic points of reference.
- **Monsoon:** nearby building silhouettes remain readable while farther buildings desaturate into atmospheric fog. Indoor rooms must not render exposed outdoor rain.
- **Continuity:** changing a preset cannot teleport the user, recreate the campus world, reset local progress or corrupt route controls.
- **Accessibility:** reduced-motion preference still suppresses active rain; the shortcut is touch-operable and the current scene has readable textual labels.
- **Performance:** existing geometry, material maps and capped rain budgets remain shared; no new costly reflection render targets or repeated mesh loading.
- **Truth:** weather is clearly marked “艺术气候”, not live forecast. Buildings/interiors remain photo-informed interpretations where indicated.

## Validation boundaries

- Automated runtime tests check all five preset IDs, sane fog range, bounded wetness, and the one-tap control sequence.
- These tests mock WebGL rendering and **do not** measure actual GPU performance or verify a final screenshot.
- Final artistic acceptance requires human comparison screenshots at the same fixed campus camera point across all presets, plus a real Android 13 midrange device test under reduced motion and low quality.

## Future scene quality roadmap

1. **Golden master cameras**: reproducible fixed viewpoints at north gate, old hall, pond and a student desk; capture side-by-side results for material and fog tuning.
2. **Selective interior lighting**: physically motivated warm windows and corridors at dusk, controlled budgets for the moving camera.
3. **Rain aftermath**: a few local puddle/footstep details only where appropriate, using depth and roughness rather than mirror planes across all ground surfaces.
4. **Night experience**: complete nighttime light sources, not simply a dark-blue color grade or higher exposure.
5. **Scene-to-study flow**: approaching a conceptual classroom or desk transitions into the real offline focus tools with an immediately interruptible camera, preserving every private note.
