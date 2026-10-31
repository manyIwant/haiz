import 'package:flutter/material.dart';

import '../core/pocket_store.dart';
import 'kit.dart';

class FocusPage extends StatelessWidget {
  final PocketStore store;
  const FocusPage({super.key, required this.store});

  Future<void> _editNote(BuildContext context) async {
    final task = store.activeTask;
    final generation = store.generation;
    if (task == null) return;
    final saved = await showDialog<String>(
      context: context,
      builder: (_) => _StudyRelayDialog(initialText: store.noteFor(task.id)),
    );
    if (saved != null && store.generation == generation) {
      store.setTaskNote(task.id, saved);
    } else if (saved != null && context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('已切换账号，笔记未写入任何账号。')));
    }
  }

  String get timerText {
    final seconds = store.focusRemaining;
    final minutes = seconds ~/ 60;
    return '${minutes.toString().padLeft(2, '0')}:${(seconds % 60).toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    final total = store.focusTargetMinutes * 60;
    final progress = total <= 0
        ? 0.0
        : (1 - store.focusRemaining / total).clamp(0.0, 1.0);
    return SingleChildScrollView(
      key: const PageStorageKey('focus_scroll'),
      padding: const EdgeInsets.fromLTRB(23, 31, 23, 130),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 680),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Eyebrow('FOCUS / ONE THING AT A TIME'),
              const SizedBox(height: 23),
              const PageTitle(
                title: '留一点时间，给自己。',
                subtitle: '不用追求打卡，只需回到手边的事。',
              ),
              const SizedBox(height: 30),
              PocketCard(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 29,
                ),
                child: Column(
                  children: [
                    const Eyebrow('CURRENT SESSION'),
                    const SizedBox(height: 11),
                    Text(
                      store.activeTask?.title ?? '自由专注 · 未选择关联任务',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: p.foreground,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 14),
                    if (store.activeTask != null) ...[
                      TextButton.icon(
                        onPressed: () => _editNote(context),
                        icon: const Icon(Icons.edit_note_rounded, size: 18),
                        label: Text(
                          store.noteFor(store.activeTask!.id).trim().isEmpty
                              ? '记录学习思路'
                              : '继续编辑学习笔记',
                        ),
                      ),
                      if (store.noteFor(store.activeTask!.id).trim().isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(10, 0, 10, 14),
                          child: Text(
                            store.noteFor(store.activeTask!.id),
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: p.secondary,
                              fontSize: 12,
                              height: 1.55,
                            ),
                          ),
                        ),
                    ],
                    if (!store.focusRunning && store.activeTask != null)
                      TextButton.icon(
                        onPressed: () => store.chooseFocusTask(null),
                        icon: const Icon(Icons.close_rounded, size: 16),
                        label: const Text('清除任务关联'),
                      ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: 218,
                      height: 218,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          SizedBox.expand(
                            child: CircularProgressIndicator(
                              value: 1,
                              strokeWidth: 8,
                              backgroundColor: p.border.withValues(alpha: .55),
                              valueColor: AlwaysStoppedAnimation(
                                p.border.withValues(alpha: .55),
                              ),
                            ),
                          ),
                          SizedBox.expand(
                            child: TweenAnimationBuilder<double>(
                              tween: Tween(begin: progress, end: progress),
                              duration: Duration(
                                milliseconds:
                                    PocketSkin.of(context).reducedMotion
                                    ? 0
                                    : 350,
                              ),
                              builder: (context, v, _) =>
                                  CircularProgressIndicator(
                                    value: v,
                                    strokeWidth: 9,
                                    strokeCap: StrokeCap.round,
                                    backgroundColor: Colors.transparent,
                                    valueColor: AlwaysStoppedAnimation(
                                      p.accent,
                                    ),
                                  ),
                            ),
                          ),
                          Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                timerText,
                                style: TextStyle(
                                  color: p.foreground,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: -2,
                                  fontSize: 48,
                                  fontFeatures: const [
                                    FontFeature.tabularFigures(),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                store.focusRunning
                                    ? '正在专注'
                                    : progress > 0
                                    ? '已暂停'
                                    : '准备就绪',
                                style: TextStyle(
                                  color: p.secondary,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 27),
                    if (!store.focusRunning)
                      Wrap(
                        spacing: 8,
                        children: [
                          for (final minute in [15, 25, 45])
                            ChoiceChip(
                              label: Text('$minute 分钟'),
                              selected: minute == store.focusTargetMinutes,
                              onSelected: (_) => store.setFocusDuration(minute),
                            ),
                        ],
                      ),
                    const SizedBox(height: 15),
                    PocketPill(
                      label: store.focusRunning
                          ? '暂停'
                          : progress > 0
                          ? '继续专注'
                          : '开始专注',
                      icon: store.focusRunning
                          ? Icons.pause_rounded
                          : Icons.play_arrow_rounded,
                      onTap: store.focusRunning
                          ? store.pauseFocus
                          : store.startFocus,
                    ),
                    if (progress > 0) ...[
                      const SizedBox(height: 9),
                      TextButton(
                        onPressed: () => store.finishFocus(),
                        child: const Text('结束并记录本次学习'),
                      ),
                    ],
                    const SizedBox(height: 13),
                    Text(
                      '离开当前页面，计时仍会继续。',
                      style: TextStyle(color: p.secondary, fontSize: 11),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 29),
              const SectionLabel('我的学习记录'),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: PocketCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Eyebrow('TODAY'),
                          const SizedBox(height: 14),
                          Text(
                            '${store.todayFocusMinutes}',
                            style: TextStyle(
                              color: p.accent,
                              fontSize: 35,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            '分钟',
                            style: TextStyle(color: p.secondary, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 11),
                  Expanded(
                    child: PocketCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Eyebrow('SESSIONS'),
                          const SizedBox(height: 14),
                          Text(
                            '${store.focusLogs.length}',
                            style: TextStyle(
                              color: p.accent,
                              fontSize: 35,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            '次记录',
                            style: TextStyle(color: p.secondary, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              if (store.focusLogs.isEmpty)
                Text(
                  '还没有记录。完成一次专注，就会在这里留下痕迹。',
                  style: TextStyle(color: p.secondary, fontSize: 12),
                )
              else
                for (final session in store.focusLogs.take(8))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 9),
                    child: PocketCard(
                      child: Row(
                        children: [
                          Icon(
                            Icons.auto_stories_outlined,
                            color: p.accent,
                            size: 21,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  session.label,
                                  style: TextStyle(
                                    color: p.foreground,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${session.at.month}月${session.at.day}日 · ${session.at.hour.toString().padLeft(2, '0')}:${session.at.minute.toString().padLeft(2, '0')}',
                                  style: TextStyle(
                                    color: p.secondary,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '${session.minutes} min',
                            style: TextStyle(
                              color: p.foreground,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
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

/// The dialog owns its controller until its exit animation has unmounted.
/// Disposing immediately after showDialog completes leaves the TextField using
/// a disposed controller during the route's reverse transition.
class _StudyRelayDialog extends StatefulWidget {
  const _StudyRelayDialog({required this.initialText});
  final String initialText;

  @override
  State<_StudyRelayDialog> createState() => _StudyRelayDialogState();
}

class _StudyRelayDialogState extends State<_StudyRelayDialog> {
  late final TextEditingController _note;

  @override
  void initState() {
    super.initState();
    _note = TextEditingController(text: widget.initialText);
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('学习接力 · 保存思路'),
    content: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 480),
      child: TextField(
        controller: _note,
        autofocus: true,
        maxLines: 8,
        minLines: 5,
        maxLength: 5000,
        decoration: const InputDecoration(
          hintText: '上次解到哪里？下一步准备做什么？\n把未完成的思路留下。',
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('取消'),
      ),
      FilledButton(
        onPressed: () => Navigator.pop(context, _note.text),
        child: const Text('保存到本机'),
      ),
    ],
  );
}
