// HAIZ Native · assemble native/www after the Vite build: the same local resources the 006 APK
// (1.5.6-preview.006) shipped — app, fonts, models, textures, and the offline 画境 (painted-lab)
// with its Three.js, campus and Atelier assets — plus the RIME pinyin engine for the HAIZ keyboard.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const www = resolve(here, "../www");
if (!existsSync(join(www, "index.html"))) { console.error("run the web build first (npm run web)"); process.exit(1); }

// the APK carries only what the app uses (the bench page and 004 references stay on the web preview)
for (const n of ["bench.html", "ref"]) rmSync(join(www, n), { recursive: true, force: true });
for (const f of readdirSync(join(www, "assets"))) if (/^bench-/.test(f)) rmSync(join(www, "assets", f));

// 画境 · the main site's painted-lab, local, exactly as the 006 APK packaged it
const paint = join(www, "painting");
rmSync(paint, { recursive: true, force: true });
mkdirSync(paint, { recursive: true });
const skip = (src) => { const b = basename(src); return !(b === "tools" || b.endsWith(".md")); };
for (const n of ["lanren/painted-lab", "lanren/vendor/three", "lanren/map", "lanren/ruhua-stroll", "lanren/assets/campus-v3", "lanren/assets/stroll", "lanren/assets/toon", "twin/assets/runtime"])
  cpSync(join(repo, n), join(paint, n), { recursive: true, filter: skip });
for (const n of ["assets/walk/campus.json", "assets/walk/icon.svg", "twin/assets/phase1/gate.glb"]) { mkdirSync(dirname(join(paint, n)), { recursive: true }); cpSync(join(repo, n), join(paint, n)); }
// the embedded home link returns to the app's own 入画 page instead of nesting another app
writeFileSync(join(paint, "painted-lab.html"), readFileSync(join(repo, "painted-lab.html"), "utf8").replace('href="index.html"', 'href="../index.html#/wander" target="_top"'));

// RIME (librime → WebAssembly, luna_pinyin): the engine behind the HAIZ keyboard
const rime = join(www, "rime");
mkdirSync(rime, { recursive: true });
const rd = resolve(here, "../web/node_modules/jsh_rime/data");
for (const f of readdirSync(rd)) cpSync(join(rd, f), join(rime, f));

// fingerprint every shipped file
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(www);
const manifest = Object.fromEntries(files.map((f) => [relative(www, f), createHash("sha256").update(readFileSync(f)).digest("hex")]));
writeFileSync(resolve(here, "../www-manifest.json"), JSON.stringify(manifest, null, 1));
const mb = files.reduce((a, f) => a + statSync(f).size, 0) / 1048576;
console.log(`www: ${files.length} files, ${mb.toFixed(1)} MiB`);
