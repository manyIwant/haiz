---
name: haiz-visual-qa
description: "Use when visually reviewing HAIZ Flutter builds, comparing before/after screenshot sets and fixing overflow, hierarchy, clutter and AI slop."
---

# haiz-visual-qa

## 何时使用
把 UI 审查变成可比较的截图与实测，而不是“惊艳”“电影感”的形容词。

## 实施流程
1. 固定场景：首次进入、游客空状态、任务密集、课表完整、收件含不确定日期、专注中、登录/错误、暗色主题。
2. 至少比较小屏 Android、标准 iPhone 尺寸、浏览器中窄屏与桌面宽屏，字体放大到 200% 的可读性。
3. 用 Flutter widget/golden tests 或真机截图记录尺寸、DPR、主题、版本；每张必须标明是否真实渲染。
4. 按层级、对齐、间距、文字折行、触摸目标、状态可见性、动画连续性、视觉重复、可信来源逐项批注。
5. 发现错误时重现→定位代码→修复→重截相同场景；不得用效果图代替运行后截图。
6. 形成 before/after + 已验证的问题清单 + 需真机确认项。

## 验收条件
- 主要页面无需用户猜测当前功能入口。
- 长数据不溢出、按钮不遮挡关键内容、错误不与顶部入口重叠。
- 交付有可复现截图命令与准确页面信息。
