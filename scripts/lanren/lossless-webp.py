#!/usr/bin/env python3
"""Create byte-for-byte equivalent leaf textures with smaller mobile transfers.

Pillow's lossless WebP exact mode preserves every decoded RGBA pixel, including
fully transparent pixels. The existing PNGs stay available for desktop/fallback.
Run after scripts/lanren/textures.py has generated the canonical PNG assets.
"""
from pathlib import Path
from PIL import Image, ImageChops

ASSETS = Path(__file__).resolve().parents[2] / "lanren" / "assets"
NAMES = (
    "leaf-atlas-web.png",
    "leaf-normal-web.png",
    "leaf-atlas-lo.png",
    "leaf-normal-lo.png",
)

for name in NAMES:
    src = ASSETS / name
    dest = src.with_suffix(".webp")
    candidate = dest.with_suffix(".webp.tmp")
    with Image.open(src) as image:
        pixels = image.convert("RGBA")
        kwargs = {
            "format": "WEBP",
            "lossless": True,
            "method": 6,
            "exact": True,
        }
        if image.info.get("icc_profile"):
            kwargs["icc_profile"] = image.info["icc_profile"]
        pixels.save(candidate, **kwargs)

    with Image.open(candidate) as decoded:
        difference = ImageChops.difference(pixels, decoded.convert("RGBA"))
        if difference.getbbox() is not None:
            candidate.unlink()
            raise RuntimeError(f"Lossless integrity check failed: {name}")

    old_bytes = src.stat().st_size
    new_bytes = candidate.stat().st_size
    if new_bytes < old_bytes:
        candidate.replace(dest)
        print(f"{name}: {old_bytes} -> {new_bytes} bytes (saved {100 * (1 - new_bytes / old_bytes):.1f}%), decoded pixels identical")
    else:
        candidate.unlink()
        dest.unlink(missing_ok=True)
        print(f"{name}: keep original PNG ({new_bytes} >= {old_bytes})")
