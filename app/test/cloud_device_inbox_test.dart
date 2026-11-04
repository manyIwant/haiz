import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/domain/message_intake_bridge.dart';
import 'package:haiz_pocket_flutter/features/inbox/inbox_screen.dart';
import 'package:haiz_pocket_flutter/ui/kit.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

void main() {
  testWidgets('cloud account needs explicit device inbox consent after switching',
      (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    addTearDown(() => debugDefaultTargetPlatformOverride = null);
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
    final store = PocketStore();
    addTearDown(store.dispose);
    await store.openCloudAccount(
      userId: '11111111-1111-4111-8111-111111111111', read: () async => null, write: (_) async {},
    );
    expect(store.isCloudAccount, isTrue);

    var reads = 0;
    final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    messenger.setMockMethodCallHandler(MessageIntakeBridge.channel, (call) async {
      if (call.method == 'getEntries') {
        reads++;
        return <Map<String, Object?>>[{
          'id': 'local-1',
          'source': '微信群通知',
          'title': '班群',
          'text': '数学作业明天提交',
          'receivedAt': DateTime.now().millisecondsSinceEpoch,
        }];
      }
      if (call.method == 'getConfiguration') {
        return {'enabled': false, 'granted': false, 'groups': '', 'wechat': false};
      }
      return true;
    });
    addTearDown(() => messenger.setMockMethodCallHandler(MessageIntakeBridge.channel, null));

    Future<void> showInbox(String id) async {
      await tester.pumpWidget(MaterialApp(
        builder: (context, child) => PocketSkin(
          colors: PocketPalette.forName('porcelain'),
          child: child ?? const SizedBox.shrink(),
        ),
        home: Scaffold(body: InboxScreen(
          key: ValueKey('inbox-$id'),
          store: store,
          onSaved: () {},
        )),
      ));
      await tester.pumpAndSettle();
    }

    await showInbox('alice');
    expect(reads, 0);
    expect(find.byKey(const Key('unlock-cloud-device-inbox')), findsOneWidget);
    await tester.ensureVisible(find.text('查看本机待审核消息'));
    await tester.tap(find.text('查看本机待审核消息'));
    await tester.pumpAndSettle();
    expect(reads, 0);
    await tester.tap(find.text('确认查看本机消息'));
    await tester.pumpAndSettle();
    expect(reads, 1);
    expect(find.text('1 条待审阅'), findsOneWidget);
    await tester.ensureVisible(find.text('提取并审核'));
    await tester.tap(find.text('提取并审核'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('inbox-commit')));
    await tester.tap(find.byKey(const Key('inbox-commit')));
    await tester.pumpAndSettle();
    expect(store.tasks, hasLength(1));
    expect(store.tasks.single.originalNotice, isEmpty);
    expect(store.tasks.single.source, '本机消息（已确认）');
    final readsBeforeSwitch = reads;

    await store.openCloudAccount(
      userId: '22222222-2222-4222-8222-222222222222', read: () async => null, write: (_) async {},
    );
    await showInbox('bob');
    expect(find.byKey(const Key('unlock-cloud-device-inbox')), findsOneWidget);
    expect(reads, readsBeforeSwitch);
    expect(find.text('1 条待审阅'), findsNothing);
    debugDefaultTargetPlatformOverride = null;
    expect(tester.takeException(), isNull);
  });
}
