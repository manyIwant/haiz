#!/usr/bin/env python3
"""
NIANLUN 004 · Full Real-Browser E2E Verification, Screenshot & Video Capture.
Covers Desktop (1440x900) and Mobile (iPhone 13 390x844 + narrow 360x740):
  - Living Cambium non-uniform ring widths & accurate selection (desktop + mobile touch)
  - Elastic pull -> fly -> hand-scroll unroll -> semantic zoom (Year/Term/Month/Week)
  - Multi-material peeled ribbons (Wood + Bamboo + Paper + Indigo + Vermilion Seal + Leaf)
  - Cross-layer drag: Homework slip -> Personal free slot
  - Conflict detection & 1-click conflict resolution
  - Extracted Exam Scroll: Zhixuewang-style analytics, comparison, CSV score import, mistake -> 1-3-7 review
  - Absence range digest -> catch-up scheduling
  - Day Sky + Hainan Middle School hourly bell schedule horizon + real CRUD
  - Full page reload persistence verification
  - Reversible rewind back to trunk & zero console/page errors & zero mobile overflow
"""
import functools
import http.server
import json
import os
import shutil
import threading
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "shots"
SHOTS.mkdir(exist_ok=True)
VIDEO_TMP = SHOTS / "_videos"
VIDEO_TMP.mkdir(exist_ok=True)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def start_server():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    port = srv.server_address[1]
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv, port


