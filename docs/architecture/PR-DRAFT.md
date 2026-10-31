教师修改、学生离线恢复与课堂展示此前没有共同的版本和变更记录。本变更以现有 Academic SQLite 为唯一正式来源，加入稳定 Assignment ID、草稿/审核/发布/修订/撤回、不可变历史、乐观并发和持久幂等回执；公开变更与资源写入同一事务，客户端通过绑定身份/权限的持久游标获取快照及增量。

基于 `preview/haiz-academic-v1.3`，不与无共同祖先的 main 强制合并，不影响 Pages。已先阅读 01 四份审计及 [manyIwant/haiz#20](https://github.com/manyIwant/haiz/pull/20)，复用其权限重查、幂等、冲突和公开投影规则。保留旧 API 适配器与全部旧数据；新增 OpenAPI、迁移/回滚、缓存隔离和 03/04/05/06 交接契约。修复延迟请求体会话撤销绕过、QQ 群映射接管、畸形游标签名与成功登录耗尽限流额度。

验证：
- [x] 51/51 后端测试；先在旧服务验证 18 项 RED。
- [x] 覆盖率：行97.78%、分支86.87%、函数98.95%，80%门槛通过。
- [x] OpenAPI parser + Ajv 真实 HTTP 响应校验。
- [x] 迁移保留/失败回滚、SQLite锁、事务故障、重启、同键重试、并发冲突、撤权/账号切换/游标过期。
- [x] QQ 适配器2/2合成测试；npm audit 0已知漏洞。
- [x] 本地浏览器登录/建班/reload、v1 identity/snapshot；独立审阅发现问题均修复复测。
- [ ] 01 独立安全审查与 10 QA。
- [ ] 03 Flutter本地隔离与真实客户端同步；04新生命周期UI；06 Windows宿主验收。
- [ ] 正式QQ/学校授权、备份恢复演练、隐私/保留/MFA与生产部署门禁。

限制：未改Flutter/教师页面/插件；私有笔记保留仅协议模拟，不能声称设备隔离已修复。旧教师管理台新建班级后需reload的继承问题已交04。无自动事件清理、多节点、SSE或正式学校身份。标准ECC专用代理认证403，改用继承模型独立审阅；GitHub CI尚无本分支结果。完整报告：[WORK-REPORT](docs/architecture/WORK-REPORT.md)。请保持Draft，等待01/10审查，不合并或正式发布。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
