import os
import sys
import threading
import functools
from http.server import HTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(ROOT, "shots")
os.makedirs(SHOTS, exist_ok=True)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def start_server():
    handler = functools.partial(QuietHandler, directory=ROOT)
    server = HTTPServer(("127.0.0.1", 0), handler)
    port = server.server_address[1]
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server, port


def run_tests():
    server, port = start_server()
    base_url = f"http://127.0.0.1:{port}/index.html"
    errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # ── Desktop 1440x900 ──
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.on("console", lambda msg: errors.append(f"console.{msg.type}: {msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda err: errors.append(f"pageerror: {err}"))

        # 1. Cover
        page.goto(base_url + "#cover", wait_until="networkidle")
        assert page.locator("h1.cover-title").inner_text() == "可改写的教科书"
        page.screenshot(path=os.path.join(SHOTS, "cover-desktop.png"))

        # 2. Pendulum
        page.goto(base_url + "#pendulum", wait_until="networkidle")
        assert "等时性" in page.locator("#pend-main-prose").inner_text()
        # Click deg token and set to 45
        page.locator('[data-jid="p-deg"]').click()
        page.locator("#num-pop-input").fill("45")
        page.locator("#num-pop-input").press("Enter")
        prose_after = page.locator("#pend-main-prose").inner_text()
        assert "警告" in prose_after and "45°" in prose_after, f"Unexpected pendulum prose: {prose_after}"
        # Switch formula mode
        page.locator('[data-jid="p-fmode"]').click()
        assert "AGM" in page.locator(".formula-row").inner_text()
        # Snapshot & Undo
        page.locator("#btn-snapshot").click()
        assert len(page.locator(".snapshot-item").all()) >= 1
        page.screenshot(path=os.path.join(SHOTS, "pendulum-desktop.png"))
        page.locator("#btn-undo").click()

        # 3. Quadratic
        page.goto(base_url + "#quadratic", wait_until="networkidle")
        page.locator('[data-jid="q-a"]').first.click()
        page.locator("#num-pop-input").fill("0")
        page.locator("#num-pop-input").press("Enter")
        q_prose = page.locator("#main-col").inner_text()
        assert "退化为一次直线" in q_prose, "Quadratic did not rewrite to linear degeneration"
        page.locator("#btn-reset").click()
        page.screenshot(path=os.path.join(SHOTS, "quadratic-desktop.png"))

        # 4. Day / Night
        page.goto(base_url + "#daynight", wait_until="networkidle")
        page.locator('[data-jid="dn-city"]').click()
        page.locator('#para-pop li', has_text="北极圈").click()
        dn_prose = page.locator("#main-col").inner_text()
        assert "极昼" in dn_prose, f"Expected polar day at Arctic Circle on summer solstice, got: {dn_prose}"
        page.screenshot(path=os.path.join(SHOTS, "daynight-desktop.png"))

        # 5. Logic & Syntax
        page.goto(base_url + "#logic", wait_until="networkidle")
        assert "反例" in page.locator("#main-col").inner_text()
        page.locator('[data-jid="l-target"]').click()
        page.locator('#para-pop li', has_text="菱形").click()
        assert "命题恒真" in page.locator("#main-col").inner_text()
        # Switch syntax frame
        page.locator('[data-jid="l-frame"]').click()
        page.locator('#para-pop li', has_text="让步转折句").click()
        logic_txt = page.locator("#main-col").inner_text()
        assert "尽管" in logic_txt and "却并未结出" in logic_txt, f"Expected transformed predicate, got: {logic_txt}"
        page.screenshot(path=os.path.join(SHOTS, "logic-desktop.png"))

        # 6. Workbench & Research
        page.goto(base_url + "#workbench", wait_until="networkidle")
        page.locator('[data-jid="wb-unfold"]').click()
        assert "展开的「疏」" in page.locator("#main-col").inner_text()
        assert "unfold" in page.locator("#wb-log").inner_text()
        page.screenshot(path=os.path.join(SHOTS, "workbench-desktop.png"))

        page.goto(base_url + "#research", wait_until="networkidle")
        assert "从第一代「句读」到可改写的教科书" in page.locator("#main-col").inner_text()

        # ── Mobile 390x844 ──
        mctx = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True)
        mpage = mctx.new_page()
        mpage.on("console", lambda msg: errors.append(f"mobile.console.{msg.type}: {msg.text}") if msg.type == "error" else None)
        mpage.on("pageerror", lambda err: errors.append(f"mobile.pageerror: {err}"))

        mpage.goto(base_url + "#pendulum", wait_until="networkidle")
        assert mpage.locator(".mobile-dock").is_visible()
        mpage.screenshot(path=os.path.join(SHOTS, "pendulum-mobile.png"))

        mpage.goto(base_url + "#cover", wait_until="networkidle")
        mpage.screenshot(path=os.path.join(SHOTS, "cover-mobile.png"))

        browser.close()

    server.shutdown()
    if errors:
        print("ERRORS FOUND:")
        for e in errors:
            print(" -", e)
        sys.exit(1)
    print("ALL JUDOU LAB VERIFICATION CHECKS PASSED WITH 0 ERRORS!")


if __name__ == "__main__":
    run_tests()
