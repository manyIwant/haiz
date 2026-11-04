import '../domain/pocket_models.dart';

/// HAIZ 2.0 data carried next to the unchanged version-1 personal snapshot.
///
/// The wire format stays `version: 1` so 1.5.5 clients keep reading tasks,
/// courses and focus history. They ignore the top-level `haiz2` object; if a
/// 1.5.5 client later saves the same namespace it drops this object (notes,
/// recently deleted tasks, task timestamps, an in-progress focus session).
/// Core records are never affected. See docs/haiz-2.0/MIGRATION.md.
class HaizExtension {
  const HaizExtension({
    this.notes = const [],
    this.taskMeta = const {},
    this.trash = const [],
    this.focus,
    this.completedSessions = const [],
    this.themeMode = 'system',
    this.focusMinutes = 25,
  });

  static const schema = 2;
  static const maxTrash = 60;
  static const maxNotes = 2000;
  static const themeModes = ['system', 'light', 'dark'];

  final List<NoteItem> notes;
  final Map<String, TaskMeta> taskMeta;
  final List<TrashEntry> trash;
  final FocusSession? focus;

  /// Recently finished session ids. A session can produce at most one log,
  /// even if completion is observed by a tick, a resume and a button at once.
  final List<String> completedSessions;
  final String themeMode;
  final int focusMinutes;

  HaizExtension copyWith({
    List<NoteItem>? notes,
    Map<String, TaskMeta>? taskMeta,
    List<TrashEntry>? trash,
    FocusSession? focus,
    bool clearFocus = false,
    List<String>? completedSessions,
    String? themeMode,
    int? focusMinutes,
  }) => HaizExtension(
    notes: notes ?? this.notes,
    taskMeta: taskMeta ?? this.taskMeta,
    trash: trash ?? this.trash,
    focus: clearFocus ? null : (focus ?? this.focus),
    completedSessions: completedSessions ?? this.completedSessions,
    themeMode: themeMode ?? this.themeMode,
    focusMinutes: focusMinutes ?? this.focusMinutes,
  );

  bool get isEmpty =>
      notes.isEmpty && taskMeta.isEmpty && trash.isEmpty && focus == null &&
      completedSessions.isEmpty && themeMode == 'system' && focusMinutes == 25;

  Map<String, dynamic> toJson() => {
    'schema': schema,
    'notes': notes.map((n) => n.toJson()).toList(),
    'taskMeta': {for (final e in taskMeta.entries) e.key: e.value.toJson()},
    'trash': trash.map((t) => t.toJson()).toList(),
    if (focus != null) 'focus': focus!.toJson(),
    'completedSessions': completedSessions,
    'themeMode': themeMode,
    'focusMinutes': focusMinutes,
  };

  /// Strict: malformed extension data keeps the whole payload read-only, the
  /// same way malformed core records do. Unknown future schemas are rejected
  /// rather than partially rewritten.
  factory HaizExtension.fromJson(Object? raw) {
    if (raw == null) return const HaizExtension();
    if (raw is! Map<String, dynamic>) {
      throw const FormatException('2.0 扩展数据无效');
    }
    final version = raw['schema'];
    if (version is! int || version < 2 || version > schema) {
      throw const FormatException('2.0 扩展数据版本不受支持，原始数据已保留');
    }
    List<Map<String, dynamic>> rows(String key) {
      final value = raw[key];
      if (value == null) return const [];
      if (value is! List || value.any((e) => e is! Map<String, dynamic>)) {
        throw FormatException('2.0 扩展字段 $key 无效');
      }
      return value.cast<Map<String, dynamic>>();
    }

    final notes = rows('notes').map(NoteItem.fromJson).toList();
    if (notes.map((n) => n.id).toSet().length != notes.length) {
      throw const FormatException('备忘标识重复，原始数据已保留');
    }
    final metaRaw = raw['taskMeta'] ?? const <String, dynamic>{};
    if (metaRaw is! Map<String, dynamic> ||
        metaRaw.values.any((v) => v is! Map<String, dynamic>)) {
      throw const FormatException('任务时间信息无效');
    }
    final sessions = raw['completedSessions'] ?? const [];
    if (sessions is! List || sessions.any((s) => s is! String)) {
      throw const FormatException('专注会话记录无效');
    }
    final theme = raw['themeMode'] ?? 'system';
    final minutes = raw['focusMinutes'] ?? 25;
    if (theme is! String || !themeModes.contains(theme) ||
        minutes is! int || minutes < 1 || minutes > 180) {
      throw const FormatException('2.0 设置无效');
    }
    return HaizExtension(
      notes: List.unmodifiable(notes),
      taskMeta: Map.unmodifiable({
        for (final e in metaRaw.entries)
          e.key: TaskMeta.fromJson(e.value as Map<String, dynamic>),
      }),
      trash: List.unmodifiable(rows('trash').map(TrashEntry.fromJson)),
      focus: raw['focus'] == null ? null : FocusSession.fromJson(raw['focus']),
      completedSessions: List.unmodifiable(sessions.cast<String>()),
      themeMode: theme,
      focusMinutes: minutes,
    );
  }
}

