import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/app/haiz_app.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/features/inbox/inbox_screen.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

import 'support/frame.dart';

String _iso(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

DateTime _today() {
  final n = DateTime.now();
  return DateTime(n.year, n.month, n.day);
}

Future<PocketStore> _boot(WidgetTester tester, {bool welcomed = true, bool reduceMotion = false}) async {
  phoneSize(tester);
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
  SharedPreferencesAsyncPlatform.instance = InMemorySharedPreferencesAsync.withData({
    if (welcomed) 'haiz/welcome/v2': true,
  });
  final store = PocketStore();
  addTearDown(store.dispose);
  await tester.pumpWidget(MediaQuery(
    data: MediaQueryData(size: const Size(390, 844), disableAnimations: reduceMotion),
    child: HaizApp(store: store),
  ));
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
  await tester.pumpAndSettle();
  return store;
}

Future<void> _end(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump(const Duration(seconds: 1));
}

Future<void> _tab(WidgetTester tester, String name) async {
  await tester.tap(find.byKey(Key('tab-$name')));
  await tester.pumpAndSettle();
}

Future<void> _capture(WidgetTester tester, String text, {bool memo = false}) async {
  await tester.tap(find.byKey(const Key('capture-button')));
  await tester.pumpAndSettle();
  if (memo) {
    await tester.tap(find.text('备忘').last);
    await tester.pumpAndSettle();
  }
  await tester.enterText(find.byKey(const Key('capture-input')), text);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('first launch shows a local welcome; starting opens 今天', (tester) async {
    final store = await _boot(tester, welcomed: false);
    expect(find.byKey(const Key('welcome-start')), findsOneWidget);
    expect(find.text('HAIZ'), findsOneWidget);
    await tester.tap(find.byKey(const Key('welcome-start')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('tab-today')), findsOneWidget);
    for (final label in ['今天', '待办', '课表', '收件', '我的']) {
      expect(find.text(label), findsWidgets);
    }
    expect(store.namespace, startsWith('haiz/guest/v1/'));
    await _end(tester);
  });

  testWidgets('a capture draft survives closing the sheet and switching tabs', (tester) async {
    await _boot(tester);
    await _capture(tester, '周五前交英语作文');
    Navigator.of(tester.element(find.byKey(const Key('capture-input')))).pop();
    await tester.pumpAndSettle();
    await _tab(tester, 'schedule');
    await _tab(tester, 'tasks');
    await tester.tap(find.byKey(const Key('capture-button')));
    await tester.pumpAndSettle();
    final field = tester.widget<TextField>(find.byKey(const Key('capture-input')));
    expect(field.controller!.text, '周五前交英语作文');
    await _end(tester);
  });

  testWidgets('capture offers a date and a subject but applies them only when tapped', (tester) async {
    final store = await _boot(tester);
    await _capture(tester, '明天交物理实验报告');
    expect(find.byKey(const Key('capture-date-suggestion')), findsOneWidget);
    expect(find.byKey(const Key('capture-subject-suggestion')), findsOneWidget);
    await tester.tap(find.byKey(const Key('capture-submit')));
    await tester.pumpAndSettle();
    expect(store.tasks.single.dueIso, isNull, reason: 'a suggestion is not a decision');
    expect(store.tasks.single.subject, '其他');

    await _capture(tester, '后天带物理实验器材');
    await tester.tap(find.byKey(const Key('capture-date-suggestion')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('capture-subject-suggestion')));
    await tester.pumpAndSettle();
    expect(find.textContaining('添加任务 · 物理'), findsOneWidget);
    await tester.tap(find.byKey(const Key('capture-submit')));
    await tester.pumpAndSettle();
    final task = store.tasks.firstWhere((t) => t.title == '后天带物理实验器材');
    expect(task.dueIso, _iso(_today().add(const Duration(days: 2))));
    expect(task.subject, '物理');
    await _end(tester);
  });

  testWidgets('a memo is saved as a memo and never appears as a task', (tester) async {
    final store = await _boot(tester);
    await _capture(tester, '问老师纸带打点的误差来源', memo: true);
    expect(find.text('保存为备忘，不会出现在待办里'), findsOneWidget);
    await tester.tap(find.byKey(const Key('capture-submit')));
    await tester.pumpAndSettle();
    expect(store.tasks, isEmpty);
    expect(store.notes.single.text, '问老师纸带打点的误差来源');
    await _tab(tester, 'tasks');
    await tester.tap(find.textContaining('备忘 1'));
    await tester.pumpAndSettle();
    expect(find.text('问老师纸带打点的误差来源'), findsOneWidget);
    await _end(tester);
  });

  testWidgets('ticking a task saves first, holds the row, folds it, and undo restores it', (tester) async {
    final store = await _boot(tester);
    store.addTask('练习册 P36', '数学', due: _today());
    await tester.pumpAndSettle();
    final id = store.tasks.single.id;
    await tester.tap(find.byKey(Key('task-check-$id')));
    await tester.pump();
    expect(store.tasks.single.completed, isTrue, reason: 'durable before any animation');
    expect(store.metaFor(id).completedAt, isNotNull);
    expect(find.text('练习册 P36'), findsWidgets, reason: 'kept in place for a moment');
    await tester.pump(const Duration(milliseconds: 1400));
    await tester.pumpAndSettle();
    expect(find.byKey(Key('task-check-$id')), findsNothing);
    await tester.tap(find.text('撤销'));
    await tester.pumpAndSettle();
    expect(store.tasks.single.completed, isFalse);
    expect(find.byKey(Key('task-check-$id')), findsOneWidget);
    await _end(tester);
  });

  testWidgets('reduced motion completes immediately without a hold', (tester) async {
    final store = await _boot(tester, reduceMotion: true);
    store.addTask('尽快完成', '数学', due: _today());
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(Key('task-check-${store.tasks.single.id}')));
    await tester.pump();
    expect(store.tasks.single.completed, isTrue);
    await _end(tester);
  });

  testWidgets('editing keeps the id; deletion is undoable and restorable from 最近删除', (tester) async {
    final store = await _boot(tester);
    store.addTask('整理实验材料', '物理');
    await _tab(tester, 'tasks');
    final id = store.tasks.single.id;
    await tester.tap(find.text('整理实验材料'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('task-title')), '完成实验报告');
    await tester.enterText(find.byKey(const Key('task-note')), '第 3 组数据重测');
    await tester.pump();
    await tester.tap(find.byKey(const Key('save-task')));
    await tester.pumpAndSettle();
    expect(store.tasks.single.id, id);
    expect(store.tasks.single.title, '完成实验报告');
    expect(store.noteFor(id), '第 3 组数据重测');

    await tester.tap(find.text('完成实验报告'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('删除'));
    await tester.pumpAndSettle();
    expect(store.tasks, isEmpty);
    await tester.tap(find.text('撤销'));
    await tester.pumpAndSettle();
    expect(store.tasks.single.id, id);
    expect(store.noteFor(id), '第 3 组数据重测');

    store.deleteTask(id);
    await tester.pumpAndSettle();
    await tester.tap(find.text('最近删除'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('恢复'));
    await tester.pumpAndSettle();
    expect(store.tasks.single.id, id);
    expect(store.noteFor(id), '第 3 组数据重测');
    await _end(tester);
  });

  testWidgets('one course added to several days fills the week grid', (tester) async {
    final store = await _boot(tester);
    await _tab(tester, 'schedule');
    expect(find.text('还没有课表'), findsOneWidget);
    await tester.tap(find.byKey(const Key('add-first-course')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('course-name')), '数学');
    await tester.enterText(find.byKey(const Key('course-place')), '明德楼 302');
    final today = DateTime.now().weekday;
    final other = today == 1 ? 2 : 1;
    await tester.tap(find.text(const ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][other - 1]).last);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('save-course')));
    await tester.pumpAndSettle();
    expect(store.courses, hasLength(2));
    expect(store.courses.map((c) => c.weekday).toSet(), {today, other});
    expect(store.courses.every((c) => c.location == '明德楼 302'), isTrue);
    expect(find.byKey(const Key('schedule-mode')), findsOneWidget);
    await _end(tester);
  });

  testWidgets('focus: start, persistent bar, pause, finish records exactly once', (tester) async {
    final store = await _boot(tester);
    var clock = DateTime(2026, 11, 4, 10, 0);
    store.now = () => clock;
    store.addTask('背 Unit 4 单词', '英语', due: _today());
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('专注'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('25 分钟'));
    await tester.pump();
    await tester.tap(find.byKey(const Key('focus-start')));
    await tester.pump();
    expect(store.focusRunning, isTrue);
    await tester.tap(find.byKey(const Key('focus-close')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('focus-bar')), findsOneWidget);
    clock = clock.add(const Duration(minutes: 10));
    await tester.tap(find.byTooltip('暂停'));
    await tester.pump();
    expect(store.focusPaused, isTrue);
    expect(store.focusRemaining, 15 * 60);
    await tester.tap(find.byKey(const Key('focus-bar')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('focus-finish')));
    await tester.pumpAndSettle();
    expect(store.focusLogs.single.minutes, 10);
    expect(store.focusSession, isNull);
    await tester.tap(find.byKey(const Key('focus-close')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('focus-bar')), findsNothing);
    await _end(tester);
  });

  testWidgets('a failed save shows a retry banner that recovers', (tester) async {
    final store = await _boot(tester);
    var fail = true;
    await store.openCloudAccount(
      userId: '11111111-1111-4111-8111-111111111111',
      read: () async => null,
      write: (_) async { if (fail) throw StateError('offline'); },
    );
    await tester.pumpAndSettle();
    store.addTask('断网时添加', '数学', due: _today());
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('retry-save')), findsOneWidget);
    fail = false;
    await tester.tap(find.byKey(const Key('retry-save')));
    await tester.pumpAndSettle();
    expect(store.storageError, isNull);
    expect(find.byKey(const Key('retry-save')), findsNothing);
    await _end(tester);
  });

  testWidgets('dark theme renders every destination without errors', (tester) async {
    final store = await _boot(tester);
    store.setThemeMode('dark');
    store.addTask('夜间检查', '化学', due: _today());
    store.addCourse(name: '化学', weekday: DateTime.now().weekday, startMinute: 0, endMinute: 1439);
    await tester.pumpAndSettle();
    for (final t in ['tasks', 'schedule', 'inbox', 'me', 'today']) {
      await _tab(tester, t);
      expect(tester.takeException(), isNull);
    }
    expect(Theme.of(tester.element(find.byKey(const Key('tab-today')))).brightness, Brightness.dark);
    await _end(tester);
  });

  testWidgets('inbox text with no clear homework can be kept as a memo', (tester) async {
    phoneSize(tester);
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
    SharedPreferencesAsyncPlatform.instance = InMemorySharedPreferencesAsync.empty();
    final store = PocketStore();
    addTearDown(store.dispose);
    await store.load();
    await tester.pumpWidget(haizFrame(InboxScreen(store: store, onSaved: () {})));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('inbox-text')), '下周三下午家长会，请提前告知家长。');
    await tester.pump();
    await tester.tap(find.byKey(const Key('inbox-extract')));
    await tester.pumpAndSettle();
    expect(store.tasks, isEmpty);
    await tester.tap(find.text('保存为备忘'));
    await tester.pumpAndSettle();
    expect(store.tasks, isEmpty);
    expect(store.notes.single.text, '下周三下午家长会，请提前告知家长。');
    await _end(tester);
  });
}
