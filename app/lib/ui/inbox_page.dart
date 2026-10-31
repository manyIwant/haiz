import 'package:flutter/material.dart';

import '../core/pocket_store.dart';
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
  const InboxPage({super.key, required this.store, required this.onSaved});
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
  bool _monitorBusy = false;
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
    // Native notification/share queues are shared across the whole device;
    // never expose them as a particular signed-in user's private inbox.
    if (widget.store.isCloudAccount) {
      if (mounted) {
        setState(() {
          _incoming = const [];
          _monitor = null;
        });
      }
      return;
    }
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
          _groupsLoaded = true;
        }
      });
    } catch (_) {
      if (mounted) setState(() => _notice = '无法读取本地消息队列，请重试。');
    }
  }

  Future<void> _setMonitor(bool enabled) async {
    if (widget.store.isCloudAccount) {
      setState(() => _notice = '本机通知队列属于设备访客空间，云账号暂不读取该队列。');
      return;
    }
    if (_monitorBusy) return;
    setState(() => _monitorBusy = true);
    try {
      final setting = await MessageIntakeBridge.configure(
        enabled: enabled,
        groups: _groupsController.text,
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
              _nativeInboxSection(context),
              const SizedBox(height: 22),
              PocketCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionLabel('粘贴一段通知'),
                    const SizedBox(height: 8),
                    Text(
                      '从 QQ、钉钉、学习通等应用点「分享 → HAIZ」，可直接加入待审阅消息；也能手动粘贴、导入文档。',
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
                '无需登录消息平台。把群里的一段作业通知分享给 HAIZ，就会进入这里。',
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
              '只处理 QQ / TIM / 钉钉 / 学习通中，通知标题含下列群名称、正文含学习行动词的消息。'
              ' 不读私聊、不读历史消息、不上传内容；只是候选，须你确认才能加入待办。',
              style: TextStyle(color: p.secondary, height: 1.6, fontSize: 12),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _groupsController,
              maxLines: 2,
              maxLength: 250,
              decoration: const InputDecoration(
                labelText: '指定群名称关键词（每行一个）',
                hintText: '例如：某班作业通知群',
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
