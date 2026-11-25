#!/usr/bin/env python3
"""Convert Playwright WebM recordings into universally playable H.264 MP4 + lightweight PR GIF."""
from fractions import Fraction
from pathlib import Path
import av
from PIL import Image

SHOTS = Path(__file__).resolve().parent.parent / "shots"


def convert_one(src: Path, mp4_out: Path, gif_out: Path, max_gif_w: int = 720, gif_fps: int = 6):
    if not src.exists():
        print(f"skip missing {src}")
        return
    in_c = av.open(str(src))
    in_s = in_c.streams.video[0]
    w = (in_s.width // 2) * 2
    h = (in_s.height // 2) * 2

    fps = 18
    out_c = av.open(str(mp4_out), mode="w")
    out_s = out_c.add_stream("libx264", rate=fps)
    out_s.width = w
    out_s.height = h
    out_s.pix_fmt = "yuv420p"
    out_s.time_base = Fraction(1, fps)
    out_s.options = {"crf": "25", "preset": "fast", "movflags": "+faststart"}

    gif_frames = []
    frame_idx = 0
    last_gif_t = -999.0
    step_t = 1.0 / gif_fps

    for frame in in_c.decode(video=0):
        t = float(frame.time) if frame.time is not None else frame_idx / fps
        re = frame.reformat(width=w, height=h, format="yuv420p")
        re.pts = frame_idx
        re.time_base = Fraction(1, fps)
        frame_idx += 1
        for pkt in out_s.encode(re):
            out_c.mux(pkt)
        if t - last_gif_t >= step_t and len(gif_frames) < 120:
            last_gif_t = t
            img = frame.to_image()
            if img.width > max_gif_w:
                nh = max(1, int(img.height * max_gif_w / img.width))
                img = img.resize((max_gif_w, nh), Image.Resampling.LANCZOS)
            gif_frames.append(img.convert("P", palette=Image.Palette.ADAPTIVE, colors=128))

    for pkt in out_s.encode():
        out_c.mux(pkt)
    out_c.close()
    in_c.close()

    if gif_frames:
        gif_frames[0].save(
            str(gif_out),
            save_all=True,
            append_images=gif_frames[1:],
            duration=int(1000 / gif_fps),
            loop=0,
            optimize=True,
        )
    print(f"converted {src.name} -> {mp4_out.name} ({mp4_out.stat().st_size // 1024}KB), {gif_out.name} ({gif_out.stat().st_size // 1024}KB, {len(gif_frames)} frames)")


if __name__ == "__main__":
    convert_one(SHOTS / "desktop-flow.webm", SHOTS / "desktop-flow.mp4", SHOTS / "desktop-flow.gif", max_gif_w=720, gif_fps=5)
    convert_one(SHOTS / "phone-flow.webm", SHOTS / "phone-flow.mp4", SHOTS / "phone-flow.gif", max_gif_w=320, gif_fps=5)
