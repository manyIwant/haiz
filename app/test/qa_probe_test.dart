import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/domain/pocket_models.dart';
import 'package:haiz_pocket_flutter/ui/focus_page.dart';
import 'package:haiz_pocket_flutter/ui/kit.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

/// Group 10 QA additions. Each case is a behaviour the PR #22 suite does not
/// currently pin: interrupted writes, unreadable payloads, cross-account focus
/// logs, the Study Relay dialog and duplicate legacy identifiers.
Map<String, dynamic> _identity(String user) => {
  'instanceId': 'instance-one',
  'userId': user,
  'role': 'student',
  'authorizedClassIds': ['class-a'],
  'cacheScope': 'haiz/v1/instance-one/$user',
};

Future<PocketStore> _store() async {
  final store = PocketStore();
  addTearDown(store.dispose);
  await store.load();
  return store;
}

Future<void> _open(PocketStore store, String user) => store.openAccount(
  origin: 'https://academic.example.com',
  identity: _identity(user),
);

/// Fails every write matching [shouldFail] so a partial write can be simulated
/// without touching a real disk.
final class _FailingPreferences extends InMemorySharedPreferencesAsync {
  _FailingPreferences(super.data) : super.withData();
  bool Function(String key)? shouldFail;

  @override
  Future<bool> setString(
    String key,
    String value,
    SharedPreferencesOptions options,
  ) async {
    if (shouldFail?.call(key) ?? false) {
      throw StateError('disk full (synthetic)');
    }
    return super.setString(key, value, options);
  }
}

