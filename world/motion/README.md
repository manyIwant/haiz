# HAIZ · Motion Identity 01

Original kinetic HAIZ glyph reconstruction + interactive Liquid Glass dock prototype.

- Open `world/motion/index.html` directly or serve the HAIZ site and visit `/world/motion/`. No external assets or third-party runtime dependencies.
- The colourful HAIZ strokes have **12 eight-vertex polygon morphs**; the animation does not substitute opacity crossfades for the path deformation.
- Tap **▶ 动效** or the home **我的书桌** card to play; use **跳过** to interrupt.
- Functional prototype navigation: shared spring lens, drag, scroll compact, search panel, three persistent themes, demo focus timer, reduced-motion fallback.
- App data shown here is explicitly demo data. This experimental page does **not** replace `world/index.html` nor connect to school accounts.
- Optional `remotion/` contains an editable companion implementation. Node/npm installation and rendering are **not verified** in the present environment.

## Shipping boundary

Do not make the native splash screen wait for this film. Integrate *only after* PR #3's startup fixes have passed CI and device checks. In `world/apps/mobile/prepare-web.mjs`, the `world/motion` directory is expected to be copied into the mobile web assets (confirm by inspecting generated `www` and packaged APK/IPA). Keep a static route fallback when video playback is unsupported. Save private study records before any migration and never delete user storage to clear an error screen.

A separately rendered MP4 clip and test scripts are available in the conversation delivery archive; the repository stores the browser source and editable Remotion counterpart only. See [Remotion docs](https://www.remotion.dev/docs).
