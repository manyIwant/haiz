// Actual source, provenance, privacy boundaries and deterministic tool tests.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const { parseHTML } = require("linkedom"),
  C = require("../windowsill/core.js");
const memory = new Map(),
  storage = {
    getItem: (k) => memory.get(k) || null,
    setItem: (k, v) => memory.set(k, v),
  };
assert.equal(C.read(storage).notes.length, 3);
assert(
  C.write(storage, {
    notes: ["<script>😀".repeat(20)],
    letter: "字".repeat(700),
    audio: "private",
  }),
);
assert.equal(Array.from(C.read(storage).notes[0]).length, 40);
assert.equal(C.read(storage).letter.length, 600);
assert(!memory.get(C.KEY).includes("audio"));
assert.equal(
  C.write(
    {
      setItem() {
        throw Error("quota");
      },
    },
    {},
  ),
  false,
);
assert.equal(C.clean({ notes: null }).notes.length, 3);
assert.equal(C.cut(null, 40), "");
const t = C.timer(5);
t.start(1000);
assert.equal(t.tick(60000).remaining, 241000);
t.pause(61000);
assert.equal(t.snapshot.remaining, 240000);
t.start(100000);
assert.equal(t.tick(340001).label, "00:00");
assert(t.snapshot.complete && !t.snapshot.running);
t.reset();
assert.equal(t.snapshot.label, "05:00");
assert.equal(t.choose(999), false);
t.choose(2);
assert.equal(t.snapshot.label, "02:00");
const modified = new Set([
  "scene/src/index.template.html",
  "scene/build.mjs",
  "scene/src/js/00-setup.js",
  "scene/src/js/06-model-loading-helpers.js",
  "scene/src/js/09-left-writing-corner.js",
  "scene/src/js/12-windowsill.js",
  "scene/src/js/16-weather.js",
  "scene/src/js/17-tags-camera-glass.js",
  "scene/src/js/18-input-sliders.js",
  "scene/src/js/19-frame-api.js",
  "vendor/voice-note/voice-note.js",
]);
const manifest = JSON.parse(
  fs.readFileSync("windowsill/upstream-manifest.json"),
);
let intact = 0;
for (const f of manifest.files) {
  const file = path.join("windowsill", f.file);
  assert(fs.existsSync(file), file);
  if (!modified.has(f.file)) {
    assert.equal(
      crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
      f.sha256,
      file + " upstream integrity",
    );
    intact++;
  }
}
assert.match(
  fs.readFileSync("windowsill/LICENSE", "utf8"),
  /GNU AFFERO GENERAL PUBLIC LICENSE/,
);
let links = 0;
for (const file of [
  "windowsill/index.html",
  "windowsill/source.html",
  "windowsill/scene/index.html",
]) {
  const { document } = parseHTML(fs.readFileSync(file, "utf8")),
    ids = new Set();
  assert(document.querySelector('meta[name="viewport"]'));
  for (const el of document.querySelectorAll("[id]")) {
    assert(!ids.has(el.id), file + " duplicate " + el.id);
    ids.add(el.id);
  }
  for (const el of document.querySelectorAll("[href],[src]")) {
    const ref = el.getAttribute("href") || el.getAttribute("src");
    if (!ref || /^(https?:|data:|#)/.test(ref)) continue;
    const resolved = path.resolve(path.dirname(file), ref.split(/[?#]/)[0]);
    assert(fs.existsSync(resolved), file + " missing " + ref);
    links++;
  }
  for (const image of document.querySelectorAll("img"))
    assert(image.hasAttribute("alt"));
}
for (const file of [
  "windowsill/app.js",
  "windowsill/core.js",
  "windowsill/scene/scene.mjs",
]) {
  const code = fs.readFileSync(file, "utf8");
  assert(
    !/https?:\/\/[^'"\s]+\.(?:js|css)(?:\?|['"])/.test(code),
    file + " external runtime dependency",
  );
  assert(
    !/getUserMedia|XMLHttpRequest|sendBeacon/.test(code),
    file + " unsolicited capture/upload",
  );
}
assert(
  !fs.readFileSync("windowsill/app.js", "utf8").includes("fetch("),
  "local audio is not uploaded",
);
assert(
  !fs
    .readFileSync("windowsill/vendor/voice-note/voice-note.js", "utf8")
    .includes("localStorage"),
  "audio fingerprints never persist",
);
const report = {
  passed: true,
  checks: [
    "Unicode and schema-bounded local notes/letter",
    "storage quota fallback",
    "wall-clock timer, pause, resume, reset and completion",
    "unchanged upstream models, modules, icons and licenses verified by SHA-256",
    "standalone scene and application local assets/IDs",
    "source offer and isolated AGPL application",
    "no capture, upload or persistent audio fingerprints",
  ],
  intactUpstreamFiles: intact,
  localLinks: links,
};
fs.writeFileSync(
  "tests/windowsill-results.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
