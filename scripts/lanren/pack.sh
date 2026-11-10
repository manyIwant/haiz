#!/usr/bin/env bash
# Compress the Blender exports for the web (meshopt + quantisation).
# gltfpack 0.22.0 (MIT, https://github.com/zeux/meshoptimizer) from npm.
# -kv keeps the custom growth attributes (_BIRTH, _RAD) the shader needs.
set -euo pipefail
cd "$(dirname "$0")/../.."
GP="npx -y gltfpack@0.22.0"
$GP -i build/lanren/tree-raw.glb   -o lanren/assets/tree.glb   -cc -kv -vpf -vtf -vn 12
$GP -i build/lanren/island-raw.glb -o lanren/assets/island.glb -cc -kv -vpf -vn 12
ls -la lanren/assets/*.glb
