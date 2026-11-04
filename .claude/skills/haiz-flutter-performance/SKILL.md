---
name: haiz-flutter-performance
description: "Use when diagnosing HAIZ Flutter rendering, startup time, frame jank, shader costs, rebuild storms and large PWA/offline bundles."
---

# haiz-flutter-performance

## 何时使用
性能预算应来自 profile 和设备证据，而不是强制一切 `const` 就宣布优化完成。

## 实施流程
1. 首先采样启动时间、帧时间、过度重建、内存、图片与字体资源、GPU Shader；同时记录设备型号与构建模式。
2. 关注 `PocketStore._ticker` 每秒 notify 与 app root AnimatedBuilder、多个 `BackdropFilter`、Web CanvasKit、异步 OCR Worker 加载。
3. 从 DevTools/Timeline 和 Flutter profile 中定位最慢场景；分离布局、绘制、着色器和 IO 耗时。
4. 使用更窄状态订阅、RepaintBoundary、缓存边界与惰性加载；不要以损坏交互或数据可靠性换帧率。
5. 按平台降级：iOS/Android 不同渲染器、PWA CanvasKit 与首屏、弱设备减少模糊/动画。
6. 提供前后同设备同场景数据；不可验证时明确写“未真机测量”。

## 验收条件
- 不在 Debug 模式性能截图上做 Release 结论。
- 长列表/快速输入/专注计时都不引起无关页面大面积刷新。
- 优化不破坏可访问性和视觉层级。
