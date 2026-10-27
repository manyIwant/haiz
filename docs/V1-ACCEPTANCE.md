# HAIZ v1 Preview · 验收记录

日期：2026-10-27。开发设备：MacBook Air M5 (Apple Silicon)；Flutter 3.47.8，Dart 3.13.7。

## 已完成且验证的内容

- 参考原型基础：本机原有 ZZUPocket-Flutter Flutter 0.1.0，独立复制到 HAIZ-v1，原型未覆盖。
- 新增：通知解析器、通知确认 UI、任务关联专注上下文、原创打点计时器二维交互课件、Web 教师任务编辑/打印/复制。
- Flutter analyze：0 errors / warnings / lint issues（最终版本再次运行）。
- Flutter test：15 tests pass（原有 4 + 新增 11）。
- Flutter build web --release：构建成功。
- Teacher Web：Chromium headless 1200x860 / 390x844 实际渲染截图；JS Console 未观察到 ERROR:CONSOLE。
- App Web：通过 Flutter 构建；本机简单 HTTP 服务首页返回 200。

## 有限制的验证

- Flutter App 的无头 Chromium **截图在当前 Mac 图形环境发生超时**，但不是 Flutter build / test 失败。需要在实际 Safari/Chrome GUI 中进行最终 UI 交互与溢出验收。
- 暂未对用户 Mac 实际点击「收件」及「实验」流程进行全流程浏览器操作；有单元测试覆盖其解析和物理计算。
- Android SDK / 完整 Xcode 之前检测缺失；未构建 APK、IPA，也没有真机测试。
- 没有学校账号、教师授权、班级服务、消息源自动订阅，也没有真实多端数据库同步。
- 本版本是可运行的概念原型，技术、法律与产品风险均要求进一步试点验证。

## 物理实验数据校验

- 50 Hz 原始时间间隔：0.02 s。
- 每 5 个原始时间间隔对应 0.10 s 一个计数点。
- 使用 x = v0*t + 0.5*a*t²；中心差分由相邻计数点距离估算 v。
- 默认 v0=0.22 m/s、a=0.72 m/s²，t=0.50 s 位置差估算速度=0.58 m/s，拟合斜率=0.72 m/s²。
- a=0 时，等时点间距相等，拟合斜率为 0。
- 实际打点计时器还会受摩擦、机械误差、电源、真实计数点测量误差影响，当前未模拟。

## 开源研究边界

- ZZUPocket：MIT，可参考已公开业务结构；没有移植学校特定接口。
- Super Productivity：任务 / 专注交互参考，没有直接复制其 Angular UI 和代码。
- Notice Hub：新加模块 PolyForm Noncommercial，旧上游 MIT；HAIZ 本版的规则解析器独立实现。
- Every Joule：第一课公开的是构建后的网页资产，尚无完整项目源码许可可用于直接移植；HAIZ 本版物理场景独立实现。

## 未来的硬性验收

1. Flutter App GUI 上分别进入全部 5 Tab，真机演示无溢出和死链。
2. Teacher Web 增加 → 复制 → App 收件粘贴 → 编辑 → 确认 → Today → Focus 完整路径手动验收。
3. App 浏览器刷新后任务和关联科目保持，断网时数据仍可查看。
4. Android/iOS SDK 安装后分别编译和真机检查。
5. 对所有外部内容进行授权、隐私和来源验证。
