---
name: haiz-repo-audit
description: "Use when inspecting current HAIZ Flutter code, inventorying features, recording bugs and distinguishing verified defects from UX proposals before redesign."
---

# haiz-repo-audit

## 何时使用
重构基线审计；不要拿旧 README 的版本号代替最新发行状态。

## 实施流程
1. 从 `app/pubspec.yaml`、`app/lib/main.dart`、`app/lib/core`、`app/lib/ui`、`app/test`、`app/android`、`app/ios`、`app/web`、`pocket`、`supabase/migrations` 建立功能依赖图。
2. 对每个流程检查用户入口→数据模型→持久化→跨端→异常→撤销→测试；标出死入口、未链接状态、假成功提示。
3. 优先审查 `TodayPage` 未注入 AcademicSession、Memo 实际写任务、带版本号整快照写云端、专注计时器仅内存状态、主入口在线 WebView。
4. 以路径和行号提供证据，运行 `flutter analyze`、`flutter test`、Web 构建（工具可用时），记录真实命令及输出。
5. 与公开 release/更新清单交叉核对；不要以绿色的证据生成工作流代替真机验收。

## 验收条件
- 有每个 P0/P1 问题的路径、重现步骤、用户影响与修复候选。
- 有保留/重构/淘汰的功能清单。
- 与代码和发布状态不一致的文档被列入任务，不是当成事实。
