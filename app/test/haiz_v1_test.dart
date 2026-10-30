import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/domain/notice_parser.dart';
import 'package:haiz_pocket_flutter/domain/ticker_physics.dart';
import 'package:haiz_pocket_flutter/domain/pocket_models.dart';

void main() {
  group('Inbox: safe candidate extraction', () {
    final today = DateTime(2026, 10, 27);

    test('two notices become candidates, never submitted automatically', () {
      final xs = NoticeParser.parse(
        '数学明天交练习册第36-39页。\n物理后天提交实验报告。',
        today: today,
      );
      expect(xs, hasLength(2));
      expect(xs[0].subject, '数学');
      expect(xs[0].due, DateTime(2026, 10, 28));
      expect(xs[1].due, DateTime(2026, 10, 29));
      expect(xs[0].source, '粘贴文本');
    });
    test('chat without clear action does not become homework', () {
      expect(NoticeParser.parse('今天晚霞好漂亮\n老师今天辛苦了', today: today), isEmpty);
    });
    test('explicit format shared by teacher demo is parsed', () {
      final xs = NoticeParser.parse(
        '【HAIZ任务】物理｜完成纸带实验｜2026-10-29｜本地演示（未验证）',
        today: today,
      );
      expect(xs, hasLength(1));
      expect(xs.single.subject, '物理');
      expect(xs.single.title, '完成纸带实验');
      expect(xs.single.due, DateTime(2026, 10, 29));
      expect(xs.single.source, contains('未验证'));
    });
    test('unknown date stays unknown and is flagged ambiguous', () {
      final xs = NoticeParser.parse('化学练习需要完成，时间待定', today: today);
      expect(xs, hasLength(1));
      expect(xs.single.due, isNull);
      expect(xs.single.ambiguous, isTrue);
    });
    test('relative and weekly dates use import day only', () {
      expect(NoticeParser.extractDue('下周一交', today), DateTime(2026, 11, 2));
      expect(NoticeParser.extractDue('本周五交', today), DateTime(2026, 10, 30));
    });
    test('reject malformed calendar days and duplicates', () {
      expect(NoticeParser.extractDue('2026-02-31交', today), isNull);
      expect(NoticeParser.parse('数学明天交卷\n数学明天交卷', today: today), hasLength(1));
    });
    test('teacher format with uncertain due stays candidate', () {
      final xs = NoticeParser.parse('【HAIZ任务】语文｜背诵课文｜待定', today: today);
      expect(xs.single.due, isNull);
      expect(xs.single.ambiguous, isTrue);
    });
  });
  group('Teach: ticker-tape physics', () {
    test('50Hz raw marks and 0.1s counted marks', () {
      const p = TickerPhysics();
      expect(TickerPhysics.tickStep, closeTo(.02, 1e-9));
      expect(TickerPhysics.countStep, closeTo(.1, 1e-9));
      expect(p.rawCount, 61);
      expect(p.countCount, 13);
      expect(p.rawTime(5), closeTo(.1, 1e-9));
    });
    test('central difference v and least squares acceleration agree', () {
      const p = TickerPhysics(initialSpeed: .22, acceleration: .72);
      expect(p.measuredSpeed(5), closeTo(.58, 1e-10));
      expect(p.fittedAcceleration, closeTo(.72, 1e-9));
    });
    test('uniform motion yields equal dot distance and flat v-t', () {
      const p = TickerPhysics(initialSpeed: .35, acceleration: 0);
      final first = p.markAt(2) - p.markAt(1);
      final later = p.markAt(8) - p.markAt(7);
      expect(first, closeTo(later, 1e-10));
      expect(p.fittedAcceleration, closeTo(0, 1e-10));
    });
  });
  test('task model preserves source and due across JSON', () {
    const original = TaskItem(
      id: '1',
      title: '学习',
      subject: '物理',
      source: '粘贴导入',
      dueIso: '2026-10-29',
    );
    final restored = TaskItem.fromJson(original.toJson());
    expect(restored.source, original.source);
    expect(restored.dueIso, original.dueIso);
  });
}
