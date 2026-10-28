import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { fixture, client, PASSWORD } from '../../../../services/academic/tests/helpers.mjs';
import { createTeacherServer } from '../../server.mjs';

const teacherRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const evidenceDirectory = resolve(teacherRoot, '../../docs/teacher/evidence');
const port = Number(process.env.HAIZ_TEACHER_QA_PORT ?? 8788);
const origin = `http://127.0.0.1:${port}`;
const cleanups = [];
const report = {
  generatedAt: new Date().toISOString(), origin, syntheticDataOnly: true,
  scenarios: [], consoleErrors: [], pageErrors: [], responsive: [], screenshots: [],
  limitations: [
    'Chromium only; Firefox and Safari are not exercised by this harness.',
    'Student checks use the real manual-refresh HTTP endpoint; no Flutter automatic delta synchronization is claimed.',
    'Private-note preservation checks a synthetic browser-owned note marker; Flutter private storage is outside this harness.',
    'Navigation timing is observational and is not a Lighthouse performance audit.',
  ],
};
let browser;
let server;
let shuttingDown = false;

async function cleanup() {
  if (shuttingDown) return;
  shuttingDown = true;
  await browser?.close().catch(() => {});
  if (server?.listening) await new Promise(done => server.close(done));
  for (const dispose of [...cleanups].reverse()) await dispose();
}
process.once('SIGTERM', () => { void cleanup().finally(() => process.exit(0)); });
process.once('SIGINT', () => { void cleanup().finally(() => process.exit(0)); });

async function scenario(name, run) {
  const started = Date.now();
  try {
    const detail = await run();
    report.scenarios.push({ name, status: 'passed', durationMs: Date.now() - started, ...(detail ? { detail } : {}) });
  } catch (error) {
    report.scenarios.push({ name, status: 'failed', durationMs: Date.now() - started, error: error.stack ?? String(error) });
    process.stderr.write(`[Teacher QA] FAIL ${name}: ${error.message}\n`);
  }
}

function observe(page) {
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => {
    // Failed authentication probes and deliberately aborted responses are recorded separately.
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });
  page.setDefaultTimeout(10_000);
}
async function settled(page) {
  await page.waitForFunction(() => document.body.getAttribute('aria-busy') !== 'true');
}
async function login(page, loginName = 'synthetic_teacher') {
  await page.goto(origin);
  await page.locator('#login-account').fill(loginName);
  await page.locator('#login-password').fill(PASSWORD);
  await page.locator('#login-form button[type=submit]').click();
  await page.locator('#active-class').waitFor({ state: 'visible' });
  await settled(page);
}
async function view(page, name) {
  await page.locator(`button[data-view="${name}"]`).click();
  await page.locator(`#${name}-view`).waitFor({ state: 'visible' });
  await settled(page);
}
async function newDraft(page, title) {
  await view(page, 'workspace');
  await page.locator('#new-draft').click();
  await page.locator('#f-subject').fill('数学');
  await page.locator('#f-title').fill(title);
  await page.locator('#f-details').fill('虚构验收作业：完成练习册第 36 至 39 页，并写出解题过程。');
  await page.locator('#f-due-precision').selectOption('date');
  await page.locator('#f-due-date').fill('2026-11-03');
  await page.locator('#save-draft').click();
  await settled(page);
}
async function openOfficial(page, title, name = 'published') {
  await view(page, name);
  const row = page.locator(`#${name}-list .list-item`).filter({ hasText: title }).first();
  await row.getByRole('button').first().click();
  await page.locator(`#${name}-detail h2`).filter({ hasText: title }).waitFor();
}
async function confirmPublication(page) {
  await page.locator('#history-detail').getByRole('button', { name: '确认发布', exact: true }).click();
  await page.locator('#confirm-dialog[open]').waitFor();
  await page.locator('#confirm-yes').click();
  await settled(page);
}
async function screenshot(page, name) {
  await page.screenshot({ path: join(evidenceDirectory, name), fullPage: true });
  report.screenshots.push(name);
}

