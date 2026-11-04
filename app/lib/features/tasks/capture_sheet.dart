import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/pocket_store.dart';
import '../../design/components.dart';
import '../../design/theme.dart';
import '../../design/tokens.dart';
import '../../domain/planning.dart';
import '../../domain/quick_task_date_parser.dart';
import 'task_editor.dart' show quickDueChoices;

class CaptureResult {
  const CaptureResult(this.message, this.undo);
  final String message;
  final VoidCallback undo;
}

/// Quick capture. The user says what it is — a task (has a deadline, gets
/// done) or a memo (something to remember) — before it is saved. Detected
/// dates and subjects are offered, never applied on their own; the line
/// above the button states exactly what will be created.
class CaptureSheet extends StatefulWidget {
  const CaptureSheet({super.key, required this.store, this.memo = false, this.initialText});
  final PocketStore store;
  final bool memo;
  final String? initialText;

  static const draftKey = 'capture';

  @override
  State<CaptureSheet> createState() => _CaptureSheetState();
}

class _CaptureSheetState extends State<CaptureSheet> {
  late final TextEditingController _text = TextEditingController(
    text: widget.initialText ?? widget.store.draft(CaptureSheet.draftKey),
  );
  late bool _memo = widget.memo;
  DateTime? _due;
  String? _subject;
  late final int _generation = widget.store.generation;

  PocketStore get store => widget.store;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  void _changed(String value) {
    store.setDraft(CaptureSheet.draftKey, value);
    setState(() {});
  }

  void _submit() {
    final text = _text.text.trim();
    if (text.isEmpty) return;
    if (store.generation != _generation || !store.writable) {
      showToast(context, store.generation != _generation
          ? '账号已切换，没有写入任何账号。'
          : (store.storageError ?? '当前记录暂不可写入。'));
      return;
    }
    final ticket = store.generation;
    CaptureResult? result;
    if (_memo) {
      final id = store.addNote(text);
      if (id != null) {
        result = CaptureResult('已保存为备忘', () {
          if (store.generation == ticket) store.deleteNote(id);
        });
      }
    } else {
      final id = store.addTask(text, _subject ?? '其他', due: _due);
      if (id != null) {
        final where = _due == null ? '待办 · 未定日期' : dateLabel(_due!, DateTime.now());
        result = CaptureResult('已添加到 $where', () {
          if (store.generation != ticket) return;
          // Undo of a fresh capture leaves no 最近删除 entry.
          if (store.taskById(id) != null) store.deleteTask(id, toTrash: false);
        });
      }
    }
    if (result == null) return;
    store.setDraft(CaptureSheet.draftKey, '');
    Navigator.of(context).pop(result);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final now = DateTime.now();
    final text = _text.text;
    final suggestion = _memo ? null : QuickTaskDateParser.suggest(text, now);
    final subjectHint = _memo ? null : detectSubject(text);
    final empty = text.trim().isEmpty;
    final outcome = _memo
        ? '保存为备忘，不会出现在待办里'
        : '添加任务 · ${_subject ?? '其他'} · ${_due == null ? '未定日期' : dateLabel(_due!, now)}';
    return CallbackShortcuts(
      bindings: {
        const SingleActivator(LogicalKeyboardKey.enter, meta: true): _submit,
        const SingleActivator(LogicalKeyboardKey.enter, control: true): _submit,
      },
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Space.gutter, 0, Space.gutter, Space.x4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 176,
              child: Segmented<bool>(
                value: _memo,
                items: const [(false, '任务'), (true, '备忘')],
                onChanged: (v) => setState(() => _memo = v),
              ),
            ),
            const SizedBox(height: Space.x3),
            TextField(
              key: const Key('capture-input'),
              controller: _text,
              autofocus: true,
              minLines: _memo ? 3 : 1,
              maxLines: _memo ? 8 : 3,
              maxLength: _memo ? 4000 : 140,
              textInputAction: _memo ? TextInputAction.newline : TextInputAction.done,
              style: TypeScale.body(c.ink),
              decoration: InputDecoration(
                hintText: _memo ? '记下要记住的事' : '例如：明天交物理实验报告',
                counterText: '',
              ),
              onChanged: _changed,
              onSubmitted: _memo ? null : (_) => _submit(),
            ),
            if (!_memo) ...[
              const SizedBox(height: Space.x3),
              Wrap(spacing: 6, runSpacing: 6, children: [
                if (suggestion != null && (_due == null || dayOf(_due!) != suggestion.date))
                  HaizChip(
                    key: const Key('capture-date-suggestion'),
                    label: '识别到「${suggestion.label.split(' · ').first}」· ${suggestion.date.month}月${suggestion.date.day}日',
                    tone: c.signal,
                    leading: const Icon(Icons.auto_awesome_outlined),
                    selected: false,
                    onTap: () => setState(() => _due = suggestion.date),
                  ),
                if (subjectHint != null && _subject != subjectHint)
                  HaizChip(
                    key: const Key('capture-subject-suggestion'),
                    label: '科目：$subjectHint',
                    tone: c.ink2,
                    leading: SubjectMark(subjectHint, showLabel: false),
                    selected: false,
                    onTap: () => setState(() => _subject = subjectHint),
                  ),
                for (final (label, date) in quickDueChoices(now).take(3))
                  HaizChip(
                    label: label,
                    selected: _due != null && date != null && dayOf(_due!) == date,
                    onTap: () => setState(() => _due = (_due != null && date != null && dayOf(_due!) == date) ? null : date),
                  ),
                HaizChip(
                  label: '日期…',
                  selected: false,
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _due ?? now,
                      firstDate: DateTime(now.year - 1),
                      lastDate: DateTime(now.year + 3),
                    );
                    if (picked != null && mounted) setState(() => _due = picked);
                  },
                ),
              ]),
            ],
            const SizedBox(height: Space.x4),
            Row(children: [
              Expanded(
                child: Text(empty ? (store.draft(CaptureSheet.draftKey).isEmpty ? '' : '草稿已保留') : outcome,
                    key: const Key('capture-outcome'),
                    style: TypeScale.caption(c.ink3), maxLines: 2),
              ),
              const SizedBox(width: Space.x3),
              HaizButton(
                key: const Key('capture-submit'),
                label: _memo ? '保存' : '添加',
                onPressed: empty ? null : _submit,
              ),
            ]),
          ],
        ),
      ),
    );
  }
}
