import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/domain/pocket_models.dart';
import 'package:haiz_pocket_flutter/ui/kit.dart';

void main() {
  test('time formatting, days and course sorting are deterministic', () {
    expect(minutesText(485), '08:05');
    expect(minutesText(1439), '23:59');
    expect(weekdayText(1), '一');
    final courses = [
      const CourseSlot(
        id: 'second',
        weekday: 3,
        startMinute: 540,
        endMinute: 585,
        name: '数学',
      ),
      const CourseSlot(
        id: 'first',
        weekday: 3,
        startMinute: 480,
        endMinute: 525,
        name: '物理',
      ),
      const CourseSlot(
        id: 'other',
        weekday: 4,
        startMinute: 480,
        endMinute: 525,
        name: '英语',
      ),
    ];
    expect(coursesForDay(courses, 3).map((x) => x.id).toList(), [
      'first',
      'second',
    ]);
    expect(nextCourse(courses, DateTime(2026, 10, 28, 9, 2))?.id, 'second');
  });

  test('today focus duration is calendar-day scoped', () {
    final logs = [
      FocusLog(at: DateTime(2026, 10, 27, 9), minutes: 25, label: '物理'),
      FocusLog(at: DateTime(2026, 10, 27, 10), minutes: 10, label: '数学'),
      FocusLog(at: DateTime(2026, 10, 26, 18), minutes: 40, label: '语文'),
    ];
    expect(focusMinutesToday(logs, DateTime(2026, 10, 27, 20)), 35);
  });

  test('tasks roundtrip without losing completion or example status', () {
    final task = const TaskItem(
      id: 't1',
      title: '学习物理',
      subject: '物理',
      example: true,
    ).copyWith(completed: true);
    final restored = TaskItem.fromJson(task.toJson());
    expect(restored.completed, isTrue);
    expect(restored.example, isTrue);
    expect(restored.title, '学习物理');
  });

  testWidgets('three themes render and glass dock exposes five tabs', (
    tester,
  ) async {
    for (final name in ['porcelain', 'obsidian', 'ocean']) {
      final palette = PocketPalette.forName(name);
      await tester.pumpWidget(
        MaterialApp(
          home: PocketSkin(
            colors: palette,
            child: Scaffold(
              body: Column(
                children: [
                  const Expanded(child: Center(child: Text('HAIZ'))),
                  GlassDock(index: 0, onChange: (_) {}),
                ],
              ),
            ),
          ),
        ),
      );
      expect(find.text('今天'), findsOneWidget);
      expect(find.text('课表'), findsOneWidget);
      expect(find.text('专注'), findsOneWidget);
      expect(find.text('探索'), findsOneWidget);
      expect(find.text('收件'), findsOneWidget);
    }
  });
}
