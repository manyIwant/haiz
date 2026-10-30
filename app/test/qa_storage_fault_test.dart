import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/legacy_archive.dart';
import 'package:haiz_pocket_flutter/core/personal_snapshot.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/domain/pocket_models.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

const _origin = 'https://qa.example.test';
Map<String, dynamic> _identity(String user) => {
  'instanceId': 'qa-instance',
  'userId': user,
  'role': 'student',
  'authorizedClassIds': <String>[],
  'cacheScope': 'haiz/v1/qa-instance/$user',
};

Map<String, String> _legacy() => {
  'pocket.tasks.v1': jsonEncode([
    const TaskItem(id: 'legacy-task', title: '旧任务', subject: '数学').toJson(),
  ]),
};

Future<PocketStore> _account(InMemorySharedPreferencesAsync platform) async {
  SharedPreferencesAsyncPlatform.instance = platform;
  final store = PocketStore();
  addTearDown(store.dispose);
  await store.openAccount(origin: _origin, identity: _identity('student-a'));
  return store;
}

final class _ClaimGate extends InMemorySharedPreferencesAsync {
  _ClaimGate(super.data) : super.withData();
  final entered = Completer<void>();
  final release = Completer<void>();
  bool block = true;

  @override
  Future<bool> setString(
    String key,
    String value,
    SharedPreferencesOptions options,
  ) async {
    if (key == LegacyArchive.ownerKey && block) {
      block = false;
      entered.complete();
      await release.future;
    }
    return super.setString(key, value, options);
  }
}

final class _WriteFailure extends InMemorySharedPreferencesAsync {
  _WriteFailure() : super.empty();
  final entered = Completer<void>();
  final release = Completer<void>();
  bool armed = false;
  int personalAttempts = 0;

  @override
  Future<bool> setString(
    String key,
    String value,
    SharedPreferencesOptions options,
  ) async {
    if (armed && key.endsWith('/personal.v1')) {
      personalAttempts++;
      if (personalAttempts == 1) {
        entered.complete();
        await release.future;
        throw StateError('synthetic first-write failure');
      }
    }
    return super.setString(key, value, options);
  }
}

final class _MigrationWriteFailure extends InMemorySharedPreferencesAsync {
  _MigrationWriteFailure(super.data) : super.withData();
  bool failDestinationOnce = true;

  @override
  Future<bool> setString(
    String key,
    String value,
    SharedPreferencesOptions options,
  ) async {
    if (key.endsWith('/personal.v1') && failDestinationOnce) {
      failDestinationOnce = false;
      throw StateError('synthetic interruption after archive ownership write');
    }
    return super.setString(key, value, options);
  }
}

