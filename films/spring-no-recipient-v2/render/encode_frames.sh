#!/bin/bash
# encode a PNG frame directory into a near-lossless intermediate: encode_frames.sh dir start out.mkv
ffmpeg -y -loglevel error -framerate 30 -start_number $2 -i $1/%05d.png -c:v libx264 -preset medium -crf 10 -pix_fmt yuv420p $3