async function runBrowser(f) {
  const executablePath = process.env.HAIZ_QA_BROWSER ?? join(homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell');
  if (!existsSync(executablePath)) throw new Error(`Chromium executable unavailable: ${executablePath}`);
  browser = await chromium.launch({ executablePath, headless: true });
  report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
  const page = await context.newPage(); observe(page);
  const assignments = async () => (await f.teacher.call(`/api/v1/classes/${f.classroom.id}/assignments?limit=200`)).body.data.assignments;
  const studentAssignments = async () => (await f.b.call('/api/my/assignments')).body.assignments;
  const classroom = async () => {
    const response = await fetch(`${origin}/api/v1/classroom?limit=200`, { headers: { Authorization: `Bearer ${f.classroom.screenKey}` } });
    assert.equal(response.status, 200);
    return (await response.json()).data;
  };
  const find = async title => (await assignments()).find(item => item.title === title);
  const title = '虚构验收 · 一元二次方程';
  let official;
  await scenario('local draft creation and reload never implies publication', async () => {
    await login(page);
    await newDraft(page, title);
    assert.equal(await find(title), undefined);
    assert.equal((await studentAssignments()).some(item => item.title === title), false);
    await page.reload();
    await page.locator('#active-class').waitFor();
    const row = page.locator('#draft-list .list-item').filter({ hasText: title });
    await row.getByRole('button').first().click();
    assert.equal(await page.locator('#f-title').inputValue(), title);
    assert.match(await page.locator('#composer-status').innerText(), /本机草稿/);
  });
  await scenario('Review persists a server draft but remains invisible to students and classroom', async () => {
    await page.locator('#publish-draft').click(); await settled(page);
    await page.locator('#history-view').waitFor({ state: 'visible' });
    official = await find(title);
    assert.equal(official.status, 'review'); assert.equal(official.version, 2);
    assert.equal((await studentAssignments()).some(item => item.id === official.id), false);
    assert.equal((await classroom()).assignments.some(item => item.id === official.id), false);
    await screenshot(page, 'review-checkpoint-1440.png');
  });
  await scenario('explicit publication is confirmed by Academic and identical public assignment identity', async () => {
    assert.ok(official, 'Review scenario must succeed first');
    await confirmPublication(page);
    official = await find(title);
    assert.equal(official.status, 'published'); assert.equal(official.version, 3);
    const student = (await studentAssignments()).find(item => item.id === official.id);
    const screen = (await classroom()).assignments.find(item => item.id === official.id);
    assert.equal(student.version, official.version); assert.equal(screen.version, official.version);
    assert.equal(student.title, official.title); assert.equal(screen.title, official.title);
    await page.reload(); await page.locator('#active-class').waitFor();
    await openOfficial(page, title);
    return { id: official.id, version: official.version, studentManualRefresh: true };
  });
  await scenario('lost create response after commit replays the original request after reload without duplicates', async () => {
    const lostTitle = '虚构验收 · 创建响应丢失';
    await newDraft(page, lostTitle);
    let original;
    const routePattern = '**/api/v1/classes/*/assignments';
    const intercept = async route => {
      if (route.request().method() !== 'POST') return route.continue();
      original = { key: route.request().headers()['idempotency-key'], body: route.request().postData() };
      const response = await route.fetch(); assert.equal(response.status(), 201);
      await route.abort('connectionreset');
    };
    await page.route(routePattern, intercept);
    await page.locator('#publish-draft').click(); await settled(page);
    await page.unroute(routePattern, intercept);
    assert.equal((await assignments()).filter(item => item.title === lostTitle).length, 1);
    assert.equal((await find(lostTitle)).status, 'draft');
    await page.reload(); await page.locator('#active-class').waitFor();
    let replay;
    const capture = request => {
      if (request.method() === 'POST' && request.url().includes(`/classes/${f.classroom.id}/assignments`)) replay = { key: request.headers()['idempotency-key'], body: request.postData() };
    };
    page.on('request', capture);
    await page.locator('#recovery').getByRole('button', { name: '恢复原请求' }).first().click(); await settled(page);
    page.off('request', capture);
    assert.deepEqual(replay, original);
    assert.equal((await assignments()).filter(item => item.title === lostTitle).length, 1);
    assert.equal(await page.locator('#recovery button').count(), 0);
    return { assignmentId: (await find(lostTitle)).id, duplicateCount: 0, sameKeyAndBody: true };
  });
  await scenario('lost publish response after commit recovers as published using the same key', async () => {
    const lostTitle = '虚构验收 · 发布响应丢失';
    await newDraft(page, lostTitle);
    await page.locator('#publish-draft').click(); await settled(page);
    const reviewed = await find(lostTitle);
    let key;
    const pattern = `**/api/v1/assignments/${reviewed.id}/publish`;
    const intercept = async route => {
      key = route.request().headers()['idempotency-key'];
      const response = await route.fetch(); assert.equal(response.status(), 200);
      await route.abort('connectionreset');
    };
    await page.route(pattern, intercept);
    await confirmPublication(page); await page.unroute(pattern, intercept);
    assert.equal((await find(lostTitle)).status, 'published');
    assert.match(await page.locator('#notices').innerText(), /结果尚未确认/);
    await page.reload(); await page.locator('#active-class').waitFor();
    let replayKey;
    const capture = request => { if (request.url().endsWith(`/assignments/${reviewed.id}/publish`)) replayKey = request.headers()['idempotency-key']; };
    page.on('request', capture);
    await page.locator('#recovery').getByRole('button', { name: '恢复原请求' }).first().click(); await settled(page);
    page.off('request', capture);
    assert.equal(replayKey, key);
    assert.equal((await find(lostTitle)).version, 3);
    assert.equal((await assignments()).filter(item => item.title === lostTitle).length, 1);
  });
  await scenario('published edit and concurrent-page conflict retain unsent words and require renewed confirmation', async () => {
    assert.ok(official);
    await openOfficial(page, title);
    await page.locator('#published-detail').getByRole('button', { name: '修改内容' }).click();
    const second = await context.newPage(); observe(second);
    await second.goto(origin); await second.locator('#active-class').waitFor();
    await openOfficial(second, title);
    await second.locator('#published-detail').getByRole('button', { name: '修改内容' }).click();
    await second.locator('#f-details').fill('另一页保留的未提交要求');
    await page.locator('#f-details').fill('第一页面先保存的正式要求');
    await page.locator('#save-edit').click(); await settled(page);
    assert.equal((await find(title)).version, 4);
    await second.locator('#save-edit').click();
    await second.locator('#conflict-dialog[open]').waitFor();
    assert.match(await second.locator('#conflict-body').innerText(), /另一页保留的未提交要求/);
    assert.match(await second.locator('#conflict-body').innerText(), /第一页面先保存的正式要求/);
    assert.equal((await find(title)).details, '第一页面先保存的正式要求');
    await screenshot(second, 'version-conflict-1440.png');
    await second.locator('#conflict-retry').click();
    assert.equal(await second.locator('#f-details').inputValue(), '另一页保留的未提交要求');
    assert.equal((await find(title)).version, 4, 'continuing checks must not silently submit');
    await second.locator('#save-edit').click(); await settled(second);
    official = await find(title);
    assert.equal(official.version, 5); assert.equal(official.status, 'revised');
    assert.equal(official.details, '另一页保留的未提交要求');
    assert.equal((await studentAssignments()).find(item => item.id === official.id).version, 5);
    assert.equal((await classroom()).assignments.find(item => item.id === official.id).version, 5);
    await second.close();
  });
  await scenario('responsive populated workspace, keyboard focus, reduced motion, and optional accessibility scan', async () => {
    await page.reload(); await page.locator('#active-class').waitFor();
    await openOfficial(page, title);
    await page.locator('#published-detail').getByRole('button', { name: '修改内容' }).click();
    for (const width of [320, 375, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1080 });
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }));
      report.responsive.push({ width, ...dimensions, overflow: dimensions.scroll > dimensions.viewport });
      assert.ok(dimensions.scroll <= dimensions.viewport, `horizontal overflow at ${width}: ${dimensions.scroll}`);
      if ([320, 768, 1024, 1440].includes(width)) await screenshot(page, `workspace-${width}.png`);
    }
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => ({ tag: document.activeElement.tagName, outline: getComputedStyle(document.activeElement).outlineStyle }));
    assert.notEqual(focused.tag, 'BODY');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
    report.keyboard = focused;
    const semantics = await page.evaluate(() => ({ nestedButtons: document.querySelectorAll('button button').length,
      unlabeledFields: [...document.querySelectorAll('input:not([type=hidden]),textarea,select')].filter(input => !input.labels?.length && !input.getAttribute('aria-label')).map(input => input.id),
      skipLink: Boolean(document.querySelector('.skip-link')) }));
    assert.equal(semantics.nestedButtons, 0); assert.deepEqual(semantics.unlabeledFields, []); assert.equal(semantics.skipLink, true);
    report.accessibility = { basicSemantics: semantics, axe: 'not installed' };
    try {
      const { default: AxeBuilder } = await import('@axe-core/playwright');
      const results = await new AxeBuilder({ page }).analyze();
      report.accessibility.axe = results.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.length }));
      assert.equal(results.violations.filter(item => ['serious', 'critical'].includes(item.impact)).length, 0);
    } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });
  await scenario('classroom uses public projection only and removes one-time credentials', async () => {
    const feed = await classroom();
    assert.equal(feed.readOnly, true); assert.equal(feed.containsStudentIdentity, false);
    const allowed = ['id', 'version', 'subject', 'title', 'details', 'due', 'duePrecision', 'status', 'updatedAt'];
    for (const assignment of feed.assignments) assert.ok(Object.keys(assignment).every(key => allowed.includes(key)));
    await page.getByRole('button', { name: '教室屏预览', exact: true }).click();
    await page.locator('#items .card').first().waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('haiz.classroom.handoff')), null);
    assert.equal(await page.locator('#key-input').inputValue(), '');
    assert.equal(new URL(page.url()).search, '');
    assert.equal(await page.locator('#items .card').count(), feed.assignments.length);
    assert.equal((await page.locator('#items').innerText()).includes('synthetic_student'), false);
    await screenshot(page, 'classroom-1440.png');
  });
  await scenario('withdrawal preserves history and browser-owned private note marker', async () => {
    assert.ok(official);
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    await studentPage.goto(origin);
    await studentPage.evaluate(() => localStorage.setItem('qa.synthetic.private-note', '学生自己的笔记，保留原文'));
    await page.goto(origin); await page.locator('#active-class').waitFor();
    await openOfficial(page, title);
    await page.locator('#published-detail').getByRole('button', { name: '撤回', exact: true }).click();
    await page.locator('#confirm-dialog[open]').waitFor();
    assert.match(await page.locator('#confirm-body').innerText(), /私人笔记不会删除/);
    await page.locator('#confirm-yes').click(); await settled(page);
    const retracted = await find(title); assert.equal(retracted.status, 'retracted'); assert.equal(retracted.version, 6);
    assert.equal((await studentAssignments()).some(item => item.id === official.id), false);
    assert.equal((await classroom()).assignments.some(item => item.id === official.id), false);
    const history = await f.teacher.call(`/api/v1/assignments/${official.id}/history?limit=200`);
    assert.equal(history.body.data.revisions.at(-1).operation, 'retract');
    assert.equal(history.body.data.revisions.length, 6);
    assert.equal(await studentPage.evaluate(() => localStorage.getItem('qa.synthetic.private-note')), '学生自己的笔记，保留原文');
    await page.locator('#history-detail').getByRole('button', { name: '版本历史', exact: true }).click(); await settled(page);
    assert.match(await page.locator('#history-detail .timeline').innerText(), /撤回作业/);
    await screenshot(page, 'withdrawal-history-1440.png');
    await studentContext.close();
    return { preservedNote: 'synthetic browser-owned marker only', actualFlutterStorage: 'not exercised' };
  });
  await scenario('unauthorized publication is denied by Academic', async () => {
    const response = await f.command(f.b, `/classes/${f.classroom.id}/assignments`, { subject: '越权', title: '不得发布', details: '', due: null, duePrecision: 'none' });
    assert.equal(response.status, 403);
  });
  await scenario('a different teacher cannot read or publish into this class', async () => {
    const teacher = await f.admin.call('/api/admin/teachers', 'POST', { login: 'synthetic_foreign_teacher', label: '虚构教师 B', password: PASSWORD });
    assert.equal(teacher.status, 201);
    const response = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 'synthetic_foreign_teacher', password: PASSWORD }) });
    const cookie = response.headers.get('set-cookie').split(';')[0];
    for (const method of ['GET', 'POST']) {
      const denied = await fetch(`${origin}/api/v1/classes/${f.classroom.id}/assignments`, { method,
        headers: { Cookie: cookie, 'Content-Type': 'application/json', 'Idempotency-Key': `foreign_teacher_${method}` },
        body: method === 'POST' ? JSON.stringify({ subject: '越权', title: '不得进入别班', details: '', due: null, duePrecision: 'none' }) : undefined });
      assert.equal(denied.status, 403);
    }
  });
  await scenario('changed Review content returns through draft and Review before publication', async () => {
    const original = '虚构验收 · Review 修订';
    await newDraft(page, original);
    await page.locator('#publish-draft').click(); await settled(page);
    await view(page, 'workspace');
    await page.locator('#draft-list .list-item').filter({ hasText: original }).getByRole('button').first().click();
    await page.locator('#f-details').fill('Review 后教师修改的最终内容');
    await page.locator('#publish-draft').click(); await settled(page);
    assert.equal((await find(original)).details, 'Review 后教师修改的最终内容');
    assert.equal((await find(original)).status, 'review');
    assert.equal((await find(original)).version, 4);
    await confirmPublication(page);
    assert.equal((await find(original)).version, 5);
    assert.equal((await studentAssignments()).find(item => item.title === original).details, 'Review 后教师修改的最终内容');
    await openOfficial(page, original);
    await page.locator('#published-detail').getByRole('button', { name: '修改内容' }).click();
    await page.locator('#f-details').fill('撤回后也必须保留的本机修改');
    await openOfficial(page, original);
    await page.locator('#published-detail').getByRole('button', { name: '撤回', exact: true }).click();
    await page.locator('#confirm-yes').click(); await settled(page);
    await view(page, 'workspace');
    await page.locator('#draft-list .list-item').filter({ hasText: original }).getByRole('button').first().click();
    assert.equal(await page.locator('#f-details').inputValue(), '撤回后也必须保留的本机修改');
  });
  await scenario('another-tab account switch suspends old workspace without submitting old drafts', async () => {
    await newDraft(page, '虚构验收 · 账号切换前草稿');
    const count = (await assignments()).length;
    await context.request.post(`${origin}/api/auth/login`, { data: { login: 'synthetic_admin', password: PASSWORD } });
    await page.locator('#publish-draft').click(); await settled(page);
    await page.locator('#entry').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#app').isVisible(), false);
    assert.equal((await assignments()).length, count);
    assert.ok(await page.evaluate(() => Object.values(localStorage).some(value => value.includes('账号切换前草稿'))));
    await page.locator('#login-account').fill('synthetic_teacher');
    await page.locator('#login-password').fill(PASSWORD);
    await page.locator('#login-form button[type=submit]').click();
    await page.locator('#active-class').waitFor(); await settled(page);
    assert.ok(await page.locator('#draft-list').getByText('虚构验收 · 账号切换前草稿', { exact: true }).count());
  });
  await scenario('late original-account response cannot write into a newly logged-in account', async () => {
    await newDraft(page, '虚构验收 · 延迟原账号响应');
    let release; let reached;
    const waiting = new Promise(resolve => { reached = resolve; });
    const held = new Promise(resolve => { release = resolve; });
    const pattern = '**/api/v1/classes/*/assignments';
    const intercept = async route => {
      if (route.request().method() !== 'POST') return route.continue();
      const response = await route.fetch(); reached();
      await held; await route.fulfill({ response });
    };
    await page.route(pattern, intercept);
    try {
      await page.locator('#publish-draft').click(); await waiting;
      await context.request.post(`${origin}/api/auth/login`, { data: { login: 'synthetic_admin', password: PASSWORD } });
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await page.locator('#entry').waitFor({ state: 'visible' });
      await page.locator('#login-account').fill('synthetic_admin');
      await page.locator('#login-password').fill(PASSWORD);
      await page.locator('#login-form button[type=submit]').click();
      await page.locator('#app').waitFor({ state: 'visible' });
      release(); await settled(page);
      const scope = await page.evaluate(async () => {
        const { data } = await (await fetch('/api/v1/identity')).json();
        return `${location.origin}/${data.instanceId}/${data.userId}`;
      });
      const adminDrafts = await page.evaluate(key => localStorage.getItem(key), `haiz.teacher.v3.drafts/${scope}`);
      assert.equal(adminDrafts?.includes('延迟原账号响应') ?? false, false);
      assert.equal((await assignments()).filter(item => item.title === '虚构验收 · 延迟原账号响应').length, 1);
    } finally { release?.(); await page.unroute(pattern, intercept); }
  });
  await scenario('offline preparation remains local and cannot publish', async () => {
    const offlineContext = await browser.newContext();
    const offlinePage = await offlineContext.newPage(); observe(offlinePage);
    await offlinePage.goto(origin);
    await offlinePage.locator('#offline-mode').click();
    await newDraft(offlinePage, '虚构离线草稿');
    assert.equal(await offlinePage.locator('#publish-draft').isDisabled(), true);
    await offlineContext.setOffline(true);
    await offlinePage.locator('#f-details').fill('网络断开时保存的本机内容');
    await offlinePage.locator('#save-draft').click(); await settled(offlinePage);
    assert.equal((await assignments()).some(item => item.title === '虚构离线草稿'), false);
    assert.match(await offlinePage.locator('#composer-status').innerText(), /本机草稿/);
    await screenshot(offlinePage, 'offline-local-draft.png');
    await offlineContext.close();
  });
  await scenario('audit P1-01 shared-cookie tabs invalidate on logout and disjoint-account login without reviving delayed data', async () => {
    const betaLogin = 'audit_beta_teacher';
    assert.equal((await f.admin.call('/api/admin/teachers', 'POST', { login: betaLogin, label: '虚构审计教师 beta', password: PASSWORD })).status, 201);
    const beta = client(f.service);
    assert.equal((await beta.call('/api/auth/login', 'POST', { login: betaLogin, password: PASSWORD })).status, 200);
    const betaClass = await beta.call('/api/classes', 'POST', { title: 'CLASS_BETA_ONLY' });
    assert.equal(betaClass.status, 201);
    const exclusive = await f.publish({ title: 'ALPHA_EXCLUSIVE_ASSIGNMENT', details: 'ALPHA_PROTECTED_DETAILS' });
    const shared = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
    const alphaPage = await shared.newPage(); observe(alphaPage);
    const betaPage = await shared.newPage(); observe(betaPage);
    let release;
    try {
      await login(alphaPage);
      await newDraft(alphaPage, 'ALPHA_SAVED_LOCAL_DRAFT');
      await alphaPage.locator('#f-details').fill('ALPHA_LOCAL_TEXT_MUST_SURVIVE');
      await newDraft(alphaPage, 'ALPHA_PENDING_COMMAND');
      const createPattern = '**/api/v1/classes/*/assignments';
      const loseCreate = async route => {
        if (route.request().method() !== 'POST') return route.continue();
        assert.equal((await route.fetch()).status(), 201);
        await route.abort('connectionreset');
      };
      await alphaPage.route(createPattern, loseCreate);
      await alphaPage.locator('#publish-draft').click(); await settled(alphaPage);
      await alphaPage.unroute(createPattern, loseCreate);
      assert.equal(await alphaPage.locator('#recovery button').count(), 1);
      await openOfficial(alphaPage, exclusive.title);
      assert.match(await alphaPage.locator('#published-detail').innerText(), /ALPHA_PROTECTED_DETAILS/);
      await betaPage.goto(origin); await betaPage.locator('#active-class').waitFor(); await settled(betaPage);
      let reached;
      const waiting = new Promise(resolve => { reached = resolve; });
      const held = new Promise(resolve => { release = resolve; });
      const listPattern = `**/api/v1/classes/${f.classroom.id}/assignments?*`;
      const holdRead = async route => {
        const response = await route.fetch(); reached();
        await held; await route.fulfill({ response });
      };
      await alphaPage.route(listPattern, holdRead);
      await alphaPage.getByRole('button', { name: '刷新列表', exact: true }).click();
      await waiting;
      await betaPage.locator('#logout').click();
      await betaPage.locator('#entry').waitFor({ state: 'visible' });
      await alphaPage.locator('#entry').waitFor({ state: 'visible' });
      assert.equal(await alphaPage.locator('#app').isVisible(), false);
      assert.equal(await alphaPage.locator('#published-detail').textContent(), '');
      await betaPage.locator('#login-account').fill(betaLogin);
      await betaPage.locator('#login-password').fill(PASSWORD);
      await betaPage.locator('#login-form button[type=submit]').click();
      await betaPage.locator('#active-class').waitFor(); await settled(betaPage);
      assert.equal(await betaPage.locator('#active-class option:checked').innerText(), 'CLASS_BETA_ONLY');
      assert.equal(await betaPage.locator('#draft-list').getByText('ALPHA_SAVED_LOCAL_DRAFT', { exact: true }).count(), 0);
      assert.equal(await betaPage.locator('#recovery button').count(), 0);
      assert.equal((await shared.request.get(`${origin}/api/v1/classes/${f.classroom.id}/assignments`)).status(), 403);
      const betaScope = await betaPage.evaluate(async () => {
        const { data } = await (await fetch('/api/v1/identity')).json();
        return `${location.origin}/${data.instanceId}/${data.userId}`;
      });
      const betaJournal = await betaPage.evaluate(scope => localStorage.getItem(`haiz.teacher.v3.commands/${encodeURIComponent(scope)}`), betaScope);
      assert.equal(betaJournal?.includes('ALPHA_PENDING_COMMAND') ?? false, false);
      release(); await settled(alphaPage);
      await alphaPage.unroute(listPattern, holdRead);
      assert.equal(await alphaPage.locator('#app').isVisible(), false);
      assert.equal(await alphaPage.locator('#published-list').textContent(), '');
      assert.equal(await alphaPage.locator('#published-detail').textContent(), '');
      await alphaPage.locator('#login-account').fill('synthetic_teacher');
      await alphaPage.locator('#login-password').fill(PASSWORD);
      await alphaPage.locator('#login-form button[type=submit]').click();
      await alphaPage.locator('#active-class').waitFor(); await settled(alphaPage);
      await view(alphaPage, 'workspace');
      await alphaPage.locator('#draft-list .list-item').filter({ hasText: 'ALPHA_SAVED_LOCAL_DRAFT' }).getByRole('button').first().click();
      assert.equal(await alphaPage.locator('#f-title').inputValue(), 'ALPHA_SAVED_LOCAL_DRAFT');
      assert.equal(await alphaPage.locator('#f-details').inputValue(), 'ALPHA_LOCAL_TEXT_MUST_SURVIVE');
      assert.equal(await alphaPage.locator('#recovery button').count(), 1);
      return { sharedCookieTabs: 2, disjointClassIds: [f.classroom.id, betaClass.body.id], delayedReadDiscarded: true, alphaDraftTextRestored: true, betaDeniedAlphaClass: true };
    } finally { release?.(); await shared.close(); }
  });
  await scenario('audit P1-02 exact unsent title and details survive view changes, reload, and reopening unchanged official version', async () => {
    const assignment = await f.publish({ title: 'AUDIT_LOCAL_EDIT_ORIGINAL', details: 'SERVER_ORIGINAL_DETAILS' });
    const editContext = await browser.newContext();
    const editPage = await editContext.newPage(); observe(editPage);
    try {
      await login(editPage);
      await openOfficial(editPage, assignment.title);
      await editPage.locator('#published-detail').getByRole('button', { name: '修改内容' }).click();
      await editPage.locator('#f-title').fill('ALPHA_UNSAVED_EDIT');
      await openOfficial(editPage, assignment.title);
      await editPage.locator('#published-detail').getByRole('button', { name: '修改内容' }).click();
      assert.equal(await editPage.locator('#f-title').inputValue(), 'ALPHA_UNSAVED_EDIT');
      await editPage.locator('#f-details').fill('ALPHA_UNSAVED_DETAILS_AFTER_RELOAD');
      await editPage.reload(); await editPage.locator('#active-class').waitFor(); await settled(editPage);
      await openOfficial(editPage, assignment.title);
      await editPage.locator('#published-detail').getByRole('button', { name: '修改内容' }).click();
      assert.equal(await editPage.locator('#f-title').inputValue(), 'ALPHA_UNSAVED_EDIT');
      assert.equal(await editPage.locator('#f-details').inputValue(), 'ALPHA_UNSAVED_DETAILS_AFTER_RELOAD');
      assert.equal(await editPage.locator('#conflict-dialog[open]').count(), 0);
      const serverCopy = (await f.teacher.call(`/api/v1/assignments/${assignment.id}`)).body.data.assignment;
      assert.equal(serverCopy.title, 'AUDIT_LOCAL_EDIT_ORIGINAL'); assert.equal(serverCopy.version, assignment.version);
    } finally { await editContext.close(); }
  });
  await scenario('audit P1-02 reopening after a server revision compares versions without replacing local text', async () => {
    const assignment = await f.publish({ title: 'AUDIT_CHANGED_VERSION_ORIGINAL', details: 'SERVER_BEFORE_REVISION' });
    const editContext = await browser.newContext();
    const editPage = await editContext.newPage(); observe(editPage);
    try {
      await login(editPage); await openOfficial(editPage, assignment.title);
      await editPage.locator('#published-detail').getByRole('button', { name: '修改内容' }).click();
      await editPage.locator('#f-title').fill('ALPHA_VERSIONED_UNSENT_TITLE');
      await editPage.locator('#f-details').fill('ALPHA_VERSIONED_UNSENT_DETAILS');
      const revision = await f.command(f.teacher, `/assignments/${assignment.id}`, { expectedVersion: assignment.version, details: 'REMOTE_NEW_VERSION_DETAILS' }, 'PATCH');
      assert.equal(revision.status, 200);
      await editPage.reload(); await editPage.locator('#active-class').waitFor(); await settled(editPage);
      await openOfficial(editPage, assignment.title);
      await editPage.locator('#published-detail').getByRole('button', { name: '修改内容' }).click();
      await editPage.locator('#conflict-dialog[open]').waitFor();
      const comparison = await editPage.locator('#conflict-body').innerText();
      assert.match(comparison, /ALPHA_VERSIONED_UNSENT_TITLE/);
      assert.match(comparison, /ALPHA_VERSIONED_UNSENT_DETAILS/);
      assert.match(comparison, /REMOTE_NEW_VERSION_DETAILS/);
      await editPage.locator('#conflict-discard').click();
      assert.equal(await editPage.locator('#f-title').inputValue(), 'ALPHA_VERSIONED_UNSENT_TITLE');
      assert.equal(await editPage.locator('#f-details').inputValue(), 'ALPHA_VERSIONED_UNSENT_DETAILS');
      assert.equal((await f.teacher.call(`/api/v1/assignments/${assignment.id}`)).body.data.assignment.version, revision.body.data.assignment.version);
    } finally { await editContext.close(); }
  });
  await scenario('audit P1-02 discarding an unsent edit requires confirmation and only then restores server content', async () => {
    const assignment = await f.publish({ title: 'AUDIT_DISCARD_ORIGINAL', details: 'SERVER_DISCARD_DETAILS' });
    const editContext = await browser.newContext();
    const editPage = await editContext.newPage(); observe(editPage);
    try {
      await login(editPage); await openOfficial(editPage, assignment.title);
      await editPage.locator('#published-detail').getByRole('button', { name: '修改内容' }).click();
      await editPage.locator('#f-title').fill('ALPHA_EXPLICIT_DISCARD_TEXT');
      await editPage.locator('#discard-draft').click(); await editPage.locator('#confirm-dialog[open]').waitFor();
      await editPage.locator('#confirm-no').click(); await settled(editPage);
      assert.equal(await editPage.locator('#f-title').inputValue(), 'ALPHA_EXPLICIT_DISCARD_TEXT');
      await openOfficial(editPage, assignment.title);
      await editPage.locator('#published-detail').getByRole('button', { name: '修改内容' }).click();
      assert.equal(await editPage.locator('#f-title').inputValue(), 'ALPHA_EXPLICIT_DISCARD_TEXT');
      await editPage.locator('#discard-draft').click(); await editPage.locator('#confirm-dialog[open]').waitFor();
      await editPage.locator('#confirm-yes').click(); await settled(editPage);
      await openOfficial(editPage, assignment.title);
      await editPage.locator('#published-detail').getByRole('button', { name: '修改内容' }).click();
      assert.equal(await editPage.locator('#f-title').inputValue(), 'AUDIT_DISCARD_ORIGINAL');
      assert.equal(await editPage.locator('#f-details').inputValue(), 'SERVER_DISCARD_DETAILS');
    } finally { await editContext.close(); }
  });
  await scenario('audit P1-02 failed local persistence reports the error and retains typed text without submitting', async () => {
    const assignment = await f.publish({ title: 'AUDIT_STORAGE_FAILURE_ORIGINAL' });
    const editContext = await browser.newContext();
    const editPage = await editContext.newPage(); observe(editPage);
    try {
      await login(editPage); await openOfficial(editPage, assignment.title);
      await editPage.locator('#published-detail').getByRole('button', { name: '修改内容' }).click();
      await editPage.evaluate(() => {
        const originalSetItem = Storage.prototype.setItem;
        globalThis.restoreAuditStorage = () => { Storage.prototype.setItem = originalSetItem; };
        Storage.prototype.setItem = function (key, value) {
          if (key.startsWith('haiz.teacher.v3.drafts/')) throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
          return originalSetItem.call(this, key, value);
        };
      });
      await editPage.locator('#f-title').fill('ALPHA_TYPED_DURING_STORAGE_FAILURE');
      await editPage.locator('#f-details').fill('ALPHA_DETAILS_DURING_STORAGE_FAILURE');
      assert.match(await editPage.locator('#notices').innerText(), /本机保存失败/);
      assert.equal(await editPage.locator('#f-title').inputValue(), 'ALPHA_TYPED_DURING_STORAGE_FAILURE');
      assert.equal(await editPage.locator('#f-details').inputValue(), 'ALPHA_DETAILS_DURING_STORAGE_FAILURE');
      assert.equal((await f.teacher.call(`/api/v1/assignments/${assignment.id}`)).body.data.assignment.title, assignment.title);
      await editPage.evaluate(() => globalThis.restoreAuditStorage());
      await editPage.locator('#save-draft').click(); await settled(editPage);
      await openOfficial(editPage, assignment.title);
      await editPage.locator('#published-detail').getByRole('button', { name: '修改内容' }).click();
      assert.equal(await editPage.locator('#f-title').inputValue(), 'ALPHA_TYPED_DURING_STORAGE_FAILURE');
      assert.equal(await editPage.locator('#f-details').inputValue(), 'ALPHA_DETAILS_DURING_STORAGE_FAILURE');
    } finally { await editContext.close(); }
  });
  report.performance = await page.evaluate(() => ({ paint: performance.getEntriesByType('paint').map(entry => ({ name: entry.name, startTime: entry.startTime })),
    navigation: performance.getEntriesByType('navigation').map(entry => ({ duration: entry.duration, domContentLoaded: entry.domContentLoadedEventEnd })) }));
  await context.close();
  await browser.close(); browser = null;
}

