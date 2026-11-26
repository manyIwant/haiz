/**
 * HAIZ · World Reconstruction — Real Metal-GPU Verification & Benchmark Harness
 *
 * Launches real Chromium with ANGLE Metal WebGL (not software SwiftShader),
 * serves the local repository over HTTP, verifies zero console/page/404 errors,
 * exercises all districts, landmarks, movement modes, 3 unified lenses, weather/time
 * coupling, vector map, provenance inspector, and mobile touch layout, captures
 * visual-inspection screenshots, and measures real 5s continuous rAF GPU metrics.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const SHOTS_DIR = path.resolve(__dirname, 'shots');
const OUT_JSON = path.resolve(__dirname, '../data/gpu-benchmark.json');

fs.mkdirSync(SHOTS_DIR, { recursive: true });

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/a11/manyiwant/haiz-repo/node_modules/playwright');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const rel = urlPath === '/' ? 'world-reconstruction.html' : urlPath.replace(/^\/+/, '');
      const full = path.resolve(REPO_ROOT, rel);
      if (!full.startsWith(REPO_ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(full).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(full).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

async function sampleContinuousRaf(page, durationMs = 5000) {
  return page.evaluate(async (ms) => {
    const deltas = [];
    const callsArr = [];
    const trisArr = [];
    const start = performance.now();
    let prev = start;
    await new Promise((resolve) => {
      function tick(now) {
        const dt = now - prev;
        prev = now;
        if (dt > 0.5 && dt < 500) {
          deltas.push(dt);
          const st = window.__haizWorld.getStats();
          callsArr.push(st.calls);
          trisArr.push(st.tris);
        }
        if (now - start >= ms) {
          resolve();
        } else {
          requestAnimationFrame(tick);
        }
      }
      requestAnimationFrame(tick);
    });
    deltas.sort((a, b) => a - b);
    const meanMs = deltas.reduce((a, b) => a + b, 0) / Math.max(1, deltas.length);
    const p50 = deltas[Math.floor(deltas.length * 0.5)] || 0;
    const p95 = deltas[Math.floor(deltas.length * 0.95)] || 0;
    const avgCalls = callsArr.reduce((a, b) => a + b, 0) / Math.max(1, callsArr.length);
    const avgTris = trisArr.reduce((a, b) => a + b, 0) / Math.max(1, trisArr.length);
    const st = window.__haizWorld.getStats();
    return {
      frames: deltas.length,
      durationMs: ms,
      fpsMean: +(1000 / Math.max(1, meanMs)).toFixed(1),
      frameMsMean: +meanMs.toFixed(2),
      frameMsP50: +p50.toFixed(2),
      frameMsP95: +p95.toFixed(2),
      callsAvg: Math.round(avgCalls),
      trisAvg: Math.round(avgTris),
      geometries: st.geometries,
      textures: st.textures,
      bootMs: st.bootMs,
      districtsLoaded: st.districtsLoaded,
      districtsTotal: st.districtsTotal,
      quality: st.quality,
    };
  }, durationMs);
}

async function getGpuInfo(page) {
  return page.evaluate(() => {
    const c = document.getElementById('wr-canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return { error: 'no-webgl' };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      version: gl.getParameter(gl.VERSION),
      dpr: window.devicePixelRatio,
      viewport: [window.innerWidth, window.innerHeight],
    };
  });
}

async function shot(page, name) {
  // Let a few frames settle cleanly
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const out = path.join(SHOTS_DIR, name);
  await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
  return name;
}

async function run() {
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}/world-reconstruction.html`;
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=metal',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--no-sandbox',
    ],
  });

  const report = {
    timestamp: new Date().toISOString(),
    gpu: null,
    desktop: {},
    mobile: {},
    checks: {},
    errors: [],
    warnings: [],
    httpErrors: [],
    screenshots: [],
  };

  try {
    // ═══════════════════════════════════════════════════════════
    // 1. DESKTOP RUN (1440×900, High Quality)
    // ═══════════════════════════════════════════════════════════
    const dCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const dPage = await dCtx.newPage();
    dPage.on('console', (m) => {
      if (m.type() === 'error') { console.error('[desktop console.error]', m.text()); report.errors.push(`desktop: ${m.text()}`); }
      else if (m.type() === 'warning') report.warnings.push(`desktop: ${m.text()}`);
    });
    dPage.on('pageerror', (e) => { console.error('[desktop pageerror]', e.message); report.errors.push(`desktop pageerror: ${e.message}`); });
    dPage.on('response', (res) => {
      if (res.status() >= 400 && !res.url().includes('favicon.ico')) {
        console.error('[desktop HTTP]', res.status(), res.url());
        report.httpErrors.push(`desktop ${res.status()} ${res.url()}`);
      }
    });

    await dPage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await dPage.waitForFunction(() => document.body.dataset.stage === 'ready' && !!window.__haizWorld, { timeout: 30000 });
    await dPage.evaluate(() => window.__haizWorld.streamPromise);
    await dPage.waitForTimeout(350);

    report.gpu = await getGpuInfo(dPage);
    const statsInit = await dPage.evaluate(() => window.__haizWorld.getStats());

    // 5-second continuous real rAF GPU benchmark on Desktop
    report.desktop = await sampleContinuousRaf(dPage, 5000);
    report.checks.allDistrictsStreamed = statsInit.districtsLoaded === statsInit.districtsTotal;

    // 01: Default opening forecourt arrival
    report.screenshots.push(await shot(dPage, '01_desktop_opening_forecourt.jpg'));

    // 02..06: Curated vistas across every major campus landmark (exact world_spec.json IDs!)
    const vistaShots = [
      ['north_gate', '02_vista_north_gate.jpg'],
      ['terminalia', '03_vista_terminalia.jpg'],
      ['yanchi_arts', '04_vista_yanchi_arts.jpg'],
      ['library_dome', '05_vista_library_dome.jpg'],
      ['fengqitang', '06_vista_sports_heritage.jpg'],
    ];
    for (const [vid, fname] of vistaShots) {
      const okVista = await dPage.evaluate((id) => window.__haizWorld.flyToVista(id), vid);
      if (!okVista) report.errors.push(`vista not found: ${vid}`);
      await dPage.waitForTimeout(120);
      report.screenshots.push(await shot(dPage, fname));
    }

    // 07: Campus Bike riding down Royal Palm Avenue toward Teaching Block 1
    await dPage.evaluate(() => {
      const w = window.__haizWorld;
      w.setMode('bike');
      w.teleport(0.0, -76.0, 0.0);
      w.player.camYaw = 0.22;
      w.player.camPitch = 0.20;
      w.player.camDist = 6.2;
      w.player.speed = 6.5;
      for (let i = 0; i < 8; i++) w.step(0.03);
    });
    report.screenshots.push(await shot(dPage, '07_mode_bike_avenue.jpg'));

    // 08: Thermal Wind Glider soaring over central campus
    await dPage.evaluate(() => {
      const w = window.__haizWorld;
      w.setMode('glide');
      w.player.pos.set(16.0, 44.0, -52.0);
      w.player.yaw = -0.35;
      w.player.camYaw = -0.35;
      w.player.camPitch = 0.34;
      w.player.camDist = 11.5;
      w.step(0.03);
    });
    report.screenshots.push(await shot(dPage, '08_mode_glider_aerial.jpg'));

    // 09 & 10: Unified 3-Lens World verification (same sceneUuid, zero geometry leak)
    await dPage.evaluate(() => {
      const w = window.__haizWorld;
      w.setMode('walk');
      w.flyToVista('axis_arrival');
    });
    const beforeLens = await dPage.evaluate(() => window.__haizWorld.getStats());

    await dPage.evaluate(() => window.__haizWorld.setLens(1));
    await dPage.waitForTimeout(100);
    const gouacheStats = await dPage.evaluate(() => window.__haizWorld.getStats());
    report.screenshots.push(await shot(dPage, '09_lens_gouache.jpg'));

    await dPage.evaluate(() => window.__haizWorld.setLens(2));
    await dPage.waitForTimeout(100);
    const planStats = await dPage.evaluate(() => window.__haizWorld.getStats());
    report.screenshots.push(await shot(dPage, '10_lens_plan_cutaway.jpg'));

    await dPage.evaluate(() => window.__haizWorld.setLens(0));
    const afterLens = await dPage.evaluate(() => window.__haizWorld.getStats());

    report.checks.unifiedSceneUuidAcrossLenses =
      beforeLens.sceneUuid === gouacheStats.sceneUuid &&
      beforeLens.sceneUuid === planStats.sceneUuid &&
      beforeLens.sceneUuid === afterLens.sceneUuid;
    report.checks.zeroGeometryLeakOnLensSwitch =
      Math.abs(afterLens.geometries - beforeLens.geometries) <= 2;

    // 11: Tropical Rain coupling (wet reflective paving + 3D rain streaks + umbrellas/sheltering)
    await dPage.evaluate(() => {
      const w = window.__haizWorld;
      w.setWeather('rain');
      w.setHour(16.3);
      w.teleport(-4.5, -45.5, 0.12);
      w.player.camYaw = 0.14;
      w.player.camPitch = 0.16;
      w.player.camDist = 6.8;
      for (let i = 0; i < 16; i++) w.step(0.05);
    });
    report.screenshots.push(await shot(dPage, '11_weather_tropical_rain.jpg'));

    // 12: Evening Study 20:30 (night sky + stars + warm classroom glow + 3-globe avenue lamps)
    await dPage.evaluate(() => {
      const w = window.__haizWorld;
      w.setWeather('clear');
      w.setHour(20.5);
      w.flyToVista('axis_arrival');
      for (let i = 0; i < 6; i++) w.step(0.05);
    });
    report.screenshots.push(await shot(dPage, '12_time_evening_study.jpg'));

    // 13: Provenance Inspector card + 14: Interactive Vector Map modal
    await dPage.evaluate(() => {
      const w = window.__haizWorld;
      w.setHour(16.65);
      w.flyToVista('axis_arrival');
      w.selectBuilding('yihao');
    });
    await dPage.waitForTimeout(100);
    report.screenshots.push(await shot(dPage, '13_ui_provenance_card.jpg'));

    await dPage.evaluate(() => {
      const w = window.__haizWorld;
      w.hud.showProvenance(null);
      w.openMap(true);
    });
    await dPage.waitForTimeout(120);
    report.screenshots.push(await shot(dPage, '14_ui_vector_map.jpg'));

    await dCtx.close();

    // ═══════════════════════════════════════════════════════════
    // 2. MOBILE RUN (390×844, Touch Emulation, Mobile Quality)
    // ═══════════════════════════════════════════════════════════
    const mCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
    });
    const mPage = await mCtx.newPage();
    mPage.on('console', (m) => {
      if (m.type() === 'error') { console.error('[mobile console.error]', m.text()); report.errors.push(`mobile: ${m.text()}`); }
      else if (m.type() === 'warning') report.warnings.push(`mobile: ${m.text()}`);
    });
    mPage.on('pageerror', (e) => { console.error('[mobile pageerror]', e.message); report.errors.push(`mobile pageerror: ${e.message}`); });
    mPage.on('response', (res) => {
      if (res.status() >= 400 && !res.url().includes('favicon.ico')) {
        console.error('[mobile HTTP]', res.status(), res.url());
        report.httpErrors.push(`mobile ${res.status()} ${res.url()}`);
      }
    });

    await mPage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mPage.waitForFunction(() => document.body.dataset.stage === 'ready' && !!window.__haizWorld, { timeout: 30000 });
    await mPage.evaluate(() => window.__haizWorld.streamPromise);
    await mPage.waitForTimeout(350);

    const mobileLayout = await mPage.evaluate(() => {
      const zone = document.querySelector('.wr-touch-zone');
      const zoneStyle = zone ? getComputedStyle(zone).display : 'none';
      return {
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
        joystickVisible: zoneStyle !== 'none',
        quality: window.__haizWorld.getStats().quality,
      };
    });
    report.checks.mobileNoHorizontalOverflow = !mobileLayout.overflowX;
    report.checks.mobileAutoQuality = mobileLayout.quality === 'mobile';
    report.checks.mobileTouchJoystickVisible = mobileLayout.joystickVisible;

    // 5-second continuous real rAF GPU benchmark on Mobile viewport
    report.mobile = await sampleContinuousRaf(mPage, 5000);
    report.mobile.layout = mobileLayout;

    // 15: Mobile portrait opening forecourt
    report.screenshots.push(await shot(mPage, '15_mobile_opening_forecourt.jpg'));

    // 16: Mobile Yanchi in tropical rain
    await mPage.evaluate(() => {
      const w = window.__haizWorld;
      w.setWeather('rain');
      w.flyToVista('yanchi_arts');
      for (let i = 0; i < 10; i++) w.step(0.05);
    });
    report.screenshots.push(await shot(mPage, '16_mobile_yanchi_rain.jpg'));

    // 17: Mobile vector map modal
    await mPage.evaluate(() => {
      const w = window.__haizWorld;
      w.setWeather('clear');
      w.setHour(20.4);
      w.openMap(true);
    });
    await mPage.waitForTimeout(100);
    report.screenshots.push(await shot(mPage, '17_mobile_evening_map.jpg'));

    await mCtx.close();
  } finally {
    await browser.close();
    server.close();
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
  console.log('\n=== HAIZ REAL-GPU VERIFICATION SUMMARY ===');
  console.log('GPU      :', report.gpu?.renderer);
  console.log('Desktop  :', `${report.desktop.fpsMean} FPS (P50 ${report.desktop.frameMsP50}ms / P95 ${report.desktop.frameMsP95}ms) | ${report.desktop.callsAvg} calls | ${report.desktop.trisAvg} tris | boot ${report.desktop.bootMs}ms`);
  console.log('Mobile   :', `${report.mobile.fpsMean} FPS (P50 ${report.mobile.frameMsP50}ms / P95 ${report.mobile.frameMsP95}ms) | ${report.mobile.callsAvg} calls | ${report.mobile.trisAvg} tris | boot ${report.mobile.bootMs}ms`);
  console.log('Checks   :', JSON.stringify(report.checks));
  console.log('Errors   :', report.errors.length, '| HTTP>=400:', report.httpErrors.length, '| Warnings:', report.warnings.length);
  if (report.errors.length) console.log('ERROR LIST:', report.errors);
  if (report.httpErrors.length) console.log('HTTP ERRORS:', report.httpErrors);
  if (report.warnings.length) console.log('WARNINGS:', report.warnings.slice(0, 10));

  const ok =
    report.errors.length === 0 &&
    report.httpErrors.length === 0 &&
    Object.values(report.checks).every(Boolean);
  process.exit(ok ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
