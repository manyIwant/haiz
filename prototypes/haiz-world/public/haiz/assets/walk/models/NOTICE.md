# Potted plant attribution

`potted-plant.glb` is a modified, lossless extraction of the pot and foliage from
[Khronos glTF Sample Assets / DiffuseTransmissionPlant](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/edc7c9e67c639d230715049ee31f9a96a6babbbe/Models/DiffuseTransmissionPlant).

- Original asset: **Rico Cilliers / Poly Haven**, 2021, [potted_plant_02](https://polyhaven.com/a/potted_plant_02), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- Materials and animation adaptation: **Eric Chadwick / Darmstadt Graphics Group GmbH**, 2024, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Changes for haiz: retained original pot and leaf meshes, normals, UVs and selected original embedded textures; removed dense gravel, fireflies, lights, cameras, animations, emission and the unsupported diffuse-transmission extension. No mesh decimation, texture repainting or texture resizing. Extraction script: `scripts/prepare-plant.cjs`.
- This is creative set dressing, **not evidence of the plant species, pots or placement on the real campus**. Three.js r128 renders the conventional alpha-cutout PBR fallback, not the newer diffuse-transmission extension.

The license does not imply endorsement by the authors. Source and output hashes are recorded in `assets/walk/credits.json`.

## Original landscape model

`campus-limestone.glb` contains original Blender-authored layered limestone in
three variants, two levels of detail, and a weathered pond-name stone with
Boolean-cut lettering. The new mesh and baked-texture work is dedicated under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The model is informed
by the existing `campus_yanchi.jpg`; that photograph retains its own copyright
and is not included in this dedication. This is not a scan of the actual stones.

The inscription uses outlines from **Noto Serif CJK**, licensed under SIL OFL 1.1;
no font file is embedded. It is a typographic interpretation, not a tracing of
the photographed calligraphy. The complete generator is
`scripts/build-landscape.py`; the version, byte count and SHA-256 are in
`campus-limestone.json`. Three 1024-square baked images contain albedo, tangent
normal, and packed occlusion/roughness/metalness. The browser model uses standard
glTF PBR without external geometry decoders.
