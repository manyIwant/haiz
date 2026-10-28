# HAIZ 技术审计 · TECHNICAL AUDIT

**01组技术核查记录，2026-10-27。审计对象：manyIwant/haiz 的 main、preview/haiz-academic-v1.3、开放 Draft PR 及 Mac 本地构建。**

## 1. 检查方式（事实范围）

- 用 GitHub API 获取仓库默认分支、Pages 部署、所有分支、20 个开放 Draft PR、CI、Release 附件。
- 实时查 main：commit 55638e8；Academic preview：663b51d；通过 GitHub compare 得到 **No common ancestor**。
- 检查 Flutter、Node 服务端、QQ 适配器、ClassIsland、教师静态页面源文件及测试代码。
- 在 Apple Silicon Mac 上**本次重新运行**：Flutter analyze、flutter test、node --test、npm test、dotnet build；重新校验已发布 APK 包信息和 v2 签名。
- 向 https://haiz.space/ 发 HEAD，返回 200；GitHub Pages API 指向 main，状态 built。
- 未对 main 做完整 Playwright 重跑；未连接 Android/iPhone/Windows ClassIsland、真实 QQ 群或学校授权接口。
- 项目工程未改写。写入范围仅审计报告 docs/audit/；此前工程的未跟踪截图和 jev-use/ 原样保留。

## 2. 实测命令与结果

| 检查 | 命令/方法 | 结果及边界 |
|---|---|---|
| Flutter 静态分析 | 在 app/ 运行 flutter analyze --no-pub | 0 issues |
| Flutter 单元和组件 | 在 app/ 运行 flutter test --no-pub --reporter expanded | **20/20 PASS**；未覆盖真机 OCR 和 API 端到端 |
| Academic HTTP 合成端到端 | services/academic/ 运行 node --test test.mjs | **1 个大测试 PASS**（内部包含鉴权、权限、QQ验签、学校匿名名册） |
| QQ Bridge 单测 | integrations/qq-bot/ 运行 npm test | **2/2 PASS**；没有真实机器人账号事件 |
| ClassIsland 插件 | dotnet build -c Release --no-restore | Build succeeded，0 Warning，0 Error |
| APK 真实性 | apksigner verify --verbose | Android v2=True，v1/v3=False；这是有效包签名判断，不是安装运行 |
| APK 包属性 | aapt dump badging | package=space.haiz.app.preview；versionCode=4；versionName=1.3.0-preview.1；minSDK=24、targetSDK=36 |
| 真机列表 | adb devices -l | 空；不具备设备验收结论 |
| Pages/域名 | GitHub Pages API 与 curl HEAD | main 已部署、HTTPS、HTTP 200；不构成 WebGL/多页交互验收 |
| GitHub Release | gh release view v1.3.0-preview.1 | 五个附件 uploaded，APK=105,518,056 bytes |

### 3. 核心问题分级

**P0 · I-001：历史断裂，不能常规合并两套核心产品。**
- GitHub compare main...preview/haiz-academic-v1.3 返回 404: No common ancestor，main=55638e8，preview=663b51d。
- 结果：常规 PR 合并和 CI 适配不成立，README、CNAME、学校资料及静态站点素材也不在同一源码图谱。
- 建议：先由架构负责人确定 monorepo 或多仓库+共享协议；**不要强制合并全部文件**；单独制作迁移对照表与兼容策略。回归 main 不能破坏 Pages 发布路径。

**P0 · I-002：学生数据缺少用户隔离。**
- app/lib/core/pocket_store.dart:11、29–35、76–81、146–150 使用固定键 pocket.tasks.v1、pocket.taskNotes.v1 等，未含账户或租户。
- app/lib/ui/academic_page.dart:29–31、297–301 切换/退出在线账号只清理临时 Session/UI，没有清理或重定向本地 PocketStore 的全局记录。
- 风险：同一手机或浏览器上的不同 HAIZ 登录身份可能继续看到前一个账号保存的作业、笔记；涉及学生隐私。
- 验证等级：**源码确定的隔离缺口，未做真机账户切换实测**。修复需迁移旧数据，禁止简单清空导致丢作业。

