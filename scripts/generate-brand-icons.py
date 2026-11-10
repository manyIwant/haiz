#!/usr/bin/env python3
"""Regenerate HAIZ-owned identity icons from the approved photo-emblem source.

This intentionally does NOT modify functional/navigation icons or school imagery.
Run: python -m pip install Pillow && python scripts/generate-brand-icons.py
"""
from __future__ import annotations

import base64
import json
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/brand/haiz-emblem-source.jpg"
BASE = Image.open(SOURCE).convert("RGB")
BACKGROUND = (24, 37, 50)


def render(size: int, maskable: bool = False) -> Image.Image:
    """Resize the photo emblem and keep the H safely inside launcher masks."""
    canvas = Image.new("RGB", (size, size), BACKGROUND)
    max_size = round(size * (0.74 if maskable else 1.0))
    emblem = ImageOps.contain(BASE, (max_size, max_size), Image.Resampling.LANCZOS)
    canvas.paste(emblem, ((size - emblem.width) // 2, (size - emblem.height) // 2))
    return canvas


def write_png(path: Path, size: int, maskable: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    render(size, maskable).save(path, "PNG", optimize=True)


def update_flutter_icons() -> None:
    # Default Flutter Web builds, GitHub-hosted app preview and lamp preview.
    for rel in ("app/web", "app-preview", "lamp-preview/app"):
        directory = ROOT / rel
        if not directory.exists():
            continue
        write_png(directory / "favicon.png", 32)
        for size in (192, 512):
            write_png(directory / f"icons/Icon-{size}.png", size)
            write_png(directory / f"icons/Icon-maskable-{size}.png", size, maskable=True)

    # Android legacy launcher resources: mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi.
    for density, size in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96),
                          ("xxhdpi", 144), ("xxxhdpi", 192)):
        write_png(ROOT / f"app/android/app/src/main/res/mipmap-{density}/ic_launcher.png", size, True)

    # Apple asset catalogs: derive exact pixel sizes from Contents.json.
    ios = ROOT / "app/ios/Runner/Assets.xcassets/AppIcon.appiconset"
    if ios.exists():
        for item in json.loads((ios / "Contents.json").read_text())["images"]:
            if item.get("filename"):
                points = float(item["size"].split("x")[0])
                scale = int(item.get("scale", "1x").removesuffix("x"))
                write_png(ios / item["filename"], round(points * scale), True)

    macos = ROOT / "app/macos/Runner/Assets.xcassets/AppIcon.appiconset"
    if macos.exists():
        for size in (16, 32, 64, 128, 256, 512, 1024):
            write_png(macos / f"app_icon_{size}.png", size, True)


def update_site_icons() -> None:
    write_png(ROOT / "assets/brand/haiz-emblem-512.png", 512)
    # A self-contained SVG favicon; external images inside SVG favicons are blocked in some browsers.
    jpeg = base64.b64encode(SOURCE.read_bytes()).decode("ascii")
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" '
           f'role="img" aria-label="HAIZ">'
           f'<rect width="256" height="256" fill="#182532"/>'
           f'<image href="data:image/jpeg;base64,{jpeg}" width="256" height="256"/>'
           f'</svg>')
    (ROOT / "assets/walk/icon.svg").write_text(svg, encoding="utf-8")
    # Browser fallback for pages without explicit icon.
    ico = render(128)
    ico.save(ROOT / "favicon.ico", format="ICO", sizes=[(16,16),(32,32),(48,48),(64,64),(128,128)])


if __name__ == "__main__":
    update_flutter_icons()
    update_site_icons()
    print("Regenerated HAIZ brand icons for web, PWA, Android, iOS, and macOS")
