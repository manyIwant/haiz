import '../domain/pocket_models.dart';
import 'haiz_extension.dart';
import 'personal_snapshot.dart';

/// One decision the merge had to make that a person may want to know about.
class MergeConflict {
  const MergeConflict(this.kind, this.label, this.resolution);

  /// 'task', 'course', 'note', 'memo'.
  final String kind;
  final String label;
  final String resolution;
}

class MergeResult {
  const MergeResult({required this.snapshot, required this.conflicts, required this.baseKnown,
      required this.added, required this.removed, required this.updated});
  final PersonalSnapshot snapshot;
  final List<MergeConflict> conflicts;

  /// False when no common ancestor was available; deletions on the other
  /// device could not be recognised and all records were kept.
  final bool baseKnown;

  /// Records the other device added / deleted / changed that were applied.
  final int added;
  final int removed;
  final int updated;

  String get summary {
    final parts = <String>[
      if (added > 0) '另一台设备新增的 $added 项已加入',
      if (updated > 0) '$updated 项采用了另一台设备的修改',
      if (removed > 0) '另一台设备删除的 $removed 项已删除',
      if (conflicts.isNotEmpty) '${conflicts.length} 项两边都改过（见说明）',
    ];
    if (!baseKnown) parts.add('缺少共同版本，无法识别删除，双方记录均已保留');
    return parts.isEmpty ? '两边没有冲突的修改' : parts.join('；');
  }
}

