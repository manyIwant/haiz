import 'package:flutter/material.dart';

import '../core/pocket_store.dart';
import '../domain/pocket_models.dart';
import 'kit.dart';

enum TaskView { pending, upcoming, completed, all }

List<TaskItem> tasksForView(
  Iterable<TaskItem> source,
  TaskView view,
  DateTime now,
) {
  final today = DateTime(now.year, now.month, now.day);
  final until = today.add(const Duration(days: 7));
  bool inNextWeek(TaskItem task) {
    final due = DateTime.tryParse(task.dueIso ?? '');
    return due != null && due.isBefore(until);
  }

  final filtered = source
      .where(
        (task) => switch (view) {
          TaskView.pending => !task.completed,
          TaskView.upcoming => !task.completed && inNextWeek(task),
          TaskView.completed => task.completed,
          TaskView.all => true,
        },
      )
      .toList();
  filtered.sort((a, b) {
    if (a.completed != b.completed) return a.completed ? 1 : -1;
    final dateA = a.dueIso, dateB = b.dueIso;
    if (dateA == null && dateB != null) return 1;
    if (dateB == null && dateA != null) return -1;
    if (dateA != null && dateB != null) {
      final compared = dateA.compareTo(dateB);
      if (compared != 0) return compared;
    }
    return 0;
  });
  return filtered;
}

String taskDueText(TaskItem task, DateTime now) {
  if (task.dueIso == null) return '未设置截止日期';
  final due = DateTime.tryParse(task.dueIso!);
  if (due == null) return '日期待核对';
  final date = DateTime(due.year, due.month, due.day);
  final today = DateTime(now.year, now.month, now.day);
  final difference = date.difference(today).inDays;
  if (task.completed) return '${task.dueIso} · 已完成';
  if (difference < 0) return '已逾期 ${-difference} 天';
  if (difference == 0) return '今日截止';
  if (difference == 1) return '明日截止';
  if (difference < 7) return '$difference 天后截止';
  return '${task.dueIso} 截止';
}

class TaskEditorSheet extends StatefulWidget {
  const TaskEditorSheet({
    super.key,
    required this.store,
    required this.generation,
    this.task,
  });
  final PocketStore store;
  final int generation;
  final TaskItem? task;
  @override
  State<TaskEditorSheet> createState() => _TaskEditorSheetState();
}

class _TaskEditorSheetState extends State<TaskEditorSheet> {
  late final TextEditingController _title = TextEditingController(
    text: widget.task?.title ?? '',
  );
  late String _subject = widget.task?.subject ?? '数学';
  late DateTime? _due = DateTime.tryParse(widget.task?.dueIso ?? '');

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  void _save() {
    if (_title.text.trim().isEmpty) return;
    if (widget.store.generation != widget.generation) {
      Navigator.of(context).pop(false);
      return;
    }
    if (widget.task case final TaskItem task) {
      widget.store.updateTask(
        task.id,
        title: _title.text,
        subject: _subject,
        due: _due,
      );
    } else {
      widget.store.addTask(_title.text, _subject, due: _due);
    }
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final options = <String>{'数学', '语文', '英语', '物理', '化学', '生物', '其他'};
    if (_subject.isNotEmpty) options.add(_subject);
    return Padding(
      padding: EdgeInsets.fromLTRB(
        22,
        6,
        22,
        MediaQuery.of(context).viewInsets.bottom + 26,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionLabel(widget.task == null ? '新建学习任务' : '修改学习任务'),
            const SizedBox(height: 15),
            TextField(
              key: const Key('task-title'),
              controller: _title,
              autofocus: true,
              maxLength: 140,
              textInputAction: TextInputAction.done,
              decoration: const InputDecoration(
                labelText: '要做什么',
                hintText: '例如：整理物理实验数据',
                border: OutlineInputBorder(),
              ),
              onChanged: (_) => setState(() {}),
              onSubmitted: (_) => _save(),
            ),
            const SizedBox(height: 8),
            const SectionLabel('科目'),
            const SizedBox(height: 9),
            Wrap(
              spacing: 6,
              runSpacing: 2,
              children: [
                for (final option in options)
                  ChoiceChip(
                    label: Text(option),
                    selected: _subject == option,
                    onSelected: (_) => setState(() => _subject = option),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            const SectionLabel('截止日期 · 可选'),
            const SizedBox(height: 9),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    key: const Key('task-due-picker'),
                    icon: const Icon(Icons.calendar_today_outlined, size: 18),
                    label: Text(
                      _due == null
                          ? '设置日期'
                          : '${_due!.year}-${_due!.month.toString().padLeft(2, '0')}-${_due!.day.toString().padLeft(2, '0')}',
                    ),
                    onPressed: () async {
                      final today = DateTime.now();
                      final date = await showDatePicker(
                        context: context,
                        initialDate: _due ?? today,
                        firstDate: DateTime(2020),
                        lastDate: DateTime(2100),
                      );
                      if (date != null && mounted) setState(() => _due = date);
                    },
                  ),
                ),
                if (_due != null)
                  TextButton(
                    onPressed: () => setState(() => _due = null),
                    child: const Text('清除'),
                  ),
              ],
            ),
            const SizedBox(height: 17),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                key: const Key('save-task'),
                onPressed: _title.text.trim().isEmpty ? null : _save,
                child: Text(widget.task == null ? '添加任务' : '保存修改'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
