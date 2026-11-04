#!/usr/bin/env python3
"""Check that the loops close and the intro hands off to the loop with no seam.

The wrap-around step (last frame → first frame) always lands on an H.264
keyframe (frame 0 is an I-frame), and a step into a keyframe carries extra
coding noise. So the fair baseline is the step into the *other* keyframes
inside the same clip (59→60, 119→120, …), which the viewer already sees every
two seconds. A seamless loop has a wrap step indistinguishable from those.
The intro → loop hand-off is checked the same way.
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


def keyframes(path, limit=400):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "frame=pict_type", "-of", "csv=p=0", path],
                         capture_output=True, text=True, check=True).stdout.split()
    return [i for i, t in enumerate(out[:limit]) if t.startswith("I") and i > 0]


def key_baseline(path):
    """Mean step into in-clip keyframes, and mean ordinary step."""
    ks = keyframes(path)[:5]
    last = ks[-1]
    fr = frames(path, f"lte(n,{last})")
    steps = np.array([mad(fr[i], fr[i + 1]) for i in range(len(fr) - 1)])
    key = np.array([steps[k - 1] for k in ks])
    plain = np.delete(steps, [k - 1 for k in ks])
    return float(key.mean()), float(key.max()), float(plain.mean())


def mad(a, b):
    return float(np.abs(a - b).mean())


def main(out_dir):
    ok = True
    loops = sorted(p for p in glob.glob(os.path.join(out_dir, "*.mp4")) if not os.path.basename(p).startswith("01_"))
    for p in loops:
        n = nframes(p)
        head = frames(p, "lt(n,1)")
        tail = frames(p, f"gte(n,{n - 1})")
        wrap = mad(tail[-1], head[0])
        key, key_max, plain = key_baseline(p)
        ratio = wrap / key
        good = ratio < 1.25
        ok &= good
        print(f"{'OK ' if good else 'BAD'} {os.path.basename(p)}: {n} frames, wrap {wrap:.3f} | "
              f"in-clip keyframe steps {key:.3f} (max {key_max:.3f}) | plain steps {plain:.3f} | "
              f"wrap/keyframe {ratio:.2f}")
    intro = glob.glob(os.path.join(out_dir, "01_*.mp4"))
    title = glob.glob(os.path.join(out_dir, "02_*.mp4"))
    if intro and title:
        ni = nframes(intro[0])
        it = frames(intro[0], f"gte(n,{ni - 1})")
        lh = frames(title[0], "lt(n,1)")
        hand = mad(it[-1], lh[0])
        key, _, _ = key_baseline(title[0])
        ratio = hand / key
        good = ratio < 1.25
        ok &= good
        print(f"{'OK ' if good else 'BAD'} intro → loop hand-off: step {hand:.3f} vs in-clip keyframe "
              f"steps {key:.3f}, ratio {ratio:.2f}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "out")))
