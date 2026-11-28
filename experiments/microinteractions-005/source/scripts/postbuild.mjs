// After the build: report what the preview weighs and make sure nothing points at the dev server.
import { readdirSync, statSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const out = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? (n === "source" || n === "node_modules" ? [] : walk(p)) : [p]; });
const files = walk(out);
const by = {};
let total = 0;
for (const f of files) { const s = statSync(f).size; total += s; const k = f.slice(out.length + 1).split("/")[0]; by[k] = (by[k] || 0) + s; }
console.log(`preview: ${files.length} files, ${(total / 1048576).toFixed(1)} MB`);
for (const [k, v] of Object.entries(by).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(16)} ${(v / 1024).toFixed(0)} KB`);
for (const page of ["index.html", "bench.html"]) {
  const html = readFileSync(join(out, page), "utf8");
  if (/src="\/src\/|href="\/src\//.test(html)) { console.error(`${page} still references /src — build is broken`); process.exit(1); }
}
const js = files.filter((f) => f.endsWith(".js") && f.includes("/assets/"));
const jsKB = js.reduce((a, f) => a + statSync(f).size, 0) / 1024;
console.log(`  js total ${jsKB.toFixed(0)} KB in ${js.length} chunks`);
