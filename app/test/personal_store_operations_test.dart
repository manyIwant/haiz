import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

Map<String, dynamic> _identity(String user) => {
  'instanceId': 'instance-one',
  'userId': user,
  'role': 'student',
  'authorizedClassIds': ['class-a'],
  'cacheScope': 'haiz/v1/instance-one/$user',
};

Future<PocketStore> _accountStore({String user = 'student-a'}) async {
  final store = PocketStore();
  addTearDown(store.dispose);
  await store.load();
  await store.openAccount(
    origin: 'https://academic.example.com',
    identity: _identity(user),
  );
  return store;
}

Future<void> _openA(PocketStore store) => store.openAccount(
  origin: 'https://academic.example.com',
  identity: _identity('student-a'),
);

void main() {
  setUp(
    () => SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty(),
  );

  test('personal edits persist within the owner namespace across reload', () async {
    final a = await _accountStore();
    a.addTask('整理笔记', '数学');
    final task = a.tasks.single;
    a.toggleTask(task.id);
    a.setTaskNote(task.id, '私人思路');
    a.chooseFocusTask(task.id);
    a.addCourse(name: '物理', weekday: 2, startMinute: 480, endMinute: 525);
    a.setAppearance('ocean');
    a.setDay(2);
    await a.flush();
    final namespace = a.namespace;

    final restarted = await _accountStore();
    expect(restarted.namespace, namespace);
    expect(restarted.tasks.single.completed, isTrue);
    expect(restarted.noteFor(task.id), '私人思路');
    expect(restarted.activeTask?.id, task.id);
    expect(restarted.courses.single.name, '物理');
    expect(restarted.appearance, 'ocean');
  });

  test('writes are rejected before any namespace is open', () async {
    final locked = PocketStore();
    addTearDown(locked.dispose);
    locked.addTask('不应出现', '数学');
    expect(locked.tasks, isEmpty);

    await locked.load();
    locked.addTask('访客任务', '语文');
    await locked.flush();
    expect(locked.tasks.single.title, '访客任务');
  });

  test('deleting a task removes only its own private note', () async {
    final store = await _accountStore();
    store.addTask('任务一', '数学');
    store.addTask('任务二', '英语');
    final first = store.tasks.last;
    final second = store.tasks.first;
    store.setTaskNote(first.id, '一');
    store.setTaskNote(second.id, '二');

    store.deleteTask(first.id);
    await store.flush();

    expect(store.tasks.single.id, second.id);
    expect(store.noteFor(first.id), isEmpty);
    expect(store.noteFor(second.id), '二');
  });

  test('notes cannot be attached to another account task id', () async {
    final a = await _accountStore(user: 'student-a');
    a.addTask('A 的任务', '数学');
    final aTask = a.tasks.single;
    a.setTaskNote(aTask.id, 'A 的笔记');
    await a.flush();

    final b = await _accountStore(user: 'student-b');
    b.setTaskNote(aTask.id, '通过猜测写入');
    await b.flush();

    expect(b.tasks, isEmpty);
    expect(b.noteFor(aTask.id), isEmpty);
    await _openA(a);
    expect(a.noteFor(aTask.id), 'A 的笔记');
  });

  test('focus timer stops and resets when the account changes', () async {
    final store = await _accountStore();
    store.setFocusDuration(1);
    store.startFocus();
    expect(store.focusRunning, isTrue);

    await store.openGuest();
    expect(store.focusRunning, isFalse);
    expect(store.focusRemaining, store.focusTargetMinutes * 60);
    expect(store.focusLogs, isEmpty);

    await _openA(store);
    expect(store.focusLogs, isEmpty);
    expect(store.todayFocusMinutes, 0);
  });

  test('a zero-length focus session invents no learning record', () async {
    final a = await _accountStore();
    a.setFocusDuration(1);
    a.startFocus();
    a.finishFocus(auto: true);
    await a.flush();
    expect(a.focusLogs, isEmpty);

    final b = await _accountStore(user: 'student-b');
    expect(b.focusLogs, isEmpty);
  });

  test('guest work is separate from account work after both are flushed', () async {
    final store = await _accountStore();
    store.addTask('账号任务', '数学');
    await store.flush();

    await store.openGuest();
    store.addTask('访客任务', '语文');
    await store.flush();
    expect(store.tasks.single.title, '访客任务');

    await _openA(store);
    expect(store.tasks.single.title, '账号任务');
  });
}
