# HAIZ 混元学生角色

基于用户提供的 `20261121124835_b26256ec.glb` 制作。此版本用于近景外观、动作和校园漫游审阅。独立分支为 `codex/haiz-hunyuan-student`。

## 本地预览

在仓库根目录运行：

```sh
python3 -m http.server 8769 --bind 127.0.0.1
```

- [Character Lab](http://127.0.0.1:8769/character-lab/hunyuan/) 可旋转、缩放、检查骨骼、切换七段动作和三档 LOD，比较原始高模，并切换日光、树荫、黄昏及阴影。三角面和 Draw Calls 包含渲染统计，FPS 取浏览器帧时间。开启高模对照时按需载入源文件。
- [入画 · 校园漫游](http://127.0.0.1:8769/ruhua.html?figure=hunyuan&stage=stroll) 使用 `WASD` 或方向键移动，`Shift` 跑步，拖动视角。手机左侧触控移动、右侧拖动观察。去掉 `stage=stroll` 可走完整「入画」流程。去掉 `figure=hunyuan` 即进入原角色。

## 资产

| 文件 | 三角面 | 贴图 |
| --- | ---: | --- |
| [源高模备份](source/20261121124835_b26256ec.glb) | 1,500,000 | 原文件无贴图 |
| [Blender 工程](haiz-student.blend) | 工程内含源雕塑和三档网格 | 已打包 |
| [LOD 0 近景 GLB](models/student-near.glb) | 63,394 | 2K |
| [LOD 1 中景 GLB](models/student-mid.glb) | 22,100 | 1K |
| [LOD 2 远景 GLB](models/student-far.glb) | 7,200 | 512 px |

GLB 各使用一个蒙皮绘制图元、22 根骨骼和每顶点最多四项权重。网格使用 Meshopt 压缩。外置 [贴图](textures/) 包含 Base Color、切线空间 Normal 与 ORM。ORM 的 R 通道是 AO，G 是 Roughness，B 是 Metallic。Base Color 为 JPEG，Normal 和 ORM 为 PNG。动作由本项目生成，未引入第三方商业动作。

## 源资产审计

直接解析 GLB 二进制。单场景、单节点、单网格、单索引三角图元，749,996 个顶点。源数据仅有 POSITION 和索引。原始包围盒约 (0.695 × 1.161 × 0.295) 个 glTF 单位，+Y 向上，+Z 朝前。脚底最低点在 Y=0，原点位于双脚之间附近。派生资产按 1.70 m 身高等比缩放。

索引邻接得到一个闭合连通分量。未检出边界边、非流形边、反向邻接边、重复面、重复顶点或零面积面。拓扑审计可排除独立的内部壳体，连通表面的自相交仍需依局部观察判断。正侧背图显示衣领、袖口、垂下的肩带、背包贴背处和裤裆都属于同一连续表面。打底身体、眼球、独立肩带和包袋内层没有单独的可编辑网格。

- [源审计 JSON](evidence/source-audit.json)
- [原模正面](evidence/source-front.png) · [侧面](evidence/source-side.png) · [背面](evidence/source-back.png) · [3/4](evidence/source-three-quarter.png)
- [优化正面](evidence/student-front.png) · [侧面](evidence/student-side.png) · [背面](evidence/student-back.png) · [3/4](evidence/student-three-quarter.png)
- [原模对照](evidence/lab-comparison.png) · [骨骼视图](evidence/lab-run-skeleton.png) · [手机视口](evidence/lab-mobile.png)

## 制作记录

- 高模原样备份并以 SHA-256 校验。Blender 工程内的源雕塑置于独立集合。
- 按曲率和形态权重做减面。脸、衣领、袖口、鞋、背包和关节优先保留。近景在肩、肘、膝、裤裆的稀疏区域拆分 597 条边，新顶点尽量投影回高模。中远景派生自近景。
- 在源四视图上定材质区域。基色按白色校服、湖蓝运动裤、白鞋、棕橙背包、黑短发制作。此任务附件里只有 GLB，校服配色按需求设定，服装和背包表面无校徽和文字。
- 分别展开三套 UV。烘焙自己制作的 Base Color 与 Roughness，高模向三档模型投射切线空间法线，在各档目标网格上烘焙 AO。
- 对人体关节和背包独立分配骨骼。在臂弯、手腕、裤裆和鞋口做连续权重分区。首轮画面发现指尖受到了躯干权重影响，回归检查现在要求两侧外端手指的手骨权重超过 98%。
- GLB 自带 Idle、Walk、Run、Turn Left、Turn Right、Walk Stop 和 Start Walking。Character Lab 用 Three.js AnimationMixer 播放。校园用现有玩家控制器和两骨 IK，按实际位移驱动，计算鞋底支撑、步幅、转向和收步。背包以胸椎为父骨并带阻尼跟随。
- 桌面从 LOD 1 起载，镜头靠近且稳定后请求 LOD 0。手机使用 LOD 1 和 LOD 2，镜头约 11.5 m 外才请求 LOD 2。LOD 更换复用同一骨架，保留位移和步态状态。

## 验证与重现

```sh
blender -b -t 10 --python-exit-code 1 --python character-lab/hunyuan/audit.py
blender -b -t 10 --python-exit-code 1 --python character-lab/hunyuan/build.py
blender -b character-lab/hunyuan/haiz-student.blend --python-exit-code 1 --python character-lab/hunyuan/pose-review.py
python3 character-lab/hunyuan/check-assets.py
node character-lab/hunyuan/browser-check.cjs
node character-lab/hunyuan/browser-check.cjs --transition-only
node character-lab/hunyuan/record-demo.cjs
```

Blender 使用 5.2.3，浏览器脚本使用仓库的 Playwright。录制脚本需要 FFmpeg。浏览器脚本允许用 `HAIZ_PREVIEW_URL` 和 `HAIZ_CHROMIUM` 指定本地预览地址和 Chromium 二进制。默认使用 macOS ANGLE Metal。环境明确只有软件渲染时，使用 `HAIZ_SWIFTSHADER=1`。这里的 FPS 来自浏览器帧时间，JS Heap 统计不涵盖显存和浏览器总内存。

- [姿势测量](evidence/pose-results.json) · [抬臂屈肘](evidence/pose-arm-elbow.png) · [转头](evidence/pose-head-turn.png) · [下蹲](evidence/pose-squat.png) · [迈步](evidence/pose-walk.png) · [跑步](evidence/pose-run.png) · [转身](evidence/pose-turn.png)
- [浏览器实测](evidence/browser-results.json) · [桌面校园](evidence/campus-desktop.png) · [校园跑步](evidence/campus-run.png) · [触屏模拟校园](evidence/campus-mobile.png) · [动作视频](evidence/student-motion.mp4)
- [入画交接和雨伞测试](evidence/transition-results.json) · [交接截图](evidence/campus-transition.png)

Chromium 153 使用 Apple M5 的 ANGLE Metal 渲染。在本机服务、近景站姿和阴影开启的情况下，桌面得到 57.6 FPS，首次模型获取与解析约 112 ms。390 × 844 触屏模拟使用中景，得到 60.0 FPS，模型获取与解析约 43 ms。两次均是短窗口样本。渲染统计含地面、网格和阴影通道，共 4 个 Draw Calls。

校园脚底采样以 60 Hz 步进，只统计平脚支撑且相邻帧共用同一落脚点的样本。走路连续帧水平位移 P95 为 0.21 cm（66 个样本），跑步为 0.55 cm（28 个样本）。脚底到地面的偏差 P95 分别为 1.31 cm 和 1.42 cm。贴近科技楼时碰撞保持约 0.30 m 间距，镜头受阻时由约 4.9 m 缩到 0.70 m。

浏览器测试覆盖键盘、触屏、三档 LOD、校内近远景切换、遮挡、主路径入画交接、雨伞以及原角色回滚。转场测试从页面按钮启动，用测试时钟加速笔触和镜头阶段。

## 待验收

- 大角度抬臂时腋下与融合的肩带局部会被拉长，深蹲和大跨步时裤裆及膝部可见线性蒙皮形变。独立服装拓扑、肩带与腋下的手工清理、面部眼口精修仍是近景正式验收项。
- Android Chrome 真机尚未测试。手机视口和触屏输入由 macOS Chromium 模拟，浏览器实测的 FPS 不能用于推断中端手机性能。
- 预览以分支和查询参数启用。长时间运行的设备内存仍待专项复验。
