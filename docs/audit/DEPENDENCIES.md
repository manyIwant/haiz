# HAIZ 技术依赖与分工边界 · DEPENDENCIES

**01组依赖清单，2026-10-27。** 本文件既包括软件包依赖，也包括“其他组必须先交付什么”的工作依赖。

## 1. 当前实际上是多个系统

### A. HAIZ Space / GitHub Pages（线上）
- main：55638e8，网站 https://haiz.space/，CNAME / GitHub Pages 根目录静态站点。
- Node 用于静态页面/场景构建和测试：main/package.json 的 build、test、test:browser、test:walk 等。
- 主站数据和源码：assets/walk、assets/cinematic、windowsill、descent.html、docs/architectural-fidelity 等。
- 运行时不需要 Academic Node/SQLite；**将全部 Flutter/Node 服务文件倒进 main 根目录不是合理的部署策略**。

### B. HAIZ Academic + App（独立预览）
- preview/haiz-academic-v1.3：663b51d。没有与 main 共享祖先。
- Node.js 24+：services/academic/server.mjs + Node 内置 node:sqlite（自托管），默认 127.0.0.1:8780。
- 服务器单机 SQLite：users、sessions、classes、memberships、assignments、acknowledgements、qq_mappings、intake、school_links、school_events、audit。
- Flutter App：Dart SDK ^3.13.7，Flutter Android/Web；app/lib/core/pocket_store.dart 是本机另一个数据源，不能直接视为服务端副本。
- Flutter pubspec.yaml 明确依赖：
  - shared_preferences ^2.5.6：设备端文本缓存（无用户隔离/加密的风险须优先治理）；
  - file_picker ^13.3.0：选择本地通知附件；
  - archive ^4.0.9、xml ^6.6.1：docx 文件提取；
  - pdfrx ^2.6.5：PDF 文本层，涉及原生 PDF 引擎；
  - google_mlkit_text_recognition ^0.17.1：中文 OCR（真实平台能力需真机验证）；
  - http ^1.5.0：连接自建 Academic API；
  - cupertino_icons ^1.0.8：视觉图标；
  - flutter_test、flutter_lints、shared_preferences_platform_interface：测试开发依赖。
- Android：SDK 36 / Build Tools 36 / NDK 28.2、Gradle、Java 和单独存放的预览签名密钥。签名与编译不自动提供用户安装实测。
- iOS：具备工程模板，但未找到本次 IPA 签名和 TestFlight 产物证据。

### C. QQ Bot Bridge
- integrations/qq-bot/package.json：@tencent-connect/qqbot-nodejs 1.0.5（锁版本、npm install）。
- bot.mjs：官方高层 SDK 消息事件 → 字段规范化 → HMAC 事件签名 → Academic /api/integrations/qq/event。
- 服务器负责 groupOpenid 绑定、去重、审核、发布；机器人本身不具备学生审核权。
- 运行前提：官方 AppID/AppSecret、授权的群场景和机器人事件权限。没有凭据只能使用模拟测试。
- 机器人不能访问任意聊天历史；设计中也不应加入共享 QQ 登录令牌的手段。

### D. ClassIsland / Windows 教室端
- integrations/classisland/HAIZ.ClassroomPlugin/：.NET8、Avalonia、ClassIsland.PluginSdk 2.0.0.*（本次解析为 2.0.0.2）。
- .cipx 在 macOS SDK 环境编译成功；目标需要 Windows 上与插件 API 兼容的 ClassIsland 版本。
- 读取 GET /api/screens/{screenKey}，45 秒刷新。screenKey 由教师端轮换。不能传入学生个人 Session。
- 缺少 Windows 宿主版本/实际教室设备测试，不能把 .cipx 等同于正式安装成功。

### E. 离线教师整理器
- web/teacher/index.html 和 classroom.html **只依赖浏览器 localStorage**（键 haiz.teacher.v1.drafts）。
- 与 Academic Web 管理台 services/academic/public/app.js **当前不共用正式发布数据库**。
- 可以用于 Paper Bridge、离线打印与人工复制；若要同步，必须由教师重新确认后写入 Academic API。

## 2. 功能依赖图

[校方身份系统，需书面授权] ──> [签名匿名名册连接器] ──> [Academic 学生与班级映射]
[QQ 官方机器人，需授权] ──> [消息验签 / 去重] ──> [教师待审 Inbox]
[手动 OCR / Word / PDF] ──> [候选提取 + 人工确认] ──> [个人学生待办]
[教师 Web 发布] ──> [唯一 Assignment API + revision] ──> [学生增量同步 + 离线恢复]
                                                   └──> [ClassIsland 只读展示]
