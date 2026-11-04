#!/usr/bin/env python3
"""Check that the loops close and the intro hands off to the loop with no seam.

For each loop, compare the wrap-around step (last frame → first frame) with the
ordinary frame-to-frame steps inside the clip. A seamless loop has a wrap step
that is indistinguishable from a normal step. The intro → loop hand-off is
checked the same way.
"""
import glob
import os
import subprocess
import sys

import numpy as np

W, H = 1920, 1080


def frames(path, select):
    cmd = ["ffmpeg", "-loglevel", "error", "-i", path, "-vf",
           f"select='{select}',scale=480:270:flags=area", "-vsync", "0",
           "-f", "rawvideo", "-pix_fmt", "gray", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, 270, 480).astype(np.float32)


def nframes(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0",
                          "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", path],
                         capture_output=True, text=True, check=True).stdout
    return int(out.strip())


def mad(a, b):
    return float(np.abs(a - b).mean())


def main(out_dir):
    ok = True
    loops = sorted(p for p in glob.glob(os.path.join(out_dir, "*.mp4")) if not os.path.basename(p).startswith("01_"))
    for p in loops:
        n = nframes(p)
        head = frames(p, "lt(n,40)")
        tail = frames(p, f"gte(n,{n - 2})")
        inner = [mad(head[i], head[i + 1]) for i in range(len(head) - 1)]
        wrap = mad(tail[-1], head[0])
        ratio = wrap / (np.mean(inner) + 1e-9)
        good = ratio < 1.6
        ok &= good
        print(f"{'OK ' if good else 'BAD'} {os.path.basename(p)}: {n} frames, wrap step {wrap:.3f} "
              f"vs typical {np.mean(inner):.3f} (max {np.max(inner):.3f}), ratio {ratio:.2f}")
    intro = glob.glob(os.path.join(out_dir, "01_*.mp4"))
    title = glob.glob(os.path.join(out_dir, "02_*.mp4"))
    if intro and title:
        ni = nframes(intro[0])
        it = frames(intro[0], f"gte(n,{ni - 30})")
        lh = frames(title[0], "lt(n,2)")
        inner = [mad(it[i], it[i + 1]) for i in range(len(it) - 1)]
        hand = mad(it[-1], lh[0])
        ratio = hand / (np.mean(inner) + 1e-9)
        good = ratio < 1.6
        ok &= good
        print(f"{'OK ' if good else 'BAD'} intro → loop hand-off: step {hand:.3f} vs typical "
              f"{np.mean(inner):.3f}, ratio {ratio:.2f}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "out")))
