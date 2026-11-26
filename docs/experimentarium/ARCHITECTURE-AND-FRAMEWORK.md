# HAIZ · EXPERIMENTARIUM — 架构设计与技术白皮书

## 1. 架构目标：超越“左滑块-中动画-右文字”

传统教学模拟网站往往受困于固定的仪表盘三分栏模板，而单纯的三维互动书（如窄小纸页中硬塞复杂图表）又会在高密度探究时局促难用。`HAIZ · EXPERIMENTARIUM` 的技术框架围绕三项关键设计重构：

1. **三态空间调度（`spread` / `gatefold` / `workbench`）**：
   - **`spread`（沉浸对开）**：默认 100% 宽度呈现双页摊开书籍、`#gl` 线性光照 WebGL 三维器材装置以及贴合纸页的 `#css3d` 动态控件与实时手写边注。
   - **`gatefold`（扩台拉远）**：通过 `stage.setSpaceMode('gatefold')` 轻微抬高俯仰与视距，保留整套实验器械的长纸带走纸与侧向全景。
   - **`workbench`（破页入台 · 分屏展开）**：按下底部或右页 `展开实验台 (W)` 按钮后，书页相机向左侧重心平移（`bookWidth` 左侧 44%），右侧 `#workbench` 面板自然推出，提供 2× HiDPI 可拖拽高频画布、坐标拟合、`V–pH` 微分突跃仪、显微细胞计数视野与历史经济均衡分析。

---

## 2. 核心渲染与交互管线

### 2.1 三维纸页与混合图形管线（`book.js` + `stage.js` + `print.js` + `ink.js`）
- **双引擎同帧对齐**：Three.js `WebGLRenderer` 在线性光空间绘制桌面木纹、绿色布面封皮、可弯曲纸页网格（`book.js`）以及放在纸面上的三维器材（`ink.js`）；`stage.js` 先渲染底层色彩并提取深度/法线生成全场景统一墨线描边，再通过 `print.js` 把静态公式与排版印制至高清 `CanvasTexture`。
- **可交互控件无缝贴纸（`#css3d`）**：页面中可点击的选择器、滑块、微调活公式（`scrub.js`）、掀卡（`.flap`）以及左页嵌入式画布（`data-fig`）同步运行于 `#css3d` 图层中；当进入翻页过渡（`startTurn`）时自动冻结当前页 DOM 快照并印回纹理，避免翻页途中组件穿透或穿帮。
- **隐藏手柄防误触**：在 `stage.js` 射线拾取循环中增加 `!d.mesh.parent || !d.mesh.visible || !d.mesh.parent.visible` 守卫，彻底消除多模型切换隐藏零件（如不同摆球材质）时的“隐形空气柱阻塞拖拽”隐患。

### 2.2 WebKit 与移动端响应式适配
- **Safari / WebKit `mix-blend-mode` 修复**：`app.js` 启动阶段通过真实浏览器特性/UA 识别为 `<html>` 挂载 `.webkit-safe` 类，把 `#css3d` 容器在 WebKit 下切换为 `mix-blend-mode: normal`，防止 CSS3D + `preserve-3d` 叠加导致的合成层透明消失问题（经 `webkit-2336` 实机实证渲染正常）。
- **移动端竖屏堆叠布局（`< 860px`）**：自动切换 `body.stacked`，上半屏锁定 `48dvh` 粘性三维操作台，中部常驻 `#mTabs`（`阅读与导引` / `学科实验台` / `实验记录册`），下半屏分别承载单列流式导学内容、工作台面板或记录抽屉；抽屉顶部边界精确锚定在 `calc(48dvh + 48px)` 至底部导航栏之上，确保三个主标签始终可一步点击切换，互不遮挡。

### 2.3 按需分包加载（`catalog.js`）
- `curriculum-matrix.json` 为唯一真值索引源。首屏仅下载当前页所属的单一领域包（`import(\`../domains/${packName}.js\`)`），其余 7 个领域包在后台翻页空闲时预取相邻包（`settle()`），保证首屏初始化轻量快捷并支持全部 63 页随时热跳。

