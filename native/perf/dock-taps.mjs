// Native 002 · dock tap bench: taps the phone dock like a finger and measures the dock's own frames
// (rAF intervals, dropped frames, long tasks) and how long until the tapped bay shows as selected.
// Usage: node dock-taps.mjs <baseUrl> <label> [outDir]
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("/opt/node22/lib/node_modules/playwright");
import fs from "node:fs";
const [base, label = "run", outDir = "."] = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 873 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await page.goto(base + "/?demo=1#/today");
await page.waitForSelector(".dock-bay", { timeout: 60000 });
await page.waitForTimeout(4000);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await page.evaluate(() => {
  const w = window; w.__f = []; w.__lt = [];
  let last = performance.now();
  const loop = (t) => { w.__f.push(t - last); last = t; requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__lt.push(e.duration); }).observe({ type: "longtask", buffered: false });
});
const bays = await page.$$eval(".dock-bay", (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: e.getAttribute("aria-label") }; }));
const order = ["学习", "校园", "我", "今日", "学习", "今日", "校园", "我", "今日"];
async function tap(lbl) {
  const p = bays.find((x) => x.label === lbl);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const t0 = Date.now();
  // selected = the bay carries is-active
  await page.waitForFunction((l) => document.querySelector(`.dock-bay[aria-label="${l}"]`)?.classList.contains("is-active"), lbl, { timeout: 5000, polling: "raf" }).catch(() => {});
  return Date.now() - t0;
}
const res = {};
for (const [name, gap] of [["taps-600ms", 600], ["taps-rapid-150ms", 150]]) {
  await page.evaluate(() => { window.__f = []; window.__lt = []; });
  const sel = [];
  for (const l of order) { sel.push(await tap(l)); await page.waitForTimeout(gap); }
  await page.waitForTimeout(800);
  const { f, lt } = await page.evaluate(() => ({ f: window.__f.slice(1), lt: window.__lt }));
  const s = [...f].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  res[name] = {
    frames: f.length, fps: +(1000 / (f.reduce((a, b) => a + b, 0) / f.length)).toFixed(1),
    p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), worst: +s[s.length - 1].toFixed(1),
    dropped: +(100 * f.filter((x) => x > 25).length / f.length).toFixed(1),
    longTasks: lt.length, longTaskMs: Math.round(lt.reduce((a, b) => a + b, 0)),
    selectMsMedian: [...sel].sort((a, b) => a - b)[Math.floor(sel.length / 2)], selectMsMax: Math.max(...sel),
  };
}
const dockH = await page.evaluate(() => document.querySelector(".dock")?.getBoundingClientRect().height);
const out = { label, date: new Date().toISOString(), env: "Playwright Chromium, 393x873 @2.75, CPU 4x", dockLayerHeight: dockH, ...res };
fs.writeFileSync(`${outDir}/dock-${label}.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await b.close();