/// Three-way merge of personal snapshots.
///
/// [base] is the last revision this device confirmed with the cloud (read or
/// successfully written). Against it, each side's additions, edits and
/// deletions are recognised per record and per field:
///   - changed on one side only → that side's value;
///   - deleted on one side, untouched on the other → deleted (no resurrection);
///   - deleted on one side, edited on the other → the edit is kept (losing an
///     edit is worse than keeping a deleted record) and reported;
///   - edited on both sides differently → the side with the later
///     modification time wins per field, reported; free text that cannot be
///     ordered (task notes) keeps both versions; a losing memo text is kept
///     as a separate memo, never discarded.
/// Without [base] it degrades to the conservative union and says so.
MergeResult threeWayMerge({PersonalSnapshot? base, required PersonalSnapshot local, required PersonalSnapshot remote}) {
  final conflicts = <MergeConflict>[];
  var added = 0, removed = 0, updated = 0;
  final baseKnown = base != null;

  // ------------------------------------------------------------- tasks
  final bTasks = {for (final t in base?.tasks ?? const <TaskItem>[]) t.id: t};
  final lTasks = {for (final t in local.tasks) t.id: t};
  final rTasks = {for (final t in remote.tasks) t.id: t};
  DateTime? lTime(String id) => local.ext.taskMeta[id]?.updatedAt ?? local.ext.taskMeta[id]?.createdAt;
  DateTime? rTime(String id) => remote.ext.taskMeta[id]?.updatedAt ?? remote.ext.taskMeta[id]?.createdAt;
  bool remoteNewer(String id) {
    final a = lTime(id), b = rTime(id);
    return a != null && b != null && b.isAfter(a);
  }

  final tasks = <TaskItem>[];
  final meta = <String, TaskMeta>{};
  final order = [...local.tasks.map((t) => t.id), ...remote.tasks.map((t) => t.id).where((id) => !lTasks.containsKey(id))];
  for (final id in order) {
    final b = bTasks[id], l = lTasks[id], r = rTasks[id];
    TaskItem? out;
    if (l != null && r != null) {
      out = _mergeTask(b, l, r, remoteNewer(id), (field) =>
          conflicts.add(MergeConflict('task', l.title, '两台设备都改了「$field」，采用了较新的修改')));
      if (!_sameTask(out, l)) updated++;
    } else if (l != null) {
      // Missing remotely: deleted there, or added here since the base.
      if (b == null || !baseKnown) {
        out = l;
      } else if (_sameTask(l, b)) {
        removed++; // Deleted on the other device; untouched here.
      } else {
        out = l;
        conflicts.add(MergeConflict('task', l.title, '另一台设备删除了它，但本机改过，已保留'));
      }
    } else if (r != null) {
      if (b == null || !baseKnown) {
        out = r;
        added++;
      } else if (_sameTask(r, b)) {
        // Deleted here; untouched there.
      } else {
        out = r;
        updated++;
        conflicts.add(MergeConflict('task', r.title, '本机删除了它，但另一台设备改过，已保留'));
      }
    }
    if (out == null) continue;
    tasks.add(out);
    final lm = local.ext.taskMeta[id], rm = remote.ext.taskMeta[id];
    final chosen = (l == null ? rm : r == null ? lm : (remoteNewer(id) ? rm : lm)) ?? lm ?? rm;
    if (chosen != null) {
      meta[id] = out.completed
          ? chosen.copyWith(completedAt: chosen.completedAt ?? lm?.completedAt ?? rm?.completedAt)
          : chosen.copyWith(clearCompleted: true);
    }
  }
  final alive = tasks.map((t) => t.id).toSet();

  // ------------------------------------------------------- task notes
  final notes = <String, String>{};
  for (final id in alive) {
    final b = base?.taskNotes[id], l = local.taskNotes[id], r = remote.taskNotes[id];
    final v = _mergeText(b, l, r);
    if (v.conflict) {
      final title = tasks.firstWhere((t) => t.id == id).title;
      conflicts.add(MergeConflict('note', title, '两台设备都改了笔记，两段都保留了'));
    }
    if (v.value != null && v.value!.isNotEmpty) notes[id] = v.value!;
  }

  // ---------------------------------------------------------- courses
  final bCourses = {for (final c in base?.courses ?? const <CourseSlot>[]) c.id: c};
  final lCourses = {for (final c in local.courses) c.id: c};
  final rCourses = {for (final c in remote.courses) c.id: c};
  final courses = <CourseSlot>[];
  for (final id in [...lCourses.keys, ...rCourses.keys.where((k) => !lCourses.containsKey(k))]) {
    final b = bCourses[id], l = lCourses[id], r = rCourses[id];
    if (l != null && r != null) {
      final same = _courseKey(l) == _courseKey(r);
      if (same || b == null || _courseKey(r) == _courseKey(b)) {
        courses.add(l);
      } else if (_courseKey(l) == _courseKey(b)) {
        courses.add(r);
        updated++;
      } else {
        courses.add(l);
        conflicts.add(MergeConflict('course', '${weekdayText(l.weekday)} ${l.name}', '两台设备都改了这节课，保留了本机的版本'));
      }
    } else if (l != null) {
      if (b == null || !baseKnown) {
        courses.add(l);
      } else if (_courseKey(l) == _courseKey(b)) {
        removed++;
      } else {
        courses.add(l);
        conflicts.add(MergeConflict('course', '${weekdayText(l.weekday)} ${l.name}', '另一台设备删除了它，但本机改过，已保留'));
      }
    } else if (r != null) {
      if (b == null || !baseKnown) {
        courses.add(r);
        added++;
      } else if (_courseKey(r) != _courseKey(b)) {
        courses.add(r);
        conflicts.add(MergeConflict('course', '${weekdayText(r.weekday)} ${r.name}', '本机删除了它，但另一台设备改过，已保留'));
      }
    }
  }

  // ------------------------------------------------- focus logs (append-only)
  final seen = <String>{};
  String fp(FocusLog l) => '${l.at.toIso8601String()}|${l.minutes}|${l.label}';
  final logs = [
    for (final l in [...local.focusLogs, ...remote.focusLogs])
      if (seen.add(fp(l))) l,
  ]..sort((a, b) => b.at.compareTo(a.at));

  // ------------------------------------------------------------ memos
  final bMemo = {for (final n in base?.ext.notes ?? const <NoteItem>[]) n.id: n};
  final lMemo = {for (final n in local.ext.notes) n.id: n};
  final rMemo = {for (final n in remote.ext.notes) n.id: n};
  final memos = <NoteItem>[];
  for (final id in {...lMemo.keys, ...rMemo.keys}) {
    final b = bMemo[id], l = lMemo[id], r = rMemo[id];
    if (l != null && r != null) {
      if (l.text == r.text || (b != null && r.text == b.text)) {
        memos.add(l);
      } else if (b != null && l.text == b.text) {
        memos.add(r);
        updated++;
      } else {
        final newer = r.updatedAt.isAfter(l.updatedAt) ? r : l;
        final older = identical(newer, r) ? l : r;
        memos.add(newer);
        memos.add(NoteItem(id: '${older.id}-conflict', text: '${older.text}\n（合并时保留的另一版本）',
            createdAt: older.createdAt, updatedAt: older.updatedAt));
        conflicts.add(MergeConflict('memo', newer.title, '两台设备都改了这条备忘，较早的版本另存为一条备忘'));
      }
    } else if (l != null) {
      if (b == null || !baseKnown) {
        memos.add(l);
      } else if (l.text == b.text) {
        removed++;
      } else {
        memos.add(l);
        conflicts.add(MergeConflict('memo', l.title, '另一台设备删除了它，但本机改过，已保留'));
      }
    } else if (r != null) {
      if (b == null || !baseKnown) {
        memos.add(r);
        added++;
      } else if (r.text != b.text) {
        memos.add(r);
        conflicts.add(MergeConflict('memo', r.title, '本机删除了它，但另一台设备改过，已保留'));
      }
    }
  }

  // ------------------------------------------------------------ the rest
  final trashIds = <String>{};
  final trash = [
    for (final e in [...local.ext.trash, ...remote.ext.trash])
      if (!alive.contains(e.task.id) && trashIds.add(e.task.id)) e,
  ].take(HaizExtension.maxTrash).toList();
  final activeTask = local.activeTaskId != null && alive.contains(local.activeTaskId) ? local.activeTaskId : null;
  final focus = local.ext.focus ?? remote.ext.focus;

  final snapshot = PersonalSnapshot(
    tasks: tasks,
    courses: courses,
    focusLogs: logs,
    taskNotes: notes,
    activeTaskId: activeTask,
    appearance: local.appearance,
    legacyImported: local.legacyImported || remote.legacyImported,
    ext: local.ext.copyWith(
      notes: memos,
      taskMeta: meta,
      trash: trash,
      focus: focus,
      clearFocus: focus == null,
      completedSessions: {...local.ext.completedSessions, ...remote.ext.completedSessions}.take(20).toList(),
    ),
  );
  return MergeResult(snapshot: snapshot, conflicts: conflicts, baseKnown: baseKnown,
      added: added, removed: removed, updated: updated);
}

