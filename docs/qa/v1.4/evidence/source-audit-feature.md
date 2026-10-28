# HAIZ 功能台账 · FEATURE LEDGER

**审计版本：2026-10-27 · 01组 · 只读核查。**
基线 A：GitHub Pages main = 55638e8ad1；基线 B：Academic v1.3 = 663b51ddde（v1.3.0-preview.1）。两者**无共同 Git 祖先**，切勿把两个基线的功能相加后称为“已集成”。公开发行 https://github.com/manyIwant/haiz/releases/tag/v1.3.0-preview.1 。

## 状态定义

- **V 已实现且在本次指定层面验证**：必须说明是单元、HTTP 合成端到端、编译或静态站点检查，不能统称用户可用。
- **C 代码存在、未完成目标平台实测**：实现有限、需要验收。
- **P 部分实现/产品闭环不成立**：只能作为基础能力。
- **B 仅原型/实验分支**：尚未并入选定发布基线。
- **N 未实现或没有证据**：不把规划当事实。
- **A 需要第三方或校方授权**：不能当已接入。

## 01 · main 上的 HAIZ Space

| 功能 | 当前证据 | 判定及边界 |
|---|---|---|
| GitHub Pages + haiz.space | Pages API source=main、status=built；站点 HEAD 返回 200 | V：静态部署/HTTP；非逐页 GUI 验收 |
| 地球下降入口 | main/index.html、descent.html、assets/cinematic/descent*.js；tests/descent.cjs | C：源码和现有测试在 main，**本次未运行 main 的浏览器测试** |
| 校园第一人称漫游 | main/campus-3d.html、assets/walk/、tests/walk | C：程序化校园；非真实测绘重建 |
| 建筑与航拍保真 | main/docs/architectural-fidelity-20261018.md、aerial-map-performance-20261020.md | C：资料推演，缺真实室内建筑测绘证据 |
| 校园杂志、新闻、社团、校友、招生 | main/journal.html、news.html、clubs.html、alumni.html、admissions.html、data/ | C：静态页面/创作提案，非官方实时信息 |
| 摄影、导演台、路线、雨天 | main/director.html、assets/walk/climate.js、tests/journey.cjs | C：源码存在，真实手机性能未复测 |
| 课间窗台 WINDOWSILL | main/windowsill/、windowsill/SOURCE.md | C：原有独立 AGPL 范围；许可证边界必须保留 |
| 共感暗房 | main/darkroom.html、tests/darkroom*.cjs | C：创作工具；未现场验证跨设备链接与导出 |
| HAIZ Space 的素材安全 | main/assets/walk/models/NOTICE.md、windowsill/SOURCE.md | P：存在来源说明，需要做发布许可清单审查 |

**不能将 HAIZ Space 的静态页面测试、v1.3 Android APK 测试和其它 PR 的 CI 互相替代。**

## 02 · Flutter 学生 App（独立 v1.3 分支）

| 功能 | 关键证据 | 当前判定 |
|---|---|---|
| 五 Tab + iOS 风格 Dock / 3 主题 | app/lib/main.dart、app/lib/ui/kit.dart、ios_theme.dart | V（flutter analyze、Widget）；C（视觉和 iPhone 真机） |
| 本地今日任务/完成/删除 | app/lib/core/pocket_store.dart、today_page.dart | V（模型/UI部分测试）；C（真机） |
| 每周课表编辑和展示 | app/lib/ui/schedule_page.dart、pocket_store.dart | P：每周重复；学期、临时调课、校方数据没有 |
| 手动粘贴通知 → 任务候选 | app/lib/domain/notice_parser.dart、ui/inbox_page.dart | V（解析/部分UI）；相对日期默认按**导入日**，不能代表发消息当天 |
| TXT/MD/CSV/DOCX/PDF 文本读取 | app/lib/domain/notice_import_service.dart、test/import_calendar_test.dart | P：DOCX 单测通过；PDF 仅可选文本层、最多24页；不同实际文件格式未全验 |
| 图片中文 OCR | notice_import_service.dart (TextRecognizer.chinese) | C：移动端代码存在；Web 明确不支持；尚无手机实测 |
| 人工编辑、确认与来源 | ui/inbox_page.dart、domain/pocket_models.dart | V（代码/部分测试）；C（源图查看、撤销、复杂场景） |
| 重复任务过滤 | notice_parser.dart、ui/inbox_page.dart | P：局部去重规则；还没有统一全局稳定任务 ID 与跨平台去重 |
| 作业日程 + .ics 导出 | ui/agenda_section.dart、domain/calendar_export.dart | V（文件生成单测）；C（系统日历真实导入） |
| 专注计时 | ui/focus_page.dart、core/pocket_store.dart | P：App 进程终止不保证继续计时，非原生后台计时 |
| Study Relay 任务笔记 | core/pocket_store.dart、ui/focus_page.dart | P：本机纯文本笔记；不是文件/草稿跨设备学习恢复 |
| HAIZ Command 全局搜索 | ui/command_palette.dart | P：本机任务/课程/笔记搜索；不搜索正式学校资源 |
| 自建 Academic 登录与班级任务 | ui/academic_page.dart | P：需手动输入 HTTPS 服务地址并刷新，个人导入需要逐项人工确认；没有离线后台增量同步 |
| 学生账户本地隔离 | core/pocket_store.dart 中 pocket.tasks.v1 等全局键 | **N / P0**：不同账号共用一套设备本地任务与笔记，存在混读风险 |
| iOS IPA | 未找到实际 iOS release 构建/签名证明 | N：无真机打包验收 |
| Android APK | 已验证 v1.3.0-preview.1、versionCode 4、v2 签名、API 24/36 | V：签名/包构建；C：实际安装运行和平台 OCR |

