#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '/Users/a11/manyiwant/haiz-repo/node_modules/playwright/index.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.hdr': 'application/octet-stream',
  '.bin': 'application/octet-stream',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.ico': 'image/x-icon',
};

function startServer(rootDir) {
  const server = http.createServer(async (req, res) => {
    try {
      const cleanPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const rel = cleanPath === '/' ? 'living-campus-r3.html' : cleanPath.replace(/^\/+/, '');
      const full = path.resolve(rootDir, rel);
      if (!full.startsWith(rootDir)) { res.writeHead(403).end(); return; }
      const data = await fs.readFile(full);
      const ext = path.extname(full).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function sampleFrames(page, count = 110) {
  return page.evaluate(async (n) => {
    const times = [];
    let prev = performance.now();
    await new Promise((resolve) => {
      let i = 0;
      function tick(now) {
        times.push(now - prev);
        prev = now;
        i++;
        if (i >= n) resolve();
        else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
    times.shift();
    const sorted = [...times].sort((a, b) => a - b);
    const meanMs = times.reduce((a, b) => a + b, 0) / times.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    const heapMB = performance.memory ? +(performance.memory.usedJSHeapSize / 1e6).toFixed(1) : null;
    const canvas = document.querySelector('canvas');
    let glInfo = null;
    try {
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
      glInfo = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER);
    } catch {}
    return {
      fpsMean: +(1000 / meanMs).toFixed(1),
      frameMsMean: +meanMs.toFixed(2),
      frameMsP50: +p50.toFixed(2),
      frameMsP95: +p95.toFixed(2),
      heapMB,
      renderer: glInfo,
    };
  }, count);
}

async function run() {
  const { server, port } = await startServer(REPO);
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'],
  });

  const consoleErrors = [];
  const pageErrors = [];
  const httpErrors = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('console', (m) => { if (m.type() === 'error') { consoleErrors.push(m.text()); console.error('[console.error]', m.text()); } });
    page.on('pageerror', (e) => { pageErrors.push(String(e)); console.error('[pageerror]', e); });
    page.on('response', (r) => { if (r.status() >= 400) { httpErrors.push(`${r.status()} ${r.url()}`); console.error('[http]', r.status(), r.url()); } });

    // 1. Lab Hero Solo
    await page.goto(`http://127.0.0.1:${port}/living-character-lab.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__HAIZ_LAB__?.isReady(), { timeout: 30000 });
    await page.waitForTimeout(400);
    const labSolo = {
      ...(await sampleFrames(page, 100)),
      renderInfo: await page.evaluate(() => window.__HAIZ_LAB__.getRenderInfo()),
    };

    // 2. Lab 3-Way Compare
    await page.evaluate(() => window.__HAIZ_LAB__.setMode('compare'));
    await page.waitForTimeout(500);
    const labCompare = {
      ...(await sampleFrames(page, 100)),
      renderInfo: await page.evaluate(() => window.__HAIZ_LAB__.getRenderInfo()),
    };

    // 3. Campus R3 (PBR 南海晴光)
    await page.goto(`http://127.0.0.1:${port}/living-campus-r3.html?quality=high&lens=0`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__HAIZ_R3__?.ready), { timeout: 45000 });
    await page.evaluate(() => window.__HAIZ_R3__.streamPromise);
    await page.waitForTimeout(800);
    // Walk forward a moment on campus & capture smoke frame
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1400);
    await page.keyboard.up('KeyW');
    await page.screenshot({ path: path.join(REPO, 'living-character/renders/campus-r3-smoke.png') });
    const campusPbr = {
      ...(await sampleFrames(page, 100)),
      stats: await page.evaluate(() => window.__HAIZ_R3__.getStats()),
    };

    // 4. Campus R3 (Gouache 入画水粉)
    await page.evaluate(() => window.__HAIZ_R3__.setLens(1));
    await page.waitForTimeout(500);
    const campusGouache = {
      ...(await sampleFrames(page, 100)),
      stats: await page.evaluate(() => window.__HAIZ_R3__.getStats()),
    };

    const report = {
      timestamp: new Date().toISOString(),
      gpuRenderer: campusPbr.renderer || labSolo.renderer,
      errors: {
        console: consoleErrors.length,
        page: pageErrors.length,
        http: httpErrors.length,
      },
      benchmarks: {
        labHeroSolo: labSolo,
        lab3WayCompare: labCompare,
        campusR3Pbr: campusPbr,
        campusR3Gouache: campusGouache,
      },
    };

    const outJson = path.join(REPO, 'living-character/data/gpu-benchmark-r3.json');
    await fs.writeFile(outJson, JSON.stringify(report, null, 2));
    console.log('GPU Benchmark Report:', JSON.stringify(report, null, 2));
    if (consoleErrors.length || pageErrors.length || httpErrors.length) {
      console.error({ consoleErrors, pageErrors, httpErrors });
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
