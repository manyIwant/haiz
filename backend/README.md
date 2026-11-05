# HAIZ 后端

新增的独立服务支持三条真实数据链路：账号与安全会话；教师草稿、工作区、公开通知与跨设备同步；个人便签/收藏/偏好与多人校园房间。原 `public/haiz/world/pilot` 和本地演示服务保留，新增业务不再写入试用 JSON。

个人数据现有回收站、历史版本恢复、搜索、用量统计和本人操作记录；生产服务增加带完整性检查与轮换的自动备份。接口、保留期限与恢复边界见 [数据安全说明](../docs/backend-data-safety.md)。

## 运行与入口

运行时：**Node >= 24.22.1**，无新增生产 npm 依赖。开发使用根目录的 `npm run backend:dev`，默认只监听 `127.0.0.1:8790`。当前实现由代理承接公网 HTTPS；Node 端口不对公网开放。

- `/`：主仓库直接提供现有网站根页面；在本地 React 原型副本中读取 `npm run build` 的产物。
- `/login/`：沿用既有深蓝暖光玻璃卡片的正式登录界面，提供真实登录、注册和邀请验证；只有服务端会话验证成功才点灯进入。
- `/account/`：登录后的“我的数据”；便签/收藏/偏好可查看、搜索、编辑、删除、恢复、查历史、分页与导出，并提供数据用量和本人操作记录。账号安全页管理密码、设备会话和账号注销。未登录时返回灯光登录页。
- `/world/flow/`：现有教师工作台，已接入新后端的邀请/草稿/发布/工作区接口。
- `/world/stillroom/`：现有自习页。
- `/api/health`：存活；`/api/ready`：数据库可用性。
- `/haiz-client.js`：同源 ES module 浏览器 SDK。

`npm run dev` 的 Vite 服务会把 `/api`、Flow、自习页和 SDK 代理到本机后端；可用 `HAIZ_DEV_BACKEND` 修改代理地址。代理只重写来自该 Vite 来源的 Origin，不替跨站请求补授权。

首次启动将管理员的一次性邀请写入 `.haiz-data/bootstrap-invite.txt`，权限 0600；控制台只输出文件路径。在 `/login/` 选择“使用管理员提供的邀请”，登录后设置密码。邀请默认 30 分钟、会话默认 8 小时。首次邀请过期且管理员尚未设置密码、也没有有效会话时，重启会恢复初始化邀请；设置密码后不会自动重置密码。普通用户默认可注册，固定为 `student`，不能自行选择角色或班级；设置 `HAIZ_REGISTRATION=0` 可关闭新注册。

本地运维命令：

```sh
# 在私有目录签发教师/显示屏/学生邀请；控制台只输出邀请文件路径。
npm run backend:invite -- teacher-a teacher '一班'
npm run backend:invite -- display-a display '一班'
# 给已有身份签发新设备邀请，不改变其原角色或班级。
npm run backend:invite -- teacher-a
# 管理员失去凭据时：停止服务后在服务器本机执行，再启动并用新邀请设置密码。
npm run backend:recover
```

设置密码会使该账号的全部旧会话及未用邀请失效；随后使用密码登录。已有密码时修改必须提交 `currentPassword`。运维恢复会清除管理员旧密码并撤销其会话，只能由有私有数据目录权限的服务器操作员执行，未提供公开恢复接口。邀请文件使用后由操作员移除；数据库只保存邀请码和会话令牌的 SHA-256 哈希。

网站 HTML 默认需要有效登录；灯光登录页、SDK、静态图片/样式/脚本及健康检查公开。登录后的页面提供“我的数据”入口；`/login/` 保持正式入口身份，账号中心不再另造登录界面。旧 Flow 页面保留试用文案，但新服务**不开放旧试用的一键清空接口**。旧本机笔记/收藏按当前账号隔离存储，不自动把历史访客资料归给某个新账号；账号中心的三类记录保存到服务端。尚未自动上传所有旧页面的本地资料，也没有在校园画面加入其他玩家模型。

账号切换使用服务端身份前置条件：SDK 从 me/login 验证身份后，每个个人数据请求携带 `X-HAIZ-User`，与当前 Cookie 身份不符返回 409 `identityChanged`，不执行读写。旧页面注入相同保护、跨标签锁定和 bfcache 清空；账号中心切换身份会清空旧内容。实时 SDK 在换身份/退出时关闭旧连接，并以非秘密的用户 ID 约束 SSE 重连。受登录保护的 HTML 不写入离线缓存，新服务停用旧 Service Worker 缓存路径。

