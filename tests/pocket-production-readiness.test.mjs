import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const audit = resolve(root, 'scripts/pocket-production-readiness.mjs');

test('six production gates produce explicit evidence and no false green result', () => {
  execFileSync(process.execPath, [audit], {cwd:root, stdio:'pipe'});
  const report = JSON.parse(readFileSync(resolve(root,
    'production-acceptance-output/report.json'),'utf8'));
  assert.equal(report.checks.length, 6);
  assert.deepEqual(report.checks.map(c=>c.id), [
    'safari-file','standalone-storage','eviction-recovery',
    'cloud-sync','web-push','web-ocr'
  ]);
  const allowed = new Set(['pass','device-required','environment-required','blocked']);
  for(const c of report.checks){
    assert.ok(allowed.has(c.status));
    assert.ok(c.evidence.length > 12);
    assert.ok(c.remaining.length > 30);
  }
  assert.ok(report.scope.includes('NOT an iPhone'));
});

test('strict production gate fails closed until every area is accepted', () => {
  const result=spawnSync(process.execPath,[audit,'--strict'],{
    cwd:root, encoding:'utf8'
  });
  assert.equal(result.status,1);
  assert.match(result.stderr,/PRODUCTION HOLD/);
});

test('production build only accepts a public key, with optional HAIZ URL',()=>{
  const workflow=readFileSync(resolve(root,
    '.github/workflows/pocket-autopublish.yml'),'utf8');
  assert.match(workflow,/vars\.HAIZ_SUPABASE_URL/);
  assert.match(workflow,/vars\.HAIZ_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(workflow,/sb_publishable_\*/);
  assert.match(workflow,/zifcxtjwzbjabcjpqhgp\.supabase\.co/);
  assert.match(workflow,/Supabase URL is set but its publishable key is missing/);
  assert.match(workflow,/Flutter source defaults to HAIZ's public Supabase key/);
  assert.doesNotMatch(workflow,/service_role/);
});
