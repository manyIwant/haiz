import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'pocket_store.dart';
import '../domain/notice_parser.dart';
import 'storage_scope.dart';

class _StaleSession implements Exception {}

class _ApiFailure implements Exception {
  const _ApiFailure(this.message, {this.revoked = false});
  final String message;
  final bool revoked;
  @override
  String toString() => message;
}

/// Owns native credentials independently of the currently visible page.
/// Personal records never enter the Academic write API.
class AcademicSession extends ChangeNotifier {
  AcademicSession(this._store, {http.Client Function()? clientFactory})
    : _clientFactory = clientFactory ?? http.Client.new;

  static const requestTimeout = Duration(seconds: 15);
  final PocketStore _store;
  final http.Client Function() _clientFactory;
  http.Client? _client;
  String? _cookie;
  String? _origin;
  Map<String, dynamic>? _identity;
  List<Map<String, dynamic>> _classes = const [];
  List<Map<String, dynamic>> _assignments = const [];
  String? _selectedClass;
  String? _error;
  bool _busy = false;
  bool _disposed = false;
  int _generation = 0;

  String? get role => _identity?['role'] as String?;
  String? get origin => _origin;
  String? get userId => _identity?['userId'] as String?;
  Map<String, dynamic>? get identity => _identity;
  List<Map<String, dynamic>> get classes => _classes;
  List<Map<String, dynamic>> get assignments => _assignments;
  String? get selectedClass => _selectedClass;
  String? get error => _error;
  bool get busy => _busy;
  int get generation => _generation;

