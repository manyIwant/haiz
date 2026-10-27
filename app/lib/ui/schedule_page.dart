import 'package:flutter/material.dart';

import '../core/pocket_store.dart';
import '../domain/pocket_models.dart';
import 'kit.dart';

class SchedulePage extends StatelessWidget {
  final PocketStore store;
  const SchedulePage({super.key, required this.store});

  Future<void> _addCourse(BuildContext context) async {
    final name = TextEditingController();
    final place = TextEditingController();
    int day = store.selectedWeekday;
    TimeOfDay begin = const TimeOfDay(hour: 8, minute: 0);
    TimeOfDay end = const TimeOfDay(hour: 8, minute: 45);
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      backgroundColor: PocketSkin.of(context).colors.card,
      builder: (sheet) => StatefulBuilder(
        builder: (context, setLocal) => Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            8,
            20,
            MediaQuery.of(context).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionLabel('添加一节课程'),
              const SizedBox(height: 16),
              TextField(
                controller: name,
                decoration: const InputDecoration(
                  labelText: '课程名称',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: place,
                decoration: const InputDecoration(
                  labelText: '地点（选填）',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 15),
              Wrap(
                spacing: 5,
                children: [
                  for (int d = 1; d <= 7; d++)
                    ChoiceChip(
                      label: Text('周${weekdayText(d)}'),
                      selected: day == d,
                      onSelected: (_) => setLocal(() => day = d),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.schedule_rounded),
                      label: Text(begin.format(context)),
                      onPressed: () async {
                        final picked = await showTimePicker(
                          context: context,
                          initialTime: begin,
                        );
                        if (picked != null) setLocal(() => begin = picked);
                      },
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 9),
                    child: Text('至'),
                  ),
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.more_time_rounded),
                      label: Text(end.format(context)),
                      onPressed: () async {
                        final picked = await showTimePicker(
                          context: context,
                          initialTime: end,
                        );
                        if (picked != null) setLocal(() => end = picked);
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 15),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {
                    final start = begin.hour * 60 + begin.minute;
                    final stop = end.hour * 60 + end.minute;
                    if (name.text.trim().isEmpty || stop <= start) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('请填写课程名，并确保结束时间晚于开始时间')),
                      );
                      return;
                    }
                    store.addCourse(
                      name: name.text,
                      weekday: day,
                      startMinute: start,
                      endMinute: stop,
                      location: place.text,
                    );
                    Navigator.of(context).pop();
                  },
                  child: const Text('保存到课表'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    name.dispose();
    place.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    final items = coursesForDay(store.courses, store.selectedWeekday);
    return SingleChildScrollView(
      key: const PageStorageKey('schedule_scroll'),
      padding: const EdgeInsets.fromLTRB(23, 31, 23, 130),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 800),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Eyebrow('YOUR WEEK / AN OVERVIEW'),
              const SizedBox(height: 23),
              const PageTitle(title: '一周，有序展开。', subtitle: '课表留在身边，不需要重复整理。'),
              const SizedBox(height: 26),
              Row(
                children: [
                  const Expanded(child: SectionLabel('我的课程')),
                  PocketPill(
                    label: '添加课程',
                    icon: Icons.add_rounded,
                    onTap: () => _addCourse(context),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  for (int d = 1; d <= 7; d++)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2),
                        child: InkWell(
                          onTap: () => store.setDay(d),
                          borderRadius: BorderRadius.circular(16),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 210),
                            padding: const EdgeInsets.symmetric(vertical: 15),
                            decoration: BoxDecoration(
                              color: store.selectedWeekday == d
                                  ? p.accent
                                  : p.card,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: store.selectedWeekday == d
                                    ? p.accent
                                    : p.border,
                              ),
                            ),
                            child: Column(
                              children: [
                                Text(
                                  '周',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: store.selectedWeekday == d
                                        ? Colors.white
                                        : p.secondary,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  weekdayText(d),
                                  style: TextStyle(
                                    color: store.selectedWeekday == d
                                        ? Colors.white
                                        : p.foreground,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 18,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 24),
              SectionLabel(
                '周${weekdayText(store.selectedWeekday)}',
                trailing: '共 ${items.length} 节课程',
              ),
              const SizedBox(height: 13),
              if (items.isEmpty)
                PocketCard(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 28),
                    child: Center(
                      child: Column(
                        children: [
                          Icon(
                            Icons.menu_book_outlined,
                            color: p.secondary,
                            size: 35,
                          ),
                          const SizedBox(height: 11),
                          Text(
                            '这一天没有安排课程',
                            style: TextStyle(color: p.secondary),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              for (final course in items) ...[
                PocketCard(
                  padding: const EdgeInsets.fromLTRB(16, 17, 10, 17),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 62,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              minutesText(course.startMinute),
                              style: TextStyle(
                                color: p.foreground,
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                            const SizedBox(height: 5),
                            Text(
                              minutesText(course.endMinute),
                              style: TextStyle(
                                color: p.secondary,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        height: 43,
                        width: 3,
                        decoration: BoxDecoration(
                          color: p.accent,
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      const SizedBox(width: 15),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              course.name,
                              style: TextStyle(
                                color: p.foreground,
                                fontWeight: FontWeight.bold,
                                fontSize: 17,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              course.example
                                  ? '示例 · ${course.location}'
                                  : course.location,
                              style: TextStyle(
                                color: p.secondary,
                                fontSize: 11.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip: '移除课程',
                        icon: Icon(Icons.more_horiz, color: p.secondary),
                        onPressed: () => showDialog<void>(
                          context: context,
                          builder: (dialog) => AlertDialog(
                            title: Text('移除「${course.name}」？'),
                            content: const Text('仅删除当前设备上的这条课表记录。'),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.pop(dialog),
                                child: const Text('取消'),
                              ),
                              TextButton(
                                onPressed: () {
                                  store.deleteCourse(course.id);
                                  Navigator.pop(dialog);
                                },
                                child: const Text('移除'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
              ],
              const SizedBox(height: 11),
              Text(
                '当前为每周重复课表 · 演示数据不会自动连接学校系统',
                style: TextStyle(color: p.secondary, fontSize: 11),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
