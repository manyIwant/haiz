// Native 003 · GPU A/B: idle and gesture frame cost under software GL (SwiftShader), so compositing,
// backdrop blur, SVG filters and masks cost CPU time we can measure. Each variant injects a CSS
// override; a probe either forces a composite every frame (like the perf panel's live graph does)
// or drives the real dock / rail.
// Usage: node perf/gpu-ab.mjs <baseUrl> <route> <scenario> [variants,comma] [out.json]
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("/opt/node22/lib/node_modules/playwright");
import fs from "node:fs";
const [base, route = "me", scenario = "idle", only, outFile] = process.argv.slice(2);
export const VARIANTS = {
  baseline: "",
  "no-backdrop": "*{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}",
  "no-filter": "*:not(.perf-g){filter:none!important}",
  "no-dock-masks": ".dock-edge mask, .dock-rim{display:none!important} .dock-edge *{mask:none!important}",
  "no-dock-glass": ".dock-glass{display:none!important}",
  "no-dock-shadow": ".dock-body{filter:none!important}",
  "no-dock": ".dock{display:none!important}",
  "no-hkb": ".hkb{display:none!important}",
  "no-hidden-glass": ".hkb,.gtog{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}",
  "no-drop-sheen": ".drop-sheen{display:none!important}",
  "no-drop-masks": ".drop-caustic,.drop-rim,.drop-edge{display:none!important}",
  "no-drop-glass": ".drop-glass{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}",
  "no-drop-shadow": ".drop-shadow{display:none!important}",
  "no-prail-shadow": ".prail-sheet{box-shadow:none!important}",
  "no-peek-blur": ".rail-peek{filter:none!important}",
  "no-shadows": "*{box-shadow:none!important;text-shadow:none!important}",
};
const names = only ? only.split(",") : Object.keys(VARIANTS);
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--enable-gpu-rasterization", "--ignore-gpu-blocklist"] });
const out = { route, scenario, env: "Chromium SwiftShader GL, 360x800 @3, CPU 4x", runs: {} };
for (const name of names) {
  const ctx = await b.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const mat = name.startsWith("mat:") ? "&mat=" + name.slice(4) : "";
  await page.goto(`${base}/index.html?demo=1${mat}#/${route}`);
  await page.waitForSelector(".dock-bay", { timeout: 60000 });
  await page.waitForTimeout(2500);
  if (VARIANTS[name] && !mat) await page.addStyleTag({ content: VARIANTS[name] });
  await page.waitForTimeout(300);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const samples = [];
  const browserCdp = await b.newBrowserCDPSession();
  const events = [];
  browserCdp.on("Tracing.dataCollected", (e) => { for (const ev of e.value) if (ev.ph === "X" || ev.ph === "M") events.push(ev); });
  await browserCdp.send("Tracing.start", { traceConfig: { includedCategories: ["toplevel", "__metadata"], recordMode: "recordContinuously" }, transferMode: "ReportEvents" });
  const t0 = Date.now();
  for (let rep = 0; rep < 3; rep++) {
    await page.evaluate((sc) => {
      const w = window; w.__f = []; let last = performance.now(); w.__stop = false;
      let cv = null, g = null;
      if (sc === "idle") { cv = document.createElement("canvas"); cv.width = 240; cv.height = 48; cv.style.cssText = "position:fixed;top:40px;right:8px;z-index:99;width:120px;height:24px"; cv.className = "perf-g"; document.body.appendChild(cv); g = cv.getContext("2d"); }
      const loop = (t) => { w.__f.push(t - last); last = t; if (g) { g.clearRect(0, 0, 240, 48); g.fillStyle = "#8be0b0"; g.fillRect((t / 10) % 240, 0, 4, 48); } if (!w.__stop) requestAnimationFrame(loop); else cv?.remove(); };
      requestAnimationFrame(loop);
    }, scenario);
    if (scenario === "idle") await page.waitForTimeout(3000);
    else if (scenario === "dock") {
      const bays = await page.$$eval(".dock-bay", (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
      for (const i of [1, 2, 3, 0, 2, 1, 3, 0]) { await page.touchscreen.tap(bays[i].x, bays[i].y); await page.waitForTimeout(350); }
      await page.waitForTimeout(400);
      await page.evaluate((r) => { location.hash = "#/" + r; }, route);
      await page.waitForTimeout(800);
    } else if (scenario === "dockscrub") {
      // press a bay and slide across the dock and back (the swell and plate follow), then cancel
      const bays = await page.$$eval(".dock-bay", (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
      const y = bays[0].y, xa = bays[0].x, xb = bays[3].x;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: xa, y }] });
      for (let i = 0; i <= 120; i++) { const u = (1 - Math.cos((i / 60) * Math.PI)) / 2; await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: xa + (xb - xa) * u, y }] }); await page.waitForTimeout(16); }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      await page.waitForTimeout(500);
    } else if (scenario === "drawer") {
      // open the drawer, scrub its list with a finger (the optical drop follows), cancel, close
      await page.click(".ptop-seal"); await page.waitForTimeout(900);
      const rows = await page.$$eval(".rail--drawer [data-rail]", (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + 40, y: r.top + r.height / 2 }; }));
      const a = rows[1], z = rows[Math.min(rows.length - 1, 7)];
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y }] });
      for (let i = 0; i <= 120; i++) { const u = (1 - Math.cos((i / 60) * Math.PI)) / 2; await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a.x, y: a.y + (z.y - a.y) * u }] }); await page.waitForTimeout(16); }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      await page.waitForTimeout(400);
      await page.click(".prail-scrim", { position: { x: 340, y: 400 } }).catch(() => {}); await page.waitForTimeout(900);
    } else if (scenario === "scroll") {
      for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, i % 2 ? -500 : 500); await page.waitForTimeout(400); }
    }
    const f = await page.evaluate(() => { window.__stop = true; return window.__f.slice(2); });
    samples.push(f);
    await page.waitForTimeout(300);
  }
  const wall = (Date.now() - t0) / 1000;
  const done = new Promise((r) => browserCdp.once("Tracing.tracingComplete", r));
  await browserCdp.send("Tracing.end"); await done;
  const tname = new Map();
  for (const ev of events) if (ev.ph === "M" && ev.name === "thread_name") tname.set(ev.pid + ":" + ev.tid, ev.args.name);
  const busy = {};
  for (const ev of events) if (ev.ph === "X" && ev.dur && /RunTask/.test(ev.name)) { const n = (tname.get(ev.pid + ":" + ev.tid) || "?").replace(/\d+$/, "#"); busy[n] = (busy[n] || 0) + ev.dur / 1000; }
  const per = Object.fromEntries(Object.entries(busy).map(([k, v]) => [k, +(v / wall).toFixed(1)]).sort((a, b) => b[1] - a[1]).slice(0, 8));
  const all = samples.flat(); const s = [...all].sort((a, b) => a - b);
  const q = (p) => +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1);
  out.runs[name] = { frames: all.length, fps: +(1000 / (all.reduce((a, b) => a + b, 0) / all.length)).toFixed(1), p50: q(0.5), p95: q(0.95), worst: q(0.999), dropped: +(100 * all.filter((x) => x > 25).length / all.length).toFixed(1), busyMsPerS: per, gpuish: +Object.entries(per).filter(([k]) => /Gpu|Viz|Compositor|Raster/i.test(k)).reduce((a, [, v]) => a + v, 0).toFixed(1) };
  console.log(name, JSON.stringify(out.runs[name]));
  await ctx.close();
}
if (outFile) fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
await b.close();
