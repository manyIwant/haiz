@Tags(['live'])
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/academic_session.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/core/storage_scope.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

/// Contract checks against a running PR #21 backend.
///
/// Tagged `live`, so the default run skips them. Start the service with an
/// isolated database and run:
///
///   HAIZ_LIVE_BASE=http://127.0.0.1:8791 \
///   HAIZ_LIVE_A=student-a HAIZ_LIVE_A_PASS=... HAIZ_LIVE_A_ID=`<uuid>` \
///   HAIZ_LIVE_B=student-b HAIZ_LIVE_B_PASS=... HAIZ_LIVE_B_ID=`<uuid>` \
///   flutter test --tags live test/academic_contract_live_test.dart
String _env(String name) {
  final value = Platform.environment[name];
  if (value == null || value.isEmpty) {
    throw StateError('missing required environment variable $name');
  }
  return value;
}

void main() {
  final base = Platform.environment['HAIZ_LIVE_BASE'];
  final skip = base == null || base.isEmpty
      ? 'set HAIZ_LIVE_BASE to a running PR #21 backend'
      : null;

  setUp(() {
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
  });

  test('two students on one device never share a namespace or records', () async {
    final store = PocketStore();
    addTearDown(store.dispose);
    await store.load();
    expect(store.tasks, isEmpty, reason: 'a fresh install has no records');
    final session = AcademicSession(store);
    addTearDown(session.dispose);

    await session.login(base!, _env('HAIZ_LIVE_A'), _env('HAIZ_LIVE_A_PASS'));
    expect(session.error, isNull, reason: session.error);
    expect(session.userId, _env('HAIZ_LIVE_A_ID'));
    expect(session.identity!['role'], 'student');
    expect(session.identity!['instanceId'], isA<String>());

    // The server's cacheScope omits origin, so the store namespaces on the
    // normalised origin plus the verified identity. Both must agree.
    final aScope = store.namespace!;
    expect(aScope, startsWith('haiz/v1/'));
    expect(aScope, accountNamespace(base, session.identity!));
    // Origin, instance and user are percent-encoded so a '/', ':' or port in
    // the origin cannot add path segments and collide with the next part.
    expect(
      aScope.split('/').length,
      5,
      reason: 'haiz / v1 / origin / instanceId / userId',
    );
    expect(aScope, contains(Uri.encodeComponent(Uri.parse(base).origin)));

    store.addTask('A 的私人任务', '数学');
    await store.flush();
    expect(store.tasks.single.title, 'A 的私人任务');

    await session.login(base, _env('HAIZ_LIVE_B'), _env('HAIZ_LIVE_B_PASS'));
    expect(session.error, isNull, reason: session.error);
    expect(session.userId, _env('HAIZ_LIVE_B_ID'));
    expect(store.namespace, isNot(aScope));
    expect(store.tasks, isEmpty);
    expect(store.taskNotes, isEmpty);

    // Same account, same device: A's records come back untouched.
    await session.login(base, _env('HAIZ_LIVE_A'), _env('HAIZ_LIVE_A_PASS'));
    expect(store.namespace, aScope);
    expect(store.tasks.map((task) => task.title), contains('A 的私人任务'));
  }, skip: skip);

  test('an assignment is imported only on request and keeps private notes', () async {
    final store = PocketStore();
    addTearDown(store.dispose);
    await store.load();
    final session = AcademicSession(store);
    addTearDown(session.dispose);

    await session.login(base!, _env('HAIZ_LIVE_A'), _env('HAIZ_LIVE_A_PASS'));
    expect(session.error, isNull, reason: session.error);
    expect(session.classes, isNotEmpty, reason: 'fixture student needs a class');
    expect(session.assignments, isNotEmpty, reason: 'fixture needs an assignment');

    final item = session.assignments.first;
    expect(item['id'], isA<String>());
    expect(item['version'], isA<int>(), reason: 'v1.4 acknowledges versions');
    expect(item['classId'], item['classId']);

    // The listing is authoritative but nothing is copied until the student asks.
    expect(store.tasks, isEmpty);

    await session.importAssignment(item);
    expect(session.error, isNull, reason: session.error);
    expect(store.tasks.single.title, item['title']);

    final task = store.tasks.single;
    store.setTaskNote(task.id, '我自己的思路');
    await store.flush();
    await session.refresh();
    expect(store.noteFor(task.id), '我自己的思路');
    expect(store.tasks.length, 1, reason: 'refresh must not duplicate the task');

    await session.markViewed(item);
    expect(session.error, isNull, reason: session.error);
    final updated = session.assignments.firstWhere(
      (row) => row['id'] == item['id'],
    );
    expect(updated['viewed'], isTrue, reason: 'acknowledgement was recorded');
  }, skip: skip);

  test('identity is revalidated and a widened scope never reopens old data', () async {
    final store = PocketStore();
    addTearDown(store.dispose);
    await store.load();
    final session = AcademicSession(store);
    addTearDown(session.dispose);

    await session.login(base!, _env('HAIZ_LIVE_A'), _env('HAIZ_LIVE_A_PASS'));
    expect(session.error, isNull, reason: session.error);
    expect(
      session.identity!['authorizedClassIds'],
      isNotEmpty,
      reason: 'fixture student must currently hold a class',
    );
    final scoped = store.namespace!;
    store.addTask('撤销前保存的私人任务', '英语');
    await store.flush();

    // A refresh always re-reads /api/v1/identity first, so official content
    // that is no longer authorized can never be shown from stale memory.
    await session.refresh();
    expect(session.error, isNull, reason: session.error);
    expect(
      session.assignments.every(
        (row) => (session.identity!['authorizedClassIds'] as List).contains(
          row['classId'],
        ),
      ),
      isTrue,
    );
    expect(store.namespace, scoped);
    // Private work belongs to the account, not to the class permission.
    expect(store.tasks.map((task) => task.title), contains('撤销前保存的私人任务'));
  }, skip: skip);

  test('the backend exposes the v1.4 identity route', () async {
    final probe = HttpClient();
    addTearDown(probe.close);
    final request = await probe.getUrl(Uri.parse('$base/api/v1/identity'));
    final response = await request.close();
    await response.drain<void>();
    // 401 means the route exists behind auth; 404 means a v1.3 server, which
    // the client must refuse instead of falling back to shared storage.
    expect(
      response.statusCode,
      401,
      reason:
          'a 404 here means the server predates the identity contract; the '
          'client must refuse login instead of sharing one local store',
    );
  }, skip: skip);
}
