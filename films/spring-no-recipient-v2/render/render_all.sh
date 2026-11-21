#!/bin/bash
# Full render of 《春天没有收件人》 v2. Run from the project root with the films/ directory served:
#   (cd .. && python3 -m http.server 8766) &
#   bash render/render_all.sh [workers]
set -e
WORKERS=${1:-2}
export NODE_PATH=${NODE_PATH:-/opt/node22/lib/node_modules}
mkdir -p build/video build/audio
node render/handoff.cjs
# part one: terminal and the fork (0 - 42.4 s; overlaps the world by 0.8 s for the cross-dissolve)
node render/render_part.cjs term 0 1272 build/video/term.mkv &
# part two: the world (41.6 - 178.6 s), split into chunks
F0=1248; F1=5358; STEP=$(( (F1 - F0 + WORKERS - 1) / WORKERS ))
for ((w=0; w<WORKERS; w++)); do
  a=$((F0 + w*STEP)); b=$((a + STEP)); [ $b -gt $F1 ] && b=$F1
  node render/render_part.cjs world $a $b build/video/world_$w.mkv &
done
wait
bash render/mux.sh $WORKERS
