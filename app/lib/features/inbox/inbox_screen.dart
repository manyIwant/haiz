import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/pocket_store.dart';
import '../../core/academic_session.dart';
import '../../design/components.dart';
import '../../design/theme.dart';
import '../../design/tokens.dart';
import '../../domain/notice_parser.dart';
import '../../domain/message_intake_bridge.dart';
import '../../domain/notice_import_service.dart';
import '../../domain/planning.dart' show dateLabel;
import '../sync/sync_banner.dart';

class _Draft {
  String title;
  String subject;
  DateTime? due;
  final String source;
  final String original;
  final bool ambiguous;
  bool selected = true;
  String get clientKey => noticeProposalKey(NoticeCandidate(
    title: title, subject: subject, due: due,
    source: source, original: original, ambiguous: ambiguous,
  ));
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

/// 收件: receive → extract → flag uncertainty → user confirms → task.
/// Nothing becomes a task, a memo or a class submission without an
/// explicit tap; the native message is removed only after the save is
/// confirmed on disk/cloud.
class InboxScreen extends StatefulWidget {
  final PocketStore store;
  final VoidCallback onSaved;
  final AcademicSession? session;
  const InboxScreen({super.key, required this.store, required this.onSaved, this.session, this.onCommitted});

  /// Called after confirmed candidates are saved, with where the confirm
  /// button is (global) and how many tasks were added, so the shell can show
  /// where they went.
  final void Function(Rect from, int count)? onCommitted;

