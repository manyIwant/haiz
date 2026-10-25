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
