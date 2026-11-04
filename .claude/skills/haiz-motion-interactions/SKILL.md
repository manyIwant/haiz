---
name: haiz-motion-interactions
description: "Use when designing production-grade Flutter motion, haptics, gestures, list transitions and responsive micro-interactions without excessive animation."
---

# haiz-motion-interactions

## 何时使用
把动效用作状态解释和空间连续性，不是演示仓库的弹簧效果合集。

## 实施流程
1. 列出交互状态机：press、release、commit、undo、loading、error、cancel；每段动画对应状态变化，不能把写盘延迟到动画结束。
2. 一致的动效词汇：导航连续、列表有节奏地重排、勾选闭合、抽屉滑入与焦点保持；选用 Flutter implicit/explicit/physics animation 的最简单方案。
3. 建立触觉反馈矩阵：重要操作才振动，iOS/Android 自适应，不要每次 hover 都震动。
4. 减少动画必须真正关闭非必要转场，保留状态；低性能平台降级模糊和 Shader。
5. 真实检查慢速交互、快速连续点击、动画中切换账号、系统后台/前台、低帧率场景。
6. 对 GPU 特效建立测量预算，不通过“很顺滑”主观判断。

## 验收条件
- 交互不影响数据一致性、输入焦点或屏幕阅读器。
- 没有为了装饰而出现的脉冲、漂浮粒子、随机闪烁。
- 对 60Hz 目标设备需有真机 profiler 证据。