  /// Device messages waiting for review, for the tab badge and 今天.
  /// Zero whenever the current principal has not unlocked the device queue.
  static final ValueNotifier<int> pendingBadge = ValueNotifier(0);

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> with WidgetsBindingObserver {
  late final _input = TextEditingController(text: widget.store.draft('inbox'));
  final _commitKey = GlobalKey();
  bool _showOriginal = false;
  final List<_Draft> _drafts = [];
  String? _notice;
  String _currentSource = '手动粘贴';
  bool _importing = false;
  bool _importCancelled = false;
  String _ocrStatus = '';
  Timer? _ocrStatusTimer;
  int _composeGeneration = 0;
  final _groupsController = TextEditingController();
  List<IncomingNotice> _incoming = const [];
  MonitorConfiguration? _monitor;
  WechatNotificationDiagnostics? _wechatDiagnostics;
  bool _groupsLoaded = false;
  bool _wechatOptIn = false;
  bool _monitorBusy = false;
  bool _monitorExpanded = false;
  bool _submittingClass = false;
  bool _aiPreprocessing = false;
  final Map<String, List<NoticeCandidate>> _aiResults = {};
  final Set<String> _aiSeen = {};
  String? _currentIncomingId;
  int? _deviceInboxApprovedGeneration;

  bool get _canReadDeviceInbox => !widget.store.isCloudAccount ||
      _deviceInboxApprovedGeneration == widget.store.generation;

  Future<void> _unlockDeviceInbox() async {
    final generation = widget.store.generation;
    final agreed = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: const Text('查看此设备的消息？'),
        content: const Text('本机通知与系统分享属于设备级队列，不按 HAIZ 账号自动分隔。'
            '仅在你本人管理的设备上继续；此操作不会把微信原文上传至云端。'
            '若多人共用设备，请先关闭通知监测并清理旧消息。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog, false),
              child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(dialog, true),
              child: const Text('确认查看本机消息')),
        ],
      ),
    );
    if (!mounted || !widget.store.isCloudAccount ||
        widget.store.generation != generation || agreed != true) {
      return;
    }
    setState(() => _deviceInboxApprovedGeneration = generation);
    await _refreshIncoming();
  }

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
    if (!_canReadDeviceInbox) {
      InboxScreen.pendingBadge.value = 0;
      if (mounted) {
        setState(() {
          _incoming = const [];
          _monitor = null;
          _wechatDiagnostics = null;
          _aiResults.clear();
          _aiSeen.clear();
        });
      }
      return;
    }
    if (!MessageIntakeBridge.available) return;
    final generation = widget.store.generation;
    try {
      final items = await MessageIntakeBridge.entries();
      final setting = await MessageIntakeBridge.configuration();
      WechatNotificationDiagnostics? diagnostic;
      if (MessageIntakeBridge.supportsNotificationMonitoring) {
        try {
          diagnostic = await MessageIntakeBridge.wechatDiagnostics();
        } catch (_) {
          // Keep the inbox working if a previous native bridge is installed.
        }
      }
      if (!mounted || widget.store.generation != generation ||
          !_canReadDeviceInbox) {
        return;
      }
      InboxScreen.pendingBadge.value = items.length;
      setState(() {
        _incoming = items;
        _monitor = setting;
        _wechatDiagnostics = diagnostic;
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
    if (!_canReadDeviceInbox) {
      if (mounted) setState(() => _notice = '请先确认此设备的本机消息访问权限。');
      return;
    }
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
      await _refreshIncoming();
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
    _ocrStatusTimer?.cancel();
    if (_importing) NoticeImportService.cancelImageOcr();
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
          ? '没有发现明确的作业要求。可以对照原文修改后重新识别，或保存为备忘。'
          : '仅根据文字规则生成候选；请核对原文、科目和日期，确认后才保存。';
    });
  }

  Future<void> _importDocument() async {
    if (_importing) return;
    setState(() {
      _importing = true;
      _importCancelled = false;
      _ocrStatus = '';
    });
    final generation = widget.store.generation;
    _ocrStatusTimer?.cancel();
    _ocrStatusTimer = Timer.periodic(const Duration(milliseconds: 400), (_) {
      if (!mounted || !_importing) return;
      final status = NoticeImportService.webOcrStatus();
      if (status != _ocrStatus) setState(() => _ocrStatus = status);
    });
    try {
      final result = await NoticeImportService.pickAndExtract();
      if (result == null || !mounted || _importCancelled) return;
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
      if (mounted) {
        setState(() => _notice = _importCancelled
            ? '已取消本次图片识别，没有保存任何任务。'
            : '导入未成功：$error。可复制文档文字后手动粘贴。');
      }
    } finally {
      _ocrStatusTimer?.cancel();
      _ocrStatusTimer = null;
      if (mounted) {
        setState(() {
          _importing = false;
          _ocrStatus = '';
        });
      }
    }
  }

  void _cancelImport() {
    if (!_importing) return;
    _importCancelled = true;
    NoticeImportService.cancelImageOcr();
    setState(() => _notice = '已请求取消识别，现有任务不会被更改。');
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
        // Cloud snapshots contain only the reviewed task fields. Never send
        // private chat text or conversation titles through task provenance.
        source: widget.store.isCloudAccount
            ? '本机消息（已确认）'
            : '导入 · $_currentSource',
        originalNotice: widget.store.isCloudAccount ? '' : draft.original,
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
    if (imported == null) {
      _input.clear();
      widget.store.setDraft('inbox', '');
    }
    setState(() {
      _drafts.clear();
      _notice = added == selected.length
          ? '已加入 $added 项任务。'
          : '已加入 $added 项任务；${selected.length - added} 项与现有任务相同，已跳过。';
    });
    if (added > 0) {
      final box = _commitKey.currentContext?.findRenderObject() as RenderBox?;
      if (box != null && box.attached && box.hasSize) {
        widget.onCommitted?.call(box.localToGlobal(Offset.zero) & box.size, added);
      }
      widget.onSaved();
    }
  }

  void _saveAsMemo() {
    final text = _input.text.trim();
    if (text.isEmpty) return;
    if (widget.store.generation != _composeGeneration && _drafts.isNotEmpty) return;
    final id = widget.store.addNote(text);
    if (id == null) {
      setState(() => _notice = widget.store.storageError ?? '没有保存，当前记录暂不可写入。');
      return;
    }
    final ticket = widget.store.generation;
    _input.clear();
    widget.store.setDraft('inbox', '');
    setState(() {
      _drafts.clear();
      _notice = null;
    });
    showToast(context, '已保存为备忘，可在「待办 · 备忘」查看', action: '撤销', onAction: () {
      if (widget.store.generation == ticket) widget.store.deleteNote(id);
    });
  }

  String _ago(DateTime t) {
    final d = DateTime.now().difference(t);
    if (d.inMinutes < 1) return '刚刚';
    if (d.inMinutes < 60) return '${d.inMinutes} 分钟前';
    if (d.inHours < 24) return '${d.inHours} 小时前';
    return dateLabel(t, DateTime.now());
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final session = widget.session;
    final classMember = session?.identity != null && session?.role == 'student' &&
        session?.selectedClass != null;
    final selected = _drafts.where((d) => d.selected).length;
    return HaizPage(
      storageKey: 'inbox',
      title: '收件',
      subtitle: Text(
        MessageIntakeBridge.supportsNotificationMonitoring
            ? '班群通知、分享的文字和截图先到这里，你确认后才变成任务。'
            : MessageIntakeBridge.available
                ? '从其他应用分享到 HAIZ 的文字会到这里，你确认后才变成任务。'
                : '粘贴班级通知，或导入截图、PDF、Word。',
        style: TypeScale.footnote(c.ink2),
      ),
      actions: [
        if (MessageIntakeBridge.available && _canReadDeviceInbox)
          BarAction(icon: Icons.refresh_rounded, label: '刷新消息', onTap: _refreshIncoming),
      ],
      slivers: [
        SliverToBoxAdapter(child: SyncBanner(store: widget.store)),
        if (classMember)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(Space.gutter - 4, 8, Space.gutter - 8, 0),
              child: SwitchListTile.adaptive(
                key: const Key('ai-semantic-opt-in'),
                contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                title: Text('AI 理解班群作业', style: TypeScale.callout(c.ink)),
                subtitle: Text('默认关闭。开启后，指定群的待审消息经基础脱敏后发送给 HAIZ 配置的模型；结果仍需你确认。',
                    style: TypeScale.caption(c.ink2)),
                value: widget.store.semanticExtractionConsent,
                onChanged: _setAiConsent,
              ),
            ),
          ),
        SliverToBoxAdapter(child: _queueSection(context)),
        SliverToBoxAdapter(child: _composeSection(context)),
        if (_notice != null)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(Space.gutter, 4, Space.gutter, 4),
              child: Text(_notice!, key: const Key('inbox-notice'), style: TypeScale.footnote(c.ink2)),
            ),
          ),
        if (_drafts.isNotEmpty)
          SliverToBoxAdapter(child: _reviewSection(context, selected, classMember)),
        if (_drafts.isEmpty && _input.text.trim().isNotEmpty && _composeGeneration == widget.store.generation &&
            _notice != null && _notice!.startsWith('没有发现'))
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(Space.gutter - 6, 0, Space.gutter, 0),
              child: Wrap(spacing: 4, children: [
                LinkAction('保存为备忘', icon: Icons.sticky_note_2_outlined, onTap: _saveAsMemo),
              ]),
            ),
          ),
        if (MessageIntakeBridge.supportsNotificationMonitoring && _canReadDeviceInbox)
          SliverToBoxAdapter(child: _monitorSection(context)),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(Space.gutter, 26, Space.gutter, 0),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('数据去向', style: TypeScale.label(c.ink2)),
              const SizedBox(height: 6),
              for (final line in [
                '文字识别、截图 OCR 和文档读取都在这台设备上完成，原文不会上传。',
                '识别结果只是候选：日期或说法不确定的会标出来，加入前可以逐项修改。',
                if (MessageIntakeBridge.supportsNotificationMonitoring)
                  'Android 只处理你授权、且群名匹配的可见通知；不登录微信，不读取聊天记录。',
                if (widget.store.isCloudAccount)
                  '登录账号时，任务只保存确认后的标题、科目和日期，不保存聊天原文。',
              ])
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text('· $line', style: TypeScale.caption(c.ink3)),
                ),
            ]),
          ),
        ),
      ],
    );
  }

  Widget _queueSection(BuildContext context) {
    final c = context.c;
    if (!MessageIntakeBridge.available) return const SizedBox.shrink();
    if (!_canReadDeviceInbox) {
      return HaizBanner(
        icon: Icons.phonelink_lock_outlined,
        message: '这台设备收到的消息不按 HAIZ 账号分隔。为免在共用设备上看到别人的通知，请确认这是你本人管理的设备。',
        actions: [
          LinkAction('查看本机待审核消息', key: const Key('unlock-cloud-device-inbox'), onTap: _unlockDeviceInbox),
        ],
      );
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionHeader('待处理', count: _incoming.length,
          trailing: Text('${_incoming.length} 条待审阅', style: TypeScale.caption(c.ink3))),
      if (_incoming.isEmpty)
        Padding(
          padding: const EdgeInsets.fromLTRB(Space.gutter, 4, Space.gutter, 6),
          child: Text(
            MessageIntakeBridge.supportsNotificationMonitoring
                ? (_monitor?.enabled == true ? '暂时没有新消息。' : '暂时没有新消息。可以在下方「自动收集班群通知」里开启。')
                : '暂时没有分享过来的内容。在其他应用里选「分享 → HAIZ」即可。',
            style: TypeScale.footnote(c.ink3),
          ),
        ),
      for (final message in _incoming) ...[
        Padding(
          padding: const EdgeInsets.fromLTRB(Space.gutter, 10, Space.gutter, 6),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(message.title.isEmpty ? message.source : '${message.source} · ${message.title}',
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: TypeScale.caption(c.ink2).copyWith(fontWeight: FontWeight.w600))),
              Text(_ago(message.receivedAt), style: TypeScale.caption(c.ink3)),
            ]),
            const SizedBox(height: 4),
            Text(message.text, maxLines: 3, overflow: TextOverflow.ellipsis, style: TypeScale.callout(c.ink)),
            if (_aiResults.containsKey(message.id)) ...[
              const SizedBox(height: 4),
              Text(_aiResults[message.id]!.isEmpty
                  ? 'AI 预读：没有发现明确的作业'
                  : 'AI 预读：发现 ${_aiResults[message.id]!.length} 项候选，待你核对',
                  style: TypeScale.caption(c.amber)),
            ],
            const SizedBox(height: 8),
            Row(children: [
              HaizButton(label: '提取并审核', dense: true, kind: HaizButtonKind.secondary,
                  onPressed: () {
                    _reviewIncoming(message);
                    setState(() => _showOriginal = false);
                  }),
              const SizedBox(width: 6),
              LinkAction('忽略', color: c.ink2, onTap: () => _dismissIncoming(message)),
            ]),
          ]),
        ),
        const Hairline(indent: Space.gutter),
      ],
    ]);
  }

  Widget _composeSection(BuildContext context) {
    final c = context.c;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Space.gutter, 18, Space.gutter, 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(MessageIntakeBridge.available ? '粘贴或导入' : '粘贴通知或导入文件', style: TypeScale.label(c.ink2)),
        const SizedBox(height: 8),
        TextField(
          key: const Key('inbox-text'),
          controller: _input,
          minLines: 3,
          maxLines: 8,
          style: TypeScale.callout(c.ink),
          decoration: const InputDecoration(hintText: '例如：数学明天交练习册第36–39页。物理后天交实验报告。'),
          onChanged: (v) {
            widget.store.setDraft('inbox', v);
            setState(() {});
          },
        ),
        const SizedBox(height: 10),
        Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
          HaizButton(
            key: const Key('inbox-extract'),
            label: '识别',
            dense: true,
            icon: Icons.text_snippet_outlined,
            onPressed: () {
              if (_input.text.trim().isEmpty) {
                setState(() => _notice = '先在上面粘贴通知文字，或导入截图、文档。');
                return;
              }
              _currentIncomingId = null;
              _currentSource = '手动粘贴';
              _showOriginal = false;
              _extract();
            },
          ),
          HaizButton(
            key: const Key('inbox-import'),
            label: _importing ? '正在读取…' : '导入截图 / 文档',
            dense: true,
            kind: HaizButtonKind.secondary,
            icon: Icons.file_open_outlined,
            busy: _importing,
            onPressed: _importing ? null : _importDocument,
          ),
          if (_importing)
            LinkAction(_importCancelled ? '正在取消…' : '取消识别', key: const Key('cancel-screenshot-ocr'),
                onTap: _importCancelled ? null : _cancelImport),
          if (!_importing && _input.text.trim().isEmpty && _drafts.isEmpty)
            LinkAction('看一个例子', color: c.ink2, onTap: () {
              _currentIncomingId = null;
              _currentSource = '示例文字';
              _input.text = '数学明天交练习册第36-39页。\n物理后天提交实验报告。\n英语本周五背诵Unit 4单词。';
              _extract();
            }),
        ]),
        if (_importing && _ocrStatus.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(_ocrStatus, style: TypeScale.caption(c.ink3)),
          ),
      ]),
    );
  }

  Widget _reviewSection(BuildContext context, int selected, bool classMember) {
    final c = context.c;
    final original = _input.text.trim();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionHeader('等待你确认', count: _drafts.length,
          trailing: Text('已选 $selected 项', style: TypeScale.caption(c.ink3))),
      Padding(
        padding: const EdgeInsets.fromLTRB(Space.gutter, 0, Space.gutter, 4),
        child: Row(children: [
          Expanded(child: Text('来自 $_currentSource', style: TypeScale.caption(c.ink3), maxLines: 1, overflow: TextOverflow.ellipsis)),
          if (original.isNotEmpty)
            LinkAction(_showOriginal ? '收起原文' : '对照原文', color: c.ink2,
                onTap: () => setState(() => _showOriginal = !_showOriginal)),
        ]),
      ),
      AnimatedSize(
        duration: context.haiz.motion(Motion.base),
        curve: Motion.enter,
        alignment: Alignment.topCenter,
        child: !_showOriginal ? const SizedBox(width: double.infinity) : Container(
          margin: const EdgeInsets.fromLTRB(Space.gutter, 2, Space.gutter, 8),
          padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
          decoration: BoxDecoration(border: Border(left: BorderSide(color: c.ruleStrong, width: 2))),
          child: SelectableText(original, style: TypeScale.footnote(c.ink2)),
        ),
      ),
      for (final d in _drafts)
        Arrive(
          child: Pressable(
            onTap: () => setState(() => d.selected = !d.selected),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(8, 4, 8, 4),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Checkbox(value: d.selected, onChanged: (v) => setState(() => d.selected = v ?? false)),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 10, bottom: 8),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(d.title, style: TypeScale.body(d.selected ? c.ink : c.ink3)),
                      const SizedBox(height: 4),
                      Wrap(spacing: 10, runSpacing: 2, crossAxisAlignment: WrapCrossAlignment.center, children: [
                        SubjectMark(d.subject),
                        Text(d.due == null ? '日期待确认' : dateLabel(d.due!, DateTime.now()),
                            style: TypeScale.caption(d.due == null ? c.amber : c.ink2)
                                .copyWith(fontWeight: d.due == null ? FontWeight.w600 : FontWeight.w400)),
                      ]),
                      const SizedBox(height: 3),
                      Text(d.ambiguous ? '日期或说法不确定，请核对后再加入' : '按文字规则识别，不代表老师已确认',
                          style: TypeScale.caption(d.ambiguous ? c.amber : c.ink3)),
                    ]),
                  ),
                ),
                IconButton(tooltip: '修改候选', onPressed: () => _edit(d),
                    icon: Icon(Icons.edit_outlined, size: 19, color: c.ink2)),
              ]),
            ),
          ),
        ),
      Padding(
        padding: const EdgeInsets.fromLTRB(Space.gutter, 10, Space.gutter, 0),
        child: KeyedSubtree(
          key: _commitKey,
          child: HaizButton(
          key: const Key('inbox-commit'),
          label: selected == 0 ? '加入待办' : '加入待办（$selected 项）',
          icon: Icons.playlist_add_check_rounded,
          expand: true,
          onPressed: selected == 0 ? null : _commit,
        ),
        ),
      ),
      if (classMember) ...[
        Padding(
          padding: const EdgeInsets.fromLTRB(Space.gutter, 8, Space.gutter, 0),
          child: HaizButton(
            key: const Key('submit-mobile-suggestion'),
            label: _submittingClass ? '正在提交审核…' : '提交给班级审核',
            kind: HaizButtonKind.secondary,
            icon: Icons.cloud_upload_outlined,
            expand: true,
            busy: _submittingClass,
            onPressed: _submittingClass || selected == 0 ? null : _submitToClass,
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(Space.gutter, 6, Space.gutter, 0),
          child: Text('只提交你确认的科目、标题和日期，不含聊天原文；班级审核通过后其他同学才会看到。',
              style: TypeScale.caption(c.ink3)),
        ),
      ],
      Padding(
        padding: const EdgeInsets.fromLTRB(Space.gutter - 6, 6, Space.gutter, 0),
        child: Wrap(spacing: 4, children: [
          LinkAction('全部不要，保存为备忘', color: c.ink2, onTap: _input.text.trim().isEmpty ? null : _saveAsMemo),
          if (_currentIncomingId != null)
            LinkAction('忽略这条消息', color: c.ink2, onTap: () async {
              final entry = _incoming.where((e) => e.id == _currentIncomingId);
              if (entry.isNotEmpty) await _dismissIncoming(entry.first);
              if (!mounted) return;
              setState(() { _drafts.clear(); _currentIncomingId = null; _notice = '已忽略，没有创建任务。'; });
            }),
        ]),
      ),
    ]);
  }

  Widget _monitorSection(BuildContext context) {
    final c = context.c;
    final status = _monitor?.enabled == true
        ? (_monitor?.granted == true ? '已开启 · 只收指定群' : '已开启 · 等待系统通知授权')
        : '默认关闭 · 需要你明确开启';
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const SizedBox(height: 18),
      Pressable(
        key: const Key('monitor-settings-toggle'),
        onTap: () {
          setState(() => _monitorExpanded = !_monitorExpanded);
          if (_monitorExpanded) unawaited(_refreshIncoming());
        },
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Space.gutter, 12, Space.gutter - 4, 12),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('自动收集班群通知', style: TypeScale.callout(c.ink).copyWith(fontWeight: FontWeight.w600)),
                Text(status, style: TypeScale.caption(_monitor?.enabled == true && _monitor?.granted != true ? c.amber : c.ink2)),
              ]),
            ),
            AnimatedRotation(
              turns: _monitorExpanded ? .5 : 0,
              duration: context.haiz.motion(Motion.fast),
              child: Icon(Icons.keyboard_arrow_down_rounded, color: c.ink3),
            ),
          ]),
        ),
      ),
      // A local disclosure; no PageStorage (an invalid value in release mode
      // used to render a large grey ErrorWidget).
      AnimatedSize(
        alignment: Alignment.topCenter,
        curve: Motion.enter,
        duration: context.haiz.motion(Motion.base),
        child: !_monitorExpanded ? const SizedBox(width: double.infinity) : Padding(
          key: const Key('monitor-settings-panel'),
          padding: const EdgeInsets.fromLTRB(Space.gutter, 0, Space.gutter, 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('支持 QQ、TIM、钉钉、学习通；微信需要单独开启。只有通知标题、会话标题或副标题包含你填写的群名、'
                '且正文有作业类动词时才会收下。通知信息不能完全证明来自群聊，请填写足够独特的群名。'
                '看不到已隐藏的通知内容和历史消息，也不会上传消息。',
                style: TypeScale.caption(c.ink2)),
            const SizedBox(height: 10),
            TextField(
              key: const Key('monitor-groups-input'),
              controller: _groupsController,
              maxLines: 2,
              maxLength: 250,
              decoration: const InputDecoration(labelText: '群名关键词（每行一个）', hintText: '例如：高一13班作业通知群'),
            ),
            SwitchListTile.adaptive(
              key: const Key('enable-wechat'),
              contentPadding: EdgeInsets.zero,
              title: Text('同时收集指定微信群', style: TypeScale.callout(c.ink)),
              subtitle: Text('默认关闭。仍只按上面的群名过滤，并需要 Android 通知使用权。', style: TypeScale.caption(c.ink2)),
              value: _wechatOptIn,
              onChanged: _monitorBusy ? null : (value) => setState(() => _wechatOptIn = value),
            ),
            const SizedBox(height: 6),
            Wrap(spacing: 8, runSpacing: 8, children: [
              HaizButton(label: '保存并开启监测', dense: true, busy: _monitorBusy,
                  onPressed: _monitorBusy ? null : () => _setMonitor(true)),
              HaizButton(label: '关闭监测', dense: true, kind: HaizButtonKind.secondary,
                  onPressed: _monitorBusy ? null : () => _setMonitor(false)),
              HaizButton(label: '打开系统通知授权', dense: true, kind: HaizButtonKind.secondary, onPressed: () async {
                await MessageIntakeBridge.notificationSettings();
                await _refreshIncoming();
              }),
            ]),
            if (_monitor?.enabled == true && _monitor?.granted != true)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text('系统还没有授权 HAIZ 读取通知。授权后才可能收到。', style: TypeScale.caption(c.amber)),
              ),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: Text('微信接入诊断', style: TypeScale.label(c.ink2))),
              BarAction(key: const Key('wechat-diag-refresh'), icon: Icons.refresh_rounded,
                  label: '刷新微信接入诊断', onTap: _refreshIncoming),
            ]),
            Text(_wechatDiagnostics?.status(_monitor) ?? '设备诊断暂不可用',
                key: const Key('wechat-diag-status'), style: TypeScale.footnote(c.ink)),
            const SizedBox(height: 4),
            Text(
              '监听服务：${_wechatDiagnostics?.listenerConnected == true ? "已连接" : "未连接"}'
              ' · 微信通知：${_wechatDiagnostics?.observedCount ?? 0} 条'
              ' · 已入箱：${_wechatDiagnostics?.savedCount ?? 0} 条',
              key: const Key('wechat-diag-counts'),
              style: TypeScale.caption(c.ink2),
            ),
            Text(
              _wechatDiagnostics?.lastObservedAt == null
                  ? '暂无微信通知处理记录'
                  : '最近收到：${_wechatDiagnostics!.lastObservedAt!.toLocal()}',
              style: TypeScale.caption(c.ink3),
            ),
            const SizedBox(height: 4),
            Text('只在开启微信监测后记录处理原因、次数和时间；不保存被过滤通知的正文、群名、发送人，也不上传。',
                style: TypeScale.caption(c.ink3)),
            Wrap(spacing: 4, children: [
              LinkAction('清零诊断计数（不删除消息）', key: const Key('wechat-diag-reset'), color: c.ink2, onTap: () async {
                try {
                  await MessageIntakeBridge.resetWechatDiagnostics();
                  await _refreshIncoming();
                } catch (_) {
                  if (mounted) setState(() => _notice = '清零诊断计数失败，请重试。');
                }
              }),
              LinkAction('清空本机待审核消息', color: c.late, onTap: () async {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (dialog) => AlertDialog(
                    title: const Text('清空消息队列？'),
                    content: const Text('会删除 HAIZ 本机收件里尚未审核的消息和重复记录，不会删除已经保存的任务。'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(dialog, false), child: const Text('取消')),
                      FilledButton(onPressed: () => Navigator.pop(dialog, true), child: const Text('确认清空')),
                    ],
                  ),
                );
                if (ok != true) return;
                try {
                  await MessageIntakeBridge.clear();
                  _currentIncomingId = null;
                  await _refreshIncoming();
                } catch (_) {
                  if (mounted) setState(() => _notice = '清空失败，请重试。');
                }
              }),
            ]),
          ]),
        ),
      ),
    ]);
  }
}
