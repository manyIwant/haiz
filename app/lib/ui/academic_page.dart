import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../core/academic_session.dart';
import '../core/pocket_store.dart';
import 'kit.dart';

/// Native App client for a self-hosted HAIZ Academic deployment.
/// Verified identity decides the account namespace; credentials stay in memory.
class AcademicPage extends StatefulWidget {
  final PocketStore store;
  final AcademicSession session;
  final VoidCallback onBack;

  const AcademicPage({
    super.key,
    required this.store,
    required this.session,
    required this.onBack,
  });

  @override
  State<AcademicPage> createState() => _AcademicPageState();
}

class _AcademicPageState extends State<AcademicPage> {
  final _server = TextEditingController();
  final _login = TextEditingController();
  final _password = TextEditingController();
  String? _message;

  @override
  void dispose() {
    _server.dispose();
    _login.dispose();
    _password.dispose();
    super.dispose();
  }

  AcademicSession get session => widget.session;

  Future<void> _signIn() async {
    if (kIsWeb) {
      setState(() => _message = '网页版请直接使用 HAIZ Academic 的浏览器登录界面。');
      return;
    }
    setState(() => _message = null);
    await session.login(_server.text, _login.text, _password.text);
    if (!mounted) return;
    _password.clear();
    setState(() => _message = session.error);
  }

  Future<void> _refresh() async {
    await session.refresh();
    if (mounted) setState(() => _message = session.error);
  }

  Future<void> _refreshWith(String? value) async {
    await session.refresh(classId: value);
    if (mounted) setState(() => _message = session.error);
  }

  Future<void> _logout() async {
    await session.logout();
    if (!mounted) return;
    _password.clear();
    setState(() => _message = session.error);
  }

