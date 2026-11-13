import 'package:flutter/material.dart';

import '../core/pocket_store.dart';
import '../domain/pocket_models.dart';
import 'editorial.dart';
import 'kit.dart';
import 'agenda_section.dart';

class SchedulePage extends StatelessWidget {
  final PocketStore store;
  const SchedulePage({super.key, required this.store});

  Future<void> _addCourse(BuildContext context) async {
    final name = TextEditingController();
    final place = TextEditingController();
    final generation = store.generation;
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
              const SectionLabel('添加课程'),
              const SizedBox(height: 16),
              TextField(
                controller: name,
                decoration: const InputDecoration(labelText: '课程名称'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: place,
                decoration: const InputDecoration(labelText: '地点（选填）'),
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 4,
                children: [
                  for (int d = 1; d <= 7; d++)
                    ChoiceChip(
                      label: Text('周${weekdayText(d)}'),
                      selected: day == d,
                      onSelected: (_) => setLocal(() => day = d),
                    ),
                ],
              ),
              const SizedBox(height: 12),
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
                    padding: EdgeInsets.symmetric(horizontal: 8),
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
              const SizedBox(height: 16),
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
                    if (store.generation != generation) {
                      Navigator.of(context).pop();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('已切换账号，课程未写入任何账号。')),
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
      padding: HaizSpace.page,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 800),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const EditorialMasthead(number: '02', chapter: '课表'),
              const SizedBox(height: 24),
              const PageTitle(title: '本周课表', subtitle: '每周重复的课程，保存在这台设备上'),
              const SizedBox(height: HaizSpace.section),
              Row(
                children: [
                  const Expanded(child: SectionLabel('我的课程')),
                  TextButton.icon(
                    onPressed: () => _addCourse(context),
                    icon: const Icon(Icons.add_rounded, size: 18),
                    label: const Text('添加课程'),
                  ),
                ],
              ),
              const SizedBox(height: HaizSpace.group),
              Row(
                children: [
                  for (int d = 1; d <= 7; d++)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2),
                        child: _DayCell(
                          label: weekdayText(d),
                          selected: store.selectedWeekday == d,
                          hasCourses: coursesForDay(
                            store.courses,
                            d,
                          ).isNotEmpty,
                          onTap: () => store.setDay(d),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 24),
              SectionLabel(
                '周${weekdayText(store.selectedWeekday)}',
                trailing: '${items.length} 节',
              ),
              const SizedBox(height: 12),
              if (items.isEmpty)
                PocketCard(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 24,
                  ),
                  child: Center(
                    child: Text('这一天没有安排课程', style: HaizType.secondary(p)),
                  ),
                ),
              for (final course in items) ...[
                PocketCard(
                  padding: const EdgeInsets.fromLTRB(16, 12, 4, 12),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 56,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              minutesText(course.startMinute),
                              style: HaizType.itemTitle(p)
                                  .copyWith(fontFeatures: HaizType.tabular),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              minutesText(course.endMinute),
                              style: HaizType.meta(p),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        height: 40,
                        width: 3,
                        decoration: BoxDecoration(
                          color: p.accent,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(course.name, style: HaizType.itemTitle(p)),
                            if (course.example || course.location.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(
                                  course.example
                                      ? '示例 · ${course.location}'
                                      : course.location,
                                  style: HaizType.secondary(p),
                                ),
                              ),
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip: '移除课程',
                        icon: Icon(
                          Icons.more_horiz_rounded,
                          color: p.muted,
                          size: 20,
                        ),
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
                const SizedBox(height: HaizSpace.row),
              ],
              AgendaSection(store: store),
              const SizedBox(height: 16),
              Text('每周重复课表 · 演示数据不会连接学校系统', style: HaizType.meta(p)),
            ],
          ),
        ),
      ),
    );
  }
}

/// One weekday in the strip. A dot marks days that have courses.
class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.label,
    required this.selected,
    required this.hasCourses,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final bool hasCourses;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    final ink = selected ? p.onAccent : p.foreground;
    return Semantics(
      selected: selected,
      button: true,
      label: '周$label',
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(HaizRadius.control),
        child: AnimatedContainer(
          duration: HaizMotion.of(context, HaizMotion.fast),
          curve: HaizMotion.ease,
          height: 56,
          decoration: BoxDecoration(
            color: selected ? p.accent : p.card,
            borderRadius: BorderRadius.circular(HaizRadius.control),
            border: Border.all(color: selected ? p.accent : p.border),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: ink,
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 4),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: hasCourses
                      ? (selected ? p.onAccent : p.muted)
                      : Colors.transparent,
                  shape: BoxShape.circle,
                ),
                child: const SizedBox(width: 4, height: 4),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
