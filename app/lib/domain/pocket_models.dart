import 'dart:math';

class TaskItem {
  final String id;
  final String title;
  final String subject;
  final bool completed;
  final bool example;
  final String? dueIso;
  final String source;
  const TaskItem({
    required this.id,
    required this.title,
    required this.subject,
    this.completed = false,
    this.example = false,
    this.dueIso,
    this.source = '',
  });

  TaskItem copyWith({bool? completed}) => TaskItem(
    id: id,
    title: title,
    subject: subject,
    completed: completed ?? this.completed,
    example: example,
    dueIso: dueIso,
    source: source,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'subject': subject,
    'completed': completed,
    'example': example,
    'dueIso': dueIso,
    'source': source,
  };

  factory TaskItem.fromJson(Map<String, dynamic> json) => TaskItem(
    id: json['id'].toString(),
    title: json['title']?.toString() ?? '',
    subject: json['subject']?.toString() ?? '其他',
    completed: json['completed'] == true,
    example: json['example'] == true,
    dueIso: json['dueIso']?.toString(),
    source: json['source']?.toString() ?? '',
  );
}

class CourseSlot {
  final String id;
  final int weekday;
  final int startMinute;
  final int endMinute;
  final String name;
  final String location;
  final bool example;

  const CourseSlot({
    required this.id,
    required this.weekday,
    required this.startMinute,
    required this.endMinute,
    required this.name,
    this.location = '',
    this.example = false,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'weekday': weekday,
    'startMinute': startMinute,
    'endMinute': endMinute,
    'name': name,
    'location': location,
    'example': example,
  };

  factory CourseSlot.fromJson(Map<String, dynamic> json) => CourseSlot(
    id: json['id'].toString(),
    weekday: (json['weekday'] as num?)?.toInt() ?? 1,
    startMinute: (json['startMinute'] as num?)?.toInt() ?? 480,
    endMinute: (json['endMinute'] as num?)?.toInt() ?? 525,
    name: json['name']?.toString() ?? '课程',
    location: json['location']?.toString() ?? '',
    example: json['example'] == true,
  );
}

class FocusLog {
  final DateTime at;
  final int minutes;
  final String label;
  const FocusLog({
    required this.at,
    required this.minutes,
    required this.label,
  });
  Map<String, dynamic> toJson() => {
    'at': at.toIso8601String(),
    'minutes': minutes,
    'label': label,
  };
  factory FocusLog.fromJson(Map<String, dynamic> json) => FocusLog(
    at: DateTime.tryParse(json['at']?.toString() ?? '') ?? DateTime.now(),
    minutes: (json['minutes'] as num?)?.toInt() ?? 0,
    label: json['label']?.toString() ?? '学习',
  );
}

String minutesText(int minute) {
  final m = minute.clamp(0, 1439);
  return '${(m ~/ 60).toString().padLeft(2, '0')}:${(m % 60).toString().padLeft(2, '0')}';
}

String weekdayText(int weekday) =>
    const ['一', '二', '三', '四', '五', '六', '日'][(weekday.clamp(1, 7) - 1)];

List<CourseSlot> coursesForDay(Iterable<CourseSlot> courses, int weekday) {
  return courses.where((c) => c.weekday == weekday).toList()
    ..sort((a, b) => a.startMinute.compareTo(b.startMinute));
}

CourseSlot? nextCourse(Iterable<CourseSlot> courses, DateTime now) {
  final today = coursesForDay(courses, now.weekday);
  final minute = now.hour * 60 + now.minute;
  for (final c in today) {
    if (c.endMinute > minute) return c;
  }
  return null;
}

int focusMinutesToday(Iterable<FocusLog> logs, DateTime now) => logs
    .where(
      (log) =>
          log.at.year == now.year &&
          log.at.month == now.month &&
          log.at.day == now.day,
    )
    .fold(0, (sum, log) => sum + log.minutes);

String newId() =>
    '${DateTime.now().microsecondsSinceEpoch}_${Random().nextInt(9999)}';

List<TaskItem> starterTasks() => [
  const TaskItem(
    id: 'sample1',
    title: '整理今天的数学课堂笔记',
    subject: '数学',
    example: true,
  ),
  const TaskItem(
    id: 'sample2',
    title: '英语 Unit 4 · 单词复习',
    subject: '英语',
    example: true,
  ),
  const TaskItem(
    id: 'sample3',
    title: '回顾物理实验与测量方法',
    subject: '物理',
    example: true,
  ),
];

List<CourseSlot> starterCourses() {
  const data = [
    [1, 480, 525, '语文'],
    [1, 535, 580, '数学'],
    [1, 600, 645, '英语'],
    [2, 480, 525, '数学'],
    [2, 535, 580, '物理'],
    [2, 600, 645, '英语'],
    [3, 480, 525, '英语'],
    [3, 535, 580, '化学'],
    [3, 600, 645, '数学'],
    [4, 480, 525, '物理'],
    [4, 535, 580, '语文'],
    [5, 480, 525, '数学'],
    [5, 535, 580, '生物'],
  ];
  return [
    for (int i = 0; i < data.length; i++)
      CourseSlot(
        id: 'demo$i',
        weekday: data[i][0] as int,
        startMinute: data[i][1] as int,
        endMinute: data[i][2] as int,
        name: data[i][3] as String,
        location: '示例教室',
        example: true,
      ),
  ];
}
