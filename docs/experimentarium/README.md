# HAIZ · EXPERIMENTARIUM — 全学科数字实验手册

> 面向海南中学与普通高中课程体系的非商业交互式数字实验书籍、实验室与个人探究记录册。  
> 在独立隔离分支 `experiment/haiz-experimentarium`（路径 `experimentarium/` 与 `docs/experimentarium/`）中建设，对 `origin/main` 原有文件保持 **零修改、零删除**。

- **在线独立预览（GitHub Pages）**：<https://manyiwant.github.io/haiz-experimentarium-preview/experimentarium/>
- **本地启动方式**：在仓库根目录执行静态 HTTP 服务（如 `python3 -m http.server 8080`），访问 `http://127.0.0.1:8080/experimentarium/`（推荐）或带参数直达单页：`?exp=phy-pendulum&mode=workbench`。

---

## 一、核心定位与突破

1. **三态空间连续体（书籍 ↔ 折叠台 ↔ 破页入台）**：  
   保留真实物理纸页曲率与三维景深翻书体验（`spread`）、拉阔视角俯瞰（`gatefold`）以及右侧展开交互工作台（`workbench`），不再把高精度的二维作图、显微细胞判读、滴定曲线微分、游标卡尺精密读数或史料矩阵硬塞在狭窄的纸页之内。
2. **纸就是时间（Gen-3 世界线与可逆时间）**：  
   以 `phy-pendulum`（单摆测量重力加速度）为样板，实验台走纸带将动力学过程一笔一划写入纸面成为 $x\text{–}t$ 曲线；拖动纸带可前后拨动仿真时间，提起“时空纸签”可把二维图像立成三维时空世界线，并在同一支点悬下“实体完整 RK4 摆”与“小角简谐公式摆”对照法则成立边界。
3. **先建立可机读全学科目录（101 项登记 / 63 项 L3–L4 实装 / 38 项如实标注 L0 与待开发）**：  
   拒绝“为了全学科覆盖率虚构实验数量”。全部课程依据教育部《普通高中课程标准（2017 年版 2020 年修订）》与海南省主流教材版本登记在 [curriculum-matrix.json](../../experimentarium/data/curriculum-matrix.json) 中，并在未取得海南中学当年教务内部征订书单前对非国家统编学科诚实标注 `provincial-mainstream-pending-school-booklist`。
4. **知识来源与误差笔法（`KIND` 视觉分层）**：  
   明确区分 `theory`（铜色虚线·理想解析公式）、`model`（墨色实线·数值模型）、`simulated`（空心圆+误差棒·统计随机模拟）、`human`（绿实心圆·学习者亲手测读）、`measured`（朱砂引框·史料/参考区间）与 `sketch`（铅笔淡线·教学比例示意）。
5. **个人实验室记录系统（`haiz-experiment-record/1`）**：  
   IndexedDB 优先、localStorage 回退离线持久保存，支持多实验批次（Runs）、修订版本号、点击剔除离群点、一键按历史批次参数复原实验条件、两批次并排对比及 CSV / Markdown / JSON 导出。**声明：尚未接入生产 Supabase `pocket_snapshots` 与师生认证端，绝不伪造云同步假象。**

---

## 二、全学科覆盖总览（11 学科 · 101 项登记）

