# 10 组后端独立安全复核记录

复核日期：2026-10-27。源码：PR 21 `b308312a8f5d8387c66e319c642223b399440a3f`，QA 集成树 `a03da32`（与 PR 22 合并后的测试专用分支）。本轮没有修改后端业务实现、迁移 SQL 或既有测试辅助函数，没有发布或合并原 PR。

## 结论与边界

**后端自动化复验：PASS（63/63；不是整版发行批准）。** 本轮读查及实际 HTTP 测试未确认新的后端 P0/P1 权限绕过、跨账号泄漏或迁移数据丢失。这个结论只对应执行的合成测试与代码路径，不能推导出真实设备、Windows 宿主、HTTPS 反代或 Flutter 增量同步已通过。

证据：[backend-security.log](evidence/backend-security.log)。从 `services/academic/` 执行 `npm run test:coverage`，退出码 0；包含原有 51 项和 10 组 12 项 QA 探针。Node v24.22.1，macOS arm64，测试均创建临时独立 SQLite，全部使用虚构教师/学生。

| 指标 | 本轮结果 |
|---|---:|
| 总测试 / 通过 / 失败 / 跳过 | 63 / 63 / 0 / 0 |
| 生产模块行覆盖率 | 97.78% |
| 分支覆盖率 | 88.30% |
| 函数覆盖率 | 98.95% |

分支覆盖率受额外 QA 测试覆盖路径影响，不能与只运行原有 51 项时的数字混用；日志保留确切命令对应的结果。

## 实际复核的实现

- `services/academic/server.mjs:85`：服务端仅用随机 Cookie 的 SHA-256 摘要查当前会话并核对过期时间。`readBody` 在等待请求体后再次校验先前用户及角色（71–83）；业务 v1 mutation 还在读体完成后重新取当前用户。
- `services/academic/api.mjs:28`：v1 路由权限与 mutation 入口；`classroom` 只接受独立展示凭据并输出限定字段（15–26）。
- `services/academic/commands.mjs:16`：幂等回放前重新校验权限；同一用户/route/key 与规范化载荷哈希绑定。`update` 检查 expectedVersion 并在事务中保存版本、修订、事件及回执（60–77）；acknowledgement 校验指定版本确为公开版本（80–90）。
- `services/academic/sync.mjs:27`：游标 HMAC、instance/user/permission fingerprint 绑定；权限变更返回无资源内容的 409 Revoked；快照固定 high-water，后续变更交由 delta 读取（46–68）。
- `services/academic/migrate.mjs:17` 与 `migrations/001-versioned-assignments.sql`：事务内增量迁移、checksum ledger、外键及完整性检查、原记录 backfill、membership epoch triggers、不可变 revision/event triggers。
- 读取并核对 `tests/security.test.mjs`、`tests/storage.test.mjs`、`tests/v1.test.mjs`、`tests/helpers.mjs`、新增 `tests/qa-probe.test.mjs` 以及契约相关源码；执行包含 contract suite 的完整后端覆盖率命令。

## 本轮验证与 QA 证据修正

