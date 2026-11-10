# HAIZ 免费云端部署验收 · 2026-11-05

实际服务：<https://haiz-backend.haiz-world-prototype.workers.dev/login/>。

已发布到 Cloudflare Workers + 一个 SQLite Durable Object；版本 `5fbffed7-f0e4-4e00-a3bc-f9812beff95a`。本机服务不参与云端请求。Cloudflare OAuth已由用户本人确认；初始化邀请保存到Cloudflare Secret前曾被自动审批拦截，随后用户明确授权该凭据及目的地，再执行，未绕过拦截。

当前授权账号不管理haiz.space，用户确认域名位于另一账号。本轮没有修改其DNS/Workers路由，也没有宣称原域名已启用后端登录门禁。

## 验证结果

- 原Node完整测试87/87通过，构建成功，Sites4/4通过。
- 云端适配测试30/30通过：Request/Response API、真实DO SQLite事务/元数据、scrypt、账号与会话、Flow、搜索/历史/恢复、SSE、过期/撤销/背压及静态网关。
- Cloudflare发布成功，Worker包约81KiB、8项静态账号资源，启动约7ms（平台本次输出，非容量承诺）。
- 公网 `api/health`200，`api/ready`200/schema3；灯光页在真实浏览器显示。
- 公网脚本实际注册两名合成学生、验证Secure Cookie、跨账号404、身份切换409、删除后恢复新版本、历史与搜索、真正SSE snapshot和消息，并验证登录后能读取带身份保护的原主站HTML。两名合成账号及其记录已清理。没有消费管理员初始化邀请。
- 浏览器保留公开云端灯光页；截图保存于本机docs/evidence/haiz-free-cloud-login.jpg，不随源码提交。

## 审查处理

- 独立审查发现GitHub Pages固定上游会301到haiz.space，可能502/循环；改为固定GitHub raw主站来源，明确设置MIME，去除raw下载页面的sandbox头，HTML鉴权/no-store和私有源码路径拒绝保留。
- 初次管理员邀请过期无恢复入口：增加仅对私有初始化Secret、仅密码未设置且无有效会话的恢复；测试确认不能重置已设置的管理员密码。
- main与本地原型的墙面图片位置不同：资产构建支持两种布局，测试确认不复制私有文件。
- 真实workerd测试的HTTP驱动会把Host改为loopback，测试专用入口修正驱动的Host；生产Host/Origin校验保持严格，没有为通过测试而移除校验。

## 约束

按Free目标部署，没有购买套餐。免费额度按平台政策限制，不承诺无限访问。云端使用平台Time Travel而不是本机文件备份。原Flutter/Supabase与Academic仍有独立身份体系；未冒称统一升级。管理员所有者尚需在安全页自行设置密码，私有邀请码未公开。