**P1 · I-003：两套教师工作台无同一个发布事实来源。**
- web/teacher/index.html:127–140 保存 localStorage，复制文本和纸质清单；web/teacher/classroom.html:49–69 直接展示同源浏览器草稿。
- services/academic/public/app.js 另走 /api/classes/:id/assignments，数据库在 services/academic/server.mjs。
- 影响：静态版“教室大屏”展示未经服务器确认的草稿，和 ClassIsland 插件的只读“已发布任务”不是同一数据。所谓 One Publish 目前不成立。
- 建议：明确一个正式发布 API、草稿/待审/已发布状态；旧 Web 要么适配，要么清晰命名为“离线整理器”；禁止将它直接当教务正式屏。

**P1 · I-004：Academic 后端没有作业修订、撤回和增量同步。**
- services/academic/server.mjs:26 assignments 只有基础字段，无 version/revision/tombstone；284–295 仅 GET/POST 作业；352–357 屏幕读取最新列表。
- 未见 ETag、同步游标、版本冲突恢复或 revision audit 业务表。
- 开放 Draft PR #20 feat/haiz-campus-operations **已有另一条主线的更高级冲突恢复、撤回和课堂回执逻辑**；不能把其通过 CI 的实现说成 v1.3 已有。
- 建议：先比较 PR #20 与 Academic 的数据契约，移植经过验证的概念/测试，而非并行重写第二套服务。

**P1 · I-005：已“在线登录”不等于可靠多端同步。**
- app/lib/ui/academic_page.dart:95–150、153–200：手工设置 HTTPS 服务地址、登录、手动刷新、逐条复制到本地。
- PocketStore 的数据不按课程版本更新；没有删除/撤销回流、离线队列或双向同步策略。
- Flutter Web AcademicPage:95–98 还主动阻止该入口的登录，Web 工作台是另外一套应用。
- 建议：制定发布对象稳定 ID、source revision、学生私有任务与服务端作业分层、cursor、冲突和撤回协议后再实现自动同步。

**P1 · I-006：发布 QA 不能替代目标设备实测。**
- APK 可签名并可安装分发，但 adb devices 为空；没有 Android 真机截图 OCR、PDF、权限/通知、重开恢复。
- ClassIsland macOS 上 .NET DLL 和 cipx 成功，但**没有 Windows ClassIsland 宿主真实安装**。
- 真实 QQ/学校 SSO 无授权连接样本；只能标为集成待验证。
- 建议：将真机验收作为 Release Gate，不把“编译通过”写成“兼容”。

**P1 · I-007：班级系统还不具备正式学生信息系统必需的制度保障。**
- services/academic/server.mjs 仍是个人自托管 SQLite、角色、Cookie 和基于密钥的最小鉴权；无正式校园 IdP、备份恢复、账户找回、删除请求处理、管理员 MFA、安全事件处置、数据保留期限。
- 本版本不可导入真实完整学籍名单或称官方教务系统。正式部署须先取得学校和相关负责人的明确授权，并进行独立安全/隐私审查。
- 对已经开展的自建学生协作小范围试点，也应默认使用虚构数据并避免真实姓名。

**P2 · I-008：相对日期依据导入日而非原消息发送日。**
- app/lib/domain/notice_parser.dart:45–48、143–164：明天/后天/周五由调用日期决定，注释明确并非消息日期。
- 影响：老师昨天发布、学生今天导入“明天交”，结果会错一天；虽然候选可编辑，仍有不明显误期风险。
- 建议：导入时可选消息原始时间、展示计算依据；缺时间要显著标红为待核。

**P2 · I-009：文档/OCR 验证范围窄。**
- notice_import_service.dart:13–76 限 12MB；image OCR 只在移动端，PDF 仅有文本层且最多24页；DOCX 样例测试仅覆盖常规段落。
- 未证据证明：扫描版 PDF、复杂表格、多个作业表格、附件引用、中文截图的真机识别质量。
- 建议：建匿名真实样式合成文件样本集，OCR 原文可追溯，逐条确认。

