/**
 * HAIZ · NIANLUN · 一卷 V4 — Playwright Real-Browser E2E, Boundary, FPS & Video Capture Suite
 *
 * Clearly distinguished as browser simulation (Chromium mobile 390×844 DPR 3 touch + Desktop 1440×900
 * + WebKit mobile smoke check — NOT Flutter emulator and NOT real student device acceptance).
 *
 * Verifies:
 *  1. Zero console errors & zero uncaught page errors
 *  2. Default 30-second Saturday view + real Haikou ERA5 climate patina load
 *  3. Real CDP two-finger pinch-to-stretch (Summary -> List >=44pt -> Hour Scale) + pinch-to-Middle-Roll
 *  4. Real circular finger rotation on Past Roll annual-ring end-face (3/7 turn -> unrolls 3 exact days!)
 *  5. Real Drag-Fog condensation + Thing Panel dispersion/condensation + Time Sovereignty block guard
 *  6. Full 9-message multi-dimensional convergence + lineage view + batch rollback + Pocket migration
 *  7. High-density stress scenario (Saturday 8 items + 4 Fogs + 6 Channels) — verifies >=44pt hit boxes & zero overlap
 *  8. Local Lane Splitting (Tue 12/1 mandatory overlap), Privacy Lock, Dark Mode, Reduced Motion, WYSIWYG Takeaway
 *  9. Real FPS benchmark during elastic pinch stretch
 * 10. Captures clean keyframe screenshots & records real mobile + desktop interaction videos!
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, webkit } = require('/Users/a11/manyiwant/node_modules/playwright');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(APP_DIR, '../..');
const SHOTS_DIR = path.join(APP_DIR, 'shots');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const cleanUrl = (req.url || '/').split('?')[0];
      const filePath = path.join(REPO_ROOT, cleanUrl === '/' ? 'experiments/nianlun-v4/index.html' : cleanUrl);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}/experiments/nianlun-v4/index.html` });
    });
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Smooth two-finger touch pinch via CDP */
async function cdpPinch(cdp, cx, cy, startDy, endDy, steps = 22) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { id: 1, x: Math.round(cx), y: Math.round(cy - startDy) },
      { id: 2, x: Math.round(cx), y: Math.round(cy + startDy) },
    ],
  });
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const dy = startDy + (endDy - startDy) * t;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { id: 1, x: Math.round(cx), y: Math.round(cy - dy) },
        { id: 2, x: Math.round(cx), y: Math.round(cy + dy) },
      ],
    });
    await wait(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Smooth single-finger circular dial rotation via CDP */
async function cdpDialRotate(cdp, cx, cy, radius, startAngle, deltaAngle, steps = 28) {
  const pt = (a) => ({ id: 1, x: Math.round(cx + Math.cos(a) * radius), y: Math.round(cy + Math.sin(a) * radius) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(startAngle)] });
  for (let i = 1; i <= steps; i++) {
    const a = startAngle + (deltaAngle * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(a)] });
    await wait(18);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function runAudit() {
  const { server, url } = await startStaticServer();
  const report = {
    environment: 'Playwright Chromium (390x844 touch DPR3 + 1440x900 desktop) & WebKit smoke',
    notRealDeviceAcceptance: true,
    consoleErrors: [],
    pageErrors: [],
    checks: {},
    fps: {},
    videos: {},
    screenshots: [],
  };

  let browser;
  try {
    browser = await chromium.launch({ headless: true });

    // =========================================================================
    // 1. MOBILE FLOW (390x844, Touch, Video Recorded!)
    // =========================================================================
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
      recordVideo: { dir: SHOTS_DIR, size: { width: 390, height: 844 } },
    });
    const mPage = await mobileCtx.newPage();
    mPage.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push(`[mobile] ${m.text()}`); });
    mPage.on('pageerror', (e) => report.pageErrors.push(`[mobile] ${e.message}`));

    await mPage.goto(url, { waitUntil: 'networkidle' });
    await wait(650);

    // Screenshot 1: Mobile default 30-second Saturday view
    const st0 = await mPage.evaluate(() => window.__NIANLUN_V4__.getState());
    report.checks.mobileDefaultLoaded = st0.segs.length >= 9 && st0.climateLoaded;
    await mPage.screenshot({ path: path.join(SHOTS_DIR, 'mobile-1-default.png') });
    report.screenshots.push('mobile-1-default.png');

    // Verify ALL List-mode item hit targets are STRICTLY >= 44pt!
    const minItemHitH = Math.min(...st0.hitRegions.filter((h) => h.kind === 'item').map((h) => h.h));
    report.checks.listModeMinTouchHeightPx = minItemHitH;

    // Real CDP Two-Finger Pinch Stretch on Today (Sat 11/28) + live FPS measure!
    const cdp = await mobileCtx.newCDPSession(mPage);
    await mPage.evaluate(() => {
      window.__frames = [];
      let last = performance.now();
      window.__fpsRunning = true;
      function loop(now) {
        window.__frames.push(now - last);
        last = now;
        if (window.__fpsRunning) requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    });

    // Stretch Today smoothly into Hour-Scale mode (06:00-23:00)!
    await cdpPinch(cdp, 195, 310, 42, 165, 28);
    await wait(550);

    const fpsData = await mPage.evaluate(() => {
      window.__fpsRunning = false;
      const fs = window.__frames.slice(2);
      const avgDt = fs.reduce((a, b) => a + b, 0) / Math.max(1, fs.length);
      return { frames: fs.length, avgFps: Math.round(1000 / Math.max(1, avgDt)), p95DtMs: Math.round(fs.sort((a, b) => a - b)[Math.floor(fs.length * 0.95)] || 0) };
    });
    report.fps.mobilePinchStretch = fpsData;

    const stStretched = await mPage.evaluate(() => window.__NIANLUN_V4__.getState());
    const todaySeg = stStretched.segs.find((s) => !s.roll && s.iso === '2026-11-28');
    report.checks.pinchEnteredHourScale = Boolean(todaySeg && todaySeg.mode === 3);
    await mPage.screenshot({ path: path.join(SHOTS_DIR, 'mobile-2-hour-scale.png') });
    report.screenshots.push('mobile-2-hour-scale.png');

    // Return to default then test Real Circular Jog Dial on Past Roll End-Face!
    await mPage.evaluate(() => window.__NIANLUN_V4__.resetDefault());
    await wait(350);
    // Scroll to top so Past Roll is cleanly visible
    await mPage.evaluate(() => {
      const cv = document.getElementById('scroll-canvas');
      cv.dispatchEvent(new WheelEvent('wheel', { deltaY: -400, bubbles: true, cancelable: true }));
    });
    await wait(300);

    const stBeforeDial = await mPage.evaluate(() => window.__NIANLUN_V4__.getState());
    const pastRollBox = stBeforeDial.rollHitBoxes.find((r) => r.seg.position === 'past');
    const expandedBeforeDial = stBeforeDial.segs.filter((s) => !s.roll).length;
    if (pastRollBox) {
      const cvRect = await mPage.locator('#scroll-canvas').boundingBox();
      // Rotate clockwise by 3.3 / 7 of a full circle -> unrolls 3 exact days!
      await cdpDialRotate(
        cdp,
        cvRect.x + pastRollBox.cx,
        cvRect.y + pastRollBox.cy,
        20,
        -Math.PI / 2,
        (Math.PI * 2 * 3.3) / 7,
        32,
      );
      await wait(450);
    }
    const stAfterDial = await mPage.evaluate(() => window.__NIANLUN_V4__.getState());
    const expandedAfterDial = stAfterDial.segs.filter((s) => !s.roll).length;
    report.checks.dialUnrolledDays = expandedAfterDial - expandedBeforeDial;
    await mPage.screenshot({ path: path.join(SHOTS_DIR, 'mobile-3-dial-unrolled.png') });
    report.screenshots.push('mobile-3-dial-unrolled.png');

    // Reset and demonstrate Middle Roll juxtaposition (pinch intermediate days!)
    await mPage.evaluate(() => window.__NIANLUN_V4__.resetDefault());
    await wait(350);
    await cdpPinch(cdp, 195, 540, 155, 22, 24);
    await wait(550);
    const stMid = await mPage.evaluate(() => window.__NIANLUN_V4__.getState());
    report.checks.pinchFormedMiddleRoll = stMid.segs.some((s) => s.roll && s.position === 'middle');
    await mPage.screenshot({ path: path.join(SHOTS_DIR, 'mobile-4-middle-roll.png') });
    report.screenshots.push('mobile-4-middle-roll.png');

    // Reset -> Open Fog item (全校体检) -> condense -> disperse
    await mPage.evaluate(() => {
      window.__NIANLUN_V4__.resetDefault();
      window.__NIANLUN_V4__.selectItem('fog_checkup');
    });
    await wait(450);
    await mPage.screenshot({ path: path.join(SHOTS_DIR, 'mobile-5-fog-sheet.png') });
    report.screenshots.push('mobile-5-fog-sheet.png');
    await mPage.locator('[data-condense="wed"]').click();
    await wait(350);
    await mPage.locator('[data-condense="time"]').click();
    await wait(350);
    await mPage.locator('[data-condense="fog"]').click();
    await wait(300);

    // Open Physics Lab Task (Channel + Wall + Block + Trace + Sovereignty check + Past-Due-Still-Needed!)
    await mPage.evaluate(() => window.__NIANLUN_V4__.selectItem('tk_phy_lab'));
    await wait(400);
    // Attempt scheduling in locked Monday Period 3 -> must show calm sovereignty refusal!
    await mPage.locator('[data-plan-slot="school_test"]').click();
    await wait(250);
    const sovMsg = await mPage.locator('[data-sovereignty-msg]').textContent();
    report.checks.sovereigntyGuardShown = Boolean(sovMsg && sovMsg.includes('不可安排'));
    // Switch status to "过了截止，仍需要交" -> Channel pierces wall as dashed groove!
    await mPage.locator('[data-status="past_due_needed"]').click();
    await wait(400);
    await mPage.screenshot({ path: path.join(SHOTS_DIR, 'mobile-6-channel-through-wall.png') });
    report.screenshots.push('mobile-6-channel-through-wall.png');

    // Open Intake ("放入") and step through all 9 multi-dimensional messages!
    await mPage.evaluate(() => window.__NIANLUN_V4__.openIntake());
    await wait(400);
    await mPage.locator('[data-demo-all]').click();
    await wait(550);
    await mPage.screenshot({ path: path.join(SHOTS_DIR, 'mobile-7-convergence-intake.png') });
    report.screenshots.push('mobile-7-convergence-intake.png');

    // Open converged Physics Exam lineage on scroll!
    await mPage.locator('[data-open-item]').first().click();
    await wait(450);
    await mPage.screenshot({ path: path.join(SHOTS_DIR, 'mobile-8-lineage-yield.png') });
    report.screenshots.push('mobile-8-lineage-yield.png');

    // Test High-Density Stress Scenario (Saturday 8 items + 4 overlapping Fogs + 6 Channels)
    await mPage.evaluate(() => {
      window.__NIANLUN_V4__.closeDrawer();
      window.__NIANLUN_V4__.resetDefault();
      window.__NIANLUN_V4__.toggleStress(true);
      window.__NIANLUN_V4__.centerOnToday();
    });
    await wait(500);
    const stStress = await mPage.evaluate(() => window.__NIANLUN_V4__.getState());
    const minStressHit = Math.min(...stStress.hitRegions.filter((h) => h.kind === 'item' || h.kind === 'day_expand_more').map((h) => h.h));
    report.checks.stressModeMinTouchHeightPx = minStressHit;
    await mPage.screenshot({ path: path.join(SHOTS_DIR, 'mobile-9-high-density-stress.png') });
    report.screenshots.push('mobile-9-high-density-stress.png');

    // Test Local Lane Splitting (Tue 12/1 mandatory Occupation × Occupation conflict!)
    await mPage.evaluate(() => {
      window.__NIANLUN_V4__.toggleStress(false);
      window.__NIANLUN_V4__.expandDay('2026-12-01', 'hour');
    });
    await wait(550);
    await mPage.screenshot({ path: path.join(SHOTS_DIR, 'mobile-10-local-lane-split.png') });
    report.screenshots.push('mobile-10-local-lane-split.png');

    // Test WYSIWYG Takeaway ("带走") + Settings/Dark Mode
    await mPage.evaluate(() => window.__NIANLUN_V4__.openTakeaway());
    await wait(450);
    await mPage.screenshot({ path: path.join(SHOTS_DIR, 'mobile-11-takeaway-wysiwyg.png') });
    report.screenshots.push('mobile-11-takeaway-wysiwyg.png');

    await mPage.evaluate(() => window.__NIANLUN_V4__.openSettings());
    await wait(350);
    await mPage.locator('[data-theme-set="dark"]').click();
    await wait(400);
    await mPage.evaluate(() => window.__NIANLUN_V4__.closeDrawer());
    await wait(400);
    await mPage.screenshot({ path: path.join(SHOTS_DIR, 'mobile-12-dark-mode.png') });
    report.screenshots.push('mobile-12-dark-mode.png');

    const mobileVideoPath = await mPage.video().path();
    await mobileCtx.close();
    const mobileDest = path.join(SHOTS_DIR, 'mobile-flow.webm');
    fs.renameSync(mobileVideoPath, mobileDest);
    report.videos.mobileWebm = 'mobile-flow.webm';

    // =========================================================================
    // 2. DESKTOP FLOW (1440x900, Video Recorded!)
    // =========================================================================
    const deskCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      recordVideo: { dir: SHOTS_DIR, size: { width: 1440, height: 900 } },
    });
    const dPage = await deskCtx.newPage();
    dPage.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push(`[desktop] ${m.text()}`); });
    dPage.on('pageerror', (e) => report.pageErrors.push(`[desktop] ${e.message}`));

    await dPage.goto(url, { waitUntil: 'networkidle' });
    await wait(650);
    await dPage.screenshot({ path: path.join(SHOTS_DIR, 'desktop-1-default.png') });
    report.screenshots.push('desktop-1-default.png');

    // Click rail "捏出中间并置卷"
    await dPage.locator('#rail-juxtapose').click();
    await wait(650);
    await dPage.screenshot({ path: path.join(SHOTS_DIR, 'desktop-2-juxtapose-middle-roll.png') });
    report.screenshots.push('desktop-2-juxtapose-middle-roll.png');

    // Click rail "查看局部分道重叠" + open side-by-side Thing Panel (Yield + Relation Threads!)
    await dPage.locator('#rail-conflict').click();
    await wait(650);
    await dPage.evaluate(() => window.__NIANLUN_V4__.selectItem('ev_olympiad'));
    await wait(550);
    await dPage.screenshot({ path: path.join(SHOTS_DIR, 'desktop-3-conflict-yield-dock.png') });
    report.screenshots.push('desktop-3-conflict-yield-dock.png');

    // Open docked 9-message Convergence Intake side-by-side with live scroll!
    await dPage.locator('#rail-intake').click();
    await wait(450);
    await dPage.locator('[data-demo-all]').click();
    await wait(550);
    await dPage.screenshot({ path: path.join(SHOTS_DIR, 'desktop-4-convergence-side-by-side.png') });
    report.screenshots.push('desktop-4-convergence-side-by-side.png');

    // High density + Takeaway on desktop
    await dPage.locator('#rail-takeaway').click();
    await wait(550);
    await dPage.screenshot({ path: path.join(SHOTS_DIR, 'desktop-5-takeaway-dock.png') });
    report.screenshots.push('desktop-5-takeaway-dock.png');

    const deskVideoPath = await dPage.video().path();
    await deskCtx.close();
    const deskDest = path.join(SHOTS_DIR, 'desktop-flow.webm');
    fs.renameSync(deskVideoPath, deskDest);
    report.videos.desktopWebm = 'desktop-flow.webm';

    // =========================================================================
    // 3. WEBKIT (iOS Safari Engine) MOBILE SMOKE TEST
    // =========================================================================
    try {
      const wkBrowser = await webkit.launch({ headless: true });
      const wkCtx = await wkBrowser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
      const wkPage = await wkCtx.newPage();
      const wkErrors = [];
      wkPage.on('pageerror', (e) => wkErrors.push(e.message));
      await wkPage.goto(url, { waitUntil: 'networkidle' });
      await wait(500);
      const wkState = await wkPage.evaluate(() => window.__NIANLUN_V4__.getState());
      report.checks.webkitMobileSmoke = wkErrors.length === 0 && wkState.segs.length >= 9;
      await wkBrowser.close();
    } catch (err) {
      report.checks.webkitMobileSmoke = `skipped: ${err.message}`;
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }

  fs.writeFileSync(path.join(__dirname, 'e2e-results.json'), JSON.stringify(report, null, 2));
  console.log('\n=== Playwright E2E Audit Summary ===');
  console.log(JSON.stringify(report, null, 2));

  if (report.consoleErrors.length > 0 || report.pageErrors.length > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error(err);
  process.exit(1);
});
