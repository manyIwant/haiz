import io
import os
import sys
import threading
import http.server
import socketserver
from functools import partial
from PIL import Image
from playwright.sync_api import sync_playwright

LAB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SHOTS_DIR = os.path.join(LAB_DIR, 'shots')
os.makedirs(SHOTS_DIR, exist_ok=True)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def start_server():
    handler = partial(QuietHandler, directory=LAB_DIR)
    httpd = socketserver.TCPServer(('127.0.0.1', 0), handler)
    port = httpd.server_address[1]
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd, port


def capture_gif(page, out_path, frame_count, step_fn=None, delay_ms=85, scale_w=720):
    frames = []
    for i in range(frame_count):
        if step_fn:
            step_fn(i)
        raw = page.screenshot(type='png')
        im = Image.open(io.BytesIO(raw)).convert('RGB')
        if im.width > scale_w:
            ratio = scale_w / im.width
            im = im.resize((scale_w, int(im.height * ratio)), Image.Resampling.LANCZOS)
        frames.append(im.convert('P', palette=Image.Palette.ADAPTIVE, colors=128))
        page.wait_for_timeout(delay_ms)
    frames[0].save(
        out_path,
        save_all=True,
        append_images=frames[1:],
        duration=delay_ms + 30,
        loop=0,
        optimize=True,
    )


def run_e2e():
    httpd, port = start_server()
    url = f'http://127.0.0.1:{port}/index.html'
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

        page.goto(url, wait_until='networkidle')
        page.wait_for_selector('.y-dom-node[data-specimen="helios"]')
        page.wait_for_timeout(450)
        page.screenshot(path=os.path.join(SHOTS_DIR, 'exp1-yielding-rest.png'))

        # GIF + Screenshot: Experiment I (Spatial Yielding + Dual Confluence!)
        def yield_step(i):
            if i == 2:
                page.click('.y-dom-node[data-specimen="helios"]')
            elif i == 9:
                page.click('#btn-demo-couple')
        capture_gif(page, os.path.join(SHOTS_DIR, 'exp1-yielding-morph.gif'), 16, step_fn=yield_step, delay_ms=95)
        page.wait_for_timeout(350)
        assert page.locator('.confluence-pill').count() >= 1, 'Confluence pill did not appear'
        page.screenshot(path=os.path.join(SHOTS_DIR, 'exp1-yielding-coupled.png'))

        # Experiment II: Fisheye Voronoi Membrane
        page.click('.nav-tab[data-view="fisheye"]')
        page.wait_for_selector('.fe-cell-specimen[data-site-id="pendulum"]')
        page.wait_for_timeout(300)

        def fisheye_step(i):
            if i == 1:
                page.mouse.move(560, 340)
            elif i == 4:
                page.mouse.move(880, 460)
            elif i == 7:
                page.click('.fe-cell-specimen[data-site-id="pendulum"]')
            elif i == 12:
                page.click('.fe-cell-specimen[data-site-id="helios"]')
        capture_gif(page, os.path.join(SHOTS_DIR, 'exp2-fisheye-lens.gif'), 16, step_fn=fisheye_step, delay_ms=100)
        page.wait_for_timeout(350)
        assert page.locator('.fe-live-overlay').is_visible(), 'Fisheye live overlay not visible'
        page.screenshot(path=os.path.join(SHOTS_DIR, 'exp2-fisheye-locked.png'))

        # Experiment III: Kando One-Stroke Marking Gesture
        page.click('.nav-tab[data-view="marking"]')
        page.wait_for_selector('.marking-svg')
        page.wait_for_timeout(250)

        # Perform a real 1-stroke press -> glide right -> sharp turn down -> release!
        def marking_step(i):
            if i == 1:
                page.mouse.move(720, 440)
                page.mouse.down()
            elif i == 3:
                page.mouse.move(830, 405, steps=6)  # Glide toward Helios (upper right)
            elif i == 6:
                page.mouse.move(855, 515, steps=6)  # Sharp corner turn -> spawns Level 2!
            elif i == 10:
                page.mouse.up()
            elif i == 12:
                page.click('#mk-summon')  # Also demonstrate click-mode bloom
        capture_gif(page, os.path.join(SHOTS_DIR, 'exp3-marking-stroke.gif'), 15, step_fn=marking_step, delay_ms=90)
        page.wait_for_timeout(250)
        page.screenshot(path=os.path.join(SHOTS_DIR, 'exp3-marking-bloom.png'))

        # Experiment IV: Semantic Sunburst Dissolution
        page.click('.nav-tab[data-view="sunburst"]')
        page.wait_for_selector('.sb-arc.sb-depth-1')
        page.wait_for_timeout(300)

        def sunburst_step(i):
            if i == 2:
                page.locator('.sb-arc.sb-depth-1').first.click()
            elif i == 10:
                page.click('#sb-recoil')
        capture_gif(page, os.path.join(SHOTS_DIR, 'exp4-sunburst-dissolve.gif'), 15, step_fn=sunburst_step, delay_ms=95)
        page.locator('.sb-arc.sb-depth-1').nth(1).click()
        page.wait_for_timeout(750)
        page.screenshot(path=os.path.join(SHOTS_DIR, 'exp4-sunburst-zoomed.png'))

        # Dual-Engine Live Comparison Mode
        page.click('.nav-tab[data-view="compare"]')
        page.wait_for_selector('.compare-pane')
        page.wait_for_timeout(450)
        page.screenshot(path=os.path.join(SHOTS_DIR, 'compare-dual.png'))

        # Darkroom Theme Check
        page.click('#btn-theme')
        page.click('.nav-tab[data-view="yielding"]')
        page.wait_for_timeout(450)
        page.click('#btn-demo-couple')
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(SHOTS_DIR, 'desktop-darkroom.png'))
        ctx.close()

        # ── 2. Mobile (390x844) ──
        mctx = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
        mpage = mctx.new_page()
        mpage.on('console', lambda m: errors.append(f'mobile.console.{m.type}: {m.text}') if m.type == 'error' else None)
        mpage.on('pageerror', lambda e: errors.append(f'mobile.pageerror: {e}'))

        mpage.goto(url, wait_until='networkidle')
        mpage.wait_for_selector('.y-dom-node[data-specimen="pulse"]')
        mpage.wait_for_timeout(400)
        overflow = mpage.evaluate('document.documentElement.scrollWidth > window.innerWidth')
        assert not overflow, 'Mobile horizontal overflow in Experiment I'

        mpage.click('.y-dom-node[data-specimen="pulse"]')
        mpage.wait_for_timeout(750)
        mpage.screenshot(path=os.path.join(SHOTS_DIR, 'mobile-exp1-yielding.png'))

        mpage.click('.nav-tab[data-view="fisheye"]')
        mpage.wait_for_timeout(350)
        mpage.click('.fe-cell-specimen[data-site-id="helios"]')
        mpage.wait_for_timeout(700)
        mpage.screenshot(path=os.path.join(SHOTS_DIR, 'mobile-exp2-fisheye.png'))
        mctx.close()

        browser.close()

    httpd.shutdown()
    if errors:
        print('FAIL: Console/Page errors detected:')
        for e in errors:
            print(' ', e)
        sys.exit(1)
    print('PASS: All 4 Experiments + Dual Compare + Mobile E2E + 4 Animated GIFs verified with 0 errors!')


if __name__ == '__main__':
    run_e2e()
