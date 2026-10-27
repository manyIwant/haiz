# Quality Assurance & Test Verification Report · 质量审计与自动化测试报告

**Test Target:** HAIZ Teacher Workspace & One Publish System  
**Version:** v1.4.0-preview.0  
**Test Suite:** Unit Tests (Node Test Runner) + E2E Tests (Playwright Real Headless Browser)  
**Executed At:** 2026-10-27 23:44:48 CST  
**Overall Result:** 112 Unit Tests Passed (100%), 12 E2E Scenarios Passed (100%)

---

## 1. 测试环境与配置

- **Node.js**: v24.22.1
- **Browser**: Chromium Headless Shell 1243 (macOS arm64)
- **Database**: SQLite WAL mode in temporary isolated sandbox (`academic.sqlite`)
- **Backend Authority**: `services/academic/server.mjs` (port dynamically assigned)
- **Teacher Workspace Proxy**: `web/teacher/server.mjs` (port dynamically assigned)
- **Accounts**:
  - `synthetic_admin`: 系统管理员
  - `synthetic_teacher`: 虚构教师（拥有班级创建与作业发布权限）
  - `student_alpha`: 虚构学生甲（加入班级 A）
  - `student_beta`: 虚构学生乙（加入班级 B）

---

## 2. 单元测试结果 (Unit Test Suite)

执行命令：`npm test`  
执行文件：`tests/unit/*.test.mjs`  
结果：**112 passed, 0 failed, duration 134ms**

| 模块 | 测试文件 | 测试用例数 | 覆盖核心能力 | 状态 |
|---|---|---|---|---|
| **API 契约层** | `api.test.mjs` | 23 | 字段长度、截止时间格式、Idempotency-Key 语法、差异比较算法、分页边界、网络超时转换 | ✔ PASS |
| **教室屏流式订阅** | `classroom-feed.test.mjs` | 63 | Bearer 鉴权、96位密钥校验、隐私标头 `containsStudentIdentity: false` 强校验、翻页防重复校验 | ✔ PASS |
| **草稿存储管理** | `drafts.test.mjs` | 11 | 本机草稿状态隔离、多账号命名空间隔离、存储损坏防护、100项配额溢出保护、旧版平滑迁移 | ✔ PASS |
| **请求日志自愈** | `journal.test.mjs` | 6 | 超时重放原请求、防窜改检查、实例隔离、确定性拒绝与服务繁忙（503）区分 | ✔ PASS |
| **反向代理服务** | `server.test.mjs` | 9 | 静态资源只读服务、CSP 安全标头检查、跨站写防护（CSRF）、旧版直接发布拦截（409 USE_ONE_PUBLISH） | ✔ PASS |

---

## 3. 端到端浏览器自动化测试 (E2E Browser Test Suite)

执行命令：`npm run test:e2e`  
执行文件：`tests/e2e/run.mjs`  
驱动方式：Playwright 启动真实无头浏览器，模拟用户输入、表单提交、弹窗交互与多标签页并发。  
结果：**12 passed, 0 failed**

### 12 项关键验收场景执行明细

```
  ▶ Scenario: 1. 正常创建草稿 (Create draft normally)... ✔ PASS
  ▶ Scenario: 2. 草稿进入 Review (Draft enters review)... ✔ PASS
  ▶ Scenario: 3. 正式发布成功 (Publish successfully)... ✔ PASS
  ▶ Scenario: 4. 发布请求超时后的安全重试 (Idempotent retry after timeout)... ✔ PASS
  ▶ Scenario: 5. 编辑已发布作业 (Edit published assignment)... ✔ PASS
  ▶ Scenario: 6. 两个页面同时修改时产生版本冲突 (Version conflict detection)... ✔ PASS
  ▶ Scenario: 7. 作业撤回 (Assignment retract)... ✔ PASS
  ▶ Scenario: 8. 无权限用户无法发布 (Unauthorized user cannot publish)... ✔ PASS
  ▶ Scenario: 9. 不同班级的数据隔离 (Class data isolation)... ✔ PASS
  ▶ Scenario: 10. 页面刷新后正式作业仍然存在 (Persistence across refresh)... ✔ PASS
  ▶ Scenario: 11. 离线草稿不会被误认为已发布 (Offline draft is never confused with published)... ✔ PASS
  ▶ Scenario: 12. Classroom 不泄露学生私人数据 (Classroom leaks no private data)... ✔ PASS
```

#### 场景 1：正常创建草稿
- **操作**：教师登录后点击“新建草稿”，输入科目“物理”、标题“必修一练习题 1-5”、详细要求、设置截止日期为“2026-11-02”，点击“保存草稿”。
- **验证**：草稿列表展示卡片并标注“本机草稿”；学生端预览实时渲染正确文字；已发布计数显示 0。

