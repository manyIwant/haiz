import 'package:flutter/material.dart';

import '../core/pocket_store.dart';
import '../core/academic_session.dart';
import '../domain/pocket_models.dart';
import '../domain/quick_task_date_parser.dart';
import 'kit.dart';
import 'editorial.dart';
import 'command_palette.dart';
import 'task_workflow.dart';

class TodayPage extends StatefulWidget {
  final PocketStore store;
  final AcademicSession? session;
  final ValueChanged<int> onNavigate;
  const TodayPage({
    super.key,
    required this.store,
    required this.onNavigate,
    this.session,
  });

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
  final Map<String, TaskItem> _exitingTasks = <String, TaskItem>{};
  final Set<String> _collapsedTasks = <String>{};
  bool _dateAccepted = false;
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
    _dateAccepted = false;
    if (mounted) {
      setState(() {
        view = TaskView.pending;
        _finishingTasks.clear();
        _exitingTasks.clear();
        _collapsedTasks.clear();
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
      _exitingTasks.clear();
      _collapsedTasks.clear();
      _dateAccepted = false;
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
    if (text.isEmpty ||
        text.length > 140 ||
        !store.ready ||
        store.storageError != null) {
      return;
    }
    final suggestion = QuickTaskDateParser.suggest(text, DateTime.now());
    store.addTask(text, '速记', due: _dateAccepted ? suggestion?.date : null);
    setState(() {
      _quickText.clear();
      _dateAccepted = false;
      view = TaskView.pending;
    });
  }

  void _checkOff(TaskItem task) {
    if (_finishingTasks.contains(task.id) ||
        !store.ready ||
        store.storageError != null) {
      return;
    }
    if (task.completed) {
      store.toggleTask(task.id);
      return;
    }

    final ticket = store.generation;
    final reduced =
        PocketSkin.of(context).reducedMotion ||
        MediaQuery.of(context).disableAnimations;

    // Persist first. Exit animations are only visual copies of a task,
    // never a delayed write: leaving the app cannot lose a completed task.
    if (!reduced) {
      setState(() {
        _finishingTasks.add(task.id);
        _exitingTasks[task.id] = task;
      });
    }
    store.toggleTask(task.id);
    if (!store.tasks.any((item) => item.id == task.id && item.completed)) {
      if (!reduced) {
        setState(() {
          _finishingTasks.remove(task.id);
          _exitingTasks.remove(task.id);
        });
      }
      return;
    }
    _showCompletedUndo(task.id, ticket);
    if (reduced) {
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted ||
          store.generation != ticket ||
          !_exitingTasks.containsKey(task.id)) {
        return;
      }
      setState(() => _collapsedTasks.add(task.id));
    });
    Future<void>.delayed(const Duration(milliseconds: 390), () {
      if (!mounted || store.generation != ticket) {
        return;
      }
      setState(() {
        _finishingTasks.remove(task.id);
        _exitingTasks.remove(task.id);
        _collapsedTasks.remove(task.id);
      });
    });
  }

