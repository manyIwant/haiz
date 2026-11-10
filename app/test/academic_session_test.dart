import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/academic_session.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/core/storage_scope.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

Map<String, dynamic> identityFor(
  String user, {
  String instance = 'school',
  List<String> classes = const ['math'],
}) => {
  'instanceId': instance,
  'userId': user,
  'role': 'student',
  'authorizedClassIds': classes,
  'cacheScope': 'haiz/v1/$instance/$user',
};

http.Response jsonResponse(
  Object body, {
  int status = 200,
  bool cookie = false,
}) => http.Response(
  jsonEncode(body),
  status,
  headers: {
    'content-type': 'application/json',
    if (cookie) 'set-cookie': 'hsid=session; HttpOnly',
  },
);

class ServerFixture {
  String user = 'A';
  String instance = 'school';
  List<String> classIds = ['math'];
  bool offline = false;
  bool badLogin = false;
  bool aiReady = false;
  int? denied;
  Map<String, dynamic>? customIdentity;
  Completer<http.Response>? delayedLogin;
  Completer<http.Response>? delayedAssignments;
  final List<http.Request> requests = [];
  final List<TrackingClient> clients = [];

  http.Client client() {
    final result = TrackingClient((request) async {
      requests.add(request);
      if (offline) throw http.ClientException('offline');
      if (request.url.path == '/api/auth/login') {
        if (badLogin) return jsonResponse({'error': 'invalid'}, status: 401);
        if (delayedLogin case final pending?) return pending.future;
        return jsonResponse({
          'user': {'id': user, 'role': 'student'},
        }, cookie: true);
      }
      if (denied case final status?) {
        return jsonResponse({'error': 'revoked'}, status: status);
      }
      if (request.url.path == '/api/v1/identity') {
        return jsonResponse({
          'state': 'Synced',
          'data':
              customIdentity ??
              identityFor(user, instance: instance, classes: classIds),
          'error': null,
          'meta': {},
        });
      }
      if (request.url.path == '/api/ai/extract') {
        if (!aiReady) {
          return jsonResponse({'error': 'model unavailable'}, status: 503);
        }
        return jsonResponse({
          'reviewRequired': true,
          'items': [
            {
              'subject': '物理',
              'title': '完成实验报告',
              'due': '2026-11-01',
              'evidence': '物理周日交实验报告',
              'ambiguous': false,
            },
            {
              'subject': '英语',
              'title': '复习 Unit 4 单词',
              'due': null,
              'evidence': '英语单词下周再测',
              'ambiguous': true,
            },
          ],
        });
      }
      if (request.url.path == '/api/classes') {
        return jsonResponse({
          'classes': [
            {'id': 'math', 'title': 'Math', 'status': 'active'},
          ],
        });
      }
      if (request.url.path == '/api/my/assignments') {
        if (delayedAssignments case final pending?) return pending.future;
        return jsonResponse({
          'assignments': [
            {
              'id': 'homework',
              'classId': 'math',
              'title': '$user homework',
              'subject': '数学',
              // v1.4 acknowledges an exact public version.
              'version': 1,
              'status': 'published',
              'viewed': false,
            },
          ],
        });
      }
      return jsonResponse({});
    });
    clients.add(result);
    return result;
  }
}

class TrackingClient extends MockClient {
  TrackingClient(super.handler);
  bool closed = false;
  @override
  void close() {
    closed = true;
    super.close();
  }
}

Future<void> eventTurn() => Future<void>.delayed(Duration.zero);

