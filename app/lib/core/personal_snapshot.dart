import 'dart:convert';

import '../domain/pocket_models.dart';

/// A single personal document; official assignments never enter this schema.
class PersonalSnapshot {
  const PersonalSnapshot({
    this.tasks = const [], this.courses = const [], this.focusLogs = const [],
    this.taskNotes = const {}, this.activeTaskId,
    this.appearance = 'porcelain', this.legacyImported = false,
  });

  final List<TaskItem> tasks;
  final List<CourseSlot> courses;
  final List<FocusLog> focusLogs;
  final Map<String, String> taskNotes;
  final String? activeTaskId;
  final String appearance;
  final bool legacyImported;

  String encode() => jsonEncode({
    'version': 1,
    'tasks': tasks.map((x) => x.toJson()).toList(),
    'courses': courses.map((x) => x.toJson()).toList(),
    'focusLogs': focusLogs.map((x) => x.toJson()).toList(),
    'taskNotes': taskNotes, 'activeTaskId': activeTaskId,
    'appearance': appearance, 'legacyImported': legacyImported,
  });

  factory PersonalSnapshot.decode(String raw) {
    final value = jsonDecode(raw);
    if (value is! Map<String, dynamic> || value['version'] != 1) {
      throw const FormatException('个人存储版本无效');
    }
    return PersonalSnapshot.fromFields(value);
  }

  factory PersonalSnapshot.fromFields(Map<String, dynamic> value) {
    final tasks = _records(value['tasks'], '任务', (row) {
      _string(row, 'title');
      _string(row, 'subject');
      for (final key in ['completed', 'example']) {
        if (row[key] != null && row[key] is! bool) {
          throw const FormatException('任务标记无效');
        }
      }
      for (final key in ['source', 'originalNotice', 'dueIso']) {
        if (row[key] != null) _string(row, key);
      }
      return TaskItem.fromJson(row);
    });
    final courses = _records(value['courses'], '课表', (row) {
      _string(row, 'name');
      for (final key in ['weekday', 'startMinute', 'endMinute']) {
        if (row[key] is! int) throw const FormatException('课程时间无效');
      }
      if ((row['weekday'] as int) < 1 || (row['weekday'] as int) > 7 ||
          (row['startMinute'] as int) < 0 ||
          (row['endMinute'] as int) > 1440 ||
          (row['endMinute'] as int) <= (row['startMinute'] as int)) {
        throw const FormatException('课程时间范围无效');
      }
      if (row['location'] != null) _string(row, 'location');
      return CourseSlot.fromJson(row);
    });
    final focus = value['focusLogs'];
    if (focus is! List) throw const FormatException('专注记录无效');
    final logs = focus.map((item) {
      if (item is! Map<String, dynamic> ||
          item['at'] is! String || DateTime.tryParse(item['at']) == null ||
          item['minutes'] is! int || (item['minutes'] as int) < 0 ||
          item['label'] is! String) {
        throw const FormatException('专注记录无效');
      }
      return FocusLog.fromJson(item);
    }).toList();
    final notes = value['taskNotes'];
    if (notes is! Map || notes.entries.any((e) => e.key is! String || e.value is! String)) {
      throw const FormatException('学习笔记无效');
    }
    final active = value['activeTaskId'];
    if (active != null && active is! String) {
      throw const FormatException('关联任务无效');
    }
    final appearance = value['appearance'];
    if (appearance is! String ||
        !['porcelain', 'obsidian', 'ocean'].contains(appearance) ||
        (value['legacyImported'] != null && value['legacyImported'] is! bool)) {
      throw const FormatException('个人存储设置无效');
    }
    return PersonalSnapshot(
      tasks: List.unmodifiable(tasks), courses: List.unmodifiable(courses),
      focusLogs: List.unmodifiable(logs),
      taskNotes: Map<String, String>.unmodifiable(Map<String, String>.from(notes)),
      activeTaskId: tasks.any((t) => t.id == active) ? active as String? : null,
      appearance: appearance, legacyImported: value['legacyImported'] == true,
    );
  }

  static List<T> _records<T>(dynamic value, String label,
      T Function(Map<String, dynamic>) decode) {
    if (value is! List) throw FormatException('$label 格式无效');
    final rows = value.map((item) {
      if (item is! Map<String, dynamic>) throw FormatException('$label 记录无效');
      _string(item, 'id');
      if ((item['id'] as String).isEmpty) throw FormatException('$label 标识无效');
      return item;
    }).toList();
    if (rows.map((r) => r['id']).toSet().length != rows.length) {
      throw FormatException('$label 标识重复，原始数据已保留');
    }
    return rows.map(decode).toList();
  }

  static void _string(Map<String, dynamic> row, String key) {
    if (row[key] is! String) throw FormatException('$key 格式无效');
  }
}
