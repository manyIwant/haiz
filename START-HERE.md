# HAIZ · 快速开始

欢迎来到 HAIZ：一个从榄仁树出发的海南中学府城校区**非官方**数字校园创作项目。

**无需安装应用：[打开 haiz.space](https://haiz.space)**。网站包含交互式校园杂志、六幕三维树与地图，以及独立的数字创作工具。

## 第一次来，建议这样看

1. 打开 [首页](https://haiz.space)；滚动进入 01–06 幕。六幕共用同一棵树和连续空间，并非独立视频。
2. 在 02 幕观看树干上的校史；在 03 幕探索树冠中的作品叶位。演示作品属于**明确标注的虚构开发样本**，不代表真实学生投稿。
3. 04 幕可以查看校园总平面与三维建筑；05–06 幕进入人物电影，再通过交互进入校园漫游。
4. 继续浏览 [校园杂志](journal.html)、[共感暗房](darkroom.html) 和 [独立课间窗台](windowsill/)。

**版本提醒：** 2026-11-09 的 `main` 有六幕基础整合；正在精修的美术分支可能包含还没有进入主分支、也没有发布上线的画面。网站的建筑为近似创作模型，不是官方测绘或校园实景替代。

## 在本机运行静态网站

```bash
git clone https://github.com/manyIwant/haiz.git
cd haiz
python3 -m http.server 8000
```

打开 <http://localhost:8000/>。建议使用支持 WebGL 的现代桌面浏览器；省电设备、软件渲染和手机实际表现可能不同。第一次打开 3D 时可能需要加载本地模型与纹理。

站点无需强制编译步骤；但 `lanren/` 的部分静态输出由脚本生成，修改源码时按相关设计文档和 `package.json` 的命令构建、验证。

## 运行开发测试

```bash
npm ci
npm test
npm run test:browser
```

浏览器测试需要 Playwright/Chromium 环境。构建和测试通过不等于硬件设备、Safari、真实账号生产环境都已经验收。

## 不同子项目的入口

| 项目 | 文档 / 页面 | 注意事项 |
| --- | --- | --- |
| 六幕树与校园 | [README](README.md) · [lanren/](lanren/) | 共享空间与相机；主分支和美术分支版本不同 |
| 独立 Node 后端 | [backend/README](backend/README.md) | GitHub Pages **不能运行** Node + SQLite 登录服务；公开站点不等于服务端已经上线 |
| Flutter Pocket | [app/README](app/README.md) | 安卓安装包见 [GitHub Releases](https://github.com/manyIwant/haiz/releases)，不要误装过时预览版 |
| 课间窗台 | [windowsill/SOURCE](windowsill/SOURCE.md) | 独立 AGPL-3.0 应用，与其他页面不同许可范围 |
| 技术与美术记录 | [docs/](docs/) · [DESIGN.md](DESIGN.md) | 先阅读当前设计，旧实施进度可能过时 |

## 权利、真实性与安全边界

HAIZ 不是学校的官方平台；学校照片、历史资料、外部模型、字体和原创代码有不同的权利声明，详见 [LICENSING.md](LICENSING.md)。创建真实学生作品时，应先满足作者授权、审核与隐私保护要求。

如果只是来体验校园，请从 [网站首页](https://haiz.space) 开始；如果准备协作开发，请先检查 `main`、目前的开发分支和 [仓库治理记录](docs/REPOSITORY-GOVERNANCE-20261109.md)，不要覆盖正在精修的六幕。

