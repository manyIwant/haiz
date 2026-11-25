#!/usr/bin/env python3
"""导出六款 3D 动物玩偶 GLB、manifest.json 与检视拼图 screenshots/animals-showcase.jpg。"""
import base64
import hashlib
import json
import os
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

SCRIPT_DIR = Path(__file__).resolve().parent
VERIFIER_DIR = SCRIPT_DIR.parent
REPO_ROOT = VERIFIER_DIR.parent.parent
MODELS_DIR = VERIFIER_DIR / "assets" / "models"
SHOTS_DIR = VERIFIER_DIR / "screenshots"

MODELS_DIR.mkdir(parents=True, exist_ok=True)
SHOTS_DIR.mkdir(parents=True, exist_ok=True)


class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(REPO_ROOT), **kwargs)

    def log_message(self, fmt, *args):
        pass


def main():
    srv = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
    port = srv.server_address[1]
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                executable_path="/usr/bin/google-chrome",
                headless=True,
                args=[
                    "--no-sandbox",
                    "--use-gl=angle",
                    "--use-angle=swiftshader",
                    "--enable-unsafe-swiftshader",
                ],
            )
            page = browser.new_page(viewport={"width": 1440, "height": 960})
            errors = []
            page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
            page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)

            url = f"http://127.0.0.1:{port}/preview/haiz-verifier/scripts/export-animals.html"
            page.goto(url, wait_until="networkidle")

            exported = page.evaluate("() => window.__exportAllAnimals()")
            manifest = {"version": 1, "animals": []}
            total_bytes = 0

            for item in exported:
                raw = base64.b64decode(item["glbBase64"])
                out_path = MODELS_DIR / item["modelFile"]
                out_path.write_bytes(raw)
                sha256 = hashlib.sha256(raw).hexdigest()
                total_bytes += len(raw)
                entry = {
                    "id": item["id"],
                    "protocolId": item["protocolId"],
                    "name": item["name"],
                    "emoji": item["emoji"],
                    "modelFile": item["modelFile"],
                    "size": item["size"],
                    "stats": item["stats"],
                    "sha256": sha256,
                }
                manifest["animals"].append(entry)
                print(
                    f"Exported {item['modelFile']:14s} | {len(raw)/1024:6.1f} KB | "
                    f"{item['stats']['triangles']:5d} tris | {item['stats']['meshes']:2d} meshes | "
                    f"clips={item['stats']['clips']}"
                )

            manifest["totalBytes"] = total_bytes
            (MODELS_DIR / "manifest.json").write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
            print(f"Total 6 GLBs: {total_bytes/1024:.1f} KB ({total_bytes/1024/1024:.2f} MB)")

            # 通过 GLTFLoader 真实加载已导出的 6 个 GLB，渲染多角度检视图
            data_url = page.evaluate("() => window.__renderShowcase('../assets/models/')")
            jpg_bytes = base64.b64decode(data_url.split(",", 1)[1])
            shot_path = SHOTS_DIR / "animals-showcase.jpg"
            shot_path.write_bytes(jpg_bytes)
            print(f"Rendered showcase: {shot_path}")

            if errors:
                print("ERRORS:", errors)
                raise SystemExit(1)

            browser.close()
    finally:
        srv.shutdown()


if __name__ == "__main__":
    main()
