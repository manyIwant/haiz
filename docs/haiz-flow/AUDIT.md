# 2026-10-23 事实审计

GitHub API 实查：默认分支现在为 main（旧报告 probe 已过时）；main=55638e8ad1d35bc5f9e480ccf33061d33ecbc9fc。最新预发行 haiz-v0.4.0-preview.2 有 APK、未签名 IPA、源码、HTML、安装说明和 SHA256。既有开发基线318a99e；本轮独立 feat/haiz-flow-handoff，不修改 main 或生产域名。

## 保留 / 修复 / 新增

- 保留主站365个原文件、Three.js世界、windowsill及其AGPL授权；world/room/LICENSE和第三方许可不删除。
- 保留 world/homework-core.js 最后两节自习判定、homework-ui.js 晚修清单、round2-ui.js 自习记录、apps/mobile 原生壳。
- 复用 world/scripts/classroom-server.mjs 的 loopback 主机校验、随机角色凭据、班级范围；新增 flow 私人草稿/API，不混入旧公共 snapshot。
- 新增 world/flow/ 真正宽屏教师工作台、独立手机排布、学生创作、只读课堂屏；不迁移整个主站框架。
- 原型 index.html 的 state 与 data-go 支持角色/日程/专注/通知示意，但未找到 fetch/WebSocket/localStorage/sessionStorage/SW；不能恢复或跨端同步。原型桌面是手机展板。
- 已查看包内6张真实截图：保留森林绿、米白、衬线点题、卡片节奏；改进9–11px小字、装饰性数字、桌面无工作区。

## 栈与许可

Buildless ES modules + Node HTTP，现有静态站无迁移成本；新功能不添加运行依赖。Playwright只做开发测试。Three.js MIT，windowsill AGPL及其依赖保留单独许可证。原型为用户提供资产，保持原包不改；不打包Apple私有字体或符号库。Capacitor7.6.9及App插件MIT沿用，详见既有docs/haiz-world/LICENSES.md。

命令：node world/scripts/classroom-server.mjs；npm --prefix world test；npm --prefix world run test:server。新Flow测试见TEST_REPORT.md。ClassIsland源码未完成Windows主机验证。已有APK/IPA并不包含本轮Flow；不得当作新功能安装包。

实查基线逐文件字节对比：365个原文件全部一致。原型已通过本地HTTP实际运行，见screenshots/original-prototype-runtime.png。
