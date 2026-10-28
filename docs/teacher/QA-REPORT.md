# Teacher Workspace 验证报告

此报告以 `evidence/browser-report.json` 与 `evidence/unit-test-report.txt` 为执行证据。使用临时 SQLite 数据库、虚构账号和虚构班级，不接触生产数据。

## 环境与复跑

Node 24.22.1，Playwright Core 1.64.1，Chromium 153.0.8010.12（macOS arm64）。`web/teacher/package.json` 提供 `npm test`、`npm run test:e2e`、`npm run test:all`。浏览器路径默认使用本机缓存，也可由 HAIZ_QA_BROWSER 指定兼容 Chromium。E2E 默认结束后释放临时服务并返回退出码；`--serve` 仅供预览保留临时环境。

Academic 使用 PR 21 基准 b308312。Teacher 同源代理在 8788 接入临时 Academic。学生检查使用实际 `/api/my/assignments`；课堂检查使用实际 `/api/v1/classroom`。

## 已执行

- 单元/HTTP/控制器回归：120 项通过，包含 API 信封与分页、日历校验、账号分区、损坏与配额、旧草稿原子导入、未知请求精确重放、401 后恢复、课堂隐私与凭据清除、代理 CSP/CSRF、同 Cookie 预期账号检查、身份变更与旧结果拒绝。
- 浏览器流程：15 个场景全部通过，以最新 browser-report.json 的 status/scenarios 为准，覆盖本机草稿及刷新、Review 学生不可见、明确发布、创建与发布在服务器提交后丢响应的恢复、同浏览器两页版本冲突、撤回历史、无权限与异班教师拒绝、离线整理、Review 后修订、账号切换、迟到响应账号隔离。
- 确认恢复时原 key 与 body 一致、没有重复创建；并发冲突保留两边内容，重新检查不自动提交。
- 响应式宽度 320、375、768、1024、1440、1920，无横向溢出。截图覆盖 320、768、1024、1440 及 Review、冲突、课堂、撤回、离线状态。
- 工作区 axe 自动扫描无违规项；输入有标签，无嵌套按钮，有主内容跳转链接、可见键盘焦点与 reduced-motion 设置。此扫描不等于完整 WCAG 或辅助技术人工认证。
- 独立审查发现并修复身份切换、原请求 401/403 终结、Review 修改忽略、恢复拒绝锁定和撤回覆盖草稿等问题。最终定向复审未确认剩余 HIGH 问题。

## 覆盖率边界

Node 的覆盖率报告只统计本轮加载的源文件，见 unit-test-report.txt；不能据此声称全部浏览器工作区达到 80%。workspace.js、ui.js、app.js 主要由真实浏览器流程覆盖，但没有合并浏览器覆盖率统计。部分课堂控制器分支使用导入隔离测试，Node 行计数也不能代替页面覆盖。项目整体 80% 门槛尚未被完整测量证明。

## 重要限制与待联验

- Chromium 已运行；本机未安装 Firefox/WebKit 缓存，Firefox 与 Safari 未运行。这是 Draft 验证缺口。
- 没有 Lighthouse 报告，也没有证明 LCP/INP/CLS 等生产指标达标。浏览器报告里的 paint/navigation 只是本机观察。
- 后端事件持久化、学生手动刷新、Flutter 自动增量同步是不同阶段。此报告只证明 Teacher → Academic → 学生 HTTP 手动拉取/课堂公开投影；未运行 Flutter 自动同步。
- 撤回测试检查独立浏览器中的虚构私有笔记标记仍存在；未操作或证明 Flutter 实际私人笔记库。真实保留行为交 03 组验收。
- classroom 页面手动刷新；没有声称自动实时推送，也未验证 ClassIsland 原生插件。
- `/academic/` 旧管理页仍显示旧出版控件，其写入已被 Teacher 代理拒绝；视觉清理需协调 02 组文件所有权。Academic 原始端口应由部署限制在私网。
- 尚未部署到学校生产入口、发布 Release 或合并依赖 PR。

## 证据

[浏览器机器报告](evidence/browser-report.json) · [单元/HTTP 与覆盖率](evidence/unit-test-report.txt)

[桌面工作区](evidence/workspace-1440.png) · [手机工作区](evidence/workspace-320.png) · [Review](evidence/review-checkpoint-1440.png) · [版本冲突](evidence/version-conflict-1440.png) · [公开课堂](evidence/classroom-1440.png) · [撤回历史](evidence/withdrawal-history-1440.png)

跨组交接与契约边界见 [API-INTEGRATION.md](API-INTEGRATION.md)。
