#!/bin/bash
# Assemble picture + sound: encode frames, dissolve terminal -> river at 41.6-42.4 s,
# loudness-normalise the mix (-16 LUFS, -1.5 dBTP), encode master + distribution files.
set -e
[ -d build/frames_term ] && bash render/encode_frames.sh build/frames_term 0 build/video/term.mkv
bash render/encode_frames.sh build/frames 1248 build/video/world.mkv
python3 music/score.py
ffmpeg -y -loglevel error -i build/audio/mix.wav -af loudnorm=I=-16:TP=-1.5:LRA=14 -ar 48000 build/audio/mix_norm.wav
ffmpeg -y -loglevel error -i build/video/term.mkv -i build/video/world.mkv -i build/audio/mix_norm.wav \
  -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.8:offset=41.6,format=yuv420p[v]" \
  -map "[v]" -map 2:a -c:v libx264 -preset slow -crf 14 -tune film -c:a aac -b:a 256k -movflags +faststart -t 178.6 build/master.mp4
# distribution copy (< 100 MB for the repository): two-pass HEVC at ~3.7 Mbit/s
X="-c:v libx265 -preset slow -b:v 3700k -tag:v hvc1 -pix_fmt yuv420p"
ffmpeg -y -loglevel error -i build/master.mp4 $X -x265-params pass=1:stats=build/x265.log:log-level=error -an -f mp4 /dev/null
ffmpeg -y -loglevel error -i build/master.mp4 $X -x265-params pass=2:stats=build/x265.log:log-level=error \
  -c:a aac -b:a 192k -movflags +faststart spring-no-recipient-v2.mp4
ls -la build/master.mp4 spring-no-recipient-v2.mp4
