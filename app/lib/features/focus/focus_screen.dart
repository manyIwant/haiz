import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../core/pocket_store.dart';
import '../../design/components.dart';
import '../../design/motion_text.dart';
import '../../design/theme.dart';
import '../../design/tokens.dart';
import '../../domain/planning.dart';

String clockText(int seconds) {
  final s = seconds.clamp(0, 99 * 3600);
  final h = s ~/ 3600, m = (s % 3600) ~/ 60, sec = s % 60;
  String two(int v) => v.toString().padLeft(2, '0');
  return h > 0 ? '$h:${two(m)}:${two(sec)}' : '${two(m)}:${two(sec)}';
}

/// Rises from the focus bar / bottom edge, so it reads as the same object
/// expanding rather than a new place.
Route<void> focusRoute(PocketStore store) => PageRouteBuilder<void>(
  transitionDuration: Motion.slow,
  reverseTransitionDuration: Motion.base,
  pageBuilder: (context, animation, secondary) => FocusScreen(store: store),
  transitionsBuilder: (context, animation, secondary, child) {
    if (HaizTheme.of(context).reduceMotion) return child;
    // Rises from the bottom chrome; on close it sinks back towards the
    // focus capsule while the title and clock fly into it.
    final curved = CurvedAnimation(parent: animation, curve: Motion.enter, reverseCurve: Motion.exit);
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween(begin: const Offset(0, .14), end: Offset.zero).animate(curved),
        child: ScaleTransition(
          alignment: Alignment.bottomCenter,
          scale: Tween(begin: 0.94, end: 1.0).animate(curved),
          child: child,
        ),
      ),
    );
  },
);

class FocusScreen extends StatelessWidget {
  const FocusScreen({super.key, required this.store});
  final PocketStore store;

  static const presets = [15, 25, 40, 45, 60];

  String get _platformNote {
    if (kIsWeb) {
      return '计时以开始时间为准：切到其他标签页或锁屏后回来会自动校正。网页版不会在结束时发出提醒。';
    }
    return '计时以开始时间为准：切到后台或关闭 HAIZ 后回来会自动校正并补记。当前版本不发送到点通知。';
  }

