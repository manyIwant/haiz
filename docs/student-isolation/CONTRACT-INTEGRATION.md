# PR #21 契约联调报告

日期：2026-10-27
客户端：`feat/student-data-isolation-v1.4`（PR #22）
后端：`feat/academic-backend-v1.4`（PR #21，Draft，未合并、未修改任何一行）
方式：本机隔离数据库 `node server.mjs` + Flutter 真实 HTTP 客户端（无 mock）。

## 1. 联调环境

```
HAIZ_DB_PATH=/tmp/pr21-run/data/academic.sqlite
HAIZ_PORT=8791
HAIZ_ADMIN_LOGIN=haizadmin
```

虚构数据：管理员 1 名；学生 `student-a`（高一 1 班）、`student-b`（高一 2 班）；
教师作业 1 条（数学 / 练习册第36-39页 / due `2026-11-02` / `duePrecision=date`）。

可重复执行的自动化用例：[`app/test/academic_contract_live_test.dart`](../../app/test/academic_contract_live_test.dart)（`live` tag，默认测试集自动跳过）：

```
HAIZ_LIVE_BASE=http://127.0.0.1:8791 \
HAIZ_LIVE_A=student-a HAIZ_LIVE_A_PASS=... HAIZ_LIVE_A_ID=<uuid> \
HAIZ_LIVE_B=student-b HAIZ_LIVE_B_PASS=... HAIZ_LIVE_B_ID=<uuid> \
flutter test --tags live test/academic_contract_live_test.dart
```

结果：**4/4 PASS**。

## 2. 逐项验收

| # | 要求 | 实测结果 |
|---|---|---|
| 1 | 登录后打开正确的私有空间 | PASS。`identity.cacheScope` = `haiz/v1/{instanceId}/{userId}`，客户端命名空间 = `haiz/v1/{encodedOrigin}/{instanceId}/{userId}`，二者一致 |
| 2 | 登录返回的 User ID 与身份接口一致 | PASS。`/api/auth/login` 的 `user.id` 与 `/api/v1/identity` 的 `data.userId` 相同；不一致时客户端拒绝打开账号空间 |
| 3 | 错误的 `cacheScope` 被拒绝 | PASS。客户端强制 `cacheScope == haiz/v1/{instanceId}/{userId}`，不符即抛 `FormatException`，不打开账号空间 |
| 4 | 服务端身份改变时清除旧视图 | PASS。每次 `refresh` 前重读 `/api/v1/identity`；`userId`/`instanceId` 变化即撤销会话并回落访客空间 |
| 5 | 401/403 不继续展示旧班级数据 | PASS。401/403 清空官方列表并失效会话；实测撤销后 `authorizedClassIds=[]`、`/api/my/assignments` 返回 0 条、`/api/classes` 标记 `rejected` |
| 6 | 不同实例的相同用户名不共享本地存储 | PASS。`instanceId` 参与命名空间；单元测试另覆盖同 org 不同 origin 的隔离 |
| 7 | 旧 v1.3 后端不支持身份契约时明确拒绝 | PASS。客户端在 `_readIdentity` 校验 `state=='Synced'` 且 `data` 为对象，否则登录失败并保持访客。实测 v1.4 无认证访问 `/api/v1/identity` 返回 401（路由存在）；v1.3 无此路由 |

## 3. 发现并修复的契约冲突

联调直接暴露三处客户端与 v1.4 契约不符，均已在客户端修复（未改动 `services/academic/`）：

| 项 | 客户端原实现 | 服务端实际契约 | 后果 | 处理 |
|---|---|---|---|---|
| 已查看确认路径 | `POST /api/assignments/{id}/acknowledge`（旧 v1.3 路径） | `POST /api/v1/assignments/{id}/acknowledge` | 命中旧处理分支，返回「尚未获得班级访问权限」 | 改为 `/v1/...` |
| 已查看确认载荷 | body `{}` | body 必须含 `version`（整数），否则 `INVALID_VERSION` | 每次「标记已查看」都失败 | 发送 `{version: <当前 public version>}`，版本非整数即拒绝 |
| 幂等键 | 未发送 | 必须携带 `Idempotency-Key`（8–100 个 ASCII 字母/数字/`_`/`-`），否则 `IDEMPOTENCY_KEY_REQUIRED` | 请求被拒 | 由 `(action,id,version)` 生成稳定键，重试只重放不重复记录 |

另修正一处测试假服务：`/api/my/assignments` 的假响应缺 `version`，收紧校验后暴露
（原测试断言的是旧路径，因此改动前从未被真正验证）。

## 4. 需要 02 组确认的事项（不改后端，仅请求确认）

1. **`cacheScope` 不含 origin 是有意设计吗？** `sync.identity()` 返回
   `haiz/v1/{instanceId}/{userId}`，而 `SYNC-PROTOCOL.md` 第 24 行定义的本地命名空间是
   `haiz/v1/{normalizedHTTPSOrigin}/{instanceId}/{userId}`。当前客户端在 `cacheScope` 之外自行加
   origin，二者不冲突但字段语义不同名。若 02 组希望服务端直接返回完整可用的本地命名空间，
   需明确 origin 规范化规则（大小写、默认端口、尾斜杠）。当前客户端会做百分号编码，
   因此 origin 中的 `/`、`:` 不会破坏路径分段。
2. **`acknowledge` 的 `version` 是否应允许缺省？** 当前缺省即 `INVALID_VERSION`。客户端已改为
   必传。若 02 组计划支持「确认最新公开版本」的简写，需在契约写明，否则请保持必填。
3. **`/api/my/assignments` 仍是旧路径**（无 `/v1` 前缀），且返回 `viewed` 布尔。v1.4 的
   `/api/v1/sync` 才是权威增量接口。本阶段按任务约束不扩展同步，客户端继续只读旧列表；
   待 API 冻结后需确认旧列表是否长期保留。
4. **撤销后的状态**：撤销把 membership 写为 `rejected`，学生需重新 `join` 再由教师 `approve`
   才能恢复。这是服务端既有行为，客户端按「权限收窄即清理官方内容、保留私人笔记」处理，
   无需变更；如需「撤销后可自助重申请」的语义，请 02 组确认。

## 5. 未能验证

- 未在真实 Android 设备上运行；联调在本机 macOS + 真实 HTTP 服务完成，系统级 Cookie
  持久化、进程终止恢复、厂商 ROM 的 SharedPreferences 行为仍未验证。
- 未覆盖 `/api/v1/sync` 增量同步（本阶段明确不扩展）。
- 未验证 HTTPS 反向代理下的 `Secure` Cookie 行为（本机为 loopback HTTP）。
