import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../src/tools/model.js';
import { parseCapture } from '../src/tools/capture.js';
import { SUBJECTS as coreSubjects } from '../public/haiz/world/homework-core.js';

const {
  SUBJECTS, today, createTask, updateTask, toggleTask, publishDraft, withdrawPublication,
  publicProjection, exportPublicBundle, importPublicBundle, publicationText,
} = model;
const DATE = '2026-10-27';
const PRIVATE = '私密来源及学生接力内容不能公开';
const item = (patch = {}) => ({ id: 'item-1', subject: '数学', content: '完成第 3 页', studyDate: DATE, due: '', materials: '', ...patch });
const draft = (patch = {}) => ({ scope: '高一（1）班', source: PRIVATE, items: [item()], ...patch });
const firstPublication = () => publishDraft(draft(), [], true)[0];
const bundle = publications => ({ format: 'haiz-tools-public', version: 1, publications });
const clone = value => structuredClone(value);

function assertPublicSnapshot(value) {
  assert.deepEqual(Object.keys(value).sort(), ['id', 'items', 'publishedAt', 'scope', 'status', 'version'].sort());
  for (const entry of value.items) {
    assert.deepEqual(Object.keys(entry).sort(), ['id', 'subject', 'content', 'studyDate', 'due', 'materials'].sort());
  }
}

test('model exports the agreed API and reuses the shared subjects and Shanghai date', t => {
  assert.deepEqual(Object.keys(model).sort(), [
    'PUBLIC_BUNDLE_MAX_BYTES', 'SUBJECTS', 'today', 'createTask', 'updateTask', 'toggleTask', 'publishDraft',
    'withdrawPublication', 'publicProjection', 'exportPublicBundle', 'importPublicBundle', 'publicationText',
  ].sort());
  assert.equal(SUBJECTS, coreSubjects);
  t.mock.method(Date, 'now', () => Date.parse('2026-10-27T16:30:00Z'));
  assert.equal(today(), '2026-10-28');
  assert.equal(createTask({ title: '读书' }).date, '2026-10-28');
});

test('tasks get independent identity and relay state, with optional source metadata', () => {
  const task = createTask({ title: '  阅读课文  ', date: DATE, sourceId: 'publication-1', sourceVersion: 2 });
  assert.equal(task.title, '阅读课文');
  assert.equal(task.subject, '其他');
  assert.equal(task.date, DATE);
  assert.equal(task.completed, false);
  assert.deepEqual(task.relay, { step: '', draft: '', next: '', focus: null });
  assert.equal(task.sourceId, 'publication-1');
  assert.equal(task.sourceVersion, 2);
  assert.ok(Number.isFinite(Date.parse(task.updatedAt)));
  const other = createTask({ title: '阅读课文', date: DATE });
  assert.notEqual(other.id, task.id);
  assert.notEqual(other.relay, task.relay);
  assert.equal(Object.hasOwn(other, 'sourceId'), false);
});

test('task validation rejects invalid titles, subjects and non-calendar dates', () => {
  for (const title of ['', '  ', '字'.repeat(401), 10, null]) {
    assert.throws(() => createTask({ title, date: DATE }), /任务标题/);
  }
  assert.equal(createTask({ title: '字'.repeat(400), date: DATE }).title.length, 400);
  assert.throws(() => createTask({ title: '读书', subject: '体育', date: DATE }), /学科/);
  for (const date of ['2026-02-29', '2026-04-31', '1900-02-29', '2026-13-01', '2026-1-01', '明天', null]) {
    assert.throws(() => createTask({ title: '读书', date }), /日期/);
  }
  assert.equal(createTask({ title: '读书', date: '2028-02-29' }).date, '2028-02-29');
  assert.throws(() => createTask({ title: '读书', sourceVersion: 0 }), /版本/);
});

test('normal task edits and toggles preserve identity, relay and source without mutation', () => {
  const task = createTask({ title: '原任务', subject: '语文', date: DATE, sourceId: 'pub', sourceVersion: 1 });
  task.relay.draft = PRIVATE;
  const before = clone(task);
  const updated = updateTask(task, { title: '修改后的任务' });
  assert.equal(updated.id, task.id);
  assert.equal(updated.relay, task.relay);
  assert.equal(updated.sourceId, task.sourceId);
  assert.equal(updated.completed, false);
  assert.deepEqual(task, before);
  const completed = toggleTask(updated);
  assert.equal(completed.completed, true);
  assert.equal(completed.id, task.id);
  assert.equal(completed.relay, task.relay);
  assert.equal(toggleTask(completed).completed, false);
  assert.equal(updateTask(completed, { date: '2026-10-28' }).completed, true);
  assert.throws(() => updateTask(task, { date: '2026-02-30' }), /日期/);
  assert.throws(() => updateTask(task, { completed: 'yes' }), /完成状态/);
  assert.throws(() => toggleTask({ ...task, completed: 1 }), /完成状态/);
  const relay = { step: '下一步', draft: '', next: '', focus: null };
  const explicit = updateTask(task, { id: 'explicit-id', relay });
  assert.equal(explicit.id, task.id);
  assert.equal(explicit.relay, relay);
});

