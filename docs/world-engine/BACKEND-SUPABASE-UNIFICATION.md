# HAIZ 后端与数据权限统一迁移设计及安全验证方案（Supabase Auth + RLS）

> **安全边界声明**：本文档与 `docs/world-engine/supabase-draft/` 中的 SQL 均为**设计草案与隔离验证方案**。本轮**未执行**任何生产数据库变更、未修改 `supabase/migrations/`、未删除或停用现有 `backend/` 与 `services/academic/` 账号体系。所有迁移必须先在独立 Staging Supabase 项目完成双账号负向 RLS 验收并经人工审批后方可推进。

---

## 一、现状审计摘要（三套孤岛与已发现风险）

| 现有子系统 | 存储与运行时 | 身份与密码方案 | 关键风险与缺口 |
| --- | --- | --- | --- |
| **A. 主站独立后端** (`backend/` + CF Worker/DO) | SQLite (`user_version=3`) + 单 Global Durable Object | `scrypt` + `__Host-haiz_session` (8h) + `session-guard.js` 代理 localStorage | `gateway.mjs` 剥离上游 CSP 且未重新下发；单 DO 串行化全部 `scrypt` 与 SSE 存在争用瓶颈 |
| **B. HAIZ Pocket 云端** (`supabase/` + `app/`) | Supabase Postgres (`public.pocket_snapshots`) | Supabase Auth (Email/Password + JWT) | 缺少数据库层强制单调递增 `version` 与自动更新 `updated_at` 触发器；CI 缺少双账号实时 RLS 隔离测试 |
| **C. 学业试点服务** (`services/academic/`) | 本地 SQLite (`8780`) | `pbkdf2Sync` 200k + `hsid` Cookie (7d) | 缺失 `Origin` 头时 CSRF 检查直接放行；与 A/B 账号体系完全割裂 |

**原则性架构决策**：以 **Supabase Auth + Postgres Row Level Security (RLS)** 作为公网用户认证、权限边界与个人数据的唯一权威底座（免费层即可支持个人开发者长期维护、零自建服务器运维成本、原生支持静态 GitHub Pages + Flutter Pocket + World Engine）；现有 `backend/` 保留为纯本地/校内局域网离线部署兼容方案，与云端共享同一 JSON Schema 数据契约。

---

## 二、身份映射方案（零明文密码迁移）

现有 `backend/`（`scrypt` 私有参数）与 `services/academic/`（`pbkdf2`）的密码哈希不可逆，且绝不应降低安全等级。采用 **Claim-on-First-Login（首次登录领认）+ 映射表** 策略：

