#!/usr/bin/env node
/**
 * HAIZ · World Reconstruction Round 2 — Real 30fps Desktop & Mobile MP4 Walkthrough Recorder.
 * Uses deterministic manual-step rendering on real Metal-accelerated Playwright Chromium + ffmpeg H.264.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/a11/manyiwant/haiz-repo/node_modules/playwright');

const REPO = '/Users/a11/manyiwant/haiz-world-reconstruction-r2';
const DEMOS_DIR = path.join(REPO, 'world-reconstruction-r2/assets/demos');
const FRAMES_ROOT = '/Users/a11/.gemini/antigravity/brain/0213b5cb-0365-4869-be17-edd2d36559fd/scratch/r2_demos';
fs.mkdirSync(DEMOS_DIR, { recursive: true });
fs.mkdirSync(FRAMES_ROOT, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.wasm': 'application/wasm',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon',
};

function startStaticServer(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const cleanPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const abs = path.join(rootDir, cleanPath === '/' ? 'world-reconstruction-r2.html' : cleanPath);
      if (!abs.startsWith(rootDir) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
        res.statusCode = 404; res.end('Not found'); return;
      }
      res.setHeader('Content-Type', MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream');
      fs.createReadStream(abs).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function recordSeq(browser, url, opts, frameDir, outMp4, durationSec = 10) {
  fs.rmSync(frameDir, { recursive: true, force: true });
  fs.mkdirSync(frameDir, { recursive: true });

  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.stage === 'ready' && window.__HAIZ_R2__, null, { timeout: 60000 });
  await page.evaluate(() => window.__HAIZ_R2__.streamPromise);

  await page.evaluate(() => {
    window.__HAIZ_R2__.setManualStep(true);
    window.__HAIZ_R2__.flyToVista('beimen');
  });

  const totalFrames = durationSec * 30;
  for (let f = 0; f < totalFrames; f++) {
    await page.evaluate((idx) => {
      const api = window.__HAIZ_R2__;
      if (idx === 45) api.flyToVista('library');
      else if (idx === 95) api.flyToVista('fengqitang');
      else if (idx === 135) api.flyToVista('yanlinting');
      else if (idx === 175) api.flyToVista('keji');
      else if (idx === 215) {
        api.setMode('bike');
        api.teleport(0, -78, Math.PI);
        api.player.keys.add('KeyW');
      } else if (idx === 255) {
        api.player.keys.delete('KeyW');
        api.setHour(18.2);
        api.setMode('glide');
      }
      api.step(1 / 30);
    }, f);
    await page.screenshot({ path: path.join(frameDir, `f_${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 88 });
  }
  await ctx.close();

  execFileSync('ffmpeg', [
    '-y', '-framerate', '30', '-i', path.join(frameDir, 'f_%04d.jpg'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-movflags', '+faststart',
    outMp4,
  ], { stdio: 'inherit' });
  console.log('Encoded MP4 ->', outMp4);
}

async function main() {
  const { server, port } = await startStaticServer(REPO);
  const url = `http://127.0.0.1:${port}/world-reconstruction-r2.html`;
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'],
  });

  await recordSeq(
    browser, url,
    { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
    path.join(FRAMES_ROOT, 'desktop'),
    path.join(DEMOS_DIR, 'desktop-r2-walkthrough.mp4'),
    10
  );
  await recordSeq(
    browser, url,
    { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 },
    path.join(FRAMES_ROOT, 'mobile'),
    path.join(DEMOS_DIR, 'mobile-r2-walkthrough.mp4'),
    10
  );

  await browser.close();
  server.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
