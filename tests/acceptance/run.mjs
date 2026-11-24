#!/usr/bin/env node
// HAIZ acceptance runner: one command that runs the regression suites, separates what actually ran
// from what could not run here, and writes a report for the PR.
//
//   node tests/acceptance/run.mjs                 core tier (no browser, ~1–2 min)
//   node tests/acceptance/run.mjs --tier=browser  real-browser tier (Chromium; WebKit if installed)
//   node tests/acceptance/run.mjs --tier=all
//   node tests/acceptance/run.mjs --only=cinematic-runtime,rings
//   node tests/acceptance/run.mjs --keep-results  keep the tracked *-results.json files the suites rewrite
//   node tests/acceptance/run.mjs --require-all   gate mode: a suite that could not run also fails the run
//
// Output: test-results/acceptance-<tier>.json and .md (untracked). In GitHub Actions the Markdown
// is also appended to the job summary. Exit code 1 if any suite that ran failed, or (with
// --require-all) if any selected suite could not run.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const tier = arg('tier', 'core');
const only = arg('only', '') ? new Set(arg('only', '').split(',')) : null;
const keepResults = process.argv.includes('--keep-results');
// Gate mode: a selected suite that could not run (missing browser, PyYAML, …) fails the run too,
// so "nothing executed" can never read as green. CI passes this; local runs default to report-only.
const requireAll = process.argv.includes('--require-all');

// ---- environment probes: a suite whose needs are missing is reported as NOT RUN with the reason
function probeChromium() {
  try {
    const { chromium } = require('playwright');
    if (existsSync(chromium.executablePath())) return { ok: true, how: 'playwright bundled' };
  } catch { /* fall through */ }
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)) return { ok: true, how: 'CHROMIUM_PATH' };
  if (existsSync('/opt/pw-browsers/chromium')) return { ok: true, how: '/opt/pw-browsers/chromium' };
  return { ok: false, why: 'Chromium is not installed (run `npx playwright install --with-deps chromium`)' };
}
function probeWebkit() {
  try {
    const { webkit } = require('playwright');
    if (existsSync(webkit.executablePath())) return { ok: true };
  } catch { /* fall through */ }
  return { ok: false, why: 'WebKit is not installed (run `npx playwright install --with-deps webkit`)' };
}
function probeYaml() {
  const r = spawnSync('python3', ['-c', 'import yaml'], { stdio: 'ignore' });
  return r.status === 0 ? { ok: true } : { ok: false, why: 'python3 with PyYAML is not available' };
}
const probes = { chromium: probeChromium(), webkit: probeWebkit(), yaml: probeYaml() };

