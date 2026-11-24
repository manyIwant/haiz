# HAIZ · 人类验证交互系统 (`haiz-human-verification`)

为海南中学数字校园项目 **HAIZ** 设计的独立、低耦合、游戏化三维抓娃娃机真人验证组件。

## 核心特性

- **微缩实体抓娃娃机场景（Three.js）**：棚拍级柔和光影、程序化 PMREM 环境反射、拉丝金属横轨、真实螺旋弹簧（`TubeGeometry` 实时伸缩）、三爪铰接机械爪与亚克力奖品位。
- **6 款 HAIZ 原创模块化玩偶**：
  1. `sunshine-duck`（椰阳小黄鸭）：奶油绒毛与迷你草编遮阳帽。
  2. `lanren-spirit`（榄仁小芽）：榄仁叶双层贝雷帽与木质橡果铃铛。
  3. `campus-cat`（校园橘猫）：蓬松橘白花纹、陶土项圈与黄铜铃铛。
  4. `schoolbag-bear`（书包小棕熊）：天蓝领口针织背心与赭橙色书包。
  5. `ocean-whale`（潮汐小鲸）：灯芯绒奶白肚皮与头顶珍珠水滴。
  6. `hainan-fawn`（坡鹿小团）：海南坡鹿梅花斑与织纹小围巾。
  - 支持通过 `registerPlush(descriptor, builderFn)` 动态扩展季节限定款或校庆限定款。
- **完整五段式交互**：唤醒（机械归位初始化）→ 寻找（摇杆/触屏/键盘惯性摆动控制）→ 抓取（弹簧伸长、开合与提重）→ 收取（左移至发光奖品位投放）→ 完成（等待服务端签发验证凭证）。
- **三套 HAIZ 主题原生适配**：`porcelain`（素瓷）、`obsidian`（黑曜）、`ocean`（南海）。
- **无障碍与多端兼容**：支持 `prefers-reduced-motion`、键盘辅助直选模式（走同一服务端验证协议）、Android Chrome / iOS Safari / HAIZ WebView 触屏防滚动冲突、页面隐藏自动暂停渲染与 `destroy()` 全量释放 WebGL 显存。
- **严格的前后端安全边界**：前端抓娃娃仅完成交互挑战，最终通过与否完全由可信服务端 `ChallengeProvider` 决定；内置 `MockChallengeAdapter` 仅供本地演示，严禁用于生产登录。

## 目录结构

```text
haiz-human-verification/
├── index.html                   # Buildless ES Module 独立演示页
├── package.json
├── README.md
├── INTEGRATION.md               # 面向 Codex 的 HAIZ 集成与服务端适配指南
├── src/
│   ├── index.js                 # 统一导出入口
│   ├── verification/            # 核心状态机、常量与 createHumanVerification 主组件
│   ├── scene/                   # Three.js 微缩抓娃娃机场景与材质灯光
│   ├── models/                  # 模块化玩偶目录、程序化 PBR 材质与 6 款原创建模
│   ├── animations/              # 弹簧阻尼与机械爪单摆运动学
│   ├── controls/                # 实体摇杆、机械按钮、触屏与键盘控制
│   ├── audio/                   # 程序化 Web Audio 机械与交互音效引擎
│   ├── adapters/                # MockChallengeAdapter 与 HttpChallengeAdapter
│   └── styles/                  # 严格作用域隔离的 CSS 样式与三套主题令牌
├── assets/
│   ├── models/                  # 玩偶元数据清单（plush-manifest.json）
│   ├── textures/                # 程序化材质参考纹理（绒毛/灯芯绒/拉丝金属）
│   └── audio/                   # 独立导出的程序化 WAV 音效样本（可选静态资源）
└── tests/
    └── verification.test.mjs    # Node 原生单元测试（状态机/安全边界/运动学）
```

## 快速运行与测试

本工程采用 **Buildless Native ES Modules**（与 HAIZ 主站一致），无需打包即可运行：

```bash
# 1. 运行自动化单元测试（Node.js >= 18）
npm test

# 2. 启动本地静态服务体验完整演示
npm run dev
# 浏览器访问 http://localhost:4173
```

## 素材来源与许可说明

| 素材类别 | 路径 / 来源 | 制作方式 | 许可协议 |
| :--- | :--- | :--- | :--- |
| 3D 玩偶与机械爪几何体 | `src/models/plushBuilders.js`, `src/scene/clawMachineScene.js` | 本项目原创程序化参数建模 | MIT / 原创 |
| PBR 绒毛 / 灯芯绒 / 拉丝金属纹理 | `src/models/materials.js`, `assets/textures/*.png` | 本项目原创 Canvas / Python 程序化生成 | CC0 / MIT |
| 机械与交互音效 | `src/audio/soundEngine.js`, `assets/audio/*.wav` | 本项目原创 Web Audio / 波形合成 | CC0 / MIT |
| 图标（声音、无障碍、关闭、奖品位） | `src/verification/createHumanVerification.js` | 本项目原创极简内联 SVG | MIT |
| Three.js 渲染库（Peer Dependency） | `three >= 0.128.0` | 第三方开源库 | MIT License |

所有原创模型、纹理与音效均无第三方版权限制，可直接用于海南中学 HAIZ 项目。
