# Bundled Draco decoder for HAIZ Phase-2 twin

The original HAIZ landmark GLB files in `twin/assets/phase1/` use `KHR_draco_mesh_compression`.

To avoid an external CDN dependency during normal campus navigation, we bundle the corresponding Draco decoder from the **Three.js r169 distribution**:

- `lanren/vendor/three/addons/loaders/DRACOLoader.js` — Three.js, MIT license, https://github.com/mrdoob/three.js/blob/r169/LICENSE
- `lanren/vendor/three/addons/libs/draco/draco_wasm_wrapper.js` and `draco_decoder.wasm` — Google Draco decoder distributed by Three.js, Apache License 2.0, https://github.com/google/draco/blob/master/LICENSE

They are vendored unmodified from the tag `r169` of `mrdoob/three.js`, and must be updated as a version-matched set. The remaining Three.js code is imported from the existing `lanren/vendor/three/` installation.

The Phase-2 twin loader has an explicit status and fallback. Open `ruhua-free.html?stage=stroll&twin=debug` to inspect whether detailed `yihao` and `gate` were actually decoded and installed. `?twin=off` uses the legacy V3 landmarks for comparison.

The V4 animated 榄仁树 and integrated 太湖石 are **not** replaced here: the six-act growth, wind, island and materials require a separate geometry/animation integration. Do not state that all second-stage assets are globally active based only on these landmark swaps.