// ---- the suites. `node --test` files use the built-in runner; the rest are plain scripts.
const node = (file, extra = []) => ['node', [file, ...extra]];
const nodeTest = (file) => ['node', ['--test', file]];
const SUITES = [
  // core: deterministic, no browser, no network
  { id: 'open-assets', tier: 'core', title: 'Open asset licences and paths', run: node('tests/open-assets.cjs') },
  { id: 'journey', tier: 'core', title: 'Campus journey data', run: node('tests/journey.cjs') },
  { id: 'darkroom', tier: 'core', title: 'Darkroom logic', run: node('tests/darkroom.cjs') },
  { id: 'windowsill', tier: 'core', title: 'Windowsill scene build', run: node('tests/windowsill.cjs') },
  { id: 'climate', tier: 'core', title: 'Climate model', run: node('tests/climate.cjs') },
  { id: 'site', tier: 'core', title: 'Site pages, links and metadata', run: node('tests/site.cjs') },
  { id: 'journal', tier: 'core', title: 'Journal content', run: node('tests/journal.cjs') },
  { id: 'descent', tier: 'core', title: 'Descent imagery and camera data', run: node('tests/descent.cjs') },
  { id: 'descent-units', tier: 'core', title: 'Descent arrival, camera, fallback DOM, hand-off', run: ['node', ['--test', 'tests/descent-arrival-precision.test.cjs', 'tests/descent-camera.test.cjs', 'tests/descent-fallback-dom.test.cjs', 'tests/descent-handoff-stability.test.cjs']] },
  { id: 'cinematic-runtime', tier: 'core', title: 'Cinematic controls, iframe handshake/timeout, WebGL fallback (no GPU)', run: node('tests/cinematic-runtime.cjs') },
  { id: 'walk-verify', tier: 'core', title: 'Campus walk data verification', run: node('tests/walk/verify.cjs'), timeout: 300 },
  { id: 'walk-runtime', tier: 'core', title: 'Campus walk runtime (headless, no GPU)', run: node('tests/walk/runtime.cjs'), timeout: 600 },
  { id: 'rings', tier: 'core', title: '年轮 archive, astronomy and codec', run: node('tests/rings.cjs') },
  { id: 'lanren', tier: 'core', title: 'Lanren tree home sources', run: node('tests/lanren.cjs') },
  { id: 'twin-activation', tier: 'core', title: '06 free-roam route and shared twin landmark loader', run: nodeTest('tests/integration/twin-activation.test.mjs') },
  { id: 'painted-ground-coverage', tier: 'core', title: 'Replacement terrain removes overlapping painted floor and grass', run: nodeTest('tests/painted-ground-coverage.test.mjs') },
  { id: 'home-mobile-units', tier: 'core', title: 'Home phone gesture intent and nearest stop', run: nodeTest('tests/home-mobile.test.cjs') },
  { id: 'roots', tier: 'core', title: 'Roots data', run: node('tests/roots.cjs') },
  { id: 'campus-map', tier: 'core', title: 'Campus map data', run: node('tests/campus-map.cjs') },
  { id: 'campus-model', tier: 'core', title: 'Campus model data', run: node('tests/campus-model.cjs') },
  { id: 'map', tier: 'core', title: 'Map and sports data', run: node('tests/map.cjs') },
  { id: 'canopy', tier: 'core', title: 'Canopy data', run: node('tests/canopy.cjs') },
  { id: 'rain-index', tier: 'core', title: 'Rain index', run: node('tests/rain-index.cjs') },
  { id: 'world-film', tier: 'core', title: 'World film sequencing', run: node('tests/world-film.cjs') },
  { id: 'life', tier: 'core', title: 'Living campus simulation and navigation', run: ['bash', ['-c', 'node tests/life/life.cjs && node tests/life/life-sim.mjs && node tests/life/navcheck.mjs']] },
  { id: 'provenance', tier: 'core', title: 'Provenance evidence ledger', run: node('tests/provenance.cjs') },
  { id: 'pocket', tier: 'core', title: 'Pocket PWA, iOS PWA, OCR and production readiness', run: ['node', ['--test', 'tests/pocket-pwa.test.mjs', 'tests/pocket-ios-pwa.test.mjs', 'tests/pocket-web-ocr.test.mjs', 'tests/pocket-production-readiness.test.mjs']] },
  { id: 'workflow-policy', tier: 'core', title: 'GitHub workflow safety policy', run: ['python3', ['tests/acceptance/workflow_policy.py', '--json', 'test-results/workflow-policy.json']], needs: ['yaml'] },
  { id: 'workflow-policy-selftest', tier: 'core', title: 'Workflow policy catches deliberately unsafe workflows', run: ['bash', ['-c', 'python3 tests/acceptance/workflow_policy.py --expect-fail tests/fixtures/workflow-policy/*.yml']], needs: ['yaml'] },
  // browser: real Chromium (SwiftShader for WebGL) with phone/tablet emulation
  { id: 'mobile-compat-selftest', tier: 'browser', title: 'Mobile check catches deliberately broken pages', run: node('tests/mobile-compat-browser.cjs', ['--root=tests/fixtures/mobile-compat', '--expect-fail', '--settle=500']), needs: ['chromium'], timeout: 300 },
  { id: 'mobile-compat-chromium', tier: 'browser', title: 'Every page on iPhone SE / iPhone 13 / Pixel 7 / iPad (Chromium emulation)', run: node('tests/mobile-compat-browser.cjs'), needs: ['chromium'], timeout: 1800 },
  { id: 'mobile-compat-webkit', tier: 'browser', title: 'Every page on iPhone SE / iPhone 13 / iPad (WebKit engine)', run: node('tests/mobile-compat-browser.cjs', ['--engine=webkit', '--devices=iPhone SE,iPhone 13,iPad Mini landscape']), needs: ['webkit'], timeout: 1800 },
  { id: 'rings-browser', tier: 'browser', title: '年轮 interaction, phone deep link and no-WebGL fallback', run: node('tests/rings-browser.cjs'), needs: ['chromium'], timeout: 900 },
  { id: 'twin-browser', tier: 'browser', title: 'Actual Phase-2 GLB + local Draco decode in 入画自由共游', run: node('tests/integration/twin-activation-browser.cjs'), needs: ['chromium'], timeout: 650 },
];

// Not covered by this runner at all — always listed in the report so nobody reads a green run as more than it is.
const NOT_COVERED = [
  'Real phones and tablets: every browser check here is emulation (viewport, touch, DPR, UA) on Linux. iOS Safari and Android Chrome on real hardware GPUs are not exercised.',
  'Frame rate and GPU behaviour: WebGL runs on SwiftShader (software). Timings here are not performance numbers; performance belongs to the benchmark suite.',
  'Mobile compatibility is a smoke check (load, own assets, uncaught errors, sideways overflow); touch interactions and full feature acceptance need their own tests.',
  'Real navigation timing: browser-test wait budgets (e.g. 300 s for the home → news.html exit) are sized for SwiftShader, not user experience; measure real timings on hardware GPUs.',
  'Visual/artistic review: no screenshot diffing. Composition, materials and light still need a human look.',
  'Backend (`node --test backend/tests/*.test.mjs`): covered by the existing `HAIZ authenticated backend` workflow when backend files change.',
  'Heavy six-act home WebGL suite (`tests/home-browser.cjs`): covered by `rings-qa.yml`; it needs a fast runner and times out on slow machines.',
  'Live site haiz.space: never touched; only the checked-out files are served on 127.0.0.1.',
];

