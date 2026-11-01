# HAIZ Pocket PWA · 免费 iPhone 安装方案（预发布）

## 目标与限制

HAIZ Pocket PWA 与 Flutter App 共用业务代码，不需要 IPA、证书、App Store。规划中的 HTTPS 地址是 https://haiz.space/pocket/ 。**这个地址并未因为创建本分支而自动部署。** GitHub Actions 仅构建可预览、可部署的静态文件。

已经实现的 PWA 基础：Manifest 稳定应用 ID、iOS 主屏幕元数据、安装说明、静态缓存、离线应用外壳、用户确认的版本更新提示和构建版本追踪。

没有实现或平台不允许的部分：
- iOS PWA 无法自动读取微信群聊或注册原生 iOS 分享扩展，只能由用户主动复制和导入文件。
- Flutter Web 的图片 OCR 当前不可用，需要单独实现浏览器本地 OCR。
- Web 登录因安全设计目前不持久存储会话；生产 Supabase 登录/同步仍需配置可用后端并验收 RLS。
- 真正的 Web Push 需要 VAPID 服务端、订阅授权 UI 和撤销机制。iOS 16.4+ 添加到主屏幕的 Web App 可以支持锁屏推送，但现在尚未开通。
- iOS 不支持可靠的通用后台定期同步；需要在再次打开 App 后重新校验。
- 离线能力仅覆盖已经成功缓存的 Web 资源和已保存的本地数据；iOS 可能清理缓存。不要把浏览器存储当作唯一备份。

## 构建与部署

在仓库根目录执行以下命令：

    cd app
    flutter pub get
    flutter build web --release --base-href /pocket/ --no-web-resources-cdn --no-wasm-dry-run
    cd ..
    node --test tests/pocket-pwa.test.mjs
    node scripts/build-pocket-pwa.mjs app/build/web

生成的 app/build/web/ 必须部署在 HTTPS 网站的 /pocket/ 路径，才能与 Manifest 和 Service Worker 作用域一致。GitHub Actions 的 pocket-pwa.yml 会构建并上传 haiz-pocket-pwa-preview 预览产物，但不会更改现有 haiz.space 首页。

若以后决定切换 GitHub Pages 为 Actions 部署，需要保留仓库根目录原有完整校园站内容，同时将 Flutter Web 产物放在 /pocket/ 子路径；正式切换前必须验证根站、3D 校园、Lamp、Pocket 页面以及资源链接。不应直接拿 Flutter Web 根目录覆盖现有根站。

## 安全验收

- 不将 Supabase service_role、VAPID 私钥、用户会话、学生个人数据放入公开构建产物。
- Service Worker 只缓存同源公开静态文件，不缓存跨源 Supabase 响应、个人资料或 API。
- 用 iOS Safari 真机验证：安装、退出重开、离线启动、联网更新、卸载/重装、数据备份与恢复、登出隔离、键盘、相册/文件选择、PDF 读取和屏幕安全区。
- 未部署稳定后端和备份恢复之前，不把 Web 云登录、Web Push、图片 OCR 标为已上线。

## 后续优先级

1. 数据备份和恢复：保证浏览器存储被清理时不丢掉任务和笔记。
2. 云端账号：配置生产 Supabase 及 RLS，并核验会话生命周期和用户隔离。
3. 用户明确授权的 Web Push：服务端 VAPID 和按账号投送，支持取消订阅。
4. 延迟加载的浏览器本地图片 OCR，与 iOS 上的功耗、内存和离线限制一起测试。
5. 真机兼容性与性能验收后再部署公开访问。

Apple Web Push: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers

Flutter Web Service Worker: https://docs.flutter.dev/platform-integration/web/faq
