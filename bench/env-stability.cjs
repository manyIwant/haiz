#!/usr/bin/env node
// Lifecycle regression for the reused image-based-light target (lanren/js/scene.js,
// reusePMREMTarget). Runs the real homepage on an emulated phone and checks:
//
//   1. reuse is active on this three.js revision, and many re-bakes (the reader
//      scrolling 0 → 5 → 0 several times) allocate exactly one target
//   2. the renderer's texture count does not grow with the bakes
//   3. scene.environment always points at the kept target's texture
//   4. no stale environment: the baked texels change when the sky changes and
//      come back (to within one step of the page's re-bake key) when it returns
//   5. resizing the page (and the pixel-ratio drop the page's adapt() does)
//      leaves the target working
//   6. after a WebGL context loss and restore, bakes resume into a working target
//   7. no page errors or WebGL errors throughout
//
//   node bench/env-stability.cjs [--site DIR] [--quality low] [--sweeps 3]
// Exit code 1 on any failed check. Writes bench/results/env-stability.json.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const repo = path.resolve(__dirname, '..');
const root = path.resolve(arg('site', repo));
const quality = arg('quality', 'low');
const sweeps = +arg('sweeps', 3);

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (e, b) => { if (e) { res.writeHead(404).end(); return; } res.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); res.end(b); });
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [], checks = [];
  const ok = (name, detail) => { checks.push({ name, detail }); console.log('✓ ' + name + (detail ? ' — ' + detail : '')); };
  let report;
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.setDefaultTimeout(600000);
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/GPU stall/.test(m.text())) errors.push(m.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html?quality=${quality}&capture=1`);
    await page.waitForFunction(() => document.body.classList.contains('ready'));
    await page.waitForFunction(() => { const i = window.__haizHome.info(); return i.mapReady && i.canopyReady; }, null, { timeout: 120000 }).catch(() => {});

    await page.evaluate(() => {
      const H = window.__haizHome, w = H.world, r = w.renderer, gl = r.getContext();
      H.freeze(true);
      const E = window.__env = {
        glErrors: 0,
        // advance the page without drawing the frame: setStage (and its bakes) still runs every step
        steps(n, p0, p1) { const rr = w.render; w.render = () => {}; try { for (let k = 0; k < n; k++) { H.state.p = p0 + (p1 - p0) * (k + 1) / n; H.still(1 / 30, 30); } } finally { w.render = rr; } },
        settle(p) { E.steps(12, p, p); },
        // a block of the baked environment (the +X face's top mip), as raw half floats
        sample() {
          const t = w.envStats.target, buf = new Uint16Array(64 * 64 * 4);
          r.readRenderTargetPixels(t, 0, 0, 64, 64, buf);
          const e = gl.getError(); if (e) E.glErrors++;
          return Array.from(buf);
        },
        same(a, b) { let d = 0; for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) d++; return d; },
        // mean absolute difference of the decoded half floats (RGB only)
        mad(a, b) {
          const h = (x) => { const e = (x >> 10) & 31, m = x & 1023, s = x >> 15 ? -1 : 1; return e === 0 ? s * m * 2 ** -24 : e === 31 ? NaN : s * (1 + m / 1024) * 2 ** (e - 15); };
          let d = 0, n = 0; for (let k = 0; k < a.length; k++) { if (k % 4 === 3) continue; d += Math.abs(h(a[k]) - h(b[k])); n++; } return d / n;
        },
        state() { const s = w.envStats; return { active: s.active, reason: s.reason, allocations: s.allocations, bakes: s.bakes, textures: r.info.memory.textures,
          bound: w.scene.environment === s.target?.texture, targetId: s.target?.texture.uuid, size: s.target && [s.target.width, s.target.height] }; }
      };
    });

    // 1–3: many bakes, one target, stable texture count, always bound
    const start = await page.evaluate(() => { window.__env.settle(0); window.__haizHome.world.render(0); return window.__env.state(); });   // one real frame first: every scene texture uploaded
    assert.equal(start.active, true, 'reuse inactive: ' + start.reason);
    const afterSweeps = await page.evaluate((sweeps) => {
      const E = window.__env, seen = new Set(), unbound = [];
      for (let s = 0; s < sweeps; s++) {
        for (const [a, b] of [[0, 5], [5, 0]]) {
          for (let k = 0; k < 10; k++) { E.steps(6, a + (b - a) * k / 10, a + (b - a) * (k + 1) / 10); const st = E.state(); seen.add(st.targetId); if (!st.bound) unbound.push(st.bakes); }
        }
      }
      return { ...E.state(), distinctTargets: seen.size, unbound };
    }, sweeps);
    const bakes = afterSweeps.bakes - start.bakes;
    assert(bakes >= 20 * sweeps, `expected many bakes over ${sweeps} sweeps, got ${bakes}`);
    assert.equal(afterSweeps.allocations, 1, 'environment targets allocated: ' + afterSweeps.allocations);
    assert.equal(afterSweeps.distinctTargets, 1);
    assert.deepEqual(afterSweeps.unbound, []);
    assert.equal(afterSweeps.textures, start.textures, `texture count grew ${start.textures} → ${afterSweeps.textures}`);
    ok('repeated bakes reuse one target', `${bakes} bakes over ${sweeps} scroll sweeps, 1 allocation, textures ${start.textures} → ${afterSweeps.textures}, environment always bound`);

    // 4: no stale environment
    const stale = await page.evaluate(() => {
      const E = window.__env;
      E.settle(0); const a = E.sample();
      E.steps(30, 0, 3.5); E.settle(3.5); const b = E.sample();
      E.steps(30, 3.5, 0); E.settle(0); const c = E.sample();
      return { changed: E.same(a, b), n: a.length, away: E.mad(a, b), back: E.mad(a, c) };
    });
    // The page re-bakes when the sky's key (two decimals of horizon, zenith and sun) changes,
    // so the resting environment is the one baked on entering that key: back at the same view
    // it may differ from the first visit by less than one key step, never by a sky's worth.
    assert(stale.changed > stale.n * 0.2, `environment did not follow the sky: ${stale.changed}/${stale.n} values changed`);
    assert(stale.back < stale.away * 0.05, `environment did not come back: mean difference ${stale.back} vs ${stale.away} away`);
    ok('environment follows the sky and comes back', `mean texel change ${stale.away.toFixed(4)} at p 3.5, ${stale.back.toFixed(5)} back at p 0 (${(stale.back / stale.away * 100).toFixed(2)}% — within one key step)`);

    // 5: resize, and the page's own pixel-ratio drop
    const before = await page.evaluate(() => { window.__env.settle(0); window.__haizHome.world.render(0); return window.__env.state(); });
    await page.setViewportSize({ width: 600, height: 900 });
    await page.evaluate(() => { dispatchEvent(new Event('resize')); const w = window.__haizHome.world; w.resize(); });
    await page.setViewportSize({ width: 390, height: 844 });
    const resized = await page.evaluate(() => {
      const E = window.__env, w = window.__haizHome.world, r = w.renderer;
      dispatchEvent(new Event('resize')); w.resize();
      const nr = Math.max(0.75, r.getPixelRatio() * 0.8); r.setPixelRatio(nr); w.composer.setPixelRatio(nr); w.resize();   // as adapt() does
      E.settle(0); w.render(0); const same = E.state();   // same view as before the resize: compare texture counts here
      const a = E.sample(); E.steps(20, 0, 2); E.settle(2); const b = E.sample();
      return { ...same, changed: E.same(a, b) };
    });
    assert.equal(resized.targetId, before.targetId, 'resize replaced the environment target');
    assert.equal(resized.allocations, 1);
    assert(resized.changed > 0, 'bakes stopped after resize');
    assert.equal(resized.textures, before.textures, `texture count changed on resize ${before.textures} → ${resized.textures}`);
    ok('resize and pixel-ratio drop keep the target working', `same target, ${resized.changed} values change on the next sky`);

    // 6: context loss and restore
    const lost = await page.evaluate(async () => {
      const E = window.__env, w = window.__haizHome.world, r = w.renderer, gl = r.getContext(), ext = gl.getExtension('WEBGL_lose_context');
      if (!ext) return { skipped: 'WEBGL_lose_context unavailable' };
      const events = [];
      const c = r.domElement;
      c.addEventListener('webglcontextlost', () => events.push('lost'));
      c.addEventListener('webglcontextrestored', () => events.push('restored'));
      ext.loseContext(); await new Promise((ok) => setTimeout(ok, 300));
      ext.restoreContext(); await new Promise((ok) => setTimeout(ok, 1500));
      gl.getError();   // clear the error state the loss itself leaves
      E.settle(1); w.render(2); const a = E.sample();
      E.steps(20, 1, 4); E.settle(4); w.render(3); const b = E.sample();
      return { events, lost: gl.isContextLost(), changed: E.same(a, b), nonzero: b.some((v) => v !== 0), ...E.state() };
    });
    if (lost.skipped) ok('context loss: skipped', lost.skipped);
    else {
      assert.deepEqual(lost.events, ['lost', 'restored']);
      assert.equal(lost.lost, false);
      assert(lost.nonzero && lost.changed > 0, `environment not re-baked after restore (nonzero ${lost.nonzero}, changed ${lost.changed})`);
      assert.equal(lost.bound, true);
      ok('context loss and restore', `bakes resume into the kept target (${lost.changed} values change), still bound`);
    }

    const glErrors = await page.evaluate(() => window.__env.glErrors);
    assert.equal(glErrors, 0, 'WebGL errors while reading the environment: ' + glErrors);
    assert.deepEqual(errors, [], 'page errors: ' + errors.join(' | '));
    ok('no page or WebGL errors');
    report = { date: new Date().toISOString(), site: path.relative(repo, root) || '.', quality, passed: true, checks, start, afterSweeps: { ...afterSweeps, unbound: undefined }, stale, resized, lost };
    await ctx.close();
  } catch (e) {
    report = { date: new Date().toISOString(), quality, passed: false, checks, error: String(e && e.message || e), errors };
    console.error(e); process.exitCode = 1;
  } finally { await browser.close(); server.close(); }
  fs.mkdirSync(path.join(repo, 'bench/results'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'bench/results/env-stability.json'), JSON.stringify(report, null, 2) + '\n');
})();
