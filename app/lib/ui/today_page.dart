import 'package:flutter/material.dart';

import '../core/pocket_store.dart';
import '../domain/pocket_models.dart';
import 'kit.dart';
import 'editorial.dart';
import 'command_palette.dart';

class TodayPage extends StatelessWidget {
  final PocketStore store;
  final ValueChanged<int> onNavigate;
  const TodayPage({super.key, required this.store, required this.onNavigate});

  Future<void> _addTask(BuildContext context) async {
    final generation = store.generation;
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: PocketSkin.of(context).colors.card,
      builder: (sheet) => _AddTaskSheet(store: store, generation: generation),
    );
    if (saved == false && context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('已切换账号，任务未写入任何账号。')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    final now = DateTime.now();
    final current = nextCourse(store.courses, now);
    final tasks = store.tasks;
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
                    ? '今日任务已完成'
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
                    onPressed: () => _addTask(context),
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
              const SectionLabel('时间与课程', trailing: '只展示当前有用的信息'),
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
                      '今天的任务',
                      trailing: '${store.doneCount}/${tasks.length} 已完成',
                    ),
                  ),
                  IconButton.filledTonal(
                    tooltip: '添加任务',
                    onPressed: () => _addTask(context),
                    icon: const Icon(Icons.add_rounded),
                  ),
                ],
              ),
              const SizedBox(height: 11),
              if (tasks.isEmpty)
                PocketCard(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Column(
                      children: [
                        Icon(
                          Icons.check_circle_outline,
                          color: p.accent,
                          size: 32,
                        ),
                        const SizedBox(height: 11),
                        Text(
                          '还没有任务，添加第一件吧。',
                          style: TextStyle(color: p.secondary),
                        ),
                      ],
                    ),
                  ),
                ),
              for (final task in tasks) ...[
                Padding(
                  padding: const EdgeInsets.only(bottom: 9),
                  child: PocketCard(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    child: Row(
                      children: [
                        IconButton(
                          onPressed: () => store.toggleTask(task.id),
                          icon: AnimatedSwitcher(
                            duration: const Duration(milliseconds: 160),
                            child: Icon(
                              task.completed
                                  ? Icons.check_circle_rounded
                                  : Icons.circle_outlined,
                              key: ValueKey(task.completed),
                              color: p.accent,
                              size: 24,
                            ),
                          ),
                        ),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                task.title,
                                style: TextStyle(
                                  color: task.completed
                                      ? p.secondary
                                      : p.foreground,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  decoration: task.completed
                                      ? TextDecoration.lineThrough
                                      : null,
                                ),
                              ),
                              const SizedBox(height: 5),
                              Text(
                                task.example
                                    ? '${task.subject}  ·  示例任务'
                                    : '${task.subject}${task.dueIso == null ? '' : ' · 截止 ${task.dueIso}'}',
                                style: TextStyle(
                                  color: p.secondary,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (task.originalNotice.isNotEmpty)
                          IconButton(
                            tooltip: '查看通知原文',
                            visualDensity: VisualDensity.compact,
                            icon: Icon(
                              Icons.info_outline_rounded,
                              color: p.secondary,
                              size: 19,
                            ),
                            onPressed: () => showDialog<void>(
                              context: context,
                              builder: (dialog) => AlertDialog(
                                title: const Text('任务的原始通知'),
                                content: SingleChildScrollView(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        task.source,
                                        style: TextStyle(
                                          color: p.accent,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
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
                            ),
                          ),
                        IconButton(
                          tooltip: '继续这项学习任务',
                          onPressed: () {
                            store.chooseFocusTask(task.id);
                            onNavigate(3);
                          },
                          icon: Icon(
                            Icons.play_arrow_rounded,
                            size: 21,
                            color: p.accent,
                          ),
                        ),
                        IconButton(
                          tooltip: '删除',
                          onPressed: () => store.deleteTask(task.id),
                          icon: Icon(
                            Icons.close_rounded,
                            size: 17,
                            color: p.secondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
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

class _AddTaskSheet extends StatefulWidget {
  const _AddTaskSheet({required this.store, required this.generation});
  final PocketStore store;
  final int generation;
  @override
  State<_AddTaskSheet> createState() => _AddTaskSheetState();
}

class _AddTaskSheetState extends State<_AddTaskSheet> {
  final _title = TextEditingController();
  String _subject = '数学';

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  void _submit() {
    if (_title.text.trim().isEmpty) return;
    if (widget.store.generation != widget.generation) {
      Navigator.pop(context, false);
      return;
    }
    widget.store.addTask(_title.text, _subject);
    Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        22,
        6,
        22,
        MediaQuery.of(context).viewInsets.bottom + 30,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionLabel('添加一件要做的事'),
          const SizedBox(height: 15),
          TextField(
            controller: _title,
            autofocus: true,
            textInputAction: TextInputAction.done,
            decoration: const InputDecoration(
              hintText: '例如：复习数列第 2 节',
              border: OutlineInputBorder(),
            ),
            onSubmitted: (_) => _submit(),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 7,
            children: [
              for (final option in ['数学', '语文', '英语', '物理', '化学', '其他'])
                ChoiceChip(
                  label: Text(option),
                  selected: _subject == option,
                  onSelected: (_) => setState(() => _subject = option),
                ),
            ],
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: FilledButton(onPressed: _submit, child: const Text('添加到今天')),
          ),
        ],
      ),
    );
  }
}
