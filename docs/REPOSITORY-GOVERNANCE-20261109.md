# HAIZ · 仓库治理审计与整改记录

审计日期：2026-11-09。基线：`main@155845e`。本次通过 GitHub API 检查元数据、全部递归文件树、分支、Pull Request 与工作流。本文件给出**可追溯的现状与处置策略**；创建本文件**不表示**大型资源已经迁移、旧 PR 已关闭或 Git 历史已压缩。

## 1. 验证过的现状

| 维度 | 审计结果 | 说明 |
| --- | --- | --- |
| 仓库体积 | GitHub API `size: 734697 KiB`，约 717.5 MiB / 735 MB | 这是 GitHub 仓库指标，不能等同于当前工作树大小或 Git 历史下载量 |
| `main` 当前文件树 | 递归树约 2501 项，未被截断 | 包含文档、代码、模型、视频、二进制部署资源 |
| 分支 | 100 条 | 包括已完成和活跃的 `claude/*`、`feat/*`、`release/*`、`qa/*` |
| 未关闭的 Issues | **0** | GitHub `open_issues_count=42` 会把 PR 也包含进去；实际搜索 `is:issue is:open` 为 0 |
| 未关闭的 PR | **42** | 42 项均为 Draft；部分 PR 使用其他开发分支作 base，不能假定都以 main 为基准 |
| Actions 配置 | `.github/workflows/` 有 17 个工作流文件 | 不能单凭数量判定冗余，需审计触发条件及跨模块重复构建 |
| 仓库元信息 | 默认 `main`，公开，`description`/`topics`/`homepage` 为空，根目录 LICENSE 缺失 | 已有子项目及第三方专属许可，不能统一改成 MIT |

### 当前提交快照中的主要目录（按 GitHub Blob 大小求和）

| 目录 | 体积 (MiB) | 文件数 | 风险 |
| --- | ---: | ---: | --- |
| `prototypes/` | 264.8 | 940 | 独立原型含大型 GLB、视频、重复媒体与部署快照；不能整目录删除 |
| `pocket/` | 93.8 | 70 | Flutter Web 构建结果，含 CanvasKit 等运行时 |
| `lamp-preview/` | 47.0 | 55 | 另一份 Web 构建和 WASM 运行时 |
| `releases/` | 38.2 | 2 | Git 直接跟踪旧 Android APK 及其校验文件 |
| `app-preview/` | 38.0 | 42 | Web 静态发布构建，部分与其他预览目录重复 |
| `assets/` | 37.5 | 200 | 包含主站实际需要的纹理、模型与校园照片，不能无验证迁走 |
| `docs/` | 18.1 | 148 | 设计审查、浏览器截图及文档 |
| `lanren/` | 17.0 | 93 | 六幕主页核心资源，属于运行时关键依赖 |

以上是**当前目录 Blob 合计**，不包含历史中同一路径旧版本的多次存储；不能据此断言 Git 仓库克隆只需这些数据。

### 体积最大的单文件

- `prototypes/haiz-world/public/haiz/world/v3/assets/hero.glb`：56.1 MiB。
- `prototypes/haiz-world/public/haiz/world/v3/assets/campus.glb`：45.7 MiB。
- `releases/android/haiz-pocket-v1.4-optical-v2-arm64.apk`：38.2 MiB（`40051087` 字节）。
- `prototypes/haiz-world/public/haiz/world/v3/assets/hero-mobile.glb`：34.9 MiB。
- `prototypes/haiz-world/public/haiz/world/v3/assets/planting.glb`：11.3 MiB。
- 三个 `prototypes/haiz-world/.../cinema/media/HAIZ-{porcelain,obsidian,ocean}.mp4`：分别约 10 MiB。
- `app-preview/`、`pocket/`、`lamp-preview/` 都保有 CanvasKit 等 WASM 构建资源，可能存在**有意发布的重复**。

## 2. 已经实施的低风险整改

- 重排根目录 README：首页定位、六幕体验、项目入口、运行方式与状态说明前置。
- 原 README 原文及历史技术日志归档至 `docs/README-ARCHIVE-20261109.md`。
- 更新 `START-HERE.md`，避免继续指向早期「树荫与气候评审版」而误导新访客。
- 新增 `LICENSING.md`，保留 Windowsill AGPL、第三方 MIT、CC0、CC BY 4.0、字体、校园照片与原创代码各自适用范围，不替权利人作新授权。
- 改进 `.gitignore` 与新的提交规范，以减少**未来**再次把安装包、构建残留和临时影像提交到 Git。已受 Git 跟踪的资源不受 `.gitignore` 自动影响。

