import 'package:flutter/material.dart';

import '../core/pocket_store.dart';
import '../core/academic_session.dart';
import '../domain/pocket_models.dart';
import 'kit.dart';
import 'editorial.dart';
import 'command_palette.dart';
import 'task_workflow.dart';

class TodayPage extends StatefulWidget {
  final PocketStore store;
  final AcademicSession? session;
  final ValueChanged<int> onNavigate;
  const TodayPage({super.key, required this.store, required this.onNavigate, this.session});

  @override
  State<TodayPage> createState() => _TodayPageState();
}

class _TodayPageState extends State<TodayPage> {
  PocketStore get store => widget.store;
  ValueChanged<int> get onNavigate => widget.onNavigate;
  TaskView view = TaskView.pending;

  final TextEditingController _quickText = TextEditingController();
  final FocusNode _quickFocus = FocusNode();
  final Set<String> _finishingTasks = <String>{};
  late int _observedGeneration;

  @override
  void initState() {
    super.initState();
    _observedGeneration = store.generation;
    store.addListener(_watchAccountChange);
  }

  void _watchAccountChange() {
    if (_observedGeneration == store.generation) return;
    _observedGeneration = store.generation;
    _quickText.clear();
    _quickFocus.unfocus();
    if (mounted) {
      setState(() {
        view = TaskView.pending;
        _finishingTasks.clear();
      });
    }
  }

