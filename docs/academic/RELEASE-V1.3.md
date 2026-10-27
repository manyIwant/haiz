# HAIZ Academic · v1.3.0-preview.1

**发布日期：2026-10-27 · 独立自建系统预览，不是学校官方教务系统。**

## 这次实际完成的部分

### 1. 班级与账号

- 独立的 SQLite 服务端，不依赖学校正式数据库。
- 三类角色：管理员、教师、学生（服务器侧权限检查）。
- 管理员创建教师账号；教师创建班级与邀请代码。
- 学生主动注册并申请加入班级；必须由该班教师核准。
- 教师发布作业，学生读取获准班级的内容，可以标记“已查看”。
- 明确区分“已查看”和“已提交作业”，目前**没有正式作业提交/批改模块**。
- 密码 PBKDF2 加盐哈希、HttpOnly SameSite 严格 Cookie、权限检查、登录限流、审计表、SQLite 本地文件权限。
- 班级信息在数据库，默认只监听 127.0.0.1，正式远程部署需要 HTTPS 反向代理及身份保护。

### 2. Flutter 学生 App

- 在「探索」新增 HAIZ Academic；配置可信 HTTPS 自建服务端地址、登录 HAIZ 账号（不是学校官方登录）。
- 读取该用户所属班级和作业；人工确认后单条加入 PocketStore 待办，保证原有日程/专注工作流仍可使用。
- 已有 20 项 Flutter unit/widget 测试全部通过，flutter analyze 零警告零错误。
- Flutter Web release 及 Android APK release 已实际构建（具体校验见发行目录）。
- 尚无真机安装测试；仍需检查 Android 设备的文件导入、PDF、截图 OCR、云端账号登录和恢复行为。

### 3. 官方 QQ 机器人最小接入

- 采用官方 `@tencent-connect/qqbot-nodejs@1.0.5`。
- 只收集经审核机器人能够合法收到的群 @提及事件。不得读取未获授权的群记录。
- 仅转发 groupOpenid、messageId、正文，HMAC 签名保护；教师绑定群组，消息进入待审核队列。
- 学生不能将待审群消息强制发布。
- 适配器测试 2 项通过；无实际 QQ Bot AppID/AppSecret，因此**没有接入任何真实 QQ 群**。
- 官方接入由 QQ 机器人开发者资质、授权群和平台事件权限决定。

### 4. 学校正式身份/名册连接点

- 有条件启用的 signed school roster connector，支持匿名外部学籍标识、签名事件、权限映射、成员撤销与重复事件去重。
- 未提供真实学校 SSO 和数据源适配器，**不属于海南中学正式账号同步**。
- 缺少合法校方接口、管理员授权、接口文档、最小化字段映射，保持停用；不应导入真实学生名单测试。

### 5. ClassIsland 原生插件

- 使用 ClassIsland 官方 2.0.0.2 PluginSdk，.NET8 / Avalonia `ComponentBase`、`[PluginEntrance]`。
- 编译通过、插件包 `.cipx` 和 `checksums.md` 已实际生成，0 warnings / 0 errors。
- 教室组件每 45 秒读取只读 screen feed，展示班级名称、最近 5 项教师确认过的作业。
- 不返回学生姓名、成员名单、作业完成情况；支持教师轮换只读密钥。
- 尚未在 Windows 和 ClassIsland 本体进行实际导入兼容测试，不应声称已上教室设备。

## 核心测试与实现边界

后端 Node 自带端到端测试覆盖：登录、教师创建班级、学生申请审批、越权操作、任务查看和已查看、伪造 QQ 签名拒绝、QQ 事件去重与人工确认、ClassIsland 只读令牌轮换、校方伪匿名名册签名、撤销、恢复与幂等。

系统使用独立 SQLite 账号，因此不应宣称具有学校统一登录、官方课表、成绩单、教务处权限或与真实教师身份相符。

## 发行交付

`HAIZ-App-v1.3.0-preview.1.apk` · Android ARM64/ARMv7/x86_64 通用包，预览签名。
`HAIZ-Source-v1.3.0-preview.1.zip` · 源码，包括 Flutter、Node 教务、QQ 官方 SDK 适配器、ClassIsland C# 源码（不含凭据或 node_modules）。
`HAIZ-Academic-Web-v1.3.0-preview.1.zip` · 独立自建教学后台 UI+服务代码。
`HAIZ-ClassIsland-v1.3.0-preview.1.cipx` · 原生组件构建包。
`SHA256SUMS.txt`、`APK_SIGNING_REPORT.txt`、`RELEASE_NOTES.md`。

GitHub 上尚未公开创建 Release。用户本机 `gh auth status` 仍未登录，不能将本地预览发行冒称为 GitHub 已发布。
