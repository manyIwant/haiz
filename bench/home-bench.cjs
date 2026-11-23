#!/usr/bin/env node
// HAIZ homepage (index.html → lanren/js) phone rendering benchmark.
//
//   node bench/home-bench.cjs [--label NAME] [--quality low|medium|high]
//        [--dpr 3] [--cpu 4] [--frames 8] [--scroll 60] [--site DIR] [--out DIR]
//
// What it measures, per quality tier, in an emulated phone (390×844 CSS px,
// touch, isMobile, CPU throttled through CDP):
//   load      time to body.ready, requests and bytes before ready
//   chapters  for each of the six viewpoints: frame time (step + render +
//             GPU sync), draw calls, triangles, shader programs
//   scroll    a continuous 0 → 5 walk (as when the reader scrolls): frame
//             times and how many environment (PMREM) bakes it triggers
//   memory    renderer.info.memory, JS heap, a render-target byte estimate
// Stills for image comparison come from bench/stills.cjs (fresh page per still).
//
// IMPORTANT: this runs on SwiftShader (software WebGL on the CI CPU). Absolute
// milliseconds are NOT phone FPS; they are a repeatable proxy that ranks work
// (full-screen passes, shader taps, allocations) in roughly the same order a
// mobile GPU would. Read the deltas, not the numbers.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const repo = path.resolve(__dirname, '..');
// --site serves another checkout (e.g. a `git worktree` of main) so a baseline
// can be measured with this same harness; results still land in this repo
const root = path.resolve(arg('site', repo));
const flag = (k) => argv.includes('--' + k);
const label = arg('label', 'current');
const qualities = (arg('quality', 'low,medium')).split(',');
const dpr = +arg('dpr', 3);
const cpu = +arg('cpu', 4);
const frames = +arg('frames', 8);
const scrollSteps = +arg('scroll', 60);
const outDir = path.resolve(arg('out', path.join(repo, 'bench/results', label)));
fs.mkdirSync(outDir, { recursive: true });

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (e, b) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' });
    res.end(b);
  });
});

const stats = (a) => {
  const s = [...a].sort((x, y) => x - y), q = (f) => s[Math.min(s.length - 1, Math.floor(f * s.length))];
  const mean = s.reduce((x, y) => x + y, 0) / s.length;
  return { n: s.length, mean: +mean.toFixed(2), p50: +q(0.5).toFixed(2), p90: +q(0.9).toFixed(2), max: +s[s.length - 1].toFixed(2) };
};

