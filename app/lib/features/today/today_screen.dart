import 'dart:async';

import 'package:flutter/material.dart';

import '../../app/nav.dart';
import '../../design/components.dart';
import '../../design/theme.dart';
import '../../design/tokens.dart';
import '../../domain/planning.dart';
import '../../domain/pocket_models.dart';
import '../inbox/inbox_screen.dart';
import '../sync/sync_banner.dart';
import '../tasks/task_row.dart';

/// 今天: where am I in the school day, what is due, what arrived.
/// The date is the title; nothing on this page is decoration.
class TodayScreen extends StatelessWidget {
  const TodayScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final scope = HaizScope.of(context);
    final store = scope.store;
    return MinuteClock(
      builder: (context, now) => ListenableBuilder(
        listenable: store,
        builder: (context, _) {
          final groups = todayGroups(store.tasks, now);
          final doneToday = store.tasks.where((t) {
            final at = store.metaFor(t.id).completedAt;
            return t.completed && at != null && dayOf(at) == dayOf(now);
          }).toList();
          return HaizPage(
            storageKey: 'today',
            title: '${now.month}月${now.day}日 ${weekdayName(now.weekday)}',
            subtitle: _Summary(groups: groups),
            actions: [
              BarAction(icon: Icons.search_rounded, label: '搜索（Ctrl/⌘ K）', onTap: scope.actions.openSearch),
              BarAction(
                icon: Icons.timer_outlined,
                label: '专注',
                onTap: () => scope.actions.openFocus(),
              ),
            ],
            slivers: [
              const SliverToBoxAdapter(child: SyncBanner()),
              if (store.focusNotice != null)
                SliverToBoxAdapter(
                  child: HaizBanner(
                    message: store.focusNotice!,
                    tone: BannerTone.ok,
                    icon: Icons.check_rounded,
                    actions: [LinkAction('知道了', onTap: store.clearFocusNotice)],
                  ),
                ),
              if (store.courses.isEmpty && store.tasks.isEmpty && store.notes.isEmpty)
                SliverToBoxAdapter(child: _FirstSteps(actions: scope.actions))
              else
                SliverToBoxAdapter(child: NowBlock(courses: store.courses, now: now)),
              const SliverToBoxAdapter(child: _InboxPrompt()),
              SliverToBoxAdapter(
                child: TaskGroupList(
                  store: store,
                  now: now,
                  groups: (open) => todayGroups(open, now),
                ),
              ),
              if (groups.isEmpty && !(store.courses.isEmpty && store.tasks.isEmpty && store.notes.isEmpty))
                SliverToBoxAdapter(
                  child: EmptyNote(
                    title: store.tasks.any((t) => !t.completed)
                        ? '今明两天没有到期的任务'
                        : '还没有待办',
                    body: store.tasks.any((t) => !t.completed)
                        ? '其余任务在「待办」里按日期排好。'
                        : '点右下角 + 记一项作业，或在「收件」里把班级通知转成任务。',
                    action: store.tasks.any((t) => !t.completed)
                        ? LinkAction('查看全部待办', onTap: () => scope.actions.goTab(HaizTab.tasks))
                        : null,
                  ),
                ),
              if (doneToday.isNotEmpty)
                SliverToBoxAdapter(child: _DoneToday(tasks: doneToday, now: now)),
              SliverToBoxAdapter(child: _ClassList(courses: store.courses, now: now)),
            ],
          );
        },
      ),
    );
  }
}

