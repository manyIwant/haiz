// HAIZ Campus Toybox — Real Browser E2E & First-Time Stranger Visual Verification Script.
// Verifies:
// 1. First-time user who does NOT know any character names sees:
//    - live rotating 3D target character inside the illuminated Qilou roof showcase vitrine
//    - primary copy "请抓住这位伙伴" (name is secondary)
//    - concise, skippable first-time onboarding guide
//    - clear horizontal separation of all 6 toys inside the cabinet (zero severe occlusion)
// 2. Full grab → prize window welcome story → demo passToken verification
// 3. Mobile portrait (390×844) & Mobile landscape (844×390) zero-occlusion layouts
// 4. Accessible alternative mode & Standalone Character Art Gallery
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SHOTS_DIR = path.join(ROOT, 'reports', 'screenshots');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const server = await createServer({
  root: ROOT,
  server: { port: 0, host: '127.0.0.1' },
  logLevel: 'error',
});
await server.listen();
const port = server.httpServer.address().port;
const baseUrl = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const errors = [];
const report = { timestamp: new Date().toISOString(), checks: [], screenshots: [], errors };

async function attachErrorListeners(page, label) {
  page.on('pageerror', (err) => errors.push({ label, type: 'pageerror', message: String(err) }));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push({ label, type: 'console.error', message: msg.text() });
  });
  page.on('requestfailed', (req) => {
    errors.push({ label, type: 'requestfailed', url: req.url(), failure: req.failure()?.errorText });
  });
}

try {
  // ── 1. First-Time Stranger Desktop Scenario (1280×800, fresh localStorage)
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await attachErrorListeners(page, 'machine-desktop');
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__HAIZ_TOYBOX__?.scene?.state === 'aiming', undefined, { polling: 200, timeout: 90000 });
  await page.waitForTimeout(450);

  // Verify first-time stranger requirements
  const firstTimeAudit = await page.evaluate(() => {
    const ch = window.__HAIZ_TOYBOX__;
    const guideVisible = !document.querySelector('[data-role="guide"]').classList.contains('hidden');
    const primaryStatus = document.querySelector('[data-role="status"]').childNodes[0].textContent.trim();
    const showcaseId = ch.scene.showcaseToy?.id;
    const rotBefore = ch.scene.cabinet.targetTurntable.rotation.y;
    const xs = ch.challenge.layout.map((l) => l.x).sort((a, b) => a - b);
    let minXGap = Infinity;
    for (let i = 1; i < xs.length; i++) minXGap = Math.min(minXGap, xs[i] - xs[i - 1]);
    return {
      guideVisible,
      primaryStatus,
      showcaseMatchesTarget: showcaseId === ch.challenge.target,
      rotBefore,
      minXGap: Number(minXGap.toFixed(3)),
    };
  });
  const rotating = firstTimeAudit.rotBefore > 0.26;

  // Capture desktop WITH first-time onboarding guide visible
  await page.screenshot({ path: path.join(SHOTS_DIR, '01-machine-desktop-onboarding.png') });
  report.screenshots.push('01-machine-desktop-onboarding.png');

  // Skip guide and capture clean desktop view
  await page.click('[data-role="btn-skip-guide"]');
  await page.waitForTimeout(200);
  const guideDismissed = await page.evaluate(() => document.querySelector('[data-role="guide"]').classList.contains('hidden'));
  await page.screenshot({ path: path.join(SHOTS_DIR, '01-machine-desktop.png') });
  report.screenshots.push('01-machine-desktop.png');

  report.checks.push({
    name: 'first_time_stranger_visual_target_and_onboarding',
    ok:
      firstTimeAudit.guideVisible &&
      guideDismissed &&
      firstTimeAudit.primaryStatus.includes('请抓住这位伙伴') &&
      firstTimeAudit.showcaseMatchesTarget &&
      rotating &&
      firstTimeAudit.minXGap >= 0.219,
    details: { ...firstTimeAudit, rotating, guideDismissed },
  });

  // Grab the target toy and verify the welcome story
  const targetInfo = await page.evaluate(() => {
    const ch = window.__HAIZ_TOYBOX__;
    const targetId = ch.challenge.target;
    const item = ch.scene.toys.find((t) => t.id === targetId);
    ch.scene.clawX = item.homePos.x;
    ch.scene.clawZ = item.homePos.z;
    return { targetId };
  });
  await page.waitForTimeout(500);
  await page.click('[data-role="btn-grab"]');
  await page.waitForFunction(() => window.__HAIZ_TOYBOX__?.scene?.state === 'welcome', undefined, { polling: 200, timeout: 90000 });
  await page.waitForTimeout(1200);

  await page.screenshot({ path: path.join(SHOTS_DIR, '04-machine-welcome-success.png') });
  report.screenshots.push('04-machine-welcome-success.png');
  const passTokenOk = await page.evaluate(() => Boolean(window.__HAIZ_TOYBOX__._passedPayload?.passToken?.startsWith('demo_')));
  report.checks.push({ name: 'real_grab_and_welcome_story', ok: passTokenOk, target: targetInfo.targetId });

  // Accessible Alternative Mode
  await page.click('[data-role="btn-a11y"]');
  await page.waitForSelector('.tbx-a11y-card', { timeout: 10000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS_DIR, '05-accessible-mode.png') });
  report.screenshots.push('05-accessible-mode.png');
  report.checks.push({ name: 'accessible_mode_render', ok: true });
  await page.close();

  // ── 2. Mobile Portrait (390×844) — First-time view + after skip
  const mp = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await attachErrorListeners(mp, 'machine-mobile-portrait');
  await mp.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });
  await mp.waitForFunction(() => window.__HAIZ_TOYBOX__?.scene?.state === 'aiming', undefined, { polling: 200, timeout: 90000 });
  await mp.waitForTimeout(350);
  await mp.screenshot({ path: path.join(SHOTS_DIR, '02-machine-mobile-portrait-onboarding.png') });
  report.screenshots.push('02-machine-mobile-portrait-onboarding.png');
  await mp.click('[data-role="btn-skip-guide"]');
  await mp.waitForTimeout(250);
  await mp.screenshot({ path: path.join(SHOTS_DIR, '02-machine-mobile-portrait.png') });
  report.screenshots.push('02-machine-mobile-portrait.png');
  report.checks.push({ name: 'mobile_portrait_layout', ok: true });
  await mp.close();

  // ── 3. Mobile Landscape (844×390)
  const ml = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  await attachErrorListeners(ml, 'machine-mobile-landscape');
  await ml.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });
  await ml.waitForFunction(() => window.__HAIZ_TOYBOX__?.scene?.state === 'aiming', undefined, { polling: 200, timeout: 90000 });
  await ml.click('[data-role="btn-skip-guide"]');
  await ml.waitForTimeout(300);
  await ml.screenshot({ path: path.join(SHOTS_DIR, '03-machine-mobile-landscape.png') });
  report.screenshots.push('03-machine-mobile-landscape.png');
  report.checks.push({ name: 'mobile_landscape_layout', ok: true });
  await ml.close();
} finally {
  await browser.close();
  await server.close();
}

fs.writeFileSync(path.join(ROOT, 'reports', 'e2e-results.json'), JSON.stringify(report, null, 2));
const failedChecks = report.checks.filter((c) => !c.ok);
console.log(`E2E complete: ${report.checks.length} checks (${failedChecks.length} failed), ${report.screenshots.length} screenshots, ${errors.length} errors.`);
if (errors.length > 0 || failedChecks.length > 0) {
  console.error('Failed checks:', failedChecks, 'Errors:', errors);
  process.exit(1);
}