/// Compatibility wrapper for the 2.0 name.
PersonalSnapshot mergeSnapshots({PersonalSnapshot? base, required PersonalSnapshot local, required PersonalSnapshot remote}) =>
    threeWayMerge(base: base, local: local, remote: remote).snapshot;

bool _sameTask(TaskItem a, TaskItem b) =>
    a.title == b.title && a.subject == b.subject && a.completed == b.completed && a.dueIso == b.dueIso &&
    a.source == b.source && a.originalNotice == b.originalNotice;

String _courseKey(CourseSlot c) => '${c.name}|${c.weekday}|${c.startMinute}|${c.endMinute}|${c.location}';

/// Field-level three-way merge of one task.
TaskItem _mergeTask(TaskItem? b, TaskItem l, TaskItem r, bool remoteNewer, void Function(String field) conflict) {
  T pick<T>(T bv, T lv, T rv, String field) {
    if (lv == rv) return lv;
    if (b != null && lv == bv) return rv;
    if (b != null && rv == bv) return lv;
    conflict(field);
    return remoteNewer ? rv : lv;
  }

  return TaskItem(
    id: l.id,
    title: pick(b?.title, l.title, r.title, '内容') as String,
    subject: pick(b?.subject, l.subject, r.subject, '科目') as String,
    // A boolean edited on both sides from the same base can only agree;
    // without a base, finishing on either device wins.
    completed: b == null ? (l.completed || r.completed) : pick(b.completed, l.completed, r.completed, '完成状态'),
    example: l.example && r.example,
    dueIso: pick(b?.dueIso, l.dueIso, r.dueIso, '截止日期'),
    source: l.source.isNotEmpty ? l.source : r.source,
    originalNotice: l.originalNotice.isNotEmpty ? l.originalNotice : r.originalNotice,
  );
}

class _Text {
  const _Text(this.value, {this.conflict = false});
  final String? value;
  final bool conflict;
}

_Text _mergeText(String? b, String? l, String? r) {
  if (l == r) return _Text(l);
  if (l == b) return _Text(r);
  if (r == b) return _Text(l);
  if (l == null || l.isEmpty) return _Text(r);
  if (r == null || r.isEmpty) return _Text(l);
  return _Text('$l\n——\n$r', conflict: true);
}