1. **Guest 与学生权限。** 无 Cookie 的 identity/sync/assignment/class-list 请求为 401 且 data=null；展示 Bearer 不能充当学生会话；同班学生无法列出另一学生的 acknowledgement。这里只检查列明的接口，不声称遍历所有 v1 路由。
2. **跨班级。** 学生首次快照不包含另一班已发布资源；直接读取和待核准 join 后读取均拒绝。
3. **会话过期。** 在测试数据库中使 session 过期后，identity、sync、resource read、合法公开版本 acknowledgement 均返回 401，不借助非法 version 产生假阳性。
4. **游标隔离。** 同班不同学生以及教师会话不能使用原学生游标；改写 payload 而保留签名返回 400。
5. **发布状态。** draft/review 不进入公开 sync/classroom；学生猜测 draft id 返回 404。该 probe 里的 teacher 是该班所有者，已删除原先“foreign teacher class”误导标题。
6. **撤回。** delta 包含同 id 的 retracted 版本；v1 class list 保留撤回记录以供客户端协调；旧 active-list 移除；教师仍能读原 acknowledgement 历史。
7. **幂等。** 同 key create 返回同一 draft；变更载荷返回 409。此探针没有向 QQ 发送重复通知，也未测试重复 publish，因此已改正标题。实际 QQ 来源去重由既有 `security.test.mjs` 的已执行测试覆盖。
8. **版本冲突。** 同教师两个 HTTP 会话先后提交同 expectedVersion，一次成功、另一次 409，当前标题保持胜出版本。它不是两台真机或同时到达请求；已将标题改为准确范围。既有并发编辑测试另随完整套件执行。
9. **修订历史。** 保留修改前后快照，学生历史仅含公开 status。响应本来会包含公开修订 actorId，测试未证实隐藏 actor 身份，故已去除原先错误的“hides internal actors”标题。
10. **撤权后恢复。** revoke 导致原游标 409；不带旧游标的 fresh snapshot 合法返回空 authorizedClassIds/assignments，不能错误要求 403。测试随后通过第二 SQLite 连接直接恢复 membership（故意绕过 join UI，测试 epoch trigger），同一个学生会话仍不能复用旧游标。该结果不能作为真实校方身份恢复端到端证明。
11. **两个真实独立服务。** 原 probe 只是向空服务提交全零 Cookie，无法证明“外服会话重放拒绝”。已替换为两个完整独立 fixture，均创建 `synthetic_student_b` 同名账号且使用相同虚构密码，确认 instanceId/userId/cacheScope 不同。取得两份真实登录 Cookie 后双向跨服回放均 401；第二服务持自身有效会话重放第一服务的游标为 400。测试不打印任何 Cookie。
12. **服务重启。** 同账号现有会话及 identity 的 instance/cacheScope 保持稳定，identity 不回显 login/label。

新增测试只是补充与独立复验，许多与开发组原有测试有意重叠；已删除“不会重跑开发组断言”的不实文件头注释。仅修改 QA 文件，未通过改变产品语义让测试变绿。

## 迁移与故障恢复证据的实际强度

本轮完整执行既有 storage suite，覆盖：有数据的 v1.3 schema 保留原字段、已查看记录回填、重复迁移幂等、checksum 不符拒绝、SQL 故障回滚、外键损坏拒绝并保留源记录、revision/event 不可变、SQLite 写锁 503 和相同 key 重试、事件插入故障的完整事务回滚、过期游标安全重新快照。

以下仍是 **NOT VERIFIED**，不能从以上测试推断通过：

- 迁移进行中由操作系统 SIGKILL/断电后从实际磁盘恢复；现有迁移故障测试主要为内存 SQLite 注入 SQL 错误。
- 实际磁盘空间耗尽、文件系统损坏、目录权限变更、备份恢复/跨节点灾难恢复。
- 经公网 HTTPS 反向代理后的 Secure Cookie、代理日志和请求来源策略。
- 真实校园 IdP/学校名册撤权；QQ 官方凭据与真实事件。本轮 fixture 将其禁用。
- Flutter 本地 namespace 与真实 Android SharedPreferences 的设备隔离，以及 `/api/v1/sync` 的客户端事务应用、cursor 持久化；后端测试中的客户端协调对象不等价于 App 功能。
- 全量安全审计、所有路由的穷举攻击、部署级性能或恶意高并发压力。

## 缺陷与负责人

本轮未新增已证实的后端业务缺陷。上面的误导性测试名称、假 Cookie probe 和过度结论属于 **QA 证据质量缺陷**，已在 QA 文件中修正，由 10 组负责。平台/客户端实际同步与恢复未完成的部分，应在主 QA 矩阵逐项列为未验证或功能缺口，不能因后端 PASS 自动标 PASS。
