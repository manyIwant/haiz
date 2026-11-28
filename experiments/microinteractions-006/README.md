# HAIZ Experiment 006 · 空间交互、材质与动态艺术的深化

非官方演示原型。在 Experiment 005 建立的秩序（暖纸白、深琉璃绿、衬线标题、侧栏、情境胶囊、搜索、让位与生长）之上，006 不加功能，而是把空间、材质、几何、光与运动做深：**静息时简洁，运动时惊艳，使用时高效。**

- **原型**：`index.html`（这个目录本身就是可以直接打开的静态站点）
- **设计说明**：[`DESIGN-006.md`](DESIGN-006.md)
- **浏览器验收记录**：[`VERIFICATION.md`](VERIFICATION.md)（`npm run verify` 生成，37 项）
- **对照验收台**：`bench.html`（沿用 005：004 原页面与 Dock 同步慢放）

## 006 做了什么

| 区域 | 005 | 006 |
| --- | --- | --- |
| 侧栏 | 悬停时一块玻璃浮在条目上，和原生 tooltip 重复 | 玻璃从侧栏的竖向基准里**像表面张力液滴一样长出**，停在条目旁边，不压住图标与文字；在条目间迁移、拉伸、融合、缩回、再生；液滴里是那个去处此刻的一瞥（下一节课、本月榄仁的颜色、入画的一角…）；原生 tooltip 去掉 |
| 榄仁 | 示意图 | **真实的 `tree.glb`**（树干与板根约 25 万顶点）、10,947 个叶簇展开的约 4.8 万片叶、太湖石岛，主站 V4 叶片着色与 `season.js` 物候。月份滑块拨动的是这棵树的一年：转红、落叶、萌芽、新叶由古铜转绿；拨得快会起风，叶子会飘落；指针穿过树冠，叶子让开。线稿 / 白模 / 实景 / 透镜四种画法同源，进入时从树根向外墨线生长再显影 |
| 校园地图 | 平面数据 + 圆角棱柱白模 | **Experiment 003 的同源渲染**：26 栋 Blender V3 真实建筑（一号教学楼的门廊、北门的琉璃瓦、图书馆穹顶…）、道路草地操场水面、300 棵实测树，同一台相机画成线稿 / 白模 / 实景，像素对齐。静息是一张线稿总图；指针或列表指到哪栋，**只有那一栋显影成实景**，屋顶上拉出细线标注；点击滑近并打开详情 |
| 入画 | 一面透镜；首次进入只看到画（底图未解码） | 两张图都解码后才一起出现；五个画面（榄仁、教学楼、图书馆、凤栖亭、鸟瞰）；**「走进画中」**：透镜张开到覆盖整个画面（此时画与渲染逐像素重合，没有跳变），然后主站的实时画境实验室在其中接管——三维校园被实时画出来，可以环顾、换时辰与画法 |
| 全局 | — | 主题切换从点击处以圆形扩散（View Transitions）；随手的光：指针下的按钮、分段、搜索框、列表行有一点跟随指针的高光；所有三维场景跟随深色模式 |
| 验收 bug | — | 23:40 的“现在”线落在最后一节之后；详情面板打开时主栏让出 392px（1208 → 816）；入画首帧 |

## 继承了什么（没有重新发明）

| 来源 | 用在哪里 |
| --- | --- |
| Experiment 003 · `homologous-renderer.js`（PBR → 法线/材质/深度 → 合成，三种画法同一台相机） | `source/src/three/homologous.ts`，补上显影波前、墨线生长、单体显影、反相透镜、拾取与投影 |
| Experiment 003 · `study-terminalia.js`、`tree.glb`、`island.glb`、`rosettes.bin`、`tree.json`、树皮贴图 | `source/src/three/terminalia.ts` 与 `public/models/` |
| 主站 `lanren/js/foliage.js`（V4 叶片：`buildLeafInstances`、风、叶色、年度生长 GLSL）与 `lanren/js/season.js` | `source/src/three/foliage-port.ts`、`source/src/culture/season.ts`，逐字移植 |
| 主站 `lanren/assets/campus-v3/architecture.glb` 与 `campus.json` | `source/src/three/campus.ts` |
| 主站 painted-lab 截图与实时页面 | 入画的五个画面与「走进画中」（实时页面直接嵌入 `https://haiz.space/painted-lab.html`，没有复制） |
| Experiment 004/005 · Dock、让位、生长、基准、运动时钟 | 原样沿用 |
| Whitespace 实验合集 | **只研究了做法**（光学玻璃、液态几何、空间转场、动态线稿），用自己的代码重新实现；它的源码与素材按其授权（个人学习、请勿二次分发）没有进入本仓库 |

## 什么是真的，什么是演示

| 真实 | 演示（界面中带「演示」标记） |
| --- | --- |
| 建筑模型：HAIZ 校园 V3（Blender 近似模型）；平面与树：`campus.json` | 学生与教师身份、课表、待办 |
| 校园照片：海南中学官网与 HAIZ 项目实拍，逐张注明 | 通知正文、社团活动、笔记 |
| 年轮的逐日天气：ERA5 再分析，经 Open-Meteo（CC BY 4.0） | 成长数据、作业回收 |
| 榄仁模型：项目的树种概念模型（不是这株树的测绘） | 榄仁物候为对海口一带大叶榄仁常见物候的推演，标注「推演」 |

## 开发与构建

```bash
cd experiments/microinteractions-006/source
npm install
npm run dev        # http://127.0.0.1:5177/
npm run build      # 输出到上一级目录（即本目录）
npm run verify     # Playwright：全部页面 × 桌面/手机、交互流程、006 验收清单 → VERIFICATION.md
```

调试参数：`?now=2026-11-26T23:40` 固定“现在”；`?haiz=<地址>` 让「走进画中」指向别处的画境实验室（本地检查用）。

## 与主站的关系

独立目录，不修改主站任何页面，也不覆盖 001–005。独立预览：`https://manyiwant.github.io/haiz-microinteractions-lab-004/006/`。
