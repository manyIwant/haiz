import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/personal_backup.dart';
import 'package:haiz_pocket_flutter/core/personal_snapshot.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/domain/pocket_models.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

const _v1 = '{"version":1,"tasks":[{"id":"t1","title":"练习册","subject":"数学",'
    '"completed":false,"example":false,"dueIso":"2026-11-04","source":"",'
    '"originalNotice":""}],"courses":[],"focusLogs":[],"taskNotes":{"t1":"第7题"},'
    '"activeTaskId":null,"appearance":"porcelain","legacyImported":false}';

Future<PocketStore> _guest() async {
  final store = PocketStore();
  await store.openGuest();
  return store;
}

void main() {
  setUp(() {
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
  });

  group('wire compatibility with 1.5.5', () {
    test('a pure 1.5.5 payload round-trips byte for byte', () {
      expect(PersonalSnapshot.decode(_v1).encode(), _v1);
    });

    test('records holding memos are protected as version 2; 1.5.5 cannot silently drop them', () async {
      final store = await _guest();
      addTearDown(store.dispose);
      store.addTask('实验报告', '物理');
      store.addNote('周五带校服');
      await store.flush();
      final raw = (await SharedPreferencesAsync()
          .getString('${store.namespace}/personal.v1'))!;
      final json = jsonDecode(raw) as Map<String, dynamic>;
      // 1.5.5 only opens version 1: it shows the record as unreadable
      // (read-only, original kept) instead of saving it without the memo.
      expect(json['version'], 2);
      expect(json['haiz2']['schema'], 2);
      expect(PersonalSnapshot.decode(raw).ext.notes.single.text, '周五带校服');
    });

    test('2.x data without memos stays version 1 and survives a 1.5.5 rewrite of core fields', () async {
      final store = await _guest();
      addTearDown(store.dispose);
      final id = store.addTask('实验报告', '物理')!;
      store.setTaskCompleted(id, true);
      await store.flush();
      final raw = (await SharedPreferencesAsync()
          .getString('${store.namespace}/personal.v1'))!;
      final json = jsonDecode(raw) as Map<String, dynamic>;
      expect(json['version'], 1);
      // What a 1.5.5 client writes back: every core key, no extension.
      final oldClientWrite = Map.of(json)..remove('haiz2');
      final reread = PersonalSnapshot.decode(jsonEncode(oldClientWrite));
      expect(reread.tasks.single.completed, isTrue);
      expect(reread.ext.taskMeta, isEmpty);
    });

    test('opening a 1.5.5 record keeps a one-time rollback copy', () async {
      SharedPreferencesAsyncPlatform.instance =
          InMemorySharedPreferencesAsync.withData({
        'haiz/installation/v1': 'a1b2c3d4e5f60718293a4b5c',
        'haiz/guest/v1/a1b2c3d4e5f60718293a4b5c/personal.v1': _v1,
      });
      final store = await _guest();
      addTearDown(store.dispose);
      final prefs = SharedPreferencesAsync();
      final key = '${store.namespace}/personal.v1.pre2';
      expect(await prefs.getString(key), _v1);
      store.addNote('升级后的备忘');
      await store.flush();
      await store.openGuest();
      expect(await prefs.getString(key), _v1, reason: 'never overwritten');
      expect(store.notes.single.text, '升级后的备忘');
      expect(store.tasks.single.title, '练习册');
    });

    test('unknown future extension schema keeps the record read-only', () async {
      final future = (jsonDecode(_v1) as Map<String, dynamic>)
        ..['haiz2'] = {'schema': 9};
      SharedPreferencesAsyncPlatform.instance =
          InMemorySharedPreferencesAsync.withData({
        'haiz/installation/v1': 'a1b2c3d4e5f60718293a4b5c',
        'haiz/guest/v1/a1b2c3d4e5f60718293a4b5c/personal.v1': jsonEncode(future),
      });
      final store = await _guest();
      addTearDown(store.dispose);
      expect(store.storageError, isNotNull);
      store.addTask('不应写入', '数学');
      expect(store.tasks, isEmpty);
    });
  });

  group('notes are not tasks', () {
    test('memo create, edit, delete and undo never touch the task list', () async {
      final store = await _guest();
      addTearDown(store.dispose);
      final id = store.addNote('问一下物理老师\n关于纸带打点的误差')!;
      expect(store.tasks, isEmpty);
      expect(store.notes.single.title, '问一下物理老师');
      expect(store.notes.single.preview, '关于纸带打点的误差');
      store.updateNote(id, '问一下物理老师（已问）');
      final removed = store.deleteNote(id)!;
      expect(store.notes, isEmpty);
      store.restoreNote(removed);
      expect(store.notes.single.text, '问一下物理老师（已问）');
    });

    test('converting a memo creates one linked task and keeps the memo', () async {
      final store = await _guest();
      addTearDown(store.dispose);
      final noteId = store.addNote('整理化学第三章错题')!;
      final taskId = store.convertNoteToTask(noteId,
          title: '整理化学第三章错题', subject: '化学', due: DateTime(2026, 11, 6))!;
      expect(store.tasks.single.source, '来自备忘');
      expect(store.tasks.single.dueIso, '2026-11-06');
      expect(store.metaFor(taskId).noteId, noteId);
      expect(store.noteById(noteId)!.taskId, taskId);
    });
  });

  group('task history', () {
    test('completion time is recorded and cleared on undo', () async {
      final store = await _guest();
      addTearDown(store.dispose);
      final fixed = DateTime(2026, 11, 4, 10, 12);
      store.now = () => fixed;
      final id = store.addTask('背单词', '英语')!;
      expect(store.metaFor(id).createdAt, fixed);
      store.setTaskCompleted(id, true);
      expect(store.metaFor(id).completedAt, fixed);
      store.setTaskCompleted(id, false);
      expect(store.metaFor(id).completedAt, isNull);
    });

    test('deleted tasks go to 最近删除 with their note and can be restored', () async {
      final store = await _guest();
      addTearDown(store.dispose);
      final id = store.addTask('默写赤壁赋', '语文')!;
      store.setTaskNote(id, '重点：寄蜉蝣于天地');
      store.deleteTask(id);
      expect(store.tasks, isEmpty);
      expect(store.ext.trash.single.note, '重点：寄蜉蝣于天地');
      expect(store.restoreFromTrash(id), isTrue);
      expect(store.tasks.single.id, id);
      expect(store.noteFor(id), '重点：寄蜉蝣于天地');
      expect(store.ext.trash, isEmpty);
    });

    test('recently deleted is bounded', () async {
      final store = await _guest();
      addTearDown(store.dispose);
      for (var i = 0; i < 70; i++) {
        store.deleteTask(store.addTask('任务 $i', '其他')!);
      }
      expect(store.ext.trash.length, 60);
      expect(store.ext.trash.first.task.title, '任务 69');
    });

    test('a course edit keeps its id', () async {
      final store = await _guest();
      addTearDown(store.dispose);
      final id = store.addCourse(name: '数学', weekday: 3, startMinute: 600, endMinute: 640)!;
      expect(store.updateCourse(id, name: '数学', weekday: 3, startMinute: 600,
          endMinute: 640, location: '明德楼 302'), isTrue);
      expect(store.courses.single.id, id);
      expect(store.courses.single.location, '明德楼 302');
    });
  });

  group('focus sessions follow the wall clock', () {
    test('a running session survives a restart and is completed exactly once', () async {
      var clock = DateTime(2026, 11, 4, 10, 0);
      final store = await _guest();
      store.now = () => clock;
      final task = store.addTask('练习册', '数学')!;
      store.chooseFocusTask(task);
      store.setFocusDuration(25);
      store.startFocus();
      await store.flush();
      store.dispose();

      // Process death; the session ends while the app is not running.
      clock = DateTime(2026, 11, 4, 10, 40);
      final reopened = PocketStore()..now = () => clock;
      addTearDown(reopened.dispose);
      await reopened.openGuest();
      expect(reopened.focusSession, isNull);
      expect(reopened.focusLogs.single.minutes, 25);
      expect(reopened.focusLogs.single.label, '练习册');
      expect(reopened.focusNotice, contains('10:25'));
      reopened.reconcileFocus();
      reopened.finishFocus(auto: true);
      expect(reopened.focusLogs, hasLength(1));
    });

    test('pause freezes the remainder across restarts', () async {
      var clock = DateTime(2026, 11, 4, 10, 0);
      final store = await _guest();
      store.now = () => clock;
      store.setFocusDuration(25);
      store.startFocus();
      clock = clock.add(const Duration(minutes: 10));
      store.pauseFocus();
      await store.flush();
      store.dispose();
      clock = clock.add(const Duration(hours: 3));
      final reopened = PocketStore()..now = () => clock;
      addTearDown(reopened.dispose);
      await reopened.openGuest();
      expect(reopened.focusPaused, isTrue);
      expect(reopened.focusRemaining, 15 * 60);
      reopened.startFocus();
      clock = clock.add(const Duration(minutes: 5));
      expect(reopened.focusRemaining, 10 * 60);
      reopened.finishFocus();
      expect(reopened.focusLogs.single.minutes, 15);
    });

    test('discarding records nothing', () async {
      final store = await _guest();
      addTearDown(store.dispose);
      var clock = DateTime(2026, 11, 4, 10, 0);
      store.now = () => clock;
      store.startFocus();
      clock = clock.add(const Duration(minutes: 12));
      store.discardFocus();
      expect(store.focusLogs, isEmpty);
      expect(store.focusSession, isNull);
    });
  });

  group('save recovery', () {
    test('a transient cloud failure can be retried without losing edits', () async {
      final store = PocketStore();
      addTearDown(store.dispose);
      var fail = true;
      String? saved;
      await store.openCloudAccount(
        userId: '11111111-1111-4111-8111-111111111111',
        read: () async => null,
        write: (json) async {
          if (fail) throw StateError('offline');
          saved = json;
        },
      );
      store.addTask('断网时添加', '数学');
      await expectLater(store.flush(), throwsStateError);
      expect(store.canRetrySave, isTrue);
      expect(store.sync.value.phase, SyncPhase.failed);
      fail = false;
      expect(await store.retrySave(), isTrue);
      expect(store.storageError, isNull);
      expect(store.sync.value.phase, SyncPhase.saved);
      expect(PersonalSnapshot.decode(saved!).tasks.single.title, '断网时添加');
    });

    test('a cloud conflict is never retried blindly and merge keeps both sides', () async {
      final store = PocketStore();
      addTearDown(store.dispose);
      var remote = PersonalSnapshot(tasks: const [
        TaskItem(id: 'other', title: '另一台设备的任务', subject: '英语'),
      ]).encode();
      var conflict = true;
      await store.openCloudAccount(
        userId: '11111111-1111-4111-8111-111111111111',
        read: () async => remote,
        write: (json) async {
          if (conflict) throw SnapshotConflict('newer revision');
          remote = json;
        },
      );
      // The other device saves a second task after we loaded.
      remote = PersonalSnapshot(tasks: const [
        TaskItem(id: 'other', title: '另一台设备的任务', subject: '英语'),
        TaskItem(id: 'other2', title: '另一台设备新加的', subject: '物理'),
      ]).encode();
      store.addTask('本机的任务', '数学');
      await expectLater(store.flush(), throwsStateError);
      expect(store.hasCloudConflict, isTrue);
      expect(store.canRetrySave, isFalse);
      expect(await store.retrySave(), isFalse);
      conflict = false;
      expect(await store.mergeWithCloud(), isTrue);
      expect(store.tasks.map((t) => t.title),
          containsAll(['本机的任务', '另一台设备的任务', '另一台设备新加的']));
      expect(PersonalSnapshot.decode(remote).tasks, hasLength(3));
    });

    test('reloading from the cloud adopts the newer revision', () async {
      final store = PocketStore();
      addTearDown(store.dispose);
      var remote = const PersonalSnapshot().encode();
      await store.openCloudAccount(
        userId: '11111111-1111-4111-8111-111111111111',
        read: () async => remote,
        write: (_) async => throw SnapshotConflict('newer revision'),
      );
      remote = PersonalSnapshot(tasks: const [
        TaskItem(id: 'x', title: '云端较新的任务', subject: '数学'),
      ]).encode();
      store.addTask('冲突中的本机修改', '语文');
      await expectLater(store.flush(), throwsStateError);
      expect(await store.reloadFromCloud(), isTrue);
      expect(store.tasks.single.title, '云端较新的任务');
      expect(store.storageError, isNull);
    });
  });

  group('backups and drafts', () {
    test('2.0 backups declare version 2 and keep memos when merged', () async {
      final store = await _guest();
      addTearDown(store.dispose);
      store.addNote('备份里的备忘');
      final raw = await store.exportGuestBackup();
      expect(jsonDecode(raw)['version'], 2);
      final backup = PersonalBackup.decode(raw);
      store.deleteNote(store.notes.single.id);
      await store.mergeGuestBackup(backup, confirmed: true);
      expect(store.notes.single.text, '备份里的备忘');
    });

    test('guest drafts survive a restart; account switches clear them', () async {
      final store = await _guest();
      store.setDraft('capture', '明天交物理');
      await Future<void>.delayed(const Duration(milliseconds: 700));
      final scope = store.namespace;
      store.dispose();
      final reopened = await _guest();
      addTearDown(reopened.dispose);
      expect(reopened.namespace, scope);
      expect(reopened.draft('capture'), '明天交物理');
      await reopened.openCloudAccount(
        userId: '11111111-1111-4111-8111-111111111111',
        read: () async => null,
        write: (_) async {},
      );
      expect(reopened.draft('capture'), isEmpty);
    });
  });
}
