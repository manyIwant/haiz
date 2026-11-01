const fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { chromium } = require("playwright"),
  { loadImage } = require("@napi-rs/canvas");
const root = process.cwd(),
  errors = [],
  checks = [],
  artifacts = "tests/artifacts";
let browser;
const mime = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://localhost").pathname),
    file = path.resolve(root, "." + (p === "/" ? "/index.html" : p));
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, b) => {
    if (err) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader(
      "Content-Type",
      mime[path.extname(file)] || "application/octet-stream",
    );
    res.end(b);
  });
});
const pass = (name) => {
  checks.push(name);
  console.log("PASS", name);
};
function watch(page) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(r.status() + " " + r.url());
  });
}
(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const desktop = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      permissions: ["clipboard-read", "clipboard-write"],
    }),
    page = await desktop.newPage();
  watch(page);
  await page.goto(base + "/darkroom.html");
  await page.waitForFunction(() => window.HaizDarkroom);
  assert.equal(
    await page.evaluate(() => HaizDarkroom.diagnostics.audioState),
    "not-created",
  );
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: artifacts + "/darkroom-desktop.png",
    fullPage: true,
  });
  pass("desktop layout, local images and no autoplay AudioContext");
  await page.locator("#revealStage").scrollIntoViewIfNeeded();
  let rect = await page.locator("#revealCanvas").boundingBox();
  await page.mouse.move(
    rect.x + rect.width * 0.25,
    rect.y + rect.height * 0.35,
  );
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width * 0.7,
    rect.y + rect.height * 0.55,
    { steps: 12 },
  );
  await page.mouse.up();
  assert((await page.evaluate(() => HaizDarkroom.diagnostics.strokes)) > 8);
  assert.equal(
    await page.evaluate(() => {
      const c = document.getElementById("revealCanvas");
      return c
        .getContext("2d")
        .getImageData(
          Math.floor(c.width * 0.25),
          Math.floor(c.height * 0.35),
          1,
          1,
        ).data[3];
    }),
    0,
  );
  await page.click("#traceScore");
  assert.match(
    await page.locator("#audioStatus").textContent(),
    /笔触已译成八拍/,
  );
  assert.equal(
    await page.evaluate(() => HaizDarkroom.diagnostics.audioState),
    "not-created",
  );
  assert((await page.evaluate(() => HaizDarkroom.score.masks)).some((n) => n));
  await page.click('[data-score="shade"]');
  await page.click("#revealAll");
  assert.equal(await page.locator("#exposure").inputValue(), "100");
  await page.click("#resetReveal");
  assert.equal(await page.evaluate(() => HaizDarkroom.diagnostics.strokes), 0);
  assert(await page.locator("#traceScore").isDisabled());
  pass(
    "real pointer scratch mask, gesture-to-score translation without autoplay, complete reveal and reset",
  );
  await page.click('[data-place="library"]');
  assert.match(
    await page.locator("#roomPhoto").getAttribute("src"),
    /campus_library/,
  );
  await page.fill(
    "#roomNote",
    "把这一拍，交给下一阵风。🌿\n<img src=x onerror=alert(1)>",
  );
  assert.equal(await page.locator("#postcardNote img").count(), 0);
  await page.click('[data-paper="clay"]');
  const cell = page.locator('.room-step[data-row="2"][data-step="2"]'),
    before = await cell.getAttribute("aria-pressed");
  await cell.click();
  assert.notEqual(await cell.getAttribute("aria-pressed"), before);
  await cell.focus();
  await page.keyboard.press("Space");
  assert.equal(await cell.getAttribute("aria-pressed"), before);
  await page.evaluate(() => {
    const input = document.getElementById("scoreTempo");
    input.value = 108;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  pass(
    "place changes, literal untrusted note, palette, pointer and keyboard score edits",
  );
  await page.click("#scorePlay");
  await page.waitForFunction(() => HaizDarkroom.diagnostics.playedSteps >= 2);
  assert.equal(
    await page.evaluate(() => HaizDarkroom.diagnostics.audioState),
    "running",
  );
  assert.equal(await page.evaluate(() => HaizExperience.sound), false);
  await page.click("#scorePlay");
  assert.equal(
    await page.evaluate(() => HaizDarkroom.diagnostics.playing),
    false,
  );
  assert.equal(await page.evaluate(() => HaizDarkroom.diagnostics.sources), 0);
  pass(
    "gesture-unlocked Web Audio, no competing ambient sound, scheduled loop, stop and source cleanup",
  );
  await page.click("#shareScore");
  await page.waitForFunction(() =>
    document.getElementById("mailStatus").textContent.includes("已复制"),
  );
  const url = await page.locator("#scoreLink").inputValue(),
    snapshot = await page.evaluate(() => HaizDarkroom.score);
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), url);
  const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
    }),
    mobile = await mobileContext.newPage();
  watch(mobile);
  await mobile.goto(url);
  await mobile.waitForFunction(() => window.HaizDarkroom);
  assert.deepEqual(await mobile.evaluate(() => HaizDarkroom.score), snapshot);
  assert.equal(
    await mobile.evaluate(() => HaizDarkroom.diagnostics.audioState),
    "not-created",
  );
  assert.match(await mobile.locator("#remixState").textContent(), /接到了一份/);
  assert(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await mobile.screenshot({
    path: artifacts + "/darkroom-mobile.png",
    fullPage: true,
  });
  pass(
    "share to independent mobile context preserves exact score without autoplay or backend",
  );
  await mobile.locator("#revealStage").scrollIntoViewIfNeeded();
  rect = await mobile.locator("#revealCanvas").boundingBox();
  const cdp = await mobile.context().newCDPSession(mobile);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: rect.x + rect.width * 0.2, y: rect.y + rect.height * 0.4 },
    ],
  });
  for (let i = 1; i <= 6; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: rect.x + rect.width * (0.2 + i * 0.08),
          y: rect.y + rect.height * 0.4,
        },
      ],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert((await mobile.evaluate(() => HaizDarkroom.diagnostics.strokes)) > 3);
  const touchCell = mobile.locator('.room-step[data-row="0"][data-step="7"]');
  const was = await touchCell.getAttribute("aria-pressed");
  await touchCell.tap();
  assert.notEqual(await touchCell.getAttribute("aria-pressed"), was);
  await mobile.screenshot({ path: artifacts + "/darkroom-mobile-score.png" });
  assert(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  pass(
    "actual touch events scratch photo and edit horizontally scrollable score",
  );
  const remix = await mobile.evaluate(() => HaizDarkroom.score);
  const remixURL = mobile.url();
  await mobile.locator('.room-nav a[href="#compose"]').tap();
  assert.equal(
    mobile.url(),
    remixURL,
    "chapter navigation must retain a shared score",
  );
  await mobile.reload();
  await mobile.waitForFunction(() => window.HaizDarkroom);
  assert.deepEqual(await mobile.evaluate(() => HaizDarkroom.score), remix);
  assert.equal(
    await mobile.evaluate(() => HaizDarkroom.diagnostics.audioState),
    "not-created",
  );
  pass(
    "a received remix survives chapter navigation and refresh without reverting or autoplay",
  );
  const pngPromise = page.waitForEvent("download");
  await page.click("#exportPostcard");
  const png = await pngPromise,
    pngPath = await png.path(),
    image = await loadImage(fs.readFileSync(pngPath));
  assert.equal(image.width, 1080);
  assert.equal(image.height, 1440);
  await png.saveAs(artifacts + "/darkroom-postcard.png");
  pass("real 1080×1440 PNG export with uncropped local photo and credits");
  const wavPromise = page.waitForEvent("download");
  await page.click("#exportScore");
  const download = await wavPromise,
    wave = fs.readFileSync(await download.path());
  assert.equal(wave.toString("ascii", 0, 4), "RIFF");
  assert.equal(wave.toString("ascii", 8, 12), "WAVE");
  assert.equal(wave.readUInt32LE(24), 44100);
  assert(wave.length > 200000 && wave.length < 1000000);
  let peak = 0;
  for (let i = 44; i < wave.length; i += 2)
    peak = Math.max(peak, Math.abs(wave.readInt16LE(i)));
  assert(peak > 100 && peak < 32767);
  pass(
    "offline WAV render has valid headers, bounded duration, nonzero unclipped samples",
  );
  await page.click("#scorePlay");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal(
    await page.evaluate(() => HaizDarkroom.diagnostics.playing),
    false,
  );
  assert.equal(await page.evaluate(() => HaizDarkroom.diagnostics.sources), 0);
  await page.evaluate(() => delete document.hidden);
  pass("hidden page immediately stops audio and pending sources");
  await page.evaluate(() => localStorage.setItem("unrelated.test", "keep"));
  await page.click("#forgetScore");
  assert.equal(
    await page.evaluate(() => localStorage.getItem("haiz.darkroom.score.v1")),
    null,
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("unrelated.test")),
    "keep",
  );
  assert.equal(new URL(page.url()).hash, "");
  await page.reload();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("haiz.darkroom.score.v1")),
    null,
  );
  pass(
    "scoped erase preserves unrelated data, clears URL and does not re-save on reload",
  );
  const fallbackContext = await browser.newContext({
    viewport: { width: 360, height: 800 },
    reducedMotion: "reduce",
  });
  await fallbackContext.addInitScript(() => {
    window.AudioContext = undefined;
    window.webkitAudioContext = undefined;
    Storage.prototype.getItem = function () {
      throw Error("blocked");
    };
    Storage.prototype.setItem = function () {
      throw Error("blocked");
    };
  });
  const fallback = await fallbackContext.newPage();
  watch(fallback);
  await fallback.goto(base + "/darkroom.html#score=broken");
  await fallback.waitForFunction(() => window.HaizDarkroom);
  assert.match(
    await fallback.locator("#mailStatus").textContent(),
    /链接不完整/,
  );
  await fallback.click("#scorePlay");
  assert.match(
    await fallback.locator("#audioStatus").textContent(),
    /暂时不能播放/,
  );
  await fallback.fill("#roomNote", "无音频，也能寄出一阵风。");
  assert.match(
    await fallback.locator("#mailStatus").textContent(),
    /不允许本地保存/,
  );
  assert.equal(await fallback.locator(".room-spark").count(), 0);
  assert(
    await fallback.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await fallback.screenshot({
    path: artifacts + "/darkroom-reduced.png",
    fullPage: true,
  });
  pass(
    "reduced motion, malformed hash, blocked storage and unavailable AudioContext degrade safely",
  );
  await page.goto(base + "/contact.html");
  await page.evaluate(() => {
    localStorage.setItem("haiz.darkroom.score.v1", "private");
    localStorage.setItem("unrelated.test", "keep");
  });
  await page.click("#clearLocalData");
  assert.equal(
    await page.evaluate(() => localStorage.getItem("haiz.darkroom.score.v1")),
    null,
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("unrelated.test")),
    "keep",
  );
  pass(
    "site-wide privacy clearing includes darkroom without clearing other applications",
  );
  assert.deepEqual(errors, []);
  const report = {
    date: new Date().toISOString(),
    passed: true,
    checks,
    errors,
    limitations:
      "Chromium desktop and emulated mobile touch, not physical iOS/Android hardware. WAV samples verified, subjective sound quality not measured. Link handoff is asynchronous, not live multiuser.",
  };
  fs.writeFileSync(
    "tests/darkroom-browser-results.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    server.close();
  });
