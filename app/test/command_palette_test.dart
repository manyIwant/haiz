import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/ui/command_palette.dart';
import 'package:haiz_pocket_flutter/ui/kit.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

Widget _frame(PocketStore store, ValueChanged<int> navigate) => MaterialApp(
  home: PocketSkin(
    colors: PocketPalette.forName('porcelain'),
    child: Scaffold(
      body: Builder(
        builder: (ctx) => TextButton(
          onPressed: () => showHaizCommand(ctx, store, navigate),
          child: const Text('Open search'),
        ),
      ),
    ),
  ),
);

void main() {
  setUp(
    () => SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty(),
  );

  testWidgets(
    'command palette filters local tasks and preserves focus navigation on dismiss',
    (tester) async {
      final store = PocketStore();
      addTearDown(store.dispose);
      await store.load();
      store.addTask('分析斜抛运动', '物理');
      await store.flush();
      int? selected;
      await tester.pumpWidget(_frame(store, (tab) => selected = tab));
      await tester.tap(find.text('Open search'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).last, '斜抛');
      await tester.pumpAndSettle();
      expect(find.text('分析斜抛运动'), findsOneWidget);
      await tester.tap(find.text('分析斜抛运动'));
      await tester.pumpAndSettle();
      expect(store.activeTaskId, store.tasks.single.id);
      expect(selected, 3);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'command palette searches courses and safely closes an empty result',
    (tester) async {
      final store = PocketStore();
      addTearDown(store.dispose);
      await store.load();
      store.addCourse(
        name: '班会课',
        weekday: 5,
        startMinute: 900,
        endMinute: 950,
        location: '报告厅',
      );
      await store.flush();
      int? selected;
      await tester.pumpWidget(_frame(store, (tab) => selected = tab));
      await tester.tap(find.text('Open search'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).last, '报告厅');
      await tester.pumpAndSettle();
      expect(find.text('班会课'), findsOneWidget);
      await tester.tap(find.text('班会课'));
      await tester.pumpAndSettle();
      expect(selected, 1);
      expect(store.selectedWeekday, 5);
      expect(tester.takeException(), isNull);

      await tester.tap(find.text('Open search'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).last, '不存在的课程');
      await tester.pumpAndSettle();
      expect(find.text('没有找到匹配结果。'), findsOneWidget);
      await tester.tap(find.text('关闭'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );
}
