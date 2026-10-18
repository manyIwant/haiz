# Potted plant attribution

`potted-plant.glb` is a modified, lossless extraction of the pot and foliage from
[Khronos glTF Sample Assets / DiffuseTransmissionPlant](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/edc7c9e67c639d230715049ee31f9a96a6babbbe/Models/DiffuseTransmissionPlant).

- Original asset: **Rico Cilliers / Poly Haven**, 2021, [potted_plant_02](https://polyhaven.com/a/potted_plant_02), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- Materials and animation adaptation: **Eric Chadwick / Darmstadt Graphics Group GmbH**, 2024, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Changes for haiz: retained original pot and leaf meshes, normals, UVs and selected original embedded textures; removed dense gravel, fireflies, lights, cameras, animations, emission and the unsupported diffuse-transmission extension. No mesh decimation, texture repainting or texture resizing. Extraction script: `scripts/prepare-plant.cjs`.
- This is creative set dressing, **not evidence of the plant species, pots or placement on the real campus**. Three.js r128 renders the conventional alpha-cutout PBR fallback, not the newer diffuse-transmission extension.

The license does not imply endorsement by the authors. Source and output hashes are recorded in `assets/walk/credits.json`.