  bool _current(int generation) => !_disposed && generation == _generation;
  void _check(int generation) {
    if (!_current(generation)) throw _StaleSession();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void _clearOfficial() {
    _classes = const [];
    _assignments = const [];
    _selectedClass = null;
  }

  int _close() {
    _generation++;
    _client?.close();
    _client = null;
    _cookie = null;
    _origin = null;
    _identity = null;
    _clearOfficial();
    _busy = false;
    _store.lock();
    return _generation;
  }

  Future<void> _guest(int generation) async {
    await _store.openGuest();
    _check(generation);
    if (_store.storageError != null || _store.namespace == null) {
      throw const _ApiFailure('访客数据暂不可读取。原记录已保留，请稍后重试。');
    }
  }

  Future<Map<String, dynamic>> _request(
    int generation,
    String path, {
    Map<String, dynamic>? body,
    bool acceptCookie = false,
    String? idempotencyKey,
  }) async {
    _check(generation);
    final client = _client;
    final origin = _origin;
    if (client == null || origin == null) throw const _ApiFailure('尚未连接。');
    final request = http.Request(
      body == null ? 'GET' : 'POST',
      Uri.parse('$origin/api$path'),
    )..followRedirects = false;
    request.headers['Accept'] = 'application/json';
    if (_cookie case final cookie?) request.headers['Cookie'] = cookie;
    if (body != null) {
      request.headers['Content-Type'] = 'application/json';
      request.body = jsonEncode(body);
    }
    if (idempotencyKey != null) {
      request.headers['Idempotency-Key'] = idempotencyKey;
    }
    final response = await (() async {
      final streamed = await client.send(request);
      return http.Response.fromStream(streamed);
    })().timeout(requestTimeout);
    _check(generation);
    return _decodeResponse(response, acceptCookie: acceptCookie);
  }

  Map<String, dynamic> _decodeResponse(
    http.Response response, {
    required bool acceptCookie,
  }) {
    if (response.statusCode >= 300 && response.statusCode < 400) {
      throw const _ApiFailure('服务地址发生重定向，请核实地址后重新登录。', revoked: true);
    }
    if (response.statusCode == 401 || response.statusCode == 403) {
      throw const _ApiFailure('登录或班级权限已失效，请重新登录。', revoked: true);
    }
    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    if (decoded is! Map<String, dynamic>) {
      throw const FormatException('服务器响应格式无效。');
    }
    if (response.statusCode >= 400) {
      final revoked = decoded['state'] == 'Revoked';
      throw _ApiFailure(
        revoked ? '身份或班级权限已变化，请重新登录。' : '服务器暂未完成请求，请稍后重试。',
        revoked: revoked,
      );
    }
    if (acceptCookie) {
      final cookie = response.headers['set-cookie'];
      final match = cookie == null
          ? null
          : RegExp(r'(?:^|,\s*)hsid=([^;,\s]+)').firstMatch(cookie);
      if (match == null) {
        throw const _ApiFailure('服务器未提供有效登录会话。', revoked: true);
      }
      _cookie = 'hsid=${match.group(1)}';
    }
    return decoded;
  }

  Future<Map<String, dynamic>> _readIdentity(int generation) async {
    final response = await _request(generation, '/v1/identity');
    if (response['state'] != 'Synced' ||
        response['error'] != null ||
        response['data'] is! Map<String, dynamic>) {
      throw const FormatException('服务端尚未提供兼容的学生身份契约。');
    }
    return validateAcademicIdentity(response['data'] as Map<String, dynamic>);
  }

  Future<void> login(String server, String login, String password) async {
    final generation = _close();
    _error = null;
    _busy = true;
    _notify();
    try {
      await _guest(generation);
      _origin = normalizeAcademicOrigin(server);
      if (login.trim().isEmpty || password.isEmpty) {
        throw const FormatException('请输入账号和密码。');
      }
      _client = _clientFactory();
      final result = await _request(
        generation,
        '/auth/login',
        body: {'login': login.trim(), 'password': password},
        acceptCookie: true,
      );
      final identity = await _readIdentity(generation);
      _check(generation);
      final user = result['user'];
      if (user is! Map ||
          user['id'] != identity['userId'] ||
          user['role'] != 'student') {
        throw const FormatException('登录身份与服务器身份不一致，未打开个人数据。');
      }
      await _store.openAccount(origin: _origin!, identity: identity);
      _check(generation);
      if (_store.storageError != null ||
          _store.namespace != accountNamespace(_origin!, identity)) {
        throw const _ApiFailure('个人数据暂不可读取。原记录已保留，请稍后重试。', revoked: true);
      }
      _identity = identity;
      await _refresh(generation);
    } catch (error) {
      if (_current(generation)) await _fail(error, invalidate: true);
    } finally {
      if (_current(generation)) {
        _busy = false;
        _notify();
      }
    }
  }

  Future<void> _revalidate(int generation) async {
    final identity = await _readIdentity(generation);
    final previous = _identity;
    if (previous == null ||
        identity['userId'] != previous['userId'] ||
        identity['instanceId'] != previous['instanceId']) {
      throw const _ApiFailure('服务器身份已变化，请重新登录。', revoked: true);
    }
    final authorized = (identity['authorizedClassIds'] as List).toSet();
    _classes = List.unmodifiable(
      _classes.where((item) => authorized.contains(item['id'])),
    );
    _assignments = List.unmodifiable(
      _assignments.where((item) => authorized.contains(item['classId'])),
    );
    _identity = identity;
  }

  List<Map<String, dynamic>> _records(
    Map<String, dynamic> response,
    String field,
  ) {
    final values = response[field];
    if (values is! List ||
        values.any((value) => value is! Map<String, dynamic>)) {
      throw const FormatException('服务器列表格式无效。');
    }
    return values
        .map(
          (value) =>
              Map<String, dynamic>.unmodifiable(value as Map<String, dynamic>),
        )
        .toList(growable: false);
  }

  Future<void> _refresh(int generation, {String? classId}) async {
    await _revalidate(generation);
    final classData = await _request(generation, '/classes');
    final assignmentData = await _request(generation, '/my/assignments');
    await _revalidate(generation);
    final authorized = (_identity!['authorizedClassIds'] as List).toSet();
    final classes = _records(
      classData,
      'classes',
    ).where((item) => authorized.contains(item['id'])).toList(growable: false);
    final selected = classId ?? _selectedClass;
    _selectedClass = classes.any((item) => item['id'] == selected)
        ? selected
        : classes.firstOrNull?['id'] as String?;
    _classes = List.unmodifiable(classes);
    _assignments = List.unmodifiable(
      _records(assignmentData, 'assignments').where(
        (item) =>
            authorized.contains(item['classId']) &&
            item['classId'] == _selectedClass,
      ),
    );
  }

  Future<void> refresh({String? classId}) async {
    if (_busy || _identity == null) return;
    final generation = _generation;
    _busy = true;
    _error = null;
    _assignments = const [];
    _notify();
    try {
      await _refresh(generation, classId: classId);
    } catch (error) {
      if (_current(generation)) await _fail(error);
    } finally {
      if (_current(generation)) {
        _busy = false;
        _notify();
      }
    }
  }

  Future<void> _fail(Object error, {bool invalidate = false}) async {
    if (error is _StaleSession || _disposed) return;
    final message = error is FormatException
        ? error.message
        : error is _ApiFailure
        ? error.message
        : '连接暂不可用。个人记录仍保留在所属账号，请重试。';
    _clearOfficial();
    if (invalidate ||
        error is FormatException ||
        (error is _ApiFailure && error.revoked)) {
      final generation = _close();
      try {
        await _guest(generation);
      } catch (failure) {
        if (_current(generation)) _error = '本地数据暂不可读取，原记录已保留。';
      }
      if (!_current(generation)) return;
    }
    _error ??= message;
    _busy = false;
    _notify();
  }

  /// AI parsing is opt-in and transient; it never writes tasks or posts them
  /// to a class. Server administrator must separately configure a trusted model.
  Future<List<NoticeCandidate>?> extractSemanticNotice({
    required String text,
    required DateTime capturedAt,
  }) async {
    if (_busy || _identity == null || role != 'student' ||
        !_store.semanticExtractionConsent) { return null; }
    final generation = _generation;
    _busy = true;
    _error = null;
    _notify();
    try {
      if (text.trim().length < 5 || text.length > 2800) {
        throw const FormatException('通知长度不适合智能解析。');
      }
      await _revalidate(generation);
      final json = await _request(generation, '/ai/extract', body: {
        'message': text,
        'capturedAt': capturedAt.toUtc().toIso8601String(),
        'consent': true,
      });
      _check(generation);
      if (json['reviewRequired'] != true || json['items'] is! List) {
        throw const FormatException('智能解析结果尚未通过结构校验。');
      }
      final items = <NoticeCandidate>[];
      for (final entry in json['items'] as List) {
        if (entry is! Map) continue;
        final title = entry['title'];
        final subject = entry['subject'];
        final evidence = entry['evidence'];
        if (title is! String || title.trim().isEmpty || title.length > 140 ||
            subject is! String || subject.trim().isEmpty ||
            evidence is! String || evidence.trim().isEmpty) { continue; }
        final dueValue = entry['due'];
        final due = dueValue is String ? DateTime.tryParse(dueValue) : null;
        items.add(NoticeCandidate(
          title: title.trim(),
          subject: subject.trim(),
          due: due,
          source: 'AI 语义解析 · 尚未核实',
          original: evidence,
          ambiguous: entry['ambiguous'] == true || due == null,
        ));
      }
      return items.take(8).toList(growable: false);
    } catch (error) {
      if (_current(generation)) {
        if (error is _ApiFailure && error.revoked) {
          await _fail(error);
        } else {
          _error = error is FormatException
              ? error.message : '智能解析暂不可用；已保留本机规则候选。请检查 AI 服务配置或网络。';
          _notify();
        }
      }
      return null;
    } finally {
      if (_current(generation)) {
        _busy = false;
        _notify();
      }
    }
  }

  /// Submit only user-reviewed task fields. No raw notification or sender data.
  /// Teacher permission is required separately to publish class assignments.
  Future<bool> submitClassSuggestion({
    required String title,
    required String subject,
    required String clientKey,
    String? due,
  }) async {
    if (_busy || _identity == null || role != 'student') return false;
    final classId = _selectedClass;
    if (classId == null ||
        !_classes.any((c) => c['id'] == classId && c['status'] == 'active')) {
      _error = '请先登录 HAIZ Academic 并加入已核准的班级。';
      _notify();
      return false;
    }
    final generation = _generation;
    _busy = true;
    _error = null;
    _notify();
    try {
      if (title.trim().isEmpty ||
          title.length > 140 ||
          subject.trim().isEmpty ||
          subject.length > 32 ||
          !RegExp(r'^[A-Za-z0-9_-]{8,100}$').hasMatch(clientKey)) {
        throw const FormatException('候选任务格式不正确，请核对标题、科目。');
      }
      await _revalidate(generation);
      _check(generation);
      final authorized = (_identity!['authorizedClassIds'] as List).contains(classId);
      if (!authorized ||
          !_classes.any((c) => c['id'] == classId && c['status'] == 'active')) {
        throw const _ApiFailure('班级权限已变化，不会上传候选。', revoked: true);
      }
      final result = await _request(
        generation,
        '/classes/$classId/mobile-suggestions',
        body: {
          'title': title.trim(),
          'subject': subject.trim(),
          'due': due,
          'clientKey': clientKey,
        },
      );
      _check(generation);
      if (result['status'] != 'pending') {
        throw const FormatException('服务器没有确认待审核状态。');
      }
      return true;
    } catch (error) {
      if (_current(generation)) await _fail(error);
      return false;
    } finally {
      if (_current(generation)) {
        _busy = false;
        _notify();
      }
    }
  }

  Future<void> importAssignment(Map<String, dynamic> item) async {
    if (_busy || _identity == null) return;
    final generation = _generation;
    _busy = true;
    _error = null;
    _notify();
    try {
      await _revalidate(generation);
      final current = _assignments
          .where((record) => record['id'] == item['id'])
          .firstOrNull;
      if (current == null) throw const _ApiFailure('作业已不可访问，请刷新班级任务。');
      final id = current['id'];
      final title = current['title'];
      if (id is! String ||
          id.isEmpty ||
          title is! String ||
          title.trim().isEmpty) {
        throw const FormatException('作业内容无效。');
      }
      final source =
          'HAIZ Academic · ${accountNamespace(_origin!, _identity!)}/assignments/${Uri.encodeComponent(id)}';
      if (_store.tasks.any((task) => task.source == source)) return;
      _store.addTask(
        title,
        current['subject'] is String ? current['subject'] as String : '其他',
        due: DateTime.tryParse(current['due']?.toString() ?? ''),
        source: source,
      );
      await _store.flush();
      _check(generation);
      if (_store.storageError != null) {
        throw const _ApiFailure('个人任务未能保存，请保留原文并重试。');
      }
    } catch (error) {
      if (_current(generation)) await _fail(error);
    } finally {
      if (_current(generation)) {
        _busy = false;
        _notify();
      }
    }
  }

  /// Stable per (action, resource, version) so a network retry replays instead
  /// of recording the same view twice. The server accepts 8-100 characters of
  /// ASCII letters, digits, `_` and `-`, so the seed is reduced to that.
  static String _idempotencyKey(String action, String id, int version) {
    final seed = '$action-$id-$version'.replaceAll(
      RegExp('[^A-Za-z0-9_-]'),
      '-',
    );
    final key = 'haiz-$seed';
    return key.length <= 90 ? key : key.substring(0, 90);
  }

  Future<void> markViewed(Map<String, dynamic> item) async {
    if (_busy || _identity == null) return;
    final generation = _generation;
    _busy = true;
    _error = null;
    _notify();
    try {
      await _revalidate(generation);
      final current = _assignments
          .where((record) => record['id'] == item['id'])
          .firstOrNull;
      if (current == null || current['id'] is! String) {
        throw const _ApiFailure('作业已不可访问。');
      }
      // v1.4 binds an acknowledgement to the exact public version the student
      // saw, and expects an idempotency key so a retry cannot double-record it.
      final version = current['version'];
      if (version is! int || version < 1) {
        throw const FormatException('作业版本无效，无法标记已查看。');
      }
      final id = current['id'] as String;
      await _request(
        generation,
        '/v1/assignments/${Uri.encodeComponent(id)}/acknowledge',
        body: {'version': version},
        idempotencyKey: _idempotencyKey('ack', id, version),
      );
      await _refresh(generation);
    } catch (error) {
      if (_current(generation)) await _fail(error);
    } finally {
      if (_current(generation)) {
        _busy = false;
        _notify();
      }
    }
  }

  Future<void> logout() async {
    final oldOrigin = _origin;
    final oldCookie = _cookie;
    final generation = _close();
    _error = null;
    _notify();
    try {
      await _guest(generation);
      if (oldOrigin != null && oldCookie != null) {
        final client = _clientFactory();
        try {
          final request =
              http.Request('POST', Uri.parse('$oldOrigin/api/auth/logout'))
                ..followRedirects = false
                ..headers['Cookie'] = oldCookie;
          final response = await client
              .send(request)
              .timeout(const Duration(seconds: 3));
          await response.stream.drain<void>().timeout(
            const Duration(seconds: 3),
          );
          if (response.statusCode >= 400) {
            throw const _ApiFailure('服务器会话注销未确认，本机凭据已移除。');
          }
        } finally {
          client.close();
        }
      }
    } catch (error) {
      if (_current(generation)) _error = '本机已退出；服务器注销或本地访客恢复未确认，请重试。';
    }
    if (_current(generation)) _notify();
  }

  @override
  void dispose() {
    _disposed = true;
    _close();
    super.dispose();
  }
}
