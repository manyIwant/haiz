// Measurements for the stylized walks (V1 campus-stroll.html, V2 campus-stroll-v2.html).
//
//   node tests/stroll-perf.cjs [v1|v2] [out.json]
//
// What this can honestly measure in a GPU-less Linux container (SwiftShader software WebGL):
//   load      time to first interactive frame and to buildings ready; bytes of every resource
//   CPU       the per-frame cost of the walk's own JavaScript (simulation, camera, culling), timed
//             over 300 simulated steps — a CPU figure, not a frame rate
//   workload  draw calls, triangles and (V2) grass vertices of a real frame at five viewpoints,
//             main pass + shadow pass + post
//   memory    JS heap; GPU memory estimated from the actual geometry buffers, textures and render
//             targets in use (an estimate: drivers pad and compress differently)
// It does NOT measure real-device frame time, GPU time, thermals or Safari. Software rendering
// frame times are printed only as a sanity value and must not be read as device performance.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const which = process.argv[2] || 'v2';
const PAGE = which === 'v1' ? 'campus-stroll.html' : 'campus-stroll-v2.html';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'content-length': fs.statSync(file).size });
  fs.createReadStream(file).pipe(res);
});
const VIEWS = { spawn: [3, -34, 3], tree: [17, -9, -62], building: [-2, 49, -90], road: [-35.6, -24, 180], open: [-122, -60, -90] };

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  // timer polling (not rAF: software frames take seconds) and the page's own clock since navigation
  await page.goto(`http://127.0.0.1:${server.address().port}/${PAGE}?quality=medium&scale=1`);
  const interactive = await (await page.waitForFunction(() => ((window.__stroll || window.__toon) ? Math.round(performance.now()) : 0), null, { timeout: 180000, polling: 100 })).jsonValue();
  const buildingsReady = await (await page.waitForFunction(() => { const T = window.__stroll || window.__toon; return T.info.buildings !== 'loading' ? Math.round(performance.now()) : 0; }, null, { timeout: 400000, polling: 100 })).jsonValue();
  const out = { page: PAGE, measuredAt: new Date().toISOString(), environment: 'Chromium ' + browser.version() + ' · SwiftShader software WebGL · 1280×720 · Linux container (no GPU)', interactiveMs: interactive, buildingsReadyMs: buildingsReady };
  out.resources = await page.evaluate(() => {
    const r = performance.getEntriesByType('resource').map((e) => ({ name: e.name.replace(location.origin + '/', ''), kb: Math.round((e.encodedBodySize || e.transferSize || 0) / 1024), ms: Math.round(e.duration) }));
    return { totalKB: r.reduce((a, b) => a + b.kb, 0), largest: r.sort((a, b) => b.kb - a.kb).slice(0, 8) };
  });
  out.views = {};
  for (const [name, [x, z, yaw]] of Object.entries(VIEWS)) {
    out.views[name] = await page.evaluate(async ([x, z, yaw]) => {
      const T = window.__stroll || window.__toon;
      T.setTime('noon');
      T.place(x, z, yaw); T.view(yaw, 0.12, null);
      if (T.settle) T.settle(2); else for (let i = 0; i < 60; i++) T.player.update(1 / 30);
      const ri = T.renderer.info;
      ri.autoReset = false;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      ri.reset();
      const a = performance.now();
      await new Promise((r) => requestAnimationFrame(r));
      const frame = performance.now() - a;
      const res = { calls: ri.render.calls, triangles: ri.render.triangles, softwareFrameMs: Math.round(frame) };
      if (T.grass?.stats) { res.grassTiles = T.grass.stats.tiles.slice(); res.grassVerts = T.grass.stats.verts; }
      return res;
    }, [x, z, yaw]);
  }
  out.cpu = await page.evaluate(() => {
    const T = window.__stroll || window.__toon;
    T.place(3, -34, 3);
    dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    const a = performance.now();
    if (T.settle) T.settle(10); else for (let i = 0; i < 300; i++) T.player.update(1 / 30);
    const ms = (performance.now() - a) / 300;
    dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    return { jsPerFrameMs: Math.round(ms * 1000) / 1000, note: 'simulation + camera + culling per frame (V1: player only); rendering excluded' };
  });
  out.memory = await page.evaluate(() => {
    const T = window.__stroll || window.__toon;
    const geos = new Set(), texs = new Set();
    T.scene.traverse((o) => {
      if (o.geometry) geos.add(o.geometry);
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        for (const k of Object.keys(m)) if (m[k]?.isTexture) texs.add(m[k]);
        const u = m.uniforms || m.userData?.uniforms || {};
        for (const v of Object.values(u)) if (v?.value?.isTexture) texs.add(v.value);
      }
      if (o.isInstancedMesh) geos.add({ attributes: { m: o.instanceMatrix, c: o.instanceColor } });
    });
    let gb = 0;
    for (const g of geos) {
      for (const a of Object.values(g.attributes || {})) if (a?.array) gb += a.array.byteLength;
      if (g.index?.array) gb += g.index.array.byteLength;
    }
    let tb = 0;
    for (const t of texs) { const i = t.image; if (i?.width) tb += i.width * i.height * 4 * (t.generateMipmaps !== false ? 1.33 : 1); }
    const size = T.renderer.getDrawingBufferSize(new (T.camera.position.constructor)());
    const heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
    return { jsHeapMB: heap, geometryMB: Math.round(gb / 1048576 * 10) / 10, textureMB: Math.round(tb / 1048576 * 10) / 10, textures: texs.size, geometries: geos.size, drawingBuffer: [size.x, size.y] };
  });
  out.info = await page.evaluate(() => (window.__stroll || window.__toon).info);
  const json = JSON.stringify(out, null, 2);
  console.log(json);
  if (process.argv[3]) fs.writeFileSync(process.argv[3], json + '\n');
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exitCode = 1; server.close(); });
