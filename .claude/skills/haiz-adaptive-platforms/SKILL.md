---
name: haiz-adaptive-platforms
description: "Use when adapting one Flutter product experience across Android, iOS, Safari PWA and desktop web without pretending all native capabilities are identical."
---

# haiz-adaptive-platforms

## 何时使用
共享业务，平台能力诚实分层；不要为了跨端统一牺牲手势/键盘/安全区。

## 实施流程
1. 建立 Android、iOS Native、Safari/PWA、桌面 Web 的功能矩阵：通知监听、系统分享、文件、OCR、更新、Push、后台服务、导出与离线。
2. 使用能力接口暴露 supported/unsupported/permission-required，不编造通用实现。
3. 处理不同输入方式、返回手势、安全区、系统键盘、字体渲染、颜色与材质、屏幕尺寸。
4. 首次打开导航不依赖在线 WebView；欢迎页需有可立即进入的本地路径。
5. 任何平台差异都有清晰测试与降级方案；尤其 Safari 独立 PWA 与浏览器存储可能不共享。
6. 组件对桌面支持键盘和窗口变化，移动端优先大拇指操作。

## 验收条件
- 平台限制被准确标注，用户知道真实可用功能。
- 核心操作至少在 Android 和浏览器预览中一致有效。
- iPhone 未实机验证时不能声称已生产验收。
