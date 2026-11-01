# HAIZ WORLD — Design QA

## Final result: passed

已对桌面、390px 与 320px 宽度，以及图书馆 → STILLROOM、艺豪楼 → 概念教室两条空间联动路径完成验收。最终方向为「校园图谱 / Living Cartography」：校园真实模型保持原坐标，界面围绕空间选择、镜头靠近与第一人称进入组织。

## 验收面

- 空间一致性：沿用 PR #16 的 34 个节点与原始模型坐标；没有把校园改成工业数字孪生大屏或虚构平面图。
- 电影式路径：选择建筑后镜头靠近，支持跳过；进入步行模式后保留真实建筑、碰撞与摇杆。
- 空间联动：图书馆进入 STILLROOM，艺豪楼进入概念教室；返回时恢复校园选择状态。
- 主题与无障碍：Porcelain、Obsidian、Ocean；动态效果可关闭；桌面与窄屏按钮保持可触达尺寸。
- 响应式：390px 与 320px 证据截图中，标题、路线、底部卡片和控制区不发生横向溢出。

## 已修复的高优先级问题

- 调整窄屏正交相机的纵向构图，避免模型被底部卡片遮挡。
- 将空间入口层提升到页面之上，并在入口状态禁用背景交互。
- 修正入口路径为明确的 `index.html`，避免静态服务器回退到主页面。
- 将移动端主题、搜索、设置和菜单控制统一到可触摸尺寸。
- 隐藏原始调试 HUD，避免与新的校园操作界面叠加。

## 已知边界

证据覆盖浏览器中的窄屏布局和交互状态；真实 iPhone/Android 硬件帧率、触控手势和低电量模式仍应在真机发布前再测。低画质、减少动态效果和按需渲染路径已在原型中提供。

## Evidence

- `docs/evidence/source-model-labeled.png` — 原始校园模型与坐标依据
- `docs/evidence/library-walk.png` — 图书馆第一人称路径
- `docs/evidence/classroom-portal.png` — 概念教室空间入口
- `docs/evidence/mobile-library-390.png` — 390px 窄屏
- `docs/evidence/mobile-320.png` — 320px 窄屏