DateTime _time(Object? value, String label) {
  final parsed = value is String ? DateTime.tryParse(value) : null;
  if (parsed == null) throw FormatException('$label 时间无效');
  return parsed;
}

DateTime? _optionalTime(Object? value, String label) =>
    value == null ? null : _time(value, label);

String _text(Map<String, dynamic> row, String key, {int max = 20000}) {
  final value = row[key];
  if (value is! String || value.length > max) {
    throw FormatException('$key 格式无效');
  }
  return value;
}

/// A free-form memo. It never appears in task lists or due-date views.
class NoteItem {
  const NoteItem({
    required this.id,
    required this.text,
    required this.createdAt,
    required this.updatedAt,
    this.taskId,
  });

  final String id;
  final String text;
  final DateTime createdAt;
  final DateTime updatedAt;

  /// Set when the user explicitly turned this note into a task.
  final String? taskId;

  String get title {
    final first = text.trim().split('\n').first.trim();
    return first.isEmpty ? '空白备忘' : first;
  }

  String get preview {
    final lines = text.trim().split('\n');
    return lines.length < 2 ? '' : lines.skip(1).join(' ').trim();
  }

  NoteItem copyWith({String? text, DateTime? updatedAt, String? taskId}) =>
      NoteItem(
        id: id,
        text: text ?? this.text,
        createdAt: createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
        taskId: taskId ?? this.taskId,
      );

  Map<String, dynamic> toJson() => {
    'id': id,
    'text': text,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    if (taskId != null) 'taskId': taskId,
  };

  factory NoteItem.fromJson(Map<String, dynamic> row) {
    final id = _text(row, 'id', max: 200);
    if (id.isEmpty) throw const FormatException('备忘标识无效');
    final task = row['taskId'];
    if (task != null && task is! String) {
      throw const FormatException('备忘关联任务无效');
    }
    return NoteItem(
      id: id,
      text: _text(row, 'text'),
      createdAt: _time(row['createdAt'], '备忘'),
      updatedAt: _time(row['updatedAt'], '备忘'),
      taskId: task as String?,
    );
  }
}

/// Timestamps 1.5.5 does not store. Absent for tasks created before 2.0.
class TaskMeta {
  const TaskMeta({this.createdAt, this.updatedAt, this.completedAt, this.noteId});

  final DateTime? createdAt;
  final DateTime? updatedAt;
  final DateTime? completedAt;
  final String? noteId;

  TaskMeta copyWith({
    DateTime? createdAt,
    DateTime? updatedAt,
    DateTime? completedAt,
    bool clearCompleted = false,
    String? noteId,
  }) => TaskMeta(
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    completedAt: clearCompleted ? null : (completedAt ?? this.completedAt),
    noteId: noteId ?? this.noteId,
  );

  Map<String, dynamic> toJson() => {
    if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
    if (updatedAt != null) 'updatedAt': updatedAt!.toIso8601String(),
    if (completedAt != null) 'completedAt': completedAt!.toIso8601String(),
    if (noteId != null) 'noteId': noteId,
  };

