# HAIZ · 从一棵榄仁树走进校园

> 一棵树，六幕连续的数字校园。

**HAIZ** 是学生独立创作的**海南中学府城校区非官方数字校园**。从一棵可生长的三维榄仁树出发，把校史、学生创作、校园地图和第一人称探索组织成一段连续的空间体验；项目也包含原创互动工具和 HAIZ Pocket 学生应用。

**[在线体验](https://haiz.space)** · [快速开始](START-HERE.md) · [设计共识](DESIGN.md) · [版权与素材边界](LICENSING.md) · [商业合作联系](COMMERCIAL-LICENSING.md)

**非官方声明：** HAIZ 不代表海南中学或学校的官方信息服务。校园模型根据公开影像与有限空间资料创作，是近似表达，不能替代测绘或现场验证；第三方影像与素材保留原作者权利。

## 六幕 · One Continuous World

| 幕 | 体验 | 状态 |
| --- | --- | --- |
| **01 · 初遇** | 冬末榄仁树、逐叶生长、空间摄影 | V4 视觉基础 |
| **02 · 根脉** | 沿树干和枝条观看校史、年代与历史影像 | 原型；史料来源和影像权利逐项核验 |
| **03 · 青春生长** | 进入树冠，沿真实枝叶探索学生创作 | 原型；开发样本明确标记为虚构，真实作品审核与公开发布未上线 |
| **04 · 场域** | 水下校园总平面显影，建筑从地块轮廓升起，进入三维校园 | 模型为近似建筑与空间表达 |
| **05 · 远方** | 从树冠望向校园，进入由第三人称转换至第一人称的电影 | 可逆的电影交互原型 |
| **06 · 回望** | 回望榄仁树，接续第一人称校园漫游 | 互动原型；真机性能仍需验证 |

六幕共享同一棵树、摄影机与空间状态，而非六段独立视频。入口是 [index.html](index.html)，核心代码在 [lanren/](lanren/)。

**创作过程与来源可追溯：** [原创成果档案](docs/provenance/README.md) 记录了榄仁树、根脉、作品树冠、校园地图、人物电影及外部素材的实现证据、版本 SHA 与待核版权事项。它是开发证据索引，**不是版权登记或所有权证明**。

**版本说明（2026-11-09）：** 当前 `main` 收录六幕基础整合；其后的美术精修仍在独立开发分支。开发分支中的录屏与效果不等于已发布到 `main` 或线上。

**连续性审查（2026-11-11，开发分支）：** [六幕是否发生在同一个地方的同一天](docs/haiz-continuity-audit-20261111.md)——证据、架构决定，以及一个可用 `?clock=1` 打开的「世界时钟」技术验证（真实海口日期与时刻驱动太阳；默认关闭，线上表现不变）。

## 更多作品与工具

- [校园杂志](journal.html)：校史、新闻档案、社团创作提案与校园生活。虚构内容及来源待核信息会标记。
- [第一人称校园](campus-3d.html)：道路、建筑、景观与想象教室。建筑细节并不承诺照片级或测绘精度。
- [共感暗房](darkroom.html)：影像显影、笔触转音乐、PNG 和 WAV 输出。
- [课间窗台](windowsill/)：独立 AGPL-3.0 代码模块，参见 [来源和许可](windowsill/SOURCE.md)。
- [HAIZ Pocket](app/README.md)：Flutter 学生应用与网页预览；安装包优先查看 [GitHub Releases](https://github.com/manyIwant/haiz/releases)。
- [独立账号后端](backend/README.md)：Node.js 24 + SQLite 的注册、数据及设备会话服务。**GitHub Pages 不能运行 Node 后端**；静态页面上线不代表服务端功能已部署。

## 本地运行

在仓库根目录使用静态服务器即可浏览站点：

```bash
git clone https://github.com/manyIwant/haiz.git
cd haiz
python3 -m http.server 8000
```

然后访问 <http://localhost:8000/>。三维体验需要支持 WebGL 的浏览器。若需要运行代码测试，可安装相应 Node.js 版本与 Playwright/Chromium 环境：

```bash
npm ci
npm test
npm run test:browser
```

Flutter、Node 后端和独立原型拥有各自的开发或构建流程；对应命令请参阅子项目文档与 [快速上手](START-HERE.md)。

## 仓库导航

| 路径 | 内容 |
| --- | --- |
| [lanren/](lanren/) | 六幕主页、校史、创作树冠、校园地图和人物电影 |
| [assets/walk/](assets/walk/) | 校园模型、场景及空间资源 |
| [backend/](backend/) | 独立账号与数据服务 |
| [app/](app/) | Flutter 应用源码 |
| [app-preview/](app-preview/)、[pocket/](pocket/) | 不同阶段的网页构建快照，不一定是最新源码 |
| [独立 HAIZ WORLD 原型](https://github.com/manyIwant/haiz-world-prototype) | 完整 Vite/React 校园图谱实验已迁往独立仓库，保留源码、模型、媒体和测试 |
| [docs/](docs/) | 技术、美术、来源与测试记录 |
| [tests/](tests/)、[.github/workflows/](.github/workflows/) | 测试与发布自动化 |

## 许可证、真实性与验证

**自有原创代码：** [PolyForm Noncommercial 1.0.0](LICENSE)，在[明确适用范围](LICENSING.md)内允许非商业学习、研究、修改与分发。超出该协议范围的商业使用须事先联系版权人，详见 [商业合作授权](COMMERCIAL-LICENSING.md)。这是 **source-available（源码可用）**，而不是 OSI 定义的开放商业使用的开源许可。

**原创美术：** 采用[逐项核实、明确标注的 CC BY-NC-SA 4.0 机制](ARTWORK-LICENSING.md)；未完成版权核验的现有素材**尚未自动获得**该许可。已有 AGPL、MIT、CC0、CC BY 等第三方许可保持不变，学生作品仍归创作者。完整说明请阅读 [LICENSING.md](LICENSING.md)。欢迎按 [CONTRIBUTING.md](CONTRIBUTING.md) 参与共创。

软件渲染截图、模拟手机视口和 Node 测试不能代替真实设备 GPU、Safari 或完整生产环境的验收。创作设定、近似模型与实证资料应当明确区分。

## 维护与历史

仓库体积、PR、分支及发布产物的治理建议详见 [仓库维护记录](docs/REPOSITORY-GOVERNANCE-20261109.md)。整改前的完整 README 已保存在 [历史开发日志](docs/README-ARCHIVE-20261109.md)，以免丢失已有技术说明。

---

*Still learning. Still making.*