| 学科 | 已完成 (L3 / L4) | 资料与待开发 (L0) | 领域分包文件 | 代表性 L4 旗舰 / 核心探究 |
| --- | --- | --- | --- | --- |
| 物理 | 20（力学 9 + 电光热 11） | 2 | `phy-mechanics.js`, `phy-electromag-optics.js` | 单摆世界线与 $T^2\text{–}l$ 回归、牛顿第二定律、动量守恒、电阻率游标/螺旋测微、电源电动势内阻 |
| 化学 | 12 | 8 | `chem-studio.js` | 酸碱中和滴定与缓冲突跃、粗盐提纯试剂次序检验、盐类水解热力学 pH、原电池能斯特方程 |
| 生物学 | 8 | 8 | `bio-studio.js` | 高倍显微镜与有丝分裂周期统计、叶绿体色素纸层析、酶活性可逆/不可逆失活、酵母菌血球计数 |
| 地理 | 5 | 4 | `geo-studio.js` | 海口 20°N 双直射太阳高度、海陆风热力环流探空、等高线任意剖面通视、热带海绵校园暴雨径流 |
| 数学 | 6 | 4 | `math-studio.js` | 丹德林双球与圆锥曲线统一定义、正方体截交极限、导数左右极限不可导拐点、高尔顿板正态收敛 |
| 信息技术 | 2 | 3 | `tech-it-studio.js` | 8 位补码溢出与点阵编码、五种排序输入敏感性与复杂度 |
| 通用技术 | 2 | 3 | `tech-it-studio.js` | 等面积矩形/空心/工字钢梁挠度对比、开环/P 静差/PI 闭环抗干扰 |
| 历史 | 2 | 2 | `humanities-studio.js` | 毕昇胶泥活字与《梦溪笔谈》技术经济临界点、中外双轨共时朝代年表 |
| 语文 | 2 | 2 | `humanities-studio.js` | 近体诗格律平仄与古入声字检视、亚里士多德三段论周延性与欧拉反例 |
| 英语 | 2 | 1 | `humanities-studio.js` | Reichenbach S–E–R 十二时态体貌时间轴、五大句型与长难句修饰剥离台 |
| 思想政治 | 2 | 1 | `humanities-studio.js` | 供求均衡与限价无谓损失、洛伦兹曲线与一次/再分配基尼系数 |
| **合计** | **63（L4: 9 · L3: 54）** | **38** | **8 个按需异步加载领域包** | **21/21 物理必做已覆盖；13/18 化学必做已实装（共 18 项登记）** |

---

## 三、目录结构

```text
experimentarium/
├── index.html                          # 单页书籍壳层与无障碍工具栏/模态层
├── sw.js                               # 离线缓存 Service Worker（纯静态资源渐进缓存）
├── css/experimentarium.css             # 书籍排版、纸张贴图、工作台分屏、记录册与移动端适配样式
├── data/curriculum-matrix.json         # 101 项课程覆盖矩阵与验收状态清单
├── js/
│   ├── core/
│   │   ├── app.js                      # 主应用编排、翻页物理、CSS3D-WebGL 混合同步、WebKit 检测
│   │   ├── book.js                     # 有物理厚度的 3D 翻页网格形变引擎
│   │   ├── stage.js                    # 线性光照空间 + 边缘描边后处理（墨线/轮廓）+ 3 空间模式镜头
│   │   ├── ink.js                      # 程序化实验器材与材质图元库
│   │   ├── print.js                    # DOM 排版与 Live Canvas 向 3D 纸面纹理印制桥接
│   │   ├── catalog.js                  # 覆盖矩阵解析与 8 领域包按需 dynamic import
│   │   ├── epistemic.js                # KIND 笔法常量、完全椭圆积分 ellipK、OLS 回归与卡方检验
│   │   ├── science-models.js           # 零 DOM 科学求解内核（RK4/质子守恒/水解/天文/力学/逻辑/经济）
│   │   ├── timeline.js / tape.js / scrub.js / handle.js  # Gen-3 世界线记录纸与可逆时间控制
│   │   ├── workbench.js                # 展开式二维高精度实验台与自动回归散点图引擎
│   │   ├── journal.js                  # 个人实验记录系统（IndexedDB/localStorage/Runs/Compare/Export）
│   │   ├── matrix-ui.js                # 实验目录筛选、101 项覆盖矩阵透视弹窗与教师备课抽屉
│   │   └── bridge.js                   # HAIZ 生态互通接口 window.HAIZExperimentarium 与 URL 启动参数
│   └── domains/                        # 8 个按需分包目录（共 63 项完整实验实现）
└── tests/
    ├── science-models.test.mjs         # 科学计算内核数值收敛性与守恒律单元测试
    ├── curriculum-and-contracts.test.mjs # 隔离性守卫、1:1 矩阵契约与版次诚实性测试
    ├── browser-acceptance.cjs          # Apple M5 GPU Chromium 全 63 页遍历与 30 个工作台深度测试
    ├── webkit-mobile-acceptance.cjs    # WebKit 桌面真翻页 + iPhone 竖屏 390×844 三页签交互测试
    └── capture-showcase.cjs            # 桌面/移动端交互展示视频 (MP4) 与关键帧采集脚本

docs/experimentarium/
├── README.md
├── ARCHITECTURE-AND-FRAMEWORK.md
├── CURRICULUM-AND-SCIENCE-BASIS.md
├── ACCEPTANCE-AND-TEST-REPORT.md
└── media/
    ├── experimentarium-desktop.mp4
    ├── experimentarium-mobile.mp4
    └── still-01..07-*.png
```
