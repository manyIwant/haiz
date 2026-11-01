# HAIZ Pocket：六项生产验收标准

当前公共 PWA https://haiz.space/pocket/ 为预览版本。通过 CI 不意味着在 iPhone 上生产验收通过。证据报告由 scripts/pocket-production-readiness.mjs 生成，每周工作流 pocket-production-audit.yml 自动整理。

## 1. Safari JSON 导出与导入

使用一部真实 iPhone，在 Safari 中创建仅用于测试的两条任务、一条备注、一门课程和一次专注记录。通过 Pocket 备份界面导出文件，检查 JSON 实际存在于「文件」App；从「文件」App 重新选择并导入，验证数据一致。之后把 Pocket 添加到主屏幕，在独立 App 模式重复。重复导入不得增加重复任务；尝试损坏、超大、冲突文件时必须拒绝且不修改现有数据。file_picker 支持 Web 操作不能直接算通过。

## 2. 主屏幕模式数据持久化

通过 Safari 的分享菜单添加 HAIZ Pocket 到主屏幕。验证主屏幕独立 App 的数据是否与 Safari 标签页存储隔离：不得默认为二者共享本地数据。新建访客任务与笔记、强制关闭重开、设备重启、首次完整缓存后断网重开，逐项核对。浏览器数据可能被 iOS 清理，不应承诺永不丢失。

## 3. 清理网站数据后的恢复

仅在独立测试设备或测试资料中进行，不要清理真实学生的 Safari 数据。先将备份下载到浏览器存储之外的「文件」App，再卸载测试 PWA 或清理相应站点数据。重新联网安装、导入备份，核对任务 ID、笔记、课程、专注记录；再次导入应保持幂等。Flutter 测试已模拟过浏览器存储重置，但真实 iPhone 仍须单独核验。

## 4. 云端账号与多设备同步

现有 Supabase RLS 迁移和客户端 CAS 版本更新代码不等于生产后端已经上线。先由项目维护者把实际 Supabase HTTPS 项目地址和公开 publishable key 配置为 GitHub Actions Repository Variables：HAIZ_SUPABASE_URL 及 HAIZ_SUPABASE_PUBLISHABLE_KEY，并在对应项目执行 pocket_snapshots 迁移。工作流禁止半配置，禁止使用 service_role 或其他私有密钥生成 Web 客户端。

生产验收需要两个独立测试账号与两台设备，验证 A 无法读取 B 的数据、跨设备更新确实持久化、并发修改不产生静默覆盖、离线重连、过期会话和登出都正确锁定私有数据。Web 端当前设计不持久保存登录刷新令牌：必须记录重启后的重新登录体验。未经授权不得导入学校学生真实资料。

## 5. Web Push

Apple iOS 16.4 及以上支持添加到主屏幕的 Web App 的推送，但 HAIZ 当前没有正式推送订阅 API、VAPID 发送服务、提醒调度和退订流程。验收需完整实现服务端（私钥不得进入前端）、订阅与账号隔离、用户点击后的权限授权、关闭 App 后真实设备接收通知、拒绝权限和退订后停止发送测试。不能只凭浏览器支持 Notification API 就宣布已上线。

## 6. 浏览器本地 OCR

现有 NoticeImportService 对 Web 截图明确拒绝识别。验收必须先实现支持中文和英文的浏览器本地模型及识别 Worker，验证图片绝不上传第三方、离线模型可用条件、12 MB 文件上限、PNG/JPEG、模糊图片异常处理、真正 iPhone Safari 内存和耗时，并要求用户修改和确认识别结果。当前此项属于功能未实现，不能声称通过生产验收。

## 验收流程

- 自动审核：运行 node scripts/pocket-production-readiness.mjs --live，查看 production-acceptance-output 中的 Markdown 与 JSON。
- 严格放行：运行 node scripts/pocket-production-readiness.mjs --strict。如任何一项仍需真实环境或功能不存在，就必须以非零状态退出。
- 真机记录：必须有设备和 iOS 版本、安装模式、测试操作、去除个人数据的截图/日志、通过及失败结果。
- 结论：六项均有实际证据才可标记「生产验收完成」。此前维持「公开预览版」，不得把推送、云同步或 OCR 描述为已上线功能。
