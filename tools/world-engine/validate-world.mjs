#!/usr/bin/env node
// HAIZ World Engine — Hardened Blocking Architecture & Contract Validator
//
// Enforces executable rules that block future AI/human PRs from breaking unified world invariants:
//   1. Spatial Datum & Semantic Graph contracts (evidence provenance, unique IDs, WGS84 bounds)
//   2. Forbidden legacy coordinate/bearing leakage check (blocks 337°, 321.6°, GCJ-02 outside coord.js)
//   3. Duplicate render-loop static guard (only entry hosts may call requestAnimationFrame, max 1 loop)
//   4. Lifecycle dispose() contract check across core runtime, pipeline, assets, and entities
//   5. Unified Character Registry & Toybox V2 Asset Catalog integrity (all GLBs exist on disk)
//   6. Six Art Lenses shader/post contract completeness
//   7. Performance budget & JSON Schema validity (including entity-interface.schema.json)
//   8. Full ES module syntax verification across world-engine/ and tools/world-engine/

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

import { CANONICAL_DATUM, EVIDENCE_LEVELS, runtimeToTwin, twinToRuntime, runtimeToWgs84, separation3D, getSpatialDiscrepancyReport } from '../../world-engine/spatial/coord.js';
import { SEMANTIC_PLACES, createSpatialGraph } from '../../world-engine/spatial/graph.js';
import { ART_LENSES, getLens } from '../../world-engine/art/lenses.js';
import { BUDGETS } from '../../world-engine/core/perf.js';
import { ASSET_CATALOG } from '../../world-engine/core/assets.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
let passed = 0;

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

function collectJsFiles(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) collectJsFiles(full, out);
    else if (ent.name.endsWith('.js') || ent.name.endsWith('.mjs')) out.push(full);
  }
  return out;
}

console.log('HAIZ World Engine — Blocking Contract & Architecture Validator');

check('Canonical WGS84 datum within Hainan Middle School Fucheng campus bounds', () => {
  assert.ok(CANONICAL_DATUM.wgs84.lat > 19.99 && CANONICAL_DATUM.wgs84.lat < 20.01);
  assert.ok(CANONICAL_DATUM.wgs84.lon > 110.33 && CANONICAL_DATUM.wgs84.lon < 110.36);
  assert.equal(CANONICAL_DATUM.campusNorthBearingDeg, 319.0);
});

check('Runtime <-> Twin coordinate transforms are lossless inverses', () => {
  for (const [rx, rz] of [[0, 0], [-34.9, 22.0], [9.5, 140.0], [125.7, 80.5]]) {
    const t = runtimeToTwin(rx, rz);
    const back = twinToRuntime(t.x, t.z);
    assert.ok(Math.abs(back.x - rx) < 1e-9 && Math.abs(back.z - rz) < 1e-9);
  }
});

check('WGS84 projection maps Teaching Block 1 portal near canonical origin', () => {
  const [ox, oz] = CANONICAL_DATUM.atelierOriginInRuntime;
  const geo = runtimeToWgs84(ox, oz);
  assert.ok(Math.abs(geo.lat - CANONICAL_DATUM.wgs84.lat) < 1e-6);
  assert.ok(Math.abs(geo.lon - CANONICAL_DATUM.wgs84.lon) < 1e-6);
});

check('No legacy conflicting north bearings (337 / 321.6) or GCJ-02 coords leak outside coord.js', () => {
  const files = collectJsFiles(path.join(ROOT, 'world-engine'));
  const forbidden = [
    { re: /\b19\.996067\b/, label: 'GCJ-02 lat 19.996067' },
    { re: /\b110\.347227\b/, label: 'GCJ-02 lon 110.347227' },
    { re: /campusNorthBearing\s*[:=]\s*337/, label: 'legacy bearing 337' },
    { re: /CAMPUS_NORTH\s*=\s*321\.6/, label: 'legacy bearing 321.6' },
  ];
  for (const f of files) {
    const rel = path.relative(ROOT, f).replaceAll('\\', '/');
    if (rel === 'world-engine/spatial/coord.js') continue;
    const src = fs.readFileSync(f, 'utf8');
    for (const rule of forbidden) {
      assert.ok(!rule.re.test(src), `Forbidden ${rule.label} found in ${rel}`);
    }
  }
});

