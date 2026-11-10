// Group 10 regression: the ordinary Study Relay save must finish without
// framework exceptions. This currently exposes the dialog controller lifetime.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/ui/focus_page.dart';
import 'package:haiz_pocket_flutter/ui/kit.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

void main() {
  testWidgets(
    'QA-UI-02 ordinary Study Relay save has no framework exceptions',
    (tester) async {
      SharedPreferencesAsyncPlatform.instance =
          InMemorySharedPreferencesAsync.empty();
      final store = PocketStore();
      addTearDown(store.dispose);
      await store.load();
      store.addTask('虚构数学任务', '数学');
      await store.flush();
      store.chooseFocusTask(store.tasks.single.id);
      final taskId = store.tasks.single.id;
      await tester.pumpWidget(
        MaterialApp(
          home: PocketSkin(
            colors: PocketPalette.forName('porcelain'),
            child: Scaffold(body: FocusPage(store: store)),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('记录学习思路'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).last, '虚构学习思路');
      await tester.tap(find.text('保存到本机'));
      await tester.pumpAndSettle();
      expect(store.noteFor(taskId), '虚构学习思路');
      expect(tester.takeException(), isNull);
    },
  );
}
