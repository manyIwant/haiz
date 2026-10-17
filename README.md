# haiz.space · 校园正在发生

海南中学府城校区的非官方校园杂志与第一人称校园原型，由 manyIwant 创作。

**Still learning. Still making.**

## 本轮升级

- 新增 `architecture.html` 建筑观察手册：四处既有实拍、照片热点、现代/传统建筑筛选、与 3D 共用的程序材质预览，以及仅保存在本机的观察册。
- 新增墙砖、瓦面、石材与木构四类程序材质，绑定颜色、凹凸与粗糙度贴图，使用按模型单位投影的 UV。晨光、雨后、薄暮入口可直接传递地点与观察镜头设置。
- 本轮外网资料请求被网络代理拒绝；外观依据为上传版本已有照片，研究记录与边界见 `docs/material-field-guide-20261017.md`。

- 统一升级首页、学校、新闻、社团、校友、来访招生与关于本站，并新增“课间电台”。暖纸色、深绿、砖红与校园影像构成杂志视觉。
- 首页包含滚动视差、渐入排版、横向影像画廊、磁吸入口、社团悬停影像、照片灯箱与详情弹窗；支持减少动态效果偏好。
- 新闻档案支持分类与关键词搜索，保留原仓库日期及来源；没有原文链接的条目单独标为“来源待核”。
- 6种社团与活动均为清楚标记的**创作提案**；课间电台为**虚构微小说**，不涉及真实人物传闻。
- 收藏、个人课间选择和便笺仅存于当前浏览器；没有假报名、虚假投票人数或公开留言后端。
- 学校页校园手图直接读取原有 KML 转换数据，可选择地标并跳转到第一人称校园对应地点。
- 将本轮第一人称原型融合到 `campus-3d.html`：34个原有场景节点、约305棵树、室外校道、4栋教学楼首层与16间想象教室、576套桌椅、黑板、书本、灯具和吊扇。
- 新增扫描草地/铺装PBR、15张表面材质图、透明叶簇及HDR环境反射。植被与室内实例化，按距离隐藏细节，画质自动适配。
- 保留 `descent.html` 从地球到校园的电影入口，并衔接第一人称校门。

## 页面

| 页面 | 内容 |
| --- | --- |
| `index.html` | 校园杂志首页 |
| `about.html` | 学校历史、校园手图、地标 |
| `news.html` | 原仓库新闻档案、搜索与类别筛选 |
| `clubs.html` | 社团创作提案与活动墙 |
| `life.html` | 虚构小报、个人选择、本机便笺 |
| `alumni.html` | 原仓库校友资料与领域筛选 |
| `admissions.html` | 校园来访指引、官方招生信息入口 |
| `contact.html` | 创作者、来源、隐私、站点地图 |
| `campus-3d.html` | 第一人称校园及可步入教室 |
| `descent.html` | 电影式从地球到校园 |

## 运行与发布

这是无生产依赖、无强制构建步骤的静态网站；仓库根目录可直接用于 GitHub Pages。`CNAME` 保留 `haiz.space`。完整网站位于 `main` 分支，`probe` 为既有测试分支。

本地可通过普通静态服务器预览：

```bash
python3 -m http.server 8000
```

所有页面和运行资源均为相对路径，本地字体、Three.js、图片、材质及HDR随仓库提供，无运行时CDN依赖。

## 内容维护

- 杂志页面模板：`scripts/build-pages.mjs`
- 社团、小报与地点文案：`data/campus-journal.json`
- 既有报道/校友资料：`data/news.json`、`data/alumni.json`
- 既有原始空间数据：`data/buildings.json`
- 漫游数据：`assets/walk/campus.json`，保留原空间骨架及两个坐标锚点
- 全站交互与样式：`assets/js/journal.js`、`assets/css/journal.css`
- 第一人称交互、空间与室内：`assets/walk/`

修改文案或页面模板后运行：

```bash
node scripts/build-pages.mjs
```

## 检查

开发测试依赖仅用于验证，不参与网页运行：

```bash
npm install
npm test
npm run test:browser
```

检查包括10个页面的本地链接、锚点、图片说明与导航；新闻/社团筛选、照片与详情弹窗、本地保存、安全便笺渲染；原校园坐标、几何、材质解码、门洞、碰撞、16间教室往返路线；桌面与手机输入事件模拟。

`tests/*-results.json` 和 `tests/walk/*-results.json` 记录验证范围。`npm run test:browser` 使用 Playwright 与 Chromium 验证真实页面布局、交互和 WebGL 着色器，生成 `tests/browser-results.json` 和本地截图。本轮云端使用 SwiftShader 软件渲染，手机仅做视口模拟；未做硬件帧率与真实手机多点触控实测。浏览器可用 `CHROMIUM_PATH` 指定，缺少时需先安装 Chromium 或执行 `npx playwright install chromium`。

## 来源与边界

校园照片、历史资料与人物信息沿用原仓库的公开资料；版权归原作者和发布机构。未核实资料与创作内容均有标记。数字建筑、室内和尺寸是近似表达，非测绘或真实教室复刻。

材质与设计参考、生成叶簇的提示词和保存路径详见 [docs/design-notes.md](docs/design-notes.md)；素材清单与哈希见 [assets/walk/credits.json](assets/walk/credits.json)。
