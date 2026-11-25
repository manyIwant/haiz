# TEST_REPORT · 真实运行测试与视觉验收报告

**测试时间**：2026-11-25  
**运行环境**：Linux (Ubuntu 24.04) · Node.js v22.23.5 · Google Chrome 158.0 (Headless + SwiftShader WebGL) · Vitest 5.1.2

---

## 一、自动化安全与集成测试（`npm test`）

测试套件：`tests/security/security.test.js` — **5 / 5 全部通过（0 失败）**

| 测试项 | 覆盖内容 | 结果 |
| :--- | :--- | :---: |
| 500 轮随机布局合法性 | 奖品口避让区、玩偶最小中心距（`0.62`）、6 角色完整不重复、朝向范围 | PASS |
| 全链路状态机与安全边界 | 会话 HMAC 绑定、Nonce 常量时间比对、过期校验、尝试次数耗尽、重放拒绝、反机器人前置核验、一次性 `passToken` 核销与防重放 | PASS |
| Demo / 生产模式硬隔离 | 生产模式拒绝 `MockAntiBotVerifier`、拒绝无密钥启动、拒绝 `demo_` 前缀凭证 | PASS |
| 限流与客户端适配器容错 | IP/会话令牌桶限流、`MockAdapter` 的 `AbortSignal` 取消、`HttpAdapter` 的 HTTP 429 映射与 `ToyboxNetworkError` | PASS |
| 参考 HTTP 服务端集成测试 | 真实启动 `server/index.js`、`HttpOnly` Cookie 签发、`/api/toybox/*` 完整流程、`/api/demo/login` 一次性核销、非法 `Origin` 403 拒绝 | PASS |

---

## 二、真实浏览器 E2E 与视觉验收（`npm run test:e2e`）

**结果**：**6 项 E2E 检查全部通过，生成 13 张真实渲染截图，0 个 `console.error`，0 个 `pageerror`，0 个失败网络请求。**

### 视觉验收与迭代改进记录

本轮严格执行「实现 → 真实渲染 → 视觉检查 → 修正 → 复验」闭环：

1. **第一轮渲染发现与改进**：
   - 机箱镜头略近导致顶部骑楼山花与底部奖品窗被裁切 → 调整各宽高比下的相机距离与目标点，完整呈现骑楼门头、珐琅铭牌与底部奖品橱窗。
   - 柚木腰线高度覆盖了水磨石地面 → 下移腰线至 `y = -0.024`，完整露出海南校园水磨石纹理。
   - 灯光略微过曝 → 调低 `ACESFilmic` 曝光至 `0.94` 并平衡日光与室内灯比例，增强羊毛毡与短绒触觉质感。
   - 目标提示条遮挡门头 → 移至左上角轻量显示。
   - 潮潮触手略微内聚 → 外展触手角度以呈现优雅水母裙摆剪影。
2. **第二轮渲染发现与改进**：
   - 独立头骨枢轴的角色（饭团、早早、长长）面部投影坐标未转换至世界空间，导致五官未贴合面部 → 修复 `src/toys/kit/shape.js` 中 `surfaceAt()` 的世界矩阵变换，3 位角色面部五官（琉璃珠眼、腮红、胡须、微笑）立即精准贴合。
   - 长长双臂肩部衔接存在轻微缝隙 → 内收肩枢轴并补充圆润肩关节，与躯干自然融合。
   - 浏览器默认请求 `/favicon.ico` 产生 404 → 为 `index.html` 与 `gallery.html` 内联原创榄仁叶 SVG 图标，实现 **0 错误**。

### 真实运行截图清单（`reports/screenshots/`）

- `01-machine-desktop.png` — 桌面端（1280×800）骑楼微缩抓娃娃机完整视图
- `02-machine-mobile-portrait.png` — 手机竖屏（390×844）触控布局
- `03-machine-mobile-landscape.png` — 手机横屏（844×390）紧凑布局
- `04-machine-welcome-success.png` — 真实抓取目标玩偶后的奖品橱窗开启与欢迎故事画面
- `05-accessible-mode.png` — 无障碍替代真人验证面板
- `06-gallery-lanren.png` ~ `11-gallery-changchang.png` — 全部 6 位原创角色在艺术验收馆中的实拍渲染
- `12-gallery-silhouette.png` — 剪影轮廓检视模式
- `13-gallery-lantern.png` — 骑楼暖灯环境模式

---

## 三、独立 GLB 模型与纹理资产导出验收（`npm run export:assets`）

全部 6 款角色均成功导出为标准二进制 `.glb`（包含嵌入 PBR 纹理与 7 组烘焙动画）：

| 角色 | 文件路径 | 体积 | 三角面数 | 动画片段 |
| :--- | :--- | ---: | ---: | :---: |
| 仁仁 (`haiz.toy.lanren`) | `assets/models/lanren.glb` | 1038.5 KB | 17,896 | 7 |
| 午午 (`haiz.toy.wuwu`) | `assets/models/wuwu.glb` | 1164.0 KB | 16,650 | 7 |
| 饭团 (`haiz.toy.fantuan`) | `assets/models/fantuan.glb` | 1011.7 KB | 13,616 | 7 |
| 早早 (`haiz.toy.zaozao`) | `assets/models/zaozao.glb` | 758.0 KB | 11,216 | 7 |
| 潮潮 (`haiz.toy.chaochao`) | `assets/models/chaochao.glb` | 637.6 KB | 12,464 | 7 |
| 长长 (`haiz.toy.changchang`) | `assets/models/changchang.glb` | 985.3 KB | 16,000 | 7 |

同时导出 8 张程序化纹理至 `assets/textures/*.png` 及完整资产登记表 `assets/registry.json`。

---

## 四、构建产物与环境限制如实记录

- `npm run build`：通过（`dist/index.html` + `dist/gallery.html`，gzip 后核心脚本合计约 185 KB）。
- `npm run build:offline`：通过（`dist-offline/index.html`，687 KB 单文件离线包，可直接双击运行）。
- **环境限制如实说明**：
  1. 当前开发机为 Linux 容器环境，无 `/Users/a11/` 目录写入权限，完整工程与压缩包已保存至 `/home/antigravity/Documents/Gemini/haiz-campus-toybox-original/` 与 `/home/antigravity/Documents/Gemini/haiz-campus-toybox-original.zip`。
  2. 真机 iOS Safari / Android Chrome / 移动端 WebView 触摸体验已通过 Playwright 移动端视口与触屏模拟完成布局与交互验证，真机硬件实测需在部署后由目标设备补充验收。
  3. Cloudflare Turnstile 真实线上 `siteverify` 依赖生产环境密钥与域名，本轮已完成完整代码实现、接口契约与单元测试，尚未连接真实生产账号库或线上密钥。