/// A new user's 今天: the three things that make this page useful, each one
/// tap away. Disappears as soon as any of them exists.
class _FirstSteps extends StatelessWidget {
  const _FirstSteps({required this.actions});
  final HaizActions actions;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    Widget step(int n, String title, String detail, VoidCallback onTap) => Pressable(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Space.gutter, 12, Space.gutter - 4, 12),
        child: Row(children: [
          Container(
            width: 24, height: 24, alignment: Alignment.center,
            decoration: BoxDecoration(border: Border.all(color: c.ruleStrong), shape: BoxShape.circle),
            child: Text('$n', style: TypeScale.caption(c.ink2).copyWith(fontWeight: FontWeight.w700)),
          ),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: TypeScale.callout(c.ink).copyWith(fontWeight: FontWeight.w600)),
            Text(detail, style: TypeScale.caption(c.ink3)),
          ])),
          Icon(Icons.chevron_right_rounded, size: 20, color: c.ink3),
        ]),
      ),
    );
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(Space.gutter, 14, Space.gutter, 4),
        child: Text('这一页会显示正在上的课、今明两天要交的作业和待确认的通知。先做这三件事：',
            style: TypeScale.footnote(c.ink2)),
      ),
      step(1, '录入课表', '按节次添加，同一节课可以一次加到多天', () => actions.goTab(HaizTab.schedule)),
      const Hairline(indent: 58),
      step(2, '记一项作业', '写上截止日期，到期前会出现在这里', () => actions.capture()),
      const Hairline(indent: 58),
      step(3, '把班级通知变成任务', '粘贴通知或导入截图，确认后加入待办', () => actions.goTab(HaizTab.inbox)),
    ]);
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.groups});
  final List<(DueBucket, List<TaskItem>)> groups;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    int count(DueBucket b) => groups.where((g) => g.$1 == b).fold(0, (s, g) => s + g.$2.length);
    final overdue = count(DueBucket.overdue), today = count(DueBucket.today);
    final parts = <InlineSpan>[];
    if (today > 0) parts.add(TextSpan(text: '今天到期 $today 项'));
    if (overdue > 0) {
      if (parts.isNotEmpty) parts.add(const TextSpan(text: '  ·  '));
      parts.add(TextSpan(text: '逾期 $overdue 项', style: TextStyle(color: c.late, fontWeight: FontWeight.w600)));
    }
    if (parts.isEmpty) return const SizedBox.shrink();
    return Text.rich(TextSpan(children: parts), style: TypeScale.footnote(c.ink2));
  }
}

/// Rebuilds its child at each minute boundary (not every second).
class MinuteClock extends StatefulWidget {
  const MinuteClock({super.key, required this.builder});
  final Widget Function(BuildContext, DateTime) builder;
  @override
  State<MinuteClock> createState() => _MinuteClockState();
}

