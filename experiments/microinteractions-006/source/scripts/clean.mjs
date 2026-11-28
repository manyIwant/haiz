// Clears what the previous build wrote one folder up (hashed assets and the two pages), so stale
// files never pile up in the published preview. Public files are simply overwritten by Vite.
import { rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const out = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
for (const p of ["assets", "index.html", "bench.html"]) {
  const f = resolve(out, p);
  if (existsSync(f)) { rmSync(f, { recursive: true, force: true }); console.log("clean", p); }
}