---

## 3. Gen-3 世界线与可逆时间基础设施（`timeline.js` + `tape.js` + `scrub.js`）

- **`Timeline` 定步长状态环形缓冲**：记录状态矢量（如单摆 `th, om, thf, omf, sf, l, held`），支持任意时刻 `t` 插值回看与 `truncate(t)` 回滚重算。
- **`recorder()` 走纸记录仪**：走纸纸带本身即时间轴（$z \leftrightarrow t$），纸面实时打印轨迹与秒数刻度；向上拉起纸签或压低镜头俯仰时，二维平面印迹连续升起为三维空间世界线（Worldline）。
- **`scrubbable()` 双向活公式操纵**：对公式中的关键数值可直接按住左右微调，联动三维装置、边界约束条（如“摆角很小”）实时由常态变为警告（琥珀色）或破坏删去（朱砂红划线）。

---

## 4. 零依赖纯科学求解内核（`science-models.js`）

为彻底消除“动画和工作台各自写一套计算公式”或“前端 DOM 耦合导致无法单独测算数值收敛性”的问题，全站高精度科学算法抽离至零 DOM 的 `experimentarium/js/core/science-models.js`，供 3D 装置、工作台图表和 Node 单元测试共同复用：
- 力学非简谐单摆四阶龙格–库塔求解器（`stepPendulumRK4`）及椭圆积分（`pendulumExactPeriod`）
- 强酸/弱酸强碱滴定全区间质子–电荷守恒精确二分求解器（`solveTitrationPH`）
- 五类盐水解平衡与温度对 $K_w$ 热力学影响模型（`solveHydrolysisPH`）
- 圆锥截面分类与过顶点退化判别（`classifyConicSection`）
- 天文太阳赤纬、海口双直射、正午太阳高度与昼长解析解（`solveEarthSun`）
- 等截面积矩形/空心方管/工字钢梁抗弯惯性矩与挠度应力学求解器（`solveBeamDeflection`）
- 活字印刷与雕版印刷技术经济工时阈值模型（`solveMovableTypeEconomics`）
- 亚里士多德词项逻辑四格三段论周延性严密判定器（`checkSyllogismValidity`）
- 市场供求均衡、最高限价/最低保护价与无谓损失三角形计算（`solveMarketEquilibrium`）
- 五等份基尼系数与洛伦兹曲线积分模型（`solveLorenzGini`）

---

## 5. 个人实验记录系统与生态互联（`journal.js` + `bridge.js`）

- **存储层级**：IndexedDB (`haiz-experimentarium-db` / `records`) 为主存储 + `localStorage` (`haiz-experimentarium-records-v1`) 为双写灾备；首次启动自动只读迁移旧版 `haiz-lab-notebook-v1` 记录（不改写旧键），结构遵从 `haiz-experiment-record/1`。
- **完整实验工作流**：每项实验支持新建多批次（Run #1, #2...）、填写实验前假设、表格录入/行内手工校正/异常离群点划除、一键依批次快照还原当时装置参数、两批次定量摘要并排对比、以及 CSV（含 UTF-8 BOM 防 Excel 乱码）、Markdown 完整实验报告、全册 JSON 备份导出与跨设备合并导入。
- **Supabase 云端同步边界声明**：经检查现有仓库 `supabase/migrations/202610310001_pocket_snapshots.sql`，现网仅定义匿名行级限制的 `pocket_snapshots` 通用快照表，尚未为实验手册配置独立认证用户表或师生批阅 RLS 策略。因此，本项目**坚持本地优先零假同步策略**：界面明白标示当前离线私有存储状态，绝不伪造“已同步到云端账户”的虚假提示。
- **跨项目集成协议（`bridge.js`）**：向兄弟项目（World Engine、假设剥离器等）公开 `window.HAIZExperimentarium`（`version: "3.0.0"`, `schema: "haiz-experimentarium-bridge/1"`）只读与跳转 API，以及 URL 参数（`?exp=<id>&mode=spread|gatefold|workbench&embed=1`）和 `postMessage` 安全协议。