## 03 · 教师与教务

| 功能 | 证据 | 判定 |
|---|---|---|
| 独立教师 Web 草稿/复制/打印 | web/teacher/index.html | V（源码/JS 静态检查）；P：保存 localStorage，没有向 Academic 发起发布 API |
| 独立教室大屏 | web/teacher/classroom.html | P：读取同源 localStorage 草稿，**未经正式发布也能展示** |
| Academic Web UI | services/academic/public/{index.html,app.js,ui.css} | V（静态页面和 HTTP），C（多浏览器人工交互） |
| 管理员建教师 / 教师建班 | services/academic/server.mjs，test.mjs | V：合成 HTTP 端到端测试；非正式学校身份 |
| 学生邀请码 + 待教师核准 | server.mjs，test.mjs | V：合成权限测试 |
| 教师正式发布作业 / 学生查看 | server.mjs、test.mjs | V：当前模型的最小闭环 |
| 已查看回执 | server.mjs 的 acknowledgements | V（合成测试）；不是“完成”“提交”或真实屏幕验证 |
| 作业修改/撤销/修订历史 | v1.3 server.mjs 只有 GET/POST assignments | **N / P1**：没有 assignment revision、update/retract |
| 学生正式提交/教师批改 | 未发现相应服务端表、权限、UI | N |
| 学期考试、成绩、正式学籍、校园卡 | 没有学校 API 授权数据源和业务模块 | A/N |
| 多端增量同步/冲突恢复 | v1.3 server.mjs 没有 cursor/version/变更流 | N / P1 |
| One Publish 真正一次发布到两个界面 | web/teacher localStorage 和 Academic SQLite 两套数据 | **P / P1**：界面尚未整合 |
| Paper Bridge | web/teacher/index.html 生成可复制文本与打印 | V（本地流程），不属于正式教师授权发布 |
| 学校名册签名入口 | server.mjs 的 school/roster、school_links | V（合成验签测试）；A：没有真实校方授权、SSO、名单 |
| ClassIsland 原生组件 | integrations/classisland/.../HomeworkComponent.cs + cipx | V（.NET8 编译 + SDK打包）；C：Windows 宿主安装、ABI与课堂断网验收 |
| ClassIsland 离线缓存/修改同步 | 目前每 45s 刷新屏幕 feed；异常显示同步不可用 | P：无最后有效内容缓存、版本回执等 |

## 04 · QQ / HAIZ Teach / Motion

| 功能 | 证据 | 判定 |
|---|---|---|
| QQ 官方 Bot SDK 桥接 | integrations/qq-bot/bot.mjs，package.json，test.mjs | V：模拟消息规范化、验签调用；A：无真实 AppID/授权群端到端 |
| 群通知自动进入审核队列 | server.mjs 的 qq/mapping、integrations/qq/event、inbox | V（合成数据）；不能监听任意 QQ 群消息 |
| 老师核实群通知后发布 | Academic Web app.js、server.mjs | V（合成 HTTP）；未真实群测试 |
| 群消息历史抓取 | 不存在正规授权能力，不应实施 | N（明确不属于范围） |
| 打点计时器小车 / v–t 图 | app/lib/domain/ticker_physics.dart、ui/ticker_lab_page.dart | V：50Hz、0.1s、拟合单测；C：真实教学课堂效果与物理仪器差异 |
| 多学科教学引擎、HAIZ SCAN OCR 教师端 | v1.3 未找到可用完整模块 | N / B |
| iOS 级完整视觉语言 | kit.dart、ios_theme.dart + 早期 LUCENT PR | P：Dock/卡片已有，跨 Web/App 系统一致性尚无设计验收 |
| 电影级空间连续 Motion | PR #4、#6 和 world/lucent/motion 原型（各自 base 不同） | B：未合并到 v1.3 或 main，不能当生产能力 |
| STILLROOM 自适应/Flow 跨设备 | PR #1/#2/#12 等开放 Draft | B：存在多种独立原型，不能直接计入 v1.3 |
| 教室作业冲突恢复/修改撤回 | PR #20 feat/haiz-campus-operations | B：该 PR 的 CI 已成功，但未合并至主站、也未移植到 Academic v1.3 |
| HAIZ ATLAS 和 INNER WORLD V2–V5 | PR #14–#19 多级 Draft 链 | B：与 main 的实际部署相互独立 |

## 量化检查结果与可信度

- Flutter analyze **0 issues**，Flutter tests **20/20 PASS**；测试覆盖有限，不能外推为 20 个功能端到端。
- Academic **1 个综合 HTTP 测试 PASS**（内部包含多项断言）。
- QQ 适配器 **2/2 单测 PASS**（模拟对象，不是官方 QQ 群服务连通）。
- ClassIsland **.NET8 Release build PASS**，0 warnings / 0 errors；.cipx 已打包。
- APK **Android v2 签名校验 PASS**，package=space.haiz.app.preview，versionName=1.3.0-preview.1，minSDK=24，targetSDK=36；ADB 当前**无设备**。
- main Pages status=built，HTTP 200；本轮未重新运行它的全部 npm/Playwright/WebGL 测试。

所有状态均是截至本次核查的证据边界；“代码存在”不能替代“真实设备可用”。参见 TECHNICAL-AUDIT.md、RELEASE-GAPS.md 和 DEPENDENCIES.md。
