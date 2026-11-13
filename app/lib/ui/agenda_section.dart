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
        const SizedBox(height: HaizSpace.section - HaizSpace.row),
        Row(
          children: [
            const Expanded(child: SectionLabel('作业日历')),
            TextButton.icon(
              onPressed: tasks.isEmpty ? null : () => _export(context),
              icon: const Icon(Icons.ios_share_rounded, size: 18),
              label: const Text('导出 .ics'),
            ),
          ],
        ),
        const SizedBox(height: HaizSpace.row),
        PocketCard(
          child: tasks.isEmpty
              ? Text('还没有带截止日期的待办。确认通知后会出现在这里。', style: HaizType.secondary(p))
              : Column(
                  children: [
                    for (final task in tasks.take(12)) ...[
                      Row(
                        children: [
                          Container(
                            width: 48,
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            decoration: BoxDecoration(
                              color: p.raised,
                              borderRadius: BorderRadius.circular(
                                HaizRadius.inner,
                              ),
                            ),
                            child: Column(
                              children: [
                                Text(
                                  '${int.parse(task.dueIso!.substring(5, 7))}月',
                                  style: HaizType.meta(p),
                                ),
                                Text(
                                  task.dueIso!.substring(8, 10),
                                  style: HaizType.itemTitle(p).copyWith(
                                    fontSize: 17,
                                    fontFeatures: HaizType.tabular,
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
                                Text(task.title, style: HaizType.itemTitle(p)),
                                const SizedBox(height: 4),
                                Text(task.subject, style: HaizType.meta(p)),
                              ],
                            ),
                          ),
                        ],
                      ),
                      if (task != tasks.take(12).last)
                        Divider(height: 24, color: p.border),
                    ],
                  ],
                ),
        ),
        const SizedBox(height: HaizSpace.row),
        Text('日期来自导入时的人工确认；导出不会直接写入系统日历', style: HaizType.meta(p)),
      ],
    );
  }
}
