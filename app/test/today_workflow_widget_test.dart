import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/ui/kit.dart';
import 'package:haiz_pocket_flutter/ui/today_page.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

void main() {
  setUp(() {
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
  });

  testWidgets('mobile user creates, edits, finishes and restores a task', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
    final store = PocketStore();
    addTearDown(store.dispose);
    await store.load();
    await tester.pumpWidget(
      MaterialApp(
        builder: (context, child) => PocketSkin(
          colors: PocketPalette.forName('porcelain'),
          child: child ?? const SizedBox.shrink(),
        ),
        home: AnimatedBuilder(
          animation: store,
          builder: (context, _) => Scaffold(
            body: TodayPage(store: store, onNavigate: (_) {}),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Create a real user record rather than populating decorative demo content.
    await tester.tap(find.text('新建任务'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('task-title')), '整理实验材料');
    await tester.pump();
    await tester.tap(find.byKey(const Key('save-task')));
    await tester.pumpAndSettle();
    expect(store.tasks.single.title, '整理实验材料');
    expect(find.text('整理实验材料'), findsOneWidget);

    // Edit from the row, without changing its identifier.
    final originalId = store.tasks.single.id;
    await tester.tap(find.text('整理实验材料'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('task-title')), '完成实验报告');
    await tester.pump();
    await tester.tap(find.byKey(const Key('save-task')));
    await tester.pumpAndSettle();
    expect(store.tasks.single.id, originalId);
    expect(store.tasks.single.title, '完成实验报告');

    // Mark completed and retrieve from the completed filter.
    await tester.tap(find.byTooltip('标记完成'));
    await tester.pumpAndSettle();
    expect(store.tasks.single.completed, isTrue);
    await tester.tap(find.text('已完成').first);
    await tester.pumpAndSettle();
    expect(find.text('完成实验报告'), findsOneWidget);

    // Undo deletion and restore the existing task identity.
    await tester.tap(find.byTooltip('任务操作'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('删除任务'));
    await tester.pumpAndSettle();
    expect(store.tasks, isEmpty);
    await tester.tap(find.text('撤销'));
    await tester.pumpAndSettle();
    expect(store.tasks.single.id, originalId);
    expect(tester.takeException(), isNull);
  });
}