  Future<void> _importAssignment(Map<String, dynamic> item) async {
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: const Text('核对后加入我的待办'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item['subject']?.toString() ?? '其他'),
              const SizedBox(height: 9),
              SelectableText(item['title']?.toString() ?? ''),
              const SizedBox(height: 9),
              Text('截止：${item['due']?.toString() ?? '未指定'}'),
              const SizedBox(height: 9),
              const Text('这只是加入个人待办，不代表已提交作业。老师后续修改不会覆盖你的私人笔记。'),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialog, true),
            child: const Text('确认导入'),
          ),
        ],
      ),
    );
    if (accepted != true || !mounted) return;
    await session.importAssignment(item);
    if (!mounted) return;
    setState(() => _message = session.error ?? '已添加到所属账号的个人待办。');
  }

  Future<void> _importLegacy() async {
    // The confirmation belongs to the account that is open when the dialog
    // appears. Capture it here and re-check afterwards: a dialog that is still
    // on screen does not mean the session behind it is still the same.
    final generation = widget.store.generation;
    final namespace = widget.store.namespace;
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: const Text('升级前的本机记录'),
        content: const Text(
          '这些是升级前未按账号区分的任务、笔记和专注记录，目前只做只读备份。\n\n'
          '确认后才会并入当前已登录账号；其他账号不能认领。原始记录与备份都会保留。',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog, false),
            child: const Text('暂不导入'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialog, true),
            child: const Text('确认并入当前账号'),
          ),
        ],
      ),
    );
    if (accepted != true || !mounted) return;
    if (widget.store.generation != generation ||
        widget.store.namespace != namespace) {
      setState(
        () => _message = '确认期间已切换账号，旧记录未导入任何账号；归档仍完整保留。',
      );
      return;
    }
    try {
      await widget.store.importLegacyArchive(ownerConfirmed: true);
      if (!mounted) return;
      setState(() => _message = '旧记录已并入当前账号，原始记录与备份仍保留。');
    } catch (_) {
      if (!mounted) return;
      setState(
        () => _message = widget.store.storageError ?? '旧记录未导入；归档仍完整保留。',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
    final loggedIn = session.identity != null;
    final busy = session.busy;
    return SingleChildScrollView(
      key: const PageStorageKey('academic_scroll'),
      padding: const EdgeInsets.fromLTRB(23, 30, 23, 130),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 770),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextButton.icon(
                onPressed: widget.onBack,
                icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 14),
                label: const Text('返回探索'),
              ),
              const SizedBox(height: 15),
              const Eyebrow('HAIZ ACADEMIC / AUTHORIZED CLASSES'),
              const SizedBox(height: 21),
              const PageTitle(
                title: '班级里的每一件事。',
                subtitle: '教师发布，学生自愿确认后加入个人待办。学校正式账号接口需要授权。',
              ),
              const SizedBox(height: 20),
              if (widget.store.storageError != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(
                    widget.store.storageError!,
                    style: TextStyle(color: p.secondary, fontSize: 12),
                  ),
                ),
              if (!loggedIn)
                PocketCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SectionLabel('连接自建班级服务'),
                      const SizedBox(height: 8),
                      Text(
                        '只连接你信任的 HAIZ 服务端。正式环境须使用 HTTPS。'
                        '服务器须支持 v1.4 已验证身份契约；凭据不在本机持久化。',
                        style: TextStyle(color: p.secondary, fontSize: 12, height: 1.6),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _server,
                        keyboardType: TextInputType.url,
                        decoration: const InputDecoration(
                          labelText: '服务地址',
                          hintText: 'https://academic.example.com',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _login,
                        decoration: const InputDecoration(labelText: 'HAIZ 账号'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _password,
                        obscureText: true,
                        decoration: const InputDecoration(labelText: '密码'),
                      ),
                      const SizedBox(height: 15),
                      FilledButton.icon(
                        onPressed: busy ? null : _signIn,
                        icon: const Icon(Icons.cloud_done_outlined),
                        label: const Text('登录并读取班级任务'),
                      ),
                    ],
                  ),
                ),
              if (loggedIn)
                PocketCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Expanded(child: SectionLabel('班级任务')),
                          TextButton(
                            onPressed: busy ? null : _refresh,
                            child: const Text('刷新'),
                          ),
                          TextButton(
                            onPressed: busy ? null : _logout,
                            child: const Text('退出'),
                          ),
                        ],
                      ),
                      Text(
                        '当前账号：${session.userId ?? ''} · ${session.origin ?? ''}',
                        style: TextStyle(color: p.secondary, fontSize: 11),
                      ),
                      const SizedBox(height: 8),
                      if (session.classes.isNotEmpty)
                        DropdownButton<String>(
                          isExpanded: true,
                          value: session.selectedClass,
                          items: [
                            for (final c in session.classes)
                              DropdownMenuItem<String>(
                                value: c['id']?.toString(),
                                child: Text(
                                  c['title']?.toString() ?? '班级',
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                          ],
                          onChanged: busy ? null : _refreshWith,
                        ),
                      if (session.classes.isEmpty)
                        const Text('还没有班级，请先在 Web 管理台申请或创建班级。'),
                      if (session.classes.any(
                        (c) => c['id'] == session.selectedClass &&
                            c['status'] == 'pending',
                      ))
                        const Text('班级加入申请待教师核准。'),
                      const SizedBox(height: 9),
                      for (final item in session.assignments) ...[
                        const Divider(height: 20),
                        Text(
                          '${item['subject']?.toString() ?? '课程'} · '
                          '${item['title']?.toString() ?? '任务'}',
                          style: TextStyle(
                            color: p.foreground,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '截止：${item['due']?.toString() ?? '未指定'}',
                          style: TextStyle(color: p.secondary, fontSize: 12),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 5,
                          children: [
                            OutlinedButton(
                              onPressed: busy ? null : () => _importAssignment(item),
                              child: const Text('核对后加入个人任务'),
                            ),
                            if (item['viewed'] != true)
                              TextButton(
                                onPressed: busy
                                    ? null
                                    : () async {
                                        await session.markViewed(item);
                                        if (mounted) {
                                          setState(() => _message = session.error);
                                        }
                                      },
                                child: const Text('标记已查看'),
                              ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              if (loggedIn &&
                  widget.store.legacyArchiveAvailable &&
                  !widget.store.legacyImported)
                Padding(
                  padding: const EdgeInsets.only(top: 14),
                  child: PocketCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SectionLabel('升级前的本机记录'),
                        const SizedBox(height: 8),
                        Text(
                          '检测到升级前未按账号区分的本机记录，已逐字节备份。'
                          '历史上可能属于多人，不会自动显示或删除。',
                          style: TextStyle(color: p.secondary, fontSize: 12, height: 1.6),
                        ),
                        const SizedBox(height: 10),
                        OutlinedButton(
                          onPressed: busy ? null : _importLegacy,
                          child: const Text('确认并入当前账号'),
                        ),
                      ],
                    ),
                  ),
                ),
              if (_message != null)
                Padding(
                  padding: const EdgeInsets.only(top: 15),
                  child: Text(
                    _message!,
                    style: TextStyle(color: p.secondary, fontSize: 12),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