class _MinuteClockState extends State<MinuteClock> {
  Timer? _timer;
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    _schedule();
  }

  void _schedule() {
    final now = DateTime.now();
    final wait = Duration(seconds: 60 - now.second, milliseconds: -now.millisecond + 20);
    _timer = Timer(wait, () {
      if (!mounted) return;
      setState(() => _now = DateTime.now());
      _schedule();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final current = DateTime.now();
    if (current.minute != _now.minute || current.day != _now.day) _now = current;
    return widget.builder(context, _now);
  }
}

/// Current or next class, as one typographic block marked by a red rule.
class NowBlock extends StatelessWidget {
  const NowBlock({super.key, required this.courses, required this.now});
  final List<CourseSlot> courses;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final scope = HaizScope.maybeOf(context);
    final status = dayStatus(courses, now);
    final minute = now.hour * 60 + now.minute;

    Widget block({required String kicker, required String title, required String detail,
        String? trailing, double? progress, String? after, bool live = false}) {
      return Pressable(
        onTap: scope == null ? null : () => scope.actions.goTab(HaizTab.schedule),
        semanticLabel: '$kicker $title $detail，打开课表',
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Space.gutter, 14, Space.gutter, 14),
          child: IntrinsicHeight(
            child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Container(width: 2, decoration: BoxDecoration(
                  color: live ? c.now : c.ruleStrong, borderRadius: BorderRadius.circular(1))),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Text(kicker, style: TypeScale.label(live ? c.now : c.ink2)),
                    const Spacer(),
                    if (trailing != null) Text(trailing, style: TypeScale.footnote(c.ink2)),
                  ]),
                  const SizedBox(height: 2),
                  Text(title, style: TypeScale.title(c.ink)),
                  const SizedBox(height: 2),
                  Text(detail, style: TypeScale.footnote(c.ink2)),
                  if (progress != null) ...[
                    const SizedBox(height: 10),
                    Semantics(
                      label: '已上 ${(progress.clamp(0, 1) * 100).round()}%',
                      child: SizedBox(
                        height: 2,
                        width: double.infinity,
                        child: DecoratedBox(
                          decoration: BoxDecoration(color: c.rule, borderRadius: BorderRadius.circular(1)),
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: FractionallySizedBox(
                              widthFactor: progress.clamp(0, 1).toDouble(),
                              heightFactor: 1,
                              child: DecoratedBox(decoration: BoxDecoration(
                                  color: c.now, borderRadius: BorderRadius.circular(1))),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                  if (after != null) ...[
                    const SizedBox(height: 8),
                    Text(after, style: TypeScale.footnote(c.ink2)),
                  ],
                ]),
              ),
            ]),
          ),
        ),
      );
    }

    if (courses.isEmpty) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(Space.gutter, 12, Space.gutter, 0),
        child: Row(children: [
          Expanded(child: Text('还没有课表。录入后，这里会显示正在上和下一节课。',
              style: TypeScale.footnote(c.ink2))),
          LinkAction('录入课表', onTap: scope == null ? null : () => scope.actions.goTab(HaizTab.schedule)),
        ]),
      );
    }
    final current = status.current;
    if (current != null) {
      final left = current.endMinute - minute;
      final next = status.next;
      return block(
        live: true,
        kicker: '第 ${status.currentIndex} 节 · 正在上课',
        title: current.name,
        trailing: '${minutesText(current.startMinute)}–${minutesText(current.endMinute)}',
        detail: [if (current.location.isNotEmpty) current.location, '还剩 ${durationText(left)}'].join(' · '),
        progress: (minute - current.startMinute) / (current.endMinute - current.startMinute),
        after: next == null ? '这是今天最后一节课' :
            '下一节  ${next.name}  ${minutesText(next.startMinute)}${next.location.isEmpty ? '' : ' · ${next.location}'}',
      );
    }
    final next = status.next;
    if (next != null) {
      final wait = next.startMinute - minute;
      return block(
        live: wait <= 10,
        kicker: '下一节 · 第 ${status.nextIndex} 节',
        title: next.name,
        trailing: '${minutesText(next.startMinute)}–${minutesText(next.endMinute)}',
        detail: [if (next.location.isNotEmpty) next.location, '${durationText(wait)}后开始'].join(' · '),
      );
    }
    final first = status.tomorrowFirst;
    final when = status.tomorrowWeekday == null
        ? ''
        : (status.tomorrowWeekday == now.weekday % 7 + 1 ? '明天' : weekdayName(status.tomorrowWeekday!));
    return block(
      kicker: status.hasCourses ? '今天的课已结束' : '今天没有课',
      title: first == null ? '—' : '$when第一节 ${first.name}',
      detail: first == null ? '' :
          [minutesText(first.startMinute), if (first.location.isNotEmpty) first.location].join(' · '),
    );
  }
}

class _InboxPrompt extends StatelessWidget {
  const _InboxPrompt();
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final scope = HaizScope.of(context);
    return ValueListenableBuilder<int>(
      valueListenable: InboxScreen.pendingBadge,
      builder: (context, count, _) {
        if (count == 0) return const SizedBox.shrink();
        return Pressable(
          onTap: () => scope.actions.goTab(HaizTab.inbox),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(Space.gutter, 12, Space.gutter, 12),
            child: Row(children: [
              Icon(Icons.move_to_inbox_outlined, size: 20, color: c.amber),
              const SizedBox(width: 10),
              Expanded(child: Text('$count 条消息等你确认', style: TypeScale.callout(c.ink))),
              Text('去收件', style: TypeScale.footnote(c.ink2)),
              Icon(Icons.chevron_right_rounded, size: 20, color: c.ink3),
            ]),
          ),
        );
      },
    );
  }
}

