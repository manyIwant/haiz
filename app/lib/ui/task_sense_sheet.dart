import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/pocket_store.dart';
import '../domain/pocket_models.dart';
import '../domain/task_sense_engine.dart';
import 'kit.dart';

/// Review-only UI. Neither local nor remote analysis persists anything.
class TaskSenseSheet extends StatefulWidget {
  const TaskSenseSheet({
    super.key,
    required this.store,
    required this.generation,
    required this.input,
  });

  final PocketStore store;
  final int generation;
  final String input;

  @override
  State<TaskSenseSheet> createState() => _TaskSenseSheetState();
}

class _TaskSenseSheetState extends State<TaskSenseSheet> {
  final String _batchId = newId();
  late List<SenseDraft> _drafts;
  bool _useCloud = false;
  bool _busy = false;
  bool _saving = false;
  String? _notice;

  @override
  void initState() {
    super.initState();
    _drafts = TaskSenseEngine.local(widget.input, DateTime.now());
  }

  bool get _validScope => widget.store.generation == widget.generation &&
      widget.store.ready && widget.store.storageError == null;

  String _iso(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-'
      '${date.month.toString().padLeft(2, '0')}-'
      '${date.day.toString().padLeft(2, '0')}';

  Future<void> _analyze() async {
    if (_busy || !_validScope) return;
    setState(() { _busy = true; _notice = null; });
    final today = DateTime.now();
    final local = TaskSenseEngine.local(widget.input, today);
    var result = local;
    String? notice;
    if (_useCloud && widget.store.isCloudAccount) {
      try {
        final client = Supabase.instance.client;
        if (client.auth.currentSession == null) {
          throw StateError('尚未登录');
        }
        final response = await client.functions.invoke(
          'tasks-analyze',
          body: {
            'text': widget.input,
            'local_date': _iso(today),
            'timezone_offset_minutes': today.timeZoneOffset.inMinutes,
          },
        );
        result = TaskSenseEngine.fromRemote(
          response.data, widget.input, today,
        );
      } catch (_) {
        notice = '云端智能暂不可用，已使用本地整理；没有丢失任何内容。';
      }
    } else {
      notice = '已使用设备本地规则整理。';
    }
    if (!mounted || !_validScope) return;
    setState(() {
      _drafts = result;
      _busy = false;
      _notice = notice;
    });
  }

  Future<void> _changeDate(SenseDraft draft) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: draft.due ?? now,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (!mounted || !_validScope || picked == null) return;
    setState(() { draft.due = picked; });
  }

