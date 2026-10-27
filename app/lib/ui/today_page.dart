import 'package:flutter/material.dart';

import '../core/pocket_store.dart';
import '../domain/pocket_models.dart';
import 'kit.dart';

class TodayPage extends StatelessWidget {
  final PocketStore store;
  final ValueChanged<int> onNavigate;
  const TodayPage({super.key, required this.store, required this.onNavigate});

  Future<void> _addTask(BuildContext context) async {
    final title = TextEditingController();
    String subject = '数学';
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: PocketSkin.of(context).colors.card,
      builder: (sheet) => StatefulBuilder(
        builder: (context, setLocal) => Padding(
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
                controller: title,
                autofocus: true,
                textInputAction: TextInputAction.done,
                decoration: const InputDecoration(
                  hintText: '例如：复习数列第 2 节',
                  border: OutlineInputBorder(),
                ),
                onSubmitted: (_) {
                  if (title.text.trim().isNotEmpty) {
                    store.addTask(title.text, subject);
                    Navigator.of(context).pop();
                  }
                },
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 7,
                children: [
                  for (final option in ['数学', '语文', '英语', '物理', '化学', '其他'])
                    ChoiceChip(
                      label: Text(option),
                      selected: subject == option,
                      onSelected: (_) => setLocal(() => subject = option),
                    ),
                ],
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {
                    if (title.text.trim().isNotEmpty) {
                      store.addTask(title.text, subject);
                      Navigator.pop(context);
                    }
                  },
                  child: const Text('添加到今天'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    title.dispose();
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
              Row(
                children: [
                  const Eyebrow('HAIZ / V1'),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: () => onNavigate(2),
                    icon: const Icon(Icons.inbox_outlined, size: 18),
                    label: const Text('导入通知'),
                  ),
                ],
              ),
              const SizedBox(height: 23),
              const PageTitle(title: '把今天过好。', subtitle: '让每一段学习，都有清晰的下一步。'),
              const SizedBox(height: 25),
              Container(
                padding: const EdgeInsets.all(25),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(27),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: p.dark
                        ? [const Color(0xFF2C625C), const Color(0xFF173D3C)]
                        : [const Color(0xFF1D6757), const Color(0xFF3A927A)],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: p.accent.withValues(alpha: .14),
                      blurRadius: 28,
                      offset: const Offset(0, 15),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'STUDY RELAY',
                      style: TextStyle(
                        color: Color(0xFFBCE4D7),
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 2.3,
                      ),
                    ),
                    const SizedBox(height: 18),
                    Text(
                      store.remainingCount == 0
                          ? '今天已经整理妥当。'
                          : '还有 ${store.remainingCount} 件事，\n可以从一件开始。',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 27,
                        fontWeight: FontWeight.w600,
                        height: 1.35,
                        letterSpacing: -.6,
                      ),
                    ),
                    const SizedBox(height: 19),
                    Row(
                      children: [
                        const Icon(
                          Icons.bookmark_outline,
                          color: Color(0xFFD7EDE5),
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '继续学习 · 今天已专注 ${store.todayFocusMinutes} 分钟',
                            style: const TextStyle(
                              color: Color(0xFFE1EFE8),
                              fontSize: 12.5,
                            ),
                          ),
                        ),
                        IconButton.filledTonal(
                          onPressed: () => onNavigate(3),
                          style: IconButton.styleFrom(
                            backgroundColor: Colors.white,
                          ),
                          icon: const Icon(
                            Icons.arrow_forward_rounded,
                            color: Color(0xFF236953),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
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
