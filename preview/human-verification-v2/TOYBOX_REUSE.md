# HAIZ Campus Toybox · 角色资产复用规范

六款原创角色与抓娃娃机业务逻辑完全解耦，可直接复用于未来的 **HAIZ Campus Toybox（校园玩具收藏馆）**、**校园漫游（`lanren/`）** 及 **多人共游** 场景。

- **稳定唯一 ID**：`lanren-spirit`、`sunshine-duck`、`campus-cat`、`schoolbag-bear`、`ocean-whale`、`hainan-fawn`
- **统一坐标系与尺度**：右手坐标系，`+Y` 朝上，`+Z` 朝前，原点 `(0, 0, 0)` 位于脚底中心，标准高度约 `0.86 ~ 0.96` 单位。
- **预导出 `.GLB` 模型**：位于 `assets/models/*.glb`，可直接拖入 Blender 或用 Three.js `GLTFLoader` 加载。
- **收藏解耦原则**：未来收藏系统与真人验证次数、结果完全独立，不引入付费抽奖或概率机制。
