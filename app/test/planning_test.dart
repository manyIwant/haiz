import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/domain/planning.dart';
import 'package:haiz_pocket_flutter/domain/pocket_models.dart';
import 'package:haiz_pocket_flutter/features/schedule/schedule_screen.dart' show homeRoom;

CourseSlot c(String id, int day, int start, int end, String name, [String room = '明德楼 302']) =>
    CourseSlot(id: id, weekday: day, startMinute: start, endMinute: end, name: name, location: room);

void main() {
  // Wednesday 2026-11-04.
  final week = [
    c('a', 3, 480, 520, '英语'),
    c('b', 3, 600, 640, '数学'),
    c('c', 3, 870, 910, '化学', '实验楼 3F'),
    c('d', 4, 480, 520, '物理'),
  ];

  test('in class: current period, its number, and the next one', () {
    final s = dayStatus(week, DateTime(2026, 11, 4, 10, 12));
    expect(s.current?.name, '数学');
    expect(s.currentIndex, 2);
    expect(s.next?.name, '化学');
    expect(s.dayOver, isFalse);
  });

  test('between classes: no current, the next class and its number', () {
    final s = dayStatus(week, DateTime(2026, 11, 4, 12, 0));
    expect(s.current, isNull);
    expect(s.next?.name, '化学');
    expect(s.nextIndex, 3);
  });

  test('after school: the next school day first class, skipping empty days', () {
    final s = dayStatus(week, DateTime(2026, 11, 4, 19, 40));
    expect(s.dayOver, isTrue);
    expect(s.tomorrowFirst?.name, '物理');
    expect(s.tomorrowWeekday, 4);
    final thursdayNight = dayStatus(week, DateTime(2026, 11, 5, 20, 0));
    expect(thursdayNight.tomorrowWeekday, 3, reason: 'wraps to next Wednesday');
  });

  test('a class ending exactly now is over; starting exactly now is current', () {
    expect(dayStatus(week, DateTime(2026, 11, 4, 10, 40)).current, isNull);
    expect(dayStatus(week, DateTime(2026, 11, 4, 10, 0)).current?.name, '数学');
  });

  test('week rows align by period order and mark the lunch break', () {
    final rows = periodRows(week, [3, 4]);
    expect(rows, hasLength(3));
    expect(rows[0].cells.keys, containsAll([3, 4]));
    expect(rows[2].cells.keys, [3]);
    expect(rows[2].breakBefore, isTrue, reason: '10:40 → 14:30 is lunch');
    expect(rows[1].breakBefore, isFalse);
  });

  test('home room is printed once only when one room clearly dominates', () {
    expect(homeRoom(week), '明德楼 302');
    expect(homeRoom([c('x', 1, 0, 40, '体育', '东操场'), c('y', 1, 50, 90, '信息', '信息楼'), c('z', 1, 100, 140, '数学', '302')]), isNull);
  });

  test('due labels say how late, and days are local calendar days', () {
    final now = DateTime(2026, 11, 4, 23, 30);
    expect(dueLabel(const TaskItem(id: '1', title: 'x', subject: '数学', dueIso: '2026-11-01'), now), '逾期 3 天');
    expect(dueLabel(const TaskItem(id: '2', title: 'x', subject: '数学', dueIso: '2026-11-03'), now), '昨天到期');
    expect(dueLabel(const TaskItem(id: '3', title: 'x', subject: '数学', dueIso: '2026-11-06'), now), '后天');
    expect(dueLabel(const TaskItem(id: '4', title: 'x', subject: '数学', dueIso: '2026-11-08'), now), '周日');
    final utc = DateTime.utc(2026, 11, 4, 1);
    expect(dayOf(utc), dayOf(utc.toLocal()));
    expect(dayOf(utc).isUtc, isFalse);
  });

  test('subject detection only suggests', () {
    expect(detectSubject('明天交物理实验报告'), '物理');
    expect(detectSubject('带校服'), isNull);
  });
}