#### 场景 2：草稿进入 Review
- **操作**：在草稿编辑器中点击“进入 Review”。
- **验证**：向服务器创建正式草稿（v1）并推进到审核态（v2）；页面展示“Review · 等待教师确认”通知；状态芯片变更为“待发布 · 服务器”。

#### 场景 3：正式发布成功
- **操作**：教师在审核详情区点击“确认发布”，在弹窗中点击“正式发布”。
- **验证**：服务器确认后状态推进为 `published`（v3）；通知栏提示“服务器已确认发布”；作业自动转入“已发布”列表；学生甲通过 `/api/v1/classes/{id}/assignments` 查询，确认该作业已作为正式内容返回。

#### 场景 4：超时后的幂等安全重试
- **操作**：以相同的 `Idempotency-Key` 重放同一创建请求。
- **验证**：服务器返回已持久化的相同作业数据，标记 `replayed: true`，作业总数未增加，证明网络中断重试绝对安全。

#### 场景 5：编辑已发布作业
- **操作**：教师在“已发布”视图点击“修改内容”，将标题更新为“必修一练习题 1-5（已更新补充题）”，点击“保存修改”。
- **验证**：前端发送携带 `expectedVersion: 3` 的 PATCH 请求；服务器返回 `version: 4`, `status: 'revised'`；学生端查询即刻获得最新版本。

#### 场景 6：双页面并发修改产生版本冲突
- **操作**：浏览器开辟两个独立 Context，同时装载同一作业（v4）。Context 1 提交修改成为 v5；Context 2 尝试提交基于 v4 的修改。
- **验证**：Context 2 收到 409 `VERSION_CONFLICT`；页面弹出版本冲突比对表格，直观展示双方修改字段；教师点击“使用最新版本继续检查”，重新对齐为 v5 后提交，成功递增至 v6，未丢失未提交内容。

#### 场景 7：作业撤回
- **操作**：教师选中作业点击“撤回”，在确认对话框中点击“确认撤回”。
- **验证**：服务器执行 `retract` 命令递增版本为 v7，状态转为 `retracted`；该作业从“已发布”进行中列表中消失，转入“历史”记录，打上“已撤回”芯片；点击“版本历史”，完整展现从创建、发布、两次修改到撤回的完整时间线。

#### 场景 8：无权限用户无法发布
- **操作**：学生账号 `student_alpha` 尝试登录教师工作台。
- **验证**：工作台拦截登录并报错“该账号没有教师工作台权限”；使用学生 Session 直接调用 POST API 被服务器拦截为 403 Forbidden。

#### 场景 9：不同班级数据隔离
- **操作**：教师向班级 B 发布化学作业。
- **验证**：班级 A 的学生查询班级 A，不含该化学作业；班级 A 的学生试图直接查询班级 B，服务器返回 403 Forbidden；班级 B 的学生可以正常获取。

#### 场景 10：页面刷新持久性
- **操作**：在经历发布、修改与撤回后刷新页面。
- **验证**：工作台通过 Session Cookie 自动恢复登录状态，从 Academic SQLite 重新拉取班级与作业，所有正式作业与历史完整展现。

#### 场景 11：离线草稿安全性
- **操作**：在未登录状态点击“离线整理本机草稿”，创建草稿。
- **验证**：标记为“本机草稿”，发布按钮禁用，已发布计数为 0；服务器数据库毫无记录，证明离线操作不会虚假传达给学生。

#### 场景 12：Classroom 隐私零泄露
- **操作**：在 `classroom.html` 输入班级 96 位展示凭据载入大屏作业。
- **验证**：大屏正常渲染公开作业卡片；经 DOM 与 API 载荷严密检查，没有任何学生姓名、账号、完成记录或个人笔记，符合学校公开屏幕的最高合规标准。

---

## 4. 跨工作组协同与待验收建议

1. **致 01 组（安全与审计）**：
   - 教师工作台完全同源部署，HttpOnly Cookie 不落 localStorage，满足安全审计基线。
   - 静态页面 Content Security Policy 严格禁用 `unsafe-inline`。
2. **致 02 组（后端）**：
   - 完全遵循 PR #21 的 `/api/v1` 规范，所有新增逻辑纯前端与代理实现，**未修改 02 组后端核心代码**。
   - 幂等请求与乐观并发在多端测试中表现稳定。
3. **致 03 组（学生端 Flutter）**：
   - 教师端每次发布/修改/撤回均伴随递增的 `version` 与严格事件快照。学生端在做离线笔记合并时，建议以 `(instanceId, assignmentId, receivedVersion)` 锚定，遇撤回时仅隐藏官方条目、完整保留私人笔记。
4. **致 06 组（ClassIsland / 大屏）**：
   - `/api/v1/classroom` 采用只读投影，轮换密钥后旧密钥立即失效，前端支持无缝重填凭据。
