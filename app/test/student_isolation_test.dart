import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/domain/pocket_models.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

const _origin = 'https://academic.example.com';
const _archiveKey = 'haiz/legacy/v1/archive';
const _migrationKey = 'haiz/legacy/v1/complete';

Map<String, dynamic> _identity(
  String user, {
  String instance = 'instance-one',
}) => {
  'instanceId': instance,
  'userId': user,
  'role': 'student',
  'authorizedClassIds': ['class-a'],
  'cacheScope': 'haiz/v1/$instance/$user',
};

Map<String, String> _legacyData() => {
  'pocket.tasks.v1': jsonEncode([
    const TaskItem(
      id: 'legacy-task',
      title: '历史数学作业',
      subject: '数学',
      source: 'HAIZ Academic · teacher-original',
      originalNotice: '教师发布的原文',
    ).toJson(),
  ]),
  'pocket.courses.v1': jsonEncode([
    const CourseSlot(
      id: 'legacy-course',
      weekday: 1,
      startMinute: 480,
      endMinute: 525,
      name: '历史物理课',
    ).toJson(),
  ]),
  'pocket.focus.v1': jsonEncode([
    FocusLog(at: DateTime(2026, 10, 27), minutes: 15, label: '历史学习记录').toJson(),
  ]),
  'pocket.taskNotes.v1': jsonEncode({'legacy-task': '只有原用户知道的思路'}),
  'pocket.activeTask.v1': 'legacy-task',
  'pocket.appearance.v1': 'porcelain',
};

Future<PocketStore> _loadedStore() async {
  final store = PocketStore();
  addTearDown(store.dispose);
  await store.load();
  return store;
}

Future<void> _open(
  PocketStore store,
  String user, {
  String origin = _origin,
  String instance = 'instance-one',
}) => store.openAccount(
  origin: origin,
  identity: _identity(user, instance: instance),
);

