#!/usr/bin/env node
/**
 * HAIZ · World Reconstruction Round 2 — Real Metal-GPU Playwright Chromium Verification & Benchmark.
 * Verifies WebGL2 Metal rendering across Desktop (1440x900 high) and Mobile (390x844 touch):
 *   - 0 console/page/network errors
 *   - All 9 inherited Atelier GLBs + all R2 district GLBs loaded cleanly
 *   - COLOR_0 vertex colors intact on landmark/terminalia, site.ground.context stripped from forecourt, HDR IBL active
 *   - Captures visual verification screenshots across calibrated vistas, Walk/Bike/Glide, Weather/Night, Lens & Comparison Modal
 *   - Writes honest world-reconstruction-r2/data/gpu-benchmark-r2.json
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/a11/manyiwant/haiz-repo/node_modules/playwright');

const REPO = '/Users/a11/manyiwant/haiz-world-reconstruction-r2';
const R2 = path.join(REPO, 'world-reconstruction-r2');
const SCRATCH = '/Users/a11/.gemini/antigravity/brain/0213b5cb-0365-4869-be17-edd2d36559fd/scratch/r2_gpu';
fs.mkdirSync(SCRATCH, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.hdr': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function startStaticServer(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const cleanPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const abs = path.join(rootDir, cleanPath === '/' ? 'world-reconstruction-r2.html' : cleanPath);
      if (!abs.startsWith(rootDir) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      const ext = path.extname(abs).toLowerCase();
      res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
      fs.createReadStream(abs).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function samplePerf(page, frames = 25) {
  await page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) {
      await new Promise((r) => requestAnimationFrame(r));
    }
  }, frames);
  return page.evaluate(() => window.__HAIZ_R2__.getStats());
}

async function main() {
  const { server, port } = await startStaticServer(REPO);
  const baseUrl = `http://127.0.0.1:${port}/world-reconstruction-r2.html`;

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'],
  });

  const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await desktopCtx.newPage();

  const errors = [];
  const failedReqs = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) failedReqs.push(`${r.status()} ${r.url()}`); });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.stage === 'ready' && window.__HAIZ_R2__, null, { timeout: 60000 });
  await page.evaluate(() => window.__HAIZ_R2__.streamPromise);

  // Inspect GPU vendor/renderer, COLOR_0 vertex colors, forecourt strip & HDR IBL
  const audit = await page.evaluate(() => {
    const api = window.__HAIZ_R2__;
    const canvas = document.getElementById('wr-canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const vendorStr = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);

    let hasSiteContext = false;
    api.districts.atelierParts.get('forecourt')?.traverse((o) => {
      if ((o.name || '').toLowerCase().includes('site.ground.context')) hasSiteContext = true;
    });
    let landmarkColor0 = false;
    api.districts.atelierParts.get('landmark')?.traverse((o) => {
      if (o.isMesh && o.geometry?.attributes?.color) landmarkColor0 = true;
    });
    let terminaliaColor0 = false;
    let terminaliaLeafDoubleSide = false;
    api.districts.atelierParts.get('terminalia')?.traverse((o) => {
      if (o.isMesh && o.geometry?.attributes?.color) terminaliaColor0 = true;
      if (o.isMesh && (o.name || '').toLowerCase().includes('leaves')) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        if (mats.some((m) => m.side === 2)) terminaliaLeafDoubleSide = true;
      }
    });

    return {
      rendererStr,
      vendorStr,
      hasEnvIbl: Boolean(api.scene.environment),
      hasSiteContext,
      landmarkColor0,
      terminaliaColor0,
      terminaliaLeafDoubleSide,
      stats: api.getStats(),
    };
  });

  console.log('Desktop Metal Audit:', JSON.stringify(audit, null, 2));
  assert.ok(audit.stats.atelierCount === 9, 'All 9 Atelier GLBs must load');
  assert.ok(audit.stats.r2DistrictsCount >= 4, 'R2 district bundles must load');
  assert.equal(audit.hasSiteContext, false, 'forecourt site.ground.context must be stripped');
  assert.equal(audit.landmarkColor0, true, 'landmark COLOR_0 vertex colors must survive');
  assert.equal(audit.terminaliaColor0, true, 'terminalia COLOR_0 vertex colors must survive');

  // Capture calibrated desktop shots & sample steady-state FPS
  const shot = async (file) => {
    await page.waitForTimeout(160);
    await page.screenshot({ path: path.join(SCRATCH, file), type: 'jpeg', quality: 90 });
    console.log('Screenshot:', file);
  };

  const bootStats = await samplePerf(page, 25);
  await shot('01_desktop_boot_forecourt.jpg');

  const vistas = [
    ['beimen', '02_desktop_beimen_calib.jpg'],
    ['library', '03_desktop_library_calib.jpg'],
    ['fengqitang', '04_desktop_fengqitang_courtyard.jpg'],
    ['yanlinting', '05_desktop_yanlinting_pavilion.jpg'],
    ['keji', '06_desktop_keji_plaza.jpg'],
    ['yanchi_arts', '07_desktop_yanchi_arts.jpg'],
  ];
  for (const [vid, fname] of vistas) {
    await page.evaluate((id) => window.__HAIZ_R2__.flyToVista(id), vid);
    await samplePerf(page, 12);
    await shot(fname);
  }

  // Bike + Rain
  await page.evaluate(() => {
    window.__HAIZ_R2__.teleport(0, -64, 0);
    window.__HAIZ_R2__.setMode('bike');
    window.__HAIZ_R2__.setWeather('rain');
  });
  const bikeStats = await samplePerf(page, 18);
  await shot('08_desktop_bike_rain.jpg');

  // Glider + Sunset
  await page.evaluate(() => {
    window.__HAIZ_R2__.setWeather('clear');
    window.__HAIZ_R2__.setHour(18.2);
    window.__HAIZ_R2__.setMode('glide');
  });
  const glideStats = await samplePerf(page, 18);
  await shot('09_desktop_glide_sunset.jpg');

  // Comparison modal open + clear weather
  await page.evaluate(() => {
    window.__HAIZ_R2__.setHour(16.65);
    window.__HAIZ_R2__.setMode('walk');
    window.__HAIZ_R2__.openComparison(true, 'library');
  });
  await shot('10_desktop_comparison_drawer.jpg');

  await page.evaluate(() => {
    window.__HAIZ_R2__.openComparison(false);
    window.__HAIZ_R2__.setLens(1);
    window.__HAIZ_R2__.flyToVista('beimen');
  });
  await shot('11_desktop_gouache_beimen.jpg');

  // Mobile portrait touch emulation (390x844)
  const mobCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const mPage = await mobCtx.newPage();
  mPage.on('pageerror', (e) => errors.push(`mobile pageerror: ${e.message}`));
  mPage.on('console', (m) => { if (m.type() === 'error') errors.push(`mobile console.error: ${m.text()}`); });
  await mPage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await mPage.waitForFunction(() => document.body.dataset.stage === 'ready' && window.__HAIZ_R2__, null, { timeout: 60000 });
  await mPage.evaluate(() => window.__HAIZ_R2__.streamPromise);
  const mobileStats = await samplePerf(mPage, 25);
  await mPage.screenshot({ path: path.join(SCRATCH, '12_mobile_portrait.jpg'), type: 'jpeg', quality: 90 });

  assert.equal(errors.length, 0, `Unexpected runtime errors: ${errors.join('; ')}`);
  assert.equal(failedReqs.length, 0, `Unexpected failed HTTP requests: ${failedReqs.join('; ')}`);

  const benchmark = {
    schema: 'haiz-r2-gpu-benchmark/1',
    timestamp: new Date().toISOString(),
    gpu_renderer: audit.rendererStr,
    gpu_vendor: audit.vendorStr,
    measurement_scope: 'Local Playwright Metal-accelerated Chromium on macOS Apple Silicon (mobile metrics collected under 390x844 touch emulation with mobile quality tier, not physical smartphone hardware).',
    desktop_1440x900_high: {
      boot_ms: bootStats.bootMs,
      steady_fps: bootStats.fps,
      frame_ms: bootStats.frameMs,
      draw_calls: bootStats.calls,
      triangles: bootStats.tris,
      geometries: bootStats.geometries,
      textures: bootStats.textures,
      bike_rain_fps: bikeStats.fps,
      glide_sunset_fps: glideStats.fps,
    },
    mobile_390x844_touch_emulated: {
      boot_ms: mobileStats.bootMs,
      quality_tier: mobileStats.quality,
      steady_fps: mobileStats.fps,
      frame_ms: mobileStats.frameMs,
      draw_calls: mobileStats.calls,
      triangles: mobileStats.tris,
    },
    atelier_preservation: {
      inherited_atelier_count: audit.stats.atelierCount,
      r2_districts_count: audit.stats.r2DistrictsCount,
      has_hdr_ibl: audit.hasEnvIbl,
      forecourt_context_stripped: !audit.hasSiteContext,
      landmark_color0_intact: audit.landmarkColor0,
      terminalia_color0_intact: audit.terminaliaColor0,
      terminalia_leaf_double_sided: audit.terminaliaLeafDoubleSide,
    },
  };

  fs.writeFileSync(path.join(R2, 'data/gpu-benchmark-r2.json'), JSON.stringify(benchmark, null, 2));
  console.log('Saved GPU benchmark -> world-reconstruction-r2/data/gpu-benchmark-r2.json');

  await browser.close();
  server.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
