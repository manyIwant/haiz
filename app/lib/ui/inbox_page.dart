import 'dart:async';

import 'package:flutter/material.dart';

import '../core/pocket_store.dart';
import '../core/academic_session.dart';
import '../domain/pocket_models.dart';
import '../domain/notice_parser.dart';
import '../domain/message_intake_bridge.dart';
import '../domain/notice_import_service.dart';
import 'kit.dart';

class _Draft {
  String title;
  String subject;
  DateTime? due;
  final String source;
  final String original;
  final bool ambiguous;
  bool selected = true;
  final String clientKey = 'mobile_${newId()}';
  _Draft(NoticeCandidate c)
    : title = c.title,
      subject = c.subject,
      due = c.due,
      source = c.source,
      original = c.original,
      ambiguous = c.ambiguous;
}

String _humanDue(DateTime? date) => date == null
    ? '截止日期待确认'
    : '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

class InboxPage extends StatefulWidget {
  final PocketStore store;
  final VoidCallback onSaved;
  final AcademicSession? session;
  const InboxPage({super.key, required this.store, required this.onSaved, this.session});
  @override
  State<InboxPage> createState() => _InboxPageState();
}

class _InboxPageState extends State<InboxPage> with WidgetsBindingObserver {
  final _input = TextEditingController();
  final List<_Draft> _drafts = [];
  String? _notice;
  String _currentSource = '手动粘贴';
  bool _importing = false;
  int _composeGeneration = 0;
  final _groupsController = TextEditingController();
  List<IncomingNotice> _incoming = const [];
  MonitorConfiguration? _monitor;
  bool _groupsLoaded = false;
  bool _wechatOptIn = false;
  bool _monitorBusy = false;
  bool _submittingClass = false;
  bool _aiPreprocessing = false;
  final Map<String, List<NoticeCandidate>> _aiResults = {};
  final Set<String> _aiSeen = {};
  String? _currentIncomingId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    MessageIntakeBridge.revision.addListener(_refreshIncoming);
    _refreshIncoming();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refreshIncoming();
  }

  Future<void> _refreshIncoming() async {
    if (!MessageIntakeBridge.available) return;
    try {
      final items = await MessageIntakeBridge.entries();
      final setting = await MessageIntakeBridge.configuration();
      if (!mounted) return;
      setState(() {
        _incoming = items;
        _monitor = setting;
        if (!_groupsLoaded) {
          _groupsController.text = setting?.groups ?? '';
          _wechatOptIn = setting?.wechat ?? false;
          _groupsLoaded = true;
        }
      });
      unawaited(_preprocessIncoming(items));
    } catch (_) {
      if (mounted) setState(() => _notice = '无法读取本地消息队列，请重试。');
    }
  }

  Future<void> _setAiConsent(bool value) async {
    if (value) {
      final accepted = await showDialog<bool>(
        context: context,
        builder: (dialog) => AlertDialog(
          title: const Text('开启 AI 语义识别？'),
          content: const Text('打开 HAIZ 收件箱后，指定群的待审消息将发送到'
              'HAIZ 服务端配置的 AI 提供商进行分析。发送前会对电话号码、'
              '邮箱、链接做基础脱敏，但仍可能包含个人信息。'
              '请确保班级管理者与群成员知情同意。默认关闭，不会自动发布。'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialog, false),
              child: const Text('保持关闭')),
            FilledButton(onPressed: () => Navigator.pop(dialog, true),
              child: const Text('同意开启')),
          ],
        ),
      );
      if (accepted != true || !mounted) return;
    }
    try {
      await widget.store.setSemanticExtractionConsent(value);
      if (!mounted) return;
      setState(() => _notice = value
          ? '已开启 AI 预解析；服务端需要配置模型，原始通知仍保存在本机。'
          : '已关闭 AI 预解析。');
      if (value) unawaited(_preprocessIncoming(_incoming));
    } catch (_) {
      if (mounted) setState(() => _notice = 'AI 选项保存失败；请检查班级登录状态。');
    }
  }

  Future<void> _preprocessIncoming(List<IncomingNotice> items) async {
    final session = widget.session;
    if (_aiPreprocessing || !widget.store.semanticExtractionConsent ||
        session == null || session.identity == null ||
        session.role != 'student' || session.busy) { return; }
    final scope = widget.store.namespace;
    final generation = widget.store.generation;
    final loginGeneration = session.generation;
    if (scope == null || !scope.startsWith('haiz/v1/')) return;
    final now = DateTime.now();
    final pending = items.where((entry) =>
      !_aiSeen.contains(entry.id) &&
      !entry.receivedAt.isAfter(now) &&
      now.difference(entry.receivedAt).inDays < 7).take(4).toList();
    if (pending.isEmpty) return;
    _aiPreprocessing = true;
    try {
      for (final entry in pending) {
        if (!mounted || widget.store.generation != generation ||
            session.generation != loginGeneration ||
            widget.store.namespace != scope ||
            !widget.store.semanticExtractionConsent) { return; }
        _aiSeen.add(entry.id);
        final semantic = await session.extractSemanticNotice(
          text: entry.text, capturedAt: entry.receivedAt,
        );
        if (!mounted || widget.store.generation != generation ||
            session.generation != loginGeneration ||
            widget.store.namespace != scope) { return; }
        if (semantic == null) continue;
        setState(() {
          _aiResults[entry.id] = semantic;
          if (_currentIncomingId == entry.id) {
            if (semantic.isNotEmpty) {
              _drafts..clear()..addAll(semantic.map(_Draft.new));
              _notice = 'AI 已生成多项候选；请核对内容和截止日期。';
            } else {
              _notice = 'AI 没有识别到明确作业，保留规则候选供核对。';
            }
          }
        });
      }
    } finally {
      _aiPreprocessing = false;
    }
  }

  Future<void> _setMonitor(bool enabled) async {
    if (_monitorBusy) return;
    setState(() => _monitorBusy = true);
    try {
      final setting = await MessageIntakeBridge.configure(
        enabled: enabled,
        groups: _groupsController.text,
        includeWeChat: _wechatOptIn,
      );
      if (!mounted) return;
      setState(() {
        _monitor = setting;
        _notice = enabled
            ? (setting?.enabled == true
                  ? '仅监测已指定的群标题。还需要在 Android 设置中授予通知使用权。'
                  : '请先填写至少两个字的指定班群名称。')
            : '已停止后台通知候选收集，既有待审核内容仍可处理。';
      });
    } catch (_) {
      if (mounted) setState(() => _notice = '保存通知接入设置失败。');
    } finally {
      if (mounted) setState(() => _monitorBusy = false);
    }
  }

  void _reviewIncoming(IncomingNotice entry) {
    _currentIncomingId = entry.id;
    _currentSource = entry.title.isEmpty
        ? entry.source
        : '${entry.source} · ${entry.title}';
    // Keep the actual notification text untouched so strict HAIZ teacher
    // export lines still match the parser's anchored structured format.
    _input.text = entry.text;
    _extract(today: entry.receivedAt);
    final cached = _aiResults[entry.id];
    if (cached != null) {
      setState(() {
        if (cached.isNotEmpty) {
          _drafts..clear()..addAll(cached.map(_Draft.new));
        }
        _notice = cached.isEmpty
            ? 'AI 未识别到明确任务，已保留本机规则候选。'
            : 'AI 语义结果已生成，请逐项核对。';
      });
    } else if (widget.store.semanticExtractionConsent) {
      unawaited(_preprocessIncoming([entry]));
    }
  }

  Future<void> _dismissIncoming(IncomingNotice entry) async {
    try {
      await MessageIntakeBridge.remove(entry.id);
      await _refreshIncoming();
    } catch (_) {
      if (mounted) setState(() => _notice = '未能移除这条消息，请重试。');
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    MessageIntakeBridge.revision.removeListener(_refreshIncoming);
    _groupsController.dispose();
    _input.dispose();
    super.dispose();
  }

  void _extract({DateTime? today}) {
    final found = NoticeParser.parse(_input.text, today: today);
    setState(() {
      _composeGeneration = widget.store.generation;
      _drafts
        ..clear()
        ..addAll(found.map(_Draft.new));
      _notice = found.isEmpty
          ? '没有发现明确的行动要求。请检查原文，也可以在「今天」手动添加。'
          : '仅根据文字规则生成候选；请核对原文、科目和日期，确认后才保存。';
    });
  }

  Future<void> _importDocument() async {
    if (_importing) return;
    setState(() => _importing = true);
    final generation = widget.store.generation;
    try {
      final result = await NoticeImportService.pickAndExtract();
      if (result == null || !mounted) return;
      if (widget.store.generation != generation) {
        setState(() => _notice = '读取期间已切换账号，本次导入已取消，没有写入任何账号。');
        return;
      }
      _currentIncomingId = null;
      _input.text = result.$2;
      _currentSource = result.$1;
      _extract();
      if (mounted) {
        setState(() => _notice = '${result.$1} 已在本机读取。请检查提取的原文和每项任务，日期可能需要修改。');
      }
    } catch (error) {
      if (mounted) setState(() => _notice = '导入未成功：$error。可复制文档文字后手动粘贴。');
    } finally {
      if (mounted) setState(() => _importing = false);
    }
  }

  Future<void> _edit(_Draft d) async {
    final title = TextEditingController(text: d.title);
    final subject = TextEditingController(text: d.subject);
    DateTime? due = d.due;
    final changed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialog) => AlertDialog(
          title: const Text('核对任务内容'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: title,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: '任务描述',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: subject,
                  decoration: const InputDecoration(
                    labelText: '科目',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 14),
                OutlinedButton.icon(
                  onPressed: () async {
                    final date = await showDatePicker(
                      context: ctx,
                      initialDate: due ?? DateTime.now(),
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2100),
                    );
                    if (date != null) setDialog(() => due = date);
                  },
                  icon: const Icon(Icons.event_outlined),
                  label: Text('日期：${_humanDue(due)}'),
                ),
                TextButton(
                  onPressed: () => setDialog(() => due = null),
                  child: const Text('清除截止日期'),
                ),
                const SizedBox(height: 10),
                Text(
                  '原文：${d.original}',
                  style: Theme.of(ctx).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('取消'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('保存修改'),
            ),
          ],
        ),
      ),
    );
    if (!mounted) {
      title.dispose();
      subject.dispose();
      return;
    }
    if (changed == true && title.text.trim().isNotEmpty) {
      setState(() {
        d.title = title.text.trim();
        d.subject = subject.text.trim();
        d.due = due;
      });
    }
    title.dispose();
    subject.dispose();
  }

  Future<void> _submitToClass() async {
    final session = widget.session;
    if (_submittingClass || session == null || session.role != 'student' ||
        session.identity == null || session.selectedClass == null) { return; }
    if (widget.store.generation != _composeGeneration) {
      setState(() => _notice = '账号已切换，请重新提取消息后再提交。');
      return;
    }
    final candidates = _drafts.where((d) => d.selected && d.title.trim().isNotEmpty).toList();
    if (candidates.isEmpty) return;
    if (candidates.length > 10) {
      setState(() => _notice = '一次最多提交10条作业，请分批检查。');
      return;
    }
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: const Text('提交班级审核？'),
        content: Text(
          '将向当前已加入班级提交 ${candidates.length} 条作业候选（科目、标题、截止日期）。'
          '不会上传微信原文、发送者、群聊记录。班级审核者确认后才会发布给同学。'
          '请先确保班级成员同意以这种方式共享作业信息。',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog, false),
              child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(dialog, true),
              child: const Text('确认提交任务字段')),
        ],
      ),
    );
    if (accepted != true || !mounted ||
        widget.store.generation != _composeGeneration) { return; }
    final loginGeneration = session.generation;
    final scope = widget.store.namespace;
    setState(() => _submittingClass = true);
    int submitted = 0;
    try {
      for (final draft in candidates) {
        if (session.generation != loginGeneration ||
            widget.store.namespace != scope ||
            widget.store.generation != _composeGeneration) {
          if (mounted) setState(() => _notice = '账号已切换，停止上传；请重新检查剩余候选。');
          return;
        }
        final ok = await session.submitClassSuggestion(
          title: draft.title,
          subject: draft.subject,
          due: draft.due == null ? null : _humanDue(draft.due),
          clientKey: draft.clientKey,
        );
        if (!ok) {
          if (mounted) {
            setState(() => _notice =
                '已提交 $submitted 条，剩余候选未上传：${session.error ?? '请检查连接或权限'}');
          }
          return;
        }
        submitted++;
        if (mounted) setState(() => draft.selected = false);
      }
      if (!mounted || session.generation != loginGeneration ||
          widget.store.generation != _composeGeneration) { return; }
      // Retain the native notification until user chooses local save/ignore;
      // posting a structured suggestion is not permission to erase its source.
      setState(() => _notice = '已提交 $submitted 条结构化任务至班级待审核队列；尚未对全班发布。');
    } finally {
      if (mounted) setState(() => _submittingClass = false);
    }
  }

  Future<void> _commit() async {
    if (widget.store.generation != _composeGeneration) {
      setState(() {
        _drafts.clear();
        _notice = '已切换账号，候选任务未写入任何账号。';
      });
      return;
    }
    final selected = _drafts
        .where((d) => d.selected && d.title.trim().isNotEmpty)
        .toList();
    final existed = widget.store.tasks
        .map((t) => '${t.subject}/${t.title}/${t.dueIso ?? ''}')
        .toSet();
    int added = 0;
    for (final draft in selected) {
      final dueIso = draft.due == null ? '' : _humanDue(draft.due);
      final key = '${draft.subject}/${draft.title}/$dueIso';
      if (!existed.add(key)) continue;
      widget.store.addTask(
        draft.title,
        draft.subject,
        due: draft.due,
        source: '导入 · $_currentSource',
        originalNotice: draft.original,
      );
      added++;
    }
    // Only after explicit user confirmation and local persistence do we
    // acknowledge the native source. A failed save stays in the inbox.
    try {
      await widget.store.flush();
    } catch (_) {
      if (mounted) setState(() => _notice = '任务保存失败，原消息仍保留在收件箱。');
      return;
    }
    if (widget.store.generation != _composeGeneration) {
      if (mounted) {
        setState(() => _notice = '已切换账号，原消息仍保留在待审核队列。');
      }
      return;
    }
    final imported = _currentIncomingId;
    if (imported != null) {
      await MessageIntakeBridge.remove(imported);
      _currentIncomingId = null;
      await _refreshIncoming();
    }
    if (!mounted) return;
    setState(() {
      _drafts.clear();
      _notice = '已加入 $added 项任务（相同标题、科目、日期会跳过重复项）。';
    });
    if (added > 0) widget.onSaved();
  }

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    return SingleChildScrollView(
      key: const PageStorageKey('inbox'),
      padding: const EdgeInsets.fromLTRB(23, 31, 23, 130),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 800),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Eyebrow('HAIZ INBOX / NOTICE TO ACTION'),
              const SizedBox(height: 23),
              const PageTitle(
                title: '消息可以变成行动。',
                subtitle: '从聊天分享，或接收指定群通知；核对后成为任务。',
              ),
              const SizedBox(height: 14),
              if (widget.session?.identity != null &&
                  widget.session?.role == 'student' &&
                  widget.session?.selectedClass != null) ...[
                PocketCard(
                  child: SwitchListTile.adaptive(
                    key: const Key('ai-semantic-opt-in'),
                    contentPadding: EdgeInsets.zero,
                    title: const Text('自动 AI 语义理解作业'),
                    subtitle: const Text('默认关闭。开启后进入收件箱时自动解析指定群候选；'
                        '单条通知经基础脱敏后发送给 HAIZ 配置的模型。未配置时保留规则解析。'),
                    value: widget.store.semanticExtractionConsent,
                    onChanged: _setAiConsent,
                  ),
                ),
                const SizedBox(height: 14),
              ],
              _nativeInboxSection(context),
              const SizedBox(height: 22),
              PocketCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionLabel('粘贴一段通知'),
                    const SizedBox(height: 8),
                    Text(
                      '从微信、QQ、钉钉、学习通等应用点「分享 → HAIZ」，可直接加入待审阅消息；也能手动粘贴、导入文档。',
                      style: TextStyle(color: p.secondary, fontSize: 12),
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      key: const Key('inbox-text'),
                      controller: _input,
                      minLines: 5,
                      maxLines: 9,
                      decoration: const InputDecoration(
                        hintText: '例如：数学明天交练习册第36-39页。\n物理后天提交实验报告。',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Wrap(
                      spacing: 9,
                      runSpacing: 9,
                      children: [
                        PocketPill(
                          label: '提取候选',
                          icon: Icons.auto_fix_high_rounded,
                          onTap: () {
                            _currentIncomingId = null;
                            _currentSource = '手动粘贴';
                            _extract();
                          },
                        ),
                        OutlinedButton.icon(
                          onPressed: _importing ? null : _importDocument,
                          icon: Icon(
                            _importing
                                ? Icons.hourglass_top_rounded
                                : Icons.file_open_outlined,
                            size: 18,
                          ),
                          label: Text(_importing ? '正在读取' : '导入截图 / 文档'),
                        ),
                        OutlinedButton.icon(
                          onPressed: () {
                            _currentIncomingId = null;
                            _currentSource = '演示通知';
                            _input.text = '数学明天交练习册第36-39页。\n物理后天提交实验报告。\n英语本周五背诵Unit 4单词。';
                            _extract();
                          },
                          icon: const Icon(Icons.science_outlined, size: 18),
                          label: const Text('试用示例'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 21),
              if (_notice != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 18),
                  child: Text(
                    _notice!,
                    style: TextStyle(
                      color: p.secondary,
                      fontSize: 12,
                      height: 1.6,
                    ),
                  ),
                ),
              if (_drafts.isNotEmpty) ...[
                SectionLabel(
                  '等待你确认',
                  trailing: '${_drafts.where((d) => d.selected).length} 项选中',
                ),
                const SizedBox(height: 11),
                for (int i = 0; i < _drafts.length; i++) ...[
                  PocketCard(
                    padding: const EdgeInsets.fromLTRB(12, 12, 8, 12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Checkbox(
                          value: _drafts[i].selected,
                          onChanged: (v) =>
                              setState(() => _drafts[i].selected = v ?? false),
                        ),
                        const SizedBox(width: 5),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _drafts[i].title,
                                style: TextStyle(
                                  color: p.foreground,
                                  fontWeight: FontWeight.w600,
                                  height: 1.5,
                                  fontSize: 14,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                '${_drafts[i].subject} · ${_humanDue(_drafts[i].due)}',
                                style: TextStyle(color: p.accent, fontSize: 12),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _drafts[i].ambiguous
                                    ? '需要核实：日期或措辞存在不确定性'
                                    : '请核实：自动提取不代表老师已确认',
                                style: TextStyle(
                                  color: p.secondary,
                                  fontSize: 10.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          tooltip: '编辑候选',
                          onPressed: () => _edit(_drafts[i]),
                          icon: Icon(
                            Icons.edit_outlined,
                            color: p.accent,
                            size: 19,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 9),
                ],
                const SizedBox(height: 7),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _drafts.any((d) => d.selected) ? _commit : null,
                    icon: const Icon(Icons.playlist_add_check_rounded),
                    label: const Text('确认并加入我的任务'),
                  ),
                ),
                if (widget.session?.role == 'student' &&
                    widget.session?.selectedClass != null) ...[
                  const SizedBox(height: 9),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      key: const Key('submit-mobile-suggestion'),
                      onPressed: _submittingClass || !_drafts.any((d) => d.selected)
                          ? null : _submitToClass,
                      icon: const Icon(Icons.cloud_upload_outlined),
                      label: Text(_submittingClass
                          ? '正在提交审核…' : '提交选中任务给班级审核'),
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text('默认不上传。仅提交你确认的任务字段，不包含聊天原文。审核通过才会被其他同学看到。',
                    style: TextStyle(color: p.secondary, fontSize: 11, height: 1.5)),
                ],
              ] else ...[
                const SectionLabel('处理规则'),
                const SizedBox(height: 13),
                PocketCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _line(
                        context,
                        Icons.filter_alt_outlined,
                        '寻找行动词',
                        '交、完成、带好、复习等',
                      ),
                      const SizedBox(height: 17),
                      _line(
                        context,
                        Icons.event_outlined,
                        '辅助识别日期',
                        '今天、明天、周几或明确日期；以导入日为相对日期基准',
                      ),
                      const SizedBox(height: 17),
                      _line(
                        context,
                        Icons.verified_user_outlined,
                        '始终由你确认',
                        '候选不是正式的教师发布，选定任务的原文会保存在本机，供随时核对',
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 18),
              Text(
                '自动候选只读取 Android 系统中获授权的指定群通知；不登录消息平台、不读取历史聊天、不向第三方 AI 上传。',
                style: TextStyle(color: p.secondary, fontSize: 11, height: 1.5),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _nativeInboxSection(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    if (!MessageIntakeBridge.available) {
      return PocketCard(
        child: Text(
          '网页预览支持手动粘贴与导入文档。消息分享入口和指定群通知监测需要 Android 安装版。',
          style: TextStyle(color: p.secondary, height: 1.6, fontSize: 12),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: SectionLabel(
                '来自聊天与群通知',
                trailing: '${_incoming.length} 条待审阅',
              ),
            ),
            IconButton(
              tooltip: '刷新消息',
              onPressed: _refreshIncoming,
              icon: const Icon(Icons.refresh_rounded),
            ),
          ],
        ),
        const SizedBox(height: 9),
        PocketCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '微信、QQ 等指定群的新通知可在授权后自动进入；也可以主动从聊天中分享一段通知。',
                style: TextStyle(color: p.secondary, fontSize: 12, height: 1.6),
              ),
              if (_incoming.isEmpty) ...[
                const SizedBox(height: 10),
                const Text('暂无接收到的消息'),
              ],
              for (final message in _incoming) ...[
                const Divider(height: 22),
                Text(
                  message.source,
                  style: TextStyle(
                    color: p.accent,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  message.title.isEmpty
                      ? message.text
                      : '${message.title} · ${message.text}',
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: p.foreground,
                    height: 1.5,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    OutlinedButton(
                      onPressed: () => _reviewIncoming(message),
                      child: const Text('提取并审核'),
                    ),
                    const SizedBox(width: 7),
                    TextButton(
                      onPressed: () => _dismissIncoming(message),
                      child: const Text('忽略'),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 14),
        ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 2),
          childrenPadding: const EdgeInsets.only(bottom: 16),
          title: Text(
            '指定群通知自动收集',
            style: TextStyle(
              color: p.foreground,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          subtitle: Text(
            _monitor?.enabled == true
                ? (_monitor?.granted == true ? '已启用 · 仅指定群' : '等待系统通知授权')
                : '默认关闭 · 需要你明确开启',
            style: TextStyle(color: p.secondary, fontSize: 11),
          ),
          children: [
            Text(
              '支持 QQ / TIM / 钉钉 / 学习通，微信须单独勾选。只有通知标题、会话标题或副标题包含你指定的群名称，'
              '且正文具有学习行动词时才保存候选。通知元数据不能可靠证明一定是群聊，'
              '请使用足够独特的群名；无法读取已隐藏的通知内容或历史消息，也不会上传消息。'
              ' 保存为待办前仍需人工确认。',
              style: TextStyle(color: p.secondary, height: 1.6, fontSize: 12),
            ),
            const SizedBox(height: 12),
            SwitchListTile.adaptive(
              key: const Key('enable-wechat'),
              contentPadding: EdgeInsets.zero,
              title: const Text('同时收集指定微信群的作业通知'),
              subtitle: const Text('默认关闭。开启后仍只按你填写的群名称过滤，并需要 Android 系统通知授权。'),
              value: _wechatOptIn,
              onChanged: _monitorBusy
                  ? null
                  : (value) => setState(() => _wechatOptIn = value),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _groupsController,
              maxLines: 2,
              maxLength: 250,
              decoration: const InputDecoration(
                labelText: '指定群名称关键词（每行一个）',
                hintText: '例如：高一13班作业通知群',
                border: OutlineInputBorder(),
              ),
            ),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton(
                  onPressed: _monitorBusy ? null : () => _setMonitor(true),
                  child: const Text('保存并开启监测'),
                ),
                OutlinedButton(
                  onPressed: _monitorBusy ? null : () => _setMonitor(false),
                  child: const Text('关闭监测'),
                ),
                OutlinedButton(
                  onPressed: () async {
                    await MessageIntakeBridge.notificationSettings();
                    await _refreshIncoming();
                  },
                  child: const Text('打开系统通知授权'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                icon: const Icon(Icons.delete_outline_rounded, size: 17),
                label: const Text('清空本机待审核消息'),
                onPressed: () async {
                  final ok = await showDialog<bool>(
                    context: context,
                    builder: (dialog) => AlertDialog(
                      title: const Text('清空消息队列？'),
                      content: const Text(
                        '这会删除 HAIZ 本机收件箱里尚未审核的消息和重复消息记录，不会删除已经保存的待办。',
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(dialog, false),
                          child: const Text('取消'),
                        ),
                        FilledButton(
                          onPressed: () => Navigator.pop(dialog, true),
                          child: const Text('确认清空'),
                        ),
                      ],
                    ),
                  );
                  if (ok != true) return;
                  try {
                    await MessageIntakeBridge.clear();
                    _currentIncomingId = null;
                    await _refreshIncoming();
                  } catch (_) {
                    if (mounted) {
                      setState(() => _notice = '清空失败，请重试。');
                    }
                  }
                },
              ),
            ),
            if (_monitor?.enabled == true && _monitor?.granted != true)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  '系统尚未授权 HAIZ 读取通知。仅在你授权后才可能接收。',
                  style: TextStyle(color: p.accent, fontSize: 11),
                ),
              ),
          ],
        ),
      ],
    );
  }

  Widget _line(
    BuildContext ctx,
    IconData icon,
    String title,
    String description,
  ) {
    final p = PocketSkin.of(ctx).colors;
    return Row(
      children: [
        Icon(icon, color: p.accent, size: 20),
        const SizedBox(width: 13),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  color: p.foreground,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                description,
                style: TextStyle(
                  color: p.secondary,
                  fontSize: 11,
                  height: 1.45,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