test('capture splits newlines, semicolons and adjacent subject markers without removing wording', () => {
  const result = parseCapture('语文：今天背诵《春》；数学：明天完成第 3 页\n【英语】后天朗读。', DATE);
  assert.deepEqual(result.items.map(entry => entry.content), ['语文：今天背诵《春》', '数学：明天完成第 3 页', '【英语】后天朗读。']);
  assert.deepEqual(result.items.map(entry => entry.subject), ['语文', '数学', '英语']);
  assert.deepEqual(result.items.map(entry => entry.studyDate), [DATE, '2026-10-28', '2026-10-29']);
  assert.deepEqual(parseCapture('语文：背诵数学：练习', DATE).items.map(entry => entry.subject), ['语文', '数学']);
  for (const entry of result.items) {
    assert.equal(entry.due, '');
    assert.equal(entry.materials, '');
    assert.ok(entry.warnings.some(warning => /请确认/.test(warning)));
    assert.deepEqual(Object.keys(entry).sort(), ['id', 'subject', 'content', 'studyDate', 'due', 'materials', 'warnings'].sort());
  }
});

test('capture marks missing or inherited subjects and missing dates as uncertain', () => {
  const result = parseCapture('完成第 1 题；带课本', DATE);
  assert.equal(result.items.length, 2);
  for (const entry of result.items) {
    assert.equal(entry.subject, '其他');
    assert.equal(entry.studyDate, DATE);
    assert.ok(entry.warnings.some(warning => /未识别学科/.test(warning)));
    assert.ok(entry.warnings.some(warning => /未确定日期/.test(warning)));
  }
  assert.ok(result.warnings.some(warning => /请确认/.test(warning)));
  const inherited = parseCapture('数学：\n完成练习；订正', DATE);
  assert.equal(inherited.items.length, 2);
  assert.ok(inherited.items.every(entry => entry.subject === '数学' && entry.warnings.some(warning => /沿用/.test(warning))));
  const inferred = parseCapture('学习英语词汇', DATE).items[0];
  assert.equal(inferred.subject, '英语');
  assert.ok(inferred.warnings.some(warning => /推测/.test(warning)));
});

test('capture date suggestions handle weekdays, leap days and year boundaries deterministically', () => {
  for (const [word, expected] of [
    ['今天', DATE], ['明天', '2026-10-28'], ['后天', '2026-10-29'], ['周五', '2026-10-30'],
    ['周一', '2026-11-02'], ['本周一', '2026-10-26'], ['下周二', '2026-11-03'], ['星期日', '2026-11-01'],
    ['周7', '2026-11-01'], ['2027-01-02', '2027-01-02'],
  ]) assert.equal(parseCapture(`数学：${word}完成练习`, DATE).items[0].studyDate, expected, word);
  assert.equal(parseCapture('数学：明天练习', '2026-12-31').items[0].studyDate, '2027-01-01');
  assert.equal(parseCapture('数学：后天练习', '2028-02-27').items[0].studyDate, '2028-02-29');
  const text = '语文：今天背诵；今天背诵；今天背诵';
  const one = parseCapture(text, DATE);
  assert.deepEqual(one, parseCapture(text, DATE));
  assert.equal(new Set(one.items.map(entry => entry.id)).size, 3);
});

test('capture preserves overlong text and exposes invalid or competing date suggestions', () => {
  const content = `数学：${'题'.repeat(500)}`;
  const long = parseCapture(content, DATE).items[0];
  assert.equal(long.content, content);
  assert.ok(long.warnings.some(warning => /400 字/.test(warning)));
  const invalid = parseCapture('数学：2026-02-30 完成练习', DATE).items[0];
  assert.equal(invalid.studyDate, DATE);
  assert.ok(invalid.warnings.some(warning => /不是有效日期/.test(warning)));
  const multiple = parseCapture('数学：明天准备，2026-10-30 交', DATE).items[0];
  assert.equal(multiple.studyDate, '2026-10-28');
  assert.ok(multiple.warnings.some(warning => /多个日期/.test(warning)));
  assert.deepEqual(parseCapture(' \n；;', DATE), { items: [], warnings: [] });
  assert.throws(() => parseCapture('练习', '2026-02-30'), /日期/);
  assert.throws(() => parseCapture(null, DATE), /文字/);
});

