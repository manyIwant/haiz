#!/usr/bin/env python3
"""
HAIZ World Engine — Automated Browser Acceptance, Performance & Visual Screenshot Harness
Runs against a local static HTTP server using Chromium/Google Chrome + WebGL (SwiftShader in headless VM).
Captures Desktop (1440x900) and Mobile Portrait (390x844 touch) screenshots and writes
a structured JSON acceptance report.

Note: Frame times recorded under software rendering (SwiftShader) are relative diagnostics only
and are explicitly NOT claimed as real mobile/desktop GPU frame rates.
"""

import http.server
import json
import os
import socketserver
import sys
import threading
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "docs" / "world-engine" / "screens"
REPORT_PATH = ROOT / "docs" / "world-engine" / "browser-test-report.json"
OUT_DIR.mkdir(parents=True, exist_ok=True)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format, *args):
        pass


def start_server():
    httpd = socketserver.TCPServer(("127.0.0.1", 0), QuietHandler)
    port = httpd.server_address[1]
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd, port


def launch_browser(p):
    chrome_path = "/usr/bin/google-chrome"
    args = [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
        "--no-sandbox",
    ]
    if os.path.exists(chrome_path):
        return p.chromium.launch(executable_path=chrome_path, headless=True, args=args)
    return p.chromium.launch(headless=True, args=args)