def run_all():
    srv, port = start_server()
    base_url = f"http://127.0.0.1:{port}/"
    report = {"desktop": {}, "mobile": {}, "narrow360": {}, "errors": []}

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--use-gl=angle",
                "--use-angle=swiftshader",
                "--enable-webgl",
                "--ignore-gpu-blocklist",
            ],
        )

        # ============================================================== DESKTOP 1440x900
        d_ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1,
            record_video_dir=str(VIDEO_TMP / "desktop"),
            record_video_size={"width": 1280, "height": 800},
        )
        page = d_ctx.new_page()
        d_errors = []
        page.on("pageerror", lambda e: d_errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: d_errors.append(f"console.error: {m.text}") if m.type == "error" else None)

        page.goto(base_url, wait_until="networkidle")
        page.wait_for_function("() => document.body.classList.contains('ready')", timeout=20000)
        time.sleep(0.7)

        # Cancel intro cleanly by hovering 2026 cambium ring
        metrics = page.evaluate("""() => ({
            w2026: window.__nl.ringPixelWidth(2026),
            w2025: window.__nl.ringPixelWidth(2025),
            w2023: window.__nl.ringPixelWidth(2023),
            w1950: window.__nl.ringPixelWidth(1950),
            p2026: window.__nl.ringPoint(2026, 0.9),
            p2023: window.__nl.ringPoint(2023, 0.9),
            overflowX: document.documentElement.scrollWidth > window.innerWidth
        })""")
        report["desktop"]["ring_metrics"] = {
            "w2026_px": round(metrics["w2026"], 2),
            "w2025_px": round(metrics["w2025"], 2),
            "w2023_px": round(metrics["w2023"], 2),
            "w1950_px": round(metrics["w1950"], 2),
            "ratio_2026_to_1950": round(metrics["w2026"] / max(0.1, metrics["w1950"]), 2),
        }
        assert metrics["w2026"] >= 20, f"2026 ring should be wide on desktop, got {metrics['w2026']}"
        assert not metrics["overflowX"], "Desktop trunk should not overflow horizontally"

        # Hover 2026 so HUD renders cleanly for trunk screenshot
        p2026 = metrics["p2026"]
        page.mouse.move(p2026["x"], p2026["y"])
        time.sleep(0.55)
        hud_year = page.locator("#hud .y").text_content()
        report["desktop"]["hover_2026_picked"] = hud_year
        assert hud_year == "2026", f"Expected hovering 2026 ring to pick 2026, got {hud_year}"
        page.screenshot(path=str(SHOTS / "desktop-1-trunk.jpg"), type="jpeg", quality=88)

        # Elastic Pull gesture on 2026 ring
        page.mouse.down()
        for step in range(1, 14):
            page.mouse.move(p2026["x"] + step * 10, p2026["y"] - step * 4)
            time.sleep(0.03)
        time.sleep(0.2)
        page.screenshot(path=str(SHOTS / "desktop-2-pull.jpg"), type="jpeg", quality=88)
        page.mouse.up()
        time.sleep(2.1)
        after_pull = page.evaluate("() => ({ level: window.__nl.level, phase: window.__nl.band.phase, y: window.__nl.band.y })")
        report["desktop"]["after_elastic_pull"] = after_pull
        assert after_pull["level"] == "ribbon" and after_pull["y"] == 2026

        # Switch to Week scale and peel Bamboo Schedule + Cotton-Paper Homework + Indigo Personal + Vermilion Exam!
        page.click('#ribbon-bar [data-scale="week"]')
        for lyr in ["schedule", "homework", "personal", "exam"]:
            page.click(f'#ribbon-bar [data-layer="{lyr}"]')
        page.wait_for_function("() => Math.abs(window.__nl.band.winB.x - window.__nl.band.winB.target) < 0.25 && Math.abs(window.__nl.band.railY.x - window.__nl.band.railY.target) < 1.5", timeout=15000)
        time.sleep(0.35)

        # Verify conflict banner is visible for the deliberate 2026-11-26 conflict
        conflict_visible = page.locator("#rb-conflict-banner").is_visible()
        conflict_text = page.locator("#rb-conflict-banner .cf-text").text_content()
        report["desktop"]["conflict_detected"] = {"visible": conflict_visible, "text": conflict_text}
        assert conflict_visible, "Expected 2026-11-26 Physics Quiz x Club conflict banner to appear"
        page.screenshot(path=str(SHOTS / "desktop-3-multi-ribbon.jpg"), type="jpeg", quality=88)

        # Cross-layer DRAG-AND-DROP: drag unscheduled homework hw-1 from Cotton-Paper Ribbon onto Indigo Free Slot!
        drag_coords = page.evaluate("""async () => {
            const mod = await import('./ribbons.js');
            const taskHit = mod.hitRegions.find(r => r.kind === 'task' && r.item.id === 'hw-1');
            const freeHit = mod.hitRegions.find(r => r.kind === 'free-slot' && r.dateIso === '2026-11-25')
                         || mod.hitRegions.find(r => r.kind === 'free-slot');
            return { taskHit, freeHit };
        }""")
        assert drag_coords["taskHit"] and drag_coords["freeHit"], f"Missing drag targets: {drag_coords}"
        tx = drag_coords["taskHit"]["x"] + drag_coords["taskHit"]["w"] / 2
        ty = drag_coords["taskHit"]["y"] + drag_coords["taskHit"]["h"] / 2
        fx = drag_coords["freeHit"]["x"] + drag_coords["freeHit"]["w"] / 2
        fy = drag_coords["freeHit"]["y"] + drag_coords["freeHit"]["h"] / 2
        page.mouse.move(tx, ty)
        time.sleep(0.15)
        page.mouse.down()
        for s in range(1, 16):
            page.mouse.move(tx + (fx - tx) * s / 15, ty + (fy - ty) * s / 15)
            time.sleep(0.025)
        time.sleep(0.18)
        page.screenshot(path=str(SHOTS / "desktop-3b-drag-cross-layer.jpg"), type="jpeg", quality=88)
        page.mouse.up()
        time.sleep(0.45)

        hw1_linked = page.evaluate("() => window.__nl.store.getState().tasks.find(t => t.id === 'hw-1')?.scheduledBlockId")
        report["desktop"]["cross_layer_drag_homework_to_free_slot"] = bool(hw1_linked)
        assert hw1_linked, "Dragging hw-1 onto free slot must create linked personal schedule block"

        # Resolve conflict with 1 click
        page.click("#rb-conflict-fix")
        time.sleep(0.45)
        conflict_after = page.locator("#rb-conflict-banner").is_visible()
        report["desktop"]["conflict_resolved"] = not conflict_after
        assert not conflict_after, "Conflict banner should disappear after 1-click resolution"

        # Extract Exam Analytics Scroll (2026 Midterm ex-2026-10)
        page.evaluate("() => window.__nl.panels.openExamScroll('ex-2026-10')")
        time.sleep(0.55)
        assert page.locator("#exam-scroll").is_visible()
        page.screenshot(path=str(SHOTS / "desktop-4-exam-scroll.jpg"), type="jpeg", quality=88)

        # Convert mistake m-10-1 to 1-3-7 spaced-repetition review tasks
        tasks_before = page.evaluate("() => window.__nl.store.getState().tasks.length")
        page.locator('#ex-body [data-ex="mistake-review"]').first.click()
        time.sleep(0.4)
        tasks_after = page.evaluate("() => window.__nl.store.getState().tasks.length")
        report["desktop"]["mistake_to_137_reviews"] = {"before": tasks_before, "after": tasks_after, "added": tasks_after - tasks_before}
        assert tasks_after == tasks_before + 3, "Expected 3 spaced-repetition review tasks created"

        # Test CSV score import on upcoming quiz ex-2026-11-quiz
        page.click("#ex-close-btn")
        time.sleep(0.25)
        page.evaluate("() => window.__nl.panels.openExamScroll('ex-2026-11-quiz')")
        time.sleep(0.35)
        page.click("#ex-import-btn")
        time.sleep(0.2)
        page.click('[data-ex="fill-sample-csv"]')
        page.click('[data-ex="apply-import"]')
        time.sleep(0.45)
        quiz_scores_len = page.evaluate("() => window.__nl.store.getState().exams.find(e => e.id === 'ex-2026-11-quiz').scores.length")
        report["desktop"]["csv_score_import_count"] = quiz_scores_len
        assert quiz_scores_len == 6, f"Expected 6 imported subject scores, got {quiz_scores_len}"
        page.click("#ex-close-btn")
        time.sleep(0.3)

        # Absence Range Digest test (2026-11-24 to 2026-11-26)
        page.click("#rb-absence-btn")
        time.sleep(0.2)
        page.click("#rb-absence-btn")
        time.sleep(0.45)
        assert page.locator("#absence-scroll").is_visible()
        page.screenshot(path=str(SHOTS / "desktop-5-absence.jpg"), type="jpeg", quality=88)
        personal_before_ab = page.evaluate("() => window.__nl.store.getState().personal.length")
        page.click("#ab-catchup-btn")
        time.sleep(0.4)
        personal_after_ab = page.evaluate("() => window.__nl.store.getState().personal.length")
        report["desktop"]["absence_catchup_added"] = personal_after_ab - personal_before_ab
        assert personal_after_ab > personal_before_ab

        # Open Today (2026-11-25) Day Sky + Hainan Middle School Hourly Bell Schedule
        page.click("#rb-today-btn")
        page.wait_for_function("() => window.__nl.level === 'day' && window.__nl.day.reveal.x > 0.992", timeout=25000)
        time.sleep(0.25)
        page.click('.day-tabs [data-dtab="schedule"]')
        time.sleep(0.3)
        page.screenshot(path=str(SHOTS / "desktop-6-day-sky.jpg"), type="jpeg", quality=88)

        # Create a brand-new homework task via Editor modal to test full CRUD + reload persistence
        page.click("#day-add-btn")
        time.sleep(0.25)
        page.fill("#f-title", "持久化验收：电磁感应压轴复习")
        page.select_option("#f-sub", "物理")
        page.click('#ed-form button[type="submit"]')
        time.sleep(0.45)

        # RELOAD PAGE and verify ALL mutations persisted in localStorage!
        page.reload(wait_until="networkidle")
        page.wait_for_function("() => document.body.classList.contains('ready')", timeout=20000)
        time.sleep(0.5)
        persisted = page.evaluate("""() => {
            const st = window.__nl.store.getState();
            return {
                hasCustomTask: st.tasks.some(t => t.title === '持久化验收：电磁感应压轴复习'),
                hw1Linked: Boolean(st.tasks.find(t => t.id === 'hw-1')?.scheduledBlockId),
                quizScores: st.exams.find(e => e.id === 'ex-2026-11-quiz')?.scores?.length || 0,
                mistakeReviewCount: st.tasks.filter(t => t.linkedMistakeId === 'm-10-1').length,
                casVersion: st.casVersion
            };
        }""")
        report["desktop"]["reload_persistence"] = persisted
        assert persisted["hasCustomTask"], "Custom created task did not survive reload"
        assert persisted["hw1Linked"], "Cross-layer drag link did not survive reload"
        assert persisted["quizScores"] == 6, "Imported CSV scores did not survive reload"
        assert persisted["mistakeReviewCount"] == 3, "1-3-7 mistake reviews did not survive reload"

        # Verify reversible flow: Quick Week -> Corner Return Home
        page.click("#q-week")
        page.wait_for_function("() => Math.abs(window.__nl.disc.R.x - window.__nl.L().corner.R) < 1.0", timeout=15000)
        time.sleep(0.2)
        assert page.evaluate("() => window.__nl.level") == "ribbon"
        page.click("#corner")
        time.sleep(1.5)
        assert page.evaluate("() => window.__nl.level") == "disc"
        report["desktop"]["reversible_return"] = True

        d_video_path = page.video.path() if page.video else None
        d_ctx.close()
        if d_video_path and os.path.exists(d_video_path):
            shutil.copyfile(d_video_path, SHOTS / "desktop-flow.webm")

        # ============================================================== MOBILE iPhone 13 (390x844)
        m_ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            has_touch=True,
            is_mobile=True,
            record_video_dir=str(VIDEO_TMP / "phone"),
            record_video_size={"width": 390, "height": 844},
        )
        mpage = m_ctx.new_page()
        m_errors = []
        mpage.on("pageerror", lambda e: m_errors.append(f"phone pageerror: {e}"))
        mpage.on("console", lambda m: m_errors.append(f"phone console.error: {m.text}") if m.type == "error" else None)

        mpage.goto(base_url, wait_until="networkidle")
        mpage.wait_for_function("() => document.body.classList.contains('ready')", timeout=20000)
        time.sleep(0.7)

        m_metrics = mpage.evaluate("""() => ({
            w2026: window.__nl.ringPixelWidth(2026),
            w2023: window.__nl.ringPixelWidth(2023),
            w1950: window.__nl.ringPixelWidth(1950),
            p2026: window.__nl.ringPoint(2026, 0.9),
            p2023: window.__nl.ringPoint(2023, 0.9),
            p1988: window.__nl.ringPoint(1988, 0.9),
            overflowX: document.documentElement.scrollWidth > window.innerWidth
        })""")
        report["mobile"]["ring_metrics"] = {
            "w2026_px": round(m_metrics["w2026"], 2),
            "w2023_px": round(m_metrics["w2023"], 2),
            "w1950_px": round(m_metrics["w1950"], 2),
            "overflowX": m_metrics["overflowX"],
        }
        assert m_metrics["w2026"] >= 14, f"2026 ring should be wide on phone, got {m_metrics['w2026']}"
        assert not m_metrics["overflowX"], "Phone trunk overflowed horizontally"

        # Mobile precision touch selection on historical 1988 ring -> verify #touch-bar locks & allows stepping!
        p1988 = m_metrics["p1988"]
        mpage.touchscreen.tap(p1988["x"], p1988["y"])
        time.sleep(0.5)
        tb_visible = mpage.locator("#touch-bar").is_visible()
        tb_year_initial = mpage.locator("#touch-bar .tb-y").text_content()
        mpage.click("#tb-next")
        time.sleep(0.25)
        tb_year_stepped = mpage.locator("#touch-bar .tb-y").text_content()
        report["mobile"]["touch_precision_bar"] = {
            "visible": tb_visible,
            "initial": tb_year_initial,
            "after_plus_1": tb_year_stepped,
        }
        assert tb_visible and int(tb_year_stepped) == int(tb_year_initial) + 1
        mpage.screenshot(path=str(SHOTS / "phone-1-trunk-select.jpg"), type="jpeg", quality=88)

        # Quick enter Week Multi-Ribbon parallel vertical scrolls on phone!
        mpage.click("#q-week")
        mpage.wait_for_function("() => Math.abs(window.__nl.disc.R.x - window.__nl.L().corner.R) < 1.2 && Math.abs(window.__nl.band.winB.x - window.__nl.band.winB.target) < 0.25", timeout=20000)
        time.sleep(0.5)
        m_rib_overflow = mpage.evaluate("() => document.documentElement.scrollWidth > window.innerWidth")
        report["mobile"]["ribbon_overflowX"] = m_rib_overflow
        assert not m_rib_overflow, "Phone multi-ribbon overflowed horizontally"
        mpage.screenshot(path=str(SHOTS / "phone-2-multi-ribbon.jpg"), type="jpeg", quality=88)

        # Mobile Extracted Exam Scroll
        mpage.evaluate("() => window.__nl.panels.openExamScroll('ex-2026-10')")
        time.sleep(0.55)
        mpage.screenshot(path=str(SHOTS / "phone-3-exam.jpg"), type="jpeg", quality=88)
        mpage.click("#ex-close-btn")
        time.sleep(0.25)

        # Mobile Day Sky + Hourly Bell Schedule
        mpage.click("#rb-today-btn")
        mpage.wait_for_function("() => window.__nl.level === 'day' && window.__nl.day.reveal.x > 0.992", timeout=30000)
        time.sleep(0.25)
        m_day_overflow = mpage.evaluate("() => document.documentElement.scrollWidth > window.innerWidth")
        report["mobile"]["day_overflowX"] = m_day_overflow
        assert not m_day_overflow, "Phone day view overflowed horizontally"
        mpage.screenshot(path=str(SHOTS / "phone-4-day.jpg"), type="jpeg", quality=88)

        m_video_path = mpage.video.path() if mpage.video else None
        m_ctx.close()
        if m_video_path and os.path.exists(m_video_path):
            shutil.copyfile(m_video_path, SHOTS / "phone-flow.webm")

        # ============================================================== NARROW MOBILE 360x740
        n_ctx = browser.new_context(viewport={"width": 360, "height": 740}, has_touch=True, is_mobile=True)
        npage = n_ctx.new_page()
        npage.goto(base_url, wait_until="networkidle")
        npage.wait_for_function("() => document.body.classList.contains('ready')", timeout=20000)
        time.sleep(0.4)
        n_ov_disc = npage.evaluate("() => document.documentElement.scrollWidth > window.innerWidth")
        npage.click("#q-week")
        time.sleep(0.6)
        n_ov_rib = npage.evaluate("() => document.documentElement.scrollWidth > window.innerWidth")
        report["narrow360"] = {"disc_overflowX": n_ov_disc, "ribbon_overflowX": n_ov_rib}
        assert not n_ov_disc and not n_ov_rib
        n_ctx.close()

        report["errors"] = d_errors + m_errors
        assert not report["errors"], f"Unexpected runtime errors: {report['errors']}"
        browser.close()

    shutil.rmtree(VIDEO_TMP, ignore_errors=True)
    srv.shutdown()
    (ROOT / "tests" / "e2e-results.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    run_all()
