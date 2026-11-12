import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/domain/task_sense_engine.dart';

void main() {
  final now = DateTime(2026, 11, 1);

  test('splits a mixed note without turning study time into a deadline', () {
    final drafts = TaskSenseEngine.local('明天交数学卷子，今晚复习英语', now);
    expect(drafts, hasLength(2));
    expect(drafts.first.title, '明天交数学卷子');
    expect(drafts.first.subject, '数学');
    expect(drafts.first.due, DateTime(2026, 11, 2));
    expect(drafts.last.title, '今晚复习英语');
    expect(drafts.last.subject, '英语');
    expect(drafts.last.due, isNull);
  });

  test('single note stays one draft and unknown times remain uncommitted', () {
    final drafts = TaskSenseEngine.local('准备一下演讲', now);
    expect(drafts, hasLength(1));
    expect(drafts.single.title, '准备一下演讲');
    expect(drafts.single.due, isNull);
  });

  test('bad or excessive input is never silently truncated', () {
    expect(() => TaskSenseEngine.local('', now), throwsFormatException);
    expect(() => TaskSenseEngine.local('x' * 601, now), throwsFormatException);
    expect(
      () => TaskSenseEngine.local('a,b,c,d,e,f,g,h,i', now),
      throwsFormatException,
    );
  });

  test('remote evidence must be an exact substring of submitted text', () {
    const source = '明天交数学卷子，今晚复习英语';
    final valid = TaskSenseEngine.fromRemote({
      'suggestions': [
        {'title': '完成数学卷子', 'evidence': '明天交数学卷子',
          'time_kind': 'deadline'},
        {'title': '复习英语', 'evidence': '今晚复习英语',
          'time_kind': 'planned'},
      ],
    }, source, now);
    expect(valid, hasLength(2));
    expect(valid.first.due, DateTime(2026, 11, 2));
    expect(valid.last.due, isNull);

    expect(() => TaskSenseEngine.fromRemote({
      'suggestions': [
        {'title': '不存在的任务', 'evidence': '老师让交化学论文',
          'time_kind': 'deadline'},
      ],
    }, source, now), throwsFormatException);
    expect(() => TaskSenseEngine.fromRemote({
      'suggestions': [
        {'title': '复习英语', 'evidence': '今晚复习英语',
          'time_kind': '2026-11-02'},
      ],
    }, source, now), throwsFormatException);
  });

  test('conflicting dates never become deadlines', () {
    final drafts = TaskSenseEngine.local('明天或后天交作业', now);
    expect(drafts.single.due, isNull);
  });
}