def run_suite():
    httpd, port = start_server()
    base_url = f"http://127.0.0.1:{port}"
    report = {
        "schema": "haiz-world-engine-browser-report/1",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "environment": "Linux VM · Google Chrome Headless · ANGLE SwiftShader (software rendering; NOT real-device GPU FPS)",
        "checks": [],
        "telemetry": {},
        "screenshots": [],
    }

    def record(name, ok, detail=""):
        report["checks"].append({"name": name, "ok": bool(ok), "detail": detail})
        status = "PASS" if ok else "FAIL"
        print(f"  [{status}] {name}" + (f" — {detail}" if detail else ""), flush=True)

    with sync_playwright() as p:
        browser = launch_browser(p)

        # =====================================================================
        # 1. DESKTOP VERTICAL SLICE (1440x900)
        # =====================================================================
        print("\n=== 1. World Engine Desktop (1440x900) ===", flush=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        page = ctx.new_page()
        page_errors = []
        console_errors = []
        page.on("pageerror", lambda err: page_errors.append(str(err)))
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        t0 = time.time()
        page.goto(f"{base_url}/world-engine.html?offline=1&quality=medium&capture=1", wait_until="domcontentloaded", timeout=120000)
        page.wait_for_function("() => document.body.dataset.ready === '1' || document.body.dataset.failed === '1'", timeout=240000)
        failed = page.evaluate("() => document.body.dataset.failed === '1'")
        record("Desktop World Engine boots cleanly", not failed, f"wall={time.time()-t0:.1f}s")

        if not failed:
            # Settle & capture 1: Default Gouache panoramic view of 百年榄仁树 + 一号教学楼 forecourt
            page.evaluate("""() => {
                const W = window.__haizWorldEngine;
                W.look([-24.5, 3.2, -23.5], [-3.5, 5.4, 6.0], 45);
                W.still(0.3, 15);
            }""")
            shot1 = OUT_DIR / "01-desktop-gouache.png"
            page.screenshot(path=str(shot1), timeout=180000)
            report["screenshots"].append(str(shot1.relative_to(ROOT)))

            tel = page.evaluate("() => window.__haizWorldEngine.telemetry()")
            report["telemetry"]["desktop_gouache"] = tel
            record("Desktop draw-call & triangle budgets", tel["perf"]["allHardwareIndependentBudgetsOk"],
                   f"calls={tel['perf']['render']['calls']}, tris={tel['perf']['render']['triangles']:,}")

            # Capture 2: Ink & Wash Sketchbook Lens
            page.evaluate("""() => {
                const W = window.__haizWorldEngine;
                W.selectLens('inkwash');
                W.still(1.0, 15);
            }""")
            shot2 = OUT_DIR / "02-desktop-inkwash.png"
            page.screenshot(path=str(shot2), timeout=180000)
            report["screenshots"].append(str(shot2.relative_to(ROOT)))
            lens_now = page.evaluate("() => window.__haizWorldEngine.telemetry().lens")
            record("Art Lens switch to Ink & Wash (水墨写生)", lens_now == "inkwash", f"lens={lens_now}")

            # Capture 3: Historical ERA5 Time Travel (1985-11-18 Autumn) + Archival Memory Lens
            page.evaluate("""() => {
                const W = window.__haizWorldEngine;
                W.worldClock.applyEraDate('1985-11-18', 16.4);
                W.selectLens('memory');
                W.still(1.0, 15);
            }""")
            shot3 = OUT_DIR / "03-desktop-memory-1985.png"
            page.screenshot(path=str(shot3), timeout=180000)
            report["screenshots"].append(str(shot3.relative_to(ROOT)))
            era_now = page.evaluate("() => window.__haizWorldEngine.telemetry().world.eraId")
            record("ERA5 Historical Time Travel (1985-11-18) + Memory Lens", era_now == "1985-11-18", f"era={era_now}")

            # Capture 4: Nocturne Study Lights + Rain + Wet Puddles
            page.evaluate("""() => {
                const W = window.__haizWorldEngine;
                W.worldClock.setFreeWeather('drizzle', 20.3);
                W.selectLens('nocturne');
                W.look([-16, 3.2, -16], [-32, 7.0, 18], 44);
                W.still(1.2, 15);
            }""")
            shot4 = OUT_DIR / "04-desktop-nocturne-rain.png"
            page.screenshot(path=str(shot4), timeout=180000)
            report["screenshots"].append(str(shot4.relative_to(ROOT)))
            night_val = page.evaluate("() => window.__haizWorldEngine.telemetry().world.nightFactor")
            record("Nocturne evening weather + wet ground sync", night_val > 0.7, f"nightFactor={night_val}")

            # Capture 5: Switch back to Gouache daylight & test Semantic Watercolor Map
            page.evaluate("""() => {
                const W = window.__haizWorldEngine;
                W.worldClock.setFreeWeather('clear', 16.2);
                W.selectLens('gouache');
                W.look(null);
                W.still(1.0, 15);
                W.openMap('kexue');
            }""")
            time.sleep(0.3)
            shot5 = OUT_DIR / "05-desktop-semantic-map.png"
            page.screenshot(path=str(shot5), timeout=180000)
            report["screenshots"].append(str(shot5.relative_to(ROOT)))
            auth_map = page.evaluate("() => window.__haizWorldEngine.telemetry().authority")
            record("Semantic Watercolor Map opens with authority arbitration", auth_map == "map", f"authority={auth_map}")

            # Capture 6: Open In-World Science Station (RK4 Pendulum)
            page.evaluate("""() => {
                const W = window.__haizWorldEngine;
                W.openScience('pendulum');
                W.still(0.8, 15);
            }""")
            time.sleep(0.2)
            shot6 = OUT_DIR / "06-desktop-science-station.png"
            page.screenshot(path=str(shot6), timeout=180000)
            report["screenshots"].append(str(shot6.relative_to(ROOT)))
            auth_lab = page.evaluate("() => window.__haizWorldEngine.telemetry().authority")
            record("In-World Science Station opens (RK4 Pendulum)", auth_lab == "lab", f"authority={auth_lab}")

            # Capture 7: Yanchi Pond Optics Station
            page.evaluate("""() => {
                const W = window.__haizWorldEngine;
                W.openScience('optics');
                W.still(0.2, 10);
            }""")
            time.sleep(0.2)
            shot7 = OUT_DIR / "07-desktop-optics-station.png"
            page.screenshot(path=str(shot7), timeout=180000)
            report["screenshots"].append(str(shot7.relative_to(ROOT)))

        record("Desktop zero uncaught page errors", len(page_errors) == 0, f"pageErrors={len(page_errors)}, consoleErrors={len(console_errors)}")
        if page_errors:
            report["desktop_page_errors"] = page_errors
        if console_errors:
            report["desktop_console_errors"] = console_errors
        ctx.close()

        # =====================================================================
        # 2. MOBILE PORTRAIT (390x844, touch)
        # =====================================================================
        print("\n=== 2. World Engine Mobile Portrait (390x844 touch) ===", flush=True)
        mctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            has_touch=True,
            is_mobile=True,
        )
        mpage = mctx.new_page()
        m_errors = []
        mpage.on("pageerror", lambda err: m_errors.append(str(err)))

        t1 = time.time()
        mpage.goto(f"{base_url}/world-engine.html?offline=1&quality=low&capture=1", wait_until="domcontentloaded", timeout=120000)
        mpage.wait_for_function("() => document.body.dataset.ready === '1' || document.body.dataset.failed === '1'", timeout=240000)
        mfailed = mpage.evaluate("() => document.body.dataset.failed === '1'")
        record("Mobile Portrait World Engine boots cleanly", not mfailed, f"wall={time.time()-t1:.1f}s")
        if not mfailed:
            mpage.evaluate("""() => {
                const W = window.__haizWorldEngine;
                W.look([-25.0, 3.0, -25.0], [-3.0, 5.8, 5.0], 58);
                W.still(0.3, 15);
            }""")
            shot_m = OUT_DIR / "08-mobile-gouache.png"
            mpage.screenshot(path=str(shot_m), timeout=180000)
            report["screenshots"].append(str(shot_m.relative_to(ROOT)))
            overflow = mpage.evaluate("() => document.documentElement.scrollWidth > window.innerWidth")
            mtel = mpage.evaluate("() => window.__haizWorldEngine.telemetry()")
            report["telemetry"]["mobile_gouache"] = mtel
            record("Mobile Portrait zero horizontal overflow", not overflow)
            record("Mobile hardware-independent budgets", mtel["perf"]["allHardwareIndependentBudgetsOk"],
                   f"calls={mtel['perf']['render']['calls']}, tris={mtel['perf']['render']['triangles']:,}")
        record("Mobile zero uncaught page errors", len(m_errors) == 0, f"pageErrors={len(m_errors)}")
        mctx.close()

        # =====================================================================
        # 3. ENGINEERING & ART WORKBENCH (1440x900)
        # =====================================================================
        print("\n=== 3. Art & Engineering Workbench (1440x900) ===", flush=True)
        wctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        wpage = wctx.new_page()
        w_errors = []
        wpage.on("pageerror", lambda err: w_errors.append(str(err)))

        wpage.goto(f"{base_url}/world-engine-lab.html?capture=1", wait_until="domcontentloaded", timeout=120000)
        wpage.wait_for_function("() => Boolean(window.__haizWorkbench)", timeout=120000)

        sci_ok = wpage.evaluate("() => window.__haizWorkbench.initialSci.every(c => c.ok)")
        record("Workbench live browser Science Kernel 5/5 PASS", sci_ok)

        # Capture 9: Art Lens Split-Screen comparison (Ink & Wash vs Base)
        wpage.evaluate("() => { window.__haizWorkbench.setLens('inkwash'); window.__haizWorkbench.setSplit(0.5); window.__haizWorkbench.still(0.15, 20); }")
        shot9 = OUT_DIR / "09-workbench-art-split.png"
        wpage.screenshot(path=str(shot9), timeout=180000)
        report["screenshots"].append(str(shot9.relative_to(ROOT)))

        # Capture 10: Character & Gait Inspector + Skeleton Overlay
        wpage.click('[data-tab="rig"]')
        wpage.click('#lab-skel-toggle')
        wpage.evaluate("() => { window.__haizWorkbench.setLens('gouache'); window.__haizWorkbench.setSplit(-1); window.__haizWorkbench.still(0.4, 20); }")
        shot10 = OUT_DIR / "10-workbench-rig-gait.png"
        wpage.screenshot(path=str(shot10), timeout=180000)
        report["screenshots"].append(str(shot10.relative_to(ROOT)))

        wtel = wpage.evaluate("() => window.__haizWorkbench.telemetry()")
        report["telemetry"]["workbench"] = wtel
        record("Workbench zero uncaught page errors", len(w_errors) == 0, f"pageErrors={len(w_errors)}, slideCm={wtel['slideCm']}")
        wctx.close()
        browser.close()

    httpd.shutdown()

    passed = sum(1 for c in report["checks"] if c["ok"])
    total = len(report["checks"])
    report["summary"] = {"passed": passed, "total": total, "allPassed": passed == total}
    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nBrowser acceptance complete: {passed}/{total} passed. Report saved to {REPORT_PATH.relative_to(ROOT)}", flush=True)
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(run_suite())
