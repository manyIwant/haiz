import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, extractWhen, splitNotification, similarText, isColloquialQuestion } from '../src/intake/analyze.ts';

// Wednesday 2026-11-25 10:00 local
const NOW = new Date(2026, 10, 25, 10, 0).getTime();
const ymdh = (iso) => iso && iso.slice(0, 16);

test('homework with tonight deadline', () => {
  const a = analyze('请大家今晚22:00前提交物理实验报告，附数据表。', '王老师', NOW);
  assert.equal(a.kind, 'homework');
  assert.equal(a.subject, '物理');
  assert.equal(ymdh(a.due), '2026-11-25T22:00');
  assert.ok(a.taskRelated);
  assert.equal(a.category, 'urgent');
});
test('exam next week with place', () => {
  const a = analyze('下周三上午8点数学月考，在一号教学楼302考场，请带好文具。', '班主任', NOW);
  assert.equal(a.kind, 'exam');
  assert.equal(ymdh(a.start), '2026-12-02T08:00');
  assert.match(a.where ?? '', /教学楼/);
  assert.ok(a.taskRelated);
});
test('event with a time range', () => {
  const w = extractWhen('明天下午3点到5点在报告厅开家长会', new Date(NOW));
  assert.equal(w.start.getHours(), 15);
  assert.equal(w.end.getHours(), 17);
  assert.equal(w.start.getDate(), 26);
});
test('bare day only with deadline context', () => {
  const a = analyze('报名表28号之前交到学委那里', '', NOW);
  assert.equal(ymdh(a.due), '2026-11-28T23:59');
  assert.equal(a.kind, 'deadline');
  const b = extractWhen('3号楼今天停电', new Date(NOW));
  assert.equal(b.start.getDate(), 25);
});
test('chatter and acks are not tasks', () => {
  for (const t of ['收到', '哈哈哈哈笑死', '明天有体育课吗？', '[图片]', '好的老师辛苦了']) {
    assert.equal(analyze(t, '', NOW).taskRelated, false, t);
  }
  assert.ok(isColloquialQuestion('你们今天晚上去不去食堂吃饭呢'));
});
test('past is not a future event', () => {
  assert.equal(extractWhen('上周三的作业已经讲过了', new Date(NOW)).start, null);
});
test('HAIZ teacher export line', () => {
  const a = analyze('【HAIZ任务】数学｜导数练习 P56 1–12｜2026-11-27｜王老师', '', NOW);
  assert.equal(a.subject, '数学');
  assert.equal(a.title, '导数练习 P56 1–12');
  assert.equal(ymdh(a.due), '2026-11-27T23:59');
});
test('WeChat notification text', () => {
  assert.deepEqual(splitNotification('[3条]李老师: 明天交作文'), { sender: '李老师', body: '明天交作文', count: 3, mention: false });
  assert.equal(splitNotification('[有人@我]班长：@所有人 周五前交表').mention, true);
  assert.equal(splitNotification('今天下午开会').sender, '');
});
test('dedupe similarity', () => {
  assert.ok(similarText('请于本周五前提交社会实践报告，逾期不候。', '请于本周五前提交社会实践报告，逾期不候'));
  assert.ok(similarText('请于本周五前提交社会实践报告，逾期不候，谢谢配合！', '请于本周五前提交社会实践报告，逾期不候。'));
  assert.equal(similarText('明天交作文', '明天交作业'), false);
});
