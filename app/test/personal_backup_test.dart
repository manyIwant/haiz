import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:haiz_pocket_flutter/core/personal_backup.dart';
import 'package:haiz_pocket_flutter/core/personal_snapshot.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/ui/pocket_backup_sheet.dart';
import 'package:haiz_pocket_flutter/domain/pocket_models.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

const sourceTask = TaskItem(
  id: 'task-backup-1', title: '化学课堂复习', subject: '化学',
);

void main() {
  setUp(() {
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
  });

  test('roundtrip preserves tasks, private notes, courses and focus history', () {
    final snapshot = PersonalSnapshot(
      tasks: [sourceTask],
      taskNotes: const {'task-backup-1': '复习实验笔记'},
      courses: const [
        CourseSlot(id: 'course-1', name: '语文', weekday: 1,
          startMinute: 480, endMinute: 525),
      ],
      focusLogs: [FocusLog(at: DateTime.utc(2026, 11, 1), minutes: 25, label: '自习')],
      activeTaskId: 'task-backup-1',
      appearance: 'ocean',
    );
    final raw = PersonalBackup.create(snapshot, now: DateTime.utc(2026, 11, 1));
    final parsed = PersonalBackup.decode(raw);
    expect(parsed.snapshot.encode(), snapshot.encode());
    expect(parsed.taskCount, 1);
    expect(parsed.courseCount, 1);
    expect(parsed.focusCount, 1);
    expect(parsed.createdAt.isUtc, isTrue);
  });

  test('corrupted, wrong format and oversize backups fail closed', () {
    final raw = PersonalBackup.create(const PersonalSnapshot(tasks: [sourceTask]));
    final tampered = jsonDecode(raw) as Map<String, dynamic>;
    (tampered['snapshot'] as Map<String, dynamic>)['tasks'][0]['title'] = '被修改';
    expect(() => PersonalBackup.decode(jsonEncode(tampered)),
        throwsA(isA<FormatException>()));
    expect(() => PersonalBackup.decode('{"format":"other"}'),
        throwsA(isA<FormatException>()));
    expect(() => PersonalBackup.decode('a' * (PersonalBackup.maxBytes + 1)),
        throwsA(isA<FormatException>()));
  });

  test('merge is idempotent and rejects conflicting task IDs without mutation', () {
    const original = PersonalSnapshot(tasks: [sourceTask],
        taskNotes: {'task-backup-1': '旧笔记'});
    final imported = PersonalBackup.merge(const PersonalSnapshot(), original);
    expect(imported.tasksAdded, 1);
    final again = PersonalBackup.merge(imported.merged, original);
    expect(again.tasksAdded, 0);
    expect(again.merged.taskNotes['task-backup-1'], '旧笔记');
    expect(
      () => PersonalBackup.merge(original,
        const PersonalSnapshot(tasks: [
          TaskItem(id: 'task-backup-1', title: '不同内容', subject: '数学'),
        ])),
      throwsA(isA<StateError>()),
    );
    expect(original.tasks.single.title, '化学课堂复习');
  });

  test('guest export and file reimport survive browser storage reset', () async {
    final original = PocketStore();
    addTearDown(original.dispose);
    await original.openGuest();
    original.addTask('语文阅读记录', '语文');
    final task = original.tasks.single;
    original.setTaskNote(task.id, '重要的学习笔记');
    original.addCourse(name: '地理', weekday: 2,
      startMinute: 480, endMinute: 525);
    await original.flush();
    final raw = await original.exportGuestBackup();

    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
    final restored = PocketStore();
    addTearDown(restored.dispose);
    await restored.openGuest();
    final archive = PersonalBackup.decode(raw);
    await expectLater(
      restored.mergeGuestBackup(archive, confirmed: false),
      throwsA(isA<StateError>()),
    );
    expect(restored.tasks, isEmpty);
    final merged = await restored.mergeGuestBackup(archive, confirmed: true);
    expect(merged.tasksAdded, 1);
    await restored.flush();
    expect(restored.tasks.single.title, '语文阅读记录');
    expect(restored.noteFor(task.id), '重要的学习笔记');
    expect(restored.courses.single.name, '地理');
    final second = await restored.mergeGuestBackup(archive, confirmed: true);
    expect(second.tasksAdded, 0);
    expect(restored.tasks, hasLength(1));

    final restarted = PocketStore();
    addTearDown(restarted.dispose);
    await restarted.openGuest();
    expect(restarted.tasks.single.title, '语文阅读记录');
    expect(restarted.noteFor(task.id), '重要的学习笔记');
  });

  test('account workspace cannot import another guest backup', () async {
    final store = PocketStore();
    addTearDown(store.dispose);
    await store.openGuest();
    store.addTask('设备记录', '数学');
    final backup = PersonalBackup.decode(await store.exportGuestBackup());
    await store.openAccount(
      origin: 'https://academic.example.com',
      identity: {
        'instanceId': 'instance-one',
        'userId': 'student-a',
        'role': 'student',
        'authorizedClassIds': ['class-a'],
        'cacheScope': 'haiz/v1/instance-one/student-a',
      },
    );
    await expectLater(store.mergeGuestBackup(backup, confirmed: true),
        throwsA(isA<StateError>()));
    await expectLater(store.exportGuestBackup(),
        throwsA(isA<StateError>()));
    expect(store.tasks, isEmpty);
  });
  testWidgets('prepared guest backup is erased on identity scope change',
      (tester) async {
    final store = PocketStore();
    addTearDown(store.dispose);
    await store.openGuest();
    store.addTask('本机访客私人记录', '数学');

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: PocketBackupSheet(store: store)),
    ));
    await tester.tap(find.byKey(const Key('backup-prepare-export')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('backup-save-json')), findsOneWidget);

    store.lock();
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('backup-save-json')), findsNothing);

    // Reopening the same local installation must not revive the old prepared
    // export. A new user action is required for every new session generation.
    await store.openGuest();
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('backup-save-json')), findsNothing);
  });

}
