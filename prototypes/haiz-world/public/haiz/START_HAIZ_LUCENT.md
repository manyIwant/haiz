# HAIZ LUCENT / Cinematic · 集成开发版

本轮保留全部原main资产以及PR1–3历史，开发分支`feat/haiz-lucent-integration`，审查入口[PR4](https://github.com/manyIwant/haiz/pull/4)。原生候选版本0.5.0-preview.1/build7，当前状态以[QA报告](docs/haiz-audit/QA-RESULTS.md)为准，不能从本文推断真机或正式发行通过。

## 在本地运行

需要Node22；原生资源准备：`npm ci --prefix world/apps/mobile`，`npm --prefix world/apps/mobile run sync`。使用仅本机的静态HTTP服务托管`world/apps/mobile/www/`，从根目录打开即可看到实际原生包的Web界面。不要用file://替代WebView路径检查。

既有服务器演示：`npm --prefix world run start:sync` → `http://127.0.0.1:8787/world/`。原生LUCENT增强层由打包步骤注入，不会改写现有主站。三人HTTPS Flow另见[部署说明](docs/haiz-pilot/DEPLOY.md)，未配置公网托管。

原生启动：`node world/apps/mobile/tests/verify-assets.mjs`；Linux实际浏览器：`HAIZ_CHROMIUM=/usr/bin/chromium node world/apps/mobile/tests/native-web.mjs`（需Playwright）；运动逻辑：`node --test world/lucent/tests/motion.test.mjs`。Android/iOS模拟器命令见`.github/workflows/haiz-mobile-qa.yml`，只能在已配置SDK/Xcode的环境执行。

实验台：`/world/lucent/lab.html`比较三组Dock参数，`/world/cinema/lab.html`拖动时间轴检查真实路径形变。实际集成入口是书桌空间卡中的“进入概念自习空间”，不是仅有独立Demo。完整影片仅首次明确进入时播放，重复进入短过渡，普通Tab不播放。

参考视频1000108476.mp4尚未提供可读取附件，参考视频逐帧分析为NOT_TESTED；当前动画依据用户明确列出的运动规律原创，不复制Google/Gemini标识。

文档：[分支图](docs/haiz-audit/BRANCH-MAP.md)、[启动根因](docs/haiz-audit/MOBILE-STARTUP-ROOT-CAUSE.md)、[设计系统](docs/haiz-design/DESIGN-SYSTEM.md)、[Dock](docs/haiz-design/DOCK-MOTION.md)、[分镜](docs/haiz-cinema/STORYBOARD.md)、[许可](docs/haiz-cinema/ASSETS-LICENSES.md)。
