import 'pocket_models.dart';

/// Pure planning rules shared by 今天, 待办 and 课表. No widgets, no clock
/// reads: every function receives `now`, so the rules are testable.

DateTime dayOf(DateTime t) => DateTime(t.year, t.month, t.day);

DateTime? dueDate(TaskItem task) {
  final raw = task.dueIso;
  if (raw == null) return null;
  final parsed = DateTime.tryParse(raw);
  return parsed == null ? null : dayOf(parsed);
}

enum DueBucket { overdue, today, tomorrow, week, later, none }

DueBucket bucketOf(TaskItem task, DateTime now) {
  final due = dueDate(task);
  if (due == null) return DueBucket.none;
  final days = due.difference(dayOf(now)).inDays;
  if (days < 0) return DueBucket.overdue;
  if (days == 0) return DueBucket.today;
  if (days == 1) return DueBucket.tomorrow;
  if (days < 7) return DueBucket.week;
  return DueBucket.later;
}

String bucketTitle(DueBucket bucket) => switch (bucket) {
  DueBucket.overdue => '已逾期',
  DueBucket.today => '今天',
  DueBucket.tomorrow => '明天',
  DueBucket.week => '本周内',
  DueBucket.later => '以后',
  DueBucket.none => '未定日期',
};

const _weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

String weekdayName(int weekday) => _weekdays[(weekday.clamp(1, 7)) - 1];

/// Short, scannable due label for a row. Overdue says by how much.
String dueLabel(TaskItem task, DateTime now) {
  final due = dueDate(task);
  if (due == null) return task.dueIso == null ? '' : '日期待核对';
  final days = due.difference(dayOf(now)).inDays;
  if (days < 0) return days == -1 ? '昨天到期' : '逾期 ${-days} 天';
  if (days == 0) return '今天';
  if (days == 1) return '明天';
  if (days == 2) return '后天';
  if (days < 7) return weekdayName(due.weekday);
  if (due.year == now.year) return '${due.month}月${due.day}日';
  return '${due.year}年${due.month}月${due.day}日';
}

String dateLabel(DateTime date, DateTime now) {
  final days = dayOf(date).difference(dayOf(now)).inDays;
  final md = '${date.month}月${date.day}日';
  return switch (days) {
    0 => '今天 · $md',
    1 => '明天 · $md',
    2 => '后天 · $md',
    -1 => '昨天 · $md',
    _ => '$md ${weekdayName(date.weekday)}',
  };
}

int _compareDue(TaskItem a, TaskItem b) {
  final da = a.dueIso, db = b.dueIso;
  if (da == null && db != null) return 1;
  if (db == null && da != null) return -1;
  if (da != null && db != null) {
    final c = da.compareTo(db);
    if (c != 0) return c;
  }
  return 0;
}

/// Groups open tasks by due bucket, earliest first; list order is otherwise
/// preserved (newest first as stored), so a new task appears at the top of
/// its group.
List<(DueBucket, List<TaskItem>)> groupByDue(Iterable<TaskItem> tasks, DateTime now) {
  final map = <DueBucket, List<TaskItem>>{};
  for (final task in tasks) {
    map.putIfAbsent(bucketOf(task, now), () => []).add(task);
  }
  return [
    for (final bucket in DueBucket.values)
      if (map[bucket] case final list?) (bucket, list..sort(_compareDue)),
  ];
}

/// Tasks that belong on 今天: overdue, due today, and due in the next two
/// days (so tomorrow's homework can be started tonight).
List<(DueBucket, List<TaskItem>)> todayGroups(Iterable<TaskItem> tasks, DateTime now) {
  final open = tasks.where((t) => !t.completed);
  return groupByDue(open, now).where((g) =>
      g.$1 == DueBucket.overdue || g.$1 == DueBucket.today ||
      g.$1 == DueBucket.tomorrow).toList();
}

/// The school-day position right now.
class DayStatus {
  const DayStatus({
    required this.today,
    this.current,
    this.next,
    this.currentIndex,
    this.nextIndex,
    this.tomorrowFirst,
    this.tomorrowWeekday,
  });

