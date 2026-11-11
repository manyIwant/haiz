// Real-browser checks for the world's clock (lanren/world/clock.js), in Chromium (SwiftShader here).
//
//   default   (no flag) V4's light is untouched; the one fix that applies there too: an evening that
//             has come at 06 stays when the walker comes back to 06 from the walk
//   clock     (?clock=1) the scene's sun is the clock's at every shot; through the 05 → 06 film it
//             does not move; 06's standpoint is the derived one; looking at 06 lets the evening go on
//             (the sun sinks, the lights come on) and it does not start again after a walk; the
//             instant is shown; nothing overflows on a phone
//
// usage: node tests/world-clock-browser.cjs [default] [clock] [phone] [reduced] [shots]
//   shots  also writes the review captures to docs/lanren/continuity/ (slow in software rendering)
const { chromium } = require('playwright');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const OUT = path.join(root, 'docs/lanren/continuity');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const serve = () => new Promise((res) => {
  const s = http.createServer((req, rsp) => {
    const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    fs.readFile(p, (err, buf) => { if (err) { rsp.writeHead(404); rsp.end(); return; } rsp.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); rsp.end(buf); });
  }).listen(0, () => res(s));
});
const want = process.argv.slice(2);
const run = (k) => !want.filter((w) => w !== 'shots').length || want.includes(k);
const SHOTS = want.includes('shots');
const HIDE = '.bar,.panels,.orbit,.growth,.card,.colophon,.leaders,#experienceDock,.wd,.rail{display:none!important}.stage::after{display:none}';

