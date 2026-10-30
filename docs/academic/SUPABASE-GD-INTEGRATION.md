# HAIZ Academic × GD/秒哒 Supabase（部署门槛）

## 目前状态

- GD 仓库：`manyIwant/GD`，使用 Supabase Auth、PostgreSQL 和行级权限控制。
- HAIZ 静态登录入口：`academic/index.html`，可以被 GitHub Pages 托管；`config.js` 目前为空，**因此还不能登录**。
- HAIZ 数据库迁移：在 GD 分支 `feat/haiz-academic-schema-20261029` 的 `supabase/migrations/00020_haiz_academic_isolated.sql`，尚未执行到线上 Supabase 项目。
- 原 HAIZ Flutter App 仍使用 Node.js Academic 接口；原 ClassIsland 插件仍使用 `GET /api/screens/:key`，**两者都尚未切换到新的 Supabase 契约**。

## GD 的认证模式

GD 源码 `src/services/api.ts` 将用户名映射到 `username@miaoda.com`，再使用 `supabase.auth.signInWithPassword`。

本页遵循这套现有账号格式，**不会直接使用 GH Pages 做密码验证，也不会将任何固定密码写进代码**。用户账号必须真实存在于对应 Supabase Auth 项目中。

重要限制：GD 的 `on_auth_user_created` trigger 会为每个新 Auth 用户同时创建游戏 `profiles`、`unlocked_ships` 行。虽然 HAIZ 的班级/任务表独立，**共用 Auth 的新账号仍会触发 GD 的初始化流程**。若要求身份和数据绝对隔离，应创建另一个 Supabase 项目，而不是复用同一个 Auth 用户池。

## 部署顺序

1. 在 GD 对应的 Supabase 管理后台先确认数据库备份与当前迁移历史。
2. 审查并执行 `00020_haiz_academic_isolated.sql`。它只创建独立 `haiz_*` 表、RLS 策略与 RPC，不修改现有 GD 游戏业务表。
3. 在 SQL Editor 中运行匿名用户、普通学生、教师的正向和越权访问回归测试；**审计通过后**才开放给真实学生使用。
4. 在 HAIZ 仓库的 `academic/config.js` 填入 Supabase HTTPS Project URL 和 **publishable / legacy anon key**。两者为公开客户端配置，`service_role`、secret key、个人账号密码和 screen key 严禁出现在此文件。
5. 合并 HAIZ 门户分支到 **GitHub Pages 实际部署的 main** 后检查 `https://haiz.space/academic/` 是否返回 200，确认 CDN 可以访问。
6. 首次使用须先在 Supabase Auth 中由获授权管理员创建或批准账号，再登录网页。登录后页面调用 `haiz_ensure_student()` 创建仅学生角色。
7. 教师/管理员角色必须由服务端受信任的 SQL/管理操作赋予，禁止学生自行设置。
8. 创建班级、发布作业、学生凭邀请码申请、教师审核。屏幕密钥只能由班级教师轮换，发放到经授权教室的 ClassIsland 设备。
9. 另行适配 Flutter 学生端与 ClassIsland 的协议后，在 Android / Windows 真机进行完整同步验收。

## ClassIsland 目标接口（尚未适配原插件）

现有 C# 插件使用 HAIZ Node backend 的 `GET /api/screens/{screenKey}`。新 Supabase 迁移提供：

- `POST {SUPABASE_URL}/rest/v1/rpc/haiz_screen_feed`
- Header: `apikey: <SUPABASE_PUBLISHABLE_OR_ANON_KEY>`
- JSON body: `{"p_key":"教师已发放的96位屏幕密钥"}`
- 返回结构：`{className,assignments,readOnly,containsStudentIdentity}`

页面教师端 `haiz_rotate_screen_key` 会轮换密钥并使旧密钥失效。**不得将 screenKey 放在 GitHub、公开网页或浏览器配置文件中**。

这个 RPC 返回的信息仅限班级名称及五项已发布作业，不含学生名单、查看情况或教师密码。正式接入前还要进行流量控制、日志脱敏、密钥轮换/异常恢复测试。

## 安全检查表

- [ ] Supabase Auth 权限和邮件验证策略核对
- [ ] RLS 策略与 SQL 授权检查，特别测试未登录客户端能否读取私有表
- [ ] 学生不能自行晋升 teacher/admin，不能查询其他班级作业
- [ ] 学生未经批准不能获取作业
- [ ] 撤回任务后学生端和教室端不再显示
- [ ] GD 游戏表的数据和用户角色不被 HAIZ 页面写入
- [ ] 公共 anon/publishable key 与真正的 service/secret key 明确区分
- [ ] 不公开任何真实学生信息、密钥或静态管理员密码
- [ ] Flutter 和 Windows 实机联调

**注意：仅提交 GitHub 源码不等于执行 Supabase SQL 迁移，更不等于线上账号可用。**
