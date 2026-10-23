# HAIZ Study · iOS / Android 0.4.0 预览版

共享网页功能，保留完整校园资源；底部导航、安全区、Android 返回键。默认进入思维书桌。学习记录只存设备本地；卸载或清除应用数据前主动导出。

`npm ci` → `npm run sync` → `npm run android` / `npm run ios`。Android JDK 21 / SDK 35；iOS macOS/Xcode/CocoaPods、iOS 14+。

仓库根 `.github/workflows/haiz-release.yml` 在 haiz-v* 标签推送时构建：先验证领域/API，再并行生成 Android 开发签名 APK 和 iPhone arm64 未签名 IPA。两者成功后发布 GitHub 预览发行版及 SHA256SUMS。未签名 IPA 必须个人签名后安装，不是 TestFlight；开发 APK 不承诺跨构建签名一致。详见 release/INSTALL.zh-CN.md。

当前为离线/本机演示，不嵌入学校服务器或凭据。电脑 Node 服务仅监听回环，手机不能通过自己的 localhost 访问办公室电脑。正式校内多端同步仍需授权 HTTPS 后端、统一身份、安全凭据存储与真机测试。无学生行为监控；Android 禁用系统自动备份。

`prepare:web` 同时支持集成版 world/ 和独立版 dist/，避免原始 campus.html 相对路径丢失。www 与原生生成 public 目录不提交；从当前源码重新生成。Capacitor 7.6.9 / App 7.1.2，MIT；旧窗台 AGPL 与照片、字体、模型许可分别保留。