void main() {
  setUp(() {
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
  });

  test(
    'new installation opens an empty guest namespace without sample records',
    () async {
      final store = await _loadedStore();

      expect(store.ready, isTrue);
      expect(store.namespace, isNotNull);
      expect(store.tasks, isEmpty);
      expect(store.courses, isEmpty);
      expect(store.focusLogs, isEmpty);
      expect(store.taskNotes, isEmpty);
      expect(
        await SharedPreferencesAsync().getString('haiz/installation/v1'),
        isNotEmpty,
      );
    },
  );

  test('A tasks notes courses and focus records cannot be read by B', () async {
    final store = await _loadedStore();
    await _open(store, 'student-a');
    final aNamespace = store.namespace;
    store.addTask('A 的私人任务', '数学');
    final taskId = store.tasks.single.id;
    store.setTaskNote(taskId, 'A 的私人笔记');
    store.chooseFocusTask(taskId);
    store.addCourse(
      name: 'A 的课程',
      weekday: 1,
      startMinute: 480,
      endMinute: 525,
    );
    store.setFocusDuration(1);
    store.startFocus();
    store.focusRemaining = 0;
    store.finishFocus(auto: true);
    await store.flush();
    expect(store.focusLogs, hasLength(1));

    await _open(store, 'student-b');

    expect(store.namespace, isNot(aNamespace));
    expect(store.tasks, isEmpty);
    expect(store.taskNotes, isEmpty);
    expect(store.noteFor(taskId), isEmpty);
    expect(store.courses, isEmpty);
    expect(store.focusLogs, isEmpty);
    expect(store.activeTaskId, isNull);
    expect(store.lastSavedTaskId, isNull);
    store.addTask('B 的私人任务', '英语');
    await store.flush();

    await _open(store, 'student-a');

    expect(store.tasks.single.title, 'A 的私人任务');
    expect(store.noteFor(taskId), 'A 的私人笔记');
    expect(store.courses.single.name, 'A 的课程');
    expect(store.focusLogs.single.minutes, 1);
    expect(store.tasks.any((task) => task.title == 'B 的私人任务'), isFalse);
  });

  test(
    'logout hides account records and restores only device guest work',
    () async {
      final store = await _loadedStore();
      final guestNamespace = store.namespace;
      store.addTask('设备访客任务', '其他');
      await store.flush();
      await _open(store, 'student-a');
      store.addTask('账号 A 任务', '数学');
      await store.flush();
      final generation = store.generation;

      await store.openGuest();

      expect(store.generation, greaterThan(generation));
      expect(store.namespace, guestNamespace);
      expect(store.tasks.single.title, '设备访客任务');
      expect(store.taskNotes, isEmpty);
    },
  );

  test(
    'restart opens guest until the same account is verified again',
    () async {
      final first = await _loadedStore();
      final guestNamespace = first.namespace;
      await _open(first, 'student-a');
      first.addTask('重启后仍保留 A 的数据', '数学');
      first.setTaskNote(first.tasks.single.id, '不会随重启丢失');
      await first.flush();
      final aNamespace = first.namespace;

      final restarted = await _loadedStore();

      expect(restarted.namespace, guestNamespace);
      expect(restarted.tasks, isEmpty);
      await _open(restarted, 'student-a');
      expect(restarted.namespace, aNamespace);
      expect(restarted.tasks.single.title, '重启后仍保留 A 的数据');
      expect(restarted.noteFor(restarted.tasks.single.id), '不会随重启丢失');
    },
  );

  test(
    'same user on another origin or replacement instance has a separate store',
    () async {
      final store = await _loadedStore();
      await _open(store, 'student-a');
      store.addTask('原服务器数据', '数学');
      await store.flush();
      final originalNamespace = store.namespace;

      await _open(store, 'student-a', origin: 'https://other.example.com');
      expect(store.namespace, isNot(originalNamespace));
      expect(store.tasks, isEmpty);
      await _open(store, 'student-a', instance: 'replacement-instance');
      expect(store.namespace, isNot(originalNamespace));
      expect(store.tasks, isEmpty);
      await _open(store, 'student-a');
      expect(store.tasks.single.title, '原服务器数据');
    },
  );

  test(
    'HTTPS host casing default port and trailing slash normalize identically',
    () async {
      final store = await _loadedStore();
      await _open(store, 'student-a');
      final namespace = store.namespace;
      store.addTask('规范化地址下的数据', '数学');
      await store.flush();

      await _open(
        store,
        'student-a',
        origin: 'https://ACADEMIC.example.com:443/',
      );

      expect(store.namespace, namespace);
      expect(store.tasks.single.title, '规范化地址下的数据');
    },
  );

  test(
    'switch immediately clears notes active task and running focus timer',
    () async {
      final store = await _loadedStore();
      await _open(store, 'student-a');
      store.addTask('A 的计时任务', '数学');
      store.chooseFocusTask(store.tasks.single.id);
      store.setTaskNote(store.tasks.single.id, 'A 的思路');
      store.startFocus();
      final generation = store.generation;

      final switching = _open(store, 'student-b');

      expect(store.generation, greaterThan(generation));
      expect(store.tasks, isEmpty);
      expect(store.taskNotes, isEmpty);
      expect(store.activeTaskId, isNull);
      expect(store.focusRunning, isFalse);
      await switching;
      expect(store.focusLogs, isEmpty);
    },
  );

  test(
    'queued writes keep their original namespace during account switch',
    () async {
      final store = await _loadedStore();
      await _open(store, 'student-a');
      store.addTask('切换前排队的 A 任务', '数学');
      final taskId = store.tasks.single.id;
      store.setTaskNote(taskId, '切换前排队的 A 笔记');

      await _open(store, 'student-b');
      store.addTask('B 自己的任务', '英语');
      await store.flush();

      expect(store.tasks.single.title, 'B 自己的任务');
      expect(store.noteFor(taskId), isEmpty);
      await _open(store, 'student-a');
      expect(store.tasks.single.title, '切换前排队的 A 任务');
      expect(store.noteFor(taskId), '切换前排队的 A 笔记');
    },
  );

  test(
    'legacy bytes are archived unchanged and never assigned to first login',
    () async {
      final legacy = _legacyData();
      SharedPreferencesAsyncPlatform.instance =
          InMemorySharedPreferencesAsync.withData(legacy);
      final store = await _loadedStore();
      final prefs = SharedPreferencesAsync();

      expect(store.legacyArchiveAvailable, isTrue);
      expect(store.tasks, isEmpty);
      expect(jsonDecode((await prefs.getString(_archiveKey))!), legacy);
      expect(await prefs.getString(_migrationKey), '1');
      for (final entry in legacy.entries) {
        expect(await prefs.getString(entry.key), entry.value);
      }
      await _open(store, 'student-a');
      expect(store.tasks, isEmpty);
      expect(store.taskNotes, isEmpty);
      await _open(store, 'student-b');
      expect(store.tasks, isEmpty);
    },
  );

  test(
    'migration is idempotent and retains the first archived bytes on restart',
    () async {
      final legacy = _legacyData();
      SharedPreferencesAsyncPlatform.instance =
          InMemorySharedPreferencesAsync.withData(legacy);
      await _loadedStore();
      final prefs = SharedPreferencesAsync();
      final archived = await prefs.getString(_archiveKey);
      await prefs.setString(
        'pocket.tasks.v1',
        'changed by a downgraded old app',
      );

      final restarted = await _loadedStore();

      expect(await prefs.getString(_archiveKey), archived);
      expect(restarted.tasks, isEmpty);
      expect(restarted.legacyArchiveAvailable, isTrue);
    },
  );

  test('unconfirmed legacy import rejects without altering either namespace or source', () async {
    final legacy = _legacyData();
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.withData(legacy);
    final store = await _loadedStore();
    await _open(store, 'student-a');

    await expectLater(
      store.importLegacyArchive(ownerConfirmed: false),
      throwsA(anything),
    );

    expect(store.tasks, isEmpty);
    expect(store.taskNotes, isEmpty);
    expect(
      await SharedPreferencesAsync().getString('pocket.tasks.v1'),
      legacy['pocket.tasks.v1'],
    );
  });

  test('confirmed import merges private work once and preserves source and archive', () async {
    final legacy = _legacyData();
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.withData(legacy);
    final store = await _loadedStore();
    await _open(store, 'student-a');
    store.addTask('已经存在的个人任务', '英语');
    final ownTaskId = store.tasks.single.id;
    store.setTaskNote(ownTaskId, '已经存在的笔记');
    await store.flush();

    await store.importLegacyArchive(ownerConfirmed: true);
    await store.flush();

    expect(
      store.tasks.map((task) => task.title),
      containsAll(['历史数学作业', '已经存在的个人任务']),
    );
    expect(store.noteFor('legacy-task'), '只有原用户知道的思路');
    expect(store.noteFor(ownTaskId), '已经存在的笔记');
    expect(store.courses.single.name, '历史物理课');
    expect(store.focusLogs.single.minutes, 15);
    final source = store.tasks.singleWhere((task) => task.id == 'legacy-task');
    expect(source.source, 'HAIZ Academic · teacher-original');
    expect(source.originalNotice, '教师发布的原文');
    store.setTaskNote(source.id, '导入后学生自己的思路');
    await store.importLegacyArchive(ownerConfirmed: true);
    expect(store.tasks, hasLength(2));
    expect(store.focusLogs, hasLength(1));
    expect(store.noteFor(source.id), '导入后学生自己的思路');
    final prefs = SharedPreferencesAsync();
    expect(jsonDecode((await prefs.getString(_archiveKey))!), legacy);
    expect(await prefs.getString('pocket.tasks.v1'), legacy['pocket.tasks.v1']);

    await _open(store, 'student-b');
    await expectLater(
      store.importLegacyArchive(ownerConfirmed: true),
      throwsA(anything),
    );
    expect(store.tasks, isEmpty);
    expect(store.noteFor('legacy-task'), isEmpty);
  });

  test(
    'guest cannot claim a legacy archive before an owner is authenticated',
    () async {
      final legacy = _legacyData();
      SharedPreferencesAsyncPlatform.instance =
          InMemorySharedPreferencesAsync.withData(legacy);
      final store = await _loadedStore();

      await expectLater(
        store.importLegacyArchive(ownerConfirmed: true),
        throwsA(anything),
      );

      expect(store.tasks, isEmpty);
      expect(store.taskNotes, isEmpty);
      expect(
        await SharedPreferencesAsync().getString('haiz/legacy/v1/owner'),
        isNull,
      );
      await _open(store, 'student-a');
      await store.importLegacyArchive(ownerConfirmed: true);
      expect(store.tasks.single.title, '历史数学作业');
    },
  );

  test('invalid identity cacheScope cannot open a previously authenticated account', () async {
    final store = await _loadedStore();
    await _open(store, 'student-a');
    store.addTask('A 的已认证数据', '数学');
    await store.flush();

    try {
      await store.openAccount(
        origin: _origin,
        identity: {
          ..._identity('student-b'),
          'cacheScope': 'haiz/v1/instance-one/student-a',
        },
      );
    } catch (_) {
      // Validation may throw, but must still clear the previous account first.
    }

    expect(store.tasks, isEmpty);
    expect(store.taskNotes, isEmpty);
    expect(store.activeTaskId, isNull);
    await _open(store, 'student-a');
    expect(store.tasks.single.title, 'A 的已认证数据');
  });

  test(
    'malformed legacy JSON is backed up exactly and cannot partially import',
    () async {
      final legacy = {
        ..._legacyData(),
        'pocket.tasks.v1': '{broken legacy bytes',
      };
      SharedPreferencesAsyncPlatform.instance =
          InMemorySharedPreferencesAsync.withData(legacy);
      final store = await _loadedStore();
      await _open(store, 'student-a');

      await expectLater(
        store.importLegacyArchive(ownerConfirmed: true),
        throwsA(anything),
      );

      expect(store.tasks, isEmpty);
      expect(store.taskNotes, isEmpty);
      expect(store.courses, isEmpty);
      expect(store.focusLogs, isEmpty);
      final prefs = SharedPreferencesAsync();
      expect(jsonDecode((await prefs.getString(_archiveKey))!), legacy);
      expect(await prefs.getString('pocket.tasks.v1'), '{broken legacy bytes');
    },
  );

  test('corrupt account payload stays inaccessible and cannot be overwritten with empty data', () async {
    final store = await _loadedStore();
    await _open(store, 'student-a');
    store.addTask('损坏前的 A 任务', '数学');
    await store.flush();
    final namespace = store.namespace!;
    final prefs = SharedPreferencesAsync();
    final keys = (await prefs.getKeys())
        .where((key) => key.startsWith(namespace))
        .toList();
    expect(keys, isNotEmpty);
    await store.openGuest();
    for (final key in keys) {
      await prefs.setString(key, '{corrupt scoped payload');
    }

    await _open(store, 'student-a');

    expect(store.storageError, isNotEmpty);
    expect(store.tasks, isEmpty);
    expect(store.taskNotes, isEmpty);
    try {
      store.addTask('不允许覆盖损坏的原始记录', '数学');
      await store.flush();
    } catch (_) {
      // A disabled store may reject the write synchronously or through flush.
    }
    for (final key in keys) {
      expect(await prefs.getString(key), '{corrupt scoped payload');
    }
  });

  test(
    'archive write failure preserves old records and retries safely on restart',
    () async {
      final legacy = _legacyData();
      SharedPreferencesAsyncPlatform.instance = _FailingArchivePreferences(
        legacy,
      );
      final store = await _loadedStore();
      final prefs = SharedPreferencesAsync();

      expect(store.storageError, isNotEmpty);
      expect(store.tasks, isEmpty);
      expect(await prefs.getString(_migrationKey), isNull);
      for (final entry in legacy.entries) {
        expect(await prefs.getString(entry.key), entry.value);
      }

      final recovered = await _loadedStore();
      expect(recovered.storageError, isNull);
      expect(jsonDecode((await prefs.getString(_archiveKey))!), legacy);
      expect(await prefs.getString(_migrationKey), '1');
    },
  );
}

final class _FailingArchivePreferences extends InMemorySharedPreferencesAsync {
  _FailingArchivePreferences(super.data) : super.withData();

  bool _failed = false;

  @override
  Future<bool> setString(
    String key,
    String value,
    SharedPreferencesOptions options,
  ) async {
    if (key == _archiveKey && !_failed) {
      _failed = true;
      throw StateError('simulated disk write failure');
    }
    return super.setString(key, value, options);
  }
}