void main() {
  setUp(() {
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
  });

  test('QA-FLOW-01 deleting one task never drops another task note', () async {
    final store = await _store();
    await _open(store, 'student-a');
    store.addTask('数学作业', '数学');
    store.addTask('数学作业', '数学');
    await store.flush();
    final first = store.tasks.first.id;
    final second = store.tasks.last.id;
    expect(
      first,
      isNot(second),
      reason: 'identical titles still get unique ids',
    );
    store.setTaskNote(first, '第一条思路');
    store.setTaskNote(second, '第二条思路');
    await store.flush();

    store.deleteTask(first);
    await store.flush();
    expect(store.noteFor(second), '第二条思路');
    expect(store.noteFor(first), isEmpty);
  });

  test(
    'QA-FLOW-02 a deleted task never leaves an orphaned active focus target',
    () async {
      final store = await _store();
      await _open(store, 'student-a');
      store.addTask('英语背诵', '英语');
      await store.flush();
      final id = store.tasks.single.id;
      store.chooseFocusTask(id);
      await store.flush();
      expect(store.activeTask?.id, id);

      store.deleteTask(id);
      await store.flush();
      expect(store.activeTask, isNull);
      expect(store.activeTaskId, isNull);

      await _open(store, 'student-a');
      expect(store.activeTask, isNull, reason: 'restart must not resurrect it');
    },
  );

  test('QA-RECOVER-01 an interrupted account write keeps the last committed records', () async {
    final platform = _FailingPreferences(const {});
    SharedPreferencesAsyncPlatform.instance = platform;
    final store = await _store();
    await _open(store, 'student-a');
    store.addTask('断电前写入的任务', '数学');
    await store.flush();
    final key = '${store.namespace}/personal.v1';
    final before = await SharedPreferencesAsync().getString(key);
    expect(before, isNotNull);

    platform.shouldFail = (String _) => true;
    store.addTask('写入失败时新增的任务', '物理');
    await expectLater(store.flush(), throwsA(isA<StateError>()));
    expect(store.storageError, isNotEmpty);
    platform.shouldFail = null;

    expect(await SharedPreferencesAsync().getString(key), before);
    await _open(store, 'student-a');
    expect(store.tasks.map((t) => t.title), contains('断电前写入的任务'));
  });

  test(
    'QA-RECOVER-02 an unreadable payload surfaces and is never overwritten',
    () async {
      final store = await _store();
      await _open(store, 'student-a');
      store.addTask('真实记录', '数学');
      await store.flush();
      final prefs = SharedPreferencesAsync();
      final key = '${store.namespace}/personal.v1';
      await prefs.setString(key, 'not json at all');

      await _open(store, 'student-a');
      expect(
        store.storageError,
        isNotEmpty,
        reason:
            'an unreadable payload must surface, not look like a new account',
      );
      expect(await prefs.getString(key), 'not json at all');
      store.addTask('不得覆盖', '数学');
      expect(store.tasks, isEmpty, reason: 'a read-only store rejects writes');
      expect(await prefs.getString(key), 'not json at all');
    },
  );

  test('QA-RECOVER-03 installing a second account does not touch the first account payload', () async {
    final prefs = SharedPreferencesAsync();
    final store = await _store();
    await _open(store, 'student-a');
    store.addTask('A 的私人任务', '数学');
    store.setTaskNote(store.tasks.single.id, 'A 的私人笔记');
    await store.flush();
    final aKey = '${store.namespace}/personal.v1';
    final aBytes = await prefs.getString(aKey);

    await _open(store, 'student-b');
    store.addTask('B 的私人任务', '英语');
    await store.flush();
    expect('${store.namespace}/personal.v1', isNot(aKey));
    expect(await prefs.getString(aKey), aBytes);

    await _open(store, 'student-a');
    expect(store.tasks.single.title, 'A 的私人任务');
    expect(store.noteFor(store.tasks.single.id), 'A 的私人笔记');
  });

  test(
    'QA-RECOVER-04 focus history recorded by A never counts toward B',
    () async {
      final store = await _store();
      await _open(store, 'student-a');
      store.addTask('A 的专注任务', '数学');
      await store.flush();
      // Seed one finished session the way finishFocus writes it: a log record
      // inside A's own personal document.
      final prefs = SharedPreferencesAsync();
      final key = '${store.namespace}/personal.v1';
      final personal =
          jsonDecode((await prefs.getString(key))!) as Map<String, dynamic>;
      await prefs.setString(
        key,
        jsonEncode({
          ...personal,
          'focusLogs': [
            FocusLog(
              at: DateTime.now(),
              minutes: 30,
              label: 'A 的学习记录',
            ).toJson(),
          ],
        }),
      );
      await _open(store, 'student-a');
      expect(store.focusLogs, hasLength(1));
      expect(store.todayFocusMinutes, 30);

      await _open(store, 'student-b');
      expect(store.focusLogs, isEmpty);
      expect(store.todayFocusMinutes, 0);
      expect(store.tasks, isEmpty);
    },
  );

  test(
    'QA-FLOW-03 immediately stopping a session records no focus minutes',
    () async {
      // finishFocus rounds (elapsed / 60); confirm the rounding never invents a
      // minute for a session the student abandoned immediately.
      final store = await _store();
      await _open(store, 'student-a');
      store.addTask('短暂专注', '数学');
      await store.flush();
      store.chooseFocusTask(store.tasks.single.id);
      store.setFocusDuration(25);
      store.startFocus();
      store.finishFocus();
      await store.flush();
      expect(store.focusLogs, isEmpty);
      expect(store.focusRemaining, store.focusTargetMinutes * 60);
    },
  );

  testWidgets(
    'QA-UI-01 Study Relay refuses to write a note after an account switch',
    (tester) async {
      final store = await _store();
      await _open(store, 'student-a');
      store.addTask('A 的任务', '数学');
      await store.flush();
      store.chooseFocusTask(store.tasks.single.id);
      await tester.pumpWidget(
        MaterialApp(
          home: PocketSkin(
            colors: PocketPalette.forName(store.appearance),
            child: Scaffold(body: FocusPage(store: store)),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final trigger = find.text('记录学习思路');
      expect(trigger, findsOneWidget);
      await tester.tap(trigger);
      await tester.pumpAndSettle();
      expect(find.text('学习接力 · 保存思路'), findsOneWidget);

      // The verified account changes while the note dialog is still open.
      await _open(store, 'student-b');
      await tester.pump();
      await tester.enterText(find.byType(TextField).last, '切换账号后敲入的思路');
      await tester.tap(find.text('保存到本机'));
      await tester.pumpAndSettle();
      // Framework exceptions deliberately remain failures: QA must report
      // controller lifecycle defects rather than drain or suppress them.

      expect(store.namespace, endsWith('student-b'));
      expect(store.tasks, isEmpty, reason: 'B must not receive A-era work');
      expect(store.taskNotes, isEmpty, reason: 'the note must not land in B');
      expect(find.text('已切换账号，笔记未写入任何账号。'), findsOneWidget);
    },
  );

  test(
    'QA-RECOVER-05 a legacy archive with duplicate ids cannot be imported',
    () async {
      final legacy = {
        'pocket.tasks.v1': jsonEncode([
          const TaskItem(id: 'dup', title: '旧任务一', subject: '数学').toJson(),
          const TaskItem(id: 'dup', title: '旧任务二', subject: '物理').toJson(),
        ]),
      };
      SharedPreferencesAsyncPlatform.instance =
          InMemorySharedPreferencesAsync.withData(legacy);
      final store = await _store();
      await _open(store, 'student-a');

      await expectLater(
        store.importLegacyArchive(ownerConfirmed: true),
        throwsA(anyOf(isA<FormatException>(), isA<StateError>())),
      );
      expect(store.legacyImported, isFalse);
      expect(store.tasks, isEmpty);
      final prefs = SharedPreferencesAsync();
      expect(
        await prefs.getString('pocket.tasks.v1'),
        legacy['pocket.tasks.v1'],
        reason: 'unimportable bytes stay exactly as they were',
      );
      expect(
        await prefs.getString('haiz/legacy/v1/owner'),
        isNull,
        reason: 'a failed import must not consume the archive',
      );
    },
  );
}
