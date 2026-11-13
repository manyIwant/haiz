import 'package:flutter/material.dart';

import '../core/pocket_store.dart';
import '../domain/pocket_models.dart';
import 'kit.dart';

/// Search local tasks/courses, no network requests or indexing of classmates.
Future<void> showHaizCommand(
  BuildContext context,
  PocketStore store,
  ValueChanged<int> navigate,
) {
  final colors = PocketSkin.of(context).colors;
  return showDialog<void>(
    context: context,
    builder: (_) =>
        _HaizCommandDialog(store: store, navigate: navigate, colors: colors),
  );
}

/// Own the search controller for the entire dialog route lifecycle, including
/// its exit animation; the caller's showDialog future ends earlier.
class _HaizCommandDialog extends StatefulWidget {
  const _HaizCommandDialog({
    required this.store,
    required this.navigate,
    required this.colors,
  });
  final PocketStore store;
  final ValueChanged<int> navigate;
  final PocketPalette colors;

  @override
  State<_HaizCommandDialog> createState() => _HaizCommandDialogState();
}

class _HaizCommandDialogState extends State<_HaizCommandDialog> {
  final query = TextEditingController();

  @override
  void dispose() {
    query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext dialog) {
    final p = widget.colors;
    final store = widget.store;
    final navigate = widget.navigate;
    final needle = query.text.trim().toLowerCase();
    final tasks = store.tasks
        .where(
          (t) =>
              needle.isEmpty ||
              t.title.toLowerCase().contains(needle) ||
              t.subject.toLowerCase().contains(needle) ||
              store.noteFor(t.id).toLowerCase().contains(needle),
        )
        .take(20)
        .toList();
    final courses = store.courses
        .where(
          (c) =>
              needle.isNotEmpty &&
              (c.name.toLowerCase().contains(needle) ||
                  c.location.toLowerCase().contains(needle)),
        )
        .take(10)
        .toList();
    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 20),
      backgroundColor: p.card,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520, maxHeight: 560),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('搜索', style: HaizType.section(p)),
              const SizedBox(height: 12),
              TextField(
                controller: query,
                autofocus: true,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search_rounded, size: 20),
                  hintText: '任务、科目或课程',
                ),
              ),
              const SizedBox(height: 12),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    if (tasks.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Text(
                          '学习任务',
                          style: HaizType.meta(p),
                        ),
                      ),
                    for (final task in tasks)
                      ListTile(
                        dense: true,
                        leading: Icon(
                          task.completed
                              ? Icons.check_circle_outline
                              : Icons.radio_button_unchecked,
                          size: 20,
                          color: task.completed ? p.accent : p.muted,
                        ),
                        title: Text(
                          task.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        subtitle: Text(task.subject),
                        trailing: Icon(
                          Icons.timer_outlined,
                          size: 18,
                          color: p.muted,
                          semanticLabel: '开始专注',
                        ),
                        onTap: () {
                          store.chooseFocusTask(task.id);
                          Navigator.of(dialog).pop();
                          navigate(3);
                        },
                      ),
                    if (courses.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Text(
                          '课程',
                          style: HaizType.meta(p),
                        ),
                      ),
                    for (final course in courses)
                      ListTile(
                        dense: true,
                        leading: Icon(
                          Icons.calendar_view_week_outlined,
                          size: 20,
                          color: p.muted,
                        ),
                        title: Text(course.name),
                        subtitle: Text(
                          '周${weekdayText(course.weekday)} · ${minutesText(course.startMinute)}',
                        ),
                        onTap: () {
                          store.setDay(course.weekday);
                          Navigator.of(dialog).pop();
                          navigate(1);
                        },
                      ),
                    if (tasks.isEmpty && courses.isEmpty)
                      Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          '没有找到匹配结果',
                          textAlign: TextAlign.center,
                          style: HaizType.secondary(p),
                        ),
                      ),
                  ],
                ),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => Navigator.pop(dialog),
                  child: const Text('关闭'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
