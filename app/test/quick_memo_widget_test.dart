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

  Future<void> showToday(WidgetTester tester, PocketStore store,
      {bool reducedMotion = false}) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
    await tester.pumpWidget(MaterialApp(
      builder: (context, child) => PocketSkin(
        colors: PocketPalette.forName('porcelain'),
        reducedMotion: reducedMotion,
        child: child ?? const SizedBox.shrink(),
      ),
      home: AnimatedBuilder(
        animation: store,
        builder: (context, _) => Scaffold(
          body: TodayPage(store: store, onNavigate: (_) {}),
        ),
      ),
    ));
    await tester.pumpAndSettle();
  }

  testWidgets('quick memo saves and right checkbox animates before checking off',
      (tester) async {
    final store = PocketStore();
    addTearDown(store.dispose);
    await store.load();
    await showToday(tester, store);

    await tester.enterText(
        find.byKey(const Key('quick-memo-input')), '记得带学生证');
    await tester.pump();
    await tester.tap(find.byKey(const Key('quick-memo-add')));
    await tester.pumpAndSettle();

    expect(store.tasks.single.title, '记得带学生证');
    expect(store.tasks.single.subject, '速记');
    expect(store.tasks.single.completed, isFalse);
    expect(find.text('记得带学生证'), findsOneWidget);

    final check = find.byTooltip('标记完成');
    await tester.ensureVisible(check);
    await tester.pumpAndSettle();
    expect(tester.getCenter(check).dx,
        greaterThan(tester.getCenter(find.text('记得带学生证')).dx));

    await tester.tap(check);
    await tester.pump(const Duration(milliseconds: 120));
    expect(store.tasks.single.completed, isFalse);
    await tester.pump(const Duration(milliseconds: 450));
    await tester.pumpAndSettle();
    expect(store.tasks.single.completed, isTrue);
    expect(find.text('记得带学生证'), findsNothing);

    await tester.tap(find.text('撤销'));
    await tester.pumpAndSettle();
    expect(store.tasks.single.completed, isFalse);
    expect(find.text('记得带学生证'), findsOneWidget);
    await store.flush();
  });

  testWidgets('switching account cancels pending completion and clears draft',
      (tester) async {
    final store = PocketStore();
    addTearDown(store.dispose);
    await store.load();
    store.addTask('旧账号未完成任务', '速记');
    await store.flush();
    await showToday(tester, store);

    await tester.enterText(
        find.byKey(const Key('quick-memo-input')), '私密草稿');
    await tester.pump();
    final check = find.byTooltip('标记完成');
    await tester.ensureVisible(check);
    await tester.pumpAndSettle();
    await tester.tap(check);
    await tester.pump(const Duration(milliseconds: 80));
    await store.openGuest();
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();

    expect(store.tasks.single.completed, isFalse);
    final input = tester.widget<TextField>(
        find.byKey(const Key('quick-memo-input')));
    expect(input.controller!.text, isEmpty);
  });

  testWidgets('reduced motion checks off without delaying the store',
      (tester) async {
    final store = PocketStore();
    addTearDown(store.dispose);
    await store.load();
    store.addTask('尽快完成', '速记');
    await showToday(tester, store, reducedMotion: true);
    final check = find.byTooltip('标记完成');
    await tester.ensureVisible(check);
    await tester.pumpAndSettle();
    await tester.tap(check);
    expect(store.tasks.single.completed, isTrue);
  });
}