  Future<void> _confirm() async {
    if (_saving || _busy || !_validScope) return;
    final selected = _drafts.where((d) => d.selected).toList();
    if (selected.isEmpty || selected.any((d) =>
        d.title.trim().isEmpty || d.title.trim().length > 140)) {
      setState(() => _notice = '请选择有效任务，标题不得超过 140 字。');
      return;
    }
    final candidates = <TaskItem>[];
    for (var i = 0; i < selected.length; i++) {
      final draft = selected[i];
      final due = draft.due == null ? null : _iso(draft.due!);
      if (widget.store.tasks.any((t) => !t.completed &&
          t.title.trim() == draft.title.trim() && t.dueIso == due) ||
          candidates.any((t) => t.title == draft.title.trim() &&
              t.dueIso == due)) {
        setState(() => _notice = '存在相同的未完成任务，请取消勾选或修改后确认。');
        return;
      }
      candidates.add(TaskItem(
        id: 'sense_${_batchId}_$i',
        title: draft.title.trim(),
        subject: draft.subject,
        dueIso: due,
        source: 'HAIZ Sense',
      ));
    }
    setState(() { _saving = true; _notice = null; });
    final committed = widget.store.addSenseDraftsBatch(
      candidates, expectedGeneration: widget.generation,
    );
    if (!committed) {
      if (mounted) {
        setState(() { _saving = false; _notice = '未能保存：账号或任务状态已变化。'; });
      }
      return;
    }
    try {
      await widget.store.flush();
      if (mounted && _validScope) {
        Navigator.of(context).pop(true);
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _saving = false;
          _notice = '存储同步未成功，请保持应用打开并检查网络。不可重复创建相同草稿。';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    final canCloud = widget.store.isCloudAccount;
    final count = _drafts.where((d) => d.selected).length;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20, 8, 20, MediaQuery.of(context).viewInsets.bottom + 22,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(Icons.auto_awesome_outlined, color: p.accent),
              const SizedBox(width: 9),
              const Expanded(
                child: Text('HAIZ Sense · 智能整理',
                    style: TextStyle(fontSize: 19, fontWeight: FontWeight.w600)),
              ),
              IconButton(
                tooltip: '关闭，不保存',
                onPressed: _saving ? null : () => Navigator.pop(context, false),
                icon: const Icon(Icons.close_rounded),
              ),
            ]),
            Text('先检查每条建议，确认之前不会创建任何任务。',
                style: TextStyle(color: p.secondary, fontSize: 12)),
            const SizedBox(height: 12),
            if (canCloud) ...[
              SwitchListTile.adaptive(
                key: const Key('sense-cloud-switch'),
                contentPadding: EdgeInsets.zero,
                title: const Text('云端 AI 增强', style: TextStyle(fontSize: 14)),
                subtitle: const Text(
                  '仅将本次输入发送给服务端 AI；请勿输入他人隐私。',
                  style: TextStyle(fontSize: 11),
                ),
                value: _useCloud,
                onChanged: _busy || _saving ? null :
                    (value) => setState(() => _useCloud = value),
              ),
            ] else
              Text('设备本地整理 · 无需联网',
                  style: TextStyle(color: p.secondary, fontSize: 12)),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                key: const Key('sense-analyze'),
                onPressed: _busy || _saving || !_validScope ? null : _analyze,
                icon: _busy
                    ? const SizedBox(width: 16, height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.auto_fix_high_outlined, size: 18),
                label: Text(_busy ? '正在分析' : '重新整理'),
              ),
            ),
            for (var i = 0; i < _drafts.length; i++) ...[
              PocketCard(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Checkbox(
                      key: Key('sense-select-$i'),
                      value: _drafts[i].selected,
                      onChanged: _saving ? null : (v) =>
                          setState(() => _drafts[i].selected = v ?? false),
                    ),
                    Expanded(child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        TextFormField(
                          key: Key('sense-title-$i'),
                          initialValue: _drafts[i].title,
                          maxLength: 140,
                          maxLines: null,
                          enabled: !_saving,
                          decoration: const InputDecoration(
                            labelText: '任务内容',
                            isDense: true,
                            counterText: '',
                          ),
                          onChanged: (v) => setState(() => _drafts[i].title = v),
                        ),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 12,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            DropdownButton<String>(
                              key: Key('sense-subject-$i'),
                              value: _drafts[i].subject,
                              isDense: true,
                              items: [
                                for (final subject in TaskSenseEngine.subjects)
                                  DropdownMenuItem(value: subject,
                                      child: Text(subject)),
                              ],
                              onChanged: _saving ? null : (v) {
                                if (v != null) {
                                  setState(() => _drafts[i].subject = v);
                                }
                              },
                            ),
                            TextButton.icon(
                              key: Key('sense-date-$i'),
                              icon: const Icon(Icons.event_outlined, size: 16),
                              label: Text(_drafts[i].due == null
                                  ? '添加截止日期'
                                  : _iso(_drafts[i].due!)),
                              onPressed: _saving ? null :
                                  () => _changeDate(_drafts[i]),
                            ),
                            if (_drafts[i].due != null)
                              TextButton(
                                onPressed: _saving ? null :
                                    () => setState(() => _drafts[i].due = null),
                                child: const Text('清除日期'),
                              ),
                          ],
                        ),
                        Text(_drafts[i].timeHint,
                            style: TextStyle(fontSize: 11, color: p.secondary)),
                      ],
                    )),
                  ],
                ),
              ),
              const SizedBox(height: 8),
            ],
            if (_notice != null) ...[
              Text(_notice!, key: const Key('sense-notice'),
                  style: TextStyle(color: p.secondary, fontSize: 12)),
              const SizedBox(height: 8),
            ],
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                key: const Key('sense-confirm'),
                onPressed: count == 0 || _busy || _saving || !_validScope
                    ? null : _confirm,
                child: Text(_saving ? '正在保存…' : '确认创建 $count 项任务'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
