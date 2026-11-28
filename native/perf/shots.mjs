// Native 003 · visual A/B: screenshots of the dock, the header and the open drawer, light and dark,
// so a material change can be compared pixel by pixel with the build before it.
// Usage: node perf/shots.mjs <baseUrl> <outDir>
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("/opt/node22/lib/node_modules/playwright");
import fs from "node:fs";
const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
for (const scheme of ["light", "dark"]) {
  const ctx = await b.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(`${base}/index.html?demo=1#/today`);
  await page.waitForSelector(".dock-bay", { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/dock-${scheme}.png`, clip: { x: 0, y: 640, width: 360, height: 160 } });
  await page.mouse.wheel(0, 400); await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/top-${scheme}.png`, clip: { x: 0, y: 0, width: 360, height: 90 } });
  await page.click(".ptop-seal"); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/drawer-${scheme}.png` });
  const cdp = await ctx.newCDPSession(page);
  const r = await page.$$eval(".rail--drawer [data-rail]", (els) => { const e = els[3].getBoundingClientRect(); return { x: e.left + 40, y: e.top + e.height / 2 }; });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: r.x, y: r.y }] });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/drop-${scheme}.png`, clip: { x: 0, y: Math.max(0, r.y - 120), width: 360, height: 240 } });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await ctx.close();
}
await b.close();
