# HAIZ 免费云端部署

用户要公共后端、不依赖其Mac、尽量免费不折腾，并已确认拥有Cloudflare域名账号。选择 Workers Free + 单个SQLite Durable Object，而非收费VPS；不启用付费/R2/外部付费数据库。DO保留同步事务，普通Worker只转发。域名原GitHub Pages源站保留原内容，不上传整个大仓库；账号资源打包随Worker，其他页面从固定GitHub Pages来源代理，HTML鉴权后注入已验证身份。不会把本机测试数据上传。

## 分工与接口

1. 数据库核心：抽离 backend/repository-core.mjs，导出 createRepositoryCore(db,{transaction,backup,close}={})，保留所有当前run(operation,args)与SQL业务。db接口prepare(sql).get/all/run，exec(sql)，isTransaction（可选）。初始化事务和业务transaction必须用注入同步transaction(callback)；Node默认实现保留真实BEGIN/COMMIT/ROLLBACK。Node wrapper repository.mjs保持createRepository(directory)及本机备份/文件权限，原83测试不能回归。core不导入node:fs/sqlite/worker_threads。cloudflare/sqlite.mjs导出createCloudRepository(storage)，用storage.sql.exec和storage.transactionSync，无SQL BEGIN/COMMIT；schema version放私有metadata表兼容PRAGMA user_version语义，忽略Node专用journal/synchronous/busy_timeout/checkpoint，其他SQL保持真实执行。Nodecore仍用原PRAGMA迁移。core拒绝未知高版本，cloud备份/close不宣称本地文件备份可用。
2. 云HTTP：backend/cloudflare/api.mjs 导出 createCloudApi({database,env,rooms}) -> {fetch(request),authenticate(request)}。database.call接口Promise包装core.run，who/sessionId再次校验。保持现有server.mjs全部API（包括auth aliases、Flow、个人恢复/搜索/用量/活动、admin、rooms）响应/状态/请求ID；生产同源Host/Origin/Content-Type/64KiB/方法/身份前置校验与安全Cookie保持。不用本机代理专用头校验，公网client IP由Worker入口从CF-Connecting-IP写内部头，DO只接受入口请求。实际路由/权限独立测试。authPasswords = passwords({maxConcurrent:1})或同等单并发修改，以保证单DO128MB内存上限；保持scrypt参数和密码长度。BOOTSTRAP_INVITE环境secret仅用于一次初始化数据库，不返回到HTTP；bootstrap只在users为空时创建，不在已有账户时重置管理员。注册默认学生，password修改后旧会话立即关房间。admin metrics加入cloud free计划/不支持本机自动备份说明，不能返回Secrets。无密码找回新增服务。
3. 云房间：backend/cloudflare/rooms.mjs，导出createCloudRooms(database)，接口{join(request,auth,room),post(auth,room,action,input),closeSession(id),closeUser(id),metrics}；join返回真实SSE Response，snapshot/presence/position/message与现SDK相同；session/ip/room/user限额、不保存消息、到期断开、重连身份前置、慢消费者有界。可复用既有rooms.mjs算法但不得假装Node响应成功；所有输入和鉴权保持。专用测试SSE流+撤销/到期。
4. root worker/config/static：backend/cloudflare/worker.mjs DO类HaizBackend；constructor中storage初始化core，call运行串行同步事务；API重CPU全部在DO执行。Worker入口转发到全局DO一个，防多实例在线割裂。原站静态资源可以直接从固定https://manyiwant.github.io/haiz/读取；API与HTML绝不能缓存。账号/login/SDK等用打包静态资源；只代理公开页面允许路径，禁止backend/src/tests/scripts/docs/.git/隐藏路径/私有文件；受保护HTML鉴权，注入session-guard与我的数据入口，原页面只返回固定origin的内容。不得改写浏览器Origin伪造同源。云配置通过PUBLIC_ORIGIN确定精确来源；开发本机HTTP仅显式DEV=1；生产CookieSecure。上线前先workers.dev独立地址验收，再绑定haiz.space；main原网站不直接被未验收部署替换。

## 验证与部署

新增子包有wrangler/miniflare开发依赖、nodejs_compat与SQLite DO迁移。先用真实workerd运行本机云版本测试，验证scrypt密码注册/登录、SQL版本迁移/事务、个人跨账号隔离/历史恢复、Flow、SSE。Node83项和Sites构建继续通过。独立安全审查。部署只用现有Cloudflare免费计划，登录OAuth授权由用户完成。账户若已有付费计划，不自动创建资源以免意外计费，应说明具体情况。无本机数据迁移，初始化邀请码仅保存在本机私有文件并写Worker secret，不入git/控制台/网页。

免费边界：Workers与DO各100k请求/天，SQL5m读/100k写/天，全账号存储5GB、单DO1GB；单DO常开SSE约11kGB-s/day在13k免费内，位置高频上报会耗尽请求额度。Free超限失败而非自动购买。当前Do时间旅行/备份支持按官方实测准确说明，不能承诺每日7份本机备份仍存在。若任何核心运行时不可用，先修复或明确阻断，不上线丢功能的假后端。
