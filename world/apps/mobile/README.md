# HAIZ Study · iOS / Android

Capacitor 原生外壳复用网页模块，默认打开今日作业。学习记录仅保存在设备 WebView 本地，公开作业遵循同一数据结构。

`npm ci` → `npm run sync` → `npm run android` 或 `npm run ios`。Android 需 Android Studio/JDK/SDK；iOS 需 macOS/Xcode 与签名。已生成原生项目，不代表 APK/IPA 已构建或真机验证。

本轮云端网页是本机演示，本地 Node 服务只监听电脑回环地址。手机无法把自己的 localhost 当作办公室电脑；没有嵌入服务器地址、API 密钥或教师密码。当前原生包用于离线学习与本机演示。正式跨设备作业同步需经学校授权部署 HTTPS API、统一身份、移动端安全令牌存储和 CORS 策略后接入，不允许改成明文校园内网广播。

`prepare:web` 每次从 dist 复制共享前端，排除下载归档；www、原生 public 资源、构建产物均不提交。生成/同步后再由本机 IDE 构建。Capacitor 7.6.9 的 MIT 许可证见 node_modules 对应包；原站其他许可证仍适用，不能将 AGPL 窗台重许可。
