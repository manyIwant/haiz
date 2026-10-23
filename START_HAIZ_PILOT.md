# HAIZ Flow · HTTPS试用与STILLROOM参考版

本轮是可运行源码与自托管试用包，没有已经开通的公网地址，不是新的原生安装包。既有校园第一视角、晚修模块与全部原始资源保留。

- 本地旧演示：安装Node22后，在项目根目录运行 `npm --prefix world run start:sync`，使用终端所示本地凭据文件，访问本机服务的 `/world/flow/`。只监听本机，不能当公网服务器。
- 自习参考页：同一服务的 `/world/stillroom/`。本地SVG艺术场景、环境声音、计时与手记，非真实校园3D。
- 三人HTTPS试用：按 [部署说明](docs/haiz-pilot/DEPLOY.md) 配置独立服务和可信域名。采用一次性邀请、服务端会话、撤销与清理，仅输入虚构数据。
- 验证：`npm --prefix world test`、`npm --prefix world run test:server`、`npm --prefix world run test:flow`、`npm --prefix world run test:pilot`。HTTPS测试需要OpenSSL。浏览器测试依赖Playwright，命令见部署文档。

阅读 [审计](docs/haiz-pilot/AUDIT.md)、[前后对照](docs/haiz-pilot/CHANGES.md)、[测试与限制](docs/haiz-pilot/TEST_REPORT.md)、[三人试用脚本](docs/haiz-pilot/THREE_TESTERS.md)、[设计来源](docs/haiz-pilot/REFERENCE_REVIEW.md)。[交互边界图](docs/haiz-pilot/trust-map.html)可直接在浏览器打开。

本轮分支feat/haiz-pilot-hardening叠加Flow，未合并main。旧v0.4.0-preview.2 APK/未签名IPA不包含本轮功能，不应当作本轮交付。