async function start() {
  await mkdir(evidenceDirectory, { recursive: true });
  const f = await fixture({ after: dispose => cleanups.push(dispose) });
  server = createTeacherServer({ academicOrigin: f.service.root });
  server.listen(port, '127.0.0.1'); await once(server, 'listening');
  process.stdout.write(`[HAIZ Teacher QA] ${origin} · temporary synthetic Academic database\n`);
  try { await runBrowser(f); }
  catch (error) { report.fatal = error.stack ?? String(error); process.stderr.write(`[Teacher QA] ${report.fatal}\n`); }
  report.status = report.fatal || report.scenarios.some(item => item.status === 'failed') ? 'failed' : 'passed';
  report.finishedAt = new Date().toISOString();
  await writeFile(join(evidenceDirectory, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(`[HAIZ Teacher QA result] ${JSON.stringify(report)}\n`);
  if (process.argv.includes('--serve')) {
    process.stdout.write(`[HAIZ Teacher QA] server remains available at ${origin}; SIGTERM removes its temporary database.\n`);
  } else {
    await cleanup();
    process.exitCode = report.status === 'passed' ? 0 : 1;
  }
}
start().catch(async error => {
  process.stderr.write(`${error.stack ?? error}\n`);
  await cleanup(); process.exitCode = 1;
});
