---
name: haiz-world-engine
description: Blocking engineering constraints, unified runtime invariants, spatial datum truth, art discipline, and executable verification commands for multi-AI development of HAIZ World Engine.
---

# HAIZ World Engine · 多 AI 协作强制工程规范 Skill

本 Skill 为不同 AI 模型与人类开发者提供**可由 CI 强制拦截**的统一世界工程约束，杜绝拼接式分叉、坐标系错乱、重复渲染循环、资源泄漏、画风退化或破坏既有生产系统。

## 1. CI 强制拒绝的红线（Executable Blocking Rules）

1. **禁止坐标系与北向分裂**：除 `world-engine/spatial/coord.js` 显式文档记录外，任何 `world-engine/` 代码不得硬编码旧北向（`337°`、`321.6°`）或火星坐标（`19.996067, 110.347227`）。由 `validate-world.mjs` 静态扫描拦截。
2. **禁止子系统私建渲染循环**：`world-engine/` 内所有非入口子系统禁止调用 `requestAnimationFrame`；入口宿主必须通过 `runtime.claimRenderLoop(name)` 申请唯一主循环所有权。由 `validate-world.mjs` 静态门禁 + `runtime.js` 运行时断言双重拦截。
3. **禁止非法状态变更**：所有权限切换、画境切换与角色坐标更新必须经 `store.setAuthority()` / `store.setLens()` / `store.setUserPose()` 校验（拦截非法画境、非法权限、`NaN` 或越界坐标）。切换画境严禁隐式篡改世界时钟、天气、场景实例或角色位置。
4. **必须具备确定性生命周期释放**：核心运行时、渲染管线、资产缓存与实体管理器必须实现 `dispose()`，防止 GPU RenderTarget、几何体、纹理与事件监听泄漏。由 `validate-world.mjs` 与 `test-unified-architecture.mjs` 校验。
5. **统一资产注册与去重**：所有角色、Campus Toybox V2 玩偶、载具与生物必须通过 `world-engine/core/assets.js`（`ASSET_CATALOG` + `createAssetRegistry`）与 `world-engine/core/entities.js` 接入，禁止重复加载或私自拷贝 GLB（`validate-glb.mjs` 检测二进制 SHA-256 重复与体积/三角面预算）。
6. **真机与实测诚实边界**：严禁把艺术推测伪装成真实测绘（空间节点必须标注证据等级）；严禁把 SwiftShader 软件渲染帧时宣称为真机 GPU 帧率；严禁直接修改生产数据库或 `main` 分支。
7. **纸与墨视觉与移动端底线**：UI 恪守 `#f4f1e8 / #1f3a30 / #a8482c / #8f6a1f` 纸墨体系；禁止黑底荧光科技风；手机竖屏 `390×844` 零横向溢出且通过移动端绘制预算。

## 2. 必须全部通过的可执行门禁命令

```bash
# 1. 静态架构红线 + 契约 + 资产目录 + 全量 JS 语法检查（13 项）
node tools/world-engine/validate-world.mjs

# 2. 无页面依赖的统一架构集成证明测试（8 项核心不变量）
node --test tools/world-engine/test-unified-architecture.mjs

# 3. 科学模拟内核物理守恒与数值精度测试（10 项）
node --test tools/world-engine/test-science-kernel.mjs

# 4. 二进制 GLB 资产体积、面数与 SHA-256 重复扫描
node tools/world-engine/validate-glb.mjs --write

# 5. 浏览器全链路集成测试 + 六画境同机位横向对照 + 移动端验收
python3 tools/world-engine/test-world-browser.py
```

## 3. 新实体与未来功能扩展标准接口

- **Campus Toybox 原创角色 / 校园生物 / 载具**：在 `world-engine/core/assets.js` 的 `ASSET_CATALOG` 登记稳定 ID（如 `toybox:lanren-spirit`），通过 `runtime.entities.register({ id, kind, assetId, transform, update, snapshot, applySnapshot, dispose })` 接入统一空间与 3D 高度隔离查询。
- **未来多人共游**：严格采用可选授权（opt-in），仅交换 `world-engine/core/entities.js` 定义的 `serializePeerPacket()`（符合 `schemas/entity-interface.schema.json`），不传输真实学生隐私或后台行动轨迹。
