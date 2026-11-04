import 'package:flutter/material.dart';

import '../../app/nav.dart';
import '../../core/pocket_store.dart';
import '../../design/components.dart';
import '../../design/theme.dart';
import '../../design/tokens.dart';
import '../../domain/planning.dart';
import '../../domain/pocket_models.dart';

Future<void> showTaskEditor(
  BuildContext context, {
  required PocketStore store,
  TaskItem? task,
  HaizActions? actions,
  String initialTitle = '',
  DateTime? initialDue,
}) {
  return showHaizSheet<void>(
    context,
    builder: (_) => TaskEditor(
      store: store,
      task: task,
      actions: actions,
      generation: store.generation,
      initialTitle: initialTitle,
      initialDue: initialDue,
    ),
  );
}

const subjectChoices = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '其他'];

/// Due choices as words students use. The picker is the fallback.
List<(String, DateTime?)> quickDueChoices(DateTime now) {
  final today = dayOf(now);
  DateTime add(int d) => DateTime(today.year, today.month, today.day + d);
  final untilFriday = (5 - today.weekday + 7) % 7;
  final nextMonday = 8 - today.weekday;
  return [
    ('今天', today),
    ('明天', add(1)),
    ('后天', add(2)),
    if (untilFriday > 2) ('周五', add(untilFriday)),
    ('下周一', add(nextMonday)),
  ];
}

/// Edit a task in a sheet. Changes are saved explicitly; closing with
/// unsaved edits asks first. The source trail is visible and never edited.
class TaskEditor extends StatefulWidget {
  const TaskEditor({
    super.key,
    required this.store,
    required this.generation,
    this.task,
    this.actions,
    this.initialTitle = '',
    this.initialDue,
  });

  final PocketStore store;
  final int generation;
  final TaskItem? task;
  final HaizActions? actions;
  final String initialTitle;
  final DateTime? initialDue;

  @override
  State<TaskEditor> createState() => _TaskEditorState();
}

class _TaskEditorState extends State<TaskEditor> {
  late final TextEditingController _title =
      TextEditingController(text: widget.task?.title ?? widget.initialTitle);
  late final TextEditingController _note =
      TextEditingController(text: widget.task == null ? '' : widget.store.noteFor(widget.task!.id));
  late String _subject = widget.task?.subject ?? detectSubject(widget.initialTitle) ?? '其他';
  late DateTime? _due = widget.task == null ? widget.initialDue : dueDate(widget.task!);
  bool _showOriginal = false;

  PocketStore get store => widget.store;
  bool get _isNew => widget.task == null;

  bool get _dirty {
    final t = widget.task;
    if (t == null) return _title.text.trim().isNotEmpty || _note.text.trim().isNotEmpty;
    return _title.text.trim() != t.title || _subject != t.subject ||
        _due != dueDate(t) || _note.text != store.noteFor(t.id);
  }

