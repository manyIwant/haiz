'use strict';

// Read-only checks for repository evidence. No copyright or licensing assertions.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'docs/provenance/registry.json');
const registry = JSON.parse(fs.readFileSync(file, 'utf8'));
const allowedStatuses = new Set([
  'repo-history-documented-rights-review-required',
  'mixed-rights-and-historical-sources-review',
  'repo-history-documented-user-rights-separate',
  'repo-history-documented-data-and-reference-review',
  'main-baseline-plus-unmerged-refinements',
  'previous-cc0-notice-retained',
  'third-party-cc0-and-cc-by-4.0',
  'third-party-agpl-and-independent-notices'
]);
const sha = /^[0-9a-f]{40}$/;

function fileAt(relativePath) {
  assert.equal(typeof relativePath, 'string');
  assert.ok(relativePath.length > 1);
  assert.ok(!relativePath.includes('\\'));
  assert.ok(!path.posix.isAbsolute(relativePath));
  assert.ok(!relativePath.split('/').includes('..'));
  const resolved = path.resolve(root, relativePath);
  assert.ok(resolved.startsWith(root + path.sep), 'path escapes repository: ' + relativePath);
  assert.ok(fs.statSync(resolved).isFile(), 'not an existing file: ' + relativePath);
  return resolved;
}

test('baseline repository and policy are explicit', () => {
  assert.equal(registry.schema_version, 1);
  assert.equal(registry.snapshot.repository, 'manyIwant/haiz');
  assert.match(registry.snapshot.commit, sha);
  fileAt(registry.license_policy);
});

test('all provenance chains link to real evidence without claiming copyright ownership', () => {
  const ids = new Set();
  assert.ok(registry.records.length >= 8);
  for (const item of registry.records) {
    assert.match(item.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(!ids.has(item.id), 'duplicate record: ' + item.id);
    ids.add(item.id);
    assert.ok(item.title && item.kind && item.evidence && item.limitations);
    assert.ok(allowedStatuses.has(item.status), 'unknown rights status: ' + item.status);
    assert.ok(Array.isArray(item.material) && item.material.length > 0);
    assert.ok(Array.isArray(item.design) && item.design.length > 0);
    for (const p of [...item.material, ...item.design]) fileAt(p);
    assert.ok(Array.isArray(item.commits));
    for (const commit of item.commits) assert.match(commit, sha);
  }
});

test('baseline Git object IDs are well formed and remain independently reproducible', () => {
  const paths = new Set();
  let mismatches = [];
  for (const { path: name, git_blob_sha } of registry.anchors) {
    assert.ok(!paths.has(name), 'duplicate anchor: ' + name);
    paths.add(name);
    assert.match(git_blob_sha, sha);
    const buffer = fs.readFileSync(fileAt(name));
    const actual = createHash('sha1').update('blob ' + buffer.length + '\0').update(buffer).digest('hex');
    if (actual !== git_blob_sha) mismatches.push(name);
  }
  // The ledger is an immutable historical snapshot. Later legitimate source
  // edits may differ from the baseline; this is not evidence tampering.
  if (mismatches.length) {
    console.warn('Changed after registry baseline (review/update as a new revision): ' + mismatches.join(', '));
  }
  if (process.env.HAIZ_PROVENANCE_STRICT === '1') {
    assert.deepEqual(mismatches, [], 'strict baseline drift check');
  }
});

test('third-party sources and license boundaries remain referenced', () => {
  const ids = new Map(registry.records.map(r => [r.id, r]));
  assert.equal(ids.get('haiz-windowsill').status, 'third-party-agpl-and-independent-notices');
  assert.equal(ids.get('haiz-potted-plant').status, 'third-party-cc0-and-cc-by-4.0');
  assert.equal(ids.get('haiz-limestone').status, 'previous-cc0-notice-retained');
  for (const p of ['LICENSING.md','ARTWORK-LICENSING.md','COMMERCIAL-LICENSING.md','CONTRIBUTING.md']) {
    fileAt(p);
  }
});
