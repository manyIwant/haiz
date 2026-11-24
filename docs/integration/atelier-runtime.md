# HAIZ unified atelier edition

The nine latest atelier master GLBs are retained unchanged under `twin/assets/atelier/`; the phase-2 north gate is retained under `twin/assets/phase1/`. `twin/tools/pack_runtime.py` derives compressed meshes and deduplicates byte-identical texture payloads; `derive_rosettes.py` extracts the actual 8,877 petiole origins from the master's leaf geometry for the existing interactive V4 seasons and leaf-picking system. The first three acts deliberately keep the lagoon as an artistic substrate without its old scholar's stone lettering. When the campus surfaces, the actual forecourt and Taihu stone replace it.

Shared loader: `lanren/map/atelier.js`; building and precinct replacement: `lanren/map/twin-phase2.js`. The six-act map, the remembered/painted 入画 transition, 自由共游 and 画境实验室 all use the shared geometry. `?twin=off` retains the former appearance for comparison. `?twin=debug` reports installed and failed parts; no silent "success" if a source mesh fails. Geometry is in one provisional tree-relative frame, not surveyed. Existing map analytical cut sections and approximate navigation hulls are retained; these are not a field-surveyed interior/collision model. Old archived walk demos are not the canonical world. No master geometry is discarded.

Rebuild locally:
```sh
python3 twin/tools/pack_runtime.py --gltfpack gltfpack
python3 twin/tools/derive_rosettes.py
```

## Homepage artistic exception
The canonical six-act homepage retains the original V4 artistic tree, island, interactive foliage, and historical camera path, restored byte-for-byte from the pre-atelier integration. The detailed master remains available to 入画, 自由共游 and 画境实验室. Never automatically substitute the homepage hero tree when updating campus geometry.
