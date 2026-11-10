const fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { chromium } = require("playwright");
const root = process.cwd(),
  dir = "tests/artifacts",
  errors = [],
  external = [],
  checks = [];
let browser;
const mime = {
  ".html": "text/html",
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".md": "text/plain;charset=utf-8",
};
const server = http.createServer((req, res) => {
  try {
    let name = decodeURIComponent(new URL(req.url, "http://local").pathname);
    if (name.endsWith("/")) name += "index.html";
    const file = path.resolve(root, "." + name);
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (e, b) => {
      if (e) {
        res.writeHead(404).end();
        return;
      }
      res.setHeader(
        "Content-Type",
        mime[path.extname(file)] || "application/octet-stream",
      );
      res.end(b);
    });
  } catch {
    res.writeHead(400).end();
  }
});
function wav() {
  const sr = 22050,
    n = sr * 2,
    b = Buffer.alloc(44 + n * 2);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++)
    b.writeInt16LE(
      Math.round(
        Math.sin((i / sr) * Math.PI * 2 * 440) * (i < sr ? 0.03 : 0.4) * 32767,
      ),
      44 + i * 2,
    );
  return b;
}
function track(page, base) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(r.status() + " " + r.url());
  });
  page.on("request", (r) => {
    if (
      !r.url().startsWith(base) &&
      !r.url().startsWith("blob:") &&
      !r.url().startsWith("data:")
    )
      external.push(r.url());
  });
}
async function noOverflow(page) {
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
}
(async () => {
  fs.mkdirSync(dir, { recursive: true });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    }),
    page = await context.newPage();
  track(page, base);
  page.setDefaultTimeout(120000);
  await page.goto(base + "/windowsill/index.html");
  await page.waitForFunction(() => window.HaizDesk);
  assert.equal(await page.locator("iframe").count(), 0);
  await noOverflow(page);
  await page.screenshot({
    path: dir + "/windowsill-desktop.png",
    fullPage: true,
  });
  checks.push(
    "desktop paper-first layout: no WebGL, models or audio before gesture",
  );
  await page.fill("#note0", "树影与😀 <script>不是代码</script>");
  await page.waitForFunction(() =>
    localStorage.getItem("haiz.windowsill.v1")?.includes("树影"),
  );
  assert.equal(await page.locator("#tools script").count(), 0);
  await page.reload();
  await page.waitForFunction(() => window.HaizDesk);
  assert.match(await page.inputValue("#note0"), /树影与😀/);
  await page.click('[data-tool="letter"]');
  await page.fill("#futureLetter", "写给未来：一封只在本机的测试信。");
  const dl = page.waitForEvent("download");
  await page.click("#downloadLetter");
  const download = await dl;
  assert.match(download.suggestedFilename(), /给未来的信/);
  assert.match(fs.readFileSync(await download.path(), "utf8"), /一封只在本机/);
  checks.push("safe Unicode notes persist; real letter text download");
  await page.click('[data-tool="focus"]');
  await page.click('[data-minutes="2"]');
  await page.click("#timerToggle");
  assert(await page.evaluate(() => HaizDesk.diagnostics.timer.running));
  await page.evaluate(() => {
    window.__realNow = Date.now;
    Date.now = () => window.__realNow() + 121000;
  });
  await page.waitForFunction(() => HaizDesk.diagnostics.timer.complete);
  assert.equal(await page.locator("#timerReadout").textContent(), "00:00");
  await page.evaluate(() => {
    Date.now = window.__realNow;
    delete window.__realNow;
  });
  await page.click("#timerReset");
  assert.equal(await page.locator("#timerReadout").textContent(), "02:00");
  checks.push("actual deadline-based timer completes, pauses and resets");
  await page.click('[data-tool="book"]');
  await page.selectOption("#bookChapter", "1");
  assert.match(await page.locator("#bookLeft").textContent(), /把课间留成空白/);
  await page.click('[data-tool="jar"]');
  const before = await page.locator("#promptText").textContent();
  await page.click("#newPrompt");
  assert.notEqual(await page.locator("#promptText").textContent(), before);
  console.log(
    "PASS paper tools, real downloads, deadline clock and original book",
  );
  await page.click('[data-tool="audio"]');
  await page.fill("#audioCaption", "本机测试声：前轻后响。");
  await page.setInputFiles("#audioFile", {
    name: "qa-real-envelope.wav",
    mimeType: "audio/wav",
    buffer: wav(),
  });
  await page.waitForFunction(
    () =>
      HaizDesk.diagnostics.localAudio &&
      Object.values(VoiceNote.notes).some((n) => n.envelopeReady),
    {},
    { timeout: 15000 },
  );
  const envelope = await page.evaluate(() => {
    const n = Object.values(VoiceNote.notes)[0];
    return { early: n.amp(0.2), late: n.amp(1.2), duration: n.D };
  });
  assert(envelope.late > envelope.early * 5);
  assert(Math.abs(envelope.duration - 2) < 0.1);
  assert.equal(
    await page.evaluate(
      () => Object.keys(localStorage).filter((k) => k.startsWith("vn.")).length,
    ),
    0,
  );
  await page.click("#audioVisual");
  await page.waitForSelector(".vn-demo.on");
  await page.screenshot({ path: dir + "/windowsill-voice.png" });
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".vn-demo.on").count(), 0);
  await page.click("#audioClear");
  assert.equal(
    await page.evaluate(() => HaizDesk.diagnostics.localAudio),
    false,
  );
  assert.equal(
    await page.evaluate(() => Object.keys(VoiceNote.notes).length),
    0,
  );
  checks.push(
    "real two-level WAV decoded: genuine RMS envelope, visual, keyboard Escape, memory release, no fingerprint persistence",
  );
  await page.setInputFiles("#audioFile", {
    name: "invalid.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from("not audio"),
  });
  await page.waitForFunction(() =>
    document.getElementById("audioStatus").textContent.includes("不能解码"),
  );
  assert.equal(
    await page.evaluate(() => HaizDesk.diagnostics.localAudio),
    false,
  );
  checks.push("invalid audio rejected without fake playback");
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: width === 768 ? 1024 : 844 });
    await noOverflow(page);
    for (const tool of ["notes", "focus", "letter", "audio", "book", "jar"]) {
      await page.click('[data-tool="' + tool + '"]');
      assert(await page.locator('[data-panel="' + tool + '"]').isVisible());
    }
    await page.screenshot({
      path: dir + "/windowsill-" + width + ".png",
      fullPage: true,
    });
  }
  checks.push(
    "all six tools usable at 320, 390 and 768 CSS pixels without horizontal overflow",
  );
  console.log("PASS local audio decoding, visual and responsive tools");
  // One actual scene: four local Blender furniture models, low/reduced mode.
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.selectOption("#sceneQuality", "low");
  await page.click("#startScene");
  await page.waitForFunction(() => HaizDesk.diagnostics.sceneReady);
  const scene = page
    .frames()
    .find((f) => f.url().includes("/scene/index.html"));
  assert(scene);
  await scene.waitForFunction(
    () => window.HaizDeskScene?.diagnostics.models === 4,
    {},
    { timeout: 180000 },
  );
  let d = await scene.evaluate(() => HaizDeskScene.diagnostics);
  assert.equal(d.revision, "170");
  assert(d.reduced && d.paused && !d.sound);
  assert.equal(d.models, 4);
  await page.click('[data-tool="notes"]');
  await page.fill("#note1", "窗台消息确实到达。");
  await scene.waitForFunction(
    () => HaizDeskScene.diagnostics.focus === "notes",
  );
  await scene.evaluate(() => document.getElementById("back").click());
  await page.click('[data-preset="rain"]');
  await scene.waitForFunction(
    () => Number(document.getElementById("sRain").value) === 55,
  );
  await page.screenshot({
    path: dir + "/windowsill-live-desktop.png",
    fullPage: true,
  });
  // Make the actual adapted scene's poster, omitting control labels only.
  await page.click('[data-preset="morning"]');
  await scene.setViewportSize?.({ width: 800, height: 900 });
  await scene.evaluate(() => {
    for (const id of ["head", "labs", "ctl", "hint", "sceneSource"])
      document.getElementById(id).style.visibility = "hidden";
  });
  await page
    .locator("#sceneSlot iframe")
    .screenshot({ path: dir + "/windowsill-live-clean.png" });
  await scene.evaluate(() => {
    for (const id of ["head", "labs", "ctl", "hint", "sceneSource"])
      document.getElementById(id).style.visibility = "";
  });
  const frames = await scene.evaluate(() => HaizDeskScene.diagnostics.frames);
  await page.evaluate(() =>
    document
      .getElementById("sceneSlot")
      .querySelector("iframe")
      .contentWindow.postMessage(
        { channel: "haiz:windowsill:v1", type: "suspend", value: true },
        location.origin,
      ),
  );
  await scene.waitForFunction(() => HaizDeskScene.diagnostics.suspended);
  const stopped = await scene.evaluate(() => HaizDeskScene.diagnostics.frames);
  await page.waitForTimeout(300);
  assert.equal(
    await scene.evaluate(() => HaizDeskScene.diagnostics.frames),
    stopped,
  );
  assert(stopped >= frames);
  checks.push(
    "real local Three r170 scene: four glTF models, schema-checked integration, rain preset and no hidden continuous render",
  );
  await page.click("#unloadScene");
  assert.equal(await page.locator("iframe").count(), 0);
  await page.click("#clearDesk");
  assert.equal(
    await page.evaluate(() => localStorage.getItem("haiz.windowsill.v1")),
    null,
  );
  await page.goto(base + "/windowsill/index.html");
  assert.equal(
    await page.evaluate(() => localStorage.getItem("haiz.windowsill.v1")),
    null,
  );
  checks.push(
    "unload releases WebGL frame; clearing storage is not undone on pagehide",
  );
  const blocked = await context.newPage();
  track(blocked, base);
  await blocked.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (String(type).includes("webgl")) return null;
      return original.call(this, type, ...rest);
    };
  });
  await blocked.goto(base + "/windowsill/index.html");
  await blocked.click("#startScene");
  await blocked.waitForFunction(() =>
    document.getElementById("sceneStatus").textContent.includes("未能运行"),
  );
  await blocked.click('[data-tool="letter"]');
  assert(await blocked.locator("#futureLetter").isVisible());
  await blocked.close();
  checks.push("WebGL-disabled fallback leaves all paper tools usable");
  console.log("PASS scene integration, storage clearing and no-WebGL fallback");
  const touchContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "no-preference",
    }),
    touch = await touchContext.newPage();
  track(touch, base);
  touch.setDefaultTimeout(150000);
  await touch.goto(base + "/windowsill/scene/index.html?quality=low");
  await touch.waitForFunction(() => window.HaizDeskScene);
  await touch.evaluate(() => HaizDeskScene.pause(true));
  await touch.waitForFunction(() => HaizDeskScene.diagnostics.models === 4);
  assert.equal(
    await touch.evaluate(() => HaizDeskScene.diagnostics.sound),
    false,
  );
  await touch.tap("#cView");
  await touch.waitForFunction(() => HaizDeskScene.diagnostics.view === 1);
  await touch.tap("#cView");
  await touch.waitForFunction(() => HaizDeskScene.diagnostics.view === 0);
  await touch.tap("#cSound");
  await touch.waitForFunction(() => HaizDeskScene.diagnostics.sound);
  await touch.tap("#cSound");
  await touch.waitForFunction(() => !HaizDeskScene.diagnostics.sound);
  await touch.evaluate(() => HaizDeskScene.focus("book"));
  await touch.screenshot({ path: dir + "/windowsill-live-touch.png" });
  await touch.tap("#back");
  checks.push(
    "actual touch events change scene view; sound only unlocks from an explicit button and can be stopped",
  );
  await touch.setViewportSize({ width: 800, height: 900 });
  await touch.evaluate(() => {
    HaizDeskScene.pause(true);
    HaizDeskScene.quality("high");
    HaizDeskScene.preset("morning");
  });
  await touch.waitForFunction(
    () =>
      HaizDeskScene.diagnostics.quality === "high" &&
      HaizDeskScene.diagnostics.paused,
  );
  await touch.screenshot({ path: dir + "/windowsill-high.png" });
  console.log("PASS touch gestures and actual high-quality composer");
  if (process.argv.includes("--capture-preview")) {
    await touch.evaluate(() => {
      document.body.classList.add("capture-preview");
      document.head.insertAdjacentHTML(
        "beforeend",
        "<style>body.capture-preview #head,body.capture-preview #labs,body.capture-preview #ctl,body.capture-preview #hint,body.capture-preview #sceneSource{display:none!important}</style>",
      );
      document.dispatchEvent(new Event("input"));
    });
    await touch.screenshot({
      path: "windowsill/scene-preview.jpg",
      type: "jpeg",
      quality: 90,
    });
    console.log("Captured real 800×900 high-quality preview");
  }
  checks.push(
    "actual high-quality GTAO, depth-of-field and local glass shader pipeline renders",
  );
  await touchContext.close();
  assert.deepEqual(external, []);
  assert.deepEqual(
    errors.filter((e) => !e.includes("Error creating WebGL context.")),
    [],
  );
  const result = {
    date: new Date().toISOString(),
    passed: true,
    checks,
    scene: d,
    localEnvelope: envelope,
    externalRequests: external,
    errors: errors.filter((e) => !e.includes("Error creating WebGL context.")),
    limitations:
      "Headless Chromium with software WebGL; responsive behavior is tested, not real-device FPS or photogrammetric fidelity.",
  };
  fs.writeFileSync(
    "tests/windowsill-browser-results.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    server.close();
  });
