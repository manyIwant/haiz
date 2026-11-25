import os
import sys
import threading
import http.server
import socketserver
from functools import partial
from playwright.sync_api import sync_playwright

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SHOTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'shots'))
os.makedirs(SHOTS_DIR, exist_ok=True)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def start_server():
    handler = partial(QuietHandler, directory=ROOT_DIR)
    httpd = socketserver.TCPServer(('127.0.0.1', 0), handler)
    port = httpd.server_address[1]
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd, port


def run_tests():
    httpd, port = start_server()
    base_url = f'http://127.0.0.1:{port}/experiments/nianlun-lab'
    errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path='/usr/bin/google-chrome',
            headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage'],
        )

        # ── 1. Desktop (1440x900) ──
        ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
        page = ctx.new_page()
        page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))

        page.goto(f'{base_url}/index.html', wait_until='networkidle')
        page.wait_for_selector('#chronoscope-svg circle')
        page.wait_for_selector('#deck-date')

        # Screenshot: Day scale
        page.screenshot(path=os.path.join(SHOTS_DIR, 'desktop-day.png'))

        # Switch to Year scale (4)
        page.click('.scale-stop[data-scale="4"]')
        page.wait_for_timeout(450)
        page.screenshot(path=os.path.join(SHOTS_DIR, 'desktop-year.png'))

        # Switch to Era scale (5)
        page.click('.scale-stop[data-scale="5"]')
        page.wait_for_timeout(450)
        page.screenshot(path=os.path.join(SHOTS_DIR, 'desktop-era.png'))

        # Back to Day scale (1)
        page.click('.scale-stop[data-scale="1"]')
        page.wait_for_timeout(450)

        # Dual-Sightline Compare
        page.click('#btn-compare')
        page.click('[data-step="month:1"]')
        page.wait_for_selector('#compare-card')

        # Create Event
        page.click('#btn-new-ev')
        page.wait_for_selector('#event-editor')
        page.fill('#ev-title', 'E2E 极坐标测试弧')
        page.click('#polar-range-mount [data-act="e-plus"]')
        page.click('#btn-save-ev')
        page.wait_for_timeout(150)
        assert 'E2E 极坐标测试弧' in page.inner_text('#deck'), 'Created event not visible in deck'

        # Date Jump to 2024-04-08 (Total Solar Eclipse / New Moon)
        page.fill('#search-input', '2024-04-08')
        page.click('#btn-jump-date')
        page.wait_for_timeout(200)
        assert '2024年4月8日' in page.inner_text('#deck-date'), 'Date jump failed'
        assert '新月' in page.inner_text('#deck'), 'Expected New Moon on 2024-04-08'

        # Paper Theme
        page.click('#btn-theme')
        page.wait_for_timeout(200)
        page.screenshot(path=os.path.join(SHOTS_DIR, 'desktop-paper.png'))
        page.click('#btn-theme')  # restore dark

        # Bench page
        page.goto(f'{base_url}/bench.html', wait_until='networkidle')
        page.wait_for_selector('#bench-layout-table tr')
        page.wait_for_selector('#bench-astro-table tr')
        page.screenshot(path=os.path.join(SHOTS_DIR, 'bench.png'))
        ctx.close()

        # ── 2. Mobile (390x844) ──
        mctx = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
        mpage = mctx.new_page()
        mpage.on('console', lambda m: errors.append(f'mobile.console.{m.type}: {m.text}') if m.type == 'error' else None)
        mpage.on('pageerror', lambda e: errors.append(f'mobile.pageerror: {e}'))

        mpage.goto(f'{base_url}/index.html', wait_until='networkidle')
        mpage.wait_for_selector('#chronoscope-svg circle')
        mpage.wait_for_timeout(250)

        overflow = mpage.evaluate('document.documentElement.scrollWidth > window.innerWidth')
        assert not overflow, 'Mobile horizontal overflow detected'

        mpage.screenshot(path=os.path.join(SHOTS_DIR, 'mobile-quadrant.png'))

        # Test quadrant collapse toggle
        mpage.click('#mobile-quad-toggle')
        mpage.wait_for_timeout(300)
        assert mpage.evaluate('document.body.classList.contains("quad-collapsed")'), 'Mobile quadrant toggle failed'
        mctx.close()

        browser.close()

    httpd.shutdown()
    if errors:
        print('FAIL: Console/Page errors detected:')
        for e in errors:
            print(' ', e)
        sys.exit(1)
    print('PASS: All Desktop (1440x900) & Mobile (390x844) E2E tests passed with 0 console errors!')


if __name__ == '__main__':
    run_tests()
