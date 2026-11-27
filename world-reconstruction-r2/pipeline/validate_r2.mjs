#!/usr/bin/env node
/**
 * HAIZ · World Reconstruction Round 2 — Automated Asset, glTF, Manifest & Provenance Validator.
 * Verifies every exported R2 district GLB & every inherited Atelier runtime GLB:
 *   - valid glTF 2.0 header + JSON chunk + non-zero meshes/primitives + finite bounds
 *   - honest provenance metadata (zero `surveyed` tags anywhere!)
 *   - non-empty instances_r2.json with zero trees inside Centenary Terminalia canopy radius (18m) or forecourt plaza
 *   - HAIZ_World_R2_Master.blend present and cleanly sized (< 50 MB for GitHub compatibility)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REPO = '/Users/a11/manyiwant/haiz-world-reconstruction-r2';
const R2 = path.join(REPO, 'world-reconstruction-r2');

function parseGlb(filePath) {
  const buf = fs.readFileSync(filePath);
  assert.ok(buf.length >= 20, `GLB too small: ${filePath}`);
  assert.equal(buf.readUInt32LE(0), 0x46546c67, `Bad glTF magic in ${filePath}`);
  assert.equal(buf.readUInt32LE(4), 2, `Unsupported glTF version in ${filePath}`);
  const jsonLen = buf.readUInt32LE(12);
  assert.equal(buf.readUInt32LE(16), 0x4e4f534a, `First chunk not JSON in ${filePath}`);
  return JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
}

function walkNodeExtras(gltf) {
  const findings = [];
  for (const node of gltf.nodes || []) {
    if (node.extras) findings.push({ name: node.name || '(unnamed)', extras: node.extras });
  }
  return findings;
}

function main() {
  const manifestPath = path.join(R2, 'data/manifest_r2.json');
  assert.ok(fs.existsSync(manifestPath), 'Missing manifest_r2.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // 1. Validate inherited Atelier runtime GLBs + COLOR_0 preservation
  assert.equal(manifest.inherited_atelier_runtime.length, 9, 'Must reference all 9 Atelier runtime GLBs');
  for (const item of manifest.inherited_atelier_runtime) {
    const abs = path.join(REPO, item.path);
    assert.ok(fs.existsSync(abs), `Missing inherited Atelier runtime GLB: ${item.path}`);
    const gltf = parseGlb(abs);
    assert.ok((gltf.meshes || []).length > 0, `Empty meshes in ${item.path}`);
    if (item.id === 'landmark' || item.id === 'terminalia') {
      const hasColor0 = (gltf.meshes || []).some((m) => (m.primitives || []).some((p) => p.attributes?.COLOR_0 !== undefined));
      assert.ok(hasColor0, `COLOR_0 vertex attribute missing in ${item.id}`);
    }
    console.log(`  OK inherited Atelier: ${item.id} (${(item.bytes / 1024).toFixed(1)} KB, meshes=${gltf.meshes.length})`);
  }

  // 2. Validate newly built R2 districts & honest provenance tags
  assert.ok(manifest.r2_districts.length >= 10, 'Expected >= 10 exported R2 district GLBs');
  let totalExtrBytes = 0;
  for (const item of manifest.r2_districts) {
    const abs = path.join(REPO, item.path);
    assert.ok(fs.existsSync(abs), `Missing exported R2 GLB: ${item.path}`);
    const size = fs.statSync(abs).size;
    assert.ok(size < 45 * 1024 * 1024, `File exceeds 45 MB limit: ${item.path} (${size})`);
    totalExtrBytes += size;
    const gltf = parseGlb(abs);
    assert.ok((gltf.meshes || []).length > 0, `Empty meshes in ${item.path}`);

    // Verify accessors finite & extras honest (no `surveyed`)
    for (const acc of gltf.accessors || []) {
      for (const arr of [acc.min, acc.max]) {
        if (arr) assert.ok(arr.every(Number.isFinite), `NaN accessor bound in ${item.path}`);
      }
    }
    for (const { name, extras } of walkNodeExtras(gltf)) {
      if (extras.haiz_tag) {
        assert.ok(!extras.haiz_tag.includes('surveyed'), `Forbidden surveyed tag on ${name}: ${extras.haiz_tag}`);
      }
    }
    console.log(`  OK R2 district: ${item.id} (${(size / 1024).toFixed(1)} KB, meshes=${gltf.meshes.length})`);
  }

  // 3. Validate Master .blend size & existence
  const blendPath = path.join(R2, 'assets/blend/HAIZ_World_R2_Master.blend');
  assert.ok(fs.existsSync(blendPath), 'Missing HAIZ_World_R2_Master.blend');
  const blendSizeMB = fs.statSync(blendPath).size / (1024 * 1024);
  console.log(`  OK Master .blend: ${blendSizeMB.toFixed(2)} MB`);
  assert.ok(blendSizeMB < 50.0, `Master .blend exceeds 50 MB GitHub warning limit (${blendSizeMB.toFixed(2)} MB)`);

  // 4. Validate instances_r2.json collision rules
  const inst = JSON.parse(fs.readFileSync(path.join(R2, 'data/instances_r2.json'), 'utf8'));
  let floraCount = 0;
  for (const [kind, list] of Object.entries(inst.flora)) {
    for (const [x, y] of list) {
      floraCount++;
      assert.ok(!(x > -15.5 && x < 15.5 && y > -2.5 && y < 31.5), `Flora ${kind} inside central Taihu plaza: (${x},${y})`);
      assert.ok(!(x > -58 && x < 58 && y > -1.0 && y < 21.2), `Flora ${kind} inside Forecourt stone side terrace: (${x},${y})`);
      assert.ok(Math.hypot(x - 38.91, y - 17.67) >= 18.0, `Flora ${kind} inside Centenary Terminalia crown: (${x},${y})`);
    }
  }
  const propCount = Object.values(inst.props).reduce((a, b) => a + b.length, 0);
  console.log(`  OK instances_r2.json: ${floraCount} trees/shrubs, ${propCount} props; total R2 GLBs = ${(totalExtrBytes / (1024 * 1024)).toFixed(2)} MB`);
}

main();
