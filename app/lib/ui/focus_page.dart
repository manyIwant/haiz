import 'package:flutter/material.dart';

import '../core/pocket_store.dart';
import 'editorial.dart';
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
    final note = store.activeTask == null
        ? ''
        : store.noteFor(store.activeTask!.id).trim();
    return SingleChildScrollView(
      key: const PageStorageKey('focus_scroll'),
      padding: HaizSpace.page,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 680),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const EditorialMasthead(number: '04', chapter: '专注'),
              const SizedBox(height: 24),
              const PageTitle(title: '一次只做一件事', subtitle: '不用追求打卡，只需回到手边的事'),
              const SizedBox(height: HaizSpace.section),
              PocketCard(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
                child: Column(
                  children: [
                    Text('当前任务', style: HaizType.meta(p)),
                    const SizedBox(height: 4),
                    Text(
                      store.activeTask?.title ?? '自由专注 · 未关联任务',
                      textAlign: TextAlign.center,
                      style: HaizType.itemTitle(p),
                    ),
                    if (store.activeTask != null) ...[
                      const SizedBox(height: 8),
                      Wrap(
                        alignment: WrapAlignment.center,
                        spacing: 4,
                        children: [
                          TextButton.icon(
                            onPressed: () => _editNote(context),
                            icon: const Icon(Icons.edit_note_rounded, size: 18),
                            label: Text(note.isEmpty ? '记录学习思路' : '继续编辑学习笔记'),
                          ),
                          if (!store.focusRunning)
                            TextButton.icon(
                              style: TextButton.styleFrom(
                                foregroundColor: p.secondary,
                              ),
                              onPressed: () => store.chooseFocusTask(null),
                              icon: const Icon(Icons.close_rounded, size: 18),
                              label: const Text('清除任务关联'),
                            ),
                        ],
                      ),
                      if (note.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(8, 4, 8, 0),
                          child: Text(
                            note,
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.center,
                            style: HaizType.secondary(p),
                          ),
                        ),
                    ],
                    const SizedBox(height: 24),
                    SizedBox(
                      width: 216,
                      height: 216,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          SizedBox.expand(
                            child: CircularProgressIndicator(
                              value: 1,
                              strokeWidth: 6,
                              valueColor: AlwaysStoppedAnimation(p.raised),
                            ),
                          ),
                          SizedBox.expand(
                            child: TweenAnimationBuilder<double>(
                              tween: Tween(begin: progress, end: progress),
                              duration: HaizMotion.of(
                                context,
                                HaizMotion.enter,
                              ),
                              curve: HaizMotion.ease,
                              builder: (context, v, _) =>
                                  CircularProgressIndicator(
                                    value: v,
                                    strokeWidth: 6,
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
                                  fontWeight: FontWeight.w500,
                                  letterSpacing: -1,
                                  height: 1.1,
                                  fontSize: 48,
                                  fontFeatures: HaizType.tabular,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                store.focusRunning
                                    ? '正在专注'
                                    : progress > 0
                                    ? '已暂停'
                                    : '准备就绪',
                                style: HaizType.meta(p),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    if (!store.focusRunning) ...[
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
                      const SizedBox(height: 16),
                    ],
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
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: () => store.finishFocus(),
                        child: const Text('结束并记录本次学习'),
                      ),
                    ],
                    const SizedBox(height: 12),
                    Text('离开当前页面，计时仍会继续', style: HaizType.meta(p)),
                  ],
                ),
              ),
              const SizedBox(height: HaizSpace.section),
              const SectionLabel('我的学习记录'),
              const SizedBox(height: HaizSpace.group),
              Row(
                children: [
                  Expanded(
                    child: _Stat(
                      label: '今天',
                      value: '${store.todayFocusMinutes}',
                      unit: '分钟',
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _Stat(
                      label: '累计',
                      value: '${store.focusLogs.length}',
                      unit: '次记录',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (store.focusLogs.isEmpty)
                Text('还没有记录。完成一次专注，就会在这里留下痕迹。', style: HaizType.secondary(p))
              else
                PocketCard(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    children: [
                      for (final (i, session)
                          in store.focusLogs.take(8).indexed)
                        Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            border: i == 0
                                ? null
                                : Border(top: BorderSide(color: p.border)),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      session.label,
                                      style: HaizType.itemTitle(p),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${session.at.month}月${session.at.day}日 · ${session.at.hour.toString().padLeft(2, '0')}:${session.at.minute.toString().padLeft(2, '0')}',
                                      style: HaizType.meta(p),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 12),
                              Text(
                                '${session.minutes} 分钟',
                                style: HaizType.body(p)
                                    .copyWith(fontFeatures: HaizType.tabular),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Stat card: a label, a figure and its unit. Nothing else.
class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, required this.unit});

  final String label;
  final String value;
  final String unit;

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    return PocketCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: HaizType.meta(p)),
          const SizedBox(height: 8),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(text: value, style: HaizType.figure(p)),
                TextSpan(text: '  $unit', style: HaizType.meta(p)),
              ],
            ),
          ),
        ],
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
