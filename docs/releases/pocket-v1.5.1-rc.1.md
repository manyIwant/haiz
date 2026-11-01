# HAIZ Pocket 1.5.1 RC1 · 微信收件可靠性更新

**预发行，不是生产正式版。** 本次从 main 的 1.5.0+2100 更新至 1.5.1+2101。

## 改造
- Android 微信、QQ、钉钉等仅在用户授权后捕获可见的指定群新通知，扩大“阅读、朗读、听写”等作业关键词，保持人工审核。
- Android 前台通知入队后刷新 Flutter 收件箱；iOS 和 Android 修复过期去重记录处理，跨日相同文案可重新导入。
- 云端 Pocket 账号必须在每次账号登录后独立确认，才可查看设备级通知/分享队列；本机队列仍不按用户加密隔离，不会自动向云端上传微信原文。
- 修改结构化作业内容后重新生成班级提交幂等键。
- 扩充账号切换、阅读任务识别回归测试。

## 产物及使用范围
- `HAIZ-Pocket-Android-1.5.1-rc.1-QA.apk`：QA 独立包名 `space.haiz.app.qa`，临时测试签名，不会替换旧正式安装包，不是正式 OTA 更新。
- `HAIZ-Pocket-iOS-1.5.1-rc.1-UNSIGNED.ipa`：未签名 IPA，不能直接安装；需为 Runner 和 HaizShareExtension 配置有效签名及 App Group `group.space.haiz.pocket`。
- `HAIZ-Pocket-Web-1.5.1-rc.1.zip`：网页预览，不支持微信原生通知。
- `SHA256SUMS.txt`：上述产物的 SHA-256 校验。

## 尚待真机确认
Android：微信实际通知样式、权限持久性、锁屏、省电、合并通知、群名误匹配、跨日重复与账号切换。iOS：签名、分享扩展可见性和成功导入。正式的 Academic 服务与 Supabase 账号仍需要部署和审批。CI 绿色只代表模拟测试和构建通过，不等于微信官方 API 对接。
