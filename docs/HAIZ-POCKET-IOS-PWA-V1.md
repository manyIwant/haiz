# HAIZ Pocket · iPhone 免费网页 App 第一版

状态：**独立分支候选版，尚未在真实 iPhone / Safari 上验收，未上架 App Store。**

## 使用与安装

安装入口：`https://haiz.space/pocket/install.html`；真正的 App 页面是 `https://haiz.space/pocket/`。

iPhone 使用 Safari 打开安装页 → 点击「打开 HAIZ Pocket」→ 进入应用并完成首次加载 → Safari 分享菜单 →「添加到主屏幕」（如有「作为网页 App 打开」则启用）→ 在桌面点击 HAIZ Pocket 图标。

**务必从实际 App 页面安装，而不是把安装说明页存到桌面。** 如果在微信或 QQ 内置浏览器，先用 Safari 打开同一 URL。

以上 URL 仅在变更合并、上线后对应本次候选代码；PR 分支本身不代表 haiz.space 已自动部署。没有真机验证前不要把这个版本称作稳定 iOS 正式版。

## 此版本做的实际改动

- 安装页区分 iOS Safari、iOS 内置浏览器、已安装模式和非 iOS；避免误以为「下载 IPA」才是安装。
- 明确提示用户打开真正的 Pocket 页面后才在 Safari 添加主屏幕。
- 保留 Flutter Web 的独立窗口、主屏幕图标、`/pocket/` 作用域和现有任务/课表功能。
- 修复 Service Worker 的离线 `install.html` 退回到 `index.html` 的误路由；`pocket-ui.css` 作为静态资源可由缓存提供。
- Service Worker 只从当前版本的壳缓存和运行缓存读取资源，避免全局 `caches.match` 混用旧版本的 `main.dart.js`。
- 重建静态发布壳的版本号；保留原有 28 个预缓存文件，预算约 20.7 MB，小于现有限制 24 MiB。
- 应用更新必须由用户选择确认。更新只处理公共程序缓存，**不清理 LocalStorage/IndexedDB、不导出或上传个人信息**。
- 适配安装说明与常见 iPhone 安全区（网页 App 的 Flutter 控件仍需真机检查）。

原始模板：`app/web/`；站点当前构建输出：`pocket/`。正式 Flutter 重构时须通过 `scripts/build-pocket-pwa.mjs` 重新生成并比较，避免手动构建产物与模板长期分叉。

## 关于数据与备份

现有 Flutter 访客空间具备 JSON 导出与校验后合并恢复：`app/lib/core/personal_backup.dart`、`app/lib/ui/pocket_backup_sheet.dart`。

重要任务、课表、笔记应在 Pocket 内的「数据备份与恢复」中导出到 iPhone「文件」后再做升级或清理操作。备份为**未加密的私人文件**，不要发到公开群聊。云端账号目前不能通过同一个访客备份工具直接覆盖。

网页 App 在不同浏览器、不同设备、不同存储容器之间，数据**不保证自动互通**；清空 Safari 网站数据、移除网页 App、浏览器系统清理存储空间仍可能丢失本地记录。缓存安全不等于永久数据安全。

## 真机验收清单（由一部真实 iPhone 完成）

- [ ] Safari 首次联网打开 `/pocket/` 能进入 Flutter 主界面；不卡白屏，按钮可操作
- [ ] 从 Pocket 页面添加到主屏幕；应用图标/名称正确；桌面打开无 Safari 地址栏
- [ ] 在微信内置浏览器打开 `/pocket/install.html` 时能看懂「切换 Safari」的提示
- [ ] 创建访客任务、课程和备注，退出 Pocket，再从主屏幕打开，记录仍在
- [ ] 在 Pocket 的「数据备份与恢复」导出 JSON，确认 iPhone「文件」中确实存在；新装的访客空间能校验并合并恢复
- [ ] 首次联网并等缓存完整后断网关闭再打开，至少能够看到本地任务；没有缓存成功的首次离线安装不应被描述为可用
- [ ] 更新网站构建，App 收到有新版提示；用户确认后刷新；原有本地任务不丢
- [ ] iOS 竖屏（刘海、底部 Home 指示条）与横屏；键盘弹出时输入栏没有被挡
- [ ] Safari 返回前台、切换其他 App 后回到 Pocket，界面和输入状态正确
- [ ] 弱网或中断加载时有合理的错误提示与重试方式；断网无法登录/同步应有明确说明
- [ ] 验证第三方 OCR、PDF 等大体积资源是否需联网首次下载；不能把未缓存的可选资源说成可离线
- [ ] 在一台实际 iPhone 上记录 iOS 版本、设备型号、WebKit 行为、内存和典型操作耗时

有任何数据丢失、启动白屏、升级后缓存混用或恢复失败即视为发布阻断问题。不要为了「通过」而卸载旧网页 App、清理网站数据或要求同学交出原始记录。

## 范围与限制

本版是**PWA，不是 IPA 或原生 iOS App**。系统 Share Extension 尚不属于这版；不提供自动读取微信、QQ、系统通知或私有账号数据的能力。Web Push 需要订阅管理、用户主动授权和后端发送服务，未在本版交付。

苹果设备没有经过真实 WebKit / GPU 测试。现有 Node 自动测试主要检查发布壳的结构、版本和权限边界，不能代替真机交互及 Flutter 功能回归。跨设备云同步以服务端实际部署、登录和数据权限测试通过为前提。

## 发布与回退

所有实验先保留在 `feat/ios-pocket-pwa-first-release-20261113`。合并前检查完整的 PWA CI、关键 Flutter 业务回归及真实 iPhone 验收。回退可以恢复上一版本的发布文件；**不要删除用户网站数据**。用户更新前建议主动备份访客记录。