## API

所有响应是 JSON，错误包含 `error` 和 `requestId`。修改请求必须为同源、带 `Origin`、使用 `application/json` 对象；不超过 64 KiB。Cookie 为 HttpOnly、SameSite=Strict；生产额外使用 Secure 与 `__Host-` 前缀。不要将会话存入 localStorage 或 URL。

| 方法 | 路径 | 请求 / 说明 |
| --- | --- | --- |
| GET | `/api/v1/auth/config` | 公开注册状态与强制登录配置 |
| POST/GET | `/api/auth/login`, `/api/auth/register`, `/api/auth/session`, `/api/auth/logout` | 灯光原入口兼容接口，对应同一真实账号服务；返回 `authenticated:true` 必须经过密码或会话校验 |
| POST | `/api/v1/auth/register` | `{username,password}`，密码至少 12 字符，默认开放普通用户注册 |
| POST | `/api/v1/auth/login` | `{username,password}` |
| POST | `/api/flow/login` | `{invite}`，兼容现有 Flow 登录 |
| GET | `/api/v1/auth/me` | 当前身份与会话到期时间 |
| POST | `/api/v1/auth/logout` | 撤销当前会话；实时连接同步断开 |
| POST | `/api/v1/auth/password` | `{password,currentPassword?}`，修改后重新登录 |
| GET | `/api/v1/auth/sessions` | 当前用户的有效会话，不含令牌 |
| POST | `/api/v1/auth/revoke` | `{id}`，只可撤销自己的会话 |
| POST | `/api/v1/auth/logout-all` | 当前账号的全部设备退出 |
| DELETE | `/api/v1/auth/account` | `{password,confirm:当前账号名}`，永久注销本人及其数据；最后管理员受保护 |
| GET | `/api/flow/admin` | 管理员读取账号、有效会话及最近审计事件 |
| POST | `/api/flow/admin/invite` | 新身份 `{username,role,scope,scopes}`；已有身份 `{account}` |
| POST | `/api/flow/admin/revoke` | `{id}`，撤销指定会话并断开其在线连接 |
| GET | `/api/v1/admin/metrics` | 管理员读取计数、内存、事件循环延迟、数据库队列与在线数 |
| GET | `/api/v1/data/:collection` | `?limit=100&cursor=...`，最多 200 条，返回 `items,nextCursor` |
| GET | `/api/v1/data/:collection/:id` | 当前用户的一条记录 |
| PUT | `/api/v1/data/:collection/:id` | `{expectedRevision,data:{...}}`，新建版本为 0 |
| DELETE | `/api/v1/data/:collection/:id` | `{expectedRevision}`，保留版本墓碑防止旧设备覆盖 |
| GET | `/api/v1/data/:collection/:id/history` | 本人的当前与保留中历史版本 |
| POST | `/api/v1/data/:collection/:id/restore` | `{expectedRevision,revision?}`，恢复为一个新版本 |
| GET | `/api/v1/trash/:collection` | 本人可恢复的已删除记录，支持limit/cursor分页 |
| GET | `/api/v1/search` | `q`字面搜索，集合可选，limit/cursor分页 |
| GET | `/api/v1/usage` | 本人条数、JSON内容及历史用量 |
| GET | `/api/v1/activity` | 本人近期账号与数据操作，不含正文或凭据 |
| GET | `/api/flow/me` | Flow 当前身份 |
| GET/POST | `/api/flow/drafts` | 读取自己的草稿 / 按版本保存 |
| GET/POST | `/api/flow/workspace` | 私人课程与待办，字段兼容旧 Flow |
| GET | `/api/flow/feed` | 仅当前班级、已发布、有效期内的公开摘要 |
| POST | `/api/flow/publish` | `{id,expectedRevision,confirmed:true,confirmedSummary}` |
| POST | `/api/flow/revoke` | `{id,expectedRevision}` |
| GET | `/api/v1/rooms` | 当前账号可进入的房间名称 |
| GET | `/api/v1/rooms/:room/events` | SSE：`snapshot,presence,position,message` |
| POST | `/api/v1/rooms/:room/position` | `{connectionId,x,z,yaw}`，客户端最多约 10Hz 上报 |
| POST | `/api/v1/rooms/:room/messages` | `{connectionId,text}`，纯文本、最长 500 字符 |

