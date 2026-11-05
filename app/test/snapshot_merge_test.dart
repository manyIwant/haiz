import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/haiz_extension.dart';
import 'package:haiz_pocket_flutter/core/personal_snapshot.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/domain/pocket_models.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

TaskItem t(String id, String title, {String subject = '数学', bool done = false, String? due}) =>
    TaskItem(id: id, title: title, subject: subject, completed: done, dueIso: due);

PersonalSnapshot snap(List<TaskItem> tasks, {Map<String, String> notes = const {}, List<CourseSlot> courses = const [],
        HaizExtension ext = const HaizExtension()}) =>
    PersonalSnapshot(tasks: tasks, taskNotes: notes, courses: courses, ext: ext);

HaizExtension stamped(Map<String, DateTime> updated) =>
    HaizExtension(taskMeta: {for (final e in updated.entries) e.key: TaskMeta(updatedAt: e.value)});

void main() {
  final base = snap([t('a', '练习册'), t('b', '实验报告'), t('c', '背单词')]);

  test('a task deleted on the other device is not resurrected', () {
    final local = snap([t('a', '练习册'), t('b', '实验报告'), t('c', '背单词')]);
    final remote = snap([t('a', '练习册'), t('c', '背单词')]);
    final r = threeWayMerge(base: base, local: local, remote: remote);
    expect(r.snapshot.tasks.map((x) => x.id), ['a', 'c']);
    expect(r.removed, 1);
    expect(r.conflicts, isEmpty);
  });

  test('the 2.0 union merge would have resurrected it (regression guard)', () {
    final local = snap([t('a', '练习册'), t('b', '实验报告')]);
    final remote = snap([t('a', '练习册')]);
    final noBase = threeWayMerge(local: local, remote: remote);
    expect(noBase.baseKnown, isFalse);
    expect(noBase.snapshot.tasks.map((x) => x.id), containsAll(['a', 'b']),
        reason: 'without a common ancestor deletions cannot be told from additions');
    expect(noBase.summary, contains('无法识别删除'));
  });

  test('a task deleted here stays deleted when the other side did not touch it', () {
    final local = snap([t('a', '练习册'), t('c', '背单词')]);
    final remote = snap([t('a', '练习册'), t('b', '实验报告'), t('c', '背单词')]);
    expect(threeWayMerge(base: base, local: local, remote: remote).snapshot.tasks.map((x) => x.id), ['a', 'c']);
  });

  test('delete on one side, edit on the other: the edit is kept and reported', () {
    final local = snap([t('a', '练习册'), t('c', '背单词')]);
    final remote = snap([t('a', '练习册'), t('b', '实验报告（已改）'), t('c', '背单词')]);
    final r = threeWayMerge(base: base, local: local, remote: remote);
    expect(r.snapshot.tasks.map((x) => x.title), contains('实验报告（已改）'));
    expect(r.conflicts.single.resolution, contains('本机删除了它'));
  });

  test('different fields edited on each side are both applied', () {
    final local = snap([t('a', '练习册 P36–39'), t('b', '实验报告'), t('c', '背单词')]);
    final remote = snap([t('a', '练习册', due: '2026-11-05'), t('b', '实验报告', done: true), t('c', '背单词')]);
    final r = threeWayMerge(base: base, local: local, remote: remote);
    final a = r.snapshot.tasks.firstWhere((x) => x.id == 'a');
    expect(a.title, '练习册 P36–39');
    expect(a.dueIso, '2026-11-05');
    expect(r.snapshot.tasks.firstWhere((x) => x.id == 'b').completed, isTrue);
    expect(r.conflicts, isEmpty);
  });

  test('the same field edited on both sides: the later edit wins and is reported', () {
    final local = snap([t('a', '本机改的标题'), t('b', '实验报告'), t('c', '背单词')],
        ext: stamped({'a': DateTime(2026, 11, 4, 10)}));
    final remote = snap([t('a', '另一台设备改的标题'), t('b', '实验报告'), t('c', '背单词')],
        ext: stamped({'a': DateTime(2026, 11, 4, 11)}));
    final r = threeWayMerge(base: base, local: local, remote: remote);
    expect(r.snapshot.tasks.firstWhere((x) => x.id == 'a').title, '另一台设备改的标题');
    expect(r.conflicts.single.resolution, contains('内容'));
  });

  test('additions on both sides are all kept, local order first', () {
    final local = snap([t('a', '练习册'), t('b', '实验报告'), t('c', '背单词'), t('d', '本机新增')]);
    final remote = snap([t('a', '练习册'), t('b', '实验报告'), t('c', '背单词'), t('e', '另一台新增')]);
    final r = threeWayMerge(base: base, local: local, remote: remote);
    expect(r.snapshot.tasks.map((x) => x.id), ['a', 'b', 'c', 'd', 'e']);
    expect(r.added, 1);
  });

  test('task notes edited on both sides keep both texts', () {
    final b = snap([t('a', '练习册')], notes: {'a': '第 7 题'});
    final local = snap([t('a', '练习册')], notes: {'a': '第 7 题：两种方法'});
    final remote = snap([t('a', '练习册')], notes: {'a': '第 7 题：问老师'});
    final r = threeWayMerge(base: b, local: local, remote: remote);
    expect(r.snapshot.taskNotes['a'], allOf(contains('两种方法'), contains('问老师')));
    expect(r.conflicts.single.kind, 'note');
  });

  test('a memo edited on both sides keeps the newer and saves the other as a memo', () {
    NoteItem n(String text, int h) => NoteItem(id: 'm', text: text,
        createdAt: DateTime(2026, 11, 4), updatedAt: DateTime(2026, 11, 4, h));
    final b = snap([], ext: HaizExtension(notes: [n('带校服', 8)]));
    final local = snap([], ext: HaizExtension(notes: [n('带校服和饭卡', 9)]));
    final remote = snap([], ext: HaizExtension(notes: [n('带校服和雨伞', 10)]));
    final r = threeWayMerge(base: b, local: local, remote: remote);
    final texts = r.snapshot.ext.notes.map((x) => x.text).toList();
    expect(texts.first, '带校服和雨伞');
    expect(texts.any((x) => x.startsWith('带校服和饭卡')), isTrue);
  });

  test('a course removed on the other device is removed', () {
    final course = CourseSlot(id: 'k', weekday: 3, startMinute: 600, endMinute: 640, name: '数学');
    final b = snap([], courses: [course]);
    final r = threeWayMerge(base: b, local: snap([], courses: [course]), remote: snap([]));
    expect(r.snapshot.courses, isEmpty);
  });

  group('protective versioning against 1.5.5 rewrites', () {
    test('records with memos or recently deleted tasks are written as version 2', () {
      final withMemo = snap([], ext: HaizExtension(notes: [
        NoteItem(id: 'm', text: '带校服', createdAt: DateTime(2026), updatedAt: DateTime(2026))]));
      expect(jsonDecode(withMemo.encode())['version'], 2);
      expect(PersonalSnapshot.decode(withMemo.encode()).ext.notes.single.text, '带校服');
      final withTrash = snap([], ext: HaizExtension(trash: [TrashEntry(task: t('x', '删掉的'), deletedAt: DateTime(2026))]));
      expect(jsonDecode(withTrash.encode())['version'], 2);
    });

    test('records with only timestamps stay version 1 for 1.5.5', () {
      final s = snap([t('a', '练习册')], ext: stamped({'a': DateTime(2026, 11, 4)}));
      expect(jsonDecode(s.encode())['version'], 1);
    });
  });

  group('store conflict resolution uses the last confirmed revision', () {
    setUp(() => SharedPreferencesAsyncPlatform.instance = InMemorySharedPreferencesAsync.empty());

    test('merge after the other device deleted a task does not bring it back', () async {
      final store = PocketStore();
      addTearDown(store.dispose);
      var remote = snap([t('a', '练习册'), t('b', '实验报告')]).encode();
      var conflict = false;
      await store.openCloudAccount(
        userId: '11111111-1111-4111-8111-111111111111',
        read: () async => remote,
        write: (json) async {
          if (conflict) throw SnapshotConflict('newer revision');
          remote = json;
        },
      );
      // Another device deletes b and adds c.
      remote = snap([t('a', '练习册'), t('c', '新任务')]).encode();
      conflict = true;
      store.updateTask('a', title: '练习册 P36', subject: '数学');
      await expectLater(store.flush(), throwsStateError);
      expect(store.hasCloudConflict, isTrue);
      conflict = false;
      expect(await store.mergeWithCloud(), isTrue);
      expect(store.tasks.map((x) => x.id), ['a', 'c']);
      expect(store.tasks.first.title, '练习册 P36');
      expect(store.lastMerge!.removed, 1);
      expect(store.lastMerge!.added, 1);
      expect(PersonalSnapshot.decode(remote).tasks.map((x) => x.id), ['a', 'c']);
    });
  });
}