test('publishing requires literal confirmation, a bounded scope and valid nonempty assignments', () => {
  for (const confirmed of [false, undefined, 1, 'true', {}]) {
    assert.throws(() => publishDraft(draft(), [], confirmed), /确认/);
  }
  for (const invalid of [
    draft({ scope: '' }), draft({ scope: '班'.repeat(61) }), draft({ items: [] }),
    draft({ items: [item({ content: '' })] }), draft({ items: [item({ content: '字'.repeat(401) })] }),
    draft({ items: [item({ content: `${'字'.repeat(400)} ${PRIVATE}` })] }),
    draft({ items: [item({ subject: '体育' })] }), draft({ items: [item({ studyDate: '2026-02-30' })] }),
    draft({ items: [item({ due: '字'.repeat(101) })] }), draft({ items: [item({ materials: '字'.repeat(101) })] }),
    draft({ items: [item({ id: 'i'.repeat(81) })] }), draft({ items: [item(), item()] }),
  ]) assert.throws(() => publishDraft(invalid, [], true));
  const valid = publishDraft(draft({ scope: '班'.repeat(60), items: [item({ id: undefined, content: '字'.repeat(400) })] }), [], true)[0];
  assert.equal(valid.version, 1);
  assert.equal(valid.status, 'published');
  assert.ok(valid.items[0].id);
  assert.deepEqual(valid.history, []);
  const joined = createTask({
    title: valid.items[0].content, subject: valid.items[0].subject, date: valid.items[0].studyDate,
    sourceId: valid.id, sourceVersion: valid.version,
  });
  assert.equal(joined.title, valid.items[0].content);
  assert.equal(joined.title.length, 400);
});

test('publication revisions and withdrawal preserve immutable, flat prior snapshots', () => {
  const originalDraft = draft();
  const beforeDraft = clone(originalDraft);
  const first = publishDraft(originalDraft, [], true);
  const beforeFirst = clone(first);
  const second = publishDraft(draft({ publicationId: first[0].id, scope: '高二（1）班', items: [item({ content: '订正第 3 页' })] }), first, true);
  assert.equal(second.length, 1);
  assert.equal(second[0].id, first[0].id);
  assert.equal(second[0].version, 2);
  assert.equal(second[0].history[0].scope, originalDraft.scope);
  assert.equal(second[0].history[0].items[0].content, originalDraft.items[0].content);
  assertPublicSnapshot(second[0].history[0]);
  const withdrawn = withdrawPublication(second, first[0].id);
  assert.equal(withdrawn[0].version, 3);
  assert.equal(withdrawn[0].status, 'withdrawn');
  assert.deepEqual(withdrawn[0].history.map(entry => entry.version), [1, 2]);
  assert.ok(withdrawn[0].history.every(entry => entry.status === 'published'));
  assert.equal(withdrawn[0].items[0].content, '订正第 3 页');
  assert.deepEqual(originalDraft, beforeDraft);
  assert.deepEqual(first, beforeFirst);
  assert.throws(() => publishDraft(draft({ publicationId: 'missing' }), first, true), /找不到/);
  assert.throws(() => withdrawPublication(first, 'missing'), /找不到/);
});

test('public projections, history, bundles and copy text cannot leak private extras', () => {
  const first = firstPublication();
  const revised = publishDraft(draft({ publicationId: first.id }), [first], true)[0];
  revised.source = PRIVATE;
  revised.student = { relay: PRIVATE };
  revised.notes = PRIVATE;
  revised.items[0].source = PRIVATE;
  revised.items[0].relay = PRIVATE;
  revised.history[0].source = PRIVATE;
  revised.history[0].history = [{ source: PRIVATE }];
  revised.history[0].items[0].privateNote = PRIVATE;
  const projected = publicProjection(revised);
  assert.deepEqual(Object.keys(projected).sort(), ['id', 'items', 'publishedAt', 'scope', 'status', 'version', 'history'].sort());
  const { history, ...current } = projected;
  assertPublicSnapshot(current);
  history.forEach(assertPublicSnapshot);
  const exported = exportPublicBundle([revised]);
  assert.equal(exported.format, 'haiz-tools-public');
  assert.equal(exported.version, 1);
  assert.equal(JSON.stringify(exported).includes(PRIVATE), false);
  assert.match(publicationText(revised), /高一（1）班/);
  assert.match(publicationText(revised), /第 2 版/);
  assert.equal(publicationText(revised).includes(PRIVATE), false);
  assert.match(publicationText(withdrawPublication([revised], revised.id)[0]), /已撤回/);
  projected.items[0].content = '改变副本';
  assert.notEqual(projected.items[0].content, revised.items[0].content);
});

