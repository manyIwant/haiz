#!/usr/bin/env bash
# Build and compress the stylized walk's Blender assets (docs/toon-campus-style-20261116.md).
#   python3 scripts/toon/build_student.py   → build/toon/student-raw.glb   (PyPI bpy 5.x, or blender -b --python)
#   python3 scripts/toon/build_trees.py     → build/toon/flora-raw.glb + lanren/assets/toon/leaf-atlas.png
#                                             (+ lanren/assets/stroll/leaf-atlas-v2.png for the V2 walk)
#   python3 scripts/stroll/build_clouds.py  → lanren/assets/stroll/clouds.png (V2 painted cumulus cards)
# then gltfpack 0.22.0 (MIT, https://github.com/zeux/meshoptimizer) from npm: meshopt compression,
# named nodes kept (-kn), materials kept (-km); the tree kit keeps its unused-by-material UVs and
# COLOR_0 data (-kv) as float UVs (-vtf), because the leaf atlas is bound in three.js, not in glTF.
set -euo pipefail
cd "$(dirname "$0")/../.."
PY="${PYTHON:-python3}"
$PY scripts/toon/build_student.py
$PY scripts/toon/build_trees.py
$PY scripts/stroll/build_clouds.py
GP="npx -y gltfpack@0.22.0"
$GP -i build/toon/student-raw.glb -o lanren/assets/toon/student.glb -cc -kn -km
$GP -i build/toon/flora-raw.glb   -o lanren/assets/toon/flora.glb   -cc -kn -km -kv -vtf -vn 12
ls -la lanren/assets/toon/
