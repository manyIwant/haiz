#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '/Users/a11/manyiwant/haiz-repo/node_modules/playwright/index.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const argTag = process.argv.find((a) => a.startsWith('--tag='))?.split('=')[1] || 'v1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function startServer(rootDir) {
  const server = http.createServer(async (req, res) => {
    try {
      const cleanPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const rel = cleanPath === '/' ? 'living-character-lab.html' : cleanPath.replace(/^\/+/, '');
      const full = path.resolve(rootDir, rel);
      if (!full.startsWith(rootDir)) {
        res.writeHead(403).end();
        return;
      }
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

async function run() {
  const { server, port } = await startServer(REPO);
  const shotsDir = path.join(REPO, 'living-character/renders/captures', argTag);
  await fs.mkdir(shotsDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'],
  });

  const consoleErrors = [];
  const pageErrors = [];
  const httpErrors = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.error('[browser console.error]', msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
      console.error('[browser pageerror]', err);
    });
    page.on('response', (res) => {
      if (res.status() >= 400) {
        httpErrors.push(`${res.status()} ${res.url()}`);
        console.error('[http error]', res.status(), res.url());
      }
    });

    await page.goto(`http://127.0.0.1:${port}/living-character-lab.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__HAIZ_LAB__?.isReady(), { timeout: 30000 });
    await page.evaluate(() => window.__HAIZ_LAB__.setPlaying(false));

    const results = {
      tag: argTag,
      consoleErrors,
      pageErrors,
      httpErrors,
      scenarios: {},
      shots: [],
    };

    const runScenario = async (name, { mode = 'solo', terrain = 'flat', scenario, cam = 'side', frames = 150, shotFrames = [30, 90, 140], lens = 0, bags = 'both', archetype = 'student_hero' }) => {
      await page.evaluate(async (cfg) => {
        const L = window.__HAIZ_LAB__;
        await L.setMode(cfg.mode);
        L.setTerrain(cfg.terrain);
        L.setScenario(cfg.scenario);
        L.setCamera(cfg.cam);
        L.setLens(cfg.lens);
        L.setBags(cfg.bags);
        L.setDebug(false);
        L.stepFixed(1 / 30);
      }, { mode, terrain, scenario, cam, lens, bags, archetype });

      const samples = [];
      for (let f = 0; f < frames; f++) {
        const m = await page.evaluate(() => {
          const L = window.__HAIZ_LAB__;
          L.stepFixed(1 / 30);
          return L.getMetrics();
        });
        samples.push({ frame: f, t: +(f / 30).toFixed(4), ...m });
        if (shotFrames.includes(f)) {
          const outPng = path.join(shotsDir, `${name}_f${String(f).padStart(3, '0')}.png`);
          await page.screenshot({ path: outPng });
          results.shots.push(path.relative(REPO, outPng));
        }
      }
      results.scenarios[name] = {
        count: samples.length,
        samples,
        final: await page.evaluate(() => window.__HAIZ_LAB__.getMetrics()),
      };
    };

    // 1. Multi-angle Hero solo captures
    await runScenario('walk_side', { scenario: 'walk_normal', cam: 'side', frames: 120, shotFrames: [45, 75, 105] });
    await runScenario('walk_low_foot', { scenario: 'walk_normal', cam: 'low_foot', frames: 110, shotFrames: [50, 85] });
    await runScenario('walk_back_bags', { scenario: 'walk_normal', cam: 'back', frames: 100, shotFrames: [65] });
    await runScenario('jog_side', { scenario: 'jog', cam: 'side', frames: 120, shotFrames: [65, 100] });
    await runScenario('turn_cascade', { scenario: 'turn_cascade', cam: 'three_quarter', frames: 240, shotFrames: [52, 130, 185] });
    await runScenario('diagonal_strafe', { scenario: 'diagonal_strafe', cam: 'three_quarter', frames: 130, shotFrames: [55, 110] });
    await runScenario('stairs_up_down', { terrain: 'stairs', scenario: 'stairs_demo', cam: 'side', frames: 210, shotFrames: [65, 120, 175] });
    await runScenario('slopes_10_15', { terrain: 'slopes', scenario: 'slopes_demo', cam: 'side', frames: 210, shotFrames: [65, 145, 195] });
    await runScenario('gouache_lens', { scenario: 'walk_normal', cam: 'three_quarter', lens: 1, frames: 80, shotFrames: [60] });

    // 2. 3-Way Synchronized Comparison (Claude vs R2 vs R3)
    await page.evaluate(async () => {
      const L = window.__HAIZ_LAB__;
      await L.setMode('compare');
      L.setTerrain('flat');
      L.setScenario('turn_cascade');
      L.setCamera('three_quarter');
      L.setLens(0);
    });
    for (let f = 0; f < 180; f++) {
      await page.evaluate(() => window.__HAIZ_LAB__.stepFixed(1 / 30));
      if (f === 50 || f === 120 || f === 165) {
        const outPng = path.join(shotsDir, `compare_3way_f${String(f).padStart(3, '0')}.png`);
        await page.screenshot({ path: outPng });
        results.shots.push(path.relative(REPO, outPng));
      }
    }
    results.compareSummary = await page.evaluate(() => window.__HAIZ_LAB__.getCompareMetrics());
    results.renderInfo = await page.evaluate(() => window.__HAIZ_LAB__.getRenderInfo());

    const outJson = path.join(REPO, `living-character/data/motion-raw-${argTag}.json`);
    await fs.writeFile(outJson, JSON.stringify(results, null, 2));
    console.log(`Captured ${results.shots.length} frames, errors=${consoleErrors.length + pageErrors.length + httpErrors.length} -> ${outJson}`);
    if (consoleErrors.length || pageErrors.length || httpErrors.length) {
      console.error({ consoleErrors, pageErrors, httpErrors });
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
