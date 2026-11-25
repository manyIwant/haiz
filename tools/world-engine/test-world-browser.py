#!/usr/bin/env python3
"""
HAIZ World Engine — Automated Browser Acceptance, Unified Architecture Proof & 6-Lens Art Comparison
Runs against a local static HTTP server using Chromium/Google Chrome + WebGL (SwiftShader in headless VM).

Supports:
  --section all|desktop|mobile-lab   Run full suite or split sections (useful under software rendering)
  --merge                            Merge results into existing docs/world-engine/browser-test-report.json

Note: Frame times recorded under software rendering (SwiftShader) are relative diagnostics only
and are explicitly NOT claimed as real mobile/desktop GPU frame rates.
"""

import argparse
import http.server
import json
import os
import re
import shutil
import socketserver
import sys
import threading
import time
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "docs" / "world-engine" / "screens"
REPORT_PATH = ROOT / "docs" / "world-engine" / "browser-test-report.json"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SIX_LENSES = [
    ("gouache", "01 · 水粉厚涂 Gouache", "暖纸肌理 · 彩影冷暖对比 · HAIZ 主视觉"),
    ("inkwash", "02 · 水墨写生 Ink & Wash", "生宣墨线 · 素纸留白 · 写生轮廓"),
    ("realist", "03 · 写实光影 Realist", "自然物理光 · 克制胶片色调 · 真实空间"),
    ("memory", "04 · 历史记忆 Memory", "1985 档案纸色 · 复古颗粒 · 怀旧影调"),
    ("nocturne", "05 · 夜色晚自习 Nocturne", "深靛蓝夜色 · 暖钨丝提亮 · 静谧校园"),
    ("dream", "06 · 校园梦境 Dream", "柔焦光晕 · 柔和色彩 · 诗意漫游"),
]


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


