# 独立开发记录

- 原仓库基线：`55638e8ad1d35bc5f9e480ccf33061d33ecbc9fc`
- 第一轮：`cd815ea` — Add isolated HAIZ WORLD and campus PWA demo
- 第二轮：`7bc42d5ccd6cf329e142245a1be29ca8dba6fdb2` — Add classroom sync experiment and thought-continuity study tools
- 已推送独立分支：https://github.com/manyIwant/haiz/tree/feat/haiz-round02-classroom
- 未合并 main，未修改 DNS。原仓库基线 365 个文件逐字节保留。

本 ZIP 是可独立运行的版本，原站保存在 dist/legacy。GitHub 的集成版本入口为 world/，两种结构的迁移对应见 MIGRATION.md。

- 本轮校园与晚修作业本地提交：`1f830318505000b6577a6b1e2a9c7199c7f62a5c` — Restore full campus and add timetable-driven evening homework workflow。自动审批要求确认向 manyIwant/haiz 外部目的地传输源码，本次未推送；上述旧轮次推送状态不代表本次提交已在线。

## 2026-10-23：原生预览发行

用户明确授权在 GitHub 发布 Android APK 与 iOS IPA，并选择未签名 IPA。之前等待外部目的地确认的提交已经推送。

- `dd32977`：原生构建工作流、完整校园资源打包、移动导航和平台配置。
- `2cadecf077b77cd3d89a5301bd20a49be5666169`：preview.2，小屏地图入口修正。
- 已发布：https://github.com/manyIwant/haiz/releases/tag/haiz-v0.4.0-preview.2
- 实际 CI：https://github.com/manyIwant/haiz/actions/runs/39913282085
- Android APK 构建和签名验证通过；iOS iphoneos arm64 构建通过，未签名、无 provisioning profile。
- 已从发行页下载两份移动包，核对 SHA256、ZIP 完整性、真实可执行文件与完整校园资源；记录在 release/verification-preview.2.json。
- 尚未做实体手机或学校教学设备测试；未连接真实校内服务器。ClassIsland 插件仍是独立实验源码。
