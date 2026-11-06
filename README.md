# haiz.space · 校园正在发生

## 网站账号与独立后端

正式登录沿用既有灯光 `/login/` 页面；`/account/` 只承担登录后的数据管理。新增 Node 24 后端，支持：普通用户注册登录、便签/收藏/偏好管理与导出、密码及设备会话管理。Node 服务对网站 HTML 执行登录门禁，个人数据按服务端账号隔离，旧页面也有跨标签账号与本地存储隔离保护。运行 `npm run backend:dev` 可本机验收，生产部署见 [后端说明](backend/README.md)；测试使用 `npm run test:backend`。

本次是代码发布：GitHub Pages 不运行 Node+SQLite，公网登录门禁须部署 Node+Caddy 后生效。原 Flutter Pocket 的 Supabase、Academic 服务和已发行安装包保持独立，不能把此提交视为这些产品已完成公网部署或升级。

海南中学府城校区的非官方校园杂志与第一人称校园原型，由 manyIwant 创作。

**Still learning. Still making.**

## HAIZ 物理实验室 · Every Joule 原版与原创练习

- [打开 Every Joule 原版入口](physics-lab.html)（由作者网站实时加载到跨站 iframe；若浏览器或作者网站禁止嵌入，可点击页面上的「在作者官网打开完整原版」）
- [打开 HAIZ 自制十课简化练习](physics-lab-practice.html)（独立实现、简化参数计算，具有进度记录）
- **作品与版权归属：** Every Joule © 2026 Techartist；原作者官网 <https://iamtechartist.com/Apps/every-joule/>。HAIZ 不托管、不下载、不修改原作者的课程代码、3D 模型或音效，iframe 内的资源来自原作者网站。嵌入效果受作者站点的 CSP/X-Frame-Options 和浏览器第三方内容限制影响。
- 原版十课的具体内容以作者网站实际发布为准，需要 WebGL 图形加速；网站直达不意味着 HAIZ 获得再分发许可。

## HAIZ Pocket · 移动端预览

