import 'package:flutter/material.dart';

import '../../app/nav.dart';
import '../../core/pocket_store.dart';
import '../../design/components.dart';
import '../../design/theme.dart';
import '../../design/tokens.dart';
import '../../domain/planning.dart';
import '../sync/sync_banner.dart';
import 'note_editor.dart';
import 'task_row.dart';

/// 待办: every open task by date, plus memos as their own kind of record.
class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key});
  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  bool _memos = false;
  String? _subject;
  bool _showDone = false;
  bool _showTrash = false;

  @override
  Widget build(BuildContext context) {
    final scope = HaizScope.of(context);
    final store = scope.store;
    final c = context.c;
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        final now = DateTime.now();
        final open = store.tasks.where((t) => !t.completed);
        final subjects = <String>{for (final t in open) t.subject}.toList()..sort();
        if (_subject != null && !subjects.contains(_subject)) _subject = null;
        final done = store.tasks.where((t) => t.completed).toList()
          ..sort((a, b) {
            final x = store.metaFor(a.id).completedAt, y = store.metaFor(b.id).completedAt;
            if (x == null && y == null) return 0;
            if (x == null) return 1;
            if (y == null) return -1;
            return y.compareTo(x);
          });
        return HaizPage(
          storageKey: 'tasks',
          title: '待办',
          subtitle: Padding(
            padding: const EdgeInsets.only(top: 8),
            child: SizedBox(
              width: 200,
              child: Segmented<bool>(
                key: const Key('tasks-kind'),
                value: _memos,
                items: [(false, '任务 ${open.length}'), (true, '备忘 ${store.notes.length}')],
                onChanged: (v) => setState(() => _memos = v),
              ),
            ),
          ),
          actions: [
            BarAction(icon: Icons.search_rounded, label: '搜索（Ctrl/⌘ K）', onTap: scope.actions.openSearch),
          ],
          slivers: [
            const SliverToBoxAdapter(child: SyncBanner()),
            if (_memos) ..._memoSlivers(context, store, now)
            else ...[
              if (subjects.length > 1)
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 50,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.fromLTRB(Space.gutter, 12, Space.gutter, 4),
                      children: [
                        HaizChip(label: '全部', selected: _subject == null, onTap: () => setState(() => _subject = null)),
                        for (final s in subjects) ...[
                          const SizedBox(width: 6),
                          HaizChip(
                            label: '$s ${open.where((t) => t.subject == s).length}',
                            leading: SubjectMark(s, showLabel: false),
                            selected: _subject == s,
                            onTap: () => setState(() => _subject = _subject == s ? null : s),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              SliverToBoxAdapter(
                child: TaskGroupList(
                  store: store,
                  now: now,
                  groups: (tasks) => groupByDue(
                    tasks.where((t) => _subject == null || t.subject == _subject), now),
                ),
              ),
              if (open.isEmpty)
                SliverToBoxAdapter(
                  child: EmptyNote(
                    title: done.isEmpty ? '还没有任务' : '全部完成了',
                    body: done.isEmpty
                        ? '用右下角的 + 添加作业或要做的事；班级通知可以在「收件」里确认后转成任务。'
                        : '已完成的任务在下面，可以随时取消勾选。',
                  ),
                ),
              SliverToBoxAdapter(
                child: _Disclosure(
                  label: '已完成',
                  count: done.length,
                  open: _showDone,
                  onTap: () => setState(() => _showDone = !_showDone),
                  child: Column(children: [
                    for (final t in done.take(60))
                      TaskRow(
                        task: t,
                        now: now,
                        onToggle: () => store.setTaskCompleted(t.id, false),
                        onOpen: () => scope.actions.openTask(t.id),
                      ),
                    if (done.length > 60)
                      EmptyNote(title: '只显示最近完成的 60 项'),
                  ]),
                ),
              ),
              SliverToBoxAdapter(
                child: _Disclosure(
                  label: '最近删除',
                  count: store.ext.trash.length,
                  open: _showTrash,
                  onTap: () => setState(() => _showTrash = !_showTrash),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    for (final entry in store.ext.trash)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(Space.gutter, 8, 12, 8),
                        child: Row(children: [
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(entry.task.title, style: TypeScale.callout(c.ink2)),
                              const SizedBox(height: 2),
                              Text('${entry.task.subject} · 删除于 ${entry.deletedAt.month}月${entry.deletedAt.day}日',
                                  style: TypeScale.caption(c.ink3)),
                            ]),
                          ),
                          LinkAction('恢复', onTap: () {
                            store.restoreFromTrash(entry.task.id);
                            showToast(context, '已恢复「${entry.task.title}」');
                          }),
                        ]),
                      ),
                    if (store.ext.trash.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(14, 4, Space.gutter, 0),
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: LinkAction('清空最近删除', color: c.signal, onTap: () async {
                            final yes = await showDialog<bool>(
                              context: context,
                              builder: (d) => AlertDialog(
                                title: const Text('清空最近删除？'),
                                content: const Text('这些任务和它们的笔记将无法再恢复。'),
                                actions: [
                                  TextButton(onPressed: () => Navigator.pop(d, false), child: const Text('取消')),
                                  TextButton(onPressed: () => Navigator.pop(d, true),
                                      child: Text('清空', style: TextStyle(color: c.signal))),
                                ],
                              ),
                            );
                            if (yes == true) store.emptyTrash();
                          }),
                        ),
                      ),
                  ]),
                ),
              ),
            ],
          ],
        );
      },
    );
  }

  List<Widget> _memoSlivers(BuildContext context, PocketStore store, DateTime now) {
    final c = context.c;
    final scope = HaizScope.of(context);
    final notes = store.notes;
    return [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Space.gutter, 14, Space.gutter, 4),
          child: Text('备忘不会出现在今天或截止日期里。需要完成时，打开备忘并「转为任务」。',
              style: TypeScale.caption(c.ink3)),
        ),
      ),
      if (notes.isEmpty)
        SliverToBoxAdapter(
          child: EmptyNote(
            title: '还没有备忘',
            body: '课上的想法、要问老师的问题、下次带什么。',
            action: LinkAction('写一条备忘', icon: Icons.add_rounded, onTap: () => scope.actions.capture(memo: true)),
          ),
        ),
      SliverList.builder(
        itemCount: notes.length,
        itemBuilder: (context, i) {
          final note = notes[i];
          return Column(children: [
            Pressable(
              onTap: () => openNoteEditor(context, store: store, noteId: note.id, actions: scope.actions),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(Space.gutter, 12, Space.gutter, 12),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(note.title, maxLines: 2, overflow: TextOverflow.ellipsis,
                          style: TypeScale.body(c.ink).copyWith(fontWeight: FontWeight.w500)),
                      if (note.preview.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(note.preview, maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: TypeScale.footnote(c.ink2)),
                      ],
                      if (note.taskId != null) ...[
                        const SizedBox(height: 4),
                        Text(store.taskById(note.taskId) == null ? '曾转为任务' : '已转为任务',
                            style: TypeScale.caption(c.ink3)),
                      ],
                    ]),
                  ),
                  const SizedBox(width: 12),
                  Text(noteTime(note.updatedAt, now), style: TypeScale.caption(c.ink3)),
                ]),
              ),
            ),
            const Hairline(indent: Space.gutter),
          ]);
        },
      ),
    ];
  }
}

