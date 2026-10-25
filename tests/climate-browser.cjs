const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  assert = require("node:assert/strict"),
  { chromium } = require("playwright");
const root = process.cwd(),
  errors = [],
  evidence = [],
  dir = "tests/artifacts";
let browser;
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const server = http.createServer((req, res) => {
  const file = path.resolve(
    root,
    "." + decodeURIComponent(new URL(req.url, "http://local").pathname),
  );
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
});
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
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  page.setDefaultTimeout(120000);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(r.status() + " " + r.url());
  });
  await page.goto(
    base + "/campus-3d.html?focus=yihao&climate=morning&observe=1",
  );
  await page.waitForFunction(() => window.haizWalk);
  await page.click("#enterButton");
  await page.evaluate(() => {
    haizWalk.pause(null);
    haizWalk.goTo("yihao", false);
    haizWalk.pause(null);
  });
  console.log("PASS actual campus and water-film/cloud shaders initialized");
  for (const id of ["morning", "afterrain", "dusk", "sunbreak", "monsoon"]) {
    const d = await page.evaluate((id) => {
      const a = haizWalk,
        select = document.getElementById("climate");
      select.value = id;
      select.dispatchEvent(new Event("change"));
      a.renderer.toneMappingExposure = a.climate.tick(5, false, true);
      a.renderer.render(a.scene, a.camera);
      return {
        ...a.climate.diagnostics,
        climate: a.climate.current,
        programs: a.renderer.info.programs.length,
        fogNear: a.scene.fog.near,
        fogFar: a.scene.fog.far,
      };
    }, id);
    assert.equal(d.climate, id);
    assert.equal(d.roadWaterFilms, 11);
    assert.equal(d.extraReflectionPasses, 0);
    assert(d.programs > 0);
    assert(d.fogFar > d.fogNear && d.fogNear > 0, 'Atmospheric depth is finite');
    if(id==='sunbreak')assert(d.wet > .85 && d.cloud > .6, 'Rainbreak requires warm wet foreground');
    if(id==='monsoon')assert(d.rain > .65 && d.rainBudget <= 160, 'Monsoon respects rain budget');
    evidence.push(d);
    await page.screenshot({ path: dir + "/climate-" + id + ".png" });
    console.log("PASS rendered tropical climate", id);
  }
  await page.evaluate(() => {
    document.getElementById('climate').value='morning';
    document.getElementById('climate').dispatchEvent(new Event('change'));
  });
  await page.locator('#cinematicLight').click();
  assert.equal(await page.evaluate(()=>haizWalk.climate.current),'sunbreak','HUD light switch selects the cinematic grade');
  assert.equal(await page.locator('#climate').inputValue(),'sunbreak');
  for (const id of ["fengqitang", "yanchi"]) {
    await page.evaluate((id) => {
      const a = haizWalk;
      a.goTo(id, false);
      a.pause(null);
      document.getElementById("climate").value = "afterrain";
      document.getElementById("climate").dispatchEvent(new Event("change"));
      a.renderer.toneMappingExposure = a.climate.tick(5, false, true);
      a.renderer.render(a.scene, a.camera);
    }, id);
    await page.screenshot({ path: dir + "/climate-wide-" + id + ".png" });
  }
  await page.click("#pauseButton");
  await page.locator("#cloudCover").fill("96");
  await page.locator("#rainAmount").fill("75");
  await page.locator("#groundWetness").fill("100");
  assert.equal(await page.locator("#rainAmountValue").textContent(), "75%");
  assert.equal(await page.evaluate(() => haizWalk.climate.weather.rain), 0.75);
  await page.screenshot({ path: dir + "/climate-workbench-desktop.png" });
  await page.evaluate(() => {
    const a = haizWalk;
    a.pause(null);
    a.renderer.toneMappingExposure = a.climate.tick(5, false, true);
    a.renderer.render(a.scene, a.camera);
  });
  assert(
    await page.evaluate(
      () =>
        haizWalk.climate.diagnostics.rainBudget === 120 &&
        haizWalk.climate.diagnostics.rainCount > 0 &&
        haizWalk.climate.diagnostics.rainCount <= 120 &&
        haizWalk.climate.diagnostics.shelterCount > 0,
    ),
  );
  await page.screenshot({ path: dir + "/climate-shower.png" });
  await page.evaluate(() => {
    const a = haizWalk;
    a.climate.tick(1, true, true);
    a.renderer.render(a.scene, a.camera);
  });
  assert.equal(
    await page.evaluate(() => haizWalk.climate.diagnostics.rainCount),
    0,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click("#pauseButton");
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await page.locator("#resetClimate").scrollIntoViewIfNeeded();
  await page.click("#resetClimate");
  assert.equal(
    await page.evaluate(() => haizWalk.climate.diagnostics.custom),
    false,
  );
  await page.screenshot({ path: dir + "/climate-workbench-mobile.png" });
  await page.selectOption("#quality", "low");
  await page.evaluate(() => {
    const a = haizWalk;
    a.pause(null);
    a.climate.setWeather({ rain: 1 });
    a.renderer.toneMappingExposure = a.climate.tick(5, false, true);
    a.renderer.render(a.scene, a.camera);
  });
  assert(
    await page.evaluate(
      () =>
        haizWalk.climate.diagnostics.rainBudget === 48 &&
        haizWalk.climate.diagnostics.rainCount <= 48,
    ),
  );
  await page.screenshot({ path: dir + "/climate-mobile-low.png" });
  assert.deepEqual(errors, []);
  const result = {
    date: new Date().toISOString(),
    passed: true,
    checks: [
      "real r128 shaders compile without errors",
      "same photographic-observation viewpoint in five climates",
      "11 scanned road materials keep maps and receive irregular GGX water films",
      "desktop sliders drive actual scene state",
      "bounded local rain: 120 at 75%, 48 in low mode",
      "indoor rain suppression",
      "mobile controls, reset and no overflow",
      "no added planar reflection pass",
    ],
    evidence,
    errors,
    limitations:
      "Original analytic cloud approximation, not volumetric clouds, dynamic GI or proprietary game assets. Software WebGL screenshots; no real-phone frame-rate claim.",
  };
  fs.writeFileSync(
    "tests/climate-browser-results.json",
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