// injected before any page script: a seeded Math.random so stills repeat exactly
const SEED = `(() => { let s = 0x2611; Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;

async function runTier(browser, base, quality) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  await ctx.addInitScript(SEED);
  const page = await ctx.newPage();
  page.setDefaultTimeout(600000);
  await page.clock.setFixedTime(new Date('2026-03-21T09:30:00+08:00'));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Performance.enable');
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  let bytes = 0, requests = 0, readyAt = 0;
  cdp.on('Network.loadingFinished', (e) => { if (!readyAt) { bytes += e.encodedDataLength; requests++; } });

  const t0 = Date.now();
  process.stdout.write(`  ${quality}: loading…\n`);
  // `test` makes later acts load eagerly so every chapter is measurable;
  // GSAP lag smoothing is off under it, as in the repository's browser tests.
  await page.goto(`${base}/index.html?quality=${quality}&test=1&bench-scroll=${scrollSteps}`);
  await page.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 600000 });
  readyAt = Date.now();
  const load = { readyMs: readyAt - t0, requests, bytes };
  process.stdout.write(`  ${quality}: ready in ${load.readyMs}ms\n`);
  // let the deferred modules (map, canopy, world) finish arriving
  await page.waitForFunction(() => { const i = window.__haizHome.info(); return i.mapReady && i.canopyReady; }, null, { timeout: 600000 }).catch(() => {});
  await page.addStyleTag({ content: '.panels,.bar,#leaders,.leaders,.track,.orbit,.growth,#veil,.veil,dialog,.toast{visibility:hidden!important}' });

  // instrument: draw calls across all passes in a frame, PMREM bakes, pass timings
  await page.evaluate(async () => {
    const THREE = await import(new URL('lanren/vendor/three/three.module.min.js', location.href).href);
    const H = window.__haizHome, w = H.world, r = w.renderer;
    H.freeze(true);
    r.info.autoReset = false;
    const B = window.__bench = { bakes: 0, bakeMs: 0 };
    const pm = THREE.PMREMGenerator.prototype, fromScene = pm.fromScene;
    pm.fromScene = function (...a) { const s = performance.now(); const out = fromScene.apply(this, a); B.bakes++; B.bakeMs += performance.now() - s; return out; };
    const gl = r.getContext(), px = new Uint8Array(4);
    B.sync = () => { r.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
    B.frame = () => {
      r.info.reset();
      const s = performance.now();
      H.still(1 / 30, 30);      // exactly one step(): simulation + world.render(t)
      B.sync();
      return { ms: performance.now() - s, calls: r.info.render.calls, tris: r.info.render.triangles };
    };
    // advance the simulation without drawing (settling the rail costs no GPU time)
    B.settle = (sec) => { const rr = w.render; w.render = () => {}; try { H.still(sec, 10); } finally { w.render = rr; } };
    // one frame with every pass (and the shadow map) timed behind a GPU sync: attribution, not totals
    B.breakdown = () => {
      const out = {}, sm = r.shadowMap, smr = sm.render;
      sm.render = function (...a) { B.sync(); const s = performance.now(); smr.apply(this, a); B.sync(); out.shadowMap = (out.shadowMap || 0) + performance.now() - s; };
      const wrapped = w.composer.passes.map((p, k) => { const pr = p.render; p.render = function (...a) { B.sync(); const s = performance.now(); pr.apply(this, a); B.sync(); out[k + ':' + p.constructor.name] = performance.now() - s; }; return [p, pr]; });
      r.shadowMap.needsUpdate = true;
      try { H.still(1 / 30, 30); } finally { wrapped.forEach(([p, pr]) => { p.render = pr; }); sm.render = smr; }
      for (const k in out) out[k] = +out[k].toFixed(1);
      return out;
    };
    B.passes = () => w.composer.passes.filter((p) => p.enabled).map((p) => p.constructor.name + (p.material?.name ? ':' + p.material.name : ''));
  });

  const chapters = [];
  for (let i = 0; i < 6; i++) {
    const c = await page.evaluate(({ i, frames }) => {
      const H = window.__haizHome, B = window.__bench;
      H.go(i); B.settle(1.5);       // settle the camera rail and the light
      B.frame(); B.frame();          // first frames at a new view may compile or upload
      B.bakes = 0; B.bakeMs = 0;
      const out = [];
      for (let k = 0; k < frames; k++) out.push(B.frame());
      const bakes = B.bakes;
      return { chapter: i, frames: out, bakes, passes: B.passes(), breakdown: B.breakdown(), programs: H.world.renderer.info.programs.length };
    }, { i, frames });
    chapters.push({ chapter: i, ms: stats(c.frames.map((f) => f.ms)), calls: c.frames.at(-1).calls, tris: c.frames.at(-1).tris,
      bakesWhileStill: c.bakes, programs: c.programs, passes: c.passes, breakdownMs: c.breakdown });
    process.stdout.write(`  ${quality} ch${i + 1}: ${chapters.at(-1).ms.p50}ms p50, ${chapters.at(-1).calls} calls\n`);
  }

  // the reader scrolls from the opening to the walk: p moves a little each frame
  const scroll = await page.evaluate(() => {
    const H = window.__haizHome, B = window.__bench;
    H.go(0); B.settle(1);
    B.bakes = 0; B.bakeMs = 0;
    const ms = [];
    const steps = +new URLSearchParams(location.search).get('bench-scroll') || 60;   // frames across the five transitions
    for (let k = 0; k <= steps; k++) {
      H.state.p = 5 * k / steps;
      const s = performance.now(); H.still(1 / 30, 30); B.sync(); ms.push(performance.now() - s);
    }
    return { ms, bakes: B.bakes, bakeMs: B.bakeMs };
  });

  // the main-thread share alone (CPU throttle applies here): steps with drawing switched off,
  // half resting at the opening, half walking through the transitions
  const jsStep = await page.evaluate(() => {
    const H = window.__haizHome, B = window.__bench, w = H.world, rr = w.render, ms = [];
    w.render = () => {};
    try {
      H.go(0); H.still(0.5, 10);
      for (let k = 0; k < 30; k++) { const s = performance.now(); H.still(1 / 30, 30); ms.push(performance.now() - s); }
      for (let k = 0; k <= 30; k++) { H.state.p = 5 * k / 30; const s = performance.now(); H.still(1 / 30, 30); ms.push(performance.now() - s); }
    } finally { w.render = rr; }
    return ms;
  });

  const memory = await page.evaluate(() => {
    const r = window.__haizHome.world.renderer;
    // bytes held by render targets the homepage owns (colour + depth estimate)
    const w = window.__haizHome.world, rts = [];
    const add = (name, rt, bpp = 8) => rt && rts.push({ name, w: rt.width, h: rt.height, mb: +(rt.width * rt.height * bpp / 1048576).toFixed(2) });
    add('composer.read', w.composer.renderTarget1); add('composer.write', w.composer.renderTarget2);
    const sm = w.sun.shadow.map; if (sm) add('shadow', sm, 4);
    return { geometries: r.info.memory.geometries, textures: r.info.memory.textures, programs: r.info.programs.length,
      pixelRatio: r.getPixelRatio(), drawingBuffer: [r.getContext().drawingBufferWidth, r.getContext().drawingBufferHeight], renderTargets: rts };
  });
  const perf = await cdp.send('Performance.getMetrics');
  memory.jsHeapMB = +(perf.metrics.find((m) => m.name === 'JSHeapUsedSize').value / 1048576).toFixed(1);

  await ctx.close();
  return { quality, load, chapters, jsStep: stats(jsStep), scroll: { ms: stats(scroll.ms), bakes: scroll.bakes, bakeMsTotal: +scroll.bakeMs.toFixed(1), frames: scroll.ms.length }, memory, errors };
}

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const report = {
    label, date: new Date().toISOString(),
    commit: (() => { try { const sh = (c) => require('node:child_process').execSync(c, { cwd: root }).toString().trim(); return sh('git rev-parse --short HEAD') + (sh('git status --porcelain -- lanren') ? '+dirty' : ''); } catch { return null; } })(),
    environment: { browser: browser.version(), gl: 'SwiftShader (software)', viewport: '390x844', dpr, cpuThrottle: cpu, framesPerChapter: frames, cores: require('node:os').cpus().length },
    caveat: 'Software WebGL on a CI CPU. Timings rank work and show deltas; they are not phone frame rates.',
    tiers: []
  };
  try {
    for (const q of qualities) { console.log(`tier ${q}`); report.tiers.push(await runTier(browser, base, q)); }
  } finally { await browser.close(); server.close(); }
  const file = path.join(outDir, 'report.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  for (const t of report.tiers) {
    console.log(`\n[${t.quality}] ready ${t.load.readyMs}ms, ${t.load.requests} req, ${(t.load.bytes / 1048576).toFixed(1)}MB; scroll p50 ${t.scroll.ms.p50}ms p90 ${t.scroll.ms.p90}ms max ${t.scroll.ms.max}ms, ${t.scroll.bakes} PMREM bakes (${t.scroll.bakeMsTotal}ms)`);
    for (const c of t.chapters) console.log(`  ch${c.chapter + 1} p50 ${c.ms.p50}ms p90 ${c.ms.p90}ms calls ${c.calls} tris ${c.tris} passes ${c.passes.length}`);
    if (t.errors.length) console.log('  errors:', t.errors.slice(0, 5));
  }
  console.log('\nwrote ' + path.relative(repo, file));
})().catch((e) => { console.error(e); process.exitCode = 1; });