1. 新增 `public.identity_links`（仅服务端 `service_role` 可写，用户只读自身行）：
   - `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
   - `legacy_source text CHECK (legacy_source IN ('haiz_backend', 'haiz_academic'))`
   - `legacy_user_id text NOT NULL`
   - `linked_at timestamptz NOT NULL DEFAULT now()`
   - 唯一约束：`UNIQUE (legacy_source, legacy_user_id)`，防止同一旧账号被重复认领。
2. **安全认领流程**：
   - 用户在旧后端成功登录后，旧后端签发一枚**短时（10 分钟）、单次、HMAC-SHA256 签名**的认领凭证（payload 仅含 `legacy_source`, `legacy_user_id`, `role_hint`, `nonce`, `exp`）。
   - 用户通过 Supabase Auth 完成邮箱验证注册/登录后，调用 Supabase Edge Function `claim-legacy-account` 提交凭证；服务端校验签名、防重放 `nonce` 后写入 `identity_links`，并仅迁移该用户自己名下的个人数据（`notes`, `bookmarks`, `preferences`, `works` 草稿）。
   - **权限最小化**：旧账号的 `admin` / `teacher` 角色**绝不**由客户端声明直接授予，必须由人工或离线校方名册脚本核验后写入受保护的 `public.user_roles` 表。

---

## 三、权限边界、数据模型与隐私保护矩阵

详细 DDL 与触发器草案见 [`supabase-draft/001_unified_world_schema_draft.sql`](supabase-draft/001_unified_world_schema_draft.sql)。

| 数据表 | 所属域 | 读权限（RLS） | 写权限（RLS） | 隐私与完整性硬约束 |
| --- | --- | --- | --- | --- |
| `public.user_roles` | 权限主权 | 仅本人读自身角色 | **禁止客户端直接写**（仅 `service_role` / 受审 RPC） | 角色枚举：`student / teacher / moderator / admin`；禁止匿名 JWT |
| `public.pocket_snapshots`（加固） | Pocket 快照 | 仅 `user_id = auth.uid()` | 仅本人 `INSERT/UPDATE`（无 `DELETE`） | 新增 `BEFORE UPDATE` 触发器强制 `NEW.version = OLD.version + 1`、`NEW.updated_at = now()`、`octet_length(data::text) <= 4MB` |
| `public.world_profiles` | World Engine 个人态 | 仅 `user_id = auth.uid()` | 仅本人读写 | 存储 `haiz-user-world-profile/1`（画境偏好、地点足迹、科学实验样本、笔记）；**严禁存精确实时位置轨迹** |
| `public.personal_records` | 个人笔记/收藏/草稿 | 仅 `owner_id = auth.uid()`（连 admin 不可旁路读） | 仅本人 CRUD + `expected_revision` 乐观锁 | 对齐 `backend/repository-core.mjs` 4 类集合，上限 16 KB/条、5000 条/人 |
| `public.campus_works` | 第三幕与校园创作 | `state = 'published'` 对已登录或公开可读；草稿仅作者与审稿人可读 | 作者编辑草稿；状态流转强制经 `SECURITY DEFINER transition_work()` | 保留学生署名权，禁止未审核直接公开；与真人验证/Toybox 收藏完全解耦 |
| `public.campus_notices` | 教学与校园通知 | 按 `scope`（班级/全校）校验角色与所属班组 | 仅 `teacher` / `admin` 对所属 `scope` 写入 | 替代 `backend/` 的 `records` 通知流与 `academic` 公告 |

**多人共游隐私红线**：
- 默认**完全关闭**多人位置广播；仅当用户主动点击「开启校园共游」并选择可见范围（`off | friends | campus-room`）时，通过 Supabase Realtime Ephemeral Broadcast 仅广播 `haiz-peer-packet/1`（不含真实姓名、学号或历史轨迹，**永不落库持久化**）。

---

## 四、API 兼容性与零停机分阶段迁移策略

为保证既有前端页面（`src/account/`、`app/`、`lab/`、`world-engine.html`）在迁移期间零中断：

1. **阶段 0 · 隔离演练（Staging Only）**：
   - 在独立 Supabase Staging 项目应用 `001_unified_world_schema_draft.sql`，运行 `verify_rls_isolation_draft.sql` 双账号负向测试，确认全部通过。
2. **阶段 1 · 前端统一抽象层 (`DataClient` 契约)**：
   - 新增轻量客户端适配器，向上暴露统一接口：`auth.me()`、`profile.load/save()`、`records.list/upsert/delete()`；底层按配置切换 `local-only`（默认零依赖）、`supabase` 或 `legacy-backend`。
   - `world-engine/core/state.js` 已输出标准 `exportUserContract()`，无需重构即可直接对接 `public.world_profiles`。
3. **阶段 2 · 双写与灰度切换（保留旧后端只读兜底）**：
   - `pocket_snapshots` 原表原地加固（向后兼容现有 Flutter App CAS 更新逻辑，仅需客户端确保 `version = old + 1`）。
   - Web 账号入口支持旧账号一次认领迁入 Supabase；旧 `backend/` 保持只读存档至少 30 天，不删除 SQLite 数据文件。
4. **阶段 3 · 安全头与旧服务收尾**：
   - 修复 `backend/cloudflare/gateway.mjs` 的 CSP 透传缺陷与 `services/academic/server.mjs` 的无 `Origin` CSRF 缺陷（若继续保留内网试点模式）。

---

## 五、回滚方案（Rollback Playbook）

| 触发条件 | 即时回滚动作（< 5 分钟） | 数据保全措施 |
| --- | --- | --- |
| 任一 RLS 负向测试失败或出现越权访问迹象 | 立即通过前端配置开关切回 `local-only` / 旧 `backend/`；在 Supabase 撤销 `authenticated` 对受影响表的 `GRANT` | 保留 Postgres PITR / 逻辑导出快照用于审计 |
| Flutter Pocket CAS 冲突率 > 2% | 回滚 `pocket_snapshots` 新增触发器（`DROP TRIGGER enforce_pocket_version`），保持原表结构不动 | `pocket_snapshots` 原数据零结构改动，天然可逆 |
| 迁移认领失败 | 保留 `backend/` SQLite 原始只读备份与 `identity_links` 审计表，允许用户重试或继续使用本地导出 JSON | 绝不在迁移阶段执行 `DROP TABLE` 或物理删除旧库 |

---

## 六、自动化安全与 RLS 验证策略

见 [`supabase-draft/verify_rls_isolation_draft.sql`](supabase-draft/verify_rls_isolation_draft.sql)，在 Staging Postgres / 本地 `supabase start` 环境中每次迁移 PR 强制执行 7 类负向安全断言：

1. **匿名拒绝（Anon Denial）**：`anon` 角色对 `world_profiles`、`personal_records`、`pocket_snapshots`、`user_roles` 执行 `SELECT/INSERT/UPDATE/DELETE` 全部返回 0 行或权限拒绝。
2. **匿名 JWT 拒绝**：带 `is_anonymous = 'true'` 声明的 JWT 无法读取或写入受保护个人表。
3. **跨账号水平越权阻断（User A vs User B）**：模拟 User B 的 `request.jwt.claims`，尝试 `SELECT / UPDATE / DELETE` User A 的 `world_profiles`、`personal_records`、`pocket_snapshots`，强制断言 0 行受影响。
4. **角色提权阻断**：普通 `student` 无法 `INSERT / UPDATE` `public.user_roles` 把自己提升为 `teacher` 或 `admin`。
5. **版本回滚阻断**：User A 尝试把 `pocket_snapshots.version` 从 `3` 改回 `2` 或跳过为 `5`，触发器强制抛出异常。
6. **大包体与脏数据阻断**：写入超过 4 MB 的 JSON 或非法 `schema` 字段被 `CHECK` 约束拒绝。
7. **审计日志不可篡改**：普通用户无法修改或删除历史版本/迁移认领记录。
