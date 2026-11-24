# HAIZ · Toybox V2（人类验证交互系统 & 原创校园玩偶世界）

从「内嵌抓娃娃机的验证码弹窗」进化为「一台精致的微缩实体抓娃娃机，恰好承担了真人验证功能」，并为 HAIZ 未来 **Campus Toybox（校园玩具收藏馆）** 沉淀 6 款可独立复用的原创三维角色资产。

## 快速运行与测试

```bash
# 运行全部 7 项自动化测试（含 6 款角色 .GLB 二进制导出校验）
npm test

# 启动本地静态服务（零构建步骤、零外部 CDN 依赖）
npm run dev
# 抓娃娃机验证页：http://localhost:4174/index.html
# 角色艺术验收台：http://localhost:4174/studio.html
```

也可以直接双击打开根目录下的 `haiz-human-verification-v2-demo.html`（单文件零依赖版本，同时集成抓娃娃机与六款角色艺术验收台）。