[学生私有笔记 / 专注] ──> [按账号隔离的 Student Task / Study Relay]
[HAIZ Space 3D] ──> [独立静态发布]；共享品牌规范，不共享账号数据与数据库。

**尚未稳定的关键节点**：Assignment 修订协议、学生私有任务映射、增量同步游标、撤回语义、学校身份映射审查流程。02 后端组先交付公共契约，03/04/05/06 再分别开发。

## 3. 分支与 PR 依赖实况

- main 55638e8：HAIZ Space 正式静态站点。
- preview/haiz-academic-v1.3 663b51d：独立 Android/Web/Node/QQ/ClassIsland 预览。
- PR #1 → #2 → #4 → #7 → #8 → #9 等互为实验链基线。
- PR #11（Android/iOS 启动回归）、#12（STILLROOM 质量层）、#13–#19（多级 3D 场景）、#20（教师作业冲突/撤销/回执）并非均针对 main 的独立 PR。
- PR #20 base=feat/haiz-lucent-integration，CI 对该分支成功，不代表已进入 main 或 preview/haiz-academic-v1.3。
- **不能对所有 PR 顺序执行 merge**：会引入大量相互覆盖、版本不兼容或用户从未决定保留的功能。

## 4. 外部代码与许可观察

- Super Productivity / ZZUPocket 在项目文档里列为 MIT 参考，当前 Flutter 的任务与通知模块以自主实现为主；仍需对源码与第三方依赖完整做 LICENSE scan。
- Notice Hub 部分新内容使用 PolyForm Noncommercial，而 HAIZ 文档仅声称借鉴概念，未直接打包其代码；如后续导入源文件必须逐一核实许可。
- Every Joule 的公开发布版本不代表源工程可自由复制；现有打点计时器由 HAIZ 独立计算/绘制。
- main/windowsill 是明确的 AGPL 来源区，windowsill/SOURCE.md 说明独立许可及源码披露，不应随意跨界搬入闭源 App。
- main/assets/walk/models/NOTICE.md、assets/walk/credits.json 记录模型/材质作者及许可；照片版权不等于可自由再分发。
- Tencent SDK、ClassIsland SDK、Flutter pub 包及 PDF/MLKit 原生库，应在公开商业或校级使用之前做完整 SBOM/许可证审查。
- 本审计没有给出法律许可意见；有争议的素材/协议须请权利人或专业顾问确认。

## 5. 推荐组间接口所有权

| 模块 | 主责 | 需要的上游 | 不允许越界修改 |
|---|---|---|---|
| 01 源码审计 | 审计组 | main、release、全部 PR | 不改业务逻辑或冒充实测 |
| 02 Academic API & migrations | 后端组 | 基线/数据模式 | 教师 UI、学生 UI、Space |
| 03 Flutter 本机学习与同步 | 学生 App 组 | 02 的版本化 API 契约 | 服务端权限、ClassIsland 内部实现 |
| 04 教师 Web / One Publish | Web 组 | 02 的作业发布/审核接口 | Flutter 数据库、QQ 授权获取 |
| 05 QQ 官方 Bot 适配器 | QQ 组 | 02 的 verified intake API + 腾讯资格 | 未授权普通群历史监听 |
| 06 ClassIsland 插件 | Windows 组 | 02 的只读 screen feed | 学生私人数据、校方账号 |
| 07 UI / Motion Design System | 视觉组 | 品牌与无障碍标准 | 并发覆盖他组 UI 源码 |
| 08 HAIZ Teach | 教学组 | 原创实验计算模型 | 侵权移植无许可课件 |
| 09 HAIZ Space | 3D/静态组 | main 发布资产与来源 | Academic 账号数据库 |
| 10 QA / Release | 测试组 | 所有独立功能 PR 与证据 | 不替开发者宣称已测试 |

建议每组在独立 Git worktree/分支工作。02 的契约应先发布 API Schema / mock server，03 和 04 使用同一个契约再做界面。10 对跨组真实集成设门禁，00 总指挥决定优先级/是否合并。

## 6. 可复用优先级

**优先考虑沿用经过验证的部分而非重做**：
1. PR #20 的作业 revision/冲突/撤回逻辑与测试设计（需确认与 Academic 数据表映射）。
2. v1.3 原有 OCR、docx/PDF 读取、任务人工核对、ticker-tape 数学算法及测试。
3. ClassIsland 官方 PluginSdk 的 ComponentBase 与既有 .cipx 打包脚手架。
4. 腾讯官方 QQ Bot SDK、群 @事件有限授权机制。
5. main 的校园地图/场景及图片版权清单，独立维护静态发布。

**不应直接复用或合并**：缺少许可证的 Every Joule 资源、未经授权的校务接口、个人 QQ 凭据、旧实验 PR 的完整文件夹覆盖 main。
