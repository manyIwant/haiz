import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/ui/kit.dart';
import 'package:haiz_pocket_flutter/ui/inbox_page.dart';
import 'package:haiz_pocket_flutter/ui/ticker_lab_page.dart';

Widget frame(Widget child) => MaterialApp(
  home: PocketSkin(
    colors: PocketPalette.forName('porcelain'),
    child: Scaffold(body: child),
  ),
);

void main() {
  setUp(
    () => SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty(),
  );
  testWidgets('mobile Inbox accepts pasted teacher-format text for review', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final store = PocketStore();
    await tester.pumpWidget(frame(InboxPage(store: store, onSaved: () {})));
    await tester.enterText(
      find.byKey(const Key('inbox-text')),
      '【HAIZ任务】物理｜完成纸带实验｜2026-10-29｜身份未验证',
    );
    await tester.tap(find.text('提取候选'));
    await tester.pumpAndSettle();
    expect(find.text('等待你确认'), findsOneWidget);
    expect(find.text('完成纸带实验'), findsOneWidget);
    expect(find.textContaining('2026-10-29'), findsWidgets);
    expect(store.tasks, isEmpty); // Not saved before explicit confirmation.
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    store.dispose();
  });

  testWidgets('mobile physics lab renders measuring tools', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final store = PocketStore();
    await tester.pumpWidget(frame(TickerLabPage(store: store, onBack: () {})));
    await tester.pump();
    expect(find.text('纸带上的时间。'), findsOneWidget);
    expect(find.text('01 / 观察小车运动'), findsOneWidget);
    expect(find.text('02 / 测量纸带'), findsOneWidget);
    expect(find.text('03 / 从纸带得到 v–t 图'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    store.dispose();
  });
}