  Future<void> _chooseTask(BuildContext context) async {
    final now = DateTime.now();
    final open = store.tasks.where((t) => !t.completed).toList();
    final grouped = groupByDue(open, now).expand((g) => g.$2).toList();
    final c = context.c;
    final picked = await showHaizSheet<String>(
      context,
      builder: (sheet) => ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(sheet).height * .7),
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.only(bottom: 16),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(Space.gutter, 0, Space.gutter, 8),
              child: Text('关联一项任务', style: TypeScale.headline(c.ink)),
            ),
            Pressable(
              onTap: () => Navigator.pop(sheet, ''),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: Space.gutter, vertical: 13),
                child: Text('不关联任务（自主学习）', style: TypeScale.callout(c.ink2)),
              ),
            ),
            for (final t in grouped)
              Pressable(
                onTap: () => Navigator.pop(sheet, t.id),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: Space.gutter, vertical: 11),
                  child: Row(children: [
                    SubjectMark(t.subject, showLabel: false),
                    const SizedBox(width: 10),
                    Expanded(child: Text(t.title, style: TypeScale.callout(c.ink), maxLines: 2)),
                    Text(dueLabel(t, now), style: TypeScale.caption(c.ink3)),
                  ]),
                ),
              ),
          ],
        ),
      ),
    );
    if (picked == null) return;
    store.chooseFocusTask(picked.isEmpty ? null : picked);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    // Its own messenger: toasts raised on the pages underneath (an undo in
    // 待办) stay there instead of covering the timer.
    return ScaffoldMessenger(child: Scaffold(
      backgroundColor: c.canvas,
      body: SafeArea(
        child: ListenableBuilder(
          listenable: store,
          builder: (context, _) {
            final session = store.focusSession;
            final idle = session == null;
            final running = store.focusRunning;
            final task = idle ? store.activeTask : store.taskById(session.taskId);
            final label = idle ? (task?.title ?? '自主学习') : (task?.title ?? session.label);
            final now = DateTime.now();
            final todayLogs = store.focusLogs.where((l) => dayOf(l.at) == dayOf(now)).toList();
            return Column(children: [
              SizedBox(
                height: 52,
                child: Row(children: [
                  const SizedBox(width: 6),
                  IconButton(
                    key: const Key('focus-close'),
                    tooltip: '收起',
                    icon: Icon(Icons.keyboard_arrow_down_rounded, size: 28, color: c.ink),
                    onPressed: () => Navigator.of(context).maybePop(),
                  ),
                  Expanded(child: Text('专注', textAlign: TextAlign.center, style: TypeScale.headline(c.ink).copyWith(fontSize: 16))),
                  const SizedBox(width: 54),
                ]),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.symmetric(horizontal: Space.gutter),
                  children: [
                    if (store.storageError != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(store.storageError!, style: TypeScale.footnote(c.late)),
                      ),
                    Pressable(
                      onTap: idle ? () => _chooseTask(context) : null,
                      radius: Radii.control,
                      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 2),
                      child: Row(children: [
                        if (task != null) ...[SubjectMark(task.subject, showLabel: false), const SizedBox(width: 8)],
                        Expanded(
                          // Shared with the task row it came from, and with
                          // the focus capsule it collapses into.
                          child: HeroText(
                            tag: idle && task != null ? 'task-title-${task.id}' : 'focus-title',
                            text: label,
                            maxLines: 2,
                            style: TypeScale.headline(c.ink),
                          ),
                        ),
                        if (idle) Text(task == null ? '选择任务' : '更换', style: TypeScale.footnote(c.ink2)),
                        if (idle) Icon(Icons.chevron_right_rounded, color: c.ink3, size: 20),
                      ]),
                    ),
                    const SizedBox(height: 28),
                    ValueListenableBuilder<int>(
                      valueListenable: store.focusClock,
                      builder: (context, _, _) {
                        final remaining = store.focusRemaining;
                        final total = session?.targetSeconds ?? store.focusTargetMinutes * 60;
                        return Column(children: [
                          Semantics(
                            liveRegion: false,
                            label: '剩余 ${remaining ~/ 60} 分 ${remaining % 60} 秒',
                            excludeSemantics: true,
                            child: Center(
                              child: HeroText(
                                key: const Key('focus-clock'),
                                tag: 'focus-clock',
                                enabled: !idle,
                                text: clockText(remaining),
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 76, height: 1, fontWeight: FontWeight.w300,
                                  letterSpacing: -2, color: store.focusPaused ? c.ink2 : c.ink,
                                  fontFeatures: TypeScale.tabular,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 22),
                          SizedBox(
                            height: 28,
                            width: double.infinity,
                            child: CustomPaint(
                              painter: _RulerPainter(
                                total: total,
                                elapsed: total - remaining,
                                ink: c.ink,
                                rule: c.ruleStrong,
                                needle: c.now,
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(_statusLine(session, remaining), textAlign: TextAlign.center,
                              style: TypeScale.footnote(c.ink2)),
                        ]);
                      },
                    ),
                    const SizedBox(height: 26),
                    if (idle) ...[
                      Wrap(alignment: WrapAlignment.center, spacing: 6, runSpacing: 6, children: [
                        for (final m in presets)
                          HaizChip(label: '$m 分钟', selected: store.focusTargetMinutes == m,
                              onTap: () => store.setFocusDuration(m)),
                      ]),
                      const SizedBox(height: 8),
                      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                        IconButton(tooltip: '减少 5 分钟', onPressed: store.focusTargetMinutes > 5
                            ? () => store.setFocusDuration(store.focusTargetMinutes - 5) : null,
                            icon: const Icon(Icons.remove_rounded)),
                        SizedBox(width: 80, child: Text('±5 分钟', textAlign: TextAlign.center,
                            style: TypeScale.footnote(c.ink3))),
                        IconButton(tooltip: '增加 5 分钟', onPressed: store.focusTargetMinutes < 180
                            ? () => store.setFocusDuration(store.focusTargetMinutes + 5) : null,
                            icon: const Icon(Icons.add_rounded)),
                      ]),
                      const SizedBox(height: 14),
                      HaizButton(
                        key: const Key('focus-start'),
                        label: '开始专注',
                        expand: true,
                        onPressed: store.writable ? () { haizHaptic(); store.startFocus(); } : null,
                      ),
                    ] else ...[
                      Row(children: [
                        Expanded(
                          child: HaizButton(
                            key: const Key('focus-toggle'),
                            label: running ? '暂停' : '继续',
                            kind: running ? HaizButtonKind.secondary : HaizButtonKind.primary,
                            expand: true,
                            onPressed: running ? store.pauseFocus : store.startFocus,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: HaizButton(
                            key: const Key('focus-finish'),
                            label: '结束并记录',
                            kind: running ? HaizButtonKind.primary : HaizButtonKind.secondary,
                            expand: true,
                            onPressed: () {
                              haizHaptic(true);
                              final minutes = (store.focusSession!.elapsedAt(store.now()) / 60).round();
                              store.finishFocus();
                              showToast(context, minutes > 0 ? '已记录 $minutes 分钟' : '不足 1 分钟，没有记录');
                            },
                          ),
                        ),
                      ]),
                      const SizedBox(height: 6),
                      Center(
                        child: LinkAction('放弃本次（不记录）', color: c.ink2, onTap: () async {
                          final yes = await showDialog<bool>(
                            context: context,
                            builder: (d) => AlertDialog(
                              title: const Text('放弃本次专注？'),
                              content: const Text('不会留下学习记录。'),
                              actions: [
                                TextButton(onPressed: () => Navigator.pop(d, false), child: const Text('继续专注')),
                                TextButton(onPressed: () => Navigator.pop(d, true),
                                    child: Text('放弃', style: TextStyle(color: c.late))),
                              ],
                            ),
                          );
                          if (yes == true) store.discardFocus();
                        }),
                      ),
                    ],
                    const SizedBox(height: 18),
                    Text(_platformNote, textAlign: TextAlign.center, style: TypeScale.caption(c.ink3)),
                    const SizedBox(height: 20),
                    const Hairline(),
                    SectionHeader('今天', count: null,
                        padding: const EdgeInsets.fromLTRB(0, 16, 0, 6),
                        trailing: Text(durationText(store.todayFocusMinutes), style: TypeScale.label(c.ink))),
                    if (todayLogs.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Text('今天还没有专注记录。', style: TypeScale.footnote(c.ink3)),
                      ),
                    for (final log in todayLogs.take(12))
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 7),
                        child: Row(children: [
                          SizedBox(width: 48, child: Text(clockOf(log.at),
                              style: TypeScale.footnote(c.ink3))),
                          Expanded(child: Text(log.label, style: TypeScale.callout(c.ink), maxLines: 1, overflow: TextOverflow.ellipsis)),
                          Text('${log.minutes} 分钟', style: TypeScale.footnote(c.ink2)),
                        ]),
                      ),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ]);
          },
        ),
      ),
    ));
  }

  String _statusLine(FocusSession? session, int remaining) {
    if (session == null) return '选好时长后开始';
    final start = session.startedAt;
    if (session.phase == FocusPhase.paused) {
      return '已暂停 · ${clockOf(start)} 开始';
    }
    final end = session.endsAt!;
    return '${clockOf(start)} 开始 · 预计 ${clockOf(end)} 结束';
  }
}

/// A ruler, like the one in a pencil case: minute ticks, the elapsed part
/// inked, a vermilion needle at "now".
class _RulerPainter extends CustomPainter {
  _RulerPainter({required this.total, required this.elapsed, required this.ink, required this.rule, required this.needle});
  final int total;
  final int elapsed;
  final Color ink;
  final Color rule;
  final Color needle;

  @override
  void paint(Canvas canvas, Size size) {
    final minutes = (total / 60).ceil().clamp(1, 180);
    final step = minutes > 90 ? 5 : (minutes > 45 ? 2 : 1);
    final progress = total == 0 ? 0.0 : (elapsed / total).clamp(0.0, 1.0);
    final w = size.width;
    final base = size.height - 2;
    final faint = Paint()..color = rule..strokeWidth = 1;
    final strong = Paint()..color = ink..strokeWidth = 1.2;
    for (var m = 0; m <= minutes; m += step) {
      final x = w * m / minutes;
      final major = m % (step * 5) == 0 || m == minutes;
      final h = major ? 12.0 : 6.0;
      canvas.drawLine(Offset(x, base), Offset(x, base - h), x <= w * progress ? strong : faint);
    }
    canvas.drawLine(Offset(0, base), Offset(w, base), faint);
    canvas.drawLine(Offset(0, base), Offset(w * progress, base), strong..strokeWidth = 1.6);
    final nx = w * progress;
    canvas.drawLine(Offset(nx, base + 1), Offset(nx, 2), Paint()..color = needle..strokeWidth = 2..strokeCap = StrokeCap.round);
  }

  @override
  bool shouldRepaint(_RulerPainter old) => old.elapsed != elapsed || old.total != total || old.ink != ink;
}