void main() {
  setUp(
    () => SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty(),
  );

  test(
    'normalizes HTTPS origins and rejects ambiguous credential destinations',
    () {
      expect(
        normalizeAcademicOrigin('https://EXAMPLE.com:443/'),
        'https://example.com',
      );
      expect(
        normalizeAcademicOrigin('http://localhost:8780/'),
        'http://localhost:8780',
      );
      for (final value in [
        'http://school.test',
        'https://a.test/api',
        'https://name:pw@a.test',
        'https://a.test?q=x',
        'https://a.test/#x',
      ]) {
        expect(() => normalizeAcademicOrigin(value), throwsFormatException);
      }
      expect(
        accountNamespace('https://example.com', identityFor('A')),
        contains('/school/A'),
      );
      expect(
        () => accountNamespace('https://example.com', {
          ...identityFor('A'),
          'cacheScope': 'foreign',
        }),
        throwsFormatException,
      );
    },
  );

  test('AI semantic parsing requires account-scoped consent and preserves review', () async {
    final store = PocketStore();
    await store.load();
    final server = ServerFixture()..aiReady = true;
    final session = AcademicSession(store, clientFactory: server.client);
    await session.login('https://school.test', 'A', 'pw');
    expect(store.semanticExtractionConsent, isFalse);
    const text = '物理周日交实验报告；英语单词下周再测';
    final before = await session.extractSemanticNotice(
      text: text,
      capturedAt: DateTime(2026, 10, 29, 11),
    );
    expect(before, isNull);
    expect(server.requests.where((r) => r.url.path == '/api/ai/extract'), isEmpty);

    await store.setSemanticExtractionConsent(true);
    final suggestions = await session.extractSemanticNotice(
      text: text,
      capturedAt: DateTime(2026, 10, 29, 11),
    );
    expect(suggestions, hasLength(2));
    expect(suggestions![0].title, '完成实验报告');
    expect(suggestions[1].ambiguous, isTrue);
    expect(suggestions[1].due, isNull);
    expect(store.tasks, isEmpty, reason: 'AI cannot silently create local tasks');
    final request = server.requests.lastWhere((r) => r.url.path == '/api/ai/extract');
    final sent = jsonDecode(request.body) as Map<String, dynamic>;
    expect(sent['consent'], isTrue);
    expect(sent['message'], text);
    expect(sent['capturedAt'], contains('2026-10-29'));

    server.user = 'B';
    await session.login('https://school.test', 'B', 'pw');
    expect(store.semanticExtractionConsent, isFalse);
    server.user = 'A';
    await session.login('https://school.test', 'A', 'pw');
    expect(store.semanticExtractionConsent, isTrue);
    await store.setSemanticExtractionConsent(false);
    expect(store.semanticExtractionConsent, isFalse);
    session.dispose();
    store.dispose();
  });

  test(
    'opens an account only after verified identity and isolates two students',
    () async {
      final store = PocketStore();
      await store.load();
      final server = ServerFixture();
      final session = AcademicSession(store, clientFactory: server.client);
      await session.login('https://school.test', 'A', 'password');
      expect(session.userId, 'A');
      expect(session.error, isNull);
      await session.importAssignment(session.assignments.single);
      store.setTaskNote(store.tasks.single.id, 'A private');
      await store.flush();
      server.user = 'B';
      await session.login('https://school.test', 'B', 'password');
      expect(session.userId, 'B');
      expect(store.tasks, isEmpty);
      expect(store.taskNotes, isEmpty);
      expect(server.clients.first.closed, isTrue);
      server.user = 'A';
      await session.login('https://school.test', 'A', 'password');
      expect(store.taskNotes.values, contains('A private'));
      session.dispose();
      store.dispose();
    },
  );

  test('failed login clears the preceding account and credentials', () async {
    final store = PocketStore();
    await store.load();
    final server = ServerFixture();
    final session = AcademicSession(store, clientFactory: server.client);
    await session.login('https://school.test', 'A', 'pw');
    store.addTask('secret', '数学');
    server.badLogin = true;
    await session.login('https://school.test', 'B', 'bad');
    expect(session.userId, isNull);
    expect(session.assignments, isEmpty);
    expect(store.tasks, isEmpty);
    expect(session.error, isNotNull);
    session.dispose();
    store.dispose();
  });

  test(
    'logout cancels delayed login and ignores its cookie and identity',
    () async {
      final store = PocketStore();
      await store.load();
      final server = ServerFixture()..delayedLogin = Completer<http.Response>();
      final session = AcademicSession(store, clientFactory: server.client);
      final login = session.login('https://school.test', 'A', 'pw');
      await eventTurn();
      await eventTurn();
      await session.logout();
      server.delayedLogin!.complete(
        jsonResponse({
          'user': {'id': 'A', 'role': 'student'},
        }, cookie: true),
      );
      await login;
      expect(session.userId, isNull);
      expect(session.assignments, isEmpty);
      expect(store.tasks, isEmpty);
      expect(server.clients.every((c) => c.closed), isTrue);
      session.dispose();
      store.dispose();
    },
  );

  test('delayed old refresh cannot repopulate account B', () async {
    final store = PocketStore();
    await store.load();
    final server = ServerFixture();
    final session = AcademicSession(store, clientFactory: server.client);
    await session.login('https://school.test', 'A', 'pw');
    final delayed = Completer<http.Response>();
    server.delayedAssignments = delayed;
    final refresh = session.refresh();
    for (var i = 0; i < 6; i++) {
      await eventTurn();
    }
    server.delayedAssignments = null;
    server.user = 'B';
    await session.login('https://school.test', 'B', 'pw');
    delayed.complete(
      jsonResponse({
        'assignments': [
          {'id': 'old', 'classId': 'math', 'title': 'A secret'},
        ],
      }),
    );
    await refresh;
    expect(session.userId, 'B');
    expect(session.assignments.single['title'], 'B homework');
    session.dispose();
    store.dispose();
  });

  test(
    'offline refresh keeps owner private work and exposes a recoverable error',
    () async {
      final store = PocketStore();
      await store.load();
      final server = ServerFixture();
      final session = AcademicSession(store, clientFactory: server.client);
      await session.login('https://school.test', 'A', 'pw');
      store.addTask('private', '数学');
      store.setTaskNote(store.tasks.single.id, 'retained');
      server.offline = true;
      await session.refresh();
      expect(session.userId, 'A');
      expect(store.taskNotes.values, contains('retained'));
      expect(session.error, isNotNull);
      expect(session.assignments, isEmpty);
      session.dispose();
      store.dispose();
    },
  );

  test(
    'class revocation purges official content and preserves private notes',
    () async {
      final store = PocketStore();
      await store.load();
      final server = ServerFixture();
      final session = AcademicSession(store, clientFactory: server.client);
      await session.login('https://school.test', 'A', 'pw');
      final stale = session.assignments.single;
      await session.importAssignment(stale);
      store.setTaskNote(store.tasks.single.id, 'mine');
      server.classIds = [];
      await session.refresh();
      expect(session.assignments, isEmpty);
      expect(session.classes, isEmpty);
      expect(store.taskNotes.values, contains('mine'));
      final count = store.tasks.length;
      await session.importAssignment(stale);
      expect(store.tasks.length, count);
      session.dispose();
      store.dispose();
    },
  );

  for (final status in [401, 403]) {
    test(
      'HTTP $status locks account cache and clears server session',
      () async {
        final store = PocketStore();
        await store.load();
        final server = ServerFixture();
        final session = AcademicSession(store, clientFactory: server.client);
        await session.login('https://school.test', 'A', 'pw');
        store.addTask('private', '数学');
        await store.flush();
        server.denied = status;
        await session.refresh();
        expect(session.userId, isNull);
        expect(store.tasks, isEmpty);
        expect(session.assignments, isEmpty);
        expect(server.clients.last.closed, isTrue);
        session.dispose();
        store.dispose();
      },
    );
  }

  test(
    'rejects missing mismatched or malformed identity without opening account',
    () async {
      final store = PocketStore();
      await store.load();
      final server = ServerFixture();
      final session = AcademicSession(store, clientFactory: server.client);
      for (final identity in [
        <String, dynamic>{},
        identityFor('B'),
        {
          ...identityFor('A'),
          'authorizedClassIds': [5],
        },
        {...identityFor('A'), 'role': 'teacher'},
        {...identityFor('A'), 'cacheScope': 'haiz/v1/wrong/A'},
      ]) {
        server.customIdentity = identity;
        await session.login('https://school.test', 'A', 'pw');
        expect(session.userId, isNull);
        expect(store.tasks, isEmpty);
        expect(session.error, isNotNull);
      }
      session.dispose();
      store.dispose();
    },
  );

  test(
    'successful logout revokes remote session and clears local identity',
    () async {
      final store = PocketStore();
      await store.load();
      final server = ServerFixture();
      final session = AcademicSession(store, clientFactory: server.client);
      await session.login('https://school.test', 'A', 'pw');
      store.addTask('private', '数学');
      await store.flush();
      await session.logout();
      expect(session.userId, isNull);
      expect(session.origin, isNull);
      expect(store.tasks, isEmpty);
      expect(server.requests.last.url.path, '/api/auth/logout');
      expect(server.requests.last.headers['Cookie'], 'hsid=session');
      expect(server.clients.every((client) => client.closed), isTrue);
      session.dispose();
      store.dispose();
    },
  );

  test('import is idempotent and later teacher text cannot overwrite private notes', () async {
    final store = PocketStore();
    await store.load();
    final server = ServerFixture();
    final session = AcademicSession(store, clientFactory: server.client);
    await session.login('https://school.test', 'A', 'pw');
    final item = session.assignments.single;
    await session.importAssignment(item);
    final task = store.tasks.single;
    store.setTaskNote(task.id, 'original private note');
    await session.importAssignment(item);
    expect(store.tasks.length, 1);
    expect(store.noteFor(task.id), 'original private note');
    await session.markViewed(item);
    final acknowledge = server.requests.singleWhere(
      (request) => request.url.path.endsWith('/homework/acknowledge'),
    );
    expect(acknowledge.url.path, '/api/v1/assignments/homework/acknowledge');
    // v1.4 binds the acknowledgement to the viewed version and requires a key,
    // otherwise the server rejects it with INVALID_VERSION.
    expect(jsonDecode(acknowledge.body), {'version': 1});
    expect(
      RegExp(r'^[A-Za-z0-9_-]{8,100}$').hasMatch(
        acknowledge.headers['Idempotency-Key'] ?? '',
      ),
      isTrue,
    );
    expect(
      server.requests
          .where((request) => request.method == 'POST')
          .every((request) => !request.body.contains('original private note')),
      isTrue,
    );
    session.dispose();
    store.dispose();
  });

  test('invalid server fails before credentials are transmitted', () async {
    final store = PocketStore();
    await store.load();
    final server = ServerFixture();
    final session = AcademicSession(store, clientFactory: server.client);
    await session.login('http://unsafe.test', 'A', 'pw');
    expect(session.error, isNotNull);
    expect(server.requests, isEmpty);
    expect(session.userId, isNull);
    await session.login('https://school.test', '', '');
    expect(session.error, isNotNull);
    expect(server.requests, isEmpty);
    session.dispose();
    store.dispose();
  });

  test(
    'repeated refresh after transient outage restores official content',
    () async {
      final store = PocketStore();
      await store.load();
      final server = ServerFixture();
      final session = AcademicSession(store, clientFactory: server.client);
      await session.login('https://school.test', 'A', 'pw');
      server.offline = true;
      await session.refresh();
      server.offline = false;
      await session.refresh(classId: 'math');
      expect(session.error, isNull);
      expect(session.assignments.single['title'], 'A homework');
      expect(session.selectedClass, 'math');
      expect(session.busy, isFalse);
      session.dispose();
      store.dispose();
    },
  );

  test(
    'server replacement requires new login and never reuses the old store',
    () async {
      final store = PocketStore();
      await store.load();
      final server = ServerFixture();
      final session = AcademicSession(store, clientFactory: server.client);
      await session.login('https://school.test', 'A', 'pw');
      store.addTask('old instance', '数学');
      await store.flush();
      server.instance = 'replacement';
      await session.refresh();
      expect(session.userId, isNull);
      expect(store.tasks, isEmpty);
      await session.login('https://school.test', 'A', 'pw');
      expect(store.tasks, isEmpty);
      session.dispose();
      store.dispose();
    },
  );
}
