# HAIZ · Campus Toybox
### 原创校园角色世界与游戏化真人验证系统

**HAIZ · Campus Toybox** 是海南中学数字校园项目的原创入口体验：我们将传统冰冷的验证码重构为一座摆放在书桌上的**海南骑楼风格微缩抓娃娃机**，并从零创作了 **6 位拥有独立轮廓、材质语言、性格动画与标准 GLB 模型资产的原创校园角色**。

> 它既是一次温暖、短暂、有趣的入校真人验证体验，也是未来 **Campus Toybox 校园收藏馆** 与三维数字校园的角色世界起点。

---

## 快速开始

```bash
# 1. 安装依赖（全部本地化，无需海外 CDN）
npm install

# 2. 启动本地开发服务器
npm run dev
# → 抓娃娃真人验证体验：http://localhost:5173/index.html
# → 独立角色艺术验收馆：http://localhost:5173/gallery.html

# 3. 运行安全层自动化单元测试与 HTTP 集成测试
npm test

# 4. 导出全部 6 款角色独立 GLB（含烘焙动画）、程序化纹理 PNG 与资产登记表
npm run export:assets

# 5. 构建生产静态包与单文件离线演示包
npm run build
npm run build:offline

# 6. 启动参考服务端（Demo 模式，含静态站点与 /api/toybox + /api/demo/login）
npm run server
```

---

## 页面入口

- **`index.html`** — 完整抓娃娃机真人验证体验（支持桌面鼠标/键盘、手机触屏拖动/点击定位/虚拟方向键、无障碍替代验证模式、减弱动效与静音切换）。
- **`gallery.html`** — 独立**角色艺术验收馆**（自由旋转/缩放观察 6 位角色、切换 7 组角色动画、切换「海南午后阳光 / 骑楼暖灯 / 海口晚潮 / 剪影轮廓检视」4 种环境、切换可扩展主题外观、查阅角色设定与资产登记信息）。
- **`dist-offline/index.html`** — 可直接双击在现代浏览器打开的单文件离线演示包（无需启动服务器）。

---

## 目录结构

```text
haiz-campus-toybox-original/
├── index.html                  # 抓娃娃真人验证主入口
├── gallery.html                # 独立角色艺术验收馆入口
├── shared/                     # 前后端共享安全契约与核心服务（零运行时依赖）
│   ├── CONTRACT.md             # 接口契约
│   ├── character-ids.js        # 稳定角色 ID
│   ├── protocol.js             # 协议常量、布局校验与 WebCrypto 工具
│   ├── challenge-core.js       # ChallengeService（会话绑定、一次性凭证、限流）
│   ├── memory-store.js         # 内存存储（生产可替换为 Redis）
│   ├── rate-limiter.js         # 双维度令牌桶限流器
│   └── antibot-verifiers.js    # Mock 反机器人校验器（仅 Demo）
├── server/                     # 零依赖参考 Node HTTP 服务端
│   ├── index.js                # /api/toybox/* + /api/demo/login + 静态托管
│   └── turnstile-verifier.js   # Cloudflare Turnstile siteverify 校验器
├── src/
│   ├── toys/                   # 原创角色资产源码（可独立于抓娃娃机复用）
│   │   ├── kit/                # 程序化建模、PBR 工艺材质、纹理与行为运行时
│   │   ├── characters/         # 6 位角色独立源码（lanren, wuwu, fantuan, zaozao, chaochao, changchang）
│   │   └── registry.js         # 权威角色注册表与 createToy() 工厂
│   ├── machine/                # 海南骑楼微缩抓娃娃机与 3D 状态机
│   ├── audio/sfx.js            # Web Audio 程序化拟音与八音盒欢迎音效
│   ├── challenge/              # 挑战主组件与 Mock/Http/Turnstile 适配器
│   └── gallery/                # 角色艺术验收馆 3D 展台与策展面板
├── assets/
│   ├── models/*.glb            # 6 款独立标准 GLB 模型（含 7 组烘焙动画）
│   ├── textures/*.png          # 全部程序化 PBR 纹理导出图
│   └── registry.json           # 机器可读角色资产登记表（含三角面数与 SHA-256）
├── scripts/
│   ├── export-assets.mjs       # GLB + 纹理 + registry.json 自动导出脚本
│   └── e2e.mjs                 # 真实浏览器 E2E 与视觉截图验收脚本
├── tests/security/             # Vitest 安全与集成测试
├── reports/screenshots/        # 真实浏览器运行截图与测试报告
├── ART_DIRECTION.md            # 艺术方向探索与创作决策
├── ASSET_REGISTRY.md           # 角色资产规范与复用指南
├── INTEGRATION.md              # 双层安全架构与生产环境集成文档
├── LICENSES.md                 # 原创声明与第三方依赖许可
└── TEST_REPORT.md              # 真实运行测试与视觉验收报告
```

---

## 文档导航

- 艺术探索与视觉决策：[ART_DIRECTION.md](./ART_DIRECTION.md)
- 角色资产规范与复用：[ASSET_REGISTRY.md](./ASSET_REGISTRY.md)
- 安全架构与后端集成：[INTEGRATION.md](./INTEGRATION.md)
- 许可与原创声明：[LICENSES.md](./LICENSES.md)
- 运行截图与测试报告：[TEST_REPORT.md](./TEST_REPORT.md)
