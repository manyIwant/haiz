#!/bin/bash
# Assemble picture + sound: concat world chunks, dissolve terminal -> river at 41.6-42.4 s,
# loudness-normalise the mix (-16 LUFS, -1.5 dBTP) and encode master + distribution files.
set -e
# world chunks in film order (render_all.sh writes world_0..N-1; the manual schedule wrote w_*)
: > build/video/world.txt
if [ -f build/video/w_a1.mkv ]; then
  for c in w_a1 w_a2 w_b w_c1 w_c2; do echo "file '$c.mkv'" >> build/video/world.txt; done
else
  WORKERS=${1:-2}
  for ((w=0; w<WORKERS; w++)); do echo "file 'world_$w.mkv'" >> build/video/world.txt; done
fi
ffmpeg -y -loglevel error -f concat -safe 0 -i build/video/world.txt -c copy build/video/world.mkv
python3 music/score.py
ffmpeg -y -loglevel error -i build/audio/mix.wav -af loudnorm=I=-16:TP=-1.5:LRA=14 -ar 48000 build/audio/mix_norm.wav
ffmpeg -y -loglevel error -i build/video/term.mkv -i build/video/world.mkv -i build/audio/mix_norm.wav \
  -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.8:offset=41.6,format=yuv420p[v]" \
  -map "[v]" -map 2:a -c:v libx264 -preset slow -crf 14 -tune film -c:a aac -b:a 256k -movflags +faststart -t 178.6 build/master.mp4
# distribution copy (< 100 MB for the repository)
ffmpeg -y -loglevel error -i build/master.mp4 -c:v libx265 -preset slow -crf 21 -tag:v hvc1 -pix_fmt yuv420p \
  -x265-params log-level=error -c:a aac -b:a 192k -movflags +faststart spring-no-recipient-v2.mp4
ls -la build/master.mp4 spring-no-recipient-v2.mp4
