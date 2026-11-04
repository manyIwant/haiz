#!/usr/bin/env python3
"""Check the full film where its parallel-rendered chunks were stitched together.

Every chunk simulates its own warm-up, so a broken warm-up would show up as a
visible jump at the chunk boundary. For each boundary we compare the
frame-to-frame change across it with the changes in the frames right around it
(which also cross keyframes and, at section starts, the warp flash). A seamless
stitch is indistinguishable from its neighbours.
"""
import glob
import os
import re
import subprocess
import sys

import numpy as np


def nframes(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-count_packets", "-select_streams", "v:0",
                          "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", path],
                         capture_output=True, text=True, check=True).stdout
    return int(out.strip())


def grab(path, a, b):
    cmd = ["ffmpeg", "-loglevel", "error", "-i", path, "-vf",
           f"select='between(n,{a},{b})',scale=480:270:flags=area", "-vsync", "0",
           "-f", "rawvideo", "-pix_fmt", "gray", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, 270, 480).astype(np.float32)


def main(film_dir):
    chunks = glob.glob(os.path.join(film_dir, "_chunks", "*.mp4"))
    key = lambda p: (re.match(r"(\d\d)_", os.path.basename(p)).group(1), os.path.basename(p))
    chunks.sort(key=key)
    full = glob.glob(os.path.join(film_dir, "*全片.mp4"))[0]
    n_full = nframes(full)
    sizes = [nframes(c) for c in chunks]
    print(f"{len(chunks)} chunks, {sum(sizes)} frames; full film {n_full} frames")
    ok = sum(sizes) == n_full
    pos = 0
    worst = 0.0
    for c, n in zip(chunks[:-1], sizes[:-1]):
        pos += n
        fr = grab(full, pos - 6, pos + 5)
        steps = [float(np.abs(fr[i] - fr[i + 1]).mean()) for i in range(len(fr) - 1)]
        b = steps[5]                        # step (pos-1) -> pos
        around = steps[:5] + steps[6:]
        ref = max(np.median(around), 0.25)
        ratio = b / ref
        worst = max(worst, ratio)
        flag = "OK " if ratio < 2.6 else "BAD"
        ok &= ratio < 2.6
        print(f"{flag} boundary @ frame {pos:6d} ({pos / 30:7.2f}s) after {os.path.basename(c)}: "
              f"step {b:.3f} vs neighbours median {np.median(around):.3f} (max {max(around):.3f}) ratio {ratio:.2f}")
    print("worst ratio", round(worst, 2))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "film")))