## 3. 分支和 PR 的处理原则

现存 42 个 Draft PR 不等于 42 个应删除的废弃任务。部分是串行开发链：某 PR 的 base 指向另一功能分支，例如早期 HAIZ Pocket、ClassIsland、Academic 的依赖链。强行改为 `main` 或批量删除分支，可能破坏可审查的变更关系。

按以下证据逐项归类后再处理：

1. **活跃未合并成果：保留。** 特别是 `claude/youthful-davinci-c31244` 中仍在精修的六幕艺术工作，以及其他有实际未合并代码的开发分支。
2. **已完整合并且无额外独立提交：可作为清理候选。** 先检查 `merge-base --is-ancestor`、PR 引用、工作流引用、发布引用，形成可恢复的 SHA 清单，再删除。
3. **被新实现取代但未合并：先归档 PR 的技术价值和原因；明确无需恢复后才关闭。** `closed` 不等于删除代码，但会改变可发现性，应在 PR 留备注。
4. **仍为发布/QA/故障追踪基准：保留。** 即使短期没有开发，也可能被文档、签名或 CI 使用。

**本轮不强制推送、不重写历史、不批量关闭 PR、不删除分支。** 后续可用一份分支清单记录 `name`、`SHA`、`ahead/behind`、PR 状态、作者、用途与推荐操作。只在验证之后执行。

## 4. 建议的资源治理方案（按风险分级）

### A. 旧 Android APK（优先审计和迁移）

1. 检查 `releases/android/haiz-pocket-v1.4-optical-v2-arm64.apk` 的引用、SHA-256、下载用途及其是否已有等价 GitHub Release 附件。
2. 若无等价 Release，则先创建带明确 `preview/archived` 标识的 GitHub Release，上传原始 APK 与 SHA-256，验证下载和哈希。
3. 更新 README 或网页等所有引用后，才能从当前 Git 跟踪树移除二进制；保留历史归档与原 SHA。
4. **从最新提交移除 APK 不会减少旧 Git 历史已存的大对象。** 不进行历史重写，除非未来确有明确需求且已准备完整镜像备份与协作者迁移计划。

### B. 页面真实依赖资源

`assets/`、`lanren/`、`app-preview/` 与 `pocket/` 可能参与 GitHub Pages 实际部署或应用更新，必须通过真实 HTML/JS 引用扫描、HTTP 回归和发布流程分析确认后才能迁移。**不能直接把 GitHub Pages 运行时资源迁到 Git LFS：Pages 不能直接正常提供 LFS 指针资源。**

### C. 原型资源

`prototypes/haiz-world/public/haiz/world/v3/assets/` 中的数个大型 GLB 是主要体积来源。但 `prototypes/` 包含代码、测试和演示依赖，不能把目录直接删掉。先确认 demo 是否仍被部署、CI 是否引用、是否有等价 GitHub Release / 资源托管，再决定是否将视频或二进制样本外置。

### D. Actions

17 个工作流覆盖 Android、PWA、后端、账户、Lamp、视觉 QA 等方向。先画出**路径—触发器—产物**矩阵，再对彼此独立的模块添加 `paths`、`paths-ignore` 或工作流层面的条件，减少无关构建。保留发布/安全检查及触发范围，不直接关闭工作流。

## 5. 验收条件

- 根目录 README 最短路径可辨认定位、在线体验、开源边界与六幕状态。
- 历史 README 保留、内部链接无明显损坏。
- `LICENSING.md` 不撤销第三方许可证，也不新增未经许可的开源授权。
- 项目页面和依赖不因文档或 `.gitignore` 修改而改变行为。
- 如更改仓库元信息，核查 GitHub description、homepage、topics 已生效。
- 分支、PR、发布二进制、原有 SHA/历史不因治理操作被意外丢失。

## 6. 后续应完成、但本轮不伪称完成的工作

- 完整 Git 历史大对象测量（`git-sizer` / `git rev-list --objects --all`）和克隆性能测量。
- 42 个 Draft PR 逐项处置；特别记录串联 base 分支和仍然领先 `main` 的提交。
- 正式为原创代码选择许可（需要权利人决定，不能由仓库治理者擅自重新授权）。
- Android APK 迁至 Releases 并在确认引用完整后从当前版本移除；必要时对大原型资源做分包。
- 真机验证整合六幕、网页部署、Flutter / Android 分发与性能。
