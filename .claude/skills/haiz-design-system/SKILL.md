---
name: haiz-design-system
description: "Use when defining or implementing HAIZ Flutter design tokens, components, typography, light/dark themes and platform-specific surfaces."
---

# haiz-design-system

## 何时使用
把现有 `PocketPalette`、`PocketSkin`、`kit.dart` 的视觉约定提炼为可复用设计系统，而非另造一套同名主题。

## 实施流程
1. 盘点颜色、间距、圆角、文字层级、字重、阴影、动效时长、图标、语义状态及其当前使用位置；发现硬编码但不无脑替换。
2. 建立语义 Token（surface, text-primary, text-muted, accent, info, warning, error, focus, divider），支持浅色/深色、对比度、缩放和系统减少动画。
3. 组件从真实工作流中抽取：任务行、来源标记、课程节次、审查候选、同步状态、编辑抽屉、空状态。避免“万能卡片”绑定所有信息。
4. 先做组件的 normal/pressed/disabled/loading/error/empty/long-text/keyboard/upscaled 状态，再投入大规模页面替换。
5. 对比移动端平台习惯：交互手势可有一致产品语言，但返回/安全区/输入法/语义应符合平台。
6. 给组件建立独立预览和 golden 样例。

## 验收条件
- Tokens 解决一致性而不是增加样板层级。
- 每个基础组件有文档化状态与可访问性行为。
- 主题切换后对比度、边界和文本仍然清晰。

## 相关文件和参考
- `app/lib/ui/kit.dart`
- `app/lib/ui/editorial.dart`
- `app/lib/ui/ios_theme.dart`
