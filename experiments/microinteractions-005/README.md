# HAIZ Experiment 005 · 全局动态 UI 与产品艺术设计

非官方演示原型。它把 Experiment 004 的三种 Dock（A 弹性让位、B 液态膜、C 折痕舞台）提炼成**一套空间语言**，并把它从底部导航扩展到整个产品：侧栏、顶栏与全局搜索、页面切换、列表 ↔ 详情、弹出层、基础组件，以及桌面与手机两套交互。

- **原型**：`index.html`（这个目录本身就是可以直接打开的静态站点）
- **对照验收台**：`bench.html`。004 原页面与 005 Dock 同步慢放（1× / 0.35× / 0.12× / 暂停 / +1 帧）并跑同一组编排；OJO 原型与 005 的页面对照；组件陈列；帧间隔与空闲休眠检测
- **设计说明**：[`DESIGN-005.md`](DESIGN-005.md)
- **浏览器验收记录**：[`VERIFICATION.md`](VERIFICATION.md)（`npm run verify` 生成）

## 什么是真的，什么是演示

| 真实 | 演示（界面中带「演示」标记） |
| --- | --- |
| 校园建筑平面与说明：HAIZ 校园模型 `assets/walk/campus.json`（依据学校官网资料与实测平面） | 学生与教师身份、课表、待办 |
| 校园照片：海南中学官网与 HAIZ 项目实拍，逐张注明 | 通知正文、社团活动、笔记 |
| 年轮的逐日天气：ERA5 再分析，经 Open-Meteo（CC BY 4.0），见 `data/SOURCE.md` | 成长数据、作业回收 |
| 入画的渲染与绘画：HAIZ painted-lab（渲染图上原有的对比滑块标记已修除，脚本见 `source/scripts/retouch-painted.py`） | 榄仁的月份物候为概括，标注「约」 |

## 目录

```
experiments/microinteractions-005/
├── index.html, bench.html, assets/   构建产物（直接部署）
├── img/  data/  ref/                 公共资源；ref/ 内是 004 原页面与 OJO 原型，仅供对照
├── README.md  DESIGN-005.md  VERIFICATION.md
└── source/                           Vite + React + TypeScript 工程
    ├── src/kernel/     全局运动时钟、弹簧、Hairline 等距投影、轮廓几何（membrane）
    ├── src/icons/      26 个带物理的线稿图标
    ├── src/ui/         Dock 引擎、Grow（轮廓生长）、Skin（琉璃材质）、侧栏、顶栏、详情、基础组件
    ├── src/app/        外壳、路由、状态、搜索命令、Dock 舞台内容
    ├── src/pages/      各页面
    ├── src/culture/    年轮（移植自 lanren/rings）
    ├── src/bench/      对照验收台
    └── scripts/        字体子集、构建清理、浏览器验收、图像修复
```

## 开发与构建

```bash
cd experiments/microinteractions-005/source
npm install
npm run dev        # http://127.0.0.1:5175/  ·  /bench.html
npm run build      # 输出到上一级目录（即本目录），先清理旧的 assets/
npm run verify     # Playwright：全部页面 × 桌面/手机、交互流程、空闲休眠、减少动态效果、验收台 → VERIFICATION.md
```

字体自托管（Noto Sans SC / Noto Serif SC 按源码中实际出现的字符选取子集，Sora 数字字体），不依赖任何 CDN；OJO 参考页自带的外部图标库除外。

## 与主站的关系

独立目录，不修改主站任何页面，也不覆盖 001–004 的成果。合并后可通过 GitHub Pages 访问 `https://haiz.space/experiments/microinteractions-005/`。
