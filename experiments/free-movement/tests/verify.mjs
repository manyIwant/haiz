// HAIZ · 自由移动 — End-to-End Real-Browser Functional & Visual Verification Suite
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
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
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream',
  '.woff2': 'font/woff2',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const cleanUrl = (req.url || '/').split('?')[0];
      const fp = path.join(ROOT, decodeURIComponent(cleanUrl === '/' ? '/free-movement.html' : cleanUrl));
      if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
        res.writeHead(404); res.end('Not found: ' + cleanUrl); return;
      }
      const ext = path.extname(fp).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

const checks = [];
const assert = (name, ok, detail = '') => {
  checks.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' — ' + detail : ''}`);
};

const { server, url } = await startServer();
const browser = await playwright.chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'],
});

try {
  // ====================================================================== DESKTOP (1280x720)
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [], failed404 = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('open-meteo')) failed404.push(`${r.status()} ${r.url()}`); });

  await page.goto(`${url}/free-movement.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.body.dataset.stage === 'ready' && !!window.__haizMove, { timeout: 60000 });
  // Let loading veil transition fully complete before capturing frame 01
  await page.waitForTimeout(950);
  await page.evaluate(() => window.__haizMove.step(0.5, 30));

  const bootInfo = await page.evaluate(() => {
    const H = window.__haizMove;
    const altVis = getComputedStyle(document.querySelector('#fm-alt')).display;
    return { ...H.info(), altHiddenOnGround: altVis === 'none' };
  });
  console.log('BOOT INFO:', JSON.stringify(bootInfo));
  assert('Desktop boots cleanly without errors', errors.length === 0, errors.join('; '));
  assert('Zero 404 runtime assets', failed404.length === 0, failed404.join('; '));
  assert('Gouache painted-lab materials active', bootInfo.gouache === 'lab', bootInfo.gouache);
  assert('cannon-es physics world initialized', bootInfo.physics.bodies > 15 && bootInfo.physics.props >= 8, JSON.stringify(bootInfo.physics));
  assert('Wake patches grass, lawn, crowns & water', bootInfo.wake.grass > 0 && bootInfo.wake.lawn > 0 && bootInfo.wake.crowns > 0 && bootInfo.wake.water > 0, JSON.stringify(bootInfo.wake));
  assert('Altitude hairline hidden on ground', bootInfo.altHiddenOnGround === true);

  await page.screenshot({ path: path.join(OUT, '01-walk-forecourt.jpg'), type: 'jpeg', quality: 88 });

  // 2. Bicycle: ride, turn, verify IK accuracy, 1st-person handlebar cockpit, and night headlamp!
  await page.evaluate(() => {
    const H = window.__haizMove;
    H.setMode('bike');
    H.step(1.3, 30);
    H.input.setSynthetic({ ay: 1, ax: 0.25, boost: true, bell: true });
    H.step(2.4, 30);
  });
  const bikeCheck = await page.evaluate(() => {
    const H = window.__haizMove;
    const R = H.ride.state, bk = H.ride.machines.bike;
    const footL = H.rig.where('foot.L'), pedL = bk.pedals.L.getWorldPosition(footL.clone());
    const handL = H.rig.where('hand.L');
    const gripL = bk.grip('L', R.steer).applyMatrix4(bk.body.matrixWorld);
    return {
      mode: R.mode, phase: R.phase, speed: +R.speed.toFixed(2), roll: +R.roll.toFixed(3),
      surface: R.surface,
      ankleErr: +footL.distanceTo(pedL).toFixed(3),
      handErr: +handL.distanceTo(gripL).toFixed(3),
    };
  });
  assert('Bicycle reaches cruising/sprint speed & leans into turn', bikeCheck.mode === 'bike' && bikeCheck.speed > 5.0 && Math.abs(bikeCheck.roll) > 0.04, JSON.stringify(bikeCheck));
  assert('Bicycle IK feet & hands locked to pedals & grips (<0.14m)', bikeCheck.ankleErr < 0.14 && bikeCheck.handErr < 0.14, JSON.stringify(bikeCheck));
  await page.screenshot({ path: path.join(OUT, '02-bike-ride.jpg'), type: 'jpeg', quality: 88 });

  // Bicycle First-Person Live-Body Cockpit (handlebars, hands, brass bell, basket sketchbook!)
  await page.evaluate(() => {
    const H = window.__haizMove;
    H.teleport(-35.2, -52.0, 0.04);
    H.setFirstPerson(true);
    H.input.setSynthetic({ ay: 0.78, ax: -0.12, boost: false, bell: true });
    H.step(1.8, 30);
  });
  await page.waitForTimeout(180);
  await page.screenshot({ path: path.join(OUT, '03-bike-cockpit-fp.jpg'), type: 'jpeg', quality: 88 });

  // Bicycle Dusk/Night Headlamp
  await page.evaluate(() => {
    const H = window.__haizMove;
    H.setFirstPerson(false);
    H.setWeather('clear', 20.6);
    H.input.setSynthetic({ ay: 0.85, ax: 0.16 });
    H.step(1.2, 30);
  });
  const lampVal = await page.evaluate(() => +window.__haizMove.ride.machines.bike.lamp.toFixed(2));
  assert('Bicycle night headlamp illuminates automatically', lampVal > 0.5, `lamp=${lampVal}`);
  await page.screenshot({ path: path.join(OUT, '04-bike-night-lamp.jpg'), type: 'jpeg', quality: 88 });

  // Restore sunlit golden afternoon & verify clean bike->board swap (no leftover parked bike!)
  await page.evaluate(() => {
    const H = window.__haizMove;
    H.setWeather('clear', 16.4);
    H.input.setSynthetic(null);
    H.setMode('board');
    H.step(2.4, 30);
    // Place squarely on wide sunlit central paved avenue
    H.teleport(-35.2, -52.0, 0.02);
    H.step(0.2, 30);
    H.input.setSynthetic({ ay: 1, ax: 0 });
    H.step(2.2, 30);
    H.input.setSynthetic({ ay: 0.2, ax: -0.88 });
    H.step(0.55, 30);
    H.input.setSynthetic({ ay: 0.2, ax: 0.88 });
    H.step(0.55, 30);
    H.input.setSynthetic({ ay: 0.2, ax: -0.85 });
    H.step(0.45, 30);
  });
  const boardRun = await page.evaluate(() => ({
    mode: window.__haizMove.ride.mode,
    surface: window.__haizMove.ride.state.surface,
    speed: +window.__haizMove.ride.state.speed.toFixed(2),
    pushes: window.__haizMove.ride.state.pushes,
    carveFlow: window.__haizMove.ride.state.carveFlow,
    bikeStillParked: !!window.__haizMove.ride.state.parked,
  }));
  assert('Skateboard pushes and S-carves cleanly on paving', boardRun.mode === 'board' && boardRun.speed > 3.5 && boardRun.pushes >= 1 && boardRun.carveFlow >= 1 && !boardRun.bikeStillParked, JSON.stringify(boardRun));
  await page.screenshot({ path: path.join(OUT, '05-board-carve.jpg'), type: 'jpeg', quality: 88 });

  // Skateboard Kickflip mid-air shot!
  await page.evaluate(() => {
    const H = window.__haizMove;
    H.input.setSynthetic({ ay: 0.5, ax: 0, trick: true });
    H.step(0.32, 30);
  });
  const boardAir = await page.evaluate(() => ({ air: window.__haizMove.ride.state.air, trick: window.__haizMove.ride.state.trickLabel }));
  assert('Skateboard Kickflip pops cleanly into mid-air', boardAir.air === true, JSON.stringify(boardAir));
  await page.screenshot({ path: path.join(OUT, '06-board-kickflip.jpg'), type: 'jpeg', quality: 88 });
  await page.evaluate(() => { window.__haizMove.input.setSynthetic({ ay: 0.3, ax: 0 }); window.__haizMove.step(0.8, 30); });

  // 4. Bamboo Broom: low-skim over 砚池 water (vortex wake + fine water mist + lantern!)
  await page.evaluate(() => {
    const H = window.__haizMove;
    H.input.setSynthetic(null);
    H.setMode('broom');
    H.step(2.2, 30);
    H.teleport(4, 122, 0.05);
    H.ride.state.pos.y = H.world.heightAt(4, 122) + 1.5;
    H.input.setSynthetic({ ay: 1, ax: -0.15, boost: true });
    H.step(1.8, 30);
  });
  const broomSkim = await page.evaluate(() => {
    const H = window.__haizMove;
    const R = H.ride.state;
    return {
      mode: R.mode, speed: +R.speed.toFixed(2), agl: +R.agl.toFixed(2),
      overWater: R.overWater, wakeCount: H.wake.stats().count,
      leaves: H.fx.stats().leaves, spray: H.fx.stats().spray,
    };
  });
  assert('Bamboo broom skims 砚池 with active vortex wake', broomSkim.mode === 'broom' && broomSkim.speed > 7 && broomSkim.wakeCount > 5 && broomSkim.overWater, JSON.stringify(broomSkim));
  await page.waitForTimeout(260);
  await page.screenshot({ path: path.join(OUT, '07-broom-yanchi-skim.jpg'), type: 'jpeg', quality: 88 });

  // Bamboo Broom high campus flight banking past 百年榄仁树
  await page.evaluate(() => {
    const H = window.__haizMove;
    H.teleport(-18, -32, 0.55);
    H.ride.state.pos.y = H.world.heightAt(-18, -32) + 14;
    H.input.setSynthetic({ ay: 1, ax: 0.45, boost: true });
    H.step(1.4, 30);
  });
  await page.screenshot({ path: path.join(OUT, '08-broom-flight-bank.jpg'), type: 'jpeg', quality: 88 });

  // 5. Seamless MID-AIR switch Broom -> Terminalia Monsoon Glider + thermal soaring inside 操场暖流!
  await page.evaluate(() => {
    const H = window.__haizMove;
    H.teleport(-205, -62, 0.5);
    H.ride.state.pos.y = H.world.heightAt(-205, -62) + 18;
    H.setMode('glider');
    H.step(0.6, 30);
  });
  const midAirSwitch = await page.evaluate(() => ({
    mode: window.__haizMove.ride.mode, phase: window.__haizMove.ride.phase,
    yStart: +window.__haizMove.ride.state.pos.y.toFixed(2),
    aglStart: +window.__haizMove.ride.state.agl.toFixed(2),
  }));
  const gliderCheck = await page.evaluate(() => {
    const H = window.__haizMove;
    // Spiral smoothly inside the 操场暖流 thermal (centered at -201, -58, radius 28m!)
    H.input.setSynthetic({ ay: 0, ax: 0.72 });
    let maxThermalLift = 0, peakThermal = '';
    for (let i = 0; i < 6; i++) {
      H.step(0.35, 30);
      if (H.ride.state.thermalLift > maxThermalLift) {
        maxThermalLift = H.ride.state.thermalLift;
        peakThermal = H.ride.state.thermalName;
      }
    }
    const R = H.ride.state;
    return {
      mode: R.mode, speed: +R.speed.toFixed(2),
      yEnd: +R.pos.y.toFixed(2), agl: +R.agl.toFixed(2),
      maxThermalLift: +maxThermalLift.toFixed(2), thermalName: peakThermal || R.thermalName,
    };
  });
  assert('Seamless mid-air broom->glider transition keeps altitude', midAirSwitch.mode === 'glider' && midAirSwitch.aglStart > 15, JSON.stringify(midAirSwitch));
  assert('Terminalia Glider soars & climbs in campus thermal updraft', gliderCheck.mode === 'glider' && gliderCheck.maxThermalLift > 1.2 && gliderCheck.yEnd > midAirSwitch.yStart + 1.5, JSON.stringify({ midAirSwitch, gliderCheck }));
  await page.waitForTimeout(160);
  await page.screenshot({ path: path.join(OUT, '09-glider-thermal-soar.jpg'), type: 'jpeg', quality: 88 });

  // Glider Under-Wing First-Person Backlit Cockpit!
  await page.evaluate(() => {
    const H = window.__haizMove;
    H.teleport(-24, -42, 0.35);
    H.ride.state.pos.y = H.world.heightAt(-24, -42) + 21;
    H.setFirstPerson(true);
    H.input.setSynthetic({ ay: 0, ax: -0.22 });
    H.step(1.0, 30);
  });
  await page.screenshot({ path: path.join(OUT, '10-glider-underwing-fp.jpg'), type: 'jpeg', quality: 88 });

  // 6. Foldable Watercolor Campus Map + Route Painting + Zen Mode
  await page.evaluate(() => {
    const H = window.__haizMove;
    H.setFirstPerson(false);
    H.input.setSynthetic(null);
    H.hud.setDest('yanchi');
    H.hud.toggleMap(true);
    H.step(0.4, 30);
  });
  const mapOpen = await page.evaluate(() => window.__haizMove.hud.mapOpen);
  assert('Foldable watercolor campus map opens with route', mapOpen === true);
  await page.screenshot({ path: path.join(OUT, '11-watercolor-map.jpg'), type: 'jpeg', quality: 88 });

  // Zen mode clean shot (verify 100% of HUD chrome is visually hidden!)
  await page.evaluate(() => {
    const H = window.__haizMove;
    H.hud.toggleMap(false);
    H.hud.toggleZen(true);
    H.step(0.3, 30);
  });
  const zenClean = await page.evaluate(() => (
    getComputedStyle(document.querySelector('#fm-horizon')).visibility === 'hidden'
    && getComputedStyle(document.querySelector('#fm-whisper')).visibility === 'hidden'
    && getComputedStyle(document.querySelector('#fm-modes')).visibility === 'hidden'
  ));
  assert('Zen mode cleanly hides 100% of HUD chrome', zenClean === true);
  await page.screenshot({ path: path.join(OUT, '12-zen-clean.jpg'), type: 'jpeg', quality: 88 });
  await ctx.close();

  // ====================================================================== MOBILE PORTRAIT (390x844)
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const mpage = await mctx.newPage();
  const mErrors = [];
  mpage.on('pageerror', (e) => mErrors.push(e.message));
  await mpage.goto(`${url}/free-movement.html?touch=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await mpage.waitForFunction(() => document.body.dataset.stage === 'ready' && !!window.__haizMove, { timeout: 60000 });
  await mpage.waitForTimeout(900);
  await mpage.evaluate(() => {
    const H = window.__haizMove;
    H.setMode('broom');
    H.step(1.6, 30);
    H.input.setSynthetic({ ay: 1, ax: 0.3, up: true });
    H.step(1.8, 30);
  });
  const mobCheck = await mpage.evaluate(() => {
    const visiblePills = [...document.querySelectorAll('.fm-top-tools .fm-pill')]
      .filter((b) => getComputedStyle(b).display !== 'none')
      .map((b) => b.textContent.trim());
    return {
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
      padMode: document.querySelector('#fm-pad')?.dataset.mode,
      padVisible: getComputedStyle(document.querySelector('#fm-pad')).display !== 'none',
      modeBarFits: document.querySelector('#fm-modes').getBoundingClientRect().right <= window.innerWidth,
      visiblePills,
      allPillsHaveText: visiblePills.every((t) => t.length > 0),
    };
  });
  assert('Mobile 390x844 zero errors, zero overflow & readable pills', mErrors.length === 0 && !mobCheck.overflowX && mobCheck.modeBarFits && mobCheck.allPillsHaveText, JSON.stringify({ mErrors, mobCheck }));
  assert('Mobile context right-thumb action arc shows for broom', mobCheck.padMode === 'broom' && mobCheck.padVisible, JSON.stringify(mobCheck));
  await mpage.screenshot({ path: path.join(OUT, '13-mobile-broom.jpg'), type: 'jpeg', quality: 88 });

  // Mobile foldable map check
  await mpage.evaluate(() => { window.__haizMove.hud.toggleMap(true); window.__haizMove.step(0.3, 30); });
  await mpage.screenshot({ path: path.join(OUT, '14-mobile-map.jpg'), type: 'jpeg', quality: 88 });
  await mctx.close();

  const passed = checks.filter((c) => c.ok).length;
  console.log(`\nSUMMARY: ${passed}/${checks.length} PASSED`);
  fs.writeFileSync(path.join(ROOT, 'experiments/free-movement/tests/verify-results.json'), JSON.stringify({
    date: new Date().toISOString(),
    passed, total: checks.length, checks, bootInfo,
  }, null, 2));
  if (passed !== checks.length) process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
