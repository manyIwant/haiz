// HAIZ · 入画 · 手绘校园 — browser acceptance for ruhua-painted.html (Chromium; software GL is fine).
//   node tests/life/painted-browser.cjs [--base http://127.0.0.1:8123] [--shots DIR]
// Checks: the page and the walk start with the six layers on and no shader errors; the info attachment is
// written (figure, paint, structure where they should be); every painted-layer material writes it; the A/B
// switch and the debug views change the picture; the art keys follow the sun; the campus's people are
// painted as they arrive; walking, collisions and the first-person eye still work; the transition raises
// the layers in order; ruhua-alive.html is untouched (no info attachment, no art).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://127.0.0.1:8123');
const SHOTS = arg('shots', null);
const results = [];
const check = async (name, fn) => {
  try { const note = await fn(); results.push({ name, ok: true, note }); console.log('ok  ', name, note ? '— ' + note : ''); }
  catch (e) { results.push({ name, ok: false, error: e.message }); console.log('FAIL', name, '—', e.message); }
};
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

async function open(browser, page, viewport, opts = {}) {
  const p = await browser.newPage({ viewport, deviceScaleFactor: 1, isMobile: !!opts.mobile, hasTouch: !!opts.mobile });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && /Shader Error|WebGLProgram|INVALID_OPERATION/.test(m.text())) errors.push(m.text().slice(0, 400)); });
  await p.route('**/api.open-meteo.com/**', (r) => r.abort());
  await p.goto(`${BASE}/${page}?stage=stroll&quality=low&capture&date=2026-11-17${opts.q || ''}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__ruhua && window.__ruhua.stage === 'stroll', null, { timeout: 300000 });
  return { p, errors };
}

(async () => {
  const browser = await chromium.launch({ args: ARGS });
  const { p, errors } = await open(browser, 'ruhua-painted.html', { width: 960, height: 600 });

  await check('the walk starts with the six layers on and no shader errors', async () => {
    const r = await p.evaluate(() => { const R = window.__ruhua; R.weather.setFree('clear', 15.6); R.still(1.5); return { art: !!R.art, on: R.art?.enabled, mrt: R.pipeline.rtB.textures.length, report: R.art?.report }; });
    if (!r.art || !r.on || r.mrt !== 2) throw new Error(JSON.stringify(r));
    if (errors.length) throw new Error(errors.join(' | '));
    return `${r.report.flora.crowns} crown meshes, ${r.report.flora.grass} grass rings, ${r.report.buildings.materials} building materials`;
  });

  await check('the info attachment says what each pixel is', async () => {
    const r = await p.evaluate(() => {
      const R = window.__ruhua;
      // read it through the finish's info view (red figure, green paint × 0.85, blue structure)
      R.look([-22, 1.7, -18], [0, 6, 0], 50); R.art.debug(3); R.still(0.2);
      const gl = R.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, buf = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      R.art.debug(0);
      let fig = 0, foliage = 0, struct = 0, n = 0;
      for (let i = 0; i < buf.length; i += 4 * 7) { n++; if (buf[i] > 128) fig++; if (buf[i + 1] > 200) foliage++; if (buf[i + 2] > 200) struct++; }
      return { fig: fig / n, foliage: foliage / n, struct: struct / n };
    });
    if (r.foliage < 0.05 || r.struct < 0.03) throw new Error(JSON.stringify(r));
    return `foliage ${(r.foliage * 100).toFixed(0)}% · structure ${(r.struct * 100).toFixed(0)}% of the frame`;
  });

  await check('every painted-layer material writes the info attachment', async () => {
    const r = await p.evaluate(() => {
      const R = window.__ruhua;
      let total = 0, missing = [];
      R.scene.traverse((o) => {
        if (!o.isMesh || !o.layers.isEnabled(2)) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          total++;
          const src = R.renderer.properties.get(m)?.currentProgram;
          if (src && !/haizMain/.test(m.onBeforeCompile?.toString() || '') && !(m.customProgramCacheKey?.() || '').includes('hzinfo')) missing.push(m.name || m.type);
        }
      });
      return { total, missing: [...new Set(missing)].slice(0, 8) };
    });
    if (r.missing.length) throw new Error('without info: ' + r.missing.join(', '));
    return `${r.total} drawn materials`;
  });

  await check('the A/B switch and the debug views change the picture', async () => {
    const r = await p.evaluate(() => {
      const R = window.__ruhua, gl = R.renderer.getContext();
      const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, buf = new Uint8Array(W * H * 4);
      const grab = () => { R.still(0.05); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf); return buf.slice(); };
      const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 16) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]); return s / (a.length / 16) / 2; };
      R.look([-46, 7, -38], [10, 6, 20], 52);
      const on = grab(); R.art.setEnabled(false); const off = grab(); R.art.setEnabled(true);
      const views = [];
      for (let n = 1; n <= 5; n++) { R.art.debug(n); views.push(diff(on, grab())); }
      R.art.debug(0);
      const back = grab();
      return { ab: diff(on, off), views, back: diff(on, back) };
    });
    if (r.ab < 2 || r.views.some((v) => v < 0.5) || r.back > 3) throw new Error(JSON.stringify(r));
    return `on/off Δ ${r.ab.toFixed(1)} · views Δ ${r.views.map((v) => v.toFixed(0)).join('/')}`;
  });

  await check('the art keys follow the sun: 正午 → 午后 → 黄金时刻 → 日落, weaker under cloud', async () => {
    const r = await p.evaluate(() => {
      const R = window.__ruhua, out = [];
      for (const h of [12.5, 15.6, 17.1, 17.7]) { R.weather.setFree('clear', h); R.still(4); out.push(R.art.key); }
      // the same hour under a full overcast (the weather eases over minutes; the key is read directly)
      R.weather.setFree('clear', 15.6); R.still(4);
      R.art.palette(R.weather.state.pal, { cur: { overcast: 1, rain: 0.3 }, rainNow: 0.3 }); out.push(R.art.key);
      R.still(0.1);
      return out;
    });
    const labels = r.slice(0, 4).map((k) => k.label);
    if (labels.join() !== '正午,午后,黄金时刻,日落') throw new Error(labels.join());
    if (!(r[4].weight < r[1].weight * 0.6)) throw new Error('overcast weight ' + r[4].weight);
    return r.map((k) => `${k.label} ${k.weight}`).join(' · ');
  });

  await check('the campus\'s people are painted and inked as they arrive', async () => {
    // stand by one of them (bodies are made near the walker) and let the figure files arrive
    await p.evaluate(() => { const R = window.__ruhua; R.weather.setFree('clear', 12.72); R.still(1); const s = R.life.byId.get('chen').state; R.player.place(s.x + 4, s.z + 6, Math.PI); });
    for (let i = 0; i < 10; i++) { await p.evaluate(() => window.__ruhua.still(0.4)); await p.waitForTimeout(300); }
    const r = await p.evaluate(() => {
      const R = window.__ruhua;
      R.still(1.2);
      let figures = 0, art = 0, hulls = 0, hullsVisible = 0;
      R.people.group.traverse((o) => {
        if (!o.isSkinnedMesh) return;
        if (o.material.side === 1 && o.material.uniforms?.uWidth) { hulls++; if (o.material.visible) hullsVisible++; return; }
        figures++; if (/:art/.test(o.material.name)) art++;
      });
      return { figures, art, hulls, hullsVisible };
    });
    if (!r.figures || r.art < r.figures || r.hullsVisible) throw new Error(JSON.stringify(r));
    return `${r.art}/${r.figures} body meshes painted, ${r.hulls} hull outlines retired`;
  });

  await check('walking, a wall and the first-person eye still work', async () => {
    const r = await p.evaluate(() => {
      const R = window.__ruhua, P = R.player;
      R.look(null);
      // walk east from the tree's lawn toward 一号教学楼: the walker must stop at its wall
      const b = R.world.model.buildings.find((x) => x.id === 'yihao') || R.world.model.buildings[0];
      const c0 = Math.cos(b.rot), s0 = Math.sin(b.rot), lx = -(b.w / 2 + 6);
      const sx = b.cx + lx * c0, sz = b.cz - lx * s0;
      P.place(sx, sz, Math.atan2(b.cx - sx, b.cz - sz));
      const keys = (on) => window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code: 'KeyW' }));
      keys(true); R.tick(4); keys(false); R.tick(0.5);
      const s = P.state.pos;
      const dx = s.x - b.cx, dz = s.z - b.cz, c = Math.cos(b.rot), sn = Math.sin(b.rot);
      const inside = Math.abs(dx * c - dz * sn) < b.w / 2 - 0.2 && Math.abs(dx * sn + dz * c) < b.d / 2 - 0.2;
      const fp = P.toggleView(); R.still(0.6); const fp2 = P.toggleView(); R.still(0.3);
      return { moved: Math.hypot(s.x - sx, s.z - sz), inside, fp, fp2 };
    });
    if (r.inside) throw new Error('inside a wall ' + JSON.stringify(r));
    if (r.moved < 1.5) throw new Error('did not walk ' + JSON.stringify(r));
    if (!r.fp || r.fp2) throw new Error('first person ' + JSON.stringify(r));
    return `walked ${r.moved.toFixed(1)} m, stopped outside the wall; first person on/off`;
  });

  await check('the transition raises the layers in turn: ground, plants, buildings, then the walker', async () => {
    const r = await p.evaluate(() => {
      const R = window.__ruhua;
      const samples = [1.0, 2.0, 3.0, 4.0, 5.5].map((t) => R.art.layerRamps('spread', t, 0, R.T).map((v) => +v.toFixed(2)));
      const enter = [0.2, 0.6, 1.0].map((k) => +R.art.layerRamps('enter', 9, k, R.T)[3].toFixed(2));
      return { samples, enter, after: R.art.ramps };
    });
    const s = r.samples;
    const order = s.every((v) => v[0] >= v[1] - 1e-6 && v[1] >= v[2] - 1e-6 && v[3] === 0);
    const rises = s[s.length - 1][2] > s[0][2] && s[s.length - 1][0] > 0.95;
    const inked = r.enter[0] === 0 && r.enter[2] === 1;
    if (!order || !rises || !inked || r.after.some((v) => v !== 1)) throw new Error(JSON.stringify(r));
    return s.map((v) => v.slice(0, 3).join('/')).join(' → ') + ` · walker inked ${r.enter.join('/')}`;
  });

  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    await p.evaluate(() => { const R = window.__ruhua; R.weather.setFree('clear', 17.1); R.look([-46, 7, -38], [10, 6, 20], 52); R.still(3); });
    await p.screenshot({ path: path.join(SHOTS, 'painted-golden.png') });
  }
  await check('no page errors on the painted page', async () => { if (errors.length) throw new Error(errors.slice(0, 3).join(' | ')); });
  await p.close();

  // a phone held upright
  {
    const { p: m, errors: me } = await open(browser, 'ruhua-painted.html', { width: 390, height: 844 }, { mobile: true });
    await check('phone, upright: painted walk starts with the narrow brush', async () => {
      const r = await m.evaluate(() => { const R = window.__ruhua; R.still(1); return { on: R.art?.enabled, radius: R.pipeline.finish.uniforms.uRadius.value, info: R.info() }; });
      if (!r.on || r.radius !== 1) throw new Error(JSON.stringify(r));
      if (me.length) throw new Error(me.join(' | '));
      if (SHOTS) await m.screenshot({ path: path.join(SHOTS, 'painted-phone.png') });
      return `brush radius ${r.radius}, ${r.info.calls} draws`;
    });
    await m.close();
  }

  // the original living-campus page keeps its own pipeline
  {
    const { p: a, errors: ae } = await open(browser, 'ruhua-alive.html', { width: 640, height: 400 });
    await check('ruhua-alive.html is untouched: no art, one attachment', async () => {
      const r = await a.evaluate(() => { const R = window.__ruhua; return { art: R.art, mrt: R.pipeline.rtB.textures.length, finish: !!R.pipeline.finish }; });
      if (r.art || r.mrt !== 1 || r.finish) throw new Error(JSON.stringify(r));
      if (ae.length) throw new Error(ae.join(' | '));
    });
    await a.close();
  }

  await browser.close();
  const out = path.join(__dirname, 'painted-browser-results.json');
  fs.writeFileSync(out, JSON.stringify({ when: new Date().toISOString(), renderer: 'Chromium + SwiftShader (software)', passed: results.filter((r) => r.ok).length, total: results.length, results }, null, 1));
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
})();
