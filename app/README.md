# HAIZ Pocket · Flutter App

HAIZ Pocket 是面向校园的非官方、本地优先学习工具。Android 预览版与 Web 预览版使用同一套 Flutter 页面、任务和收件逻辑，原生通知与分享入口只在 Android 上可用。

- 网页可交互预览：https://haiz.space/app-preview/inspect.html
- Android ARM64 最新 APK：[`HAIZ Pocket v1.4 Optical v2`](../releases/android/haiz-pocket-v1.4-optical-v2-arm64.apk)
- 当前版本：`1.4.0-preview.4+8`
- 最新版包含：今天、课表、收件、专注、校园，编辑任务、到期提醒、外部文本分享、可选学校群通知候选收件。
- 收件箱仅创建待核对候选事项，用户确认后才保存为任务；不提供 QQ、钉钉或学习通官方 API 登录能力。

## 本地开发

要求 Flutter SDK 3.47.x 及相应 Android SDK，运行：

```sh
cd app
flutter pub get
flutter analyze
flutter test --no-pub test/message_intake_workflow_test.dart test/task_workflow_test.dart test/today_workflow_widget_test.dart test/ui_smoke_test.dart test/personal_store_operations_test.dart test/widget_test.dart
flutter run
```

Web 预览打包：

```sh
flutter build web --release --base-href /app-preview/ --no-web-resources-cdn --no-wasm-dry-run
```

上面构建的静态文件发布在仓库根目录的 `app-preview/`。

Android Release 使用作者私有签名材料，配置文件不在公开仓库中。开发者可以通过 `flutter run` 调试，但要生成可分发签名包需要自有有效签名证书和正确的本地构建配置；请勿把签名证书、密钥或账号凭据提交到仓库。

## 安全与状态

- 非官方学校应用，不代表学校提供或授权校园服务。
- 通知读取默认关闭，须用户输入学校群名关键词并在 Android 设置中授权。系统授予的通知访问权限范围较广，应用只在本机过滤并保存候选通知。
- 来源消息仅在用户确认后成为待办，未进行官方消息源真实性核验。
- 本地 Android 数据不自动同步至 Web 预览。Web 浏览器使用兼容光学玻璃渲染；实时 GPU 折射取决于 Android 设备和 Flutter Impeller。
- **开发预览版：全量 Flutter 测试仍有 5 项已知失败**（账号切换、故障注入存储、Study Relay UI），尚未完成手机实测通知触发和 GPU 帧率验收。

详见 [消息收件授权与限制](../docs/authorized-message-intake-20261029.md)、
[光学玻璃 v2 设计与测试说明](../docs/app-optical-lens-v2-20261029.md)。
