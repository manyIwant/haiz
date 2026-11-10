# HAIZ 免费云端后端

当前已部署：<https://haiz-backend.haiz-world-prototype.workers.dev/login/>。

网站账号、个人数据、历史恢复、教师工作台与实时房间运行在 Cloudflare，不依赖开发者电脑。正式深蓝暖光灯光入口保持原样。`haiz.space` 在另一个 Cloudflare 账号，本轮没有修改其 DNS 或原主站；云端验收地址可以独立注册登录和使用。

## 架构

- 普通 Worker 处理同源入口、登录门禁、账号静态资源与原站页面代理。
- 一个固定名称的 SQLite Durable Object 保存所有业务数据和在线房间，使用同步 SQL 与 `transactionSync`，保留 Node 版原子读改写、版本校验和所有权约束。
- 通用业务在 `../repository-core.mjs`；Node 文件包装仍支持独立服务器部署。云端没有使用 `node:sqlite`、`worker_threads` 或本地文件系统存储。
- 密码继续使用原 scrypt 参数，在 DO 中一次只做一项密码派生。实际 workerd 和公网均已验证，不放在普通 Free Worker 的 10ms CPU 中运算。
- 云端数据是新建的独立生产库，不上传本机测试数据库。原站只从固定 `raw.githubusercontent.com/manyIwant/haiz/main/` 读取公开文件；原 GitHub Pages 地址会跳转自定义域名，不能作为代理上游。HTML 必须先登录，不缓存；不会接受访客指定任意上游。文件 MIME、HTML 安全头和 Flow 别名由网关处理。
- 普通浏览器 API、`__Host` Secure/HttpOnly Cookie、Origin 与 `X-HAIZ-User` 身份前置条件保持不变。后台接口不会返回初始化 Secret。

## 免费边界

目标是 Workers Free；本轮没有开通付费套餐。Free 的 Worker 与 DO 各有每日100000请求上限，DO 有每日13000 GB-s，SQLite每日500万行读、10万行写，全账号5GB。具体以 Cloudflare 当前政策为准。保持 Free 时超限会失败，不会自动购买付费套餐。高频位置上报和大规模历史查询会消耗额度，不承诺无限用户或永久零费用。

单个持续在线的 DO 按128MB估算约11059 GB-s/日；多个长驻对象会叠加。因此这版保留一个实例，不按每个房间创建常驻对象。SSE 消费者有64KiB队列上限、会话到期与撤销保护，消息不保存历史。

云端恢复使用 Cloudflare SQLite DO 的 Time Travel（官方当前30天），由账号操作员执行；没有伪称继续生成本机每日7份文件备份。账号中心导出仍可下载本人有效数据。

官方文档：[DO定价](https://developers.cloudflare.com/durable-objects/platform/pricing/)、[限制](https://developers.cloudflare.com/durable-objects/platform/limits/)、[SQL与Time Travel](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)。

## 构建和验证

在本目录运行 `npm ci`、`npm run build`、`npm test`。build 是 dry-run，不会发布。兼容日期固定2026-08-06，与当前锁定workerd一致。测试覆盖真实SQL/scrypt/SSE和原Node数据实现；CI不需要Cloudflare凭据。

`build-assets.mjs` 只打包8项明确允许的登录/账号资源，兼容 main 根目录与本地原型路径，不包含数据库、`.env`、私有邀请或OAuth配置。

公网验收脚本仅在显式确认写入时运行：

```sh
node public-smoke.mjs https://已部署的来源 --confirm-synthetic-write
```

它创建两个空白合成学生账号，验证隔离、恢复、原站HTML门禁及真实SSE，然后删除测试账号和数据；不会使用管理员邀请。

## 部署与管理员

部署需要 Cloudflare 官方 Wrangler 登录，保留 Free，不启用付费/R2。先核对目标账号和 `PUBLIC_ORIGIN`，运行构建；使用私有部署配置而不是将账号凭据写入源码。部署命令为 `wrangler deploy --config 私有配置路径`。账号/域名切换前需先验证可用性，不自动接管已有主站。

`BOOTSTRAP_INVITE` 是部署时新生成的43位随机一次性管理员初始化邀请，仅写 Cloudflare Secret 和本机0600私有文件，不进入Git。初次进入灯光页，选择“使用管理员提供的邀请”，登录后在账号安全页设置管理员密码；密码由账号所有者本人输入。已设置密码的管理员不会被初始化 Secret 重置；未设置密码的初始邀请过期时，可持原Secret恢复初始化邀请。普通用户直接注册，只得到student角色。

首次生产初始化、备份恢复和域名路由修改都应使用正确的Cloudflare账号；不能把另一个账号下的haiz.space当成当前已接入。
