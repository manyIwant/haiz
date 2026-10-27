// ignore_for_file: prefer_interpolation_to_compose_strings
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../core/pocket_store.dart';
import 'kit.dart';

/// Native App client for a self-hosted HAIZ Academic deployment.
/// No school account keys or passwords are written to local storage.
/// Tasks enter PocketStore only when the student confirms each import.
class AcademicPage extends StatefulWidget {
  final PocketStore store;
  final VoidCallback onBack;

  const AcademicPage({super.key, required this.store, required this.onBack});

  @override
  State<AcademicPage> createState() => _AcademicPageState();
}

class _AcademicPageState extends State<AcademicPage> {
  final _server = TextEditingController();
  final _login = TextEditingController();
  final _password = TextEditingController();
  final _client = http.Client();
  String? _session;
  String? _apiBase;
  String? _role;
  String? _message;
  bool _busy = false;
  List<Map<String, dynamic>> _assignments = [];
  List<Map<String, dynamic>> _classes = [];
  String? _selectedClass;

  @override
  void dispose() {
    _server.dispose();
    _login.dispose();
    _password.dispose();
    _client.close();
    super.dispose();
  }

  Future<Map<String, dynamic>> _call(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final base = _apiBase;
    if (base == null) throw StateError('尚未连接');
    final headers = <String, String>{'Accept': 'application/json'};
    if (body != null) headers['Content-Type'] = 'application/json';
    if (_session != null) headers['Cookie'] = _session!;
    final response = body == null
        ? await _client.get(Uri.parse(base + path), headers: headers)
        : await _client.post(
            Uri.parse(base + path),
            headers: headers,
            body: jsonEncode(body),
          );
    final cookie = response.headers['set-cookie'];
    if (cookie != null && cookie.startsWith('hsid=')) {
      _session = cookie.split(';').first;
    }
    final json = jsonDecode(utf8.decode(response.bodyBytes));
    if (json is! Map) throw StateError('服务器响应无效');
    final map = Map<String, dynamic>.from(json);
    if (response.statusCode >= 400) {
      throw StateError(map['error']?.toString() ?? '请求未成功');
    }
    return map;
  }

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await action();
    } catch (error) {
      if (mounted) {
        setState(
          () => _message = error.toString().replaceFirst('Bad state: ', ''),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _connect() async {
    if (kIsWeb) {
      throw StateError('网页版请直接使用 HAIZ Academic 的浏览器登录界面。');
    }
    final uri = Uri.tryParse(_server.text.trim());
    if (uri == null ||
        uri.host.isEmpty ||
        !(uri.scheme == 'https' ||
            (uri.scheme == 'http' &&
                (uri.host == 'localhost' || uri.host == '127.0.0.1')))) {
      throw StateError('远程教务服务必须提供 HTTPS 地址。本机开发可使用 localhost。');
    }
    if (uri.userInfo.isNotEmpty ||
        uri.query.isNotEmpty ||
        uri.fragment.isNotEmpty) {
      throw StateError('请输入纯服务器地址，不要附带账号信息。');
    }
    _apiBase = uri.toString().replaceAll(RegExp(r'/$'), '') + '/api';
    final result = await _call(
      '/auth/login',
      body: {'login': _login.text.trim(), 'password': _password.text},
    );
    _password.clear();
    _role = (result['user'] as Map)['role']?.toString();
    await _refresh();
  }

  Future<void> _refresh() async {
    final data = await _call('/classes');
    final classes = (data['classes'] as List)
        .map((a) => Map<String, dynamic>.from(a as Map))
        .toList();
    String? selected = _selectedClass;
    if (selected == null || !classes.any((c) => c['id'] == selected)) {
      selected = classes.isNotEmpty ? classes.first['id']?.toString() : null;
    }
    List<Map<String, dynamic>> assignments = [];
    if (_role == 'student') {
      final received = await _call('/my/assignments');
      assignments = (received['assignments'] as List)
          .map((a) => Map<String, dynamic>.from(a as Map))
          .where((a) => a['classId'] == selected)
          .toList();
    } else if (selected != null) {
      final received = await _call('/classes/' + selected + '/assignments');
      assignments = (received['assignments'] as List)
          .map((a) => Map<String, dynamic>.from(a as Map))
          .toList();
    }
    if (mounted) {
      setState(() {
        _classes = classes;
        _selectedClass = selected;
        _assignments = assignments;
      });
    }
  }

  Future<void> _import(Map<String, dynamic> item) async {
    final identifier = item['id']?.toString() ?? '';
    final title = item['title']?.toString() ?? '';
    if (identifier.isEmpty || title.isEmpty) return;
    final origin = 'HAIZ Academic · ' + identifier;
    if (widget.store.tasks.any((t) => t.source == origin)) {
      setState(() => _message = '这项作业已经导入过，不会重复添加。');
      return;
    }
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
              SelectableText(title),
              const SizedBox(height: 9),
              Text('截止：' + (item['due']?.toString() ?? '未指定')),
              const SizedBox(height: 9),
              const Text('这只是加入个人待办，不代表已提交作业。'),
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
    DateTime? due;
    final value = item['due']?.toString();
    if (value != null) due = DateTime.tryParse(value);
    widget.store.addTask(
      title,
      item['subject']?.toString() ?? '其他',
      due: due,
      source: origin,
    );
    setState(() => _message = '已添加到个人待办。');
  }

  Future<void> _markViewed(Map<String, dynamic> item) async {
    final key = item['id']?.toString();
    if (key == null) return;
    await _call('/assignments/' + key + '/acknowledge', body: {});
    await _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final p = PocketSkin.of(context).colors;
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
              if (_role == null)
                PocketCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SectionLabel('连接自建班级服务'),
                      const SizedBox(height: 8),
                      Text(
                        '只连接你信任的 HAIZ 服务端。正式环境须使用 HTTPS。凭据不在本机持久化。',
                        style: TextStyle(
                          color: p.secondary,
                          fontSize: 12,
                          height: 1.6,
                        ),
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
                        onPressed: _busy ? null : () => _run(_connect),
                        icon: const Icon(Icons.cloud_done_outlined),
                        label: const Text('登录并读取班级任务'),
                      ),
                    ],
                  ),
                ),
              if (_role != null) ...[
                PocketCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Expanded(child: SectionLabel('班级任务')),
                          TextButton(
                            onPressed: _busy ? null : () => _run(_refresh),
                            child: const Text('刷新'),
                          ),
                          TextButton(
                            onPressed: () {
                              setState(() {
                                _session = null;
                                _apiBase = null;
                                _role = null;
                                _classes = [];
                                _assignments = [];
                                _selectedClass = null;
                              });
                            },
                            child: const Text('退出'),
                          ),
                        ],
                      ),
                      if (_classes.isNotEmpty)
                        DropdownButton<String>(
                          isExpanded: true,
                          value: _selectedClass,
                          items: [
                            for (final c in _classes)
                              DropdownMenuItem<String>(
                                value: c['id']?.toString(),
                                child: Text(
                                  c['title']?.toString() ?? '班级',
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                          ],
                          onChanged: (value) => _run(() async {
                            _selectedClass = value;
                            await _refresh();
                          }),
                        ),
                      if (_classes.isEmpty)
                        const Text('还没有班级，请先在 Web 管理台申请或创建班级。'),
                      if (_classes.any(
                        (c) =>
                            c['id'] == _selectedClass &&
                            c['status'] == 'pending',
                      ))
                        const Text('班级加入申请待教师核准。'),
                      const SizedBox(height: 9),
                      for (final item in _assignments) ...[
                        const Divider(height: 20),
                        Text(
                          (item['subject']?.toString() ?? '课程') +
                              ' · ' +
                              (item['title']?.toString() ?? '任务'),
                          style: TextStyle(
                            color: p.foreground,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '截止：' + (item['due']?.toString() ?? '未指定'),
                          style: TextStyle(color: p.secondary, fontSize: 12),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 5,
                          children: [
                            OutlinedButton(
                              onPressed: () => _import(item),
                              child: const Text('核对后加入个人任务'),
                            ),
                            if (_role == 'student' && item['viewed'] != true)
                              TextButton(
                                onPressed: _busy
                                    ? null
                                    : () => _run(() => _markViewed(item)),
                                child: const Text('标记已查看'),
                              ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
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