  void _showCompletedUndo(String taskId, int ticket) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.hideCurrentSnackBar();
    messenger?.showSnackBar(
      SnackBar(
        content: const Text('已勾除 · 可以在「已完成」中找回'),
        duration: const Duration(seconds: 4),
        action: SnackBarAction(
          label: '撤销',
          onPressed: () {
            if (store.generation != ticket) return;
            if (store.tasks.any(
              (item) => item.id == taskId && item.completed,
            )) {
              if (mounted) {
                setState(() {
                  _finishingTasks.remove(taskId);
                  _exitingTasks.remove(taskId);
                  _collapsedTasks.remove(taskId);
                });
              }
              store.toggleTask(taskId);
            }
          },
        ),
      ),
    );
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
    final tasks = tasksForView(
      [
        ...store.tasks.where((task) => !_exitingTasks.containsKey(task.id)),
        ..._exitingTasks.values,
      ],
      view,
      now,
    );
    final dateSuggestion = QuickTaskDateParser.suggest(_quickText.text, now);
    return SingleChildScrollView(
      key: const PageStorageKey('today_scroll'),
      physics: const BouncingScrollPhysics(),
      padding: HaizSpace.page,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 800),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              EditorialMasthead(
                number: '01',
                chapter: '今天',
                trailing: IconButton(
                  tooltip: '搜索课程与任务',
                  icon: const Icon(Icons.search_rounded, size: 20),
                  onPressed: () => showHaizCommand(context, store, onNavigate),
                ),
              ),
              const SizedBox(height: 24),
              EditorialHeading(
                title: '今天',
                subtitle:
                    '${now.month}月${now.day}日 ${const ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][now.weekday - 1]}',
              ),
              const SizedBox(height: 24),
              PocketCard(
                padding: const EdgeInsets.fromLTRB(16, 4, 4, 4),
                child: Row(
                  children: [
                    Icon(Icons.edit_note_rounded, color: p.muted, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        key: const Key('quick-memo-input'),
                        controller: _quickText,
                        focusNode: _quickFocus,
                        maxLength: 140,
                        maxLines: 1,
                        textInputAction: TextInputAction.done,
                        onSubmitted: (_) => _addQuickNote(),
                        onChanged: (_) => setState(() => _dateAccepted = false),
                        style: HaizType.body(p),
                        decoration: InputDecoration(
                          hintText: '随手记一件事',
                          counterText: '',
                          isDense: true,
                          filled: false,
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(
                            vertical: 12,
                          ),
                          hintStyle: TextStyle(color: p.muted),
                        ),
                      ),
                    ),
                    IconButton.filledTonal(
                      key: const Key('quick-memo-add'),
                      tooltip: '添加速记',
                      onPressed: _quickText.text.trim().isEmpty
                          ? null
                          : _addQuickNote,
                      icon: const Icon(Icons.arrow_upward_rounded, size: 18),
                    ),
                  ],
                ),
              ),
              if (dateSuggestion != null) ...[
                const SizedBox(height: 8),
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 8,
                  children: [
                    ChoiceChip(
                      key: const Key('quick-memo-date-suggestion'),
                      label: Text(
                        _dateAccepted
                            ? '已采用 · ${dateSuggestion.label}'
                            : '建议日期 · ${dateSuggestion.label}',
                      ),
                      selected: _dateAccepted,
                      onSelected: (selected) =>
                          setState(() => _dateAccepted = selected),
                    ),
                    Text('可选，不会自动设置', style: HaizType.meta(p)),
                  ],
                ),
              ],
              const SizedBox(height: HaizSpace.section),
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: SectionLabel(
                      '我的任务',
                      trailing: '${store.doneCount}/${store.tasks.length} 已完成',
                    ),
                  ),
                  const SizedBox(width: 4),
                  Tooltip(
                    message: '添加任务',
                    child: TextButton.icon(
                      onPressed: () => _editTask(context),
                      icon: const Icon(Icons.add_rounded, size: 18),
                      label: const Text('新建任务'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: HaizSpace.group),
              Wrap(
                spacing: 8,
                runSpacing: 8,
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
              const SizedBox(height: HaizSpace.group),
              if (tasks.isEmpty)
                PocketCard(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 24,
                  ),
                  child: Center(
                    child: Text(switch (view) {
                      TaskView.pending => '当前没有未完成的任务',
                      TaskView.upcoming => '未来七天没有到期或逾期的任务',
                      TaskView.completed => '还没有已完成的任务',
                      TaskView.all => '还没有任务',
                    }, style: HaizType.secondary(p)),
                  ),
                ),
              for (final task in tasks)
                AnimatedSize(
                  key: ValueKey('animated-task-${task.id}'),
                  duration: HaizMotion.of(context, HaizMotion.enter),
                  curve: HaizMotion.ease,
                  alignment: Alignment.topCenter,
                  child: _collapsedTasks.contains(task.id)
                      ? const SizedBox.shrink()
                      : Padding(
                          padding: const EdgeInsets.only(bottom: HaizSpace.row),
                          child: _taskRow(context, p, task, now),
                        ),
                ),
              const SizedBox(height: HaizSpace.section - HaizSpace.row),
              CampusPhotoPanel(
                asset: 'assets/campus/campus_fengqitang.jpg',
                place: '凤栖堂',
                title: store.remainingCount == 0
                    ? '当前没有待办'
                    : '还有 ${store.remainingCount} 项待办',
                caption: current == null
                    ? '随手写下一件事，完成后轻轻勾除'
                    : '下一节 ${current.name} · ${minutesText(current.startMinute)}',
                actionLabel: '快速记录',
                onTap: () => _quickFocus.requestFocus(),
              ),
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: () => onNavigate(2),
                icon: const Icon(Icons.move_to_inbox_outlined, size: 18),
                label: const Text('导入通知'),
              ),
              if (widget.session?.identity != null) ...[
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: SectionLabel(
                        '班级最新作业',
                        trailing: widget.session!.selectedClass == null
                            ? '尚未加入班级'
                            : 'HAIZ Academic · 已发布',
                      ),
                    ),
                    IconButton(
                      tooltip: '同步班级作业',
                      icon: const Icon(Icons.refresh_rounded, size: 20),
                      onPressed: widget.session!.busy
                          ? null
                          : () => widget.session!.refresh(),
                    ),
                  ],
                ),
                const SizedBox(height: HaizSpace.row),
                if (widget.session!.assignments.isEmpty)
                  PocketCard(
                    child: Text(
                      '当前班级暂无已发布作业，或尚未完成刷新。请确认网络与班级权限。',
                      style: HaizType.secondary(p),
                    ),
                  ),
                for (final item in widget.session!.assignments.take(8))
                  Padding(
                    padding: const EdgeInsets.only(bottom: HaizSpace.row),
                    child: PocketCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${item['subject'] ?? '其他'} · ${item['title'] ?? ''}',
                            style: HaizType.itemTitle(p),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '截止 ${item['due'] ?? '待确认'} · 班级正式发布',
                            style: HaizType.meta(p),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
              const SizedBox(height: HaizSpace.section),
              const SectionLabel('时间与课程', trailing: '按本机课表显示'),
              const SizedBox(height: HaizSpace.group),
              PocketCard(
                onTap: () => onNavigate(1),
                padding: const EdgeInsets.fromLTRB(16, 16, 12, 16),
                child: Row(
                  children: [
                    Container(
                      height: 44,
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
                          Text(
                            current == null ? '今天没有后续课程' : current.name,
                            style: HaizType.section(p),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            current == null
                                ? '可以专心处理自己的学习任务'
                                : '${minutesText(current.startMinute)}–${minutesText(current.endMinute)} · ${current.location}',
                            style: HaizType.secondary(p)
                                .copyWith(fontFeatures: HaizType.tabular),
                          ),
                          if (current?.example == true)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                '演示课表 · 可自行修改',
                                style: HaizType.meta(p),
                              ),
                            ),
                        ],
                      ),
                    ),
                    Icon(
                      Icons.chevron_right_rounded,
                      color: p.muted,
                      size: 20,
                      semanticLabel: '打开课表',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text('本地学习数据 · 未连接学校教务系统', style: HaizType.meta(p)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _taskRow(
    BuildContext context,
    PocketPalette p,
    TaskItem task,
    DateTime now,
  ) {
    final finishing = _finishingTasks.contains(task.id);
    final done = task.completed || finishing;
    return AnimatedOpacity(
      opacity: finishing ? 0.16 : 1,
      duration: HaizMotion.of(context, HaizMotion.enter),
      curve: HaizMotion.ease,
      child: AnimatedSlide(
        offset: finishing ? const Offset(0.04, 0) : Offset.zero,
        duration: HaizMotion.of(context, HaizMotion.enter),
        curve: HaizMotion.ease,
        child: PocketCard(
          padding: const EdgeInsets.fromLTRB(16, 8, 4, 8),
          child: Row(
            children: [
              Expanded(
                child: InkWell(
                  onTap: () => _editTask(context, task),
                  borderRadius: BorderRadius.circular(HaizRadius.inner),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          task.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: HaizType.itemTitle(p).copyWith(
                            color: done ? p.muted : p.foreground,
                            decoration: done
                                ? TextDecoration.lineThrough
                                : null,
                            decorationColor: p.muted,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${task.subject} · ${taskDueText(task, now)}',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: HaizType.meta(p),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              PopupMenuButton<String>(
                tooltip: '任务操作',
                padding: EdgeInsets.zero,
                icon: Icon(Icons.more_horiz_rounded, color: p.muted, size: 20),
                onSelected: (choice) {
                  if (choice == 'edit') _editTask(context, task);
                  if (choice == 'focus') {
                    store.chooseFocusTask(task.id);
                    onNavigate(3);
                  }
                  if (choice == 'source') _showSource(context, task);
                  if (choice == 'delete') _deleteTask(context, task);
                },
                itemBuilder: (_) => [
                  const PopupMenuItem(value: 'edit', child: Text('编辑任务与日期')),
                  const PopupMenuItem(value: 'focus', child: Text('接着学习')),
                  if (task.originalNotice.isNotEmpty)
                    const PopupMenuItem(value: 'source', child: Text('查看通知原文')),
                  const PopupMenuItem(value: 'delete', child: Text('删除任务')),
                ],
              ),
              IconButton(
                key: Key('task-check-${task.id}'),
                tooltip: task.completed ? '标记为未完成' : '标记完成',
                onPressed: finishing ? null : () => _checkOff(task),
                icon: AnimatedSwitcher(
                  duration: HaizMotion.of(context, HaizMotion.fast),
                  child: Icon(
                    done
                        ? Icons.check_circle_rounded
                        : Icons.radio_button_unchecked_rounded,
                    key: ValueKey(done),
                    color: done ? p.accent : p.muted,
                    size: 24,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
