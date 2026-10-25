const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const js = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("source JavaScript parses successfully", () => {
  execFileSync(process.execPath, ["--check", path.join(root, "app.js")], { stdio: "pipe" });
});

test("local media, route, and font references exist", () => {
  const urls = new Set();
  const quoted = /["']((?:\.\.\/|\.\/)[^"'<>\s]+?)["']/g;
  for (const text of [html, css, js]) {
    let match;
    while ((match = quoted.exec(text))) urls.add(match[1]);
  }
  const paths = [
    "index.html", "style.css", "app.js",
    ...urls
  ];
  for (const url of paths) {
    if (/\.(?:html|css|js)$/.test(url) || url.endsWith("/") || /\.(?:woff2|jpg|webp|svg)$/.test(url)) {
      assert.ok(fs.existsSync(path.resolve(root, url)), "Missing local destination: " + url);
    }
  }
  assert.ok(urls.size >= 12, "Expected meaningful live destinations/assets to be verified");
});

test("offers responsive and reduced-motion treatment", () => {
  assert.match(css, /max-width:650px/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(html, /class="skip"/);
  assert.match(html, /aria-label="模块"/);
  assert.match(html, /<dialog/);
});

test("local tasks never render user text as raw HTML", () => {
  assert.match(js, /label\.textContent = task\.text/);
  assert.match(js, /localStorage\.setItem/);
  assert.match(html, /非学校官方服务/);
});

test("spring math converges after rapid target changes and long tab pauses", () => {
  const sandbox = { window:{} };
  require("node:vm").runInNewContext(fs.readFileSync(path.join(root, "dock-spring.js"), "utf8"), sandbox, { filename:"dock-spring.js" });
  const { step, settled } = sandbox.window.HAIZ_DOCK_SPRING;
  let state = { x:0, v:0 };
  for (let i = 0; i < 15; i++) state = step(state, 240, 1/60);
  for (let i = 0; i < 120; i++) state = step(state, 70, 1/60);
  assert.ok(settled(state, 70), "spring must settle and stop requesting frames");
  const resumed = step({x:11,v:380},90,600);
  assert.ok(Number.isFinite(resumed.x) && Number.isFinite(resumed.v), "large paused-tab delta remains finite");
  assert.ok(resumed.x > -100 && resumed.x < 250, "large paused-tab delta is bounded");
});
test("portal links stay semantic and include accessible skip and cancel", () => {
  assert.match(html, /id="scenePortal" role="dialog" aria-modal="true"/);
  assert.match(html, /id="portalSkip" type="button"/);
  assert.match(html, /id="portalCancel" type="button"/);
  assert.match(js, /event\.metaKey \|\| event\.ctrlKey \|\| event\.shiftKey/);
  assert.match(js, /reduceMotion\.matches/);
  assert.match(js, /pendingPortal/);
  assert.ok(fs.existsSync(path.join(root, "dock-spring.js")));
});
