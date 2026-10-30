import 'package:flutter/material.dart';

import '../core/pocket_store.dart';
import '../domain/pocket_models.dart';
import 'kit.dart';
import 'editorial.dart';
import 'command_palette.dart';
import 'task_workflow.dart';

class TodayPage extends StatefulWidget {
  final PocketStore store;
  final ValueChanged<int> onNavigate;
  const TodayPage({super.key, required this.store, required this.onNavigate});

  @override
  State<TodayPage> createState() => _TodayPageState();
}

class _TodayPageState extends State<TodayPage> {
  PocketStore get store => widget.store;
  ValueChanged<int> get onNavigate => widget.onNavigate;
  TaskView view = TaskView.pending;

  Future<void> _editTask(BuildContext context, [TaskItem? task]) async {
    final generation = store.generation;
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      backgroundColor: PocketSkin.of(context).colors.card,
      builder: (_) =>
          TaskEditorSheet(store: store, generation: generation, task: task),
    );
    if (saved == false && context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('已切换账号，本次修改没有保存。')));
    }
  }

  void _deleteTask(BuildContext context, TaskItem task) {
    final generation = store.generation;
    final savedNote = store.noteFor(task.id);
    final wasActive = store.activeTaskId == task.id;
    store.deleteTask(task.id);
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: const Text('已移除任务'),
        duration: const Duration(seconds: 5),
        action: SnackBarAction(
          label: '撤销',
          onPressed: () {
            if (store.generation != generation) return;
            store.restoreTask(task, note: savedNote, reactivate: wasActive);
          },
        ),
      ),
    );
  }

  void _showSource(BuildContext context, TaskItem task) {
    showDialog<void>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: const Text('任务的原始通知'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(task.source),
              const SizedBox(height: 12),
              SelectableText(task.originalNotice),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog),
            child: const Text('关闭'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    final now = DateTime.now();
    final current = nextCourse(store.courses, now);
    final tasks = tasksForView(store.tasks, view, now);
    return SingleChildScrollView(
      key: const PageStorageKey('today_scroll'),
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(23, 31, 23, 130),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 800),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              EditorialMasthead(
                chapter: '01 / DAILY NOTES',
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      tooltip: '搜索课程与任务',
                      icon: const Icon(Icons.search_rounded, size: 22),
                      onPressed: () =>
                          showHaizCommand(context, store, onNavigate),
                    ),
                    IconButton(
                      tooltip: '导入通知',
                      icon: const Icon(Icons.move_to_inbox_outlined, size: 21),
                      onPressed: () => onNavigate(2),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),
              EditorialHeading(
                title: '今天。',
                subtitle:
                    '${now.month}月${now.day}日 · ${const ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][now.weekday - 1]}  /  校园日常',
              ),
              const SizedBox(height: 22),
              CampusPhotoPanel(
                asset: 'assets/campus/campus_fengqitang.jpg',
                eyebrow: 'A SCHOOL THAT REMEMBERS',
                title: store.remainingCount == 0
                    ? '当前没有待办'
                    : '还有 ${store.remainingCount} 项待办',
                caption: current == null
                    ? '暂时没有后续课程 · 已专注 ${store.todayFocusMinutes} 分钟'
                    : '下一节 ${current.name} · ${minutesText(current.startMinute)}',
                actionLabel: '进入专注',
                onTap: () => onNavigate(3),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  OutlinedButton.icon(
                    onPressed: () => _editTask(context),
                    icon: const Icon(Icons.add_rounded, size: 18),
                    label: const Text('新建任务'),
                  ),
                  const SizedBox(width: 10),
                  TextButton.icon(
                    onPressed: () => onNavigate(2),
                    icon: const Icon(Icons.file_download_outlined, size: 17),
                    label: const Text('导入通知'),
                  ),
                ],
              ),
              const SizedBox(height: 26),
              const SectionLabel('时间与课程', trailing: '按本机课表显示'),
              const SizedBox(height: 12),
              PocketCard(
                child: Row(
                  children: [
                    Container(
                      height: 53,
                      width: 4,
                      decoration: BoxDecoration(
                        color: p.accent,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const SizedBox(width: 15),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            current == null ? '今天没有后续课程' : current.name,
                            style: TextStyle(
                              color: p.foreground,
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 5),
                          Text(
                            current == null
                                ? '可以专心处理自己的学习任务'
                                : '${minutesText(current.startMinute)} — ${minutesText(current.endMinute)}  ·  ${current.location}',
                            style: TextStyle(
                              color: p.secondary,
                              fontSize: 12.5,
                            ),
                          ),
                          if (current?.example == true)
                            Padding(
                              padding: const EdgeInsets.only(top: 5),
                              child: Text(
                                '演示课表 · 可自行修改',
                                style: TextStyle(
                                  color: p.secondary,
                                  fontSize: 10,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => onNavigate(1),
                      icon: Icon(Icons.north_east_rounded, color: p.secondary),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 27),
              Row(
                children: [
                  Expanded(
                    child: SectionLabel(
                      '我的任务',
                      trailing: '${store.doneCount}/${store.tasks.length} 已完成',
                    ),
                  ),
                  IconButton.filledTonal(
                    tooltip: '添加任务',
                    onPressed: () => _editTask(context),
                    icon: const Icon(Icons.add_rounded),
                  ),
                ],
              ),
              const SizedBox(height: 7),
              Wrap(
                spacing: 7,
                runSpacing: 0,
                children: [
                  for (final item in [
                    (TaskView.pending, '待办'),
                    (TaskView.upcoming, '日期提醒'),
                    (TaskView.completed, '已完成'),
                    (TaskView.all, '全部'),
                  ])
                    ChoiceChip(
                      label: Text(item.$2),
                      selected: view == item.$1,
                      onSelected: (_) => setState(() => view = item.$1),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              if (tasks.isEmpty)
                PocketCard(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    child: Column(
                      children: [
                        Icon(Icons.inbox_outlined, color: p.accent, size: 28),
                        const SizedBox(height: 8),
                        Text(switch (view) {
                          TaskView.pending => '当前没有未完成的任务',
                          TaskView.upcoming => '未来七天及逾期任务为空',
                          TaskView.completed => '还没有已完成的任务',
                          TaskView.all => '还没有任务，创建第一项吧',
                        }, style: TextStyle(color: p.secondary)),
                      ],
                    ),
                  ),
                ),
              for (final task in tasks)
                Padding(
                  padding: const EdgeInsets.only(bottom: 9),
                  child: PocketCard(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 11,
                      vertical: 10,
                    ),
                    child: Row(
                      children: [
                        IconButton(
                          tooltip: task.completed ? '标记为未完成' : '标记完成',
                          onPressed: () => store.toggleTask(task.id),
                          icon: Icon(
                            task.completed
                                ? Icons.check_circle_rounded
                                : Icons.circle_outlined,
                            color: p.accent,
                            size: 23,
                          ),
                        ),
                        Expanded(
                          child: InkWell(
                            onTap: () => _editTask(context, task),
                            borderRadius: BorderRadius.circular(8),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 6),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    task.title,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: task.completed
                                          ? p.secondary
                                          : p.foreground,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                      decoration: task.completed
                                          ? TextDecoration.lineThrough
                                          : null,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${task.subject} · ${taskDueText(task, now)}',
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: p.secondary,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        IconButton(
                          tooltip: '接着学习',
                          onPressed: () {
                            store.chooseFocusTask(task.id);
                            onNavigate(3);
                          },
                          icon: Icon(
                            Icons.play_arrow_rounded,
                            size: 20,
                            color: p.accent,
                          ),
                        ),
                        PopupMenuButton<String>(
                          tooltip: '任务操作',
                          padding: EdgeInsets.zero,
                          icon: Icon(
                            Icons.more_horiz_rounded,
                            color: p.secondary,
                            size: 20,
                          ),
                          onSelected: (choice) {
                            if (choice == 'edit') _editTask(context, task);
                            if (choice == 'source') _showSource(context, task);
                            if (choice == 'delete') _deleteTask(context, task);
                          },
                          itemBuilder: (_) => [
                            const PopupMenuItem(
                              value: 'edit',
                              child: Text('编辑任务与日期'),
                            ),
                            if (task.originalNotice.isNotEmpty)
                              const PopupMenuItem(
                                value: 'source',
                                child: Text('查看通知原文'),
                              ),
                            const PopupMenuItem(
                              value: 'delete',
                              child: Text('删除任务'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              Text(
                '本地学习数据 · 未连接学校教务系统',
                style: TextStyle(color: p.secondary, fontSize: 11),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
