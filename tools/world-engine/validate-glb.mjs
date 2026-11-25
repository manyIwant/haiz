#!/usr/bin/env node
// HAIZ World Engine — Executable Binary GLB Inspector & Asset Budget Validator
//
// Parses glTF 2.0 binary (.glb) headers and JSON chunks directly (zero external deps),
// inspects mesh/primitive/triangle counts, skin joints, animations, textures, extensions,
// and validates against HAIZ asset size & geometry budgets.
//
// Usage:
//   node tools/world-engine/validate-glb.mjs            # print summary & verify budgets
//   node tools/world-engine/validate-glb.mjs --write    # write tools/world-engine/glb-audit-report.json
//   node tools/world-engine/validate-glb.mjs --strict   # exit non-zero on any runtime budget warning

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const WRITE = process.argv.includes('--write');
const STRICT = process.argv.includes('--strict');

const BUDGET_BY_CLASS = {
  character: { maxBytes: 2_500_000, maxTris: 40_000, label: '角色资产' },
  mascot: { maxBytes: 500_000, maxTris: 25_000, label: 'Toybox 玩偶' },
  runtime: { maxBytes: 12_000_000, maxTris: 600_000, label: '运行时建筑/景观' },
  master: { maxBytes: 80_000_000, maxTris: 2_500_000, label: '离线母版 (非运行时)' },
};

function classify(relPath) {
  if (relPath.startsWith('twin/assets/atelier/')) return 'master';
  if (relPath.startsWith('lanren/assets/life/') || relPath.startsWith('lanren/assets/ruhua/') || relPath.startsWith('lanren/assets/toon/student')) return 'character';
  if (relPath.startsWith('preview/human-verification')) return 'mascot';
  return 'runtime';
}

function walkGlb(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkGlb(full, out);
    else if (ent.name.endsWith('.glb')) out.push(full);
  }
  return out;
}

function inspectGlb(filePath) {
  const buf = fs.readFileSync(filePath);
  const rel = path.relative(ROOT, filePath).replaceAll('\\', '/');
  if (buf.length < 20) {
    return { path: rel, bytes: buf.length, ok: false, errors: ['File too small to be valid GLB'] };
  }
  const magic = buf.readUInt32LE(0);
  const version = buf.readUInt32LE(4);
  if (magic !== 0x46546c67 || version !== 2) {
    return { path: rel, bytes: buf.length, ok: false, errors: [`Invalid GLB header (magic=0x${magic.toString(16)}, version=${version})`] };
  }
  const chunkLen = buf.readUInt32LE(12);
  const chunkType = buf.readUInt32LE(16);
  if (chunkType !== 0x4e4f534a) {
    return { path: rel, bytes: buf.length, ok: false, errors: ['First chunk is not JSON'] };
  }
  const gltf = JSON.parse(buf.subarray(20, 20 + chunkLen).toString('utf8'));
  const accessors = gltf.accessors || [];
  const meshes = gltf.meshes || [];
  let triangles = 0;
  let primitives = 0;
  for (const m of meshes) {
    for (const p of m.primitives || []) {
      primitives++;
      const mode = p.mode ?? 4; // 4 = TRIANGLES
      if (mode === 4) {
        if (p.indices !== undefined && accessors[p.indices]) {
          triangles += Math.floor(accessors[p.indices].count / 3);
        } else if (p.attributes?.POSITION !== undefined && accessors[p.attributes.POSITION]) {
          triangles += Math.floor(accessors[p.attributes.POSITION].count / 3);
        }
      }
    }
  }
  const joints = (gltf.skins || []).reduce((acc, s) => acc + (s.joints?.length || 0), 0);
  const animations = (gltf.animations || []).length;
  const textures = (gltf.textures || []).length;
  const extensions = gltf.extensionsUsed || [];
  const kind = classify(rel);
  const budget = BUDGET_BY_CLASS[kind];
  const warnings = [];
  if (buf.length > budget.maxBytes) {
    warnings.push(`bytes ${(buf.length / 1048576).toFixed(2)}MB > ${(budget.maxBytes / 1048576).toFixed(2)}MB (${kind})`);
  }
  if (triangles > budget.maxTris) {
    warnings.push(`triangles ${triangles.toLocaleString()} > ${budget.maxTris.toLocaleString()} (${kind})`);
  }

  return {
    path: rel,
    kind,
    bytes: buf.length,
    meshes: meshes.length,
    primitives,
    triangles,
    joints,
    animations,
    textures,
    extensions,
    warnings,
    ok: warnings.length === 0,
  };
}

const files = walkGlb(ROOT).sort();
const results = files.map(inspectGlb);
const runtimeResults = results.filter((r) => r.kind !== 'master');
const totalBytes = results.reduce((s, r) => s + r.bytes, 0);
const runtimeBytes = runtimeResults.reduce((s, r) => s + r.bytes, 0);
const passed = results.filter((r) => r.ok).length;
const warnings = results.length - passed;
const runtimeWarnings = runtimeResults.filter((r) => !r.ok).length;

const report = {
  schema: 'haiz-glb-audit/1',
  generatedAt: new Date().toISOString(),
  budgets: BUDGET_BY_CLASS,
  summary: {
    totalFiles: results.length,
    runtimeFiles: runtimeResults.length,
    totalBytes,
    runtimeBytes,
    passed,
    warnings,
    runtimeWarnings,
  },
  files: results.sort((a, b) => b.bytes - a.bytes),
};

console.log(`HAIZ GLB Asset Audit: ${results.length} files (${(totalBytes / 1048576).toFixed(1)} MB total; ${(runtimeBytes / 1048576).toFixed(1)} MB runtime)`);
console.log(`  Passed: ${passed} | Warnings: ${warnings} (runtime warnings: ${runtimeWarnings})`);
for (const r of results.filter((x) => !x.ok)) {
  console.log(`  [WARN] ${r.path}: ${r.warnings.join('; ')}`);
}

if (WRITE) {
  const outPath = path.join(ROOT, 'tools/world-engine/glb-audit-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`Wrote ${path.relative(ROOT, outPath)}`);
}

if (STRICT && runtimeWarnings > 0) {
  process.exit(1);
}