**P2 · I-010：ClassIsland 的只读凭据与失败回退尚不完整。**
- HomeworkComponent.cs:28、51–101 每45秒请求，失败时显示“同步暂时不可用”；没有持久保存最后一份已核验作业列表与版本。
- 只读 screenKey 是高权限展示凭据，通过 URL 路径传输；配置文件与代理日志需要避免记录或外泄；支持教师轮换但尚缺设备登记和撤销审计。
- 建议：运行环境确认、缓存签名摘要、最后更新时间、请求超时和隐私提示。

**P2 · I-011：自动化测试数量不能证明所有功能闭环。**
- 后端 node --test test.mjs 是 1 个大综合 test()，并非多个互相隔离的模块套件；缺 HTTP 并发、限流、重启持久化、删除/撤销、Web 浏览器 UX、更新迁移测试。
- QQ adapter test.mjs 两项均合成消息；插件缺 Windows 宿主自动测试。
- 建议：分层测试矩阵（模型、API、跨进程/跨设备、宿主插件、真实环境）。

**P2 · I-012：学生任务/课表默认会填入示例数据。**
- app/lib/core/pocket_store.dart:38–49、60–65 无缓存时调用 starterTasks()/starterCourses()。
- 虽 README 解释为演示，在实际首次打开“今天”“课表”仍可能被误读为真实安排。
- 建议：首启动明确“样例”“清空并开始”；正式发布默认空白或导入向导。

**P2 · I-013：二十个 Draft PR 的目标分支相互链式依赖。**
- PR #1–#20 并非平行、单一 main 的可合并列表；#4/#11/#12/...为串联的实验基线；#20 的 base 还是 feat/haiz-lucent-integration。
- 部分 CI 成功说明对应工作流通过，不是合并到生产，也不表示后来分支必然兼容。
- 建议：先冻结基线，逐项摘取经审查的变更，避免整个实验链直接合并。

**P3 · I-014：跨 App/Web 视觉实现未形成一个可验证设计系统。**
- app/lib/ui/kit.dart + ios_theme.dart 具备 Spring Dock；web/teacher/ios_skin.css 另有规则；LUCENT/Motion ID 分支尚未统一迁移。
- 建议：设计令牌、动效状态机、响应式断点和 Reduced Motion 规范独立产出后统一验收。

## 4. 安全与版权边界

已看到的积极实践：
- 明确区分 HAIZ 账号与官方学校账号，不默默认定教师身份。
- 后端具备密码哈希、HttpOnly 会话 Cookie、基本角色鉴权、QQ/名册 HMAC 事件验签。
- QQ 机器人只设计处理获授权群 @事件，人工发布审核在接口层存在。
- ClassIsland 只读 feed 排除了学生姓名与成员列表；密钥可以轮换。
- 部分主站源码保留 AGPL/CC0/CC BY 素材和作者声明。

**不能由此推断**：真实生产环境数据安全合规、官方 QQ 开放平台授权已经取得、开源依赖商业使用全部许可满足、学校学籍授权完成。上线前需第三方审查与运维机制。

## 5. 优先建议（01组结论）

1. **停止把 main、v1.3 和 PR #20 视为一个已集成产品**；先定源代码基线与公共 API。
2. **学生本地账户隔离优先于新增功能**；基于用户身份迁移本地任务，保护旧记录。
3. 统一教师“草稿”和“正式发布”的语义，只允许教师确认后的数据进入班级 API。
4. 对修订/撤回/离线恢复优先复用 PR #20 的成熟设计与测试资产，不复制另一套后端。
5. 安排 Android + Windows ClassIsland 真机验收，再决定是否开放更大范围的自建协作测试。

**结论：v1.3 是具有实际源码、测试与可验证产物的工程预览版，但不是一个已完成学校授权、跨端可靠同步、正式作业提交与生产运维的“完整校园教务系统”。**
