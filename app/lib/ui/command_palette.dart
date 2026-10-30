import 'package:flutter/material.dart';

import '../core/pocket_store.dart';
import '../domain/pocket_models.dart';
import 'kit.dart';

/// Search local tasks/courses, no network requests or indexing of classmates.
Future<void> showHaizCommand(
  BuildContext context,
  PocketStore store,
  ValueChanged<int> navigate,
) async {
  final query = TextEditingController();
  final p = PocketSkin.of(context).colors;
  await showDialog<void>(
    context: context,
    builder: (dialog) => StatefulBuilder(
      builder: (dialog, update) {
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
          insetPadding: const EdgeInsets.symmetric(horizontal: 18),
          backgroundColor: p.card,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520, maxHeight: 560),
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'HAIZ COMMAND',
                    style: TextStyle(
                      color: p.accent,
                      letterSpacing: 1.8,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 11),
                  TextField(
                    controller: query,
                    autofocus: true,
                    onChanged: (_) => update(() {}),
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search_rounded),
                      hintText: '搜索任务、科目、课程…',
                    ),
                  ),
                  const SizedBox(height: 13),
                  Flexible(
                    child: ListView(
                      shrinkWrap: true,
                      children: [
                        if (tasks.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Text(
                              '学习任务',
                              style: TextStyle(
                                color: p.secondary,
                                fontSize: 11,
                              ),
                            ),
                          ),
                        for (final task in tasks)
                          ListTile(
                            dense: true,
                            leading: Icon(
                              task.completed
                                  ? Icons.check_circle_outline
                                  : Icons.radio_button_unchecked,
                              color: p.accent,
                            ),
                            title: Text(
                              task.title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            subtitle: Text(task.subject),
                            trailing: const Icon(Icons.play_arrow_rounded),
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
                              style: TextStyle(
                                color: p.secondary,
                                fontSize: 11,
                              ),
                            ),
                          ),
                        for (final course in courses)
                          ListTile(
                            dense: true,
                            leading: Icon(
                              Icons.calendar_today_outlined,
                              color: p.accent,
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
                            padding: const EdgeInsets.all(23),
                            child: Text(
                              '没有找到匹配结果。',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: p.secondary),
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
      },
    ),
  );
  query.dispose();
}