  @override
  void didUpdateWidget(covariant TodayPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.store != store) {
      oldWidget.store.removeListener(_watchAccountChange);
      store.addListener(_watchAccountChange);
      _observedGeneration = store.generation;
      _quickText.clear();
      _finishingTasks.clear();
      view = TaskView.pending;
    }
  }

  @override
  void dispose() {
    store.removeListener(_watchAccountChange);
    _quickText.dispose();
    _quickFocus.dispose();
    super.dispose();
  }

  void _addQuickNote() {
    final text = _quickText.text.trim();
    if (text.isEmpty || text.length > 140 || !store.ready || store.storageError != null) {
      return;
    }
    store.addTask(text, '速记');
    setState(() {
      _quickText.clear();
      view = TaskView.pending;
    });
  }

  void _checkOff(TaskItem task) {
    if (_finishingTasks.contains(task.id)) return;
    if (task.completed) {
      store.toggleTask(task.id);
      return;
    }
    final ticket = store.generation;
    final reduced = PocketSkin.of(context).reducedMotion ||
        MediaQuery.of(context).disableAnimations;
    if (reduced) {
      store.toggleTask(task.id);
      _showCompletedUndo(task.id, ticket);
      return;
    }
    setState(() => _finishingTasks.add(task.id));
    Future<void>.delayed(const Duration(milliseconds: 370), () {
      if (!mounted) return;
      final sameTask = store.generation == ticket &&
          store.tasks.any((item) => item.id == task.id && !item.completed);
      if (sameTask) {
        store.toggleTask(task.id);
        _showCompletedUndo(task.id, ticket);
      }
      setState(() => _finishingTasks.remove(task.id));
    });
  }

  void _showCompletedUndo(String taskId, int ticket) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.hideCurrentSnackBar();
    messenger?.showSnackBar(SnackBar(
      content: const Text('已勾除 · 可以在「已完成」中找回'),
      duration: const Duration(seconds: 4),
      action: SnackBarAction(
        label: '撤销',
        onPressed: () {
          if (store.generation != ticket) return;
          if (store.tasks.any((item) => item.id == taskId && item.completed)) {
            store.toggleTask(taskId);
          }
        },
      ),
    ));
  }

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

              PocketCard(
                padding: const EdgeInsets.fromLTRB(16, 11, 10, 11),
                child: Row(
                  children: [
                    Icon(Icons.edit_note_rounded, color: p.accent, size: 23),
                    const SizedBox(width: 9),
                    Expanded(
                      child: TextField(
                        key: const Key('quick-memo-input'),
                        controller: _quickText,
                        focusNode: _quickFocus,
                        maxLength: 140,
                        maxLines: 1,
                        textInputAction: TextInputAction.done,
                        onSubmitted: (_) => _addQuickNote(),
                        onChanged: (_) => setState(() {}),
                        decoration: InputDecoration(
                          hintText: '想到什么，随手记下来…',
                          counterText: '',
                          isDense: true,
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(vertical: 11),
                          hintStyle: TextStyle(color: p.secondary),
                        ),
                      ),
                    ),
                    IconButton.filledTonal(
                      key: const Key('quick-memo-add'),
                      tooltip: '添加速记',
                      onPressed: _quickText.text.trim().isEmpty ? null : _addQuickNote,
                      icon: const Icon(Icons.arrow_upward_rounded, size: 19),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              CampusPhotoPanel(
                asset: 'assets/campus/campus_fengqitang.jpg',
                eyebrow: 'A SCHOOL THAT REMEMBERS',
                title: store.remainingCount == 0
                    ? '当前没有待办'
                    : '还有 ${store.remainingCount} 项待办',
                caption: current == null
                    ? '随手写下一件事，完成后轻轻勾除'
                    : '下一节 ${current.name} · ${minutesText(current.startMinute)}',
                actionLabel: '快速记录',
                onTap: () => _quickFocus.requestFocus(),
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
                  child: AnimatedOpacity(
                    opacity: _finishingTasks.contains(task.id) ? 0.16 : 1,
                    duration: Duration(milliseconds:
                        PocketSkin.of(context).reducedMotion ? 0 : 330),
                    curve: Curves.easeOutCubic,
                    child: AnimatedSlide(
                      offset: _finishingTasks.contains(task.id)
                          ? const Offset(0.08, -0.04) : Offset.zero,
                      duration: Duration(milliseconds:
                          PocketSkin.of(context).reducedMotion ? 0 : 330),
                      curve: Curves.easeInOutCubic,
                      child: PocketCard(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 11,
                      vertical: 10,
                    ),
                    child: Row(
                      children: [
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
                                      color: task.completed || _finishingTasks.contains(task.id)
                                          ? p.secondary
                                          : p.foreground,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                      decoration: task.completed || _finishingTasks.contains(task.id)
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
                        IconButton(
                          key: Key('task-check-${task.id}'),
                          tooltip: task.completed ? '标记为未完成' : '标记完成',
                          onPressed: _finishingTasks.contains(task.id)
                              ? null : () => _checkOff(task),
                          icon: AnimatedSwitcher(
                            duration: Duration(milliseconds:
                                PocketSkin.of(context).reducedMotion ? 0 : 190),
                            transitionBuilder: (child, animation) =>
                                ScaleTransition(scale: animation, child: child),
                            child: Icon(
                              task.completed || _finishingTasks.contains(task.id)
                                  ? Icons.check_circle_rounded
                                  : Icons.circle_outlined,
                              key: ValueKey(task.completed ||
                                  _finishingTasks.contains(task.id)),
                              color: p.accent,
                              size: 26,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                    ),
                  ),
                ),
              if (widget.session?.identity != null) ...[
                const SizedBox(height: 20),
                Row(children: [
                  Expanded(child: SectionLabel('班级最新作业',
                      trailing: widget.session!.selectedClass == null ? '尚未加入班级' : 'HAIZ Academic · 已发布')),
                  IconButton(
                    tooltip: '同步班级作业',
                    icon: const Icon(Icons.refresh_rounded),
                    onPressed: widget.session!.busy ? null
                        : () => widget.session!.refresh(),
                  ),
                ]),
                const SizedBox(height: 8),
                if (widget.session!.assignments.isEmpty)
                  PocketCard(child: Text(
                    '当前班级暂无已发布作业，或尚未完成刷新。请确认网络与班级权限。',
                    style: TextStyle(color: p.secondary, fontSize: 12),
                  )),
                for (final item in widget.session!.assignments.take(8))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: PocketCard(child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${item['subject'] ?? '其他'} · ${item['title'] ?? ''}',
                          style: TextStyle(color: p.foreground,
                              fontWeight: FontWeight.w600)),
                        const SizedBox(height: 5),
                        Text('截止：${item['due'] ?? '待确认'} · 班级正式发布',
                          style: TextStyle(color: p.secondary, fontSize: 11)),
                      ],
                    )),
                  ),
              ],
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
