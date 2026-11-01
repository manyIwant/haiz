import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/domain/quick_task_date_parser.dart';

void main() {
  test('recognizes relative dates across month and year boundaries', () {
    final now = DateTime(2026, 10, 31); // Saturday
    expect(QuickTaskDateParser.suggest('今天交材料', now)!.date,
        DateTime(2026, 10, 31));
    expect(QuickTaskDateParser.suggest('明天交材料', now)!.date,
        DateTime(2026, 11, 1));
    expect(QuickTaskDateParser.suggest('后天带校卡', now)!.date,
        DateTime(2026, 11, 2));
    expect(QuickTaskDateParser.suggest('下周五交作业', now)!.date,
        DateTime(2026, 11, 6));
    expect(QuickTaskDateParser.suggest('周五交物理', now)!.date,
        DateTime(2026, 11, 6));
    expect(QuickTaskDateParser.suggest('下周日开会', now)!.date,
        DateTime(2026, 11, 8));
    expect(QuickTaskDateParser.suggest('明天交表', DateTime(2026, 12, 31))!.date,
        DateTime(2027, 1, 1));
  });

  test('same weekday means today, past weekday means next week', () {
    expect(QuickTaskDateParser.suggest('周日复习', DateTime(2026, 11, 1))!.date,
        DateTime(2026, 11, 1));
    expect(QuickTaskDateParser.suggest('周一复习', DateTime(2026, 11, 1))!.date,
        DateTime(2026, 11, 2));
  });

  test('explicit calendar dates must be real calendar dates', () {
    final now = DateTime(2026, 10, 31);
    expect(QuickTaskDateParser.suggest('2028-02-29 提交', now)!.date,
        DateTime(2028, 2, 29));
    expect(QuickTaskDateParser.suggest('2026-02-31 提交', now), isNull);
    expect(QuickTaskDateParser.suggest('2026-13-01 提交', now), isNull);
    expect(QuickTaskDateParser.suggest('2027-02-29 提交', now), isNull);
  });

  test('ambiguous, overlapping and missing dates are not auto-inferred', () {
    final now = DateTime(2026, 10, 31);
    expect(QuickTaskDateParser.suggest('明天或后天', now), isNull);
    expect(QuickTaskDateParser.suggest('周一和下周一', now), isNull);
    expect(QuickTaskDateParser.suggest('只写一件普通事', now), isNull);
    expect(QuickTaskDateParser.suggest('每周一做总结', now), isNull);
    expect(QuickTaskDateParser.suggest('上周五的作业', now), isNull);
  });

  test('keeps user title and reports exact match span', () {
    const original = '周五交物理作业';
    final found = QuickTaskDateParser.suggest(original, DateTime(2026, 10, 31))!;
    expect(found.title, original);
    expect(original.substring(found.start, found.end), '周五');
    expect(found.label, contains('11月6日'));
  });
}
