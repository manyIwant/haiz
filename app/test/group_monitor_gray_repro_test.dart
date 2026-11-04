import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/domain/message_intake_bridge.dart';
import 'package:haiz_pocket_flutter/features/inbox/inbox_screen.dart';
import 'package:haiz_pocket_flutter/ui/kit.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

/// Pages have a pinned header; tester.ensureVisible aligns to the very top
/// and would park the target under it (real focus traversal does not).
Future<void> reveal(WidgetTester tester, Finder finder) async {
  await Scrollable.ensureVisible(tester.element(finder), alignment: .5);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('Android group monitor expands and scrolls without a grey error widget',
      (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    messenger.setMockMethodCallHandler(MessageIntakeBridge.channel, (call) async {
      if (call.method == 'getEntries') return <Map<String, Object?>>[];
      if (call.method == 'getWechatDiagnostics') {
        return <String, Object?>{
          'listenerConnected': false,
          'observedCount': 0,
          'savedCount': 0,
          'lastObservedAt': 0,
          'lastResult': '',
        };
      }
      if (call.method == 'getConfiguration') {
        return <String, Object?>{
          'enabled': false, 'granted': false, 'wechat': false, 'groups': '',
        };
      }
      if (call.method == 'setConfiguration') {
        return <String, Object?>{
          'enabled': true, 'granted': false, 'wechat': true, 'groups': '高一13班',
        };
      }
      return true;
    });
    addTearDown(() {
      messenger.setMockMethodCallHandler(MessageIntakeBridge.channel, null);
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
      debugDefaultTargetPlatformOverride = null;
    });
    final store = PocketStore();
    addTearDown(store.dispose);
    await store.load();
    await tester.pumpWidget(MaterialApp(
      builder: (context, child) => PocketSkin(
        colors: PocketPalette.forName('porcelain'),
        child: child ?? const SizedBox.shrink(),
      ),
      home: Scaffold(body: InboxScreen(store: store, onSaved: () {})),
    ));
    await tester.pumpAndSettle();

    const toggleKey = Key('monitor-settings-toggle');
    const panelKey = Key('monitor-settings-panel');
    const groupsKey = Key('monitor-groups-input');
    expect(find.byKey(panelKey), findsNothing);
    await reveal(tester, find.byKey(toggleKey));
    await tester.tap(find.byKey(toggleKey));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.byKey(panelKey), findsOneWidget);
    expect(find.byKey(const Key('enable-wechat')), findsOneWidget);
    expect(find.byKey(const Key('wechat-diag-status')), findsOneWidget);
    expect(find.text('微信监测未开启'), findsOneWidget);
    expect(find.byKey(groupsKey), findsOneWidget);

    await tester.ensureVisible(find.byKey(groupsKey));
    await tester.enterText(find.byKey(groupsKey), '高一13班');
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.ensureVisible(find.text('保存并开启监测'));
    await tester.pumpAndSettle();
    expect(find.text('保存并开启监测'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await reveal(tester, find.byKey(toggleKey));
    await tester.tap(find.byKey(toggleKey));
    await tester.pumpAndSettle();
    expect(find.byKey(panelKey), findsNothing);
    await tester.tap(find.byKey(toggleKey));
    await tester.pumpAndSettle();
    expect(find.byKey(panelKey), findsOneWidget);
    expect(tester.takeException(), isNull);
    debugDefaultTargetPlatformOverride = null;
  });
}
