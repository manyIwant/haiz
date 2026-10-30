import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/domain/message_intake_bridge.dart';
import 'package:haiz_pocket_flutter/ui/inbox_page.dart';
import 'package:haiz_pocket_flutter/ui/kit.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

void main() {
  setUp(() {
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
  });

  test(
    'native message bridge exposes durable inbox and strict settings',
    () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      final saved = <String, Object?>{};
      final now = DateTime(2026, 10, 29, 9).millisecondsSinceEpoch;
      final entries = [
        <String, Object?>{
          'id': 'message-1',
          'source': 'QQ 群通知',
          'title': '作业通知群',
          'text': '【HAIZ任务】物理｜完成实验报告｜2026-10-30｜未验证',
          'receivedAt': now,
        },
      ];
      final channel = MessageIntakeBridge.channel;
      final calls = <String>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (call) async {
            calls.add(call.method);
            switch (call.method) {
              case 'getEntries':
                return entries;
              case 'getConfiguration':
                return <String, Object?>{
                  'enabled': false,
                  'granted': false,
                  'groups': '',
                };
              case 'setConfiguration':
                saved.addAll((call.arguments as Map).cast<String, Object?>());
                return <String, Object?>{
                  'enabled': saved['enabled'],
                  'granted': false,
                  'groups': saved['groups'],
                };
              case 'removeEntry':
                entries.removeWhere(
                  (e) => e['id'] == (call.arguments as Map)['id'],
                );
                return true;
              default:
                return true;
            }
          });
      addTearDown(() {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, null);
      });
      expect(MessageIntakeBridge.available, isTrue);
      expect((await MessageIntakeBridge.entries()).single.id, 'message-1');
      final config = await MessageIntakeBridge.configuration();
      expect(config?.enabled, isFalse);
      await MessageIntakeBridge.configure(enabled: true, groups: '高一13班');
      expect(saved['groups'], '高一13班');
      expect(calls, contains('setConfiguration'));
      await MessageIntakeBridge.remove('message-1');
      expect(await MessageIntakeBridge.entries(), isEmpty);
      debugDefaultTargetPlatformOverride = null;
    },
  );

  testWidgets(
    'captured school-group notice requires explicit review and save',
    (tester) async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final entries = <Map<String, Object?>>[
        {
          'id': 'notice-1',
          'source': 'QQ 群通知',
          'title': '示例班群',
          'text': '【HAIZ任务】物理｜完成实验报告｜2026-10-30｜未验证',
          'receivedAt': DateTime(2026, 10, 29).millisecondsSinceEpoch,
        },
      ];
      final calls = <String>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(MessageIntakeBridge.channel, (call) async {
            calls.add(call.method);
            switch (call.method) {
              case 'getEntries':
                return entries;
              case 'getConfiguration':
                return <String, Object?>{
                  'enabled': false,
                  'granted': false,
                  'groups': '',
                };
              case 'removeEntry':
                entries.clear();
                return true;
              default:
                return true;
            }
          });
      addTearDown(() {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(MessageIntakeBridge.channel, null);
      });

      final store = PocketStore();
      addTearDown(store.dispose);
      await store.load();
      var navigated = 0;
      await tester.pumpWidget(
        MaterialApp(
          builder: (context, child) => PocketSkin(
            colors: PocketPalette.forName('porcelain'),
            child: child ?? const SizedBox.shrink(),
          ),
          home: Scaffold(
            body: InboxPage(store: store, onSaved: () => navigated++),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(store.tasks, isEmpty); // No silent task creation.
      expect(find.text('1 条待审阅'), findsOneWidget);
      await tester.ensureVisible(find.text('提取并审核'));
      await tester.tap(find.text('提取并审核'));
      await tester.pumpAndSettle();
      expect(find.text('等待你确认'), findsOneWidget);
      expect(store.tasks, isEmpty);
      await tester.ensureVisible(find.text('确认并加入我的任务'));
      await tester.tap(find.text('确认并加入我的任务'));
      await tester.pumpAndSettle();

      expect(store.tasks.single.title, '完成实验报告');
      expect(store.tasks.single.dueIso, '2026-10-30');
      expect(store.tasks.single.source, contains('QQ 群通知'));
      expect(store.tasks.single.originalNotice, contains('【HAIZ任务】'));
      expect(entries, isEmpty);
      expect(calls, contains('removeEntry'));
      expect(navigated, 1);
      expect(tester.takeException(), isNull);
      debugDefaultTargetPlatformOverride = null;
    },
  );
}
