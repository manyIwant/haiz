# HAIZ WORLD 交接说明

## 当前状态

这是 HAIZ WORLD 的第一版可交互校园原型，方向选定为「校园图谱 / Living Cartography」。目标不是工业数字孪生大屏，而是让校园本身成为操作界面。

原型地址：`http://127.0.0.1:4173/`

## 已实现

- 保留 PR #16 的真实三维校园模型和空间坐标，不重新摆放建筑。
- 全校三维俯瞰、建筑选择、镜头靠近、跳过镜头。
- 第一人称漫游、WASD、原有碰撞与移动逻辑。
- 图书馆进入 STILLROOM。
- 一号教学楼进入概念教室。
- Porcelain、Obsidian、Ocean 三主题。
- 窄屏响应式布局、触控尺寸、减少动态效果模式。
- 原始模型、几何、移动运行时和目标空间文件保持不改；新增功能通过 derivative bridge 接入。

## 关键文件

- `src/App.jsx`：主界面、地点选择、入口状态、主题和设置。
- `src/styles.css`：桌面/移动端视觉系统和响应式布局。
- `public/haiz/world/atlas-engine.html`：校园场景入口。
- `public/haiz/world/atlas-prototype-bridge.js`：相机、选择、漫游、消息桥接和性能策略。
- `public/haiz/world/atlas-prototype-bridge.css`：场景标签与控件样式。
- `docs/spatial-layout.md`：PR #16 空间坐标与方向说明。
- `design-qa.md`：最终视觉验收和已修复问题。
- `docs/evidence/`：原始模型、桌面/移动端、漫游和空间入口截图。

## 验证

在项目目录运行：

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 4173
```

已通过 `npm run build` 和 17 项空间/桥接测试。测试文件位于 `tests/`。

## 继续工作时的注意事项

- 不要把建筑位置按二维地图重新镜像；当前相机方向和模型坐标依据见 `docs/spatial-layout.md`。
- 不要恢复原始调试 HUD，它会和新界面叠加。
- 继续优化前优先在 1440px、390px、320px 宽度检查布局。
- 真机 iPhone/Android 的触控、帧率和低电量模式还需要发布前验证。
