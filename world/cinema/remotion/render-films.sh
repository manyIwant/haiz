#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
FRAMES="${HAIZ_FRAMES:-/workspace/work/cinema-frames}"
mkdir -p public ../media
# Blender source has 108 frames at 30 fps; require the whole sequence.
for n in $(seq 1 108); do test -s "$FRAMES/$(printf 'frame-%04d.png' "$n")"; done
ffmpeg -y -framerate 30 -i "$FRAMES/frame-%04d.png" -frames:v 108 -vf hqdn3d=3:2:3:2 -c:v libx264 -pix_fmt yuv420p -crf 19 -movflags +faststart public/room.mp4
ffmpeg -y -i public/room.mp4 -vf 'select=eq(n\,107)' -frames:v 1 -update 1 public/poster.png
cp public/poster.png ../media/poster.png
for theme in porcelain obsidian ocean; do
 ./node_modules/.bin/remotion render src.jsx "HAIZ-$theme" "../media/HAIZ-$theme.mp4" --browser-executable=/usr/bin/chromium --concurrency=1 --codec=h264 --pixel-format=yuv420p
 ffprobe -v quiet -show_format -show_streams -of json "../media/HAIZ-$theme.mp4" > "../media/HAIZ-$theme.probe.json"
done
