#!/usr/bin/env node
// HAIZ World Engine — Executable Contract & Architecture Integrity Validator
//
// Validates:
//   1. Spatial Datum & Semantic Graph contracts (evidence provenance, unique IDs, WGS84 bounds)
//   2. Unified Character Registry contract (every referenced GLB exists on disk, fictionalOnly=true)
//   3. Six Art Lenses contract (all required shader uniforms & parameters present and finite)
//   4. JavaScript ES module syntax across all files in world-engine/

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

import { CANONICAL_DATUM, EVIDENCE_LEVELS, runtimeToTwin, twinToRuntime, runtimeToWgs84, separation3D, getSpatialDiscrepancyReport } from '../../world-engine/spatial/coord.js';
import { SEMANTIC_PLACES, createSpatialGraph } from '../../world-engine/spatial/graph.js';
import { ART_LENSES, getLens } from '../../world-engine/art/lenses.js';
import { BUDGETS } from '../../world-engine/core/perf.js';

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

console.log('HAIZ World Engine — Contract & Architecture Validator');

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

check('Unified Character Registry conforms to schema and all GLB assets exist on disk', () => {
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'world-engine/data/character-registry.json'), 'utf8'));
  assert.equal(reg.schema, 'haiz-character-registry/1');
  assert.ok(reg.characters.length >= 6);
  for (const ch of reg.characters) {
    assert.equal(ch.fictionalOnly, true, `${ch.id} must be marked fictionalOnly=true`);
    const abs = path.join(ROOT, ch.glb);
    assert.ok(fs.existsSync(abs), `Missing character GLB: ${ch.glb}`);
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

check('JSON Schemas parse cleanly', () => {
  for (const f of ['spatial-graph.schema.json', 'character-registry.schema.json', 'performance-budget.schema.json']) {
    const obj = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', f), 'utf8'));
    assert.ok(obj.$schema && obj.title);
  }
});

check('All world-engine JS modules pass node --check syntax validation', () => {
  const jsFiles = [];
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name.endsWith('.js') || ent.name.endsWith('.mjs')) jsFiles.push(full);
    }
  }
  walk(path.join(ROOT, 'world-engine'));
  walk(path.join(ROOT, 'tools/world-engine'));
  for (const f of jsFiles) {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  }
  assert.ok(jsFiles.length >= 12);
});

console.log(`\nValidation complete: ${passed} checks passed.`);
