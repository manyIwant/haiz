---
name: haiz-00-orchestrator
description: "Use when coordinating the HAIZ App 2.0 Flutter redesign or any substantial multi-phase refactor and deciding which focused HAIZ skills apply."
---

# haiz-00-orchestrator

## 何时使用
负责分配工作、执行次序、避免把 30 个 Skill 同时倒进上下文。必须从当前仓库状态开始，而不是想象中的 HAIZ。

## 实施流程
1. 首先 `git status --short`, `git branch --show-current`, `git rev-parse HEAD`，记录真实基线。未经授权不得提交到 main、覆盖当前改动或直接发版。
2. 明确当前阶段：**审查 → 视觉方向 → 可运行垂直切片 → 数据可靠性 → 端到端验收 → 发布候选**。各阶段交付可查看的产物。不要每个小细节都要求人类确认。
3. 最多选择 2–4 个当次真正相关的 Skill：视觉用 `haiz-design-direction`、`haiz-anti-ai-ui`、`haiz-visual-qa`；数据用 `haiz-offline-sync`、`haiz-data-migration`；Flutter 用 `haiz-flutter-architecture` 等。
4. 对每项关键发现区分【代码直接确认】【运行复现】【待真机验证】【创意建议】。若缺证据，不要把猜测写成缺陷。
5. 第一版目标是**真实可运行、具有代际差异**的核心产品体验：今日、任务、课表、收件、专注、设置。不要拿纯静态概念稿冒充功能。
6. 每个阶段输出：变更文件、运行命令与结果、截图/录屏位置、可复现的剩余问题、回退点。

## 验收条件
- 不会丢失旧账号、访客数据或历史任务；没有破坏原签名和主站。
- 第一版既有可操作的功能，也有审美显著升级的主要页面。
- 失败的测试被如实记录，而不是隐藏或空口宣称通过。

## HAIZ 特别注意
设计自主权很大，但必须避免没意义标语、假校园数据、假联网状态、越权通知采集、擅自外发私人数据。

## 相关文件和参考
- `app/lib/main.dart`
- `app/lib/core/pocket_store.dart`
- `app/lib/ui`
- `docs/pocket-production-acceptance.md`
