import 'package:flutter/material.dart';

import '../../app/nav.dart';
import '../../core/pocket_store.dart';
import '../../design/components.dart';
import '../../design/theme.dart';
import '../../design/tokens.dart';
import '../../domain/planning.dart';
import '../../domain/pocket_models.dart';
import '../tasks/note_editor.dart';

Future<void> showSearchSheet(BuildContext context, {required PocketStore store, required HaizActions actions}) {
  return showHaizSheet<void>(context, expand: true, builder: (_) => SearchSheet(store: store, actions: actions));
}

/// One search across tasks (title, subject, note), memos and courses.
class SearchSheet extends StatefulWidget {
  const SearchSheet({super.key, required this.store, required this.actions});
  final PocketStore store;
  final HaizActions actions;
  @override
  State<SearchSheet> createState() => _SearchSheetState();
}

class _SearchSheetState extends State<SearchSheet> {
  final _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final store = widget.store;
    final q = _query.text.trim().toLowerCase();
    final now = DateTime.now();
    bool hit(String s) => s.toLowerCase().contains(q);
    final tasks = q.isEmpty ? <TaskItem>[] : store.tasks
        .where((t) => hit(t.title) || hit(t.subject) || hit(store.noteFor(t.id))).take(30).toList();
    final notes = q.isEmpty ? <NoteItem>[] : store.notes.where((n) => hit(n.text)).take(20).toList();
    final courses = q.isEmpty ? <CourseSlot>[] : store.courses
        .where((x) => hit(x.name) || hit(x.location)).toList()
      ..sort((a, b) => a.weekday != b.weekday ? a.weekday.compareTo(b.weekday) : a.startMinute.compareTo(b.startMinute));
    final none = q.isNotEmpty && tasks.isEmpty && notes.isEmpty && courses.isEmpty;
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(Space.gutter, 0, Space.gutter, 4),
        child: TextField(
          key: const Key('search-input'),
          controller: _query,
          autofocus: true,
          textInputAction: TextInputAction.search,
          decoration: InputDecoration(
            hintText: '搜索任务、备忘、课程和教室',
            prefixIcon: Icon(Icons.search_rounded, color: c.ink3),
          ),
          onChanged: (_) => setState(() {}),
        ),
      ),
      Expanded(
        child: ListView(children: [
          if (q.isEmpty)
            EmptyNote(title: '输入关键词', body: '例如科目「物理」、页码「P36」、教室「302」。'),
          if (none) EmptyNote(title: '没有找到「${_query.text.trim()}」'),
          if (tasks.isNotEmpty) SectionHeader('任务', count: tasks.length),
          for (final t in tasks)
            Pressable(
              onTap: () {
                Navigator.pop(context);
                widget.actions.openTask(t.id);
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: Space.gutter, vertical: 10),
                child: Row(children: [
                  Icon(t.completed ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                      size: 18, color: t.completed ? c.ink3 : c.ink2),
                  const SizedBox(width: 10),
                  Expanded(child: Text(t.title, style: TypeScale.callout(t.completed ? c.ink3 : c.ink), maxLines: 2)),
                  const SizedBox(width: 8),
                  SubjectMark(t.subject),
                  if (dueLabel(t, now).isNotEmpty) ...[
                    const SizedBox(width: 8),
                    Text(dueLabel(t, now), style: TypeScale.caption(c.ink3)),
                  ],
                ]),
              ),
            ),
          if (notes.isNotEmpty) SectionHeader('备忘', count: notes.length),
          for (final n in notes)
            Pressable(
              onTap: () {
                Navigator.pop(context);
                openNoteEditor(context, store: store, noteId: n.id, actions: widget.actions);
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: Space.gutter, vertical: 10),
                child: Row(children: [
                  Icon(Icons.sticky_note_2_outlined, size: 18, color: c.ink2),
                  const SizedBox(width: 10),
                  Expanded(child: Text(n.title, style: TypeScale.callout(c.ink), maxLines: 1, overflow: TextOverflow.ellipsis)),
                ]),
              ),
            ),
          if (courses.isNotEmpty) SectionHeader('课程', count: courses.length),
          for (final x in courses)
            Pressable(
              onTap: () {
                Navigator.pop(context);
                widget.actions.goTab(HaizTab.schedule);
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: Space.gutter, vertical: 10),
                child: Row(children: [
                  SizedBox(width: 40, child: Text(weekdayName(x.weekday), style: TypeScale.footnote(c.ink2))),
                  SizedBox(width: 48, child: Text(minutesText(x.startMinute), style: TypeScale.footnote(c.ink2))),
                  Expanded(child: Text(x.name, style: TypeScale.callout(c.ink))),
                  Text(x.location, style: TypeScale.caption(c.ink3)),
                ]),
              ),
            ),
          const SizedBox(height: 40),
        ]),
      ),
    ]);
  }
}
