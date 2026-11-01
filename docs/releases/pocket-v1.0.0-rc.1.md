# HAIZ Pocket 1.0 · 首次整合发行候选版

这是 **HAIZ Pocket 1.0.0-rc.1**，将独立开发的移动端能力整合到同一个代码基线，并提供可实际安装的 **Android QA 体验包** 和 Flutter Web 构建产物。此版本标记为 **Pre-release**，不是已通过所有真机、签名及云服务验收的正式商用包。

## 已包含的功能
- 本机访客空间：课表、任务/待办、专注记录、校园信息、学习笔记及原有视觉主题；允许离线使用。
- 登录体验：深蓝砖墙 + 暖色壁灯的网页登录视觉，以及 Flutter 原生 Lamp 入口/离线回退。成功点灯的演示账户只用于动画测试，不是学校账号。
- Supabase Auth Flutter 接入：邮箱验证、登录/注册/密码重置、Keychain / Keystore 移动端会话、重新联网校验；按 `auth.uid()` 绑定的云端个人快照和 RLS SQL 迁移。**未提供正式服务器项目，账号登录默认不可用。**
- Android（用户主动授权后）：指定班群通知的本机候选收集；不会偷偷读取微信历史聊天、撤回消息或未显示的通知。
- iOS：由用户主动调用分享面板向 HAIZ 分享内容；无后台微信消息读取。需要 Apple 开发者签名和 App Group 配置。
- 校园作业：可选择的 HAIZ Academic 教师任务发布、学生前台轮询和本人复核；需要独立部署 HTTPS Academic API 和班级权限。
- 可选 AI 语义识别：需明确同意，并配置服务端模型提供方；AI 不自动替代人工确认或教师发布。

## 下载包类型
- `HAIZ-Pocket-Android-1.0.0-rc.1-QA.apk`：通过**临时 QA 签名密钥**构建，独立包名 `space.haiz.app.qa`，不替代你此前已安装的正式签名 App。不能被视为正式签名升级包。
- `HAIZ-Pocket-Web-1.0.0-rc.1.zip`：Flutter Web 静态构建。需要部署在可信的 HTTPS 网站；未配置认证服务时只提供访客功能。
- `SHA256SUMS.txt`：下载文件完整性校验。GitHub 同时提供本标签对应源码归档。

## 需要继续完成的上线门槛
1. 创建生产 Supabase 项目，按 `docs/pocket-auth-deployment.md` 应用 RLS 迁移并用独立账号 A/B 验证隔离、注销与恢复；不得把 service_role 密钥打包到 App。
2. 学校教师端/Academic 服务需要部署、备份与授权班级测试；没有部署时不是自动班级任务系统。
3. 真正面向学生发布前，完成 iOS 签名/分享扩展 App Group、Android 权限与通知实机测试、隐私政策和个人数据删除机制。
4. 使用项目所有者持有的 Android 正式签名密钥重新签发正式更新包，并完成升级迁移验收；QA 包不要误作官方升级。
5. 仍未包括来自诸多 3D 校园/桌面端概念分支的原型。那些原型需单独性能和数据安全测试，不应未经检查塞进学生端首发 APK。

## 代码来源
- [PR #50](https://github.com/manyIwant/haiz/pull/50) 自动作业、Android 通知和 iOS 主动分享
- [PR #48](https://github.com/manyIwant/haiz/pull/48) Lamp 入口与离线回退
- [PR #51](https://github.com/manyIwant/haiz/pull/51) Supabase 认证、会话与数据隔离

版本名称为 **Pocket 1.0 RC**，与既有 **HAIZ Academic v1.3 preview** 版本线独立。
