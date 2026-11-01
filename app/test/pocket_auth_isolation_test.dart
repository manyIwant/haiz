import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/domain/pocket_models.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';

void main() {
  setUp(() {
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
  });

  test('cloud A data never appear in B or the local guest', () async {
    final remote = <String, String>{};
    final store = PocketStore();
    addTearDown(store.dispose);
    await store.openGuest();
    store.addTask('访客隐私', '语文');
    await store.flush();

    Future<void> open(String id) => store.openCloudAccount(
      userId: id,
      read: () async => remote[id],
      write: (json) async => remote[id] = json,
    );

    await open(a);
    expect(store.isCloudAccount, isTrue);
    expect(store.tasks, isEmpty);
    store.addTask('账号 A 的数学', '数学');
    store.setTaskNote(store.tasks.single.id, 'A 的私密笔记');
    await store.flush();

    await open(b);
    expect(store.tasks, isEmpty);
    store.addTask('账号 B 的英语', '英语');
    await store.flush();

    await open(a);
    expect(store.tasks.single.title, '账号 A 的数学');
    expect(store.noteFor(store.tasks.single.id), 'A 的私密笔记');

    await store.openGuest();
    expect(store.isCloudAccount, isFalse);
    expect(store.tasks.single.title, '访客隐私');
    expect(jsonDecode(remote[a]!)['tasks'], isNotEmpty);
  });

  test('a stale remote account read cannot unlock after switching user', () async {
    final store = PocketStore();
    addTearDown(store.dispose);
    final gate = Completer<void>();
    final pending = store.openCloudAccount(
      userId: a,
      read: () async {
        await gate.future;
        return jsonEncode({'tasks': [const TaskItem(
          id: 'secret', title: 'A-only', subject: '物理',
        ).toJson()]});
      },
      write: (_) async {},
    );
    await store.openCloudAccount(
      userId: b,
      read: () async => null,
      write: (_) async {},
    );
    gate.complete();
    await pending;
    expect(store.namespace, 'haiz/cloud/v1/$b');
    expect(store.tasks, isEmpty);
  });

  test('server save rejection stops writes instead of falling back to guest', () async {
    final store = PocketStore();
    addTearDown(store.dispose);
    await store.openCloudAccount(
      userId: a,
      read: () async => null,
      write: (_) async => throw StateError('conflicting revision'),
    );
    store.addTask('不允许隐式覆盖', '数学');
    await expectLater(store.flush(), throwsStateError);
    expect(store.storageError, isNotNull);
    expect(store.namespace, 'haiz/cloud/v1/$a');
    store.addTask('应被拒绝', '英语');
    expect(store.tasks, hasLength(1));
    store.lock();
    expect(store.tasks, isEmpty);
    expect(store.namespace, isNull);
  });

  test('never opens a cloud account without a valid server UUID', () async {
    final store = PocketStore();
    addTearDown(store.dispose);
    await expectLater(
      store.openCloudAccount(
        userId: 'attacker/../guest',
        read: () async => null,
        write: (_) async {},
      ),
      throwsFormatException,
    );
    expect(store.namespace, isNull);
  });
}
