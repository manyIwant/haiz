import 'package:flutter_test/flutter_test.dart';
import 'package:haiz_pocket_flutter/core/pocket_store.dart';
import 'package:haiz_pocket_flutter/domain/pocket_models.dart';
import 'package:haiz_pocket_flutter/domain/planning.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';

void main() {
  setUp(() {
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
  });

  test('filters keep undated tasks visible and order deadlines', () {
    final now = DateTime(2026, 10, 29);
    final tasks = [
      const TaskItem(id: 'undated', title: '整理笔记', subject: '数学'),
      const TaskItem(
        id: 'future',
        title: '准备报告',
        subject: '语文',
        dueIso: '2026-11-10',
      ),
      const TaskItem(
        id: 'overdue',
        title: '完成测量',
        subject: '物理',
        dueIso: '2026-10-27',
      ),
      const TaskItem(
        id: 'tomorrow',
        title: '背单词',
        subject: '英语',
        dueIso: '2026-10-30',
      ),
      const TaskItem(
        id: 'done',
        title: '已结束',
        subject: '化学',
        completed: true,
        dueIso: '2026-10-25',
      ),
    ];
    final open = tasks.where((t) => !t.completed);
    final groups = groupByDue(open, now);
    expect(groups.map((g) => g.$1), [
      DueBucket.overdue, DueBucket.tomorrow, DueBucket.later, DueBucket.none,
    ]);
    expect(groups.expand((g) => g.$2).map((x) => x.id), [
      'overdue',
      'tomorrow',
      'future',
      'undated',
    ]);
    // 今天 shows overdue + today + tomorrow only.
    expect(todayGroups(tasks, now).expand((g) => g.$2).map((x) => x.id), [
      'overdue',
      'tomorrow',
    ]);
    expect(dueLabel(tasks[2], now), '逾期 2 天');
    expect(dueLabel(tasks[3], now), '明天');
    expect(dueLabel(tasks[1], now), '11月10日');
    expect(dueLabel(tasks[0], now), '');
  });

  test(
    'editing a task keeps ID, completion, source, and private note',
    () async {
      final store = PocketStore();
      addTearDown(store.dispose);
      await store.load();
      store.addTask('物理实验', '物理', source: '手动导入', originalNotice: '请完成实验报告');
      final original = store.tasks.single;
      store.setTaskNote(original.id, '已经完成数据采集');
      store.chooseFocusTask(original.id);
      store.toggleTask(original.id);
      expect(
        store.updateTask(
          original.id,
          title: '纸带实验报告',
          subject: '物理',
          due: DateTime(2026, 10, 31),
        ),
        isTrue,
      );
      await store.flush();

      final restarted = PocketStore();
      addTearDown(restarted.dispose);
      await restarted.load();
      final updated = restarted.tasks.single;
      expect(updated.id, original.id);
      expect(updated.title, '纸带实验报告');
      expect(updated.completed, isTrue);
      expect(updated.dueIso, '2026-10-31');
      expect(updated.originalNotice, '请完成实验报告');
      expect(restarted.noteFor(original.id), '已经完成数据采集');
      expect(restarted.activeTaskId, original.id);

      expect(
        restarted.updateTask(original.id, title: '复习', subject: '物理'),
        isTrue,
      );
      expect(restarted.tasks.single.dueIso, isNull);
    },
  );

  test(
    'delete undo restores the private note but not into another scope',
    () async {
      final store = PocketStore();
      addTearDown(store.dispose);
      await store.load();
      store.addTask('数学复习', '数学');
      final original = store.tasks.single;
      store.setTaskNote(original.id, '第六页');
      store.chooseFocusTask(original.id);
      store.deleteTask(original.id);
      expect(store.tasks, isEmpty);
      expect(
        store.restoreTask(original, note: '第六页', reactivate: true),
        isTrue,
      );
      await store.flush();
      expect(store.noteFor(original.id), '第六页');
      expect(store.activeTaskId, original.id);

      store.lock();
      expect(store.restoreTask(original, note: '不允许'), isFalse);
    },
  );
}
