// HAIZ · 自由移动 — Deterministic Real-GPU 30fps Desktop (1280x720) & Mobile (390x844) MP4 Demo Recorder
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/Users/a11/manyiwant/haiz-repo/node_modules/playwright');
}

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const OUT = path.join(ROOT, 'experiments/free-movement/shots');
fs.mkdirSync(OUT, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const cleanUrl = (req.url || '/').split('?')[0];
      const fp = path.join(ROOT, decodeURIComponent(cleanUrl === '/' ? '/free-movement.html' : cleanUrl));
      if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('404'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

function createEncoder(outFile, fps = 30) {
  const ff = spawn('ffmpeg', [
    '-y', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', outFile,
  ], { stdio: ['pipe', 'ignore', 'pipe'] });
  let errLog = '';
  ff.stderr.on('data', (d) => { errLog += d.toString(); });
  const done = new Promise((resolve, reject) => {
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${errLog.slice(-400)}`))));
  });
  return {
    async writeFrame(buf) {
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    },
    async finish() {
      ff.stdin.end();
      await done;
    },
  };
}

async function captureFrames(page, enc, count, onFrame) {
  for (let i = 0; i < count; i++) {
    if (onFrame) await onFrame(i);
    await page.evaluate(() => window.__haizMove.step(1 / 30, 30));
    const buf = await page.screenshot({ type: 'jpeg', quality: 86 });
    await enc.writeFrame(buf);
  }
}

const { server, url } = await startServer();
const browser = await playwright.chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'],
});

try {
  // ====================================================================== 1. DESKTOP DEMO (1280x720, 30fps, 28s)
  console.log('Recording desktop-flow.mp4 (1280x720 @ 30fps)...');
  const dCtx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await dCtx.newPage();
  await page.goto(`${url}/free-movement.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.body.dataset.stage === 'ready' && !!window.__haizMove, { timeout: 60000 });
  await page.waitForTimeout(550);
  await page.evaluate(() => {
    // Cleanly remove loading veil & let real-time welcome toast appear cleanly for the opening 2s
    document.querySelector('#fm-loading')?.remove();
    window.__haizMove.step(0.1, 30);
  });

  const dOut = path.join(OUT, 'desktop-flow.mp4');
  const dEnc = createEncoder(dOut, 30);

  // 0.0 - 1.5s (45f): Opening sunlit walk along central axis toward 一号教学楼 & 百年榄仁树
  await page.keyboard.down('KeyW');
  await captureFrames(page, dEnc, 45);
  await page.keyboard.up('KeyW');

  // 1.5 - 4.5s (90f): Summon & mount Campus Bicycle, pedal curving + ring brass bell!
  await page.evaluate(() => {
    const el = document.querySelector('#fm-line'); if (el) el.hidden = true;
    window.__haizMove.setMode('bike');
  });
  await captureFrames(page, dEnc, 38);
  await page.evaluate(() => window.__haizMove.input.setSynthetic({ ay: 0.9, ax: 0.22, bell: true }));
  await captureFrames(page, dEnc, 28);
  await page.evaluate(() => window.__haizMove.input.setSynthetic({ ay: 0.85, ax: -0.25 }));
  await captureFrames(page, dEnc, 24);

  // 4.5 - 7.0s (75f): Toggle First-Person Live-Body Handlebar Cockpit (V)!
  await page.evaluate(() => {
    const H = window.__haizMove;
    H.teleport(-35.2, -52, 0.04);
    H.setFirstPerson(true);
    H.input.setSynthetic({ ay: 0.78, ax: -0.06, bell: true });
  });
  await captureFrames(page, dEnc, 45);
  await page.evaluate(() => window.__haizMove.input.setSynthetic({ ay: 0.82, ax: 0.14 }));
  await captureFrames(page, dEnc, 30);

  // 7.0 - 9.0s (60f): Return to 3rd person & dusk/night headlamp bloom!
  await page.evaluate(() => {
    const H = window.__haizMove;
    H.setFirstPerson(false);
    H.setWeather('clear', 20.6);
    H.input.setSynthetic({ ay: 0.9, ax: 0.18 });
  });
  await captureFrames(page, dEnc, 60);

  // 9.0 - 15.0s (180f): Golden sunlit Skateboard -> discrete pushes -> S-Carve pumping -> Kickflip 360°!
  await page.evaluate(() => {
    const H = window.__haizMove;
    H.setWeather('clear', 16.4);
    H.input.setSynthetic(null);
    H.setMode('board');
    H.step(1.9, 30);
    H.teleport(-35.2, -55, 0.02);
    H.input.setSynthetic({ ay: 1, ax: 0 });
  });
  await captureFrames(page, dEnc, 52);
  await page.evaluate(() => window.__haizMove.input.setSynthetic({ ay: 0.2, ax: -0.88 }));
  await captureFrames(page, dEnc, 22);
  await page.evaluate(() => window.__haizMove.input.setSynthetic({ ay: 0.2, ax: 0.88 }));
  await captureFrames(page, dEnc, 22);
  await page.evaluate(() => window.__haizMove.input.setSynthetic({ ay: 0.2, ax: -0.85 }));
  await captureFrames(page, dEnc, 20);
  // Kickflip 360° mid-air & clean landing!
  await page.evaluate(() => window.__haizMove.input.setSynthetic({ ay: 0.4, ax: 0, trick: true }));
  await captureFrames(page, dEnc, 6);
  await page.evaluate(() => window.__haizMove.input.setSynthetic({ ay: 0.35, ax: 0.08 }));
  await captureFrames(page, dEnc, 58);

  // 15.0 - 17.0s (60f): Open Foldable Watercolor Campus Map (M) with route to 砚池!
  await page.evaluate(() => {
    const H = window.__haizMove;
    H.input.setSynthetic(null);
    H.hud.setDest('yanchi');
    H.hud.toggleMap(true);
  });
  await captureFrames(page, dEnc, 54);
  await page.evaluate(() => window.__haizMove.hud.toggleMap(false));
  await captureFrames(page, dEnc, 6);

  // 17.0 - 21.2s (126f): Bamboo Broom low-skim over 砚池 water -> water mist + ripples + climb!
  await page.evaluate(() => {
    const H = window.__haizMove;
    H.setMode('broom');
    H.step(1.6, 30);
    H.teleport(4, 120, 0.04);
    H.ride.state.pos.y = H.world.heightAt(4, 120) + 1.45;
    H.input.setSynthetic({ ay: 1, ax: -0.14, boost: true });
  });
  await captureFrames(page, dEnc, 66);
  // Climb banking toward the sunlit sky over campus
  await page.evaluate(() => window.__haizMove.input.setSynthetic({ ay: 1, ax: 0.42, up: true, boost: true }));
  await captureFrames(page, dEnc, 60);

  // 21.2 - 25.2s (120f): Seamless MID-AIR switch to Terminalia Monsoon Glider (榄仁纸鸢) soaring inside 操场暖流!
  await page.evaluate(() => {
    const H = window.__haizMove;
    H.teleport(-204, -64, 0.45);
    H.ride.state.pos.y = H.world.heightAt(-204, -64) + 18;
    H.setMode('glider');
    H.input.setSynthetic({ ay: 0, ax: 0.65 });
  });
  await captureFrames(page, dEnc, 120);

  // 25.2 - 28.2s (90f): Glider Under-Wing First-Person (V) -> Zen Clean Scroll (H)!
  await page.evaluate(() => {
    const H = window.__haizMove;
    H.teleport(-24, -46, 0.32);
    H.ride.state.pos.y = H.world.heightAt(-24, -46) + 21;
    H.setFirstPerson(true);
    H.input.setSynthetic({ ay: 0, ax: -0.22 });
  });
  await captureFrames(page, dEnc, 52);
  await page.evaluate(() => {
    const H = window.__haizMove;
    H.setFirstPerson(false);
    H.hud.toggleZen(true);
    H.input.setSynthetic({ ay: 0, ax: 0.25 });
  });
  await captureFrames(page, dEnc, 38);

  await dEnc.finish();
  await dCtx.close();
  console.log(`Saved ${dOut} (${(fs.statSync(dOut).size / 1e6).toFixed(2)} MB)`);

  // ====================================================================== 2. MOBILE DEMO (390x844 portrait, 30fps, 16s)
  console.log('Recording phone-flow.mp4 (390x844 @ 30fps)...');
  const mCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  const mpage = await mCtx.newPage();
  await mpage.goto(`${url}/free-movement.html?touch=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await mpage.waitForFunction(() => document.body.dataset.stage === 'ready' && !!window.__haizMove, { timeout: 60000 });
  await mpage.waitForTimeout(550);
  await mpage.evaluate(() => {
    document.querySelector('#fm-loading')?.remove();
    const el = document.querySelector('#fm-line'); if (el) el.hidden = true;
    window.__haizMove.step(0.1, 30);
  });

  const mOut = path.join(OUT, 'phone-flow.mp4');
  const mEnc = createEncoder(mOut, 30);

  // 0.0 - 4.0s (120f): Bicycle portrait ride curving down sunlit avenue
  await mpage.evaluate(() => window.__haizMove.setMode('bike'));
  await captureFrames(mpage, mEnc, 36);
  await mpage.evaluate(() => window.__haizMove.input.setSynthetic({ ay: 0.9, ax: 0.25, bell: true }));
  await captureFrames(mpage, mEnc, 44);
  await mpage.evaluate(() => window.__haizMove.input.setSynthetic({ ay: 0.85, ax: -0.22 }));
  await captureFrames(mpage, mEnc, 40);

  // 4.0 - 7.5s (105f): Skateboard portrait push + carve + Kickflip!
  await mpage.evaluate(() => {
    const H = window.__haizMove;
    H.input.setSynthetic(null);
    H.setMode('board');
    H.step(1.9, 30);
    H.teleport(-35.2, -52, 0.03);
    H.input.setSynthetic({ ay: 1, ax: 0 });
  });
  await captureFrames(mpage, mEnc, 45);
  await mpage.evaluate(() => window.__haizMove.input.setSynthetic({ ay: 0.3, ax: -0.8 }));
  await captureFrames(mpage, mEnc, 20);
  await mpage.evaluate(() => window.__haizMove.input.setSynthetic({ ay: 0.4, ax: 0, trick: true }));
  await captureFrames(mpage, mEnc, 6);
  await mpage.evaluate(() => window.__haizMove.input.setSynthetic({ ay: 0.3, ax: 0.25 }));
  await captureFrames(mpage, mEnc, 34);

  // 7.5 - 11.5s (120f): Bamboo Broom portrait climb over forecourt & 百年榄仁树 with right-thumb action arc!
  await mpage.evaluate(() => {
    const H = window.__haizMove;
    H.input.setSynthetic(null);
    H.setMode('broom');
    H.step(1.5, 30);
    H.input.setSynthetic({ ay: 1, ax: 0.22, up: true, boost: true });
  });
  await captureFrames(mpage, mEnc, 65);
  await mpage.evaluate(() => window.__haizMove.input.setSynthetic({ ay: 1, ax: -0.35, boost: true }));
  await captureFrames(mpage, mEnc, 55);

  // 11.5 - 14.3s (84f): Seamless mid-air swap to Terminalia Monsoon Glider in portrait!
  await mpage.evaluate(() => {
    const H = window.__haizMove;
    H.setMode('glider');
    H.input.setSynthetic({ ay: 0, ax: 0.48 });
  });
  await captureFrames(mpage, mEnc, 84);

  // 14.3 - 16.3s (60f): Mobile Foldable Watercolor Campus Map!
  await mpage.evaluate(() => {
    const H = window.__haizMove;
    H.input.setSynthetic(null);
    H.hud.setDest('tree');
    H.hud.toggleMap(true);
  });
  await captureFrames(mpage, mEnc, 60);

  await mEnc.finish();
  await mCtx.close();
  console.log(`Saved ${mOut} (${(fs.statSync(mOut).size / 1e6).toFixed(2)} MB)`);
} finally {
  await browser.close();
  server.close();
}
