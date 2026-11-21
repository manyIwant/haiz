#!/usr/bin/env bash
# Join rendered video parts with the score, normalise loudness, write the final film.
#   bash render/mux.sh        -> build/春天没有收件人.mp4
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="build/春天没有收件人.mp4"
ffmpeg -y -loglevel error -f concat -safe 0 -i build/video/parts.txt -c copy build/video/picture.mp4
# two-pass EBU R128 loudness normalisation (linear) to -18 LUFS: keeps the film's dynamics and the silent passage.
STATS=$(ffmpeg -hide_banner -i build/audio/mix.wav -af loudnorm=I=-18:TP=-1.5:LRA=18:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
mi=$(echo "$STATS" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["input_i"],d["input_tp"],d["input_lra"],d["input_thresh"],d["target_offset"])')
read I TP LRA TH OFF <<< "$mi"
ffmpeg -y -loglevel error -i build/video/picture.mp4 -i build/audio/mix.wav \
  -af "loudnorm=I=-18:TP=-1.5:LRA=18:measured_I=$I:measured_TP=$TP:measured_LRA=$LRA:measured_thresh=$TH:offset=$OFF:linear=true,aresample=48000" \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest \
  -metadata title="春天没有收件人" "$OUT"
ls -la "$OUT"