// ---- run
const selected = SUITES.filter((s) => (tier === 'all' || s.tier === tier) && (!only || only.has(s.id)));
if (!selected.length) { console.error(`no suites for tier=${tier}${only ? ' only=' + [...only] : ''}`); process.exit(2); }

function gitDirty() {
  const r = spawnSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? new Set(r.stdout.split('\n').filter(Boolean).map((l) => l.slice(3))) : null;
}
const dirtyBefore = gitDirty();

function runSuite(s) {
  return new Promise((resolve) => {
    const [cmd, args] = s.run;
    const started = Date.now();
    const child = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, FORCE_COLOR: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const keep = (b) => { out += b; if (out.length > 400000) out = out.slice(-200000); };
    child.stdout.on('data', keep); child.stderr.on('data', keep);
    const limit = (s.timeout || 180) * 1000;
    const timer = setTimeout(() => { out += `\n[acceptance] killed after ${limit / 1000}s\n`; child.kill('SIGKILL'); }, limit);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code: code ?? (signal ? 128 : 1), ms: Date.now() - started, tail: out.trim().split('\n').slice(-25).join('\n') });
    });
  });
}

const results = [];
console.log(`HAIZ acceptance · tier=${tier} · ${selected.length} suite(s) · node ${process.version} · ${os.platform()} ${os.arch()} · ${os.cpus().length} CPU`);
for (const s of selected) {
  const missing = (s.needs || []).filter((n) => !probes[n].ok);
  if (missing.length) {
    results.push({ id: s.id, title: s.title, status: 'not-run', reason: missing.map((n) => probes[n].why).join('; ') });
    console.log(`○ ${s.id} — not run: ${results.at(-1).reason}`);
    continue;
  }
  process.stdout.write(`… ${s.id}`);
  const r = await runSuite(s);
  const status = r.code === 0 ? 'passed' : 'failed';
  results.push({ id: s.id, title: s.title, status, ms: r.ms, command: [s.run[0], ...s.run[1]].join(' '), ...(status === 'failed' ? { tail: r.tail } : {}) });
  process.stdout.write(`\r${status === 'passed' ? '✓' : '✗'} ${s.id} (${(r.ms / 1000).toFixed(1)}s)\n`);
  if (status === 'failed') console.log(r.tail.split('\n').map((l) => '    ' + l).join('\n'));
}

// The suites rewrite tracked *-results.json evidence files; put back the ones that were clean before.
const dirtyAfter = gitDirty();
let restored = [];
if (!keepResults && dirtyBefore && dirtyAfter) {
  restored = [...dirtyAfter].filter((f) => !dirtyBefore.has(f) && /-results\.json$/.test(f));
  if (restored.length) spawnSync('git', ['checkout', '--', ...restored], { cwd: ROOT });
}

// ---- report
const count = (st) => results.filter((r) => r.status === st).length;
const commit = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
const report = {
  tier, commit, at: new Date().toISOString(), node: process.version, platform: `${os.platform()} ${os.arch()}`, cpus: os.cpus().length,
  ci: Boolean(process.env.GITHUB_ACTIONS), browsers: { chromium: probes.chromium, webkit: probes.webkit },
  passed: count('passed'), failed: count('failed'), notRun: count('not-run'), requireAll, results, notCovered: NOT_COVERED, restoredResultFiles: restored,
};
const md = [
  `## HAIZ acceptance · ${tier} · \`${commit}\``,
  '',
  `**${report.passed} passed · ${report.failed} failed · ${report.notRun} not run**${requireAll ? ' (gate mode: not run counts as failure)' : ''} — ${report.ci ? 'GitHub Actions' : 'local'} · ${report.platform} · ${report.cpus} CPU · node ${report.node}`,
  '',
  '| | Suite | What it checks | Time |',
  '|---|---|---|---|',
  ...results.map((r) => `| ${{ passed: '✅', failed: '❌', 'not-run': '⚪' }[r.status]} | \`${r.id}\` | ${r.title}${r.status === 'not-run' ? ` — **not run:** ${r.reason}` : ''} | ${r.ms ? (r.ms / 1000).toFixed(1) + 's' : '—'} |`),
  '',
  ...(report.failed ? ['### Failures', '', ...results.filter((r) => r.status === 'failed').flatMap((r) => [`<details><summary><code>${r.id}</code> — <code>${r.command}</code></summary>`, '', '```', r.tail, '```', '</details>', ''])] : []),
  '### Not covered by this run',
  '',
  ...NOT_COVERED.map((x) => `- ${x}`),
  '',
].join('\n');
mkdirSync(path.join(ROOT, 'test-results'), { recursive: true });
writeFileSync(path.join(ROOT, 'test-results', `acceptance-${tier}.json`), JSON.stringify(report, null, 2) + '\n');
writeFileSync(path.join(ROOT, 'test-results', `acceptance-${tier}.md`), md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
console.log(`\n${report.passed} passed · ${report.failed} failed · ${report.notRun} not run → test-results/acceptance-${tier}.md`);
const blocked = report.failed || (requireAll && report.notRun);
if (requireAll && report.notRun) console.log(`gate mode: ${report.notRun} required suite(s) did not run → failing`);
process.exitCode = blocked ? 1 : 0;
