import 'dart:convert';

import 'package:crypto/crypto.dart';

import 'haiz_extension.dart';
import 'personal_snapshot.dart';

/// A user-carried, local-only backup. The checksum detects accidental file
/// damage; it is not an authentication signature or a password/encryption.
class PersonalBackup {
  PersonalBackup._(this.snapshot, this.createdAt);

  static const format = 'haiz-pocket-personal-backup';
  static const maxBytes = 4 * 1024 * 1024;
  final PersonalSnapshot snapshot;
  final DateTime createdAt;

  int get taskCount => snapshot.tasks.length;
  int get courseCount => snapshot.courses.length;
  int get focusCount => snapshot.focusLogs.length;

  static String create(PersonalSnapshot snapshot, {DateTime? now}) {
    _validate(snapshot);
    final payload = snapshot.encode();
    final data = jsonEncode({
      'format': format,
      // Version 2 only when 2.0-only data is present. 1.5.5 rejects it with
      // its own "unsupported backup" message instead of dropping notes.
      'version': snapshot.ext.isEmpty ? 1 : 2,
      'createdAt': (now ?? DateTime.now()).toUtc().toIso8601String(),
      'snapshot': jsonDecode(payload),
      'sha256': sha256.convert(utf8.encode(payload)).toString(),
    });
    if (utf8.encode(data).length > maxBytes) {
      throw const FormatException('备份内容超过 4 MB');
    }
    return data;
  }

  static PersonalBackup decode(String raw) {
    if (utf8.encode(raw).length > maxBytes) {
      throw const FormatException('备份超过 4 MB，无法安全导入');
    }
    final value = jsonDecode(raw);
    if (value is! Map<String, dynamic> ||
        value['format'] != format ||
        (value['version'] != 1 && value['version'] != 2) ||
        value['snapshot'] is! Map<String, dynamic> ||
        value['sha256'] is! String || value['createdAt'] is! String) {
      throw const FormatException('不是受支持的 HAIZ 个人备份');
    }
    final date = DateTime.tryParse(value['createdAt'] as String);
    if (date == null) throw const FormatException('备份日期无效');
    final snapshot = PersonalSnapshot.decode(jsonEncode(value['snapshot']));
    _validate(snapshot);
    final calculated = sha256.convert(utf8.encode(snapshot.encode())).toString();
    if (calculated != value['sha256']) {
      throw const FormatException('备份校验未通过，未修改现有数据');
    }
    return PersonalBackup._(snapshot, date);
  }

  static void _validate(PersonalSnapshot snapshot) {
    if (snapshot.tasks.length > 5000 ||
        snapshot.courses.length > 2000 ||
        snapshot.focusLogs.length > 20000) {
      throw const FormatException('备份记录数量超出安全限制');
    }
    final ids = snapshot.tasks.map((task) => task.id).toSet();
    if (snapshot.taskNotes.keys.any((id) => !ids.contains(id))) {
      throw const FormatException('备份包含无对应任务的私人笔记');
    }
    if (utf8.encode(snapshot.encode()).length > maxBytes) {
      throw const FormatException('备份内容过大');
    }
  }

  /// Merge without deleting or replacing any existing record. Matching IDs
  /// must contain identical records, otherwise the entire import is rejected.
  static BackupMerge merge(PersonalSnapshot current, PersonalSnapshot incoming) {
    _validate(incoming);
    final tasks = [...current.tasks];
    final byTask = {for (final t in tasks) t.id: t};
    int addedTasks = 0;
    for (final task in incoming.tasks) {
      final old = byTask[task.id];
      if (old != null) {
        if (jsonEncode(old.toJson()) != jsonEncode(task.toJson())) {
          throw StateError('任务标识冲突，未修改任何数据');
        }
      } else {
        tasks.add(task);
        byTask[task.id] = task;
        addedTasks++;
      }
    }

    final courses = [...current.courses];
    final byCourse = {for (final c in courses) c.id: c};
    int addedCourses = 0;
    for (final course in incoming.courses) {
      final old = byCourse[course.id];
      if (old != null) {
        if (jsonEncode(old.toJson()) != jsonEncode(course.toJson())) {
          throw StateError('课表标识冲突，未修改任何数据');
        }
      } else {
        courses.add(course);
        byCourse[course.id] = course;
        addedCourses++;
      }
    }

    final notes = {...current.taskNotes};
    for (final entry in incoming.taskNotes.entries) {
      if (notes.containsKey(entry.key) && notes[entry.key] != entry.value) {
        throw StateError('任务笔记存在冲突，未修改任何数据');
      }
      notes[entry.key] = entry.value;
    }
    final focus = [...current.focusLogs];
    final fingerprints = focus.map((log) => jsonEncode(log.toJson())).toSet();
    int addedFocus = 0;
    for (final log in incoming.focusLogs) {
      final key = jsonEncode(log.toJson());
      if (fingerprints.add(key)) {
        focus.add(log);
        addedFocus++;
      }
    }
    final merged = PersonalSnapshot(
      ext: _mergeExtension(current.ext, incoming.ext),
      tasks: tasks, courses: courses, focusLogs: focus, taskNotes: notes,
      activeTaskId: current.activeTaskId ??
          (byTask.containsKey(incoming.activeTaskId)
              ? incoming.activeTaskId : null),
      // Never replace an existing user's appearance or legacy-ownership flags.
      appearance: current.appearance,
      legacyImported: current.legacyImported,
    );
    _validate(merged);
    return BackupMerge(
      merged: merged,
      tasksAdded: addedTasks,
      coursesAdded: addedCourses,
      focusAdded: addedFocus,
    );
  }
}

/// Additive: keeps every current note/deleted entry and only adds unknown ids.
/// When both sides edited the same memo, the later edit wins.
HaizExtension _mergeExtension(HaizExtension current, HaizExtension incoming) {
  final notes = {for (final n in current.notes) n.id: n};
  for (final note in incoming.notes) {
    final old = notes[note.id];
    if (old == null || note.updatedAt.isAfter(old.updatedAt)) notes[note.id] = note;
  }
  final trashIds = current.trash.map((t) => t.task.id).toSet();
  return current.copyWith(
    notes: List.unmodifiable(notes.values),
    taskMeta: Map.unmodifiable({...incoming.taskMeta, ...current.taskMeta}),
    trash: List.unmodifiable([
      ...current.trash,
      ...incoming.trash.where((t) => trashIds.add(t.task.id)),
    ].take(HaizExtension.maxTrash)),
  );
}

class BackupMerge {
  const BackupMerge({
    required this.merged,
    required this.tasksAdded,
    required this.coursesAdded,
    required this.focusAdded,
  });

  final PersonalSnapshot merged;
  final int tasksAdded;
  final int coursesAdded;
  final int focusAdded;
}