test('imports accept JSON or objects, strip extras and keep the newer stable publication', () => {
  const first = firstPublication();
  const second = publishDraft(draft({ publicationId: first.id, items: [item({ content: '新版' })] }), [first], true)[0];
  second.source = PRIVATE;
  second.items[0].privateNote = PRIVATE;
  const before = clone(first);
  const newer = importPublicBundle(JSON.stringify(bundle([second])), [first]);
  assert.equal(newer.length, 1);
  assert.equal(newer[0].id, first.id);
  assert.equal(newer[0].version, 2);
  assert.equal(newer[0].items[0].content, '新版');
  assert.equal(JSON.stringify(newer).includes(PRIVATE), false);
  assert.deepEqual(first, before);
  assert.deepEqual(importPublicBundle(bundle([first]), newer), newer);
  assert.deepEqual(importPublicBundle(bundle([newer[0]]), newer), newer);
  const third = { ...clone(second), version: 3, history: [] };
  const merged = importPublicBundle(bundle([third]), newer)[0];
  assert.equal(merged.version, 3);
  assert.deepEqual(merged.history.map(entry => entry.version), [1, 2]);
  const additional = firstPublication();
  assert.equal(importPublicBundle(bundle([additional]), newer).length, 2);
});

test('imports visibly reject divergent content at the same id/version, including history', () => {
  const first = firstPublication();
  const conflicting = clone(first);
  conflicting.items[0].content = '不同内容';
  assert.throws(() => importPublicBundle(bundle([conflicting]), [first]), /第 1 版.*冲突/);
  assert.throws(() => importPublicBundle(bundle([first, conflicting]), []), /冲突/);
  const second = publishDraft(draft({ publicationId: first.id }), [first], true)[0];
  const third = publishDraft(draft({ publicationId: first.id }), [second], true)[0];
  third.history[0].items[0].content = '篡改历史';
  assert.throws(() => importPublicBundle(bundle([third]), [second]), /第 1 版.*冲突/);
  assert.throws(() => importPublicBundle(bundle([conflicting]), [second]), /冲突/);
  const extrasOnly = { ...clone(first), source: PRIVATE };
  assert.deepEqual(importPublicBundle(bundle([extrasOnly]), [first]), [first]);
});

test('imports validate schema, limits, subjects, actual dates and history before changing anything', () => {
  const first = firstPublication();
  const invalidPublications = [
    { ...first, id: '' }, { ...first, version: 0 }, { ...first, version: 1.5 },
    { ...first, scope: '' }, { ...first, scope: '班'.repeat(61) }, { ...first, status: 'draft' },
    { ...first, publishedAt: '2026-02-30T00:00:00.000Z' },
    { ...first, items: [] }, { ...first, items: [item({ studyDate: '2026-02-30' })] },
    { ...first, items: [item({ subject: '体育' })] }, { ...first, items: [item({ materials: '字'.repeat(101) })] },
    { ...first, items: [item({ materials: null })] }, { ...first, items: [item({ due: null })] },
    { ...first, items: [item({ content: '字'.repeat(401) })] }, { ...first, items: Array(501).fill(item()) },
    { ...first, history: null }, { ...first, version: 2, history: [{ ...first, id: 'different' }] },
    { ...first, history: [first] }, { ...first, history: Array(501).fill(first) },
  ];
  for (const publication of invalidPublications) {
    assert.throws(() => importPublicBundle(bundle([publication]), [first]));
  }
  for (const raw of ['{', null, {}, { ...bundle([]), format: 'other' }, { ...bundle([]), version: 2 }, bundle({}), bundle(Array(501).fill(first))]) {
    assert.throws(() => importPublicBundle(raw, [first]));
  }
  const before = clone(first);
  assert.throws(() => importPublicBundle(bundle([firstPublication(), invalidPublications[0]]), [first]));
  assert.deepEqual(first, before);
});