def load_font(size, bold=False):
    candidates = (
        [
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
            "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ]
        if bold
        else [
            "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
            "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ]
    )
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size=size)
            except Exception:
                continue
    return ImageFont.load_default()


def build_six_lens_contact_sheet(entries, metadata_line, out_path):
    """Stitch the 6 controlled-variable lens captures into a Paper & Ink 2x3 contact sheet."""
    tile_w, tile_h = 720, 450
    label_h = 56
    pad = 24
    header_h = 84
    cols, rows = 3, 2

    canvas_w = pad * (cols + 1) + tile_w * cols
    canvas_h = header_h + pad * (rows + 1) + (tile_h + label_h) * rows

    sheet = Image.new("RGB", (canvas_w, canvas_h), (244, 241, 232))  # #f4f1e8 Paper
    draw = ImageDraw.Draw(sheet)

    title_font = load_font(28, bold=True)
    sub_font = load_font(16, bold=False)
    card_title_font = load_font(19, bold=True)
    card_sub_font = load_font(14, bold=False)

    draw.text((pad, 18), "HAIZ World Engine — 六种艺术画境横向对照（同一地点 · 同一机位 · 同一角色 · 同一时刻）", fill=(31, 58, 48), font=title_font)
    draw.text((pad, 54), metadata_line, fill=(92, 102, 95), font=sub_font)
    draw.line([(pad, header_h - 4), (canvas_w - pad, header_h - 4)], fill=(214, 206, 189), width=2)

    for idx, (lens_id, title, subtitle, img_path) in enumerate(entries):
        col = idx % cols
        row = idx // cols
        x0 = pad + col * (tile_w + pad)
        y0 = header_h + pad + row * (tile_h + label_h + pad)

        draw.rectangle(
            [(x0 - 2, y0 - 2), (x0 + tile_w + 2, y0 + tile_h + label_h + 2)],
            fill=(251, 249, 243),
            outline=(205, 196, 178),
            width=2,
        )

        with Image.open(img_path) as im:
            resized = im.convert("RGB").resize((tile_w, tile_h), Image.Resampling.LANCZOS)
            sheet.paste(resized, (x0, y0))

        draw.text((x0 + 12, y0 + tile_h + 8), title, fill=(31, 58, 48), font=card_title_font)
        draw.text((x0 + 12, y0 + tile_h + 33), subtitle, fill=(104, 96, 84), font=card_sub_font)

    sheet.save(out_path, format="PNG", optimize=True)


def run_suite(section="all", merge=False):
    httpd, port = start_server()
    base_url = f"http://127.0.0.1:{port}"

    if merge and REPORT_PATH.exists():
        report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
        report["timestamp"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    else:
        report = {
            "schema": "haiz-world-engine-browser-report/2",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "environment": "Linux VM · Google Chrome Headless · ANGLE SwiftShader (software rendering; NOT real-device GPU FPS)",
            "checks": [],
            "unifiedArchitecture": {},
            "telemetry": {},
            "screenshots": [],
        }

    def record(name, ok, detail=""):
        report["checks"] = [c for c in report["checks"] if c["name"] != name]
        report["checks"].append({"name": name, "ok": bool(ok), "detail": detail})
        status = "PASS" if ok else "FAIL"
        print(f"  [{status}] {name}" + (f" — {detail}" if detail else ""), flush=True)

    def add_shot(path):
        rel = str(path.relative_to(ROOT))
        if rel not in report["screenshots"]:
            report["screenshots"].append(rel)

    run_desktop = section in ("all", "desktop")
    run_mobile_lab = section in ("all", "mobile-lab")

    with sync_playwright() as p:
        browser = launch_browser(p)

        # =====================================================================
        # 1. DESKTOP VERTICAL SLICE + UNIFIED ARCHITECTURE PROOFS + 6-LENS MATRIX
        # =====================================================================
        if run_desktop:
            print("\n=== 1. World Engine Desktop (1440x900) — Unified Architecture & 6-Lens Matrix ===", flush=True)
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
                # Allow lazy async NPC models to settle before baseline
                time.sleep(1.5)

                # Position 51-joint student visibly in sunlit forecourt beside 百年榄仁树 & 一号教学楼
                page.evaluate("""() => {
                    const W = window.__haizWorldEngine;
                    W.worldClock.setFreeWeather('clear', 16.2);
                    W.placeAvatar(-14.2, -16.8, 0.58);
                    W.look([-20.8, 2.35, -21.8], [-4.8, 4.4, 4.8], 45);
                    W.selectLens('gouache', { animate: false });
                    W.still(0.25, 10);
                    W.renderOnly();
                }""")

                baseline = page.evaluate("() => window.__haizWorldEngine.telemetry()")
                report["telemetry"]["desktop_gouache"] = baseline
                record(
                    "Single render loop authority (no duplicate rAF loops)",
                    baseline["loopOwner"] == "world-engine-main",
                    f"loopOwner={baseline['loopOwner']}",
                )
                record(
                    "Unified EntityManager tracks live avatar + cat + 5 NPCs",
                    baseline["entityCount"] >= 7,
                    f"entityCount={baseline['entityCount']}",
                )
                peer_pkt = page.evaluate("() => window.__haizWorldEngine.peerPacket()")
                peer_ok = bool(
                    peer_pkt
                    and peer_pkt.get("schema") == "haiz-peer-packet/1"
                    and isinstance(peer_pkt.get("x"), (int, float))
                    and isinstance(peer_pkt.get("y"), (int, float))
                    and isinstance(peer_pkt.get("z"), (int, float))
                )
                record(
                    "Opt-in multiplayer PeerStatePacket serializes cleanly",
                    peer_ok,
                    f"schema={peer_pkt.get('schema') if peer_pkt else None}, xyz={[peer_pkt.get('x'), peer_pkt.get('y'), peer_pkt.get('z')] if peer_pkt else None}",
                )
                record(
                    "Desktop draw-call & triangle budgets",
                    baseline["perf"]["allHardwareIndependentBudgetsOk"],
                    f"calls={baseline['perf']['render']['calls']}, tris={baseline['perf']['render']['triangles']:,}",
                )

                # Controlled 6-Lens Horizontal Comparison
                lens_matrix = []
                contact_entries = []
                all_same_scene = True
                all_same_pos = True
                all_same_clock = True
                all_same_weather = True

                for idx, (lens_id, title, subtitle) in enumerate(SIX_LENSES, start=1):
                    tl = time.time()
                    if idx > 1:
                        page.evaluate(
                            """(id) => {
                                const W = window.__haizWorldEngine;
                                W.selectLens(id, { animate: false });
                                W.renderOnly();
                            }""",
                            lens_id,
                        )
                    shot_path = OUT_DIR / f"lens-0{idx}-{lens_id}.png"
                    page.screenshot(path=str(shot_path), timeout=180000)
                    print(f"    [lens {idx}/6] {lens_id} captured ({time.time()-tl:.1f}s)", flush=True)
                    add_shot(shot_path)
                    contact_entries.append((lens_id, title, subtitle, shot_path))

                    tel = page.evaluate("() => window.__haizWorldEngine.telemetry()")
                    all_same_scene &= tel["sceneUuid"] == baseline["sceneUuid"]
                    all_same_pos &= tel["user"]["position"] == baseline["user"]["position"]
                    all_same_clock &= tel["world"]["clockMs"] == baseline["world"]["clockMs"]
                    all_same_weather &= tel["world"]["weatherLabel"] == baseline["world"]["weatherLabel"]

                    lens_matrix.append({
                        "lens": tel["lens"],
                        "sceneUuid": tel["sceneUuid"],
                        "position": tel["user"]["position"],
                        "clockMs": tel["world"]["clockMs"],
                        "weatherLabel": tel["world"]["weatherLabel"],
                        "geometries": tel["perf"]["render"]["geometries"],
                        "calls": tel["perf"]["render"]["calls"],
                        "triangles": tel["perf"]["render"]["triangles"],
                        "screenshot": str(shot_path.relative_to(ROOT)),
                    })

                geom_set = sorted({m["geometries"] for m in lens_matrix})
                all_same_geoms = len(geom_set) == 1

                shutil.copyfile(OUT_DIR / "lens-01-gouache.png", OUT_DIR / "01-desktop-gouache.png")
                shutil.copyfile(OUT_DIR / "lens-02-inkwash.png", OUT_DIR / "02-desktop-inkwash.png")

                meta_line = (
                    f"Scene UUID: {baseline['sceneUuid'][:13]}…  |  "
                    f"Avatar: {baseline['user']['position']}  |  "
                    f"Clock: {baseline['world']['haikouHour']:.2f}h ({baseline['world']['weatherLabel']})  |  "
                    f"Geometries: {geom_set[0]} (zero leak across all 6 lenses)"
                )
                sheet_path = OUT_DIR / "six-lenses-contact-sheet.png"
                build_six_lens_contact_sheet(contact_entries, meta_line, sheet_path)
                add_shot(sheet_path)
                report["unifiedArchitecture"]["sixLensInvariance"] = {
                    "baselineSceneUuid": baseline["sceneUuid"],
                    "baselinePosition": baseline["user"]["position"],
                    "baselineClockMs": baseline["world"]["clockMs"],
                    "geometryCountsObserved": geom_set,
                    "allSameScene": all_same_scene,
                    "allSamePosition": all_same_pos,
                    "allSameClock": all_same_clock,
                    "allSameWeather": all_same_weather,
                    "allSameGeometries": all_same_geoms,
                    "matrix": lens_matrix,
                }

                record(
                    "All 6 Art Lenses share the exact same live THREE.Scene UUID",
                    all_same_scene,
                    f"uuid={baseline['sceneUuid']}",
                )
                record(
                    "Switching across all 6 Art Lenses preserves exact avatar position, clock & weather",
                    all_same_pos and all_same_clock and all_same_weather,
                    f"pos={baseline['user']['position']}, weather={baseline['world']['weatherLabel']}",
                )
                record(
                    "Zero GPU geometry leak or scene rebuild across all 6 lens switches",
                    all_same_geoms,
                    f"geometries={geom_set} across all 6 passes",
                )

                # Capture 3: Historical ERA5 Time Travel (1985-11-18 Autumn) + Archival Memory Lens
                page.evaluate("""() => {
                    const W = window.__haizWorldEngine;
                    W.worldClock.applyEraDate('1985-11-18', 16.4);
                    W.selectLens('memory', { animate: false });
                    W.still(0.3, 10);
                }""")
                shot3 = OUT_DIR / "03-desktop-memory-1985.png"
                page.screenshot(path=str(shot3), timeout=180000)
                add_shot(shot3)
                era_now = page.evaluate("() => window.__haizWorldEngine.telemetry().world.eraId")
                record("ERA5 Historical Time Travel (1985-11-18) + Memory Lens", era_now == "1985-11-18", f"era={era_now}")

                # Capture 4: Nocturne Study Lights + Rain + Wet Puddles
                page.evaluate("""() => {
                    const W = window.__haizWorldEngine;
                    W.worldClock.setFreeWeather('drizzle', 20.3);
                    W.selectLens('nocturne', { animate: false });
                    W.look([-16, 3.2, -16], [-32, 7.0, 18], 44);
                    W.still(0.5, 10);
                }""")
                shot4 = OUT_DIR / "04-desktop-nocturne-rain.png"
                page.screenshot(path=str(shot4), timeout=180000)
                add_shot(shot4)
                night_val = page.evaluate("() => window.__haizWorldEngine.telemetry().world.nightFactor")
                record("Nocturne evening weather + wet ground sync", night_val > 0.7, f"nightFactor={night_val}")

                # Capture 5: Switch back to Gouache daylight & test Semantic Watercolor Map
                page.evaluate("""() => {
                    const W = window.__haizWorldEngine;
                    W.worldClock.setFreeWeather('clear', 16.2);
                    W.selectLens('gouache', { animate: false });
                    W.look(null);
                    W.still(0.1, 10);
                    W.openMap('kexue');
                }""")
                time.sleep(0.15)
                shot5 = OUT_DIR / "05-desktop-semantic-map.png"
                page.screenshot(path=str(shot5), timeout=180000)
                add_shot(shot5)
                auth_map = page.evaluate("() => window.__haizWorldEngine.telemetry().authority")
                record("Semantic Watercolor Map opens with authority arbitration", auth_map == "map", f"authority={auth_map}")

                # Capture 6: Open In-World Science Station (RK4 Pendulum)
                page.evaluate("""() => {
                    const W = window.__haizWorldEngine;
                    W.openScience('pendulum');
                    for (let i = 0; i < 6; i++) W.scienceDrawer.tick(0.04);
                }""")
                time.sleep(0.1)
                shot6 = OUT_DIR / "06-desktop-science-station.png"
                page.screenshot(path=str(shot6), timeout=180000)
                add_shot(shot6)
                auth_lab = page.evaluate("() => window.__haizWorldEngine.telemetry().authority")
                record("In-World Science Station opens (RK4 Pendulum)", auth_lab == "lab", f"authority={auth_lab}")

                # Capture 7 + Browser Causal Proof: Yanchi Pond Optics coupled to Unified World Clock (Noon vs Dusk)
                optics_noon = page.evaluate("""() => {
                    const W = window.__haizWorldEngine;
                    W.worldClock.setFreeWeather('clear', 12.5);
                    W.openScience('optics');
                    W.still(0.1, 10);
                    return {
                        sunAlt: W.telemetry().world.sunAltDeg,
                        angText: document.querySelector('#we-o-ang-val')?.textContent || '',
                        readout: document.querySelector('#we-o-readout')?.textContent || '',
                    };
                }""")
                optics_dusk = page.evaluate("""() => {
                    const W = window.__haizWorldEngine;
                    W.worldClock.setFreeWeather('clear', 17.5);
                    W.still(0.1, 10);
                    return {
                        sunAlt: W.telemetry().world.sunAltDeg,
                        angText: document.querySelector('#we-o-ang-val')?.textContent || '',
                        readout: document.querySelector('#we-o-readout')?.textContent || '',
                    };
                }""")
                shot7 = OUT_DIR / "07-desktop-optics-station.png"
                page.screenshot(path=str(shot7), timeout=180000)
                add_shot(shot7)

                def parse_deg(s):
                    m = re.search(r"([0-9]+(?:\.[0-9]+)?)", s or "")
                    return float(m.group(1)) if m else -1.0

                ang_noon = parse_deg(optics_noon["angText"])
                ang_dusk = parse_deg(optics_dusk["angText"])
                causal_ok = (optics_noon["sunAlt"] > optics_dusk["sunAlt"]) and (ang_dusk > ang_noon + 15.0)
                report["unifiedArchitecture"]["clockToScienceCoupling"] = {
                    "noon": optics_noon,
                    "dusk": optics_dusk,
                    "incidentAngleNoonDeg": ang_noon,
                    "incidentAngleDuskDeg": ang_dusk,
                }
                record(
                    "Unified World Clock causally drives Yanchi Fresnel Optics (Noon -> Dusk)",
                    causal_ok,
                    f"sunAlt {optics_noon['sunAlt']}°->{optics_dusk['sunAlt']}°, θi {ang_noon}°->{ang_dusk}°",
                )

            record("Desktop zero uncaught page errors", len(page_errors) == 0, f"pageErrors={len(page_errors)}, consoleErrors={len(console_errors)}")
            if page_errors:
                report["desktop_page_errors"] = page_errors
            if console_errors:
                report["desktop_console_errors"] = console_errors
            ctx.close()

        # =====================================================================
        # 2. MOBILE PORTRAIT (390x844, touch) & 3. ENGINEERING WORKBENCH
        # =====================================================================
        if run_mobile_lab:
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
                    W.worldClock.setFreeWeather('clear', 16.2);
                    W.placeAvatar(-14.2, -16.8, 0.58);
                    W.look([-22.0, 2.5, -23.0], [-4.5, 4.8, 4.5], 56);
                    W.still(0.25, 10);
                    W.renderOnly();
                }""")
                shot_m = OUT_DIR / "08-mobile-gouache.png"
                mpage.screenshot(path=str(shot_m), timeout=180000)
                add_shot(shot_m)
                overflow = mpage.evaluate("() => document.documentElement.scrollWidth > window.innerWidth")
                min_font_px = mpage.evaluate("""() => {
                    const els = [...document.querySelectorAll('.we-hud button, .we-place-witness button, .we-lens-btn')];
                    const sizes = els
                        .filter((el) => el.offsetParent !== null)
                        .map((el) => parseFloat(getComputedStyle(el).fontSize))
                        .filter((n) => Number.isFinite(n));
                    return sizes.length ? Math.min(...sizes) : 14;
                }""")
                mtel = mpage.evaluate("() => window.__haizWorldEngine.telemetry()")
                report["telemetry"]["mobile_gouache"] = mtel
                record("Mobile Portrait zero horizontal overflow", not overflow)
                record("Mobile UI interactive font size readable (>= 11px)", min_font_px >= 11.0, f"minFont={min_font_px:.1f}px")
                record(
                    "Mobile hardware-independent budgets",
                    mtel["perf"]["allHardwareIndependentBudgetsOk"],
                    f"calls={mtel['perf']['render']['calls']}, tris={mtel['perf']['render']['triangles']:,}",
                )
            record("Mobile zero uncaught page errors", len(m_errors) == 0, f"pageErrors={len(m_errors)}")
            mctx.close()

            print("\n=== 3. Art & Engineering Workbench (1440x900) ===", flush=True)
            wctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
            wpage = wctx.new_page()
            w_errors = []
            wpage.on("pageerror", lambda err: w_errors.append(str(err)))

            wpage.goto(f"{base_url}/world-engine-lab.html?capture=1", wait_until="domcontentloaded", timeout=120000)
            wpage.wait_for_function("() => Boolean(window.__haizWorkbench)", timeout=120000)

            sci_ok = wpage.evaluate("() => window.__haizWorkbench.initialSci.every(c => c.ok)")
            record("Workbench live browser Science Kernel 5/5 PASS", sci_ok)

            wpage.evaluate("() => { window.__haizWorkbench.setLens('inkwash'); window.__haizWorkbench.setSplit(0.5); window.__haizWorkbench.still(0.15, 20); }")
            shot9 = OUT_DIR / "09-workbench-art-split.png"
            wpage.screenshot(path=str(shot9), timeout=180000)
            add_shot(shot9)

            wpage.click('[data-tab="rig"]')
            wpage.click('#lab-skel-toggle')
            wpage.evaluate("() => { window.__haizWorkbench.setLens('gouache'); window.__haizWorkbench.setSplit(-1); window.__haizWorkbench.still(0.4, 20); }")
            shot10 = OUT_DIR / "10-workbench-rig-gait.png"
            wpage.screenshot(path=str(shot10), timeout=180000)
            add_shot(shot10)

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
    print(f"\nBrowser acceptance complete ({section}): {passed}/{total} passed. Report saved to {REPORT_PATH.relative_to(ROOT)}", flush=True)
    return 0 if passed == total else 1


def main():
    ap = argparse.ArgumentParser(description="HAIZ World Engine Browser Acceptance Suite")
    ap.add_argument("--section", choices=["all", "desktop", "mobile-lab"], default="all")
    ap.add_argument("--merge", action="store_true", help="Merge into existing browser-test-report.json")
    args = ap.parse_args()
    return run_suite(section=args.section, merge=args.merge)


if __name__ == "__main__":
    sys.exit(main())
