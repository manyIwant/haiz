# 原生启动：证据与边界

2026-10-25。旧 `haiz-v0.4.0-preview.2` APK 已下载并与发布 SHA256 核对：`db5040322724e89985151b5ee5f7ad2fe8ef728cf2151fc6324717248f47a711`。

旧包根入口使用 `location.replace("world/#study")`。Capacitor Android 7 的 WebViewLocalServer 在 HTML5 模式下，将没有扩展名的路径交给根 index.html；于是相对跳转重复产生 `/world/world/…`，实际 app.js 没有加载。新包明确进入 `./world/index.html#study`。`evidence/old-apk/route-regression.json` 是使用旧包入口与原生路由契约进行的浏览器复现，**不是旧 vivo 真机录像**。

新启动层先显示可操作界面，资源失败有重试、诊断和备份入口。只迁移已知 HAIZ 静态缓存，不清除 localStorage。三维资源与电影入口按需加载，不作为首页完成条件。

CI 40079375580：Android API35 通过原生 WebView 操作、离线重载、重开及同签名重装检查；API33 在重载后读取尚不存在的 documentElement 时，测试自身抛 TypeError。现已改为可选读取后继续有时限等待，并未删去业务断言。iOS 在 build-for-testing 阶段 exit70，旧日志重定向未展示具体编译原因；修订脚本使用 pipefail + tee 保留错误并输出日志，尚不能宣称 iOS 已修复。

本次修改不是清除用户记录的修复。旧包与新候选的签名兼容性仍需核对；临时 debug 签名不能保证跨构建覆盖升级。未进行学校设备部署或物理设备验收。

后续CI明确iOS错误：HAIZUITests目标PRODUCT_NAME未设置，输出-Runner.app/PlugIns/.xctest，目录和链接命令冲突。9c1ed4d显式命名产品和模块，需重新执行模拟器验收。运行时新增模块使用.js扩展名，避免依赖各系统对.mjs MIME的UTType推断；没有修改Capacitor第三方源码。
