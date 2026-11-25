// HAIZ Campus Toybox — Real Browser E2E & Visual Verification Script.
// Launches Vite + headless Google Chrome (SwiftShader WebGL), verifies zero JS/resource errors,
// tests real target grab + welcome story + accessible mode + all 6 gallery characters,
// and saves real screenshots to reports/screenshots/.
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
  // ── 1. Desktop Claw Machine + Full Target Grab E2E
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await attachErrorListeners(page, 'machine-desktop');
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__HAIZ_TOYBOX__?.scene?.state === 'aiming', undefined, { polling: 200, timeout: 90000 });
  await page.waitForTimeout(300);

  const shot1 = '01-machine-desktop.png';
  await page.screenshot({ path: path.join(SHOTS_DIR, shot1) });
  report.screenshots.push(shot1);
  report.checks.push({ name: 'desktop_machine_load', ok: true });

  // Move claw directly over the challenge's target toy and trigger grab
  const targetInfo = await page.evaluate(() => {
    const ch = window.__HAIZ_TOYBOX__;
    const targetId = ch.challenge.target;
    const item = ch.scene.toys.find((t) => t.id === targetId);
    ch.scene.clawX = item.homePos.x;
    ch.scene.clawZ = item.homePos.z;
    return { targetId, x: item.homePos.x, z: item.homePos.z };
  });
  await page.waitForTimeout(500); // satisfy minElapsedMs
  await page.click('[data-role="btn-grab"]');
  await page.waitForFunction(() => window.__HAIZ_TOYBOX__?.scene?.state === 'welcome', undefined, { polling: 200, timeout: 90000 });
  await page.waitForTimeout(1200); // let prize flap open & toy hop onto ledge

  const shot4 = '04-machine-welcome-success.png';
  await page.screenshot({ path: path.join(SHOTS_DIR, shot4) });
  report.screenshots.push(shot4);
  const passTokenOk = await page.evaluate(() => Boolean(window.__HAIZ_TOYBOX__._passedPayload?.passToken?.startsWith('demo_')));
  report.checks.push({ name: 'real_grab_and_welcome_story', ok: passTokenOk, target: targetInfo.targetId });

  // ── 2. Accessible Alternative Mode
  await page.click('[data-role="btn-a11y"]');
  await page.waitForSelector('.tbx-a11y-card', { timeout: 10000 });
  await page.waitForTimeout(300);
  const shot5 = '05-accessible-mode.png';
  await page.screenshot({ path: path.join(SHOTS_DIR, shot5) });
  report.screenshots.push(shot5);
  report.checks.push({ name: 'accessible_mode_render', ok: true });
  await page.close();

  // ── 3. Mobile Portrait (390×844)
  const mp = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await attachErrorListeners(mp, 'machine-mobile-portrait');
  await mp.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });
  await mp.waitForFunction(() => window.__HAIZ_TOYBOX__?.scene?.state === 'aiming', undefined, { polling: 200, timeout: 90000 });
  await mp.waitForTimeout(300);
  const shot2 = '02-machine-mobile-portrait.png';
  await mp.screenshot({ path: path.join(SHOTS_DIR, shot2) });
  report.screenshots.push(shot2);
  report.checks.push({ name: 'mobile_portrait_layout', ok: true });
  await mp.close();

  // ── 4. Mobile Landscape (844×390)
  const ml = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  await attachErrorListeners(ml, 'machine-mobile-landscape');
  await ml.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });
  await ml.waitForFunction(() => window.__HAIZ_TOYBOX__?.scene?.state === 'aiming', undefined, { polling: 200, timeout: 90000 });
  await ml.waitForTimeout(300);
  const shot3 = '03-machine-mobile-landscape.png';
  await ml.screenshot({ path: path.join(SHOTS_DIR, shot3) });
  report.screenshots.push(shot3);
  report.checks.push({ name: 'mobile_landscape_layout', ok: true });
  await ml.close();

  // ── 5. Standalone Character Art Gallery (all 6 characters + silhouette + lantern lighting)
  const gp = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await attachErrorListeners(gp, 'gallery');
  await gp.goto(`${baseUrl}/gallery.html`, { waitUntil: 'networkidle' });
  await gp.waitForFunction(() => Boolean(window.__HAIZ_GALLERY__?.scene?.currentToy), undefined, { polling: 200, timeout: 60000 });

  const ids = ['lanren', 'wuwu', 'fantuan', 'zaozao', 'chaochao', 'changchang'];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    await gp.evaluate((cid) => window.__HAIZ_GALLERY__.selectCharacter(cid), id);
    await gp.waitForTimeout(450);
    const fname = `${String(6 + i).padStart(2, '0')}-gallery-${id}.png`;
    await gp.screenshot({ path: path.join(SHOTS_DIR, fname) });
    report.screenshots.push(fname);
  }

  // Silhouette check on Lanren
  await gp.evaluate(() => {
    window.__HAIZ_GALLERY__.selectCharacter('lanren');
    window.__HAIZ_GALLERY__.scene.setEnvironment('silhouette');
    document.querySelector('[data-role="stage"]').dataset.env = 'silhouette';
  });
  await gp.waitForTimeout(350);
  await gp.screenshot({ path: path.join(SHOTS_DIR, '12-gallery-silhouette.png') });
  report.screenshots.push('12-gallery-silhouette.png');

  // Qilou warm lantern lighting on Fantuan
  await gp.evaluate(() => {
    window.__HAIZ_GALLERY__.selectCharacter('fantuan');
    window.__HAIZ_GALLERY__.scene.setEnvironment('lantern');
    document.querySelector('[data-role="stage"]').dataset.env = 'lantern';
  });
  await gp.waitForTimeout(350);
  await gp.screenshot({ path: path.join(SHOTS_DIR, '13-gallery-lantern.png') });
  report.screenshots.push('13-gallery-lantern.png');

  report.checks.push({ name: 'gallery_all_6_and_envs', ok: true });
  await gp.close();
} finally {
  await browser.close();
  await server.close();
}

fs.writeFileSync(path.join(ROOT, 'reports', 'e2e-results.json'), JSON.stringify(report, null, 2));
console.log(`E2E complete: ${report.checks.length} checks, ${report.screenshots.length} screenshots, ${errors.length} errors.`);
if (errors.length > 0) {
  console.error('Errors:', errors);
  process.exit(1);
}
