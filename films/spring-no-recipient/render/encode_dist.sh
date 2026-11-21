#!/usr/bin/env bash
# Make the distributable copy (<100 MB, HEVC) from the master produced by mux.sh.
#   bash render/encode_dist.sh   -> spring-no-recipient.mp4 (project root)
set -euo pipefail
cd "$(dirname "$0")/.."
M="build/春天没有收件人.mp4"
VF="hqdn3d=1.5:1.5:5:5,format=yuv420p"   # removes most of the synthetic film grain, which costs bits but carries no picture
ffmpeg -y -loglevel error -i "$M" -vf "$VF" -c:v libx265 -preset medium -b:v 1450k -tag:v hvc1 \
  -x265-params "pass=1:stats=build/x265.log:log-level=error" -an -f mp4 /dev/null
ffmpeg -y -loglevel error -i "$M" -vf "$VF" -c:v libx265 -preset medium -b:v 1450k -tag:v hvc1 \
  -x265-params "pass=2:stats=build/x265.log:log-level=error" -c:a copy -movflags +faststart \
  -metadata title="春天没有收件人" spring-no-recipient.mp4
ls -la spring-no-recipient.mp4