String noteTime(DateTime t, DateTime now) {
  final days = dayOf(now).difference(dayOf(t)).inDays;
  if (days == 0) return clockOf(t);
  if (days == 1) return '昨天';
  if (t.year == now.year) return '${t.month}月${t.day}日';
  return '${t.year}/${t.month}/${t.day}';
}

class _Disclosure extends StatelessWidget {
  const _Disclosure({required this.label, required this.count, required this.open, required this.onTap, required this.child});
  final String label;
  final int count;
  final bool open;
  final VoidCallback onTap;
  final Widget child;
  @override
  Widget build(BuildContext context) {
    final c = context.c;
    if (count == 0) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Pressable(
        onTap: onTap,
        semanticLabel: '${open ? '收起' : '展开'}$label',
        child: SectionHeader(label, count: count, padding: const EdgeInsets.fromLTRB(Space.gutter, 18, Space.gutter, 10),
          trailing: AnimatedRotation(
            turns: open ? .25 : 0,
            duration: context.haiz.motion(Motion.fast),
            child: Icon(Icons.chevron_right_rounded, size: 18, color: c.ink3),
          )),
      ),
      AnimatedSize(
        duration: context.haiz.motion(Motion.base),
        curve: Motion.enter,
        alignment: Alignment.topCenter,
        child: open ? child : const SizedBox(width: double.infinity),
      ),
    ]);
  }
}
