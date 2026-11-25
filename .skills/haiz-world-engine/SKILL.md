---
name: haiz-world-engine
description: Engineering constraints, spatial truth, art discipline, and executable verification commands for multi-AI development of HAIZ World Engine.
---

# HAIZ World Engine · 协作工程规范 Skill

本 Skill 用于让不同的 AI 模型与人类开发者在同一套**可执行的工程约束**下协同建设 HAIZ（海南中学府城校区数字校园世界引擎），防止重复造轮子、坐标系分叉、画风失真或破坏既有功能。

## 1. 不可违背的红线（Hard Invariants）

1. **分支与安全边界**：严禁直接覆盖 `main` 分支；严禁修改线上 Supabase / 生产数据库；严禁暴露密钥或弱化 RLS/CSP 安全策略；严禁在无授权情况下采集或公开真实学生个人信息与位置轨迹。
2. **保护既有成果**：不要推翻或删除 `lanren/` 六幕榄仁树、入画（`ruhua*.html`）、校园活着（`lanren/life/`）、自由共游（`lanren/free/`）、`twin/` 摄影校准建筑与 `lab/` 实验册。新系统应挂载在 `world-engine/` 内核上，而非复制 `main.js`。
3. **真实测绘与艺术推演严格区分**：所有新增空间实体必须写入 `world-engine/spatial/graph.js` 并携带有效证据等级（`surveyed | photo-derived | public-map | legacy-estimated | creative-inference`），符合 `schemas/spatial-graph.schema.json`。
4. **统一世界基准**：
   - 经纬度基准统一采用 `twin/data/frame.json` 的 WGS84（`19.99847892°N, 110.34254843°E`），校园北向为 `319.0°`（不再引入新的北向常量）。
   - 所有地面/空中交互必须使用 `world-engine/spatial/coord.js` 的 `separation3D()` 检查垂直离地高度，防止高空飞行惊扰地面生态或 NPC。
5. **纸与墨视觉纪律**：
   - UI 采用暖白纸色 `#f4f1e8`、深绿墨色 `#1f3a30`、红叶 `#a8482c`、新叶铜 `#8f6a1f`、结构深绿 `#2a4a3c`；夜色 `#0f1714` 仅用于沉浸空间。
   - **禁止**黑底荧光科技风、廉价玻璃拟态堆砌、无意义装饰粒子雨与无信息英文标语；中文正文与按钮字号不小于 13 px。
6. **科学模型诚实声明**：所有新增科学实验必须接入 `world-engine/science/kernel.js` 的数值求解与误差传播，并在 `MODEL_META` 中明示方程、适用范围、简化条件与精度；不得用纯动画冒充物理精确性。
7. **性能与真机诚实原则**：任何软件渲染（SwiftShader）毫秒数都不等于真机 GPU 帧率；提交前必须通过硬件无关绘制预算（Draw Calls / Triangles / Textures / GLB 体积）。

## 2. 必须执行的验证命令（Executable Gates）

每次改动 `world-engine/`、资产、数据或着色器后，必须执行并全部通过：

```bash
# 1. 空间契约、角色注册表、六画境契约与全量 JS 语法检查
node tools/world-engine/validate-world.mjs

# 2. 科学模拟内核物理守恒性与数值精度单元测试
node --test tools/world-engine/test-science-kernel.mjs

# 3. 二进制 GLB 资产解析与预算扫描
node tools/world-engine/validate-glb.mjs --write

# 4. 真实浏览器（桌面 1440×900 + 手机 390×844 + 工程验收台）回归与截图
python3 tools/world-engine/test-world-browser.py
```

## 3. 新增子系统的标准接入模板

不要新建独立的 `*.html` 拷贝整套 Three.js 循环。请按如下模式接入 `world-engine/`：

1. 在 `world-engine/<domain>/` 编写纯 ES 模块，通过 `bus`（`world-engine/core/bus.js`）订阅事件（`clock:tick`、`weather:change`、`lens:change`、`place:enter`、`authority:change`）。
2. 状态划分：共享世界状态写入 `store.state.world`，个人私有记录写入 `store.state.user`（遵循 `exportUserContract()`）。
3. 若引入 UI 面板或交互模态，通过 `store.setAuthority('<mode>')` 接管输入与相机，关闭时归还 `'explore'`。
4. 在 `world-engine/main.js` 中用 `perf.beginSubsystem('<name>')` 包裹 `update(dt)`，以便在 `world-engine-lab.html` 验收台实时监控 CPU 开销。
5. 若新增 3D 资产，登记到 `world-engine/data/character-registry.json` 或 `schemas/` 对应契约，并执行 `validate-glb.mjs` 验证预算。
