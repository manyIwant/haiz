@Tags(['live'])
library;

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/academic_session.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

String env(String key) => Platform.environment[key]!;

void main() {
  final skip = Platform.environment['HAIZ_QA_TEACHER'] == null
      ? 'Run scripts/qa/live-contract.mjs against the synthetic QA service'
      : null;
  test('QA-LIVE-01 teacher revision retraction and revocation reach Flutter refresh', () async {
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
    final store = PocketStore();
    addTearDown(store.dispose);
    await store.load();
    final student = AcademicSession(store);
    addTearDown(student.dispose);
    final teacher = http.Client();
    addTearDown(teacher.close);
    final base = env('HAIZ_LIVE_BASE');
    final login = await teacher.post(
      Uri.parse('$base/api/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'login': env('HAIZ_QA_TEACHER'),
        'password': env('HAIZ_QA_PASSWORD'),
      }),
    );
    expect(login.statusCode, 200);
    final cookie = login.headers['set-cookie']!.split(';').first;
    var sequence = 0;
    Future<Map<String, dynamic>> command(
      String path,
      Map<String, dynamic> data, {
      bool patch = false,
    }) async {
      final headers = {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'Idempotency-Key': 'qa_live_${++sequence}',
      };
      final uri = Uri.parse('$base/api/v1$path');
      final response = patch
          ? await teacher.patch(uri, headers: headers, body: jsonEncode(data))
          : await teacher.post(uri, headers: headers, body: jsonEncode(data));
      expect(response.statusCode, anyOf(200, 201), reason: response.body);
      return (jsonDecode(response.body) as Map<String, dynamic>)['data']
          as Map<String, dynamic>;
    }

    Map<String, dynamic> assignment(Map<String, dynamic> data) =>
        data['assignment'] as Map<String, dynamic>;
    var work = assignment(
      await command('/classes/${env('HAIZ_QA_CLASS')}/assignments', {
        'title': 'QA lifecycle original',
        'subject': '数学',
        'details': '虚构作业',
        'due': '2026-11-02',
        'duePrecision': 'date',
      }),
    );
    work = assignment(
      await command('/assignments/${work['id']}/review', {
        'expectedVersion': work['version'],
      }),
    );
    work = assignment(
      await command('/assignments/${work['id']}/publish', {
        'expectedVersion': work['version'],
      }),
    );
    final id = work['id'];
    await student.login(base, env('HAIZ_LIVE_A'), env('HAIZ_LIVE_A_PASS'));
    expect(student.error, isNull, reason: student.error);
    var received = student.assignments.firstWhere((item) => item['id'] == id);
    expect(received['version'], work['version']);
    await student.importAssignment(received);
    final personal = store.tasks.single;
    store.setTaskNote(personal.id, '虚构私人笔记 survives');
    await store.flush();
    final scope = store.namespace;
    work = assignment(
      await command('/assignments/$id', {
        'expectedVersion': work['version'],
        'title': 'QA lifecycle revised',
        'due': '2026-11-04',
      }, patch: true),
    );
    await student.refresh();
    received = student.assignments.firstWhere((item) => item['id'] == id);
    expect(received['title'], 'QA lifecycle revised');
    expect(received['due'], '2026-11-04');
    expect(received['version'], work['version']);
    expect(
      store.tasks.single.title,
      'QA lifecycle original',
      reason: 'manual personal copy; no revision reconciliation',
    );
    expect(store.noteFor(personal.id), '虚构私人笔记 survives');
    await student.importAssignment(received);
    expect(store.tasks, hasLength(1));
    await student.markViewed(received);
    expect(student.error, isNull, reason: student.error);
    expect(
      student.assignments.firstWhere((item) => item['id'] == id)['viewed'],
      isTrue,
    );
    await command('/assignments/$id/retract', {
      'expectedVersion': work['version'],
    });
    await student.refresh();
    expect(student.assignments.any((item) => item['id'] == id), isFalse);
    expect(
      store.tasks.single.title,
      'QA lifecycle original',
      reason: 'personal copy remains; App lacks retraction notice',
    );
    expect(store.noteFor(personal.id), '虚构私人笔记 survives');
    final screen = await teacher.get(
      Uri.parse('$base/api/v1/classroom'),
      headers: {'Authorization': 'Bearer ${env('HAIZ_QA_SCREEN')}'},
    );
    expect(screen.statusCode, 200);
    final screenData = (jsonDecode(screen.body) as Map)['data'] as Map;
    expect(
      (screenData['assignments'] as List).any((item) => item['id'] == id),
      isFalse,
    );
    expect(screenData['containsStudentIdentity'], isFalse);
    await command(
      '/classes/${env('HAIZ_QA_CLASS')}/members/${env('HAIZ_LIVE_A_ID')}/revoke',
      {},
    );
    await student.refresh();
    expect(student.assignments, isEmpty);
    expect(student.classes, isEmpty);
    expect(store.namespace, scope);
    expect(store.noteFor(personal.id), '虚构私人笔记 survives');
    await student.logout();
    expect(student.identity, isNull);
    expect(store.tasks, isEmpty);
    await student.login(base, env('HAIZ_LIVE_B'), env('HAIZ_LIVE_B_PASS'));
    expect(student.error, isNull, reason: student.error);
    expect(store.tasks, isEmpty);
    expect(store.taskNotes, isEmpty);
    await student.login(base, env('HAIZ_LIVE_A'), env('HAIZ_LIVE_A_PASS'));
    expect(student.error, isNull, reason: student.error);
    expect(store.tasks.single.id, personal.id);
    expect(store.noteFor(personal.id), '虚构私人笔记 survives');
  }, skip: skip);
}
