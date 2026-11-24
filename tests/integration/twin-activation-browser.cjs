// HAIZ · Phase-2 asset integration smoke: proves we actually decode the new
// GLBs inside the real 入画自由共游 renderer, not silently fall back to V3.
// Uses Chromium/SwiftShader, not a real-phone GPU benchmark.
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const PORT = Number(process.env.HAIZ_TWIN_TEST_PORT || 9233);
const BASE = 'http://127.0.0.1:' + PORT;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
    { cwd: ROOT, stdio: 'ignore' });
  let browser;
  try {
    let ready = false;
    for (let i = 0; i < 90; ++i) {
      if (server.exitCode !== null) throw new Error('static server exited before ready');
      try { const r = await fetch(BASE + '/ruhua-free.html'); if (r.ok) { ready = true; break; } } catch {}
      await sleep(200);
    }
    assert.ok(ready, 'static server started');
    browser = await chromium.launch({ args: [
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'
    ] });
    const page = await browser.newPage({ viewport: { width: 1000, height: 660 }, deviceScaleFactor: 1 });
    const errors = [], got = new Set();
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => {
      if (/\/(yihao|gate)\.glb|\/draco_decoder\.wasm/.test(r.url()) && r.ok()) got.add(r.url().split('/').pop());
    });
    await page.route('**/api.open-meteo.com/**', r => r.abort());
    await page.goto(BASE + '/ruhua-free.html?stage=stroll&quality=low&twin=debug&capture=1', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__haizTwinPhase2, null, { timeout: 300000 });
    const twin = await page.evaluate(() => window.__haizTwinPhase2);
    const names = twin.applied.map(x => x.part).sort();
    assert.deepEqual(names, ['arts','erhao','forecourt','gate','landmark','science','south_classrooms','yanchi','yihao'].sort(), 'actual atelier meshes installed: ' + JSON.stringify(twin));
    const tree=await page.evaluate(()=>window.__haizAtelierTree);
    assert.ok(tree?.rosettes>1000 && tree?.meshes>0, 'atelier animated tree loaded');
    assert.deepEqual(twin.skipped, [], 'no silent fallback to V3');
    for (const asset of ['yihao.glb', 'gate.glb'])
      assert.ok(got.has(asset), 'loaded and decoded local ' + asset + ' (seen ' + [...got].join(', ') + ')');
    const wasm = await page.request.get(BASE + '/lanren/vendor/three/addons/libs/draco/draco_decoder.wasm');
    assert.ok(wasm.ok(), 'local Draco WASM is reachable without any CDN');
    await page.waitForFunction(() => window.__ruhua?.stage === 'stroll' && !!window.__ruhua?.free, null, { timeout: 300000 });
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS atelier buildings and precinct + shared animated tree applied in live free-roam:', names.join(', '));
    console.log('PASS entering the free-roam stage and enabled createFree()');
    console.log('PASS all assets served locally, no browser exceptions');
  } finally {
    await browser?.close();
    server.kill('SIGTERM');
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