- [打开可交互的手机网页预览](https://haiz.space/app-preview/inspect.html)（与 Flutter Android 工程共享业务 UI，网页为兼容玻璃效果）
- [Flutter App 源码与运行说明](app/README.md)
- [下载 Android ARM64 光学玻璃 v2 预览 APK](releases/android/haiz-pocket-v1.4-optical-v2-arm64.apk)（`1.4.0-preview.4+8`）
- [消息接入的隐私和权限说明](docs/authorized-message-intake-20261029.md)

此处为开发预览版，并非学校官方 App；Android 自动收件必须由本人启用且授权，完整 QA 和实机性能测试尚未通过，不宣称稳定商用。


## 主页：会生长的榄仁树

`index.html` 是一棵会生长的大叶榄仁，按九宫格视觉参考重构为六个连续的电影镜头：远景初遇、贴近树干仰望、逆光新叶微距、树冠上方俯瞰、透过树冠远眺、全盛远景。每个镜头打开 HAIZ 的一个真实板块（校园探索、档案、地图与来访、杂志与创作、工具与全部入口）。滚动推动同一个相机，同时树从冬末满树红叶到红叶飘落、抽梢、展叶，直到枝繁叶茂。树在 Blender 中程序化生成（主枝美术设定 + 空间殖民细枝），是依物种特征创作的概念模型（非测绘）；生长是逐顶点、逐叶片的结构变化；滚动由 GSAP ScrollTrigger 驱动。原降落镜头保留在 `descent.html`，杂志首页在 `journal.html`。设计、技术、参考对照截图与验证见 [主页 v3](docs/lanren-homepage-v3-20261104.md)；之后的视觉深化（叶片、树形、依实拍重建的太湖石、各板块从树出发的转场、手机构图）见 [主页 V4](docs/lanren-homepage-v4-20261104.md)。

第四幕（俯瞰树冠）停留片刻，树下的水面会从水下显影成真实坐标的校园平面：以百年榄仁树为原点、1 米即 1 米，可缩放、平移、切换正俯视、点选地点并进入第一人称漫游，再沿原路沉回水面、继续第五幕——同一个渲染器、同一棵树，页面不重新加载。设计、坐标、控制权与验证见 [第四幕 · 水面之下的校园](docs/lanren-campus-map-20261105.md)（原型，待视觉验收；代码在 `lanren/map/`）。总平面上点「展开为三维」，每栋建筑从自己的占地轮廓里完整升起为体量，材质从榄仁树向外恢复，可旋转、选择建筑、单栋逐层剖切、再收回总平面：见 [第四幕 · 从校园总平面到三维校园](docs/lanren-campus-unfold-20261106.md)（第一阶段原型，`claude/vibrant-wozniak-rsrttr`）。

## 本轮升级

- 第二轮航拍核对补两排球场之间的树荫带、六处解释性树池及通道，三处地图共享田径场轮廓，修正足球场禁区和起跑线方向。阵雨改为屋顶空间索引与雨线列缓存，保留全部雨丝、阴影与分辨率；原算法雨线逐字节及实际画面一致性通过检查。详见 [运动区补全与阵雨性能](docs/aerial-median-rain-20261020.md)。
- 核对网上公开的府城校区俯视影像，纠正六片篮球场占地，补立体篮架、篮网和相邻硬地排球区；排球场细分数量明确标为推演。漫游、导演台、学校页地图同步更新，小地图增加保留分辨率的静态缓存，球场构件合批，保持点击后才加载校园。来源、限制和验证见 [航拍核对与地图性能](docs/aerial-map-performance-20261020.md)。
- 艺术中心继续按既有实拍细化：收窄并抬高入口门廊，门厅改为真实内退体积，补门框、拉手和平台栏杆；棕榈改为三层叶冠，新增 48 簇小叶灌木及种植床纹理。叶片采用索引网格减少重复顶点，保留按需加载，无新增外部资源请求。详见 [门厅与植物形态记录](docs/entrance-foliage-20261020.md)。
- 新增 [课间窗台](windowsill/index.html)：实际整合 TangfanOVO/qiaosi 的三维窗台、四件精修 glTF 家具与声音可视化，改为校园主题的六件可用工具：本机便签、专注时钟、未来书信、真实本机声音、原创小书、灵感罐。手机/电脑均可使用，3D 按需加载，声音默认关闭；WebGL 不可用时纸面功能仍完整。该独立应用保留 AGPL-3.0 完整对应源码与第三方许可，不重新授权原有校园照片，见 [原作、源码与许可](windowsill/SOURCE.md)。
- 校园气候新增可分别调节的云量、阵雨、地面湿度：单层解析云、云雨联动光照和远景雾、原扫描铺装上的非均匀 GGX 湿润、雨量联动水面、室内与屋顶足迹雨丝抑制；兼容原三种气候与分享链接。研究过程与技术边界见 [窗台与气候迭代记录](docs/windowsill-climate-20261018.md)。
- 新增 [共感暗房](darkroom.html)：在真实校园照片上显影，将自己的笔触译成八拍音乐，编辑四个合成声部，生成可在另一台手机/电脑继续改编的链接，并导出完整画幅 PNG 与 WAV。支持键盘、减少动态效果、无音频及存储受限回退；不冒充现场录音或实时联机。交互研究与边界见 [创作迭代说明](docs/creative-darkroom-20261018.md)。
- 按用户指定的 `VoltAgent/awesome-design-md` 实际读取 Oura 与 Linear 分析，新增本项目 [DESIGN.md](DESIGN.md)：摄影优先的暖纸阅读层、克制的深色三维工具层、章节导航与有限时长动效，支持减少动态效果。
- 不止贴图：凤栖堂改为真正的双层曲面屋顶、瓦端、细柱梁枋和内退木格窗；图书馆新增金属圆顶、弧窗、连续外廊和大台阶；教学楼增加窗洞层次，校正入口坡顶。
- 通过 GitHub 获取并核对 Poly Haven / DGG 开源盆栽，保留真实网格及 PBR/透明叶片；最多三个近景实例，按距离隐藏、低画质回退。原作者、CC0 / CC BY 4.0、修改内容及哈希详见 [素材署名](assets/walk/models/NOTICE.md)。
- 新增实拍对照工具（`R` 或暂停面板），分开展示真实照片与模型细化说明，并能切回安全观察机位。建筑仍是照片推演，不承诺照片级或测绘精度。细节见 [本轮研究与验收](docs/architectural-fidelity-20261018.md)。
- 新增 `director.html` 探索导演台：三条路线灵感、10 个模型地点、最多 6 站自由重排、光照选择及可分享路线。进入 3D 后按模型碰撞规划真实连续步行，随时操作接管。
- 摄影模式新增本机机位收藏（最多 8 个），保存位置、朝向、镜头与气候；从导演台恢复构图或移除记录。不会保存截图或上传记录。
- 绿瓦新增 1024×1024 原创生成釉面颜色层，配合程序法线、粗糙度、物理釉层及雨后响应；红瓦保留独立配色。生成素材不是学校实拍或扫描。详见 [导演台与釉面说明](docs/exploration-studio-20261018.md)。
- `index.html` 现在直接呈现 `descent.html` 的地球降落体验；原杂志首页保留为 `journal.html`。无需跳转，无生产构建依赖，静态托管根地址即可使用。
- 全站探索台（`Ctrl/⌘ K` 或 `/`）：搜索页面与地标、随机漫游、本机探索足迹、可选的合成风声/雨声和课铃。声音默认关闭。
- 新增校园摄影模式（`P`）：调节镜头与光照、下载带地点说明的 PNG 明信片、复制地点入口。
- 材质升级为 512×512 的颜色、法线、高度和粗糙度图，结合釉层与雨后湿润响应；新增可拖动的 3D 材质球/铺装板，支持湿度、密度与光照调节。
- 树叶与对应阴影使用同步微风位移，轻量画质和减少动态效果模式会关闭摆动。详情见 `docs/immersive-experience-20261017.md`。

- 新增 `architecture.html` 建筑观察手册：四处既有实拍、照片热点、现代/传统建筑筛选、与 3D 共用的程序材质预览，以及仅保存在本机的观察册。
- 新增墙砖、瓦面、石材与木构四类程序材质，绑定颜色、凹凸与粗糙度贴图，使用按模型单位投影的 UV。晨光、雨后、薄暮入口可直接传递地点与观察镜头设置。
- 官网与外部扫描材质下载仍受代理 403 限制；GitHub 设计库和开源模型读取成功。外观依据为上传版本已有照片，研究记录与边界见 `docs/material-field-guide-20261017.md` 及最新细化文档。

- 统一升级首页、学校、新闻、社团、校友、来访招生与关于本站，并新增“课间电台”。暖纸色、深绿、砖红与校园影像构成杂志视觉。
- 首页包含滚动视差、渐入排版、横向影像画廊、磁吸入口、社团悬停影像、照片灯箱与详情弹窗；支持减少动态效果偏好。
- 新闻档案支持分类与关键词搜索，保留原仓库日期及来源；没有原文链接的条目单独标为“来源待核”。
- 6种社团与活动均为清楚标记的**创作提案**；课间电台为**虚构微小说**，不涉及真实人物传闻。
- 收藏、个人课间选择和便笺仅存于当前浏览器；没有假报名、虚假投票人数或公开留言后端。
- 学校页校园手图直接读取原有 KML 转换数据，可选择地标并跳转到第一人称校园对应地点。
- 将本轮第一人称原型融合到 `campus-3d.html`：34个原有场景节点、约301棵树、室外校道、4栋教学楼首层与16间想象教室、576套桌椅、黑板、书本、灯具和吊扇。
- 新增扫描草地/铺装PBR、15张表面材质图、透明叶簇及HDR环境反射。植被与室内实例化，按距离隐藏细节，画质自动适配。
- 保留 `descent.html` 从地球到校园的电影入口，并衔接第一人称校门。

## 页面

| 页面 | 内容 |
| --- | --- |
| `index.html` | 默认首页：会生长的榄仁树，绕树一圈进入全站（由 `scripts/lanren/build-home.mjs` 生成） |
| `descent.html` | 原首页：从地球到校园的降落镜头 |
| `journal.html` | 原校园杂志首页 |
| `architecture.html` | 实拍观察手册与互动 3D 材质实验室 |
| `director.html` | 自选路线、校园平面图及本机取景集 |
| `darkroom.html` | 手势显影、笔触转音乐、八拍编曲、跨设备作品接力及 PNG/WAV 导出 |
| `windowsill/index.html` | 独立 AGPL 课间窗台：可互动书桌、便签、计时、信件、本机声音画布与原创小书 |
| `memory-walk.html` | 树荫档案与轻量阅读 |
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

这是无生产依赖、无强制构建步骤的静态网站；仓库根目录可直接用于 GitHub Pages。`CNAME` 保留 `haiz.space`。本轮按用户要求以 `main` 作为发布分支；`feat/campus-materials-20261017` 保留前序开发历史，`probe` 为既有测试分支。Git 推送成功不等于 Pages 已完成部署，发布目录仍需由仓库的 Pages 配置确定。

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
- 航拍核对与运动区配置：`data/campus-sports.json`；场地几何和地图缓存在 `assets/walk/sports.js`、`assets/walk/map.js`
- 全站交互与样式：`assets/js/journal.js`、`assets/css/journal.css`，探索台与转场在 `assets/js/experience.js`、`assets/css/experience.css`
- 主页（榄仁树）：`index.html`、`lanren/`；树与纹理的生成脚本在 `scripts/lanren/`
- 共享资源注入：`scripts/build-experience.cjs`（不再改写 `index.html`）
- 第一人称交互、空间与室内：`assets/walk/`
- 路线与机位：`assets/walk/journey-core.js`、`assets/walk/view-store.js`；导演台界面 `assets/js/director.js`
- 云雨与湿润：`assets/walk/climate.js`；保持原有 Three r128 与晨光/雨后/薄暮标识
- 独立窗台：`windowsill/`，场景首选修改源码在 `windowsill/scene/src/`，独立使用本地 Three r170；不要将 AGPL 代码直接导入旧主站后忽略其许可义务

修改文案或页面模板后运行：

```bash
npm run build
```

## 检查

开发测试依赖仅用于验证，不参与网页运行：

```bash
npm install
npm test
npm run test:browser
npm run test:atelier
npm run test:darkroom
npm run test:windowsill
npm run test:climate
npm run test:landscape
npm run test:performance
npm run test:loading
npm run test:forecourt
npm run test:map
npm run test:rain-performance
```

检查包括15个页面的本地链接、锚点、图片说明与导航；根入口与电影源一致；新闻/社团筛选、照片与详情弹窗、本地保存、安全便笺渲染；50 项路线排序与机位数据检查、1024 组暗房声部分享往返；原校园坐标、几何、材质解码、门洞、碰撞、16间教室往返路线、自选四站建筑路线；桌面与手机输入事件模拟。真实浏览器另外验证降落首页、探索搜索、声景开关、3D 材质实验、生成釉面、湿度响应、明信片下载、机位重载与导演台路线启动。暗房单独验证原始触摸事件、笔触转音符、跨设备接力、实际 PNG/WAV 文件、无障碍及音频停止。

`tests/*-results.json` 和 `tests/walk/*-results.json` 记录验证范围。`npm run test:browser` 使用 Playwright 与 Chromium 验证真实页面布局、交互和 WebGL 着色器，生成 `tests/browser-results.json` 和本地截图。本轮云端使用 SwiftShader 软件渲染，手机仅做视口模拟；未做硬件帧率与真实手机多点触控实测。浏览器可用 `CHROMIUM_PATH` 指定，缺少时需先安装 Chromium 或执行 `npx playwright install chromium`。

新增测试核对窗台上游文件 SHA-256、两级真实 WAV 的响度差、TXT 下载、截止时间计时、清除后的页面离开行为、320/390/768 像素布局、触摸事件、四件家具、精细后处理、没有 WebGL 的回退，以及真实气候着色器和有上限的雨丝。`npm run capture:windowsill` 另外从实际精细场景重建 `windowsill/scene-preview.jpg`；不会从照片伪造三维截图。

## 来源与边界

校园照片、历史资料与人物信息沿用原仓库的公开资料；版权归原作者和发布机构。未核实资料与创作内容均有标记。数字建筑、室内和尺寸是近似表达，非测绘或真实教室复刻。

材质与设计参考、生成叶簇的提示词和保存路径详见 [docs/design-notes.md](docs/design-notes.md)；素材清单与哈希见 [assets/walk/credits.json](assets/walk/credits.json)。

砚池石材的 Blender 源生成器为 `scripts/build-landscape.py`。使用 Blender 4.3.2、Noto Serif CJK 字体执行 `blender -b -t 4 --python scripts/build-landscape.py`，可重建网页 GLB、哈希清单及本地可编辑的 `build/landscape/haiz-limestone.blend`。构建网站不需要运行 Blender。石岸分级细节、羽状椰叶、科学馆外廊和手机实拍对照见 [本轮画面记录](docs/landscape-fidelity-20261019.md)。

开场影像准备好即可播放，点击开始后才加载校园，盆栽在靠近后加载；已按用户反馈撤销阻塞式全量预热。低帧率不再自动降低分辨率。艺术中心实拍构件、静态缓存、索引合批及精确碰撞加速的实现与验证边界见 [保真性能记录](docs/fidelity-performance-20261019.md)。

艺术中心素白立面、灰石阶、暖色红边广场及热带种植层次见 [前景修正与加载回退](docs/forecourt-fidelity-20261019.md)。
