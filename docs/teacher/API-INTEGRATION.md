# Academic API Integration Report · 接口集成技术规范

**Version:** v1.4  
**Base Path:** `/api/v1`  
**Security Standard:** Same-origin reverse proxy, HttpOnly session cookie, strict CSP, Zero credential leakage

---

## 1. 部署与通信架构

为了杜绝在客户端存储任何明文会话 Token 或密码，前端工作台采用**同源安全反向代理**架构：

```
[教师浏览器]
     │ (Same-Origin: http://127.0.0.1:8781)
     │ - 静态资源: /index.html, /classroom.html, /js/*, /css/*
     │ - Cookie: hsid (HttpOnly, SameSite=Strict)
     ▼
[Teacher Web Proxy (web/teacher/server.mjs)]
     │
     ├── 拦截非同源跨站写操作 (Sec-Fetch-Site & Origin 检查)
     ├── 拦截过时废弃接口 (/api/classes/{id}/assignments 直接发布)
     │   └── 返回 409 USE_ONE_PUBLISH，强引导回统一发布流
     │
     │ (内部转发)
     ▼
[Academic Authority (services/academic/server.mjs, Port 8780)]
     ├── SQLite Authority & WAL Transactions
     ├── 身份认证与角色鉴权 (Role: admin, teacher, student)
     └── Sync Event Stream & Command Receipts
```

### 1.1 安全响应头 (Security Headers)
代理服务对所有前端页面注入最高标准安全标头：
- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none';`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`

---

## 2. 接口映射与协议契约

统一响应信封格式：`{ state, data, error, meta }`

| 动作 | 方法与路径 | 必需标头 / 凭据 | 请求体 (Payload) | 预期响应与状态 |
|---|---|---|---|---|
| **获取身份** | `GET /api/v1/identity` | `Cookie: hsid=...` | 无 | 200 `{ userId, instanceId, role, authorizedClassIds }` |
| **创建草稿** | `POST /api/v1/classes/{classId}/assignments` | `Idempotency-Key` | `{ subject, title, details, due, duePrecision }` | 201 `{ assignment: {...version:1, status:'draft'...}, replayed }` |
| **班级列表** | `GET /api/v1/classes/{classId}/assignments` | `Cookie: hsid=...` | 查询参数 `limit`, `after` | 200 `{ assignments: [...] }` |
| **作业详情** | `GET /api/v1/assignments/{id}` | `Cookie: hsid=...` | 无 | 200 `{ assignment: {...} }` |
| **进入审核** | `POST /api/v1/assignments/{id}/review` | `Idempotency-Key` | `{ expectedVersion: 1 }` | 200 `{ assignment: {...version:2, status:'review'...} }` |
| **正式发布** | `POST /api/v1/assignments/{id}/publish` | `Idempotency-Key` | `{ expectedVersion: 2 }` | 200 `{ assignment: {...version:3, status:'published'...} }` |
| **修改作业** | `PATCH /api/v1/assignments/{id}` | `Idempotency-Key` | `{ expectedVersion, [subject], [title], [details], [due], [duePrecision] }` | 200 `{ assignment: {...version: N+1, status:'revised'...} }` |
| **撤回作业** | `POST /api/v1/assignments/{id}/retract` | `Idempotency-Key` | `{ expectedVersion }` | 200 `{ assignment: {...version: N+1, status:'retracted'...} }` |
| **版本历史** | `GET /api/v1/assignments/{id}/history` | `Cookie: hsid=...` | 查询参数 `limit`, `after` | 200 `{ revisions: [{ version, actorId, operation, changedFields, snapshot }] }` |
| **大屏公开源** | `GET /api/v1/classroom` | `Authorization: Bearer <screenKey>` (96位hex) | 查询参数 `limit`, `after` | 200 `{ className, assignments: [{ id, subject, title, details, due, version }], readOnly: true, containsStudentIdentity: false }` |

---

## 3. 标准错误响应处理 (Error Handling)

所有错误均统一返回标准 JSON 信封：

```json
{
  "state": "Conflict",
  "data": null,
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "作业已有新版本，请重新核对",
    "currentVersion": 4
  },
  "meta": {}
}
```

- **401 Unauthorized (`state: Revoked`)**：会话已过期，前端切至登录界面，保留当前草稿。
- **403 Forbidden (`state: Revoked`)**：当前账号缺少教师权限（例如学生账号试图访问教师端），明确提示。
- **404 NotFound (`state: Failed`)**：作业不存在或已被删除。
- **409 Conflict (`state: Conflict`)**：
  - `VERSION_CONFLICT`：并发版本冲突，携带有 `currentVersion`，驱动前端渲染差异比对表。
  - `IDEMPOTENCY_CONFLICT`：同一请求标识发送了不同内容。
- **503 Service Unavailable (`state: Failed`)**：SQLite 繁忙或后端启动中，前端提示使用原请求重试。

---

## 4. 跨端协同现状与分工边界

当前整体工程协同状态明确如下：

1. **已达成一致（04 组与 02 组完全闭环）**：
   - 教师发布 → Academic SQLite 事务提交 → 实时生成 SyncEvent 与 Revision。
   - 教师修改/撤回 → 递增版本号并记录快照。
   - 教室大屏通过 Bearer ScreenKey 获取公开只读作业，无学生个人信息。
2. **跨端实现程度说明（必须明确区分的三种阶段）**：
   - **阶段 A：后端事件已持久化** —— **100% 完成**（通过 `sync_events` 严格递增序列）。
   - **阶段 B：学生端通过手动刷新/拉取取得最新内容** —— **100% 完成**（学生调用 `/api/v1/classes/{id}/assignments` 或 `/api/v1/sync` 均可完整取得）。
   - **阶段 C：学生端自动增量同步与冲突合并** —— **依赖 03 组**（PR #22 奠定了账号隔离与本地存储基础，但 Flutter 端后台长轮询自动触发仍在 03 组演进路线上）。
