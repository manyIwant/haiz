import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const upstream = "https://ui.aceternity.com/registry/lamp.json";
const result = await fetch(upstream, {
  headers: { Accept: "application/json", "User-Agent": "HAIZ-Lamp-Builder/1.0" },
  signal: AbortSignal.timeout(45000),
});
if (!result.ok) throw new Error("Aceternity official registry HTTP " + result.status);
const registry = await result.json();
if (registry.name !== "lamp" || !Array.isArray(registry.files)) {
  throw new Error("Unexpected official lamp registry payload");
}
const item = registry.files.find((item) => /(^|\/)lamp\.tsx$/.test(item.path));
if (!item || typeof item.content !== "string" || !item.content.includes("LampContainer") || !item.content.includes("conic-gradient")) {
  throw new Error("Official LampContainer source not found or changed: refusing to publish a substitute");
}
const dest = new URL("../src/components/ui/lamp.tsx", import.meta.url);
await mkdir(new URL("../src/components/ui/", import.meta.url), { recursive: true });
await writeFile(dest, item.content);
const hash = createHash("sha256").update(item.content).digest("hex");
console.log("Official Aceternity Lamp source downloaded, sha256=" + hash);
console.log("Source: " + upstream);