(async () => {
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const results = [], errors = [];
  const ok = (m) => { results.push(m); console.log('✓ ' + m); };
  if (SHOTS) fs.mkdirSync(OUT, { recursive: true });

  async function open(qs, { vw = SHOTS ? 1280 : 640, vh = SHOTS ? 720 : 360, mobile = false, quality = process.env.Q || 'medium', reduced = false } = {}) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(qs + ': ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/GPU stall|swiftshader|Automatic fallback|favicon/i.test(m.text())) errors.push(qs + ': ' + m.text()); });
    // (a fresh context has no session storage: the flag is only what the address says)
    await page.goto(`http://localhost:${port}/index.html?capture=1&quality=${quality}${qs}`);
    await page.waitForFunction(() => window.__haizHome && window.__haizHome.world && document.body.classList.contains('ready') && window.__haizHome.life && window.__haizHome.map, null, { timeout: 240000 });
    return { page, ctx };
  }
  // frame-by-frame: the page is paused (?capture); every step is one frame of dt seconds
  const still = (page, s = 0.2, fps = 10) => page.evaluate(([a, b]) => window.__haizHome.still(a, b), [s, fps]);
  const seek = async (page, p, s = 0.2) => { await page.evaluate((v) => { const h = window.__haizHome; if (Number.isInteger(v)) h.go(v); else h.seek(v); }, p); await still(page, s, 10); };
  const sun = (page) => page.evaluate(() => window.__haizHome.sun);
  const evening = (page) => page.evaluate(() => window.__haizHome.map.section?.evening ?? -1);
  const owner = (page) => page.evaluate(() => window.__haizHome.W.owner);
  // flights run on the wall clock: step frames until the owner is the one waited for
  async function until(page, o, max = 60) { for (let i = 0; i < max; i++) { if (await owner(page) === o) return; await page.waitForTimeout(250); await still(page, 0.1, 10); } throw new Error('never became ' + o + ' (is ' + await owner(page) + ')'); }
  const snap = async (page, name) => { if (!SHOTS) return; await page.addStyleTag({ content: HIDE }).catch(() => {}); await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, name + '.jpg'), type: 'jpeg', quality: 88, timeout: 240000 }); console.log('  shot ' + name); };

  // ---------------------------------------------------------------- default: V4's light, and the evening that stays
  if (run('default')) {
    const { page, ctx } = await open('');
    assert(await page.evaluate(() => window.__haizHome.clock === null), 'no clock without the flag');
    assert(await page.evaluate(() => !document.querySelector('.orbit .when')), 'no instant shown without the flag');
    const suns = [];
    for (const p of [0, 1, 3, 4, 5]) { await seek(page, p); suns.push(await sun(page)); if (SHOTS) await snap(page, `v4-0${p + 1}`); }
    if (SHOTS) { await seek(page, 2); await snap(page, 'v4-03'); }
    const L = await page.evaluate(() => window.__haizHome.chapters && null);
    void L;
    // V4's own suns, as chapters.js has them (06 with composition b's turn)
    const expect = [[166, 8], [205, 34], [135, 28], [302, 12], [320, 8.5]];
    suns.forEach((s, i) => assert(Math.abs(s.az - expect[i][0]) < 0.6 && Math.abs(s.el - expect[i][1]) < 0.6, `default sun at shot ${i} is V4's: ${JSON.stringify(s)}`));
    ok('default (no flag): the scene\'s sun at 01, 02, 04, 05, 06 is V4\'s own (' + suns.map((s) => `${s.az.toFixed(0)}°/${s.el.toFixed(1)}°`).join(' · ') + '); no clock, no instant shown');
    // the film in V4's light: the sun turns while the walker walks
    const film = [];
    for (const q of [0.3, 0.6, 0.75, 0.9]) { await seek(page, 4 + q, 0.2); film.push(await sun(page)); if (SHOTS && (q === 0.6 || q === 0.75)) await snap(page, `v4-film-${Math.round(q * 100)}`); }
    ok('default film: the sun at q 0.30 / 0.60 / 0.75 / 0.90 stands at ' + film.map((s) => `${s.az.toFixed(1)}°/${s.el.toFixed(1)}°`).join(' · ') + ' (it turns during the take)');
    // 06: the evening comes; into the walk and back to 06, it has not started again
    await seek(page, 5, 0.3);
    await until(page, 'hold');
    await still(page, 10, 1);   // ten seconds of looking, in ten frames
    const ev1 = await evening(page);
    assert(ev1 > 0.99, 'after 10 s at 06 the lights are on: ' + ev1);
    await snap(page, 'v4-06-held');
    await page.evaluate(() => window.__haizHome.life.handoff());
    await until(page, 'play');
    await still(page, 0.5, 10);
    const evWalk = await evening(page);
    await page.evaluate(() => window.__haizHome.life.back6());
    await until(page, 'hold');
    await still(page, 0.1, 10);
    const evBack = await evening(page);
    assert(evWalk > 0.99 && evBack > 0.99, `back at 06 from the walk the evening has not started again (walk ${evWalk}, back ${evBack})`);
    ok(`default 06: lights ${ev1.toFixed(2)} after the look, ${evWalk.toFixed(2)} in the walk, ${evBack.toFixed(2)} back at 06 (before this fix: back to 0.01 and coming on a second time)`);
    await ctx.close();
  }

  // ---------------------------------------------------------------- the clock
  if (run('clock')) {
    const { page, ctx } = await open('&clock=1');
    const at = (p) => page.evaluate((v) => { const a = window.__haizHome.clock.at(v); return { label: a.label, az: a.sunAz, el: a.sunEl, evening: a.evening }; }, p);
    const rows = [];
    for (const p of [0, 1, 2, 3, 4, 5]) {
      await seek(page, p);
      const s = await sun(page), c = await at(p);
      assert(Math.abs(((s.az - c.az + 540) % 360) - 180) < 0.2 && Math.abs(s.el - c.el) < 0.2, `shot ${p}: the scene's sun ${JSON.stringify(s)} is the clock's ${JSON.stringify(c)}`);
      const slate = await page.evaluate(() => document.querySelector('.orbit .when')?.textContent || '');
      assert(slate.includes(c.label), `shot ${p}: the instant is shown (${slate})`);
      rows.push(`0${p + 1} ${c.label} ${s.az.toFixed(0)}°/${s.el.toFixed(1)}°`);
      await snap(page, `clock-0${p + 1}`);
    }
    ok('clock: at every shot the scene\'s sun is the real sun of the instant shown: ' + rows.join(' · '));
    // one take, one sun
    const film = [];
    for (const q of [0.02, 0.3, 0.6, 0.75, 0.9, 0.999]) { await seek(page, 4 + q, 0.2); film.push(await sun(page)); if (SHOTS && (q === 0.6 || q === 0.75)) await snap(page, `clock-film-${Math.round(q * 100)}`); }
    const span = Math.max(...film.map((s) => s.az)) - Math.min(...film.map((s) => s.az)), spanEl = Math.max(...film.map((s) => s.el)) - Math.min(...film.map((s) => s.el));
    assert(span < 0.3 && spanEl < 0.3, `the sun moves ${span}° / ${spanEl}° through the film`);
    ok(`clock film: through the take the sun stays within ${span.toFixed(2)}° of heading and ${spanEl.toFixed(2)}° of height (${film[0].az.toFixed(1)}°/${film[0].el.toFixed(1)}° → ${film[5].az.toFixed(1)}°/${film[5].el.toFixed(1)}°)`);
    // 06: the derived standpoint; the evening goes on while it is looked at
    await seek(page, 5, 0.3);
    await until(page, 'hold');
    const eye = await page.evaluate(() => { const h = window.__haizHome, f = h.life.film(1).cam; return [f.ex, f.ez]; });
    const last = await page.evaluate(() => window.__haizHome.clock.lastLight());
    const trunk = [0.1, 0], stand = (Math.atan2(eye[0] - trunk[0], eye[1] - trunk[1]) * 180) / Math.PI;
    assert(Math.abs(((stand - last.sunAz + 540) % 360) - 180) < 1.2, `06's eye stands on the last light's line (${stand.toFixed(1)}° vs sun ${last.sunAz.toFixed(1)}°)`);
    const seq = [];
    // six seconds of looking go by frame by frame (the clock counts the frames' own time); the later
    // moments are set on the clock directly (it is a pure function of how long 06 has been held)
    const heldNow = () => page.evaluate(() => window.__haizHome.clock.held);
    for (const [t, name] of [[0, 'clock-06-held-00'], [6, 'clock-06-held-06'], [14, 'clock-06-held-14'], [45, 'clock-06-held-45']]) {
      if (t === 6) await still(page, 6, 1);
      else if (t > 6) { await page.evaluate((v) => { window.__haizHome.clock.held = v - 0.2; }, t); await still(page, 0.2, 5); }
      const held = await heldNow();
      if (t === 6) assert(Math.abs(held - 6) < 0.6, 'six frames of one second are six seconds of looking: ' + held);
      const s = await sun(page), ev = await evening(page), label = await page.evaluate(() => window.__haizHome.clock.at(5).label);
      seq.push({ held, s, ev, label });
      await snap(page, name);
    }
    for (let i = 1; i < seq.length; i++) assert(seq[i].s.el < seq[i - 1].s.el && seq[i].ev >= seq[i - 1].ev, 'held: the sun sinks and the lights only come on');
    assert(seq[0].ev < 0.1 && seq[3].ev > 0.99 && seq[3].s.el > 4.3, 'held: from no lights to all, the sun never below the last light');
    ok('clock 06 held: ' + seq.map((x) => `${Math.round(x.held)} s ${x.label} sun ${x.s.el.toFixed(1)}° lights ${Math.round(x.ev * 100)}%`).join(' · '));
    // into the walk and back: the same evening
    await page.evaluate(() => window.__haizHome.life.handoff());
    await until(page, 'play');
    await still(page, 0.5, 10);
    const walk = { ev: await evening(page), s: await sun(page) };
    await snap(page, 'clock-walk');
    await page.evaluate(() => window.__haizHome.life.back6());
    await until(page, 'hold');
    await still(page, 0.2, 10);
    const back = { ev: await evening(page), s: await sun(page) };
    assert(walk.ev > 0.99 && back.ev > 0.99 && back.s.el <= seq[3].s.el + 0.01, `the evening went on through the walk and did not start again at 06 (${JSON.stringify([walk, back])})`);
    ok(`clock: into the walk (lights ${walk.ev.toFixed(2)}, sun ${walk.s.el.toFixed(1)}°) and back to 06 (lights ${back.ev.toFixed(2)}, sun ${back.s.el.toFixed(1)}°): one evening, never restarted`);
    // scrolled back before the last look, the film is on its own clock again; the evening is let go
    await page.evaluate(() => { const h = window.__haizHome; h.W.claim('scroll'); h.seek(4.6); });
    await still(page, 4, 1);
    const mid = await sun(page), evMid = await evening(page);
    assert(Math.abs(mid.el - film[2].el) < 0.3 && evMid === 0, `scrolled back into the film the sun is the film's again (${JSON.stringify(mid)}, lights ${evMid})`);
    assert(await page.evaluate(() => window.__haizHome.clock.held) === 0, 'the held evening is let go');
    ok('clock: scrolled back into the film, the sun is the take\'s own again and the lights are off (the held evening is let go)');
    await ctx.close();
  }

  // ---------------------------------------------------------------- phone
  if (run('phone')) {
    const { page, ctx } = await open('&clock=1', { vw: 390, vh: 844, mobile: true, quality: 'medium' });
    for (const p of [0, 5]) {
      await seek(page, p);
      const m = await page.evaluate(() => { const el = document.querySelector('.orbit .when'), r = el?.getBoundingClientRect(); return { over: document.documentElement.scrollWidth - innerWidth, r: r && [r.left, r.right, r.width], text: el?.textContent }; });
      assert(m.over <= 0, 'no sideways overflow on a phone at shot ' + p);
      assert(!m.r || m.r[2] === 0 || (m.r[0] >= 0 && m.r[1] <= 390.5), 'the instant stays on the screen: ' + JSON.stringify(m));
    }
    await until(page, 'hold');
    await still(page, 14, 1);
    const ev = await evening(page);
    assert(ev > 0.99, 'phone: the lights come on while 06 is held');
    if (SHOTS) { await page.addStyleTag({ content: HIDE }); await page.screenshot({ path: path.join(OUT, 'clock-06-phone.jpg'), type: 'jpeg', quality: 88, timeout: 240000 }); }
    ok('phone (390 × 844, clock): no sideways overflow at 01 and 06, the instant stays on the screen, the evening goes on at 06');
    await ctx.close();
  }

  // ---------------------------------------------------------------- reduced motion: the evening as it ends, at once
  if (run('reduced')) {
    const { page, ctx } = await open('&clock=1', { reduced: true, vw: 640, vh: 360 });
    await seek(page, 5);
    await until(page, 'hold');
    await still(page, 0.3, 10);
    const ev = await evening(page), s = await sun(page);
    assert(ev > 0.99 && s.el < 4.8, `reduced motion: 06 shows the evening as it ends, without the lapse (lights ${ev}, sun ${s.el}°)`);
    ok(`reduced motion (clock): 06 shows the evening as it ends at once (lights ${ev.toFixed(2)}, sun ${s.el.toFixed(1)}°), nothing animates towards it`);
    await ctx.close();
  }

  await browser.close();
  server.close();
  assert(errors.length === 0, 'page or WebGL errors:\n' + errors.join('\n'));
  ok('no page or WebGL errors');
  const file = path.join(__dirname, 'world-clock-browser-results.json');
  let prev = {}; try { prev = JSON.parse(fs.readFileSync(file, 'utf8')).runs || {}; } catch { /* first run */ }
  prev[want.filter((w) => w !== 'shots').join('+') || 'all'] = { date: new Date().toISOString(), results };
  fs.writeFileSync(file, JSON.stringify({ renderer: 'Chromium + SwiftShader (software); no GPU, no WebKit, no device', runs: prev }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