个人集合为 `notes`、`bookmarks`、`preferences`；每条 `data` 最多 16 KiB，每用户共 5000 条（包含删除墓碑）。记录 ID 为 1–100 位字母/数字/下划线/短横线。更新冲突返回 **409** 和 `remote`，客户端让用户合并后用新版本重试。列表采用 ID 游标分页；并发修改期间分页不是历史快照。

Flow 的 POST 必须有 `Idempotency-Key`（12–100 位字母数字/下划线/短横线，推荐 UUID）。相同账号、同一键、相同路径与请求体在 7 天内返回首次成功结果；不同操作复用键返回 409。写入、审计和幂等结果在**同一事务**提交。超出 7 天仍受版本校验保护，但不承诺返回原始成功响应。

草稿字段沿用旧接口：`id,expectedRevision,title,body,summary,materialNotes,scope,startsAt,expiresAt,sourceDevice,cursor`；时间使用 ISO 字符串。课程/待办用 `kind:course|task`、`title,scope,startsAt,period,materialNotes,status`，编辑时附 `id,expectedRevision`。教师仅能访问自己的私人内容及获授权的班级；管理员不通过这些接口读取教师正文。公开投影不含正文、资料备注和作者标识。

实时房间：`campus` 全部已登录用户可进入；`class:班级名` 仅被授权的身份可进入。房间名需 URL 编码。`snapshot` 包含新 `connectionId` 和完整成员列表；每次重连必须替换本机旧列表与连接 ID。位置/消息必须使用同一**会话**的当前连接 ID。消息临时广播，不保存聊天历史；客户端显示消息使用 `textContent` 或框架默认转义。SSE 发送失败、慢消费者、退出、撤销、到期都会断开；到期使用独立定时器，心跳每 15 秒。服务重启清空在线状态，浏览器重连后得到新快照。

## 浏览器接入

```js
import { createHaizClient } from '/haiz-client.js';
const haiz = createHaizClient();
await haiz.login('your-account', 'your-password');
const { item } = await haiz.put('bookmarks', 'library', { buildingId: 'library' }, 0);
await haiz.put('bookmarks', 'library', { buildingId: 'library', note: '午后去' }, item.revision);

const room = haiz.joinRoom('campus', event => {
  if (event.type === 'snapshot') console.log(event.members);
  if (event.type === 'message') console.log(event.name, event.text);
});
// snapshot 到达后才能发送；位置建议限制到 10Hz。
await room.position(1, 2, 0);
await room.message('你好，校园');
room.close();
```

这段代码展示接口顺序；真实应用应等待 `snapshot` 事件再调用 position/message，并处理错误。SDK 不自动重试修改请求，Flow 重试时显式复用同一键；个人数据用版本号处理网络重试。已有 Cookie 的应用先调用 `me()` 绑定身份再访问个人数据，UI 每次确认新身份时可调用 `setIdentity(id)`。SDK 在切换账号和登出时关闭其房间连接。

## 架构与容量边界

- SQLite 在独立 Worker 中运行，WAL + FULL 同步、外键、索引和 prepared statements；逐记录写入，无整库 JSON 克隆/重写。数据库 RPC 最多 256 个排队任务，拒绝过载。
- 密码使用随机盐及异步 scrypt（N=65536,r=8,p=2），最多 4 个同时计算，工作进入 Node 线程池；HTTP 主线程可继续处理其他请求。部署应预留至少 512 MiB 内存并根据实际负载验证。
- 每账号最多 20 个有效会话；每教师 500 草稿、每类 200 工作区对象、1000 通知；最多 10000 用户和 1000 待用邀请。过期邀请/会话/幂等记录每分钟清理；安全审计保留最近约 10000 条。
- 单实例最多 256 在线连接、每房间 64、每账号 4；位置每会话 15 次/秒，消息每会话 10 次/10秒；主请求同时最多 512，JSON 体读取有 8 秒期限。
- 代理提供的每客户端 IP：API 1200 次/分钟、登录类 30 次/分钟；每账号登录尝试 15 次/分钟，每会话 API 600 次/分钟。429/503 返回 Retry-After。
- 静态资源流式读取，支持 ETag/304、HEAD 与单段 Range；拒绝服务端代码、隐藏目录、测试、脚本和数据目录，真实路径检查防止软链接越界。旧校园兼容层仍允许旧内联脚本；生产 CSP 尚未收紧到逐页 nonce。
- 这是**单实例**持久服务；没有 Redis/跨节点广播、学校多租户隔离或邮件找回，不要启动多个前端实例共享在线状态，也不要把 SQLite 放在网络文件系统上。