class _DoneToday extends StatefulWidget {
  const _DoneToday({required this.tasks, required this.now});
  final List<TaskItem> tasks;
  final DateTime now;
  @override
  State<_DoneToday> createState() => _DoneTodayState();
}

class _DoneTodayState extends State<_DoneToday> {
  bool _open = false;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final scope = HaizScope.of(context);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Pressable(
        onTap: () => setState(() => _open = !_open),
        semanticLabel: _open ? '收起今天已完成' : '展开今天已完成',
        child: SectionHeader('今天已完成', count: widget.tasks.length,
            trailing: AnimatedRotation(
              turns: _open ? .25 : 0,
              duration: context.haiz.motion(Motion.fast),
              child: Icon(Icons.chevron_right_rounded, size: 18, color: c.ink3),
            )),
      ),
      AnimatedSize(
        duration: context.haiz.motion(Motion.base),
        curve: Motion.enter,
        alignment: Alignment.topCenter,
        child: !_open ? const SizedBox(width: double.infinity) : Column(children: [
          for (final t in widget.tasks)
            TaskRow(
              task: t,
              now: widget.now,
              showDue: false,
              onToggle: () => scope.store.setTaskCompleted(t.id, false),
              onOpen: () => scope.actions.openTask(t.id),
            ),
        ]),
      ),
    ]);
  }
}

/// The rest of today's timetable in one compact column.
class _ClassList extends StatelessWidget {
  const _ClassList({required this.courses, required this.now});
  final List<CourseSlot> courses;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final status = dayStatus(courses, now);
    // After the last class, the useful list is the next school day's
    // (what to pack tonight), not today's finished one.
    final ahead = status.dayOver || !status.hasCourses;
    final weekday = ahead ? status.tomorrowWeekday : now.weekday;
    if (weekday == null) return const SizedBox.shrink();
    final today = coursesForDay(courses, weekday);
    if (today.isEmpty) return const SizedBox.shrink();
    final minute = ahead ? -1 : now.hour * 60 + now.minute;
    final title = !ahead ? '今日课程'
        : weekday == now.weekday % 7 + 1 ? '明天的课程' : '${weekdayName(weekday)}的课程';
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionHeader(title, count: today.length),
      for (final (i, course) in today.indexed)
        Builder(builder: (context) {
          final past = minute >= 0 && course.endMinute <= minute;
          final live = minute >= 0 && course.startMinute <= minute && minute < course.endMinute;
          final ink = past ? c.ink3 : c.ink;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: Space.gutter, vertical: 7),
            child: Row(children: [
              SizedBox(width: 22, child: Text('${i + 1}', style: TypeScale.footnote(live ? c.now : c.ink3)
                  .copyWith(fontWeight: FontWeight.w600))),
              SizedBox(width: 46, child: Text(minutesText(course.startMinute), style: TypeScale.footnote(past ? c.ink3 : c.ink2))),
              Container(width: 3, height: 16, margin: const EdgeInsets.only(right: 10),
                  decoration: BoxDecoration(
                    color: past ? c.rule : subjectColor(course.name, dark: c.dark),
                    borderRadius: BorderRadius.circular(1.5))),
              Expanded(child: Text(course.name, style: TypeScale.callout(ink).copyWith(
                  fontWeight: live ? FontWeight.w700 : FontWeight.w500))),
              if (course.location.isNotEmpty)
                Text(course.location, style: TypeScale.caption(past ? c.ink3 : c.ink2)),
              if (live) ...[
                const SizedBox(width: 8),
                Container(width: 6, height: 6, decoration: BoxDecoration(color: c.now, shape: BoxShape.circle)),
              ],
            ]),
          );
        }),
    ]);
  }
}
