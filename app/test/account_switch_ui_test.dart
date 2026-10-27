import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/ui/kit.dart';
import 'package:haiz_pocket_flutter/ui/today_page.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

Widget _frame(Widget child) => MaterialApp(
  builder: (context, app) => PocketSkin(
    colors: PocketPalette.forName('porcelain'),
    child: app!,
  ),
  home: Scaffold(body: child),
);

void main() {
  setUp(
    () => SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty(),
  );

  testWidgets('task composed before an account switch is not written to either account', (
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

    await tester.pumpWidget(_frame(TodayPage(store: store, onNavigate: (_) {})));
    await tester.tap(find.byTooltip('添加任务'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byType(TextField).last,
      '切换账号后不应写入的任务',
    );

    // The sheet stays open while the account changes underneath it.
    await store.openGuest();

    await tester.tap(find.text('添加到今天'));
    await tester.pumpAndSettle();

    expect(store.tasks, isEmpty);
    expect(find.text('已切换账号，任务未写入任何账号。'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    expect(tester.takeException(), isNull);
  });
}