## 生产部署

1. 在自有服务器安装 Node >=24.22.1 和 Caddy，将完整源码放到 `/opt/haiz`，运行 `npm ci && npm run build`。无须运行旧 `classroom-server` 或旧 pilot。
2. 创建服务用户 `haiz`、私有目录 `/var/lib/haiz`（0700），将 `deploy/.env.example` 填好后放到 `/etc/haiz.env`（0600）。按实际 Node 路径调整 `deploy/haiz.service`，安装为 systemd 服务。
3. 替换 `deploy/Caddyfile` 的域名，部署到**同一主机**。Caddy 必须覆盖 `X-HAIZ-Client-IP`，服务只信任本机连接里的有效 IP；不读取客户端自报 X-Forwarded-For。原始 Node 端口仅 loopback。缺少此受控代理头的生产请求会被拒绝。
4. Caddy 使用可信 HTTPS 后打开 `/login/`，通过管理员邀请设置初始密码；签发教师等身份/设备的独立邀请。普通用户默认自行注册登录，部署示例为 `HAIZ_REGISTRATION=1`；新注册用户没有教师权限。
5. 检查 health/ready、登录、教师发布、学生投影和两设备房间；保存备份后做一次恢复演练。systemd/Caddy 示例没有在当前 macOS 工作区实际安装，公网 TLS/设备网络需在服务器上验收。

静态 Sites/GitHub Pages 托管不运行本 Node 服务；原 Sites worker 和打包文件保持原样。要使用新后端，使用上述 Node+Caddy 同源部署。

主仓库的静态根目录与本地原型的 `public/haiz` 布局均可运行；主仓库的 Flow 资源来自已存在的 `prototypes/haiz-world/public/haiz/world/flow`。根 main 原有 Flutter Pocket 使用 Supabase、Academic 使用独立服务，本 Node 网站账号不冒充它们已同步升级；同源部署时应为其他产品保留独立 API 路由，不能仅靠推送 main 宣称公网登录已生效。

## 备份与恢复

```sh
HAIZ_DATA_DIR=/var/lib/haiz npm run backend:backup -- /private/backup/haiz-2026-11-04.sqlite
```

备份目录预先建立并限制访问；命令使用 SQLite 在线 backup API，包含已提交的 WAL 数据，不是直接复制主文件。输出文件 0600。恢复：停止服务，保留原数据目录作为回退；在新的私有数据目录放置备份并命名 `haiz.sqlite`，设置 0600，修改 `HAIZ_DATA_DIR`，重新启动并验证登录与业务记录。不要把旧 `-wal/-shm` 文件拷进恢复目录。恢复后的会话按原到期时间继续生效；如备份曾泄露，应通过管理接口撤销会话/修改密码。

生产服务默认每日自动备份，开发默认关闭。`HAIZ_BACKUP_INTERVAL_HOURS` 可设1至168小时，0关闭；最多保留最新7个已完成备份，放在私有数据目录的 `backups/`，完成独立SQLite完整性检查后才轮换。管理员metrics可看最后成功/失败时间。备份仍在本机，异地副本需正式部署时配置。

## 验证

`npm run test:backend` 运行不依赖 npm 包的 Node 后端测试，CI 使用同一命令的 Node 入口。主仓库保留原有静态网站测试与构建。React 原型副本另外运行 `npm test`、`npm run build`、`npm run test:sites`；旧 Flow 回归位于原型的 `public/haiz/world`（在主仓库为 `prototypes/haiz-world/public/haiz/world`）。`npm run backend:bench` 创建临时数据库，执行本机 16 并发的 300 次读与 100 次事务写；只报告本机数据，不能用作生产容量承诺。

实现依据：[Node SQLite API](https://nodejs.org/api/sqlite.html)、[Node scrypt](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback)、[SQLite WAL](https://www.sqlite.org/wal.html)。
