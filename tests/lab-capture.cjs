// Captures the documentation stills and run recordings for the HAIZ lab book into docs/lab/.
// Frames are stepped on a virtual clock (so software rendering still yields a smooth 30 fps recording)
// and driven with real pointer / touch events. Needs ffmpeg for the videos.  node tests/lab-capture.cjs [stills|video|phone]
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'docs', 'lab');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const what = process.argv[2] || 'all';
const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const clock = () => {
  const vt = window.__vt = { on: false, now: 0 };
  const realNow = performance.now.bind(performance), realRAF = window.requestAnimationFrame.bind(window);
  let q = [], id = 1e6; const px = new Uint8Array(4);
  performance.now = () => (vt.on ? vt.now : realNow());
  window.requestAnimationFrame = (cb) => { if (!vt.on) return realRAF(cb); q.push([++id, cb]); return id; };
  vt.enable = () => { vt.now = realNow(); vt.on = true; };
  vt.step = (n = 1, dt = 1000 / 60) => {
    for (let k = 0; k < n; k++) {
      vt.now += dt; const cur = q; q = []; cur.forEach((x) => x[1](vt.now));
      try { const gl = window.__lab.stage.r.getContext(); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } catch {}
    }
    return new Promise((res) => realRAF(() => realRAF(res)));
  };
};

(async () => {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(root, p), (err, buf) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(buf); });
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  fs.mkdirSync(out, { recursive: true });
  const session = async (hash, w, h, ctxOpt = {}, q = 2) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ...ctxOpt });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error('page error:', e.message));
    await page.addInitScript(clock);
    await page.goto(`${base}/lab/index.html?fixed=1&q=${q}#${hash}`);
    await page.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 180000 });
    await page.evaluate(() => window.__vt.enable());
    const step = (n) => page.evaluate((n) => window.__vt.step(n), n);
    const jpg = (name, o = {}) => page.screenshot({ path: path.join(out, name), type: 'jpeg', quality: 84, timeout: 180000, ...o });
    const press = (label) => page.evaluate((label) => [...document.querySelectorAll('#css3d .leaf-r button, #flow .leaf-r button')].find((b) => b.textContent === label).click(), label);
    const at = (x, side, z) => page.evaluate(([x, side, z]) => { const s = window.__lab.stage, v = s.goal.target.clone().set(x, side > 0 ? s.book.hR : s.book.hL, z).project(s.cam), b = s.canvas.getBoundingClientRect(); return { x: b.left + (v.x + 1) / 2 * b.width, y: b.top + (1 - v.y) / 2 * b.height }; }, [x, side, z]);
    return { ctx, page, step, jpg, press, at };
  };
  const film = async (s, name, script) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'haiz-lab-'));
    let n = 0;
    const roll = async (frames) => { for (let i = 0; i < frames; i += 2) { await s.step(2); await s.page.screenshot({ path: path.join(dir, `f${String(n++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 90, timeout: 180000 }); } };
    await script(roll);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(dir, 'f%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', path.join(out, name)]);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('video', name, n, 'frames');
  };

  if (what === 'all' || what === 'stills') {
    let s = await session('phy-pendulum', 1280, 800);
    await s.step(60); await s.press('计时并记录'); await s.step(150); await s.jpg('phy-pendulum.jpg'); await s.ctx.close();
    s = await session('chem-titration', 1280, 800);
    await s.step(30); await s.press('快速'); await s.step(760); await s.press('关'); await s.step(20); await s.jpg('chem-titration.jpg'); await s.ctx.close();
    s = await session('his-type', 1280, 800);
    await s.step(30); for (let i = 0; i < 7; i++) { await s.press('下一步'); await s.step(125); } await s.jpg('gen2-type.jpg'); await s.ctx.close();
    for (const id of ['bio-dna', 'math-conic', 'math-function', 'phy-forces', 'chem-molarity']) { s = await session(id, 1280, 800); await s.step(90); await s.jpg(id + '.jpg'); await s.ctx.close(); }
    s = await session('chem-titration', 1280, 800);
    await s.step(40); const a = await s.at(9.6, 1, 6.0), b = await s.at(1.5, 1, 2.5);
    await s.page.mouse.move(a.x, a.y); await s.step(10); await s.page.mouse.down(); await s.page.mouse.move(b.x, b.y, { steps: 10 }); await s.step(40); await s.jpg('gen2-turn.jpg'); await s.page.mouse.up(); await s.ctx.close();
    s = await session('chem-flame', 390, 844, { deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 1);
    await s.step(90); await s.jpg('phone-flame.jpg'); await s.ctx.close();
    console.log('stills done');
  }
  if (what === 'all' || what === 'video') {
    const s = await session('phy-pendulum', 1120, 700);
    await film(s, 'gen2-turn.mp4', async (roll) => {
      await roll(50);
      await s.page.keyboard.press('ArrowRight'); await roll(170);                       // 自动翻页
      const c = await s.at(9.6, 1, 6.0);
      await s.page.mouse.move(c.x + 60, c.y + 30); await roll(10);
      await s.page.mouse.move(c.x - 14, c.y - 10, { steps: 4 }); await roll(40);          // 页角翘起
      await s.page.mouse.down();
      for (let i = 1; i <= 12; i++) { await s.page.mouse.move(c.x - 14 - i * 22, c.y - 10 - i * 9); await roll(4); }
      await roll(24); await s.page.mouse.up(); await roll(70);                            // 半途放手：弹回
      await s.page.mouse.down();
      const far = await s.at(-8, -1, 3);
      for (let i = 1; i <= 26; i++) { await s.page.mouse.move(c.x - 14 + (far.x - c.x) * i / 26, c.y - 10 + (far.y - c.y) * i / 26 - Math.sin(i / 26 * Math.PI) * 60); await roll(4); }
      await s.page.mouse.up(); await roll(150);                                           // 拖过书脊：翻完，新装置立起
    });
    await s.ctx.close();
  }
  if (what === 'all' || what === 'phone') {
    const s = await session('chem-titration', 390, 780, { isMobile: true, hasTouch: true }, 1);
    const cdp = await s.ctx.newCDPSession(s.page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await film(s, 'gen2-phone.mp4', async (roll) => {
      await roll(40);
      await touch('touchStart', 335, 250); await roll(4);
      for (let i = 1; i <= 16; i++) { await touch('touchMove', 335 - i * 16, 250 - Math.sin(i / 16 * Math.PI) * 14); await roll(4); }
      await touch('touchEnd'); await roll(150);
    });
    await s.ctx.close();
  }
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