  factory TaskMeta.fromJson(Map<String, dynamic> row) {
    final note = row['noteId'];
    if (note != null && note is! String) {
      throw const FormatException('任务来源备忘无效');
    }
    return TaskMeta(
      createdAt: _optionalTime(row['createdAt'], '任务'),
      updatedAt: _optionalTime(row['updatedAt'], '任务'),
      completedAt: _optionalTime(row['completedAt'], '任务'),
      noteId: note as String?,
    );
  }
}

/// A deleted task kept for restoration ("最近删除"), including its note.
class TrashEntry {
  const TrashEntry({required this.task, required this.deletedAt, this.note = ''});

  final TaskItem task;
  final DateTime deletedAt;
  final String note;

  Map<String, dynamic> toJson() => {
    'task': task.toJson(),
    'deletedAt': deletedAt.toIso8601String(),
    'note': note,
  };

  factory TrashEntry.fromJson(Map<String, dynamic> row) {
    final task = row['task'];
    if (task is! Map<String, dynamic> || task['id'] is! String ||
        task['title'] is! String) {
      throw const FormatException('最近删除记录无效');
    }
    final note = row['note'] ?? '';
    if (note is! String) throw const FormatException('最近删除记录无效');
    return TrashEntry(
      task: TaskItem.fromJson(task),
      deletedAt: _time(row['deletedAt'], '删除'),
      note: note,
    );
  }
}

enum FocusPhase { running, paused }

/// The persisted state of the one active focus session. Remaining time is
/// always derived from wall-clock timestamps, never from counted ticks.
class FocusSession {
  const FocusSession({
    required this.id,
    required this.label,
    required this.targetSeconds,
    required this.startedAt,
    required this.phase,
    this.taskId,
    this.endsAt,
    this.remainingSeconds,
  });

  final String id;
  final String? taskId;
  final String label;
  final int targetSeconds;
  final DateTime startedAt;
  final FocusPhase phase;

  /// Wall-clock end while running.
  final DateTime? endsAt;

  /// Frozen remainder while paused.
  final int? remainingSeconds;

  int remainingAt(DateTime now) {
    if (phase == FocusPhase.paused) {
      return (remainingSeconds ?? 0).clamp(0, targetSeconds);
    }
    final end = endsAt;
    if (end == null) return 0;
    // Ceil, so a session that started a moment ago still reads 25:00.
    final ms = end.difference(now).inMilliseconds;
    return ((ms + 999) ~/ 1000).clamp(0, targetSeconds);
  }

  int elapsedAt(DateTime now) => targetSeconds - remainingAt(now);

  Map<String, dynamic> toJson() => {
    'id': id,
    if (taskId != null) 'taskId': taskId,
    'label': label,
    'targetSeconds': targetSeconds,
    'startedAt': startedAt.toIso8601String(),
    'phase': phase.name,
    if (endsAt != null) 'endsAt': endsAt!.toIso8601String(),
    if (remainingSeconds != null) 'remainingSeconds': remainingSeconds,
  };

  factory FocusSession.fromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) {
      throw const FormatException('专注会话无效');
    }
    final phase = FocusPhase.values.where((p) => p.name == raw['phase']);
    final target = raw['targetSeconds'];
    final remaining = raw['remainingSeconds'];
    final task = raw['taskId'];
    if (phase.isEmpty || target is! int || target < 60 || target > 180 * 60 ||
        (remaining != null && remaining is! int) ||
        (task != null && task is! String)) {
      throw const FormatException('专注会话无效');
    }
    final session = FocusSession(
      id: _text(raw, 'id', max: 200),
      taskId: task as String?,
      label: _text(raw, 'label', max: 500),
      targetSeconds: target,
      startedAt: _time(raw['startedAt'], '专注'),
      phase: phase.single,
      endsAt: _optionalTime(raw['endsAt'], '专注'),
      remainingSeconds: remaining as int?,
    );
    if ((session.phase == FocusPhase.running && session.endsAt == null) ||
        (session.phase == FocusPhase.paused && session.remainingSeconds == null)) {
      throw const FormatException('专注会话无效');
    }
    return session;
  }
}
