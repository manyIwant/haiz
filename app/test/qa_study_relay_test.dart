// Group 10 regression: the ordinary study-note save must finish without
// framework exceptions (2.0: the note is a field of the task editor).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/features/tasks/task_editor.dart';
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
      final taskId = store.tasks.single.id;
      await tester.pumpWidget(
        MaterialApp(
          home: PocketSkin(
            colors: PocketPalette.forName('porcelain'),
            child: Scaffold(body: Builder(builder: (context) => TextButton(
              onPressed: () => showTaskEditor(context, store: store, task: store.tasks.single),
              child: const Text('打开任务'),
            ))),
          ),
        ),
      );
      await tester.tap(find.text('打开任务'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('task-note')), '虚构学习思路');
      await tester.pump();
      await tester.tap(find.byKey(const Key('save-task')));
      await tester.pumpAndSettle();
      expect(store.noteFor(taskId), '虚构学习思路');
      expect(tester.takeException(), isNull);
    },
  );
}