  @override
  void dispose() {
    _title.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _due ?? now,
      firstDate: DateTime(now.year - 2),
      lastDate: DateTime(now.year + 3),
      helpText: '截止日期',
    );
    if (picked != null && mounted) setState(() => _due = picked);
  }

  void _save() {
    final title = _title.text.trim();
    if (title.isEmpty) return;
    if (store.generation != widget.generation || !store.writable) {
      showDialog<void>(
        context: context,
        builder: (dialog) => AlertDialog(
          title: const Text('没有保存'),
          content: Text(store.generation != widget.generation
              ? '账号已切换，这次修改没有写入任何账号。'
              : (store.storageError ?? '当前记录暂不可写入。')),
          actions: [TextButton(onPressed: () => Navigator.pop(dialog), child: const Text('知道了'))],
        ),
      );
      return;
    }
    final task = widget.task;
    if (task == null) {
      store.addTask(title, _subject, due: _due, note: _note.text);
    } else {
      store.updateTask(task.id, title: title, subject: _subject, due: _due);
      if (_note.text != store.noteFor(task.id)) store.setTaskNote(task.id, _note.text);
    }
    Navigator.of(context).pop();
  }

  Future<bool> _confirmDiscard() async {
    final discard = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: const Text('放弃这些修改？'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog, false), child: const Text('继续编辑')),
          TextButton(
            onPressed: () => Navigator.pop(dialog, true),
            child: Text('放弃', style: TextStyle(color: context.c.signal)),
          ),
        ],
      ),
    );
    return discard == true;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final now = DateTime.now();
    final task = widget.task;
    final subjects = {...subjectChoices, _subject}.toList();
    final note = task == null ? null : store.metaFor(task.id).noteId;
    return PopScope(
      canPop: !_dirty,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (await _confirmDiscard() && context.mounted) Navigator.of(context).pop();
      },
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(Space.gutter, 0, Space.gutter, Space.x6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(children: [
              Text(_isNew ? '新建任务' : '编辑任务', style: TypeScale.headline(c.ink)),
              const Spacer(),
              HaizButton(
                key: const Key('save-task'),
                label: _isNew ? '添加' : '保存',
                dense: true,
                onPressed: _title.text.trim().isEmpty ? null : _save,
              ),
            ]),
            const SizedBox(height: Space.x3),
            TextField(
              key: const Key('task-title'),
              controller: _title,
              autofocus: _isNew,
              maxLength: 140,
              minLines: 1,
              maxLines: 3,
              textInputAction: TextInputAction.done,
              style: TypeScale.body(c.ink),
              decoration: const InputDecoration(hintText: '要做什么', counterText: ''),
              onChanged: (_) => setState(() {}),
              onSubmitted: (_) => _save(),
            ),
            const SizedBox(height: Space.x4),
            Text('科目', style: TypeScale.label(c.ink2)),
            const SizedBox(height: Space.x2),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final s in subjects)
                HaizChip(
                  label: s,
                  selected: _subject == s,
                  leading: s == '其他' ? null : SubjectMark(s, showLabel: false),
                  onTap: () => setState(() => _subject = s),
                ),
            ]),
            const SizedBox(height: Space.x4),
            Row(children: [
              Text('截止', style: TypeScale.label(c.ink2)),
              const SizedBox(width: 8),
              Text(_due == null ? '未设置' : dateLabel(_due!, now),
                  style: TypeScale.footnote(_due == null ? c.ink3 : c.ink)),
            ]),
            const SizedBox(height: Space.x2),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final (label, date) in quickDueChoices(now))
                HaizChip(
                  label: label,
                  selected: _due != null && date != null && dayOf(_due!) == date,
                  onTap: () => setState(() => _due = date),
                ),
              HaizChip(
                key: const Key('task-due-picker'),
                label: '选择日期',
                leading: const Icon(Icons.calendar_today_outlined),
                selected: false,
                onTap: _pickDate,
              ),
              if (_due != null)
                HaizChip(label: '不设日期', selected: false, onTap: () => setState(() => _due = null)),
            ]),
            const SizedBox(height: Space.x4),
            TextField(
              key: const Key('task-note'),
              controller: _note,
              minLines: 2,
              maxLines: 6,
              maxLength: 4000,
              style: TypeScale.callout(c.ink),
              decoration: const InputDecoration(hintText: '笔记：思路、页码、要问老师的问题', counterText: ''),
              onChanged: (_) => setState(() {}),
            ),
            if (task != null && task.source.isNotEmpty) ...[
              const SizedBox(height: Space.x4),
              _SourceTrail(
                task: task,
                fromNote: note == null ? null : store.noteById(note),
                expanded: _showOriginal,
                onToggle: () => setState(() => _showOriginal = !_showOriginal),
              ),
            ],
            if (task != null) ...[
              const SizedBox(height: Space.x4),
              const Hairline(),
              const SizedBox(height: Space.x2),
              Row(children: [
                if (!task.completed && widget.actions != null)
                  LinkAction('开始专注', icon: Icons.timer_outlined, onTap: () {
                    Navigator.of(context).pop();
                    widget.actions!.openFocus(taskId: task.id);
                  }),
                const Spacer(),
                LinkAction('删除', color: c.signal, icon: Icons.delete_outline_rounded, onTap: () {
                  final ticket = store.generation;
                  final noteText = store.noteFor(task.id);
                  store.deleteTask(task.id);
                  Navigator.of(context).pop();
                  showToast(context, '已删除，可在「最近删除」找回', action: '撤销', onAction: () {
                    if (store.generation == ticket) store.restoreTask(task, note: noteText);
                  });
                }),
              ]),
            ],
          ],
        ),
      ),
    );
  }
}

class _SourceTrail extends StatelessWidget {
  const _SourceTrail({required this.task, required this.fromNote, required this.expanded, required this.onToggle});
  final TaskItem task;
  final NoteItem? fromNote;
  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final hasOriginal = task.originalNotice.trim().isNotEmpty;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        border: Border(left: BorderSide(color: c.ruleStrong, width: 2)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('来源', style: TypeScale.micro(c.ink3)),
        const SizedBox(height: 2),
        Text(task.source, style: TypeScale.footnote(c.ink2)),
        if (fromNote != null) ...[
          const SizedBox(height: 4),
          Text('「${fromNote!.title}」', style: TypeScale.footnote(c.ink)),
        ],
        if (hasOriginal) ...[
          const SizedBox(height: 4),
          LinkAction(expanded ? '收起原文' : '查看原文', onTap: onToggle),
          if (expanded)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: SelectableText(task.originalNotice, style: TypeScale.footnote(c.ink)),
            ),
        ],
      ]),
    );
  }
}
