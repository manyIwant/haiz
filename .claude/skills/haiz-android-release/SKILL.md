---
name: haiz-android-release
description: "Use when modifying HAIZ Android native integration, notification listener, signed APK update system, package identifiers and reproducible release verification."
---

# haiz-android-release

## 何时使用
签名与数据保留优先；不能在用户已有 App 上随意换 applicationId/签名证书。

## 实施流程
1. 记录当前 `applicationId`、versionCode、ABI、manifest 权限、FileProvider、通知监听服务和系统分享 intent-filter。
2. 新增权限或改变监听逻辑先写最小化数据范围与用户同意说明，明确 Android 系统可授予的真实权限范围。
3. 验证 release APK 签名证书连续性、包名一致性、版本单调递增，用户升级无需卸载清空数据。
4. 下载更新时校验 HTTPS、公开清单、SHA-256、包名、版本、原证书及用户系统安装确认；审查供应链风险。
5. 在真实 Android 设备上测试首次安装、旧版本覆盖更新、分享文本、通知权限、弱网和后台限制。
6. 切勿将私有 keystore、签名密码、token 推送到 GitHub 或 ZIP。

## 验收条件
- 不能以 Debug APK 通过代替签名升级验证。
- 任何不可逆签名或包名变更先暂停并取得明确授权。
- 发布只从受控工作流发起。

## 相关文件和参考
- `app/android/app/build.gradle.kts`
- `app/android/app/src/main/AndroidManifest.xml`
- `docs/HAIZ-ANDROID-IN-APP-UPDATES.md`
