---
name: haiz-pwa-offline
description: "Use when maintaining HAIZ Flutter Web PWA, service worker caches, offline startup, manifest, updates and Safari data recovery."
---

# haiz-pwa-offline

## 何时使用
保证 PWA 的离线外壳和更新机制真实可用，缓存**只包含公开资源**，不缓存用户 API 数据。

## 实施流程
1. 理解 `/pocket/` 路径、manifest scope、Flutter Web 构建、`pocket-sw.js` 预缓存和动态资源；不要误覆盖根站 `haiz.space`。
2. 构建前验证 `--base-href /pocket/`、build ID、资源清单、SW scope 与旧版本迁移。
3. 设计缓存更新协议：客户端明确可升级、资源版本一致、失败时保留完整旧壳；不能在用户编辑中静默清缓存。
4. Safari 主屏模式与 Safari 标签页分开验证：离线启动、清理网站数据、备份导出再导入。
5. OCR 训练模型按需加载，避免拖慢首次进入；仅缓存同源公开供应商文件。
6. 测试网路断开、旧缓存、部分下载失败、版本切换、站点子路径部署。

## 验收条件
- Service Worker 不存个人快照、token、Supabase 响应。
- 更新不引起数据丢失或页面永久白屏。
- 无 iPhone 实测时状态明确标为待真机验收。

## 相关文件和参考
- `app/web/pocket-sw.js`
- `app/web/manifest.json`
- `scripts/build-pocket-pwa.mjs`
