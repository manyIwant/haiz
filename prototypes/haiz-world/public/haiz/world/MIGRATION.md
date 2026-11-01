# 迁移与保留范围

基线：`manyIwant/haiz` 的 **main**，提交 `55638e8ad1d35bc5f9e480ccf33061d33ecbc9fc`，核对日期 2026-10-20。环境起始 checkout 是仅有 probe 文件的 `work` 分支；未将其误认为完整工程。审计与新增在独立 `feat/haiz-world-demo` 工作树进行，未修改或推送远程 main。

## 保留

原根站所有 HTML、`data/`、`assets/`、`docs/`、`scripts/`、`tests/` 与 `windowsill/` 均保存在独立交付的 `dist/legacy/`。保留原 `CNAME` 仅作为历史源码文件，位置在子目录，不用于部署域名。

- `index.html` / `descent.html`：旧电影入口，仍可访问。
- `journal.html`、新闻、学校、校友、来访、历史资料：仍可访问，不重写为新事实。
- `campus-3d.html`、34 节点的既有校园、16 间想象教室、坐标与锚点：原样保留。
- `director.html`、`darkroom.html`：原功能与资源保留。
- `windowsill/`：独立应用、全部源文件、模型生成器、上游清单、AGPL 与 MIT 许可保留。
- 原照片、材质、模型和版权声明不重新授权。

## 新增

独立首页、三处地点的体素小景、中文工作台、模拟数据状态机、作者逐件授权流程、管理员模拟审核、持久化计时与便笺、PWA 缓存、测试与审计文档。新首页不加载 Three.js；用户进入漫游才拉取 3D 模块。完整旧校园的大资源不纳入新 PWA 核心预缓存。

## 演示副本中的明确修改

仅对 `dist/legacy/windowsill/` 的独立应用增加 `rainnight` 预设：修改 `scene/src/js/20-campus-adapter.js`，用原构建器重建 `scene/scene.mjs`，并在 `SOURCE.md` 记录。新增内容沿用 AGPL-3.0-only，同源消息接口保持来源校验。原 GitHub main 的窗台完全未改。

## 向原仓库集成

运行 `node scripts/sync-to-repo.mjs /absolute/path/to/haiz-checkout`，会在 `world/` 中复制新增应用，自动将 `legacy/` 链接改为 `../`，并同步完整独立窗台到 `world/room/` 以携带雨夜预设与全部 AGPL 源码。不会覆盖旧根首页、CNAME、已有照片或数据。集成入口为 `/world/index.html`。

本轮不把 `/world/` 替换成根首页；正式切换应先完成真机、内容与授权验收。原站构建脚本无须为访问 `/world/` 而运行。

## 回滚

删除新增 `world/` 及本轮新增文档即可回到旧站；原目录未被修改。新数据键为 `haiz.world.demo.v1`，不会覆盖原站便笺或机位键。PWA 缓存以 `haiz-shell-` 为前缀，只清理自身旧版本；设置中的清除数据仅移除本轮数据键。


## ROUND 02 增量

在第一轮提交 cd815ea 上建立独立分支 `feat/haiz-round02-classroom`，main 基线仍为 55638e8。原 #study 移到 #windowsill，原数据键未动；新 #study、#classroom、#teach 等在新增模块中实现。加入两个独立 v2 数据键、loopback 服务、模拟 Bridge、单文件便携版、测试与研究报告。公共服务数据和随机凭据位于被忽略的 .haiz-demo，不进入 Git 或 ZIP。回滚第二轮提交即可恢复第一轮入口。
