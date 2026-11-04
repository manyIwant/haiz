---
name: haiz-tests-goldens
description: "Use when building HAIZ Flutter unit, widget, golden and integration tests for new designs, workflows and cross-account safety."
---

# haiz-tests-goldens

## 何时使用
测试应该证明用户行为和数据不变量，而不只是某个 Widget 能 build。

## 实施流程
1. 将测试分为 domain / repository / widget / golden / integration / release acceptance。
2. 新增任务、撤销、快速备忘录、课程编辑、通知审核、后台专注恢复等提供独立确定性测试。
3. 用固定时钟、随机 ID 注入、假 HTTP、仓库模拟、受控存储失败场景减少 flaky tests。
4. 关键 golden：白天/暗色、小屏、长中文文字、空列表、错误、加载、键盘、200% 字体。
5. RLS 与云冲突不能只靠 mock；需单独真实后端/测试数据库的隔离回归，使用虚构账户与资料。
6. 执行 `flutter analyze`, `flutter test`, `flutter build web` 与 Android build，报告设备/分支/commit 和真实结果。

## 验收条件
- 测试失败不被跳过来制造绿色结果。
- 修复旧版已知回归后保留对应测试。
- 每项“已完成”有可重复执行的验证命令。
