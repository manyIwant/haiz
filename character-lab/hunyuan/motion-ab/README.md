# HAIZ 步态 A/B

[打开同镜头对照](http://127.0.0.1:8769/character-lab/hunyuan/motion-ab/) · [播放对照视频](../evidence/motion-ab.mp4) · [浏览器测量](../evidence/motion-ab.json)

两个视图使用同一个混元学生 LOD 1、同一镜头、光照、地面和控制输入。时间轴依次经过等候、起步、步行、跑步、左右急转、再加速和停止。地面包含两个缓坡。可暂停、拖动时间轴或切换三个共享机位。

- A 组使用指定分支的步态库、`HAIZ_MAPPING` 与 `STUDENT` 参数。对照页适配了已有 PBR 材质和单网格骨架。该分支自有学生资产是 MakeHuman 派生工程。 [指定基线源码](https://github.com/manyIwant/haiz/blob/cf3abad535334b51779d0fa14f126e27ca56aee8/lanren/life/gait.js) · [基线资产溯源](https://github.com/manyIwant/haiz/blob/cf3abad535334b51779d0fa14f126e27ca56aee8/lanren/assets/life/SOURCE.md)
- B 组使用 `AnimationMixer` 采样 Quaternius 片段，叠加幅度随动作变化的过渡，再由双骨 IK 写入腿部最终姿势。A 组控制器提供同一根节点运动、脚部接触、落点和脚掌滚动。循环片段在接触事件上缓慢对齐相位，腾空中段参考片段自己的脚部轮廓。片段的水平根位移由校园控制器承担。
- Mesh2Motion 用于验证官方人形模板。8 段片段在模板上实际播放并通过骨骼旋转检查。学生保留原有 Blender 蒙皮与 PBR 材质，以控制 A/B 的变量。 [Mesh2Motion 官方库](https://github.com/Mesh2Motion/mesh2motion-app)
- 数据使用艺术家制作的 CC0 片段。慢速起步和步行停止由 Idle / Walk 过渡与程序化脚步完成。跑步采用 `Sprint_Enter` 和 `Sprint_Exit`，转身使用两个 `Turn90` 片段。 [Quaternius 官方发布页](https://quaternius.itch.io/universal-animation-library)

## 重定向与出处

`build-clips.js` 在 30 Hz 采样源骨架，折叠额外脊椎，按源骨架的静止姿势换算至 Retarget 的 canonical 空间，再调用 Retarget 0.1.2 转到 HAIZ 骨架。第一版画面发现变换后的腕部可穿过融合校服，最终导出按材质模型的实际 A 字姿态重新拟合上臂、前臂和手的方向。最终每段含 21 条旋转轨道和一条髋部位置轨道。 [Retarget 发布项目](https://github.com/nirholas/retarget)

| 本地输入 | 版本和来源 | SHA-256 |
| --- | --- | --- |
| `.inputs/quaternius-ual.glb` | [CC0 UAL1 原地版镜像](https://github.com/tilakpatell/tilakverse-assets/blob/85064399bbdacc0e8cc50807179490314bc4ff1c/quaternius/universal-animation-library/Unreal-Godot/UAL1.glb) | `d1cb4537efa4c06a953ca951e5935062f88c2580ac68e45045592d587bddb43d` |
| `.inputs/mesh2motion-human.glb` | [CC0 人形模板](https://github.com/Mesh2Motion/mesh2motion-app/blob/017169ae6f7574d8fa75d893c38c2776386ca40b/static/assets/human/skeleton.glb) | `1784d9aa20e24dee3233d97a8ac2f2e0d72cc74f0692b44fcded87d2d3e33f9c` |
| `.inputs/retarget.mjs` | [Apache-2.0 npm 0.1.2 发布包](https://www.npmjs.com/package/@three-ws/retarget/v/0.1.2) 中的 `dist/index.mjs` | 发布包 `3d40fbd5571e6e7752788650f56cacf57a246a9c6ebddec7ac0ef8e46b950f93` |
| `vendor/procedural-locomotion.min.js` | [HAIZ 固定版本](https://github.com/manyIwant/haiz/tree/cf3abad535334b51779d0fa14f126e27ca56aee8/lanren/vendor/procedural-locomotion)，[MIT 许可证](vendor/LICENSE) | `6b9d82dfff30cad12e0834e6eaec95226f3302f2258e47d464208ba894815eda` |

预览直接读取已导出的 `clips.json`。重新导出需要把上表前三项放到 `.inputs/`，原始依赖放在 Git 忽略目录内。

```sh
node character-lab/hunyuan/motion-ab/check.cjs --build
node character-lab/hunyuan/motion-ab/check.cjs --record
```

## 读数口径

60 Hz 固定步长。水平滑动只比较程序化控制器报告 `PLANTED`、两帧落脚锚点与脚底采样点均相同的连续帧。脚底样点来自骨骼上的脚跟和前掌，读数用于同条件比较。两组共享落点，读数主要显示 B 组有无因片段混合引入额外漂移。转弯时身体朝向仍由共享控制器管理。这里没有验证动作独立驱动根轨迹、180° 急转或真机长时间表现。

## Chromium 结果

这次运行中两组角色根轨迹完全重合。右转时支撑脚连续帧水平位移 P95 约 0.93 cm，A 和 B 相同到两位小数。其他阶段 B 相对 A 的 P95 增量均小于 0.001 cm。这一结果来自共享落脚锚点和脚掌滚动。

从髋到头的连线与竖直方向夹角，在跑步段的 P95 为 A 19.2°、B 35.1°，停步段为 A 9.3°、B 16.9°。片段带来了更明显的前倾和制动重心变化。B 的冲刺倾角仍比校园跑步风格所需更大，宜结合视频判断。浏览器检查包含 390 × 844 触屏视口的播放、暂停和共享机位。