check('Duplicate render-loop guard: subsystems have 0 rAF loops; entry hosts own at most 1 loop', () => {
  const files = collectJsFiles(path.join(ROOT, 'world-engine'));
  const allowedHosts = new Set([
    'world-engine/main.js',
    'world-engine/lab/main.js',
    'world-engine/ui/map-drawer.js', // single one-shot layout rAF inside open()
  ]);
  for (const f of files) {
    const rel = path.relative(ROOT, f).replaceAll('\\', '/');
    const src = fs.readFileSync(f, 'utf8');
    const rafMatches = src.match(/\brequestAnimationFrame\s*\(/g) || [];
    if (!allowedHosts.has(rel)) {
      assert.equal(rafMatches.length, 0, `Forbidden requestAnimationFrame in subsystem ${rel}`);
    } else if (rel === 'world-engine/ui/map-drawer.js') {
      assert.ok(rafMatches.length <= 1, `Unexpected loop in ${rel}`);
    } else {
      // Entry hosts: 1 loop recursion + 1 start (plus optional 1 one-shot toast class toggle)
      assert.ok(rafMatches.length <= 3, `Too many requestAnimationFrame calls (${rafMatches.length}) in ${rel}`);
    }
  }
});

check('Lifecycle dispose() contract exists across runtime, pipeline, assets, and entities', () => {
  for (const rel of [
    'world-engine/core/runtime.js',
    'world-engine/core/assets.js',
    'world-engine/core/entities.js',
    'world-engine/art/pipeline.js',
    'world-engine/main.js',
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(/\bdispose\w*\s*\(/.test(src), `Missing dispose lifecycle handler in ${rel}`);
  }
});

check('3D separation cleanly distinguishes high-altitude flight from ground proximity', () => {
  const ground = separation3D({ x: 10, y: 0, z: 10 }, { x: 10, y: 0, z: 12 });
  const overhead = separation3D({ x: 10, y: 24, z: 10 }, { x: 10, y: 0, z: 12 });
  assert.equal(ground.horiz, overhead.horiz);
  assert.ok(overhead.verticalGap === 24 && overhead.dist3d > 24);
});

check('Semantic Spatial Graph nodes have unique IDs, valid evidence provenance, and descriptions', () => {
  const graph = createSpatialGraph();
  const seen = new Set();
  assert.ok(SEMANTIC_PLACES.length >= 10);
  for (const node of graph.nodes) {
    assert.ok(!seen.has(node.id), `Duplicate place id: ${node.id}`);
    seen.add(node.id);
    assert.ok(EVIDENCE_LEVELS[node.evidence], `Invalid evidence level: ${node.evidence}`);
    assert.equal(node.position.length, 3);
    assert.ok(node.radius > 0);
    assert.ok(node.evidenceNote.length >= 8);
  }
  assert.ok(getSpatialDiscrepancyReport().length >= 4);
});

check('Unified Character Registry & Toybox Asset Catalog GLB files all exist on disk', () => {
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'world-engine/data/character-registry.json'), 'utf8'));
  assert.equal(reg.schema, 'haiz-character-registry/1');
  assert.ok(reg.characters.length >= 6);
  for (const ch of reg.characters) {
    assert.equal(ch.fictionalOnly, true, `${ch.id} must be marked fictionalOnly=true`);
    assert.ok(fs.existsSync(path.join(ROOT, ch.glb)), `Missing character GLB: ${ch.glb}`);
  }
  for (const [id, meta] of Object.entries(ASSET_CATALOG)) {
    if (meta.path.endsWith('.glb')) {
      const abs = path.join(ROOT, meta.path);
      assert.ok(fs.existsSync(abs), `Missing catalog GLB for ${id}: ${meta.path}`);
      const size = fs.statSync(abs).size;
      assert.ok(size <= meta.maxBytes, `Asset ${id} exceeds catalog budget (${size} > ${meta.maxBytes})`);
    }
  }
});

check('All 6 Art Lenses define complete material and post-processing contracts', () => {
  assert.equal(ART_LENSES.length, 6);
  const reqPost = ['wash', 'planes', 'paint', 'ink', 'paper', 'exposureMul', 'satMul', 'bloomMul', 'tint', 'paperColor', 'inkColor'];
  for (const lens of ART_LENSES) {
    assert.equal(getLens(lens.id).id, lens.id);
    for (const k of reqPost) {
      assert.ok(lens.post[k] !== undefined, `Lens ${lens.id} missing post.${k}`);
    }
  }
});

check('Performance budgets define stricter mobile than desktop limits', () => {
  assert.ok(BUDGETS.mobile.maxDrawCalls < BUDGETS.desktop.maxDrawCalls);
  assert.ok(BUDGETS.mobile.maxTriangles < BUDGETS.desktop.maxTriangles);
});

check('All JSON Schemas parse cleanly', () => {
  for (const f of ['spatial-graph.schema.json', 'character-registry.schema.json', 'performance-budget.schema.json', 'entity-interface.schema.json']) {
    const obj = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', f), 'utf8'));
    assert.ok(obj.$schema && obj.title);
  }
});

check('All world-engine & validator JS modules pass node --check syntax validation', () => {
  const jsFiles = [
    ...collectJsFiles(path.join(ROOT, 'world-engine')),
    ...collectJsFiles(path.join(ROOT, 'tools/world-engine')),
  ];
  for (const f of jsFiles) {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  }
  assert.ok(jsFiles.length >= 16);
});

console.log(`\nValidation complete: ${passed} checks passed.`);
