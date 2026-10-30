# HAIZ Academic · 自建班级协作服务（授权演示）

Node.js 24.22+、SQLite 内置模块、无第三方运行时依赖。v1.4 版本化作业与增量同步契约见 [API-CONTRACT](../../docs/architecture/API-CONTRACT.md)、[OpenAPI](../../docs/architecture/openapi.json) 和 [SYNC-PROTOCOL](../../docs/architecture/SYNC-PROTOCOL.md)。升级前必须阅读 [迁移与回滚](../../docs/architecture/MIGRATION-ROLLBACK.md)。默认仅监听 `127.0.0.1:8780`，不读取学校官方账号、QQ群聊天历史或个人信息。

## 启动

首次运行必须指定强密码（不提供默认管理员账号）：

```bash
export HAIZ_ADMIN_LOGIN=haizadmin
export HAIZ_ADMIN_PASSWORD='换成至少14位的独立强密码'
node server.mjs
```

Mac 用户也可双击项目根目录的 `tools/start-academic-local.command`，它会在 `~/.config/haiz-academic/local.env` 创建权限为 600 的本地演示配置，不会把密码写入 Git。

浏览器访问 `http://127.0.0.1:8780/`。先以管理员登录并创建教师账号，教师登录并建立班级后，将邀请码给参与的学生。学生注册后处于 **pending**，由教师核准才能看到班级任务。

## 工作流

1. 管理员创建教师 HAIZ 账号（并非学校官方教师认证）。
2. 教师创建班级并获得邀请码。
3. 学生用独立 HAIZ 账号提交加入申请；教师核准。
4. 教师发布科目、任务、截止日期，学生端只看本人已加入班级的通知。
5. 学生可以标记「已查看」，这 **不等于已交作业**。
6. ClassIsland 插件通过独立的只读屏幕密钥读取**已发布**的最近任务，不返回任何学生身份。
7. QQ 官方机器人接入事件只能进入教师审核队列，不会自动发布。

## 学校授权名册同步

仅在学校批准、提供经过验证的连接器后可启用：

```bash
export HAIZ_SCHOOL_ROSTER_SECRET='校方与HAIZ商定的高强度随机密钥，至少32字符'
export HAIZ_SCHOOL_ISSUER='校方约定的信任发行者标识'
```

由有权的 HAIZ 管理员先为学生账号映射 **不含姓名、身份证号、学籍号** 的不透明 `externalSubject`。被授权校方系统将签名的伪名册发送至 `POST /api/integrations/school/roster`：请求头 `x-haiz-timestamp` 为毫秒时间戳；`x-haiz-signature` 为 `hex(HMAC-SHA256(secret, timestamp + "." + rawJsonBody))`。

示例 payload（完全虚构数据）：

```json
{
  "issuer": "approved-school-connector",
  "eventId": "opaque-event-0001",
  "records": [
    {
      "externalSubject": "opaque-student-1",
      "classId": "由HAIZ创建的真实UUID",
      "status": "active"
    }
  ]
}
```

同步严格支持 `active`、`revoked` 两种状态，去重，拒绝伪造或过期签名，只更新已经明确关联的 HAIZ 用户；**不会从学籍数据库自动创建账户**。没有学校的合法授权凭据，不能称为「海南中学正式账号同步」，请勿上传真实学生名单进行测试。

## QQ 官方机器人中继

只有配置 `HAIZ_QQ_RELAY_SECRET`（至少32字符）后可绑定官方机器人 group_openid。事件结构详见 `integrations/qq-bot/`。签名中继仅转发 `GROUP_AT_MESSAGE_CREATE`，并由老师确认每项任务。它不会读取不属于该机器人的群历史消息。

## 手机班级作业候选与可选 AI 理解

第一阶段新增：获准加入班级的学生可把手机本机筛出的**结构化作业候选**提交至 `POST /api/classes/:id/mobile-suggestions`（须登录；只接受 clientKey/subject/title/due）。教师网页审核编辑后才发布，iPhone/Android 学生端在 HAIZ App 前台获取已发布作业；不会上传 QQ/微信原始聊天正文到班级候选库。

智能语义解析默认关闭。管理员可用 `HAIZ_AI_ENABLE=1`、`HAIZ_AI_BASE_URL`（可信 HTTPS OpenAI 兼容端点）、`HAIZ_AI_MODEL`、`HAIZ_AI_API_KEY` 配置自己的模型服务，用户需在手机客户端单独知情启用，才能使用 `POST /api/ai/extract`；请求在内存处理，基础联系方式脱敏后发送给配置的模型提供商。禁止把模型密钥写入客户端或代码库。未配置或失败时保留本机规则候选，不会自动向全班发布。

详见 [第一阶段部署、隐私和剩余限制](../../docs/mobile-class-relay-ai-20261029.md)。

### 免费开源模型接入

已支持服务端 `HAIZ_AI_PROVIDER=cloudflare` 配合 Cloudflare Workers AI 免费额度使用 Apache-2.0 Qwen3 模型，或 `HAIZ_AI_PROVIDER=ollama` 使用独立常驻主机的 Ollama Qwen3.5（不需要按调用付费）。默认关闭，只有手机端授权后才解析。详细变量、模型、账号权限、隐私和限额见 [免费开源 AI 接入指南](../../docs/free-open-model-ai-20261030.md)。**HAIZ 服务本身仍需公网 HTTPS 托管；免费模型不等于免服务器。**当前没有 APNs/FCM 后台推送或 iOS 微信后台监听，不能把前台轮询描述成手机关闭时持续接收。

## ClassIsland

只读 GET `/api/screens/{screenKey}`，仅包含班级名和已发布的科目、标题、截止日期。屏幕密钥可由教师轮换。插件源文件见 `integrations/classisland/`。

## 部署安全边界

**此工程是经过测试的班级协作预览服务，不是具备学籍备案、正式学籍认证或完整安全审计的正式教务平台。**

- 仅监听本机 loopback。远程设备通过由管理员配置的 HTTPS 反向代理连接；反代访问本服务的 localhost 端口。远程部署时设 `HAIZ_PUBLIC_HTTPS=1`，确保 Session Cookie 含 Secure。
- 不要将此服务直接暴露在 HTTP 公网上。它默认使用 HttpOnly、SameSite=Strict Session Cookie，密码 PBKDF2 哈希，SQLite 文件权限 600。
- 真实部署前必须增加监护人/校方告知与同意、审计与数据删除流程、漏洞扫描、恢复/备份、密钥轮换、MFA、隐私合规和运维监控。
- 所有示例帐号和事件均为虚构数据。切勿把 QQ AppSecret、school roster secret、屏幕密钥、学生名单上传到 GitHub。
- 在本目录执行 `npm ci` 后运行 `npm test` 或 `npm run test:coverage`。51 项后端测试包含迁移、权限、并发、重启、离线恢复和真实 HTTP OpenAPI 响应校验，覆盖率门槛为行/分支/函数各 80%。测试均使用临时数据库与虚构身份，不连接真实学校或 QQ。

## 主要接口

`/api/auth/login`、`/api/auth/register`、`/api/admin/teachers`、`/api/classes`、
`/api/classes/:id/members`、`/api/classes/:id/assignments`、
`/api/my/assignments`、`/api/assignments/:id/acknowledge`、
`/api/classes/:id/inbox`、`/api/integrations/qq/event`、
`/api/integrations/school/roster`、`/api/screens/:screenKey`。
