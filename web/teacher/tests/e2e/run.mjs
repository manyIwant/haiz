import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createTeacherServer } from '../../server.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const teacherRoot = resolve(__dirname, '../..');
const academicRoot = resolve(teacherRoot, '../../services/academic');

const PASSWORD = 'SyntheticTestPassword2026!';
const CHROMIUM_EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (existsSync('/Users/a11/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell')
    ? '/Users/a11/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell'
    : undefined);

async function unusedPort() {
  const s = createServer();
  s.listen(0, '127.0.0.1');
  await once(s, 'listening');
  const port = s.address().port;
  await new Promise(r => s.close(r));
  return port;
}

async function startAcademic(dbPath, port) {
  const child = spawn(process.execPath, [join(academicRoot, 'server.mjs')], {
    cwd: academicRoot,
    env: {
      ...process.env,
      HAIZ_DB_PATH: dbPath,
      HAIZ_HOST: '127.0.0.1',
      HAIZ_PORT: String(port),
      HAIZ_ADMIN_LOGIN: 'synthetic_admin',
      HAIZ_ADMIN_PASSWORD: PASSWORD,
      HAIZ_QQ_RELAY_SECRET: '',
      HAIZ_SCHOOL_ROSTER_SECRET: '',
      HAIZ_SCHOOL_ISSUER: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  await new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Academic startup timed out: ${output}`));
    }, 12000);
    const collect = chunk => {
      output += chunk.toString();
      if (output.includes(`http://127.0.0.1:${port}`)) {
        clearTimeout(timer);
        resolveReady();
      }
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.once('error', err => { clearTimeout(timer); reject(err); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Academic exited: ${code}`)); });
  });

  return {
    port,
    origin: `http://127.0.0.1:${port}`,
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await exited;
    },
  };
}

async function startTeacher(academicOrigin, port) {
  const server = createTeacherServer({ academicOrigin });
  server.listen(port, '127.0.0.1');
  await once(server, 'listening');
  return {
    port,
    origin: `http://127.0.0.1:${port}`,
    async stop() {
      await new Promise(r => server.close(r));
    },
  };
}

function makeClient(origin) {
  let cookie = '';
  return {
    async call(path, method = 'GET', data, headers = {}) {
      const response = await fetch(origin + path, {
        method,
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      const session = response.headers.get('set-cookie');
      if (session?.startsWith('hsid=')) cookie = session.split(';')[0];
      const body = await response.json();
      return { status: response.status, body, headers: response.headers };
    },
  };
}

async function runTests() {
  console.log('[E2E] Starting test environment...');
  const tmpDir = mkdtempSync(join(tmpdir(), 'haiz-teacher-e2e-'));
  const dbPath = join(tmpDir, 'academic.sqlite');
  const academicPort = await unusedPort();
  const teacherPort = await unusedPort();

  const academic = await startAcademic(dbPath, academicPort);
  console.log(`[E2E] Academic running at ${academic.origin}`);
  const teacher = await startTeacher(academic.origin, teacherPort);
  console.log(`[E2E] Teacher Web proxy running at ${teacher.origin}`);

  // Seed Admin, Teacher, Classes, Students
  const adminClient = makeClient(academic.origin);
  const loginRes = await adminClient.call('/api/auth/login', 'POST', { login: 'synthetic_admin', password: PASSWORD });
  assert.equal(loginRes.status, 200, 'Admin login failed');

  // Create Teacher
  const createTeacherRes = await adminClient.call('/api/admin/teachers', 'POST', {
    login: 'synthetic_teacher',
    label: '虚构张老师',
    password: PASSWORD,
  });
  assert.equal(createTeacherRes.status, 201, 'Create teacher failed');

  // Teacher logs in to create classes
  const teacherClient = makeClient(academic.origin);
  await teacherClient.call('/api/auth/login', 'POST', { login: 'synthetic_teacher', password: PASSWORD });
  const classARes = await teacherClient.call('/api/classes', 'POST', { title: '高一物理实验班' });
  assert.equal(classARes.status, 201);
  const classA = classARes.body;

  const classBRes = await teacherClient.call('/api/classes', 'POST', { title: '高一化学平行班' });
  assert.equal(classBRes.status, 201);
  const classB = classBRes.body;

  // Enroll Student A in Class A
  const studentA = makeClient(academic.origin);
  await studentA.call('/api/auth/register', 'POST', {
    login: 'student_alpha', label: '学生甲', password: PASSWORD, joinCode: classA.joinCode,
  });
  const meA = await studentA.call('/api/me');
  await teacherClient.call(`/api/classes/${classA.id}/members/${meA.body.user.id}/approve`, 'POST', {});

  // Enroll Student B in Class B
  const studentB = makeClient(academic.origin);
  await studentB.call('/api/auth/register', 'POST', {
    login: 'student_beta', label: '学生乙', password: PASSWORD, joinCode: classB.joinCode,
  });
  const meB = await studentB.call('/api/me');
  await teacherClient.call(`/api/classes/${classB.id}/members/${meB.body.user.id}/approve`, 'POST', {});

  // Launch Playwright Browser
  const browser = await chromium.launch({
    executablePath: CHROMIUM_EXECUTABLE,
    headless: true,
  });
  console.log('[E2E] Headless Chromium launched successfully.');

  let passed = 0;
  let failed = 0;

  async function scenario(name, fn) {
    process.stdout.write(`  ▶ Scenario: ${name}... `);
    try {
      await fn();
      console.log('✔ PASS');
      passed++;
    } catch (err) {
      console.log('✖ FAIL');
      console.error(err);
      failed++;
    }
  }

  try {
    // SCENARIO 1: 正常创建草稿
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(teacher.origin);

    await scenario('1. 正常创建草稿 (Create draft normally)', async () => {
      // Login
      await page.fill('#login-account', 'synthetic_teacher');
      await page.fill('#login-password', PASSWORD);
      await page.click('button[type="submit"]');

      // Wait for app shell
      await page.waitForSelector('#app:not([hidden])');
      assert.equal(await page.textContent('#who-name'), '教师');

      // Select Class A in toolbar
      await page.selectOption('#active-class', classA.id);

      // Create new draft
      await page.click('#new-draft');
      await page.waitForSelector('#composer-form:not([hidden])');

      await page.fill('#f-subject', '物理');
      await page.fill('#f-title', '必修一练习题 1-5');
      await page.fill('#f-details', '请独立完成第 36 页练习题并在下周一提交');
      await page.selectOption('#f-due-precision', 'date');
      await page.fill('#f-due-date', '2026-11-02');

      await page.click('#save-draft');

      // Verify draft in list
      const draftTitle = await page.textContent('#draft-list .item-title');
      assert.ok(draftTitle.includes('必修一练习题 1-5'));
      const chipText = await page.textContent('#draft-list .status');
      assert.ok(chipText.includes('本机草稿'));

      // Verify preview
      const previewText = await page.textContent('#preview-panel');
      assert.ok(previewText.includes('物理'));
      assert.ok(previewText.includes('必修一练习题 1-5'));
      assert.ok(previewText.includes('2026 年 11 月 2 日'));

      // Verify published list has 0 items
      assert.equal(await page.textContent('[data-view-count="published"]'), '0');
    });

    // SCENARIO 2: 草稿进入 Review
    await scenario('2. 草稿进入 Review (Draft enters review)', async () => {
      await page.click('#publish-draft'); // Button says "进入 Review"

      // Notice announces review state
      await page.waitForSelector('#notices .notice');
      const noticeTitle = await page.textContent('#notices h3');
      assert.ok(noticeTitle.includes('Review') || noticeTitle.includes('等待教师确认'));

      // Detail in history shows status "待发布 · 服务器"
      const statusChip = await page.textContent('#history-detail .status');
      assert.ok(statusChip.includes('待发布') || statusChip.includes('服务器'));
    });

    // SCENARIO 3: 正式发布成功
    await scenario('3. 正式发布成功 (Publish successfully)', async () => {
      // In detail view, click "确认发布"
      await page.click('#history-detail button.confirm');

      // Dialog opens
      await page.waitForSelector('#confirm-dialog[open]');
      assert.ok((await page.textContent('#confirm-title')).includes('正式发布'));

      // Confirm
      await page.click('#confirm-yes');
      await page.waitForFunction(() => !document.getElementById('confirm-dialog')?.open);

      // Published notice appears
      await page.waitForSelector('#notices .notice[data-tone="ok"]');
      const noticeText = await page.textContent('#notices h3');
      assert.ok(noticeText.includes('已确认发布'));

      // Shows up in published view
      await page.click('[data-view="published"]');
      const publishedItem = await page.textContent('#published-list .item-title');
      assert.ok(publishedItem.includes('必修一练习题 1-5'));

      // Verify Student A can query published assignment
      const studentRes = await studentA.call(`/api/v1/classes/${classA.id}/assignments`);
      assert.equal(studentRes.status, 200);
      assert.equal(studentRes.body.data.assignments.length, 1);
      assert.equal(studentRes.body.data.assignments[0].title, '必修一练习题 1-5');
      assert.equal(studentRes.body.data.assignments[0].status, 'published');
    });

    // SCENARIO 4: 发布请求超时后的安全重试
    await scenario('4. 发布请求超时后的安全重试 (Idempotent retry after timeout)', async () => {
      // Direct verification via Academic API contract:
      // Sending same command with same idempotency key returns replayed: true and creates NO second assignment
      const key = 'synthetic_test_key_replay_001';
      const body = { subject: '物理', title: '探究加速度实验', details: '', due: null, duePrecision: 'none' };
      const res1 = await teacherClient.call(`/api/v1/classes/${classA.id}/assignments`, 'POST', body, { 'Idempotency-Key': key });
      assert.equal(res1.status, 201);
      assert.equal(res1.body.data.replayed, false);
      const id1 = res1.body.data.assignment.id;

      // Replay same key and body
      const res2 = await teacherClient.call(`/api/v1/classes/${classA.id}/assignments`, 'POST', body, { 'Idempotency-Key': key });
      assert.equal(res2.status, 201);
      assert.equal(res2.body.data.replayed, true);
      assert.equal(res2.body.data.assignment.id, id1);

      // Verify list on server still has only expected assignments
      const list = await teacherClient.call(`/api/v1/classes/${classA.id}/assignments`);
      const matches = list.body.data.assignments.filter(a => a.id === id1);
      assert.equal(matches.length, 1, 'Idempotent key must not duplicate assignment');
    });

    // SCENARIO 5: 编辑已发布作业
    await scenario('5. 编辑已发布作业 (Edit published assignment)', async () => {
      // In published view, click the assignment
      await page.click('#published-list .list-item');
      await page.waitForSelector('#published-detail article');

      // Click "修改内容"
      await page.click('#published-detail button.secondary');

      // In editor, update details and title
      await page.fill('#f-title', '必修一练习题 1-5（已更新补充题）');
      await page.click('#save-edit');

      // Wait for success notice
      await page.waitForSelector('#notices .notice[data-tone="ok"]');
      const noticeMsg = await page.textContent('#notices p');
      assert.ok(noticeMsg.includes('v4'), 'Version should increment to v4');

      // Verify Student A sees revised title and v4
      const studentRes = await studentA.call(`/api/v1/classes/${classA.id}/assignments`);
      const updated = studentRes.body.data.assignments.find(a => a.title.includes('已更新补充题'));
      assert.ok(updated, 'Student must see revised assignment');
      assert.equal(updated.version, 4);
      assert.equal(updated.status, 'revised');
    });

    // SCENARIO 6: 两个页面同时修改时产生版本冲突
    await scenario('6. 两个页面同时修改时产生版本冲突 (Version conflict detection)', async () => {
      // Context 2 (second browser tab/window)
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await page2.goto(teacher.origin);
      await page2.fill('#login-account', 'synthetic_teacher');
      await page2.fill('#login-password', PASSWORD);
      await page2.click('button[type="submit"]');
      await page2.waitForSelector('#app:not([hidden])');

      // Both pages open the published assignment (v4)
      await page.click('[data-view="published"]');
      await page.click('#published-list .list-item');
      await page.click('#published-detail button.secondary'); // Page 1 starts editing v4

      await page2.click('[data-view="published"]');
      await page2.click('#published-list .list-item');
      await page2.click('#published-detail button.secondary'); // Page 2 starts editing v4

      // Page 1 saves change to "标题 A" -> advances to v5
      await page.fill('#f-title', '必修一练习题（教师 A 修改）');
      await page.click('#save-edit');
      await page.waitForSelector('#notices .notice[data-tone="ok"]');

      // Page 2 tries to save "标题 B" based on stale v4
      await page2.fill('#f-title', '必修一练习题（教师 B 修改）');
      await page2.click('#save-edit');

      // Page 2 should trigger the conflict dialog!
      await page2.waitForSelector('#conflict-dialog[open]');
      const conflictTitle = await page2.textContent('#conflict-title');
      assert.ok(conflictTitle.includes('冲突'));

      // Check conflict diff table
      const diffContent = await page2.textContent('#conflict-body');
      assert.ok(diffContent.includes('教师 A 修改'));
      assert.ok(diffContent.includes('教师 B 修改'));

      // Teacher B clicks "使用最新版本继续检查"
      await page2.click('#conflict-retry');
      await page2.waitForFunction(() => !document.getElementById('conflict-dialog')?.open);

      // Re-submit on top of v5 -> becomes v6!
      await page2.click('#save-edit');
      await page2.waitForSelector('#notices .notice[data-tone="ok"]');
      const noticeMsg = await page2.textContent('#notices p');
      assert.ok(noticeMsg.includes('v6'), 'Resolved version should advance to v6');

      await context2.close();
    });

    // SCENARIO 7: 作业撤回
    await scenario('7. 作业撤回 (Assignment retract)', async () => {
      // In published view, refresh list to get latest server version after Scenario 6
      await page.click('button:has-text("刷新列表")');
      await page.click('[data-view="published"]');
      await page.click('#published-list .list-item');

      // Click "撤回"
      await page.click('#published-detail button.danger');
      await page.waitForSelector('#confirm-dialog[open]');
      assert.ok((await page.textContent('#confirm-title')).includes('撤回'));

      // Confirm retract
      await page.click('#confirm-yes');
      await page.waitForFunction(() => !document.getElementById('confirm-dialog')?.open);

      // Verify notice
      await page.waitForFunction(() => document.querySelector('#notices h3')?.textContent.includes('撤回'));
      const msg = await page.textContent('#notices h3');
      assert.ok(msg.includes('确认撤回'));

      // Live list in published view should not have active tasks
      assert.equal(await page.textContent('[data-view-count="published"]'), '0');

      // Retracted assignment appears in history view
      await page.click('[data-view="history"]');
      const historyItem = await page.textContent('#history-list');
      assert.ok(historyItem.includes('已撤回'));

      // Timeline shows full history
      await page.click('#history-list .list-item:has-text("已撤回")');
      await page.click('#history-detail button.quiet:has-text("版本历史")');
      await page.waitForSelector('#history-detail .timeline li');
      const timelineText = await page.textContent('#history-detail .timeline');
      assert.ok(timelineText.includes('撤回作业'));
      assert.ok(timelineText.includes('修改内容'));
      assert.ok(timelineText.includes('正式发布'));
    });

    // SCENARIO 8: 无权限用户无法发布
    await scenario('8. 无权限用户无法发布 (Unauthorized user cannot publish)', async () => {
      const studentContext = await browser.newContext();
      const studentPage = await studentContext.newPage();
      await studentPage.goto(teacher.origin);

      // Student attempts to log in to teacher workspace
      await studentPage.fill('#login-account', 'student_alpha');
      await studentPage.fill('#login-password', PASSWORD);
      await studentPage.click('button[type="submit"]');

      // Error message shown
      await studentPage.waitForSelector('#login-error:not([hidden])');
      const errorMsg = await studentPage.textContent('#login-error');
      assert.ok(errorMsg.includes('教师') || errorMsg.includes('权限'));

      // Direct API attempt from student
      const direct = await studentA.call(`/api/v1/classes/${classA.id}/assignments`, 'POST', {
        subject: '黑客', title: '未经授权的作业', details: '', due: null, duePrecision: 'none'
      }, { 'Idempotency-Key': 'unauthorized_attempt_key_01' });
      assert.equal(direct.status, 403, 'Student cannot create assignment via API');

      await studentContext.close();
    });

    // SCENARIO 9: 不同班级的数据隔离
    await scenario('9. 不同班级的数据隔离 (Class data isolation)', async () => {
      // Create and publish an assignment for Class B
      const draftB = await teacherClient.call(`/api/v1/classes/${classB.id}/assignments`, 'POST', {
        subject: '化学', title: '有机化合物结构式绘制', details: '仅限化学班', due: null, duePrecision: 'none'
      }, { 'Idempotency-Key': 'class_b_assignment_key_001' });
      const bId = draftB.body.data.assignment.id;
      const bVer = draftB.body.data.assignment.version;
      const revB = await teacherClient.call(`/api/v1/assignments/${bId}/review`, 'POST', { expectedVersion: bVer }, { 'Idempotency-Key': 'class_b_review_key_001' });
      await teacherClient.call(`/api/v1/assignments/${bId}/publish`, 'POST', { expectedVersion: revB.body.data.assignment.version }, { 'Idempotency-Key': 'class_b_publish_key_001' });

      // Student A (enrolled in Class A) queries Class A -> does NOT see Class B assignment
      const resA = await studentA.call(`/api/v1/classes/${classA.id}/assignments`);
      assert.ok(!resA.body.data.assignments.some(a => a.title.includes('有机化合物')));

      // Student A tries to query Class B -> rejected 403
      const crossRes = await studentA.call(`/api/v1/classes/${classB.id}/assignments`);
      assert.equal(crossRes.status, 403, 'Cross-class access must be forbidden');

      // Student B (enrolled in Class B) queries Class B -> sees Class B assignment
      const resB = await studentB.call(`/api/v1/classes/${classB.id}/assignments`);
      assert.ok(resB.body.data.assignments.some(a => a.title.includes('有机化合物')));
    });

    // SCENARIO 10: 页面刷新后正式作业仍然存在
    await scenario('10. 页面刷新后正式作业仍然存在 (Persistence across refresh)', async () => {
      await page.reload();
      await page.waitForSelector('#app:not([hidden])');
      assert.equal(await page.textContent('#who-name'), '教师');

      // Switch to Class B
      await page.selectOption('#active-class', classB.id);
      await page.click('[data-view="published"]');
      const item = await page.textContent('#published-list .item-title');
      assert.ok(item.includes('有机化合物结构式绘制'), 'Published assignment must survive reload');
    });

    // SCENARIO 11: 离线草稿不会被误认为已发布
    await scenario('11. 离线草稿不会被误认为已发布 (Offline draft is never confused with published)', async () => {
      const offlineContext = await browser.newContext();
      const offlinePage = await offlineContext.newPage();
      await offlinePage.goto(teacher.origin);

      // Click "离线整理本机草稿"
      await offlinePage.click('#offline-mode');
      await offlinePage.waitForSelector('#app:not([hidden])');
      assert.equal(await offlinePage.textContent('#who-name'), '离线整理');

      // Notice reminds offline mode
      const offlineNotice = await offlinePage.textContent('#notices');
      assert.ok(offlineNotice.includes('离线整理模式'));

      // Create offline draft
      await offlinePage.click('#new-draft');
      await offlinePage.fill('#f-subject', '生物');
      await offlinePage.fill('#f-title', '显微镜观察细胞有丝分裂草稿');
      await offlinePage.click('#save-draft');

      // Draft has chip "本机草稿"
      const chip = await offlinePage.textContent('#draft-list .status');
      assert.ok(chip.includes('本机草稿'));

      // Publish button is disabled in offline mode
      const publishDisabled = await offlinePage.isDisabled('#publish-draft');
      assert.equal(publishDisabled, true, 'Publish must be disabled in offline mode');

      // Published count remains 0
      assert.equal(await offlinePage.textContent('[data-view-count="published"]'), '0');

      // Server has not received this draft
      const serverList = await teacherClient.call(`/api/v1/classes/${classA.id}/assignments`);
      assert.ok(!serverList.body.data.assignments.some(a => a.title.includes('显微镜观察')));

      await offlineContext.close();
    });

    // SCENARIO 12: Classroom 不泄露学生私人数据
    await scenario('12. Classroom 不泄露学生私人数据 (Classroom leaks no private data)', async () => {
      const roomContext = await browser.newContext();
      const roomPage = await roomContext.newPage();

      // Get screen key for Class B (which has the active chemistry assignment)
      const screenKey = classB.screenKey;
      assert.ok(screenKey && screenKey.length === 96);

      // Open classroom page directly
      await roomPage.goto(`${teacher.origin}/classroom.html`);
      await roomPage.waitForSelector('#connection:not([hidden])');

      // Enter screen key
      await roomPage.fill('#key-input', screenKey);
      await roomPage.click('#load');

      // Cards render
      await roomPage.waitForSelector('#items article.card');
      const title = await roomPage.textContent('#classroom-name');
      assert.equal(title, '高一化学平行班');

      const cardText = await roomPage.textContent('#items');
      assert.ok(cardText.includes('有机化合物结构式绘制'));

      // Inspect HTML to verify NO student identities, completion checks or personal notes
      assert.ok(!cardText.includes('学生甲'));
      assert.ok(!cardText.includes('学生乙'));
      assert.ok(!cardText.includes('student_alpha'));
      assert.ok(!cardText.includes('student_beta'));
      assert.ok(!cardText.includes('完成'));
      assert.ok(!cardText.includes('提交'));

      // Verify direct API projection guarantees
      const directFeed = await fetch(`${academic.origin}/api/v1/classroom`, {
        headers: { Authorization: `Bearer ${screenKey}` }
      });
      const feedJson = await directFeed.json();
      assert.equal(feedJson.data.readOnly, true);
      assert.equal(feedJson.data.containsStudentIdentity, false);
      for (const a of feedJson.data.assignments) {
        assert.equal(a.classId, undefined);
        assert.equal(a.createdBy, undefined);
        assert.equal(a.source, undefined);
      }

      await roomContext.close();
    });

    await context.close();
  } finally {
    await browser.close();
    await teacher.stop();
    await academic.stop();
    rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log(`\n========================================`);
  console.log(`E2E Summary: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('[E2E Fatal Error]', err);
  process.exit(1);
});
