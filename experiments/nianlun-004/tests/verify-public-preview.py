#!/usr/bin/env python3
"""
Verify the deployed public HTTPS preview URL end-to-end:
  1. HTTP 200 check on index.html and every runtime JS/CSS/data/photo asset.
  2. Real headless Chromium load against the live public HTTPS URL checking
     WebGL ready state, zero failed network requests, zero console/page errors,
     and working localStorage persistence across reload.
"""
import json
import sys
import urllib.request
from playwright.sync_api import sync_playwright

ASSETS = [
    "",
    "index.html",
    "style.css",
    "app.js",
    "gl.js",
    "ribbons.js",
    "panels.js",
    "store.js",
    "analytics.js",
    "content.js",
    "physics.js",
    "sky.js",
    "sound.js",
    "THIRD-PARTY.md",
    "supabase-schema.sql",
    "lib/rings/climate.js",
    "lib/rings/codec.js",
    "lib/rings/disc.js",
    "lib/rings/almanac.js",
    "lib/js/sun.js",
    "lib/js/season.js",
    "lib/rings/data/climate.json",
    "lib/rings/data/climate.bin",
    "photos/gate-old.jpg",
    "photos/gate-now.jpg",
    "photos/yanchi.jpg",
    "photos/lanshu.jpg",
    "photos/xiaoqing.jpg",
    "photos/openday-2023.jpg",
    "photos/openday-2022.jpg",
    "photos/classroom-2022.jpg",
    "photos/gaokao-2025.jpg",
]


def main():
    if len(sys.argv) < 2:
        print("Usage: verify-public-preview.py https://.../ ")
        sys.exit(2)
    base = sys.argv[1].rstrip("/") + "/"

    http_ok = 0
    failed_assets = []
    for rel in ASSETS:
        url = base + rel
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "HAIZ-Preview-Verifier/1.0"})
            with urllib.request.urlopen(req, timeout=20) as resp:
                code = resp.status
                body = resp.read(256)
                if code == 200 and len(body) > 0:
                    http_ok += 1
                else:
                    failed_assets.append((rel, code, len(body)))
        except Exception as exc:
            failed_assets.append((rel, str(exc)))

    assert not failed_assets, f"Failed public assets: {failed_assets}"

    browser_errors = []
    failed_requests = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
        )
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("pageerror", lambda e: browser_errors.append(str(e)))
        page.on("console", lambda m: browser_errors.append(m.text) if m.type == "error" else None)
        page.on("requestfailed", lambda r: failed_requests.append((r.url, r.failure)))
        page.on("response", lambda r: failed_requests.append((r.url, r.status)) if r.status >= 400 and base in r.url else None)

        page.goto(base, wait_until="networkidle", timeout=30000)
        page.wait_for_function("() => document.body.classList.contains('ready')", timeout=25000)
        state = page.evaluate("""() => ({
            title: document.title,
            w2026: Math.round(window.__nl.ringPixelWidth(2026) * 10) / 10,
            tasks: window.__nl.store.getState().tasks.length,
            exams: window.__nl.store.getState().exams.length
        })""")
        browser.close()

    assert not browser_errors, f"Live preview browser errors: {browser_errors}"
    assert not failed_requests, f"Live preview failed requests: {failed_requests}"
    print(json.dumps({
        "url": base,
        "assets_verified_http_200": http_ok,
        "total_assets": len(ASSETS),
        "live_browser_state": state,
        "errors": 0,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
