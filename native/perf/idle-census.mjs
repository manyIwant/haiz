// Native 003 · idle census: what keeps rendering while the user is looking at a still page?
// Visits a page, then tours other tabs and returns, and each time records for 3 s of idle:
// rAF callbacks/s (wrapped), running Web Animations (and their targets), style recalcs / layouts /
// paints per second (CDP Performance metrics), compositor layer count and area, and elements that
// carry backdrop-filter / filter / will-change with their areas.
// Usage: node perf/idle-census.mjs <baseUrl> [outFile]
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("/opt/node22/lib/node_modules/playwright");
import fs from "node:fs";
const [base, outFile] = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.addInitScript(() => {
  const w = window; w.__raf = 0; w.__rafBy = new Map();
  const orig = w.requestAnimationFrame.bind(w);
  w.requestAnimationFrame = (cb) => { w.__raf++; const k = (new Error().stack || "").split("\n")[2]?.trim().slice(0, 140) || "?"; w.__rafBy.set(k, (w.__rafBy.get(k) || 0) + 1); return orig(cb); };
});
const cdp = await ctx.newCDPSession(page);
await cdp.send("Performance.enable");
await cdp.send("LayerTree.enable");
let layers = [];
cdp.on("LayerTree.layerTreeDidChange", (e) => { if (e.layers) layers = e.layers; });
await page.goto(base + "/index.html?demo=1#/me");
await page.waitForSelector(".page", { timeout: 60000 });
await page.waitForTimeout(3000);
const metric = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
async function census(tag) {
  await page.evaluate(() => { window.__raf = 0; window.__rafBy = new Map(); });
  const m0 = await metric();
  await page.waitForTimeout(3000);
  const m1 = await metric();
  const d = (k) => +((m1[k] - m0[k]) / 3).toFixed(2);
  const dom = await page.evaluate(() => {
    const anims = document.getAnimations().filter((a) => a.playState === "running");
    const desc = (el) => el ? (el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : "")) : "?";
    const byTarget = {};
    for (const a of anims) { const t = desc(a.effect?.target) + " :: " + (a.animationName || a.transitionProperty || a.constructor.name); byTarget[t] = (byTarget[t] || 0) + 1; }
    const fx = [];
    for (const el of document.querySelectorAll("*")) {
      const s = getComputedStyle(el);
      const bf = s.backdropFilter && s.backdropFilter !== "none" ? s.backdropFilter : "";
      const f = s.filter && s.filter !== "none" ? s.filter : "";
      const wc = s.willChange && s.willChange !== "auto" ? s.willChange : "";
      if (!bf && !f && !wc) continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height < 1) continue;
      const vis = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
      fx.push({ el: desc(el), area: Math.round(r.width * r.height), vis, bf: bf.slice(0, 80), f: f.slice(0, 80), wc });
    }
    fx.sort((a, b) => b.area - a.area);
    return { raf: window.__raf / 3, rafBy: [...window.__rafBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8), running: anims.length, byTarget, fx: fx.slice(0, 25), fxCount: fx.length, nodes: document.getElementsByTagName("*").length, route: location.hash };
  });
  const area = layers.filter((l) => l.drawsContent).reduce((a, l) => a + l.width * l.height, 0);
  const r = { tag, ...dom, recalcPerS: d("RecalcStyleCount"), layoutPerS: d("LayoutCount"), taskMsPerS: +(d("TaskDuration") * 1000).toFixed(1), scriptMsPerS: +(d("ScriptDuration") * 1000).toFixed(1), layers: layers.length, drawingLayers: layers.filter((l) => l.drawsContent).length, layerAreaVP: +(area / (360 * 800)).toFixed(2) };
  return r;
}
const tap = async (label) => { await page.click(`.dock-bay[aria-label="${label}"]`).catch(async () => { await page.evaluate((l) => { location.hash = l; }, label); }); await page.waitForTimeout(1500); };
const out = [];
out.push(await census("me-fresh"));
for (const l of ["学习", "今日", "校园", "我"]) await tap(l);
out.push(await census("me-after-tour"));
await tap("今日"); out.push(await census("today"));
await tap("学习"); out.push(await census("study"));
await tap("校园"); out.push(await census("campus"));
const res = JSON.stringify(out, null, 1);
if (outFile) fs.writeFileSync(outFile, res);
console.log(res);
await b.close();