  final List<CourseSlot> today;
  final CourseSlot? current;
  final CourseSlot? next;

  /// 1-based period number within the day.
  final int? currentIndex;
  final int? nextIndex;
  final CourseSlot? tomorrowFirst;
  final int? tomorrowWeekday;

  bool get hasCourses => today.isNotEmpty;
  bool get dayOver => today.isNotEmpty && current == null && next == null;
}

DayStatus dayStatus(Iterable<CourseSlot> courses, DateTime now) {
  final today = coursesForDay(courses, now.weekday);
  final minute = now.hour * 60 + now.minute;
  CourseSlot? current, next;
  int? currentIndex, nextIndex;
  for (var i = 0; i < today.length; i++) {
    final c = today[i];
    if (c.startMinute <= minute && minute < c.endMinute) {
      current = c;
      currentIndex = i + 1;
    } else if (c.startMinute > minute && next == null) {
      next = c;
      nextIndex = i + 1;
    }
  }
  CourseSlot? tomorrowFirst;
  int? tomorrowWeekday;
  if (current == null && next == null) {
    for (var d = 1; d <= 7; d++) {
      final weekday = (now.weekday - 1 + d) % 7 + 1;
      final list = coursesForDay(courses, weekday);
      if (list.isNotEmpty) {
        tomorrowFirst = list.first;
        tomorrowWeekday = weekday;
        break;
      }
    }
  }
  return DayStatus(
    today: today,
    current: current,
    next: next,
    currentIndex: currentIndex,
    nextIndex: nextIndex,
    tomorrowFirst: tomorrowFirst,
    tomorrowWeekday: tomorrowWeekday,
  );
}

/// "28 分钟" / "1 小时 5 分钟".
String durationText(int minutes) {
  if (minutes < 60) return '$minutes 分钟';
  final h = minutes ~/ 60, m = minutes % 60;
  return m == 0 ? '$h 小时' : '$h 小时 $m 分钟';
}

/// A row of the weekly timetable: the n-th period of each day.
class PeriodRow {
  const PeriodRow({required this.index, required this.start, required this.end, required this.cells, this.breakBefore = false});
  final int index;
  final int start;
  final int end;

  /// weekday (1–7) → course in this period, if any.
  final Map<int, CourseSlot> cells;

  /// A long gap (lunch) precedes this period.
  final bool breakBefore;
}

/// Timetable rows aligned by period order, which is how Chinese high-school
/// timetables are read ("第 3 节"), with typical start/end for each period.
List<PeriodRow> periodRows(Iterable<CourseSlot> courses, Iterable<int> weekdays) {
  final perDay = {for (final d in weekdays) d: coursesForDay(courses, d)};
  final count = perDay.values.fold<int>(0, (m, l) => l.length > m ? l.length : m);
  final rows = <PeriodRow>[];
  int? previousEnd;
  for (var i = 0; i < count; i++) {
    final cells = <int, CourseSlot>{};
    final starts = <int>[], ends = <int>[];
    for (final entry in perDay.entries) {
      if (i < entry.value.length) {
        cells[entry.key] = entry.value[i];
        starts.add(entry.value[i].startMinute);
        ends.add(entry.value[i].endMinute);
      }
    }
    final start = _mode(starts), end = _mode(ends);
    rows.add(PeriodRow(
      index: i + 1,
      start: start,
      end: end,
      cells: cells,
      breakBefore: previousEnd != null && start - previousEnd >= 90,
    ));
    previousEnd = end;
  }
  return rows;
}

int _mode(List<int> values) {
  final counts = <int, int>{};
  for (final v in values) {
    counts[v] = (counts[v] ?? 0) + 1;
  }
  return counts.entries.reduce((a, b) =>
      b.value > a.value || (b.value == a.value && b.key < a.key) ? b : a).key;
}

/// Subject keywords used for suggestions (never auto-applied).
const knownSubjects = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '信息', '体育', '通用'];

String? detectSubject(String text) {
  for (final s in knownSubjects) {
    if (text.contains(s)) return s;
  }
  return null;
}
