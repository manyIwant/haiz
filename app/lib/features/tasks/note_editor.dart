import 'dart:async';

import 'package:flutter/material.dart';

import '../../app/nav.dart';
import '../../core/pocket_store.dart';
import '../../design/components.dart';
import '../../design/theme.dart';
import '../../design/tokens.dart';
import '../../domain/planning.dart';
import '../sync/sync_banner.dart';
import 'task_editor.dart' show quickDueChoices, subjectChoices;

Future<void> openNoteEditor(BuildContext context, {required PocketStore store, required String noteId, HaizActions? actions}) {
  return Navigator.of(context).push(MaterialPageRoute<void>(
    builder: (_) => NoteEditor(store: store, noteId: noteId, actions: actions),
  ));
}

/// A plain writing surface. Saves as you type (debounced) and on leave.
class NoteEditor extends StatefulWidget {
  const NoteEditor({super.key, required this.store, required this.noteId, this.actions});
  final PocketStore store;
  final String noteId;
  final HaizActions? actions;
  @override
  State<NoteEditor> createState() => _NoteEditorState();
}

class _NoteEditorState extends State<NoteEditor> {
  late final int _generation = widget.store.generation;
  late final TextEditingController _text =
      TextEditingController(text: widget.store.noteById(widget.noteId)?.text ?? '');
  Timer? _debounce;

  PocketStore get store => widget.store;

  void _save() {
    _debounce?.cancel();
    if (store.generation != _generation) return;
    if (_text.text.trim().isEmpty) return;
    store.updateNote(widget.noteId, _text.text);
  }

  @override
  void dispose() {
    _save();
    _debounce?.cancel();
    _text.dispose();
    super.dispose();
  }

  Future<void> _convert() async {
    _save();
    final note = store.noteById(widget.noteId);
    if (note == null) return;
    final created = await showHaizSheet<String>(
      context,
      builder: (_) => _ConvertSheet(store: store, noteId: note.id, initialTitle: note.title),
    );
    if (created != null && mounted) {
      showToast(context, '已转为任务，备忘保留', action: '查看', onAction: () => widget.actions?.openTask(created));
      setState(() {});
    }
  }

  Future<void> _delete() async {
    final removed = store.deleteNote(widget.noteId);
    if (removed == null) return;
    final ticket = store.generation;
    _text.clear();
    Navigator.of(context).pop();
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.hideCurrentSnackBar();
    messenger?.showSnackBar(SnackBar(
      content: const Text('已删除备忘'),
      action: SnackBarAction(label: '撤销', onPressed: () {
        if (store.generation == ticket) store.restoreNote(removed);
      }),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final note = store.noteById(widget.noteId);
    final linked = store.taskById(note?.taskId);
    return Scaffold(
      backgroundColor: c.surface,
      appBar: AppBar(
        backgroundColor: c.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          tooltip: '返回',
          icon: Icon(Icons.arrow_back_ios_new_rounded, size: 19, color: c.ink),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        actions: [
          if (linked == null)
            TextButton(key: const Key('note-convert'), onPressed: _convert, child: const Text('转为任务'))
          else
            TextButton(onPressed: () => widget.actions?.openTask(linked.id), child: const Text('查看任务')),
          IconButton(tooltip: '删除备忘', onPressed: _delete,
              icon: Icon(Icons.delete_outline_rounded, color: c.ink2)),
          const SizedBox(width: 4),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(Space.gutter, 4, Space.gutter, 0),
              child: TextField(
                key: const Key('note-text'),
                controller: _text,
                autofocus: (note?.text ?? '').isEmpty,
                expands: true,
                maxLines: null,
                minLines: null,
                maxLength: 20000,
                textAlignVertical: TextAlignVertical.top,
                style: TypeScale.body(c.ink).copyWith(height: 1.6),
                decoration: const InputDecoration(
                  filled: false,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  counterText: '',
                  hintText: '第一行会作为标题',
                  contentPadding: EdgeInsets.zero,
                ),
                onChanged: (_) {
                  _debounce?.cancel();
                  _debounce = Timer(const Duration(milliseconds: 600), _save);
                },
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(Space.gutter, 6, Space.gutter, 10),
            child: Row(children: [
              if (note != null)
                Text('创建于 ${note.createdAt.month}月${note.createdAt.day}日', style: TypeScale.caption(c.ink3)),
              const Spacer(),
              SyncLine(store: store),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _ConvertSheet extends StatefulWidget {
  const _ConvertSheet({required this.store, required this.noteId, required this.initialTitle});
  final PocketStore store;
  final String noteId;
  final String initialTitle;
  @override
  State<_ConvertSheet> createState() => _ConvertSheetState();
}

class _ConvertSheetState extends State<_ConvertSheet> {
  late final _title = TextEditingController(text: widget.initialTitle);
  late String _subject = detectSubject(widget.initialTitle) ?? '其他';
  DateTime? _due;

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final now = DateTime.now();
    return Padding(
      padding: const EdgeInsets.fromLTRB(Space.gutter, 0, Space.gutter, Space.x6),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('转为任务', style: TypeScale.headline(c.ink)),
        const SizedBox(height: 4),
        Text('备忘会保留，并和新任务互相关联。', style: TypeScale.caption(c.ink3)),
        const SizedBox(height: Space.x3),
        TextField(controller: _title, maxLength: 140, decoration: const InputDecoration(counterText: '', hintText: '任务名称'),
            onChanged: (_) => setState(() {})),
        const SizedBox(height: Space.x3),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final s in subjectChoices)
            HaizChip(label: s, selected: _subject == s, onTap: () => setState(() => _subject = s)),
        ]),
        const SizedBox(height: Space.x3),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final (label, date) in quickDueChoices(now))
            HaizChip(label: label, selected: _due == date, onTap: () => setState(() => _due = _due == date ? null : date)),
        ]),
        const SizedBox(height: Space.x4),
        HaizButton(
          label: '创建任务',
          expand: true,
          onPressed: _title.text.trim().isEmpty ? null : () {
            final id = widget.store.convertNoteToTask(widget.noteId,
                title: _title.text, subject: _subject, due: _due);
            Navigator.of(context).pop(id);
          },
        ),
      ]),
    );
  }
}
