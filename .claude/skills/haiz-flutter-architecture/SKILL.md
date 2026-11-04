---
name: haiz-flutter-architecture
description: "Use when refactoring HAIZ Flutter app boundaries, removing oversized widgets and separating presentation, domain, persistence and services without framework dogma."
---

# haiz-flutter-architecture

## 何时使用
降低 `main.dart`、`PocketStore`、`InboxPage` 等文件的耦合，不要求强制迁移到 Riverpod/BLoC。

## 实施流程
1. 绘制当前依赖图和生命期；区分权限身份、业务事实、会话视图、临时 UI 状态。
2. 为单一垂直切片定义清楚的接口（例如 TasksRepository、TaskWorkflow、TaskListController），并写原业务回归测试。
3. 从大组件提取承担单一职责的视图，但不要把每个按钮都拆成三层目录。
4. 主应用监听应尽量细粒度，计时器 tick 不能迫使全部 Scaffold 重算；必要时局部 ListenableBuilder/Selector。
5. 网络/磁盘交互在业务层处理失败与取消，UI 只对可观察状态响应。
6. 每次迁移后运行 tests，确保内存 namespace、写盘时序、通知权限和页面外观不回退。

## 验收条件
- 新增功能可在一个独立模块内定位清楚。
- 关键业务规则能不依赖 Widget 测试。
- 无“架构重构完成”但性能更差、测试更少的情况。

## 相关文件和参考
- `app/lib/main.dart`
- `app/lib/core/pocket_store.dart`
- `app/lib/ui/inbox_page.dart`
