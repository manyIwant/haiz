# 抽出一年 · 第三方授权与来源说明

这个实验（`experiments/nianlun-pull-a-year/`）的代码由 HAIZ 自行创作，按仓库根目录 [LICENSE](../../LICENSE)（PolyForm Noncommercial 1.0.0）与 [LICENSING.md](../../LICENSING.md) 的边界授权。下面逐项列出它用到或借鉴的外部作品，以及**用了什么、没用什么**。

## 一、直接复用的代码与数据

| 内容 | 位置 | 来源与授权 | 说明 |
| --- | --- | --- | --- |
| HAIZ「年轮」模块 `codec.js`、`climate.js`、`disc.js`、`almanac.js` | `lib/rings/` | HAIZ 自有代码（`lanren/rings/`，PolyForm Noncommercial 1.0.0） | 原样复制，未改动；这样实验预览可以独立部署。年轮的几何、木纹配色、天气描述、日出日落都直接来自它们 |
| HAIZ `sun.js`、`season.js` | `lib/js/` | HAIZ 自有代码（`lanren/js/`） | 原样复制，供 `almanac.js` 计算日月位置 |
| 逐日天气档案 `climate.bin` / `climate.json` | `lib/rings/data/` | **ERA5 再分析**（Copernicus Climate Change Service / ECMWF），经 [Open-Meteo](https://open-meteo.com/) 获取，**CC BY 4.0**；包含经修改的 Copernicus 气候变化服务信息 | 与生产站同一份文件（截至 2026-11-16）。模式再分析，约 25 km 网格，不是校内观测。详见同目录 `SOURCE.md` |
| 校史条目与新闻条目 | `content.js` | 摘自 HAIZ 第二幕「根脉」（`lanren/roots/history.js`）与新闻档案（`data/news.json` 中 `demo:false` 的条目） | 文字沿用原有表述与史料等级，每条保留原始出处链接；不新增任何未经核实的史实 |
| 照片 9 张 | `photos/` | HAIZ 仓库既有图片（`assets/images/`），缩小到 1100 px 以内 | **授权状态沿用 HAIZ 原有标注**：部分画面署名「区大伟 摄」、部分为新闻或学校官网配图，转载授权待确认；页面中每张图都随附原有的版权说明。这些图片不在 PolyForm 许可范围内 |

## 二、移植的算法

| 内容 | 位置 | 来源与授权 |
| --- | --- | --- |
| Sarkar–Brown 一维鱼眼变换 `g(x) = (d+1)x / (dx+1)` 及其逆变换 | `physics.js` 的 `fisheye()` / `fisheyeInv()` | 按 Mike Bostock 的 d3 fisheye 插件（[d3/d3-plugins](https://github.com/d3/d3-plugins/tree/master/fisheye)，**BSD-3-Clause**，Copyright Mike Bostock）与其演示 <https://bost.ocks.org/mike/fisheye/> 重写为一维、可求逆的形式。这里只用了公式，没有复制源码文件 |

> BSD-3-Clause 要求保留版权声明：Copyright (c) 2012–2015, Michael Bostock. All rights reserved. 以源代码或二进制形式再分发时须保留此声明、条件列表与免责声明；未经许可不得用作者姓名为衍生作品背书。本说明即为此目的保留。

## 三、研究过、继承了交互方式但没有复制代码的项目

| 项目 | 授权 | 我们继承了什么 | 为什么没有直接搬代码 |
| --- | --- | --- | --- |
| [Kando](https://github.com/kando-menu/kando) | MIT | 子层级「在你手指所在的地方」展开、父层级缩到身后但仍可点回去（左上角缩小的树干就是它的「parent item」）；拖动而不是点击的「marking」思路——这里「拉出一圈」本身就是一次 marking 手势 | Kando 是 Electron 桌面饼菜单，渲染与窗口层是它自己的；我们需要的是手势哲学，不是饼菜单 |
| [Elastic SVG Elements](https://tympanus.net/Development/ElasticSVGElements/)（Codrops） | Codrops 授权：可在项目中集成和二次创作，不得原样再发布或出售 | 拖动时形状被拉伸、松手后带过冲回弹（`mina.elastic`）的手感：年轮被拉出时是一圈有弹性的木环，离手指越远的部分越松、越晃；没拉够就弹回树干 | 原作用 Snap.svg 在两条路径之间补间；我们需要每一天都跟着物理走，所以改为逐节点弹簧（`physics.js`） |
| [Organic Shape Morph Ideas](https://github.com/codrops/ShapeMorphIdeas)（Codrops） | MIT | 有机的、不规整的轮廓：年轮沿用 HAIZ 原有的缓慢起伏（`wobble`），被拉出后在弹簧作用下不断变形，不是一个完美圆 | 原作是 anime.js 在预设路径之间循环变形，与我们的「由手势驱动」不同 |
| [Flubber](https://github.com/veltman/flubber) / [GSAP MorphSVG](https://gsap.com/docs/v3/Plugins/MorphSVGPlugin/) | MIT / GSAP 标准许可 | 研究了「任意形状之间补间」的做法 | 环展开成一条线时，通用补间会让木环在中途缩成一团。我们改用真实的「滚动展开」几何：未展开的部分仍是同半径的圆弧，已展开的部分平铺在轨道上，长度守恒——这正是两者都表达不了的。因此**没有引入**这两个库 |
| [Motion 布局动画](https://motion.dev/docs/react-layout-animations) | MIT | 同一个对象在不同布局之间连续移动、手势速度交给弹簧、动画被打断时只换目标不重来；「这一天」的天空从它在带子上的那一格长出来、收起时又缩回那一格（共享元素过渡） | 本实验不用 React；弹簧按 stiffness / damping / mass 的同一套参数化自己实现 |
| [D3 Zoomable Sunburst](https://observablehq.com/@d3/zoomable-sunburst) | ISC | 「点一段弧，它扩展成整体」的层级下钻 | 我们把下钻换成了物理动作：不是放大一段弧，而是把整圈拿出来展开 |
| [Orbit](https://zumerlab.com/orbit-docs/) | MIT | 研究了用 CSS 做径向布局 | 没有使用；径向布局在这里由着色器完成 |

## 四、字体与其他

- 不打包任何字体文件，使用系统宋体 / 苹方等。
- 不加载任何外部脚本或 CDN 资源；整页离线可用（数据随页面提供）。
- 声音全部用 Web Audio 实时合成，没有使用录音素材。
