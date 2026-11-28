// HAIZ Native · emulated phone performance bench.
// Usage: node bench.mjs <baseUrl> <label> [outDir]
// Emulates a vivo S10-class viewport (393×873 CSS px, DPR 2.75, touch) in desktop Chromium with
// 4× CPU throttling. WebGL runs on SwiftShader (software) here, so absolute GPU numbers do NOT
// represent the phone; the bench is for before/after comparison of the same scenarios.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("/opt/node22/lib/node_modules/playwright");
import { writeFileSync, mkdirSync } from "node:fs";

const [base, label = "run", outDir = "."] = process.argv.slice(2);
const CPU = Number(process.env.CPU || 4);
const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-features=Vulkan"] });
const ctx = await browser.newContext({ viewport: { width: 393, height: 873 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 13; V2130A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36" });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Performance.enable");
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.addInitScript(() => {
  const w = window;
  w.__pf = { frames: [], long: [], rec: false };
  const loop = (t) => { if (w.__pf.rec) w.__pf.frames.push(t); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (w.__pf.rec) w.__pf.long.push(e.duration); }).observe({ type: "longtask", buffered: false }); } catch {}
});

const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
const results = {};
async function scenario(name, fn) {
  await page.evaluate(() => { window.__pf.frames = []; window.__pf.long = []; window.__pf.rec = true; });
  const m0 = await metrics(); const t0 = Date.now();
  await fn();
  const m1 = await metrics(); const wall = (Date.now() - t0) / 1000;
  const pf = await page.evaluate(() => { window.__pf.rec = false; return { f: window.__pf.frames, l: window.__pf.long }; });
  const d = []; for (let i = 1; i < pf.f.length; i++) d.push(pf.f[i] - pf.f[i - 1]);
  d.sort((a, b) => a - b);
  const q = (p) => d.length ? d[Math.min(d.length - 1, Math.floor(d.length * p))] : 0;
  const span = pf.f.length > 1 ? (pf.f[pf.f.length - 1] - pf.f[0]) / 1000 : wall;
  const dropped = d.reduce((a, x) => a + Math.max(0, Math.round(x / 16.667) - 1), 0);
  const expected = Math.round(span * 60);
  const dm = (k) => +(((m1[k] ?? 0) - (m0[k] ?? 0)) * 1000).toFixed(0);
  results[name] = {
    seconds: +span.toFixed(2), fps: +(pf.f.length / span).toFixed(1), p50ms: +q(0.5).toFixed(1), p95ms: +q(0.95).toFixed(1), worstMs: +q(1).toFixed(1),
    droppedPct: +((dropped / Math.max(1, expected)) * 100).toFixed(1), longTasks: pf.l.length, longTaskMs: Math.round(pf.l.reduce((a, b) => a + b, 0)),
    scriptMs: dm("ScriptDuration"), layoutMs: dm("LayoutDuration"), styleMs: dm("RecalcStyleDuration"), taskMs: dm("TaskDuration"),
    heapMB: +(m1.JSHeapUsedSize / 1048576).toFixed(1), nodes: m1.Nodes,
  };
  console.log(name.padEnd(22), JSON.stringify(results[name]));
}
const idle = (ms) => page.waitForTimeout(ms);
const tapSel = async (sel) => { const el = page.locator(sel).first(); const b = await el.boundingBox(); if (!b) throw new Error("no " + sel); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
const scroll = async (dy, ms = 900) => cdp.send("Input.synthesizeScrollGesture", { x: 196, y: 600, yDistance: -dy, speed: Math.round(Math.abs(dy) / (ms / 1000)), gestureSourceType: "touch", repeatCount: 1 });

const t0 = Date.now();
await page.goto(base + "#/today", { waitUntil: "load" });
await page.waitForSelector(".page", { timeout: 30000 });
results.load = { loadMs: Date.now() - t0 };
await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
await idle(2500);

await scenario("today-scroll", async () => { await scroll(1600, 1200); await scroll(-1600, 1200); await scroll(1200, 800); await scroll(-1200, 800); });
await scenario("tab-switch", async () => {
  for (const id of ["study", "campus", "me", "today", "study", "today"]) { await page.evaluate((h) => { location.hash = h; }, "#/" + id); await idle(650); }
});
await scenario("search-open-close", async () => {
  for (let i = 0; i < 2; i++) { await page.evaluate(() => window.__haizStore?.set?.({ searchOpen: true })); await tapSel(".dock-sat, [aria-label='搜索']").catch(() => {}); await idle(900); await page.keyboard.press("Escape").catch(() => {}); await tapSel(".sres-x").catch(() => {}); await idle(900); }
});
await scenario("idle-2s", async () => { await idle(2200); });
await page.evaluate(() => { location.hash = "#/tree"; });
const tTree = Date.now();
await page.waitForFunction(() => document.querySelector(".tree-stage.is-ready"), null, { timeout: 120000 }).catch(() => {});
results.treeReady = { ms: Date.now() - tTree };
await scenario("tree-intro", async () => { await idle(3200); });
await scenario("tree-orbit-drag", async () => {
  const b = await page.locator(".tree-canvas").boundingBox();
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy }] });
  for (let i = 0; i < 60; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx + Math.sin(i / 9) * 120, y: cy }] }); await idle(16); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await idle(1200);
});
await scenario("tree-month-scrub", async () => {
  for (let i = 0; i <= 50; i++) { await page.evaluate((v) => window.__tree?.month(v), (i / 50) * 11.5); await idle(24); }
  await idle(1500);
});
await scenario("tree-modes", async () => { for (const m of ["ink", "clay", "lens", "real"]) { await page.evaluate((x) => window.__tree?.mode(x), m); await idle(1300); } });
await scenario("tree-idle", async () => { await idle(2500); });
await page.evaluate(() => { location.hash = "#/campus/map"; });
await idle(6000);
await scenario("map-taps", async () => {
  const c = page.locator("canvas").first(); const b = await c.boundingBox().catch(() => null);
  if (b) for (let i = 0; i < 4; i++) { await page.touchscreen.tap(b.x + b.width * (0.3 + i * 0.12), b.y + b.height * 0.5); await idle(900); }
});
await scenario("map-scroll", async () => { await scroll(900, 900); await scroll(-900, 900); });
await page.evaluate(() => { location.hash = "#/today"; });
await idle(1500);
results.final = { heapMB: +((await metrics()).JSHeapUsedSize / 1048576).toFixed(1), errors };
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/${label}.json`, JSON.stringify({ label, base, cpuThrottle: CPU, ua: "Android 13 emulated", results }, null, 2));
console.log("errors:", errors.slice(0, 5));
await browser.close();
