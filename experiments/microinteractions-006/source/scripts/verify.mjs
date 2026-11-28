// Real-browser acceptance for the BUILT preview (experiments/microinteractions-006/).
// Serves the folder locally, drives Chromium through the product's main flows on desk and phone,
// and writes ../VERIFICATION.md. Run after `npm run build`:  npm run verify
//
// What it checks: every route renders without console errors; the motion clock sleeps when idle;
// dock pass/dwell/enter; lens search; list → detail; teacher publish reaching the student side;
// focus mode turning the dock into controls; reduced motion landing instantly; the bench driving 004.
// Frame timings come from headless Chromium on a CI-class machine — useful for regressions and
// relative cost, not a promise about any particular phone.
import { createServer } from "node:http";
import { readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node-tools/node_modules/playwright")); }

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".bin": "application/octet-stream", ".md": "text/markdown" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const f = join(root, p);
    if (!f.startsWith(root)) throw new Error("outside");
    await stat(f);
    res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" });
    res.end(await readFile(f));
  } catch { res.writeHead(404); res.end("not found"); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const ROUTES = ["today", "study", "focus", "schedule", "growth", "campus/notice", "campus/club", "campus/map", "campus/culture", "rings", "tree", "wander", "me", "teacher"];
const rows = [];
const fails = [];
const ok = (name, pass, detail = "") => { rows.push({ name, pass, detail }); if (!pass) fails.push(name); console.log(`${pass ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`); };
const ignorable = (t) => /ERR_TUNNEL|ERR_PROXY|net::ERR_|Failed to load resource/.test(t); // offline sandboxes: external CDNs used only by the OJO reference

// A Playwright resolved from a parent folder may expect a browser build that is not
// installed; fall back to a system Chromium (PLAYWRIGHT_CHROMIUM, or the sandbox's).
// Two browsers: the plain one measures frame intervals as 005 did; the 3D pages get WebGL from
// SwiftShader in a second one (software GL slows the compositor, so it never times the dock).
const GL = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const launch = (args) => chromium.launch({ args }).catch((e) => {
  const exe = process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium";
  if (!existsSync(exe)) throw e;
  return chromium.launch({ executablePath: exe, args });
});
const browser = await launch([]);
const glBrowser = await launch(GL);

async function page(ctxOpts, gl = false) {
  const ctx = await (gl ? glBrowser : browser).newContext(ctxOpts);
  const p = await ctx.newPage();
  const errors = [];
  p.on("console", (m) => { if (m.type() === "error" && !ignorable(m.text())) errors.push(m.text()); });
  p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  return { ctx, p, errors };
}
const idleFrames = (p, ms = 2000) => p.evaluate((ms) => new Promise((r) => { const c = window.__haizClock; const f0 = c.frame; setTimeout(() => r(c.frame - f0), ms); }), ms);
const frameStats = (p, ms) => p.evaluate((ms) => new Promise((r) => {
  const d = []; let last = performance.now(); const t0 = last; let work = 0;
  const off = window.__haizClock.onTelemetry((t) => { work = Math.max(work, t.frameMs); });
  const loop = (t) => { d.push(t - last); last = t; if (t - t0 < ms) requestAnimationFrame(loop); else { off(); d.sort((a, b) => a - b); r({ n: d.length, p50: d[Math.floor(d.length / 2)], p95: d[Math.floor(d.length * 0.95)], maxWork: work }); } };
  requestAnimationFrame(loop);
}), ms);

/* ---------- 1. every route, desk and phone ---------- */
for (const [label, opts] of [["桌面 1440×900", { viewport: { width: 1440, height: 900 } }], ["手机 390×844", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const { ctx, p, errors } = await page(opts, true);
  await p.goto(BASE + "index.html#/today");
  await p.waitForTimeout(1200);
  const bad = [];
  for (const r of ROUTES) {
    await p.evaluate((r) => { location.hash = "#/" + r; }, r);
    const shown = await p.waitForFunction((r) => location.hash === "#/" + r && (() => { const el = document.querySelector(".page h1, .page .focus-time"); return !!el && el.getBoundingClientRect().height > 0; })(), r, { timeout: 5000 }).then(() => true).catch(() => false);
    await p.waitForTimeout(400);
    if (!shown) bad.push(r);
  }
  ok(`${label}：14 个页面全部渲染`, bad.length === 0, bad.length ? "未渲染：" + bad.join("、") : "");
  await p.evaluate(() => { location.hash = "#/today"; });
  await p.waitForTimeout(2500);
  const f = await idleFrames(p);
  ok(`${label}：空闲 2 秒时钟休眠`, f <= 1, `时钟走了 ${f} 帧`);
  ok(`${label}：控制台无错误`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

/* ---------- 2. desk interactions ---------- */
{
  const { ctx, p, errors } = await page({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE + "index.html#/today");
  await p.waitForTimeout(1500);
  // dock: sweep across the bays, then dwell on the first one
  const bays = await p.$$eval(".dock-desk .dock-bay, .dock .dock-bay", (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }));
  if (bays.length) {
    const [x0, y] = bays[0], x1 = bays[bays.length - 1][0];
    const statsP = frameStats(p, 1400);
    for (let k = 0; k <= 40; k++) { await p.mouse.move(x0 - 30 + ((x1 - x0 + 60) * k) / 40, y); await p.waitForTimeout(16); }
    for (let k = 40; k >= 0; k--) { await p.mouse.move(x0 - 30 + ((x1 - x0 + 60) * k) / 40, y); await p.waitForTimeout(8); }
    const st = await statsP;
    ok("Dock 掠过：每帧脚本工作 < 8 ms", st.maxWork < 8, `帧间隔 p50 ${st.p50.toFixed(1)} ms · p95 ${st.p95.toFixed(1)} ms · 单帧最大工作 ${st.maxWork.toFixed(2)} ms（${st.n} 帧；帧间隔受无头 Chromium 软件合成和机器负载影响，只作参考）`);
    await p.mouse.move(bays[0][0], y); await p.waitForTimeout(700);
    const q = await p.evaluate(() => Math.max(...[...document.querySelectorAll(".dock-stage-in")].map((e) => parseFloat(getComputedStyle(e).getPropertyValue("--q")) || 0)));
    ok("Dock 停：停留 280ms 后舞台从轮廓长出", q > 0.5, `舞台展开度 ${q.toFixed(2)}`);
    await p.mouse.move(700, 300); await p.waitForTimeout(800);
  } else ok("Dock 掠过", false, "没有找到 Dock");
  // lens search
  await p.mouse.click(700, 400); // focus the page, not a field
  await p.keyboard.press("/");
  await p.waitForTimeout(600);
  await p.keyboard.type("物理");
  await p.waitForTimeout(500);
  const hits = await p.$$eval(".lens-row", (e) => e.length);
  ok("全局搜索：⌘K / “/” 打开，输入即出结果", hits > 0, `${hits} 条结果`);
  await p.keyboard.press("Escape"); await p.waitForTimeout(600);
  // list → detail
  await p.click(".nrow");
  await p.waitForTimeout(900);
  const insp = await p.evaluate(() => { const el = document.querySelector(".insp"); return el?.getAttribute("aria-hidden") === "false"; });
  ok("列表 → 详情：通知在右侧检查器打开，页面让出宽度", insp);
  await p.keyboard.press("Escape"); await p.waitForTimeout(800);
  // teacher publish → student today
  await p.evaluate(() => { location.hash = "#/teacher"; }); await p.waitForTimeout(1000);
  await p.fill(".tw-form input.fld-in", "验收测试：周五下午班会改到 16:10");
  await p.click(".tw-acts .btn--pri"); await p.waitForTimeout(400);
  await p.evaluate(() => { location.hash = "#/today"; }); await p.waitForTimeout(1000);
  const seen = await p.evaluate(() => document.body.innerText.includes("验收测试：周五下午班会改到 16:10"));
  ok("教师发布 → 学生「今日」立即出现", seen);
  // focus: the product yields
  await p.evaluate(() => { location.hash = "#/focus"; }); await p.waitForTimeout(1000);
  await p.click(".focus-ctl .btn--pri"); await p.waitForTimeout(1200);
  const focusing = await p.evaluate(() => ({ cls: document.querySelector(".app")?.classList.contains("is-focusing"), bays: document.querySelectorAll(".dock .dock-bay").length, timer: !!document.querySelector(".dock-bay--text") }));
  ok("专注：侧栏与顶栏退后，Dock 变成计时器控制", !!focusing.cls && focusing.timer, `is-focusing=${focusing.cls} · 控制位 ${focusing.bays}`);
  ok("桌面交互流程：控制台无错误", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

/* ---------- 3. phone: tap navigation, sheet ---------- */
{
  const { ctx, p, errors } = await page({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await p.goto(BASE + "index.html#/today"); await p.waitForTimeout(1500);
  const bays = await p.$$(".dock .dock-bay");
  if (bays.length >= 2) {
    const b = await bays[1].boundingBox();
    await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await p.waitForTimeout(1200);
    ok("手机：点按 Dock 切换页面", (await p.evaluate(() => location.hash)).includes("study"));
  } else ok("手机：点按 Dock 切换页面", false, "没有找到 Dock");
  await p.evaluate(() => { location.hash = "#/today"; }); await p.waitForTimeout(1000);
  const row = await p.$(".nrow");
  if (row) { await row.scrollIntoViewIfNeeded(); await p.waitForTimeout(400); const r = await row.boundingBox(); await p.touchscreen.tap(r.x + 40, r.y + r.height / 2); await p.waitForTimeout(1000); }
  const sheet = await p.evaluate(() => document.querySelector(".psheet")?.getAttribute("aria-hidden") === "false");
  ok("手机：列表行变成底部抽屉（容器变换）", sheet);
  ok("手机交互流程：控制台无错误", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

/* ---------- 4. reduced motion ---------- */
{
  const { ctx, p } = await page({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await p.goto(BASE + "index.html#/today"); await p.waitForTimeout(1200);
  const r = await p.evaluate(() => ({ ts: getComputedStyle(document.documentElement).getPropertyValue("--ts").trim(), i: window.__haizClock.intensity }));
  ok("减少动态效果：系统设置生效，所有动效立即落定", r.i === 0 && r.ts === "1000", `intensity=${r.i} · --ts=${r.ts}`);
  await ctx.close();
}

/* ---------- 5. the bench drives 004 ---------- */
{
  const { ctx, p, errors } = await page({ viewport: { width: 1440, height: 1000 } });
  await p.goto(BASE + "bench.html"); await p.waitForTimeout(2500);
  const has4 = await p.evaluate(() => !!document.querySelector(".b-frame--004 iframe")?.contentWindow?.__HAIZ_LAB4__);
  ok("验收台：004 原页面已载入并可被驱动", has4);
  await p.click("text=0.35×"); await p.waitForTimeout(200);
  const sc = await p.evaluate(() => ({ a: window.__haizClock.scale, b: document.querySelector(".b-frame--004 iframe").contentWindow.__HAIZ_LAB4__.clock.getState().scale }));
  ok("验收台：同一时间控制同时作用于 004 与 005", Math.abs(sc.a - 0.35) < 1e-6 && Math.abs(sc.b - 0.35) < 1e-6, `005 ${sc.a}× · 004 ${sc.b}×`);
  await p.click("text=1×"); await p.click("text=平滑顺扫"); await p.waitForTimeout(2500);
  ok("验收台：控制台无错误", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

/* ---------- 6. the 006 acceptance list ---------- */
{
  // 6.1 the timeline's now-line at 23:40 sits after the last lesson, not between 1 and 2
  const { ctx, p, errors } = await page({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE + "index.html?now=2026-11-26T23:40#/today"); await p.waitForTimeout(1600);
  const tl = await p.evaluate(() => {
    const ol = document.querySelector(".tl"), now = document.querySelector(".tl-now"), rows = [...document.querySelectorAll(".tl-row")];
    if (!ol || !now || rows.length < 2) return null;
    const o = ol.getBoundingClientRect(), n = now.getBoundingClientRect(), last = rows[rows.length - 1].getBoundingClientRect(), second = rows[1].getBoundingClientRect();
    return { now: n.top - o.top, lastBottom: last.bottom - o.top, second: second.top - o.top };
  });
  ok("时间线：23:40 的“现在”线落在最后一节之后", !!tl && tl.now >= tl.lastBottom - 2, tl ? `现在线 ${tl.now.toFixed(0)}px · 最后一节底边 ${tl.lastBottom.toFixed(0)}px · 第二节顶边 ${tl.second.toFixed(0)}px` : "没有找到时间线");

  // 6.2 the detail panel yields: the column narrows by the inspector's width
  const w0 = await p.evaluate(() => document.querySelector(".app-main").getBoundingClientRect().width);
  await p.click(".nrow"); await p.waitForTimeout(1100);
  const w1 = await p.evaluate(() => document.querySelector(".app-main").getBoundingClientRect().width);
  ok("详情面板：打开时主栏让出宽度", w0 - w1 > 300, `主栏 ${w0.toFixed(0)} → ${w1.toFixed(0)} px`);
  await p.keyboard.press("Escape"); await p.waitForTimeout(900);
  const w2 = await p.evaluate(() => document.querySelector(".app-main").getBoundingClientRect().width);
  ok("详情面板：关闭后主栏回到原宽", Math.abs(w2 - w0) < 2, `${w2.toFixed(0)} px`);

  // 6.3 rail: no native tooltips; hovering grows the liquid drop beside the entry
  const titles = await p.$$eval(".rail-i[title]", (e) => e.length);
  const ri = await p.$$(".rail-i");
  await ri[3].hover(); await p.waitForTimeout(700);
  const drop = await p.evaluate(() => { const g = document.querySelector(".rail-liquid .drop-glass"); return g ? (g.style.clipPath || getComputedStyle(g).clipPath || "").length : 0; });
  const iconCovered = await p.evaluate(() => { const i = document.querySelectorAll(".rail-i")[3].querySelector(".ico")?.getBoundingClientRect(); const l = document.querySelector(".rail-liquid")?.getBoundingClientRect(); return i && l ? l.left < i.right - 1 : true; });
  ok("侧栏：没有原生 tooltip，液滴从条目旁长出且不压住图标", titles === 0 && drop > 20 && !iconCovered, `title 属性 ${titles} · 液滴轮廓 ${drop} 字符 · 压住图标 ${iconCovered}`);

  // 6.4 the hand's light lands on the control under it
  await p.hover(".bar-field"); await p.waitForTimeout(250);
  const lit = await p.evaluate(() => document.querySelector(".bar-field").classList.contains("is-lit"));
  ok("全局：指针下的控件被照亮（随手的光）", lit);

  // 6.5 theme spreads from the touch (View Transitions) and lands on the other theme
  const t0 = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));
  const vt = await p.evaluate(() => typeof document.startViewTransition === "function");
  await p.click(".bar-btn[aria-label^='切换到']"); await p.waitForTimeout(1100);
  const t1 = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));
  ok("主题：从点击处扩散切换", t1 !== t0 && !!t1, `${t0 ?? "system"} → ${t1} · View Transitions ${vt ? "可用" : "不可用（直接切换）"}`);
  await p.click(".bar-btn[aria-label^='切换到']"); await p.waitForTimeout(1100);
  ok("006 桌面检查：控制台无错误", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}
{
  // 6.6 榄仁: the real tree, its year on the slider
  const { ctx, p, errors } = await page({ viewport: { width: 1440, height: 900 } }, true);
  await p.goto(BASE + "index.html#/tree");
  await p.waitForFunction(() => window.__tree?.ctrl?.leafCount > 0, null, { timeout: 60000 }).catch(() => {});
  const t = await p.evaluate(() => ({ leaves: window.__tree?.ctrl?.leafCount ?? 0 }));
  ok("榄仁：真实 tree.glb 与叶簇载入", t.leaves > 10000, `${t.leaves.toLocaleString()} 片叶`);
  const labels = [];
  for (const m of [1.6, 2.4, 6.5, 10.8]) { await p.evaluate((m) => window.__tree.month(m), m); await p.waitForTimeout(500); labels.push(await p.evaluate(() => document.querySelector(".tree-phase span")?.textContent)); }
  ok("榄仁：月份滑块驱动物候", new Set(labels).size >= 3, labels.join(" → "));
  await p.evaluate(() => window.__tree.mode("ink")); await p.waitForTimeout(1800);
  const rv = await p.evaluate(() => window.__tree.stage.reveal);
  ok("榄仁：线稿 / 白模 / 实景同源切换", rv < 0.05, `切到线稿后 reveal ${rv.toFixed(2)}`);
  ok("榄仁：控制台无错误", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}
{
  // 6.7 the campus map: real models, a list item develops its building
  const { ctx, p, errors } = await page({ viewport: { width: 1440, height: 900 } }, true);
  await p.goto(BASE + "index.html#/campus/map");
  await p.waitForSelector(".cmap3.is-ready", { timeout: 60000 }).catch(() => {});
  const ready = await p.evaluate(() => !!document.querySelector(".cmap3.is-ready"));
  ok("地图：真实建筑模型载入（architecture.glb）", ready);
  await p.hover(".bl >> text=一号教学楼"); await p.waitForTimeout(900);
  const chip = await p.evaluate(() => { const c = document.querySelector(".cmap3-chip"); return c?.classList.contains("is-on") ? c.textContent : null; });
  ok("地图：列表悬停让对应建筑显影并标注", !!chip && chip.includes("一号教学楼"), chip ?? "");
  ok("地图：控制台无错误", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}
{
  // 6.8 入画: the first frame never shows the painting over an undecoded render
  const { ctx, p, errors } = await page({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE + "index.html#/wander", { waitUntil: "commit" });
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    seen.add(await p.evaluate(() => { const b = document.querySelector(".wander-base"), l = document.querySelector(".loupe-in img"); const ok = (x) => !!x && x.complete && x.naturalWidth > 0; return `${ok(b)}/${ok(l)}`; }).catch(() => "-"));
    await p.waitForTimeout(60);
  }
  const bad = [...seen].filter((s) => s === "false/true" || s === "true/false");
  ok("入画：首次进入两张图同时解码后才出现", bad.length === 0 && seen.has("true/true"), [...seen].join(" "));
  const views = await p.$$eval(".wander .seg-o", (e) => e.length);
  const door = await p.evaluate(() => !!document.querySelector(".wander-enter"));
  ok("入画：五个画面与「走进画中」入口", views === 5 && door, `${views} 个画面`);
  ok("入画：控制台无错误", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
await glBrowser.close();
server.close();

const date = new Date().toISOString().slice(0, 10);
const md = `# Experiment 006 · 浏览器验收记录

自动生成：\`npm run verify\`（Playwright · Chromium ${browser.version?.() ?? ""}），${date}。对象是构建后的预览目录，本地静态服务。

| 结果 | 检查 | 细节 |
| --- | --- | --- |
${rows.map((r) => `| ${r.pass ? "通过" : "**未通过**"} | ${r.name} | ${r.detail.replace(/\|/g, "\\|")} |`).join("\n")}

${fails.length ? `**${fails.length} 项未通过。**` : "全部通过。"}

说明：三维页面在无头 Chromium 里用 SwiftShader 软件渲染，所以只检查载入与状态，不统计它们的帧时间。帧间隔来自无头 Chromium，适合发现回归和比较相对开销，不代表任何具体手机上的表现。OJO 参考页依赖外部图标库，离线环境下它的请求失败不计入错误。
`;
await writeFile(join(root, "VERIFICATION.md"), md);
console.log(`\n${rows.length - fails.length}/${rows.length} passed → VERIFICATION.md`);
process.exit(fails.length ? 1 : 0);
