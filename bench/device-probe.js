// HAIZ homepage frame-time probe for a REAL phone.
//
// How to use (no build, nothing added to the page itself):
//   1. Serve the branch on your LAN (e.g. `npx http-server -p 8080` in the repo)
//      and open http://<computer-ip>:8080/index.html on the phone. Let it load.
//      (Or open haiz.space to measure the live version for comparison.)
//   2. Attach remote devtools: iPhone → Safari ▸ Develop ▸ <phone> ▸ the page;
//      Android → chrome://inspect on the computer.
//   3. Paste this whole file into the console. It walks the six chapters twice
//      with the page's own animation loop running (real frames, real GPU) and
//      prints one JSON report. It takes about (6 × (warm + seconds)) × rounds.
//
// Options: run `haizProbe({ seconds: 8, warm: 2, rounds: 2 })` again to repeat.
// The report holds per chapter and round: frame-interval p50 / p95 / max (ms),
// achieved fps, long frames (> 50 ms), renderer pixel ratio at the end (the page
// lowers it by itself when frames are slow: a drop is a sign of struggle), draw
// calls and triangles of one frame, and JS heap where the browser exposes it.
// Compare round 2 with round 1: a slower second round with the same views is
// the usual sign of thermal throttling. Note the phone model, OS, browser,
// battery level and whether it was charging next to the numbers.
(function () {
  const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(1) : null; };
  const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
  async function measure(seconds) {
    const iv = [];
    let last = performance.now();
    const end = last + seconds * 1000;
    await new Promise((done) => {
      requestAnimationFrame(function f(now) {
        iv.push(now - last); last = now;
        if (now < end) requestAnimationFrame(f); else done();
      });
    });
    iv.shift();
    return iv;
  }
  window.haizProbe = async function ({ seconds = 8, warm = 2, rounds = 2 } = {}) {
    const H = window.__haizHome;
    if (!H || !H.world) throw new Error('open the HAIZ homepage and wait until the tree is drawn');
    const w = H.world, r = w.renderer;
    const info = H.info();
    const report = {
      url: location.href, ua: navigator.userAgent, date: new Date().toISOString(),
      screen: [screen.width, screen.height, devicePixelRatio], tier: info.tier, mobileTouch: info.mobileTouch,
      gpu: (() => { try { const gl = r.getContext(), d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch { return null; } })(),
      settings: { seconds, warm, rounds }, rows: []
    };
    H.freeze(true);
    const t0 = performance.now();
    for (let round = 1; round <= rounds; round++) {
      for (let i = 0; i < 6; i++) {
        H.go(i);
        await wait(warm * 1000);
        const iv = await measure(seconds);
        r.info.autoReset = false; r.info.reset();
        await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
        const calls = r.info.render.calls, tris = r.info.render.triangles;
        r.info.autoReset = true;
        const row = { round, chapter: i + 1, atSeconds: Math.round((performance.now() - t0) / 1000), frames: iv.length,
          p50: pct(iv, 0.5), p95: pct(iv, 0.95), max: pct(iv, 1), fps: +(1000 * iv.length / iv.reduce((a, b) => a + b, 0)).toFixed(1),
          longFrames: iv.filter((x) => x > 50).length, pixelRatio: +r.getPixelRatio().toFixed(2), drawCallsOverTwoFrames: calls, trianglesOverTwoFrames: tris,
          jsHeapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null };
        report.rows.push(row);
        console.log(`round ${round} ch${i + 1}: p50 ${row.p50} ms · p95 ${row.p95} ms · ${row.fps} fps · ratio ${row.pixelRatio}`);
      }
    }
    H.freeze(false);
    const byRound = (k) => report.rows.filter((x) => x.round === k).map((x) => x.p50);
    if (rounds > 1) report.secondRoundP50Change = byRound(rounds).map((v, i) => +(((v - byRound(1)[i]) / byRound(1)[i]) * 100).toFixed(1) + '%');
    window.__haizProbeReport = report;
    console.log(JSON.stringify(report, null, 2));
    return report;
  };
  console.log('haizProbe ready: running with defaults (about ' + (6 * 10 * 2) + ' s). Keep the screen on.');
  return window.haizProbe();
})();
