# Dream Road APK → HAIZ spatial architecture study

Date: 2026-10-25 · Scope: read-only technical research.

## Source and verification

The reference is the user-supplied **Dream Road / 梦想之路** Android package (`base.apk`). It is **not** stored in this repository, in build artifacts or in releases.

- File length: **450,967,893 bytes** (approximately 430.08 MiB)
- SHA-256: `7c2dfdc0acd53e8a383ebb7732f3d2834cddc26245989ef32983c41841799794`
- ZIP entries: **2,836**
- App package from prior decoded Android manifest: `com.ztjhuyu.mxzl.vivo`
- Unity bundle header: **UnityFS / 2022.3.57f1**
- Compiled Unity code: `lib/arm64-v8a/libil2cpp.so` (approximately **66.31 MiB**)
- Unity metadata: `assets/bin/Data/Managed/Metadata/global-metadata.dat` (approximately **13.50 MiB**)
- Major content archive: `assets/bin/Data/datapack.unity3d` (approximately **358.84 MiB**)
- Addressables metadata: `assets/aa/settings.json`, `assets/aa/catalog.json`

The catalog includes **15 explicit scene keys**, among them separate Freeroam day/fog/morning/night, Highway day/fog/night/rain, and Sands day/night presets. They are *entries in the package*, not proof of dynamic weather changes at runtime.

**Binary-string evidence**: `HR_RoadPooling`, `HR_FixFloatingOrigin`, `HR_SetLightmapsManually`, `Cinemachine`, `RCCP_UI_SetQuality` and `Photon` all occur in the shipped IL2CPP metadata. Strings establish the presence of related types or symbols, **not the implementation**, execution frequency, networking availability or frame rate.

### REA status and reproducibility

[REA (Reverse Engineer Anything)](https://github.com/morluto/rea) supports `inspect-android-package` and Android class/method inspection, **but the REA/JADX engine was not run in this audit**. The available analysis container has Java 21 and the raw APK but cannot retrieve the REA npm package/JADX engine from the network; the authorized macOS host has supported Node 24 but does not have the uploaded APK or a JDK/JADX configured. Do **not** label this report “REA decompilation”.

To reproduce the separate *REA Android wrapper* checks on a host with this APK and appropriately installed dependencies, consult [REA's Android guide](https://github.com/morluto/rea/blob/main/docs/android-analysis.md). The guide requires Node 22.19+/24.11+, JDK 17+ (including compiler module) and a caller-supplied `jadx-headless-mcp` JAR:

```bash
# Supply the locally installed, verified JAR and Java installation first.
export REA_JADX_MCP_JAR=/absolute/path/to/jadx-headless-mcp-0.7.1-all.jar
npx rea-agents@6.7.0 inspect-android-package /absolute/path/to/base.apk
```

JADX inspects the Android wrapper's Java classes, resources and manifest. It **does not decompile** the Unity IL2CPP native gameplay logic into the original C# project. Any future native-code observations need separate tools, explicit evidence and authorization.

## Reusable engineering patterns — not copied implementation

| APK evidence | Portable design principle | HAIZ approach |
| --- | --- | --- |
| Multiple scene/lighting variants in Addressables | Separate scene identity from atmosphere state | Keep one room/campus geometry, swap lightweight weather/lighting and sound profiles |
| `HR_RoadPooling` metadata string | Reuse repeating objects to reduce allocations | Instancing for trees/desks; reuse near-field ambient effects |
| `HR_SetLightmapsManually`, URP modules | Spend GPU budget on static lighting first | Bake static surfaces in Blender; dynamic shadows only near the camera |
| `Cinemachine` types | Directed but skippable camera states | Explore / Observe / Focus / Narrative with keyboard/touch interrupt |
| `RCCP_UI_SetQuality` metadata | Quality must be configurable and measurable | Adaptive frame pacing with bounds and hysteresis, never unconditionally maximum effects |
| Multiplayer-related symbols | Presence is a separate privacy decision | Do not ship real-time identities or personal learning records merely to imitate a game |

## Implemented in the companion PR

STILLROOM previously selected `low`, `medium` or `high` **only at startup** using crude device hints. The experimental change introduces a compact, telemetry-free quality governor that:

1. Observes active animation-frame pacing locally.
2. Drops a quality tier after two sustained slow windows (rather than repeatedly janking).
3. Requires seven stable high-headroom windows to recover one tier, capped by the device's initial power/memory hints.
4. Does not punish backgrounded, paused, reduced-motion or cinematic-entry states.
5. Rebuilds rain density and canvas backing resolution when the quality tier changes.
6. Ships through the same native asset manifest, pilot allowlist and PWA offline cache, with deterministic unit tests.

This does **not** turn STILLROOM into a Unity game, prove 30/60 FPS on a real device, or finish HAIZ's future full 3D spatial streaming system. It is a bounded performance improvement to the existing original scene.

## Next meaningful milestones

- **Spatial proof of quality**: one well-crafted, navigable study room, physical-size furniture, coherent lighting, no fake official classroom labels; preserve existing notes and focus tools.
- **Asset budget**: measured first interaction and first immersive frame, progressive glTF geometry/texture delivery, InstancedMesh and LOD at measured thresholds.
- **Device acceptance**: real Android 13 phone tests of cold start, 10-minute battery/thermal behavior, frame pacing, offline notes and swipe interruption. Repeat for iOS when signed device testing is available.
- **Privacy**: no third-party advertisement SDKs, no personally identifiable “online student” presence; any future shared room needs authorized deployment, report/block controls and explicit data-retention rules.

## Copyright and provenance

Do **not** extract or redistribute the original APK, vehicles, textures, audio, game scenes, proprietary code, SDK binaries or third-party licensed Unity packages. This note documents high-level concepts and original HAIZ work only.
