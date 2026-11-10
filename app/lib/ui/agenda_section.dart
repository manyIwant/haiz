import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../core/pocket_store.dart';
import '../domain/calendar_export.dart';
import 'kit.dart';

class AgendaSection extends StatelessWidget {
  final PocketStore store;
  const AgendaSection({super.key, required this.store});

  Future<void> _export(BuildContext context) async {
    if (store.upcomingTasks.isEmpty) return;
    try {
      final target = await FilePicker.saveFile(
        fileName: 'HAIZ-作业日历.ics',
        mimeType: 'text/calendar',
        bytes: CalendarExport.bytes(store.upcomingTasks),
      );
      if (!context.mounted) return;
      if (target != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('日历文件已保存。可在日历 App 中打开导入。')),
        );
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('导出失败：$error')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    final tasks = store.upcomingTasks;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 27),
        Row(
          children: [
            const Expanded(child: SectionLabel('作业日历')),
            TextButton.icon(
              onPressed: tasks.isEmpty ? null : () => _export(context),
              icon: const Icon(Icons.ios_share_rounded, size: 16),
              label: const Text('导出 .ics'),
            ),
          ],
        ),
        const SizedBox(height: 9),
        PocketCard(
          child: tasks.isEmpty
              ? Text(
                  '还没有带截止日期的待办。确认通知后会自动出现在这里。',
                  style: TextStyle(
                    color: p.secondary,
                    fontSize: 12,
                    height: 1.6,
                  ),
                )
              : Column(
                  children: [
                    for (final task in tasks.take(12)) ...[
                      Row(
                        children: [
                          Container(
                            width: 60,
                            padding: const EdgeInsets.symmetric(vertical: 9),
                            decoration: BoxDecoration(
                              color: p.accent.withValues(alpha: .10),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Column(
                              children: [
                                Text(
                                  task.dueIso!.substring(5, 7),
                                  style: TextStyle(
                                    color: p.secondary,
                                    fontSize: 10,
                                  ),
                                ),
                                Text(
                                  task.dueIso!.substring(8, 10),
                                  style: TextStyle(
                                    color: p.accent,
                                    fontSize: 19,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  task.title,
                                  style: TextStyle(
                                    color: p.foreground,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 13.5,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  task.subject,
                                  style: TextStyle(
                                    color: p.secondary,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      if (task != tasks.take(12).last)
                        Divider(
                          height: 19,
                          color: p.border.withValues(alpha: .7),
                        ),
                    ],
                  ],
                ),
        ),
        const SizedBox(height: 8),
        Text(
          '日期来自导入时的人工确认；导出不会向系统日历直接写入。',
          style: TextStyle(color: p.secondary, fontSize: 11),
        ),
      ],
    );
  }
}
