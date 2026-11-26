/**
 * HAIZ · World Reconstruction — Deterministic 30fps Desktop & Mobile MP4 Screen Recorder
 *
 * Captures real Metal-GPU Chromium renders using `window.__haizWorld.setManualStep(true)`
 * and pipes JPEG frames directly to ffmpeg (H.264, yuv420p, +faststart, 30fps):
 *   1. world-reconstruction/assets/demos/desktop-walkthrough.mp4 (1280×720, 26s)
 *   2. world-reconstruction/assets/demos/mobile-walkthrough.mp4  (390×844, 16s, touch)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.resolve(__dirname, '../assets/demos');
fs.mkdirSync(OUT_DIR, { recursive: true });

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/a11/manyiwant/haiz-repo/node_modules/playwright');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
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
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(full).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function startFfmpeg(outPath, fps = 30) {
  const proc = spawn('ffmpeg', [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-r', String(fps),
    '-i', '-',
    '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '22',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outPath,
  ], { stdio: ['pipe', 'ignore', 'pipe'] });

  let stderr = '';
  proc.stderr.on('data', (d) => { stderr += d.toString(); });
  const done = new Promise((resolve, reject) => {
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`));
    });
  });

  async function writeFrame(buf) {
    if (!proc.stdin.write(buf)) {
      await new Promise((r) => proc.stdin.once('drain', r));
    }
  }
  async function finish() {
    proc.stdin.end();
    await done;
  }
  return { writeFrame, finish };
}

async function captureFrames(page, ff, count, onFrame) {
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 1;
    await page.evaluate(({ i, t }) => {
      window.__recFrame(i, t);
    }, { i, t });
    const buf = await page.screenshot({ type: 'jpeg', quality: 86 });
    await ff.writeFrame(buf);
  }
}

async function recordDesktop(browser, baseUrl) {
  const outPath = path.join(OUT_DIR, 'desktop-walkthrough.mp4');
  console.log('Recording Desktop 1280x720 30fps ->', outPath);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.stage === 'ready' && !!window.__haizWorld, { timeout: 30000 });
  await page.evaluate(() => window.__haizWorld.streamPromise);
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    const w = window.__haizWorld;
    w.setManualStep(true);
    w.setHour(16.65);
    w.setWeather('clear');
    w.setLens(0);
    // Helper for smooth camera rail shots
    window.__setCam = (px, py, pz, tx, ty, tz, label) => {
      w.player._vistaAnim = null;
      w.player.camera.position.set(px, py, pz);
      w.player.camera.lookAt(tx, ty, tz);
      if (label) w.hud.updateLocationWhisper(w.player.pos, w.player.mode, null, label);
    };
  });

  const ff = startFfmpeg(outPath, 30);

  // Segment 1 (0 - 3.5s, 105 frames): Iconic North Gate Paifang slow push-in toward Royal Palm Avenue
  await page.evaluate(() => {
    window.__recFrame = (i, t) => {
      const w = window.__haizWorld;
      w.step(1 / 30);
      const z = -124.5 + t * 20.5;
      const y = 2.6 - t * 0.4;
      window.__setCam(Math.sin(t * Math.PI) * 1.4, y, z, 0, 5.2, -30, '北门入画 · 海南中學牌坊');
      w.scene && w.camera && w.step(0.0001);
    };
  });
  // Actually setCam BEFORE rendering inside step! Let's use a clean pre-camera hook:
  await page.evaluate(() => {
    const w = window.__haizWorld;
    const origUpdate = w.player.update.bind(w.player);
    window.__camOverride = null;
    w.player.update = (dt, rt) => {
      origUpdate(dt, rt);
      if (window.__camOverride) {
        const c = window.__camOverride;
        w.camera.position.set(c.px, c.py, c.pz);
        w.camera.lookAt(c.tx, c.ty, c.tz);
      }
    };
    window.__recFrame = (i, t) => {
      const z = -125.5 + t * 22.0;
      window.__camOverride = { px: Math.sin(t * Math.PI) * 1.6, py: 2.8 - t * 0.5, pz: z, tx: 0, ty: 5.5, tz: -28 };
      w.hud.updateLocationWhisper(w.player.pos, 'walk', null, '北门入画 · 海南中學牌坊');
      w.step(1 / 30);
    };
  });
  await captureFrames(page, ff, 105);

  // Segment 2 (3.5 - 7.5s, 120 frames): Third-person Walk on Forecourt + Teaching Block 1 '1923' Provenance Card
  await page.evaluate(() => {
    const w = window.__haizWorld;
    window.__camOverride = null;
    w.setMode('walk');
    w.teleport(-4.2, -52.0, 0.08);
    w.player.camYaw = 0.08;
    w.player.camPitch = 0.16;
    w.player.camDist = 6.6;
    for (let k = 0; k < 25; k++) w.step(0.03);
    window.__recFrame = (i, t) => {
      w.player.keys.add('KeyW');
      w.player.camYaw = 0.08 - t * 0.28;
      if (i === 42) w.selectBuilding('yihao');
      if (i === 108) w.hud.showProvenance(null);
      w.step(1 / 30);
    };
  });
  await captureFrames(page, ff, 120);

  // Segment 3 (7.5 - 10.5s, 90 frames): Centenary Terminalia S-Limb & Boulder + Autumn Leaves + Cat
  await page.evaluate(() => {
    const w = window.__haizWorld;
    w.player.keys.clear();
    w.hud.showProvenance(null);
    window.__recFrame = (i, t) => {
      const a = t * 0.42;
      window.__camOverride = {
        px: 56.0 - Math.sin(a) * 6.5,
        py: 2.4 + t * 0.8,
        pz: -31.5 + Math.cos(a) * 2.5,
        tx: 38.9,
        ty: 4.3,
        tz: -14.5,
      };
      w.hud.updateLocationWhisper(w.player.pos, 'walk', null, '百年榄仁 · 卧枝巨石');
      w.step(1 / 30);
    };
  });
  await captureFrames(page, ff, 90);

  // Segment 4 (10.5 - 14.0s, 105 frames): Campus Bike riding briskly down Royal Palm Avenue
  await page.evaluate(() => {
    const w = window.__haizWorld;
    window.__camOverride = null;
    w.setMode('bike');
    w.teleport(0.0, -96.0, 0.0);
    w.player.camYaw = 0.12;
    w.player.camPitch = 0.17;
    w.player.camDist = 6.4;
    w.player.speed = 6.8;
    for (let k = 0; k < 25; k++) w.step(0.03);
    window.__recFrame = (i, t) => {
      w.player.keys.add('KeyW');
      w.player.camYaw = 0.12 - t * 0.24;
      if (i === 52) w.player.ringBell();
      w.step(1 / 30);
    };
  });
  await captureFrames(page, ff, 105);

  // Segment 5 (14.0 - 18.0s, 120 frames): Yanchi Ink-Pond & Art Center -> Library Observatory Dome
  await page.evaluate(() => {
    const w = window.__haizWorld;
    w.player.keys.clear();
    w.setMode('walk');
    window.__recFrame = (i, t) => {
      if (i < 60) {
        const u = i / 59;
        window.__camOverride = {
          px: 61.5 - u * 4.5,
          py: 3.6 + u * 0.6,
          pz: 103.5 + u * 3.0,
          tx: 36.0,
          ty: 3.4,
          tz: 127.0,
        };
        w.hud.updateLocationWhisper(w.player.pos, 'walk', null, '砚池叠水 · 艺术教育中心');
      } else {
        const u = (i - 60) / 59;
        window.__camOverride = {
          px: 66.0 + u * 4.0,
          py: 5.5 + u * 5.5,
          pz: -35.0 + u * 12.0,
          tx: 98.0,
          ty: 10.0,
          tz: -4.0,
        };
        w.hud.updateLocationWhisper(w.player.pos, 'walk', null, '图书馆与天文台穹顶');
      }
      w.step(1 / 30);
    };
  });
  await captureFrames(page, ff, 120);

  // Segment 6 (18.0 - 21.0s, 90 frames): Thermal Wind Glider soaring over full campus
  await page.evaluate(() => {
    const w = window.__haizWorld;
    window.__camOverride = null;
    w.setMode('glide');
    w.player.pos.set(22.0, 44.0, -90.0);
    w.player.yaw = -0.18;
    w.player.camYaw = -0.18;
    w.player.camPitch = 0.28;
    w.player.camDist = 11.5;
    // Settle camera right behind glider looking down over the whole campus!
    for (let k = 0; k < 40; k++) w.step(0.025);
    w.player.pos.set(22.0, 44.0, -90.0);
    window.__recFrame = (i, t) => {
      w.player.camPitch = 0.28 + t * 0.08;
      w.step(1 / 30);
    };
  });
  await captureFrames(page, ff, 90);

  // Segment 7 (21.0 - 24.0s, 90 frames): Unified 3-Lens World (PBR -> Gouache -> Plan Cutaway -> PBR)
  await page.evaluate(() => {
    const w = window.__haizWorld;
    w.setMode('walk');
    w.teleport(-4.5, -45.5, 0.12);
    window.__recFrame = (i, t) => {
      if (i === 0) {
        w.setLens(1);
        window.__camOverride = { px: -8.5, py: 4.2, pz: -52.0, tx: 6.0, ty: 7.5, tz: -8.0 };
        w.hud.updateLocationWhisper(w.player.pos, 'walk', null, '画境切换 · 入画水粉');
      } else if (i < 45) {
        const u = i / 44;
        window.__camOverride = { px: -8.5 + u * 3.5, py: 4.2 + u * 0.4, pz: -52.0 + u * 3.0, tx: 6.0, ty: 7.5, tz: -8.0 };
      } else if (i === 45) {
        window.__camOverride = null;
        w.setLens(2);
        for (let k = 0; k < 35; k++) w.step(0.05);
        w.hud.updateLocationWhisper(w.player.pos, 'walk', null, '画境切换 · 1.2m 建筑平面剖切');
      }
      w.step(1 / 30);
    };
  });
  await captureFrames(page, ff, 90);

  // Segment 8 (24.0 - 27.0s, 90 frames): Tropical Rain -> Starry 20:30 Evening Study
  await page.evaluate(() => {
    const w = window.__haizWorld;
    w.setLens(0);
    w.setWeather('rain');
    w.setHour(16.4);
    window.__camOverride = { px: -7.5, py: 3.4, pz: -49.5, tx: 4.0, ty: 6.8, tz: -8.0 };
    w.hud.updateLocationWhisper(w.player.pos, 'walk', null, '热带骤雨 · 湿润反光与避雨生态');
    window.__recFrame = (i, t) => {
      if (i === 45) {
        w.setWeather('clear');
        w.setHour(20.5);
        w.hud.updateLocationWhisper(w.player.pos, 'walk', null, '20:30 晚自习 · 教学楼灯火与海口星空');
      }
      const u = (i % 45) / 44;
      window.__camOverride = { px: -7.5 + u * 2.8, py: 3.4 + u * 0.5, pz: -49.5 + u * 2.0, tx: 4.0, ty: 6.8, tz: -8.0 };
      w.step(1 / 30);
    };
  });
  await captureFrames(page, ff, 90);

  await ff.finish();
  await ctx.close();
  const mb = (fs.statSync(outPath).size / 1e6).toFixed(2);
  console.log(`Desktop walkthrough done: ${mb} MB (780 frames / 26.0s @ 30fps)`);
}

async function recordMobile(browser, baseUrl) {
  const outPath = path.join(OUT_DIR, 'mobile-walkthrough.mp4');
  console.log('Recording Mobile 390x844 30fps ->', outPath);
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.stage === 'ready' && !!window.__haizWorld, { timeout: 30000 });
  await page.evaluate(() => window.__haizWorld.streamPromise);
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    const w = window.__haizWorld;
    w.setManualStep(true);
    w.setHour(16.65);
    w.setWeather('clear');
    w.setLens(0);
    const origUpdate = w.player.update.bind(w.player);
    window.__camOverride = null;
    w.player.update = (dt, rt) => {
      origUpdate(dt, rt);
      if (window.__camOverride) {
        const c = window.__camOverride;
        w.camera.position.set(c.px, c.py, c.pz);
        w.camera.lookAt(c.tx, c.ty, c.tz);
      }
    };
  });

  const ff = startFfmpeg(outPath, 30);

  // Mobile Seg 1 (0 - 4s, 120 frames): Portrait walk toward Taihu Stone & Teaching Block 1 with touch joystick animated
  await page.evaluate(() => {
    const w = window.__haizWorld;
    w.teleport(-3.2, -52.0, 0.08);
    w.player.camYaw = 0.08;
    w.player.camPitch = 0.16;
    w.player.camDist = 6.2;
    for (let k = 0; k < 20; k++) w.step(0.03);
    const knob = document.getElementById('wr-joy-knob');
    window.__recFrame = (i, t) => {
      w.player.joy.y = 0.85;
      w.player.joy.x = Math.sin(t * Math.PI) * 0.12;
      if (knob) knob.style.transform = `translate(${(w.player.joy.x * 26).toFixed(1)}px, ${(-w.player.joy.y * 26).toFixed(1)}px)`;
      w.step(1 / 30);
    };
  });
  await captureFrames(page, ff, 120);

  // Mobile Seg 2 (4 - 7.5s, 105 frames): North Gate & Yanchi Ink-Pond portrait vistas
  await page.evaluate(() => {
    const w = window.__haizWorld;
    w.player.joy.x = 0; w.player.joy.y = 0;
    const knob = document.getElementById('wr-joy-knob');
    if (knob) knob.style.transform = '';
    window.__recFrame = (i, t) => {
      if (i < 52) {
        const u = i / 51;
        window.__camOverride = { px: 0, py: 2.5, pz: -125.0 + u * 16.0, tx: 0, ty: 5.0, tz: -40 };
      } else {
        const u = (i - 52) / 52;
        window.__camOverride = { px: 60.0 - u * 4.0, py: 3.4, pz: 104.0 + u * 2.5, tx: 36.0, ty: 3.2, tz: 127.0 };
      }
      w.step(1 / 30);
    };
  });
  await captureFrames(page, ff, 105);

  // Mobile Seg 3 (7.5 - 10.5s, 90 frames): Campus Bike ride + quick interactive Vector Map peek
  await page.evaluate(() => {
    const w = window.__haizWorld;
    window.__camOverride = null;
    w.setMode('bike');
    w.teleport(0.0, -90.0, 0.0);
    w.player.camYaw = 0.06;
    w.player.camPitch = 0.16;
    w.player.camDist = 6.4;
    w.player.speed = 6.2;
    for (let k = 0; k < 20; k++) w.step(0.03);
    window.__recFrame = (i, t) => {
      w.player.joy.y = 0.9;
      if (i === 52) w.openMap(true);
      if (i === 86) w.openMap(false);
      w.step(1 / 30);
    };
  });
  await captureFrames(page, ff, 90);

  // Mobile Seg 4 (10.5 - 16.0s, 165 frames): Painted Gouache Lens -> Tropical Rain -> 20:30 Evening Study
  await page.evaluate(() => {
    const w = window.__haizWorld;
    w.player.joy.y = 0;
    w.openMap(false);
    w.setMode('walk');
    window.__recFrame = (i, t) => {
      if (i === 0) {
        w.setLens(1);
      } else if (i === 55) {
        w.setLens(0);
        w.setWeather('rain');
      } else if (i === 110) {
        w.setWeather('clear');
        w.setHour(20.5);
      }
      const u = (i % 55) / 54;
      window.__camOverride = { px: -6.5 + u * 4.5, py: 3.4, pz: -50.0 + u * 3.0, tx: 4.5, ty: 6.5, tz: -8.0 };
      w.step(1 / 30);
    };
  });
  await captureFrames(page, ff, 165);

  await ff.finish();
  await ctx.close();
  const mb = (fs.statSync(outPath).size / 1e6).toFixed(2);
  console.log(`Mobile walkthrough done: ${mb} MB (480 frames / 16.0s @ 30fps)`);
}

async function main() {
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}/world-reconstruction.html`;
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'],
  });
  try {
    await recordDesktop(browser, baseUrl);
    await recordMobile(browser, baseUrl);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