void main() {
  test('QA-STORAGE-01 edits made while migration claim waits survive in memory and disk', () async {
    final platform = _ClaimGate(_legacy());
    final store = await _account(platform);
    store.addTask('迁移前私人任务', '英语');
    await store.flush();
    final key = '${store.namespace}/personal.v1';
    final migration = store.importLegacyArchive(ownerConfirmed: true);
    await platform.entered.future;

    // Deterministic gate is after _mergeLegacy but before destination write.
    store.addTask('归属写入等待期间新增的私人任务', '物理');
    platform.release.complete();
    await migration;
    await store.flush();
    final beforeNextEdit = PersonalSnapshot.decode(
      (await SharedPreferencesAsync().getString(key))!,
    );
    // Log both sides before another ordinary edit exposes the durable loss.
    // After migration, memory has legacy but drops the concurrent new task;
    // the queued ordinary write has the new task but drops legacy on disk.
    debugPrint(
      'QA-STORAGE-01 after migration memory=${store.tasks.map((task) => task.title).toList()}',
    );
    debugPrint(
      'QA-STORAGE-01 after migration disk=${beforeNextEdit.tasks.map((task) => task.title).toList()}',
    );
    store.setAppearance('ocean');
    await store.flush();
    final saved = PersonalSnapshot.decode(
      (await SharedPreferencesAsync().getString(key))!,
    );
    debugPrint(
      'QA-STORAGE-01 after appearance save disk=${saved.tasks.map((task) => task.title).toList()}',
    );
    final expectedTitles = containsAll(['迁移前私人任务', '旧任务', '归属写入等待期间新增的私人任务']);
    expect(saved.tasks.map((task) => task.title), expectedTitles);
    expect(store.tasks.map((task) => task.title), expectedTitles);
    expect(saved.legacyImported, isTrue);
  });

  test('QA-STORAGE-02 invalid calendar date is rejected without importing legacy bytes', () async {
    final raw = {
      'pocket.tasks.v1': jsonEncode([
        const TaskItem(
          id: 'invalid-date',
          title: '非法日期任务',
          subject: '数学',
          dueIso: '2026-02-31',
        ).toJson(),
      ]),
    };
    final store = await _account(InMemorySharedPreferencesAsync.withData(raw));
    await expectLater(
      store.importLegacyArchive(ownerConfirmed: true),
      throwsA(isA<FormatException>()),
    );
    expect(
      await SharedPreferencesAsync().getString('pocket.tasks.v1'),
      raw['pocket.tasks.v1'],
    );
    expect(
      await SharedPreferencesAsync().getString(LegacyArchive.ownerKey),
      isNull,
    );
  });

  test('QA-STORAGE-03 queued snapshots continue after first failure while store reports read-only', () async {
    // Characterization only: queued edits were accepted before the failure was
    // known. This proves behaviour, not by itself an unauthorized data loss.
    final platform = _WriteFailure();
    final store = await _account(platform);
    store.addTask('原有任务', '数学');
    await store.flush();
    platform.armed = true;
    store.addTask('首次写入报错的任务', '英语');
    await platform.entered.future;
    store.addTask('已提前入队的第二次修改', '物理');
    platform.release.complete();
    await expectLater(store.flush(), throwsA(isA<StateError>()));
    expect(store.storageError, isNotNull);
    expect(platform.personalAttempts, 2);
    final saved = PersonalSnapshot.decode(
      (await SharedPreferencesAsync().getString(
        '${store.namespace}/personal.v1',
      ))!,
    );
    expect(
      saved.tasks.map((task) => task.title),
      containsAll(['原有任务', '首次写入报错的任务', '已提前入队的第二次修改']),
    );
  });

  test('QA-STORAGE-05 destination write interrupted after claim is retryable by original owner', () async {
    final legacy = _legacy();
    final store = await _account(_MigrationWriteFailure(legacy));
    final scope = store.namespace;
    await expectLater(
      store.importLegacyArchive(ownerConfirmed: true),
      throwsA(isA<StateError>()),
    );
    final prefs = SharedPreferencesAsync();
    expect(await prefs.getString(LegacyArchive.ownerKey), scope);
    expect(await prefs.getString('pocket.tasks.v1'), legacy['pocket.tasks.v1']);
    expect(store.legacyImported, isFalse);
    await store.importLegacyArchive(ownerConfirmed: true);
    expect(store.tasks.single.title, '旧任务');
    expect(store.legacyImported, isTrue);
    expect(
      PersonalSnapshot.decode((await prefs.getString('$scope/personal.v1'))!)
          .tasks
          .single
          .title,
      '旧任务',
    );
  });

  test('QA-STORAGE-04 switched account waits for in-flight migration without receiving its archive', () async {
    final platform = _ClaimGate(_legacy());
    final store = await _account(platform);
    final aScope = store.namespace;
    final migration = store.importLegacyArchive(ownerConfirmed: true);
    await platform.entered.future;
    final switchAccount = store.openAccount(
      origin: _origin,
      identity: _identity('student-b'),
    );
    expect(store.tasks, isEmpty, reason: 'visibility closes synchronously');
    platform.release.complete();
    await migration;
    await switchAccount;
    expect(store.tasks, isEmpty);
    expect(store.namespace, isNot(aScope));
    expect(
      await SharedPreferencesAsync().getString(
        '${store.namespace}/personal.v1',
      ),
      isNull,
    );
    expect(
      await SharedPreferencesAsync().getString(LegacyArchive.ownerKey),
      aScope,
    );
  });
}
