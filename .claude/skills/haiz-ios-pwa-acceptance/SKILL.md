---
name: haiz-ios-pwa-acceptance
description: "Use when validating HAIZ iOS Flutter app, Share Extension and Safari Home Screen PWA against actual platform constraints and data persistence."
---

# haiz-ios-pwa-acceptance

## 何时使用
iOS 原生、PWA 两条路线分别验收；不能把 iOS 模拟器当作真实签名发行和系统通知的证明。

## 实施流程
1. 对原生检查签名/entitlements/Share Extension 权限，避免和 Android 通知监听混淆。
2. Safari PWA 只使用用户明确的分享和文件选择，不声称后台监听微信群、任意推送或持续同步。
3. 用真实 iPhone 验证安装主屏、冷启动、离线外壳、OCR、文件导出导入、数据清理恢复、键盘和安全区。
4. 对 Push 需真实服务端订阅、VAPID、同意与退订，且 iOS 支持条件和网页安装模式清楚可查。
5. 未能验证 iPhone 时创建 test matrix 和 blocker，明确标记未验收而不是自动勾通过。
6. 账号生命周期与本地备份都在使用真实测试数据的设备上验证。

## 验收条件
- 原生签名与 PWA 安装方式没有混为一谈。
- 真机与模拟器的证据分开归档。
- 对用户数据恢复路径有明确实验。

## 相关文件和参考
- `app/ios/Runner`
- `app/ios/HaizShareExtension`
- `docs/pocket-production-acceptance.md`
