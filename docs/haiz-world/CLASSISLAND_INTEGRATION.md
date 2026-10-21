# ClassIsland：已核实能力与两条集成路径

核查于 2026-10-21。目标教室版本、Windows 版本、希沃型号、管理策略均未知。未安装或运行 ClassIsland；不交付未经编译验证的 .cipx，也不将网页上的演示状态称为 IPC 实时数据。

## 官方依据

1. [仓库 README](https://github.com/ClassIsland/ClassIsland)：课表、铃声时间相关提醒、自动化、组件已经属于本体能力。查询时 README 分别列出 master 的 2.1 与 1.7 维护分支；这不能证明目标教室使用其中任何一个版本。
2. [开发文档](https://docs.classisland.tech/dev/)和[插件概述](https://docs.classisland.tech/dev/plugins/)：插件可以扩展组件、提醒并配合 IPC。当前开发首页描述 .NET 8 / Avalonia；历史页面存在 WPF 示例，必须按目标 tag 对照源码。
3. [插件版本差异](https://docs.classisland.tech/app/plugin.html)：1.x、2.x 使用不同框架，插件互不兼容。不能发布一个未验证的 DLL 并宣称双版本通用。
4. [课程服务](https://docs.classisland.tech/dev/lessons-service.html)：课程服务提供 CurrentSubject、NextClassSubject、CurrentState、CurrentClassPlan 与是否加载/确认状态。读取这些状态不等于可随意修改课表。
5. [IPC 概述](https://docs.classisland.tech/dev/ipc/)、[使用 IPC](https://docs.classisland.tech/dev/ipc/ipc.html)：官方客户端使用命名管道，库为 ClassIsland.Shared.Ipc，说明中的运行时条件为 .NET Framework 4.7.2+ 或 .NET 8+；事件处理器需要在连接前注册。网页 JavaScript 不能直接使用该管道。
6. [IPC 参考](https://docs.classisland.tech/dev/ipc/reference.html)：公开接口包括 IPublicLessonsService、IPublicProfileService、IPublicUriNavigationService；事件常量包括 OnClassNotifyId、OnBreakingTimeNotifyId、OnAfterSchoolNotifyId、CurrentTimeStateChangedNotifyId。本轮只设计必要的只读课程访问。
7. [组件](https://docs.classisland.tech/dev/components.html)、[插件入口](https://docs.classisland.tech/dev/plugins/plugin-base.html)、[提醒渠道](https://docs.classisland.tech/dev/notifications/notification-channels.html)：支持注册扩展组件与提醒提供方/渠道；具体类与调用签名需要针对所选 SDK 编译验证。
8. [创建插件](https://docs.classisland.tech/dev/plugins/create-project.html)、[发布插件](https://docs.classisland.tech/dev/plugins/publishing.html)：有模板、apiVersion 清单和 .cipx 打包流程；上架到不同插件索引不代表二进制兼容。

读取限制：部分直接请求返回 502；IPC 概述与使用页通过搜索服务的官方文档索引核对，IPC 参考和版本差异页直接读取成功。以上结论是文档核实，不是运行联调。未复制文档全文或把过期英文页作为最新接口保证。

## 方案 A：按版本构建的插件集成（待现场条件）

先采集目标应用精确版本、OS/架构、插件策略、实际课表加载状态和教师允许的展示区域。1.x 使用对应 tag / SDK 与其 WPF 工程；2.x 使用对应 tag / SDK 与 Avalonia 工程。分别固定依赖和构建产物；各自测试，不混用。不要修改 ClassIsland 本体或它的原课表。

插件层读取课程服务，将最少状态映射为 HAIZ 内部 DTO：source、version、receivedAt、state、currentSubject、nextSubject、lessonKey、confirmed、conflict。内部 DTO 是本项目协议，不冒充 ClassIsland 官方 API。只有已确认、无冲突、未过期的状态允许建议切换；失联或系统时钟跳变时回到上课安静态并显示来源失效，永不自行弹出全屏。

授权通知由独立服务验签、核验角色与班级范围后到插件；组件只消费经过授权的公共 DTO。一般通知仅课间/放学展示。紧急内容需要单独授权角色、理由与审计，默认也不抢占授课窗口。插件 UI 接受教师的一键隐藏，隐藏状态不会被下一个事件自动取消。

如需桌面伴随进程，可用官方 IPC 只读 IPublicLessonsService 和上述事件；浏览器 UI 需要本地桥接进程。桥接仅监听 loopback，使用随机会话令牌、Origin 白名单、限流与短寿命请求；不向 LAN 暴露无认证 WebSocket，不提供任意代码/文件执行，不向网页暴露全部档案。无桥接时明确显示“未连接”。

验收矩阵：各选定版本的启动/退出/断连、无课表、临时换课、午休/跨日、DST/时钟跳变、冲突、授课软件全屏、老师隐藏、插件崩溃与卸载。必须在 Windows 希沃真机完成遮挡和焦点测试后才能进教室。

## 方案 B：无需插件的独立演示（本轮已实现，含 localhost 模拟适配器）

浏览器 `#classroom` + `#teach`；源码包内另含单文件 `portable/HAIZ-Classroom.html`，可用 Windows 的 Edge/Chrome 双击打开，不需 Node、Python、服务器、插件、管理员权限或首次联网。文件来源受学校策略禁止时不能绕过策略。file:// 存储能力由浏览器决定，启动会检查并显示保存限制，允许导出备份；不声称它拥有系统透明悬浮层或全局热键。

默认上课、课间、放学手动切换并展示原因；连接本地服务后，可由教师明确开启跟随模拟课程状态，隐藏仍优先。没有独立排课引擎。示例下一课与教师准备事项标注手动演示；发生冲突就隐藏增强提示，需教师确认。网页只在用户主动打开的窗口显示，不置顶、不创建自动弹窗、不接管授课软件。隐藏按钮退出网页全屏并收起内容；切换到授课软件使用 Windows 正常窗口切换。

单机角色切换只用于验证状态机，不构成安全认证。公共内容包无数字签名，接收端明确作为演示数据、重新审核后展示，不能直接升级为正式通知。学生私人思路、时长、成绩、名单均不进入该包。

无服务器阶段可以验证交互、离线可用性和低录入成本。不能验证跨设备实时撤回、真正的远程权限与审计防篡改；这些必须随方案 A 的正式后端一起实施。


第二轮续文补充后，新增本地 Backend 与模拟适配器，源代码 scripts/classroom-server.mjs，客户端 dist/bridge-client.js。它们是真实 HTTP/SSE 实验，而非 ClassIsland 接通证明。权限与运行见 LOCAL_SYNC.md。
