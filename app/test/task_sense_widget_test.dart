import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/domain/pocket_models.dart';
import 'package:haiz_pocket_flutter/ui/kit.dart';
import 'package:haiz_pocket_flutter/ui/today_page.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

void main() {
  setUp(() {
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
  });

  test('confirmed batch persists once and rejects repeat or switched scope',
      () async {
    final store = PocketStore();
    addTearDown(store.dispose);
    await store.load();
    final generation = store.generation;
    final items = [
      const TaskItem(id: 'sense_same_0', title: '物理实验',
          subject: '物理', source: 'HAIZ Sense'),
      const TaskItem(id: 'sense_same_1', title: '复习英语',
          subject: '英语', source: 'HAIZ Sense'),
    ];
    expect(store.addSenseDraftsBatch(items, expectedGeneration: generation), isTrue);
    expect(store.addSenseDraftsBatch(items, expectedGeneration: generation), isFalse);
    await store.flush();
    expect(store.tasks, hasLength(2));
    store.lock();
    expect(store.addSenseDraftsBatch(items, expectedGeneration: generation), isFalse);
  });

  testWidgets('review creates nothing before confirmation and respects selection',
      (tester) async {
    final store = PocketStore();
    addTearDown(store.dispose);
    await store.load();
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
    await tester.pumpWidget(MaterialApp(
      builder: (context, child) => PocketSkin(
        colors: PocketPalette.forName('porcelain'),
        child: child ?? const SizedBox.shrink(),
      ),
      home: AnimatedBuilder(
        animation: store,
        builder: (_, __) => Scaffold(
          body: TodayPage(store: store, onNavigate: (_) {}),
        ),
      ),
    ));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('quick-memo-input')),
      '明天交数学卷子，今晚复习英语',
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('sense-open')));
    await tester.pumpAndSettle();
    expect(find.text('HAIZ Sense · 智能整理'), findsOneWidget);
    expect(store.tasks, isEmpty);

    await tester.tap(find.byKey(const Key('sense-select-1')));
    await tester.pumpAndSettle();
    final confirm = find.byKey(const Key('sense-confirm'));
    await tester.ensureVisible(confirm);
    await tester.pumpAndSettle();
    await tester.tap(confirm);
    await tester.pumpAndSettle();

    expect(store.tasks, hasLength(1));
    expect(store.tasks.single.subject, '数学');
    expect(store.tasks.single.title, '明天交数学卷子');
    expect(store.tasks.single.dueIso, isNotNull);
    await store.flush();
  });
}
