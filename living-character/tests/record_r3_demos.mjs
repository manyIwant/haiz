#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from '/Users/a11/manyiwant/haiz-repo/node_modules/playwright/index.mjs';

const execFileAsync = promisify(execFile);
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const TMP_FRAMES = '/tmp/haiz_r3_vid_frames';
const OUT_VIDS = path.join(REPO, 'living-character/videos');
const OUT_CHECKS = path.join(REPO, 'living-character/renders/video-check');

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
      const rel = cleanPath === '/' ? 'living-character-lab.html' : cleanPath.replace(/^\/+/, '');
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

async function encodeMp4(framesDir, outMp4, keyOut) {
  await execFileAsync('ffmpeg', [
    '-y', '-framerate', '30',
    '-i', path.join(framesDir, 'f_%04d.jpg'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
    '-movflags', '+faststart',
    outMp4,
  ]);
  // Extract 3 evenly spaced check frames into video-check
  await execFileAsync('ffmpeg', [
    '-y', '-i', outMp4,
    '-vf', 'select=not(mod(n\\,90))',
    '-fps_mode', 'vfr',
    '-frames:v', '3',
    '-q:v', '3',
    keyOut,
  ]);
}

async function run() {
  await fs.rm(TMP_FRAMES, { recursive: true, force: true });
  await fs.mkdir(OUT_VIDS, { recursive: true });
  await fs.mkdir(OUT_CHECKS, { recursive: true });

  const { server, port } = await startServer(REPO);
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'],
  });

  const onlyCampus = process.argv.includes('--only=campus');
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(String(e)));

    const captureFixedLabVideo = async (name, totalFrames, onFrame) => {
      const fdir = path.join(TMP_FRAMES, name);
      await fs.mkdir(fdir, { recursive: true });
      for (let i = 0; i < totalFrames; i++) {
        await onFrame(i);
        await page.evaluate(() => window.__HAIZ_LAB__.stepFixed(1 / 30));
        await page.screenshot({ path: path.join(fdir, `f_${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 90 });
      }
      const mp4 = path.join(OUT_VIDS, `${name}.mp4`);
      await encodeMp4(fdir, mp4, path.join(OUT_CHECKS, `${name}_%02d.jpg`));
      console.log(`Encoded ${mp4}`);
    };

    if (!onlyCampus) {
      // --- Video 1: 3-Way Comparison (Claude vs R2 vs R3) ~9s (270 frames) ---
      await page.goto(`http://127.0.0.1:${port}/living-character-lab.html`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__HAIZ_LAB__?.isReady(), { timeout: 30000 });
      await page.evaluate(() => window.__HAIZ_LAB__.setPlaying(false));

      await captureFixedLabVideo('compare-claude-r2-r3', 270, async (i) => {
        if (i === 0) {
          await page.evaluate(async () => {
            const L = window.__HAIZ_LAB__;
            await L.setMode('compare');
            L.setTerrain('flat');
            L.setScenario('turn_cascade');
            L.setCamera('three_quarter');
            L.setSpeedScale(1);
          });
        } else if (i === 145) {
          await page.evaluate(() => window.__HAIZ_LAB__.setCamera('side'));
        } else if (i === 210) {
          await page.evaluate(() => window.__HAIZ_LAB__.setCamera('three_quarter'));
        }
      });

      // --- Video 2: Multi-Angle + 0.25x Slow-Mo ~11s (330 frames) ---
      await captureFixedLabVideo('lab-multiangle-slowmo', 330, async (i) => {
        if (i === 0) {
          await page.evaluate(async () => {
            const L = window.__HAIZ_LAB__;
            await L.setMode('solo');
            L.setTerrain('flat');
            L.setScenario('walk_normal');
            L.setCamera('three_quarter');
            L.setSpeedScale(1);
          });
        } else if (i === 75) {
          await page.evaluate(() => {
            const L = window.__HAIZ_LAB__;
            L.setCamera('low_foot');
            L.setSpeedScale(0.25);
          });
        } else if (i === 165) {
          await page.evaluate(() => {
            const L = window.__HAIZ_LAB__;
            L.setCamera('side');
            L.setScenario('jog');
            L.setSpeedScale(1);
          });
        } else if (i === 245) {
          await page.evaluate(() => {
            const L = window.__HAIZ_LAB__;
            L.setCamera('back');
            L.setScenario('walk_normal');
          });
        }
      });

      // --- Video 3: Granite Stairs + 10/15 deg Slopes + Strafe ~11s (330 frames) ---
      await captureFixedLabVideo('lab-terrain-stairs-slopes', 330, async (i) => {
        if (i === 0) {
          await page.evaluate(async () => {
            const L = window.__HAIZ_LAB__;
            await L.setMode('solo');
            L.setTerrain('stairs');
            L.setScenario('stairs_demo');
            L.setCamera('side');
            L.setSpeedScale(1);
          });
        } else if (i === 160) {
          await page.evaluate(() => {
            const L = window.__HAIZ_LAB__;
            L.setTerrain('slopes');
            L.setScenario('slopes_demo');
            L.setCamera('three_quarter');
          });
        } else if (i === 260) {
          await page.evaluate(() => {
            const L = window.__HAIZ_LAB__;
            L.setTerrain('flat');
            L.setScenario('diagonal_strafe');
            L.setCamera('three_quarter');
          });
        }
      });
    }

    // --- Video 4: Campus R3 Live Roam (Deterministic 30fps manual-stepped: Stairs + Dual Lens + Bike IK) ---
    const cdir = path.join(TMP_FRAMES, 'campus-r3-roam');
    await fs.mkdir(cdir, { recursive: true });
    await page.goto(`http://127.0.0.1:${port}/living-campus-r3.html?quality=balanced&lens=0`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__HAIZ_R3__?.ready), { timeout: 45000 });
    await page.evaluate(() => window.__HAIZ_R3__.streamPromise);
    await page.evaluate(() => {
      const R = window.__HAIZ_R3__;
      R.setManualStep(true);
      R.teleport(-6.5, -35.0, 0.05); // Right before Forecourt red granite stairs facing Block 1!
      R.player.keys.add('KeyW');
      R.step(1 / 30);
    });

    for (let i = 0; i < 360; i++) {
      await page.evaluate((frame) => {
        const R = window.__HAIZ_R3__;
        if (frame === 130) R.setLens(1);
        else if (frame === 210) { R.setLens(0); R.setMode('bike'); }
        else if (frame === 295) R.setMode('walk');
        R.step(1 / 30);
      }, i);
      await page.screenshot({ path: path.join(cdir, `f_${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 88 });
    }

    const cMp4 = path.join(OUT_VIDS, 'campus-r3-roam.mp4');
    await encodeMp4(cdir, cMp4, path.join(OUT_CHECKS, 'campus-r3-roam_%02d.jpg'));
    console.log(`Encoded ${cMp4}, runtime errors=${errs.length}`);
    if (errs.length) {
      console.error(errs);
      process.exitCode = 1;
    }
  } finally {
    await fs.rm(TMP_FRAMES, { recursive: true, force: true });
    await browser.close();
    server.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
