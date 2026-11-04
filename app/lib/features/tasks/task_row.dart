import 'dart:async';

import 'package:flutter/material.dart';

import '../../app/nav.dart';
import '../../core/pocket_store.dart';
import '../../design/components.dart';
import '../../design/theme.dart';
import '../../design/tokens.dart';
import '../../domain/planning.dart';
import '../../domain/pocket_models.dart';

/// One task. Content sits on the page (no card); the tick is the only
/// strong mark. Meta line: subject · due · provenance.
class TaskRow extends StatelessWidget {
  const TaskRow({
    super.key,
    required this.task,
    required this.now,
    required this.onToggle,
    required this.onOpen,
    this.onDelete,
    this.onFocus,
    this.hasNote = false,
    this.showDue = true,
    this.completing = false,
  });

  final TaskItem task;
  final DateTime now;
  final VoidCallback onToggle;
  final VoidCallback onOpen;
  final VoidCallback? onDelete;
  final VoidCallback? onFocus;
  final bool hasNote;
  final bool showDue;

  /// Just ticked; still shown in place for a moment so it can be undone.
  final bool completing;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final done = task.completed || completing;
    final bucket = bucketOf(task, now);
    final due = showDue ? dueLabel(task, now) : '';
    final urgent = !done && (bucket == DueBucket.overdue || bucket == DueBucket.today);
    final row = Pressable(
      onTap: onOpen,
      onLongPress: () => _menu(context),
      semanticLabel: null,
      child: Padding(
        padding: const EdgeInsets.only(left: 8, right: Space.gutter),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            HaizCheck(
              key: Key('task-check-${task.id}'),
              checked: done,
              label: done ? '标记为未完成：${task.title}' : '完成：${task.title}',
              onChanged: (_) => onToggle(),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 11, bottom: 11),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AnimatedDefaultTextStyle(
                      duration: context.haiz.motion(Motion.base),
                      style: TypeScale.body(done ? c.ink3 : c.ink).copyWith(
                        decoration: done ? TextDecoration.lineThrough : TextDecoration.none,
                        decorationColor: c.ink3,
                        decorationThickness: 1.2,
                      ),
                      child: Text(task.title, maxLines: 3, overflow: TextOverflow.ellipsis),
                    ),
                    const SizedBox(height: 3),
                    Wrap(
                      spacing: 10,
                      runSpacing: 2,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        SubjectMark(task.subject),
                        if (due.isNotEmpty)
                          Text(due, style: TypeScale.caption(urgent ? c.signal : c.ink2)
                              .copyWith(fontWeight: urgent ? FontWeight.w600 : FontWeight.w400)),
                        if (task.source.isNotEmpty)
                          Row(mainAxisSize: MainAxisSize.min, children: [
                            Icon(task.source == '来自备忘' ? Icons.sticky_note_2_outlined : Icons.move_to_inbox_outlined,
                                size: 13, color: c.ink3),
                            const SizedBox(width: 3),
                            Text(task.source == '来自备忘' ? '备忘' : '通知', style: TypeScale.caption(c.ink3)),
                          ]),
                        if (hasNote)
                          Icon(Icons.notes_rounded, size: 14, color: c.ink3),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
    if (onDelete == null) return row;
    return Dismissible(
      key: ValueKey('dismiss-${task.id}'),
      direction: DismissDirection.endToStart,
      dismissThresholds: const {DismissDirection.endToStart: .35},
      background: Container(
        color: c.signal,
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 24),
        child: const Text('删除', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
      ),
      onDismissed: (_) => onDelete!(),
      child: row,
    );
  }

  Future<void> _menu(BuildContext context) async {
    final box = context.findRenderObject() as RenderBox?;
    final overlay = Overlay.of(context).context.findRenderObject() as RenderBox?;
    if (box == null || overlay == null) return;
    final origin = box.localToGlobal(Offset(box.size.width - 160, box.size.height / 2), ancestor: overlay);
    final choice = await showMenu<String>(
      context: context,
      position: RelativeRect.fromLTRB(origin.dx, origin.dy, overlay.size.width - origin.dx, 0),
      items: [
        const PopupMenuItem(value: 'open', child: Text('编辑')),
        if (onFocus != null && !task.completed) const PopupMenuItem(value: 'focus', child: Text('开始专注')),
        if (onDelete != null) const PopupMenuItem(value: 'delete', child: Text('删除')),
      ],
    );
    switch (choice) {
      case 'open': onOpen();
      case 'focus': onFocus?.call();
      case 'delete': onDelete?.call();
    }
  }
}

/// A grouped task list that handles completion the way people expect:
/// the write happens immediately; the row stays, ticked, for a moment (so a
/// mis-tap is easy to undo), then folds away. Deletion is undoable too.
class TaskGroupList extends StatefulWidget {
  const TaskGroupList({
    super.key,
    required this.store,
    required this.now,
    required this.groups,
    this.emphasizeOverdue = true,
  });

  final PocketStore store;
  final DateTime now;

  /// Groups computed by the screen from open tasks.
  final List<(DueBucket, List<TaskItem>)> Function(Iterable<TaskItem> open) groups;
  final bool emphasizeOverdue;

  @override
  State<TaskGroupList> createState() => _TaskGroupListState();
}

class _TaskGroupListState extends State<TaskGroupList> {
  /// Ticked but not yet folded away: id → snapshot taken before completion.
  final Map<String, TaskItem> _holding = {};
  final Set<String> _folding = {};
  final Map<String, Timer> _timers = {};
  int _generation = -1;

  PocketStore get store => widget.store;

  @override
  void dispose() {
    for (final t in _timers.values) {
      t.cancel();
    }
    super.dispose();
  }

  void _toggle(TaskItem task) {
    final ticket = store.generation;
    if (task.completed || _holding.containsKey(task.id)) {
      // Untick: restore immediately.
      _timers.remove(task.id)?.cancel();
      setState(() { _holding.remove(task.id); _folding.remove(task.id); });
      store.setTaskCompleted(task.id, false);
      return;
    }
    // Persist first. The animation is only a visual copy of the row.
    store.setTaskCompleted(task.id, true);
    if (!store.tasks.any((t) => t.id == task.id && t.completed)) return;
    final reduce = context.haiz.reduceMotion;
    showToast(context, '已完成「${_short(task.title)}」', action: '撤销', onAction: () {
      if (store.generation != ticket) return;
      _timers.remove(task.id)?.cancel();
      if (mounted) setState(() { _holding.remove(task.id); _folding.remove(task.id); });
      store.setTaskCompleted(task.id, false);
    });
    if (reduce) return;
    setState(() => _holding[task.id] = task);
    _timers[task.id] = Timer(Motion.completionHold, () {
      if (!mounted || store.generation != ticket) return;
      setState(() => _folding.add(task.id));
      _timers[task.id] = Timer(Motion.base + const Duration(milliseconds: 40), () {
        if (!mounted) return;
        setState(() { _holding.remove(task.id); _folding.remove(task.id); });
        _timers.remove(task.id);
      });
    });
  }

  void _delete(BuildContext context, TaskItem task) {
    final ticket = store.generation;
    final note = store.noteFor(task.id);
    final wasActive = store.activeTaskId == task.id;
    store.deleteTask(task.id);
    showToast(context, '已删除「${_short(task.title)}」，可在「最近删除」找回', action: '撤销', onAction: () {
      if (store.generation != ticket) return;
      store.restoreTask(task, note: note, reactivate: wasActive);
    });
  }

  static String _short(String s) => s.length > 14 ? '${s.substring(0, 14)}…' : s;

  @override
  Widget build(BuildContext context) {
    if (_generation != store.generation) {
      _generation = store.generation;
      _holding.clear();
      _folding.clear();
    }
    final actions = HaizScope.maybeOf(context)?.actions;
    final open = <TaskItem>[
      for (final t in store.tasks)
        if (!t.completed) t else ?_holding[t.id],
    ];
    final groups = widget.groups(open);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (bucket, tasks) in groups) ...[
          SectionHeader(
            bucketTitle(bucket),
            count: tasks.where((t) => !_holding.containsKey(t.id)).length,
            emphasis: widget.emphasizeOverdue && bucket == DueBucket.overdue,
          ),
          for (final task in tasks)
            _Fold(
              key: ValueKey('fold-${task.id}'),
              folded: _folding.contains(task.id),
              child: TaskRow(
                task: task,
                now: widget.now,
                completing: _holding.containsKey(task.id),
                hasNote: store.noteFor(task.id).trim().isNotEmpty,
                onToggle: () => _toggle(task),
                onOpen: () => actions?.openTask(task.id),
                onFocus: actions == null ? null : () => actions.openFocus(taskId: task.id),
                onDelete: () => _delete(context, task),
              ),
            ),
        ],
      ],
    );
  }
}

class _Fold extends StatelessWidget {
  const _Fold({super.key, required this.folded, required this.child});
  final bool folded;
  final Widget child;
  @override
  Widget build(BuildContext context) {
    final d = context.haiz.motion(Motion.base);
    return AnimatedSize(
      duration: d,
      curve: Motion.exit,
      alignment: Alignment.topCenter,
      child: AnimatedOpacity(
        duration: d,
        opacity: folded ? 0 : 1,
        child: folded ? const SizedBox(width: double.infinity) : child,
      ),
    );
  }
}
