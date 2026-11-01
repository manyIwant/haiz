# HAIZ Android 应用内更新 · 签名和发布说明

## 用户体验

在 Android 端的右上角点击「检查 HAIZ 更新」。启动后也会静默检查
`https://haiz.space/updates/latest.json`，如有更新，按钮出现提示点。
进入更新中心可查看版本号、更新内容、文件大小、下载进度，
下载后验证完整 SHA-256，再交给 Android 系统安装器请求用户确认。

Android 不允许普通应用绕过系统授权静默覆盖安装。
首次安装更新可能需要允许 HAIZ「安装未知应用」。
成功覆盖的前提：**相同 applicationId、相同签名身份、严格递增的 versionCode**。
APK 包名固定为 `space.haiz.app.preview`，没有修改 ID。
校验失败不启动安装，也不会自动卸载 App 或清除数据。

**旧 QA 包不保证可覆盖：** 旧工作流使用 `space.haiz.app.qa` 和每次随机生成的
证书。现有预览包若不是用长期正式证书签名，也不能被新的正式签名包覆盖。
首次迁移前务必备份离线数据并验证账号云同步；绝不要直接卸载仍有本地数据的应用。

## 仅一次：建立长期签名密钥

在你自己的可信 Mac 上生成并**永久保存** Android Keystore，例如：

```sh
mkdir -p ~/.config/haiz-android
keytool -genkeypair -v -keystore ~/.config/haiz-android/haiz-release.jks \
  -alias haiz-update -keyalg RSA -keysize 3072 -validity 10000
```

在交互提示中设置强密码，并把 keystore 及密码备份到安全位置。
**不要把签名文件、密码、base64 文本或密钥截图交给 ChatGPT，**
也不要提交到 git。遗失此密钥可能导致以后无法直接覆盖更新旧 APK。

在 GitHub 仓库 Settings → Secrets and variables → Actions 中配置以下四个
Repository secrets：

| Secret | 说明 |
|---|---|
| `HAIZ_ANDROID_KEYSTORE_BASE64` | keystore 文件的 base64 内容（不换行） |
| `HAIZ_ANDROID_STORE_PASSWORD` | keystore 密码 |
| `HAIZ_ANDROID_KEY_ALIAS` | 如 `haiz-update` |
| `HAIZ_ANDROID_KEY_PASSWORD` | 密钥别名的密码 |

可用 macOS 的 `base64 -i ~/.config/haiz-android/haiz-release.jks | tr -d '\\n'`
生成第一项，仅粘贴到 GitHub Secrets。**不要发布或传到聊天。**

## 发布新的更新

1. 先合并、验证功能和测试，确保 main 已包含本次修复。
2. 在仓库 Actions 中打开 **HAIZ Android · Stable signed in-app updates**，选择 Run workflow（main）。
3. 输入新版本号（如 `1.0.1`）、严格递增的 `version_code`（首版从 `11` 开始），以及更新说明。
4. 工作流运行 Flutter 检查与测试，通过后用上述**同一套私有签名**生成安装包。
5. 发布不可覆盖的 `haiz-android-v1.0.1` Release，包含
   `HAIZ-Pocket-Android.apk` 和 `SHA256SUMS.txt`。
6. 工作流把版本号、固定包名、实际 APK 大小、SHA-256 和官方下载 URL 写入
   `updates/latest.json`（GitHub Pages 对外地址在 haiz.space）。
7. 用户下次进入 HAIZ 即可发现并安装更新。

Release 版本不会在签名密钥缺失、版本倒退、Flutter 测试失败时发布。
`main` 每次普通提交**不会**自动发布新版 APK：这有助于避免未验收的改动
自动推送至全部手机。之前的临时 QA 构建保持独立，不参加正式更新渠道。

## 验收清单

- 没有已发布清单时，手机提示暂无正式更新，不自动安装。
- 测试 404、无效 HTTPS、错误包名、错误 SHA、超大安装包、版本降级。
- 第一次授权「安装未知应用」之后重新点击继续安装，安装器显示更新，而不是新的应用。
- 已安装版本高于或等于清单 versionCode 时不提示更新。
- 校验失败不得弹出系统安装器。
- 验证覆盖后本地任务、登录和通知设置仍在。
- 使用正式密钥在同一真机安装 v1.0.1，再发布并覆盖 v1.0.2，完成完整双版本验证。

注意：CI 完成不等于真机安装完成；只有跨版本安装和本地数据核验通过后，
才可声称 HAIZ 已有经验证的无损一键更新。
