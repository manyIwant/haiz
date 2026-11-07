# HAIZ · 一座连续的世界 —— 第一阶段工程交接

写给下一位对本项目没有任何上下文的开发者（Claude 或人）。读完本文即可继续开发第五幕、第六幕和第一人称漫游。更精炼的开场材料见 `docs/HAIZ-WORLD-NEXT-SESSION.md`。

## 0. 仓库与状态

| | |
|---|---|
| 仓库 | https://github.com/manyIwant/haiz |
| 工作分支 | `claude/vibrant-wozniak-rsrttr`（远端同名） |
| 第一阶段代码提交 | `3ab9f4e` feat(map): chapter 04 — the site plan unfolds into the campus in 3D |
| 其父提交 | `787b7d3` Merge continuous spatial world into main（V4 + 第四幕水面地图，这一提交只在本分支上） |
| 本文所在提交 | 在 `3ab9f4e` 之上只追加文档（见 `git log`） |
| 工作区 | 写本文时除新增的两份文档外无未提交修改 |
| `main` | **远端 `origin/main` 停在 `1fb630c`（2026-11-01，Pocket 1.5.5），不含 `lanren/`（V4 主页）与任何第四幕代码。** 没有合并或推送过 `main`；是否合并由用户决定 |

注意：`tests/*-results.json` 是测试运行时重写的记录，每次运行会因耗时数字变化而产生无意义改动，提交前请 `git checkout` 还原，或确认确实要更新。

## 1. 第一阶段实现了什么

在 V4 榄仁树主页的第四幕（`lanren/`）上，完成「校园总平面 → 三维校园」的真实转换，同一个渲染器、同一棵树、同一台相机、同一套坐标：

1. **保留**：V4 第四幕斜俯瞰机位（俯角 73.5°、镜头 50°，手机用 V4 自己的竖屏构图）、水面显影、榄仁树为原点（1 m = 1 m）、缩放/平移/正俯视、地点详情与项目资料、关闭后恢复树与机位、浏览器历史、六幕滚动。
2. **新增 展开为三维**（`.cmap-unfold` 按钮、`U` 键）：建筑从各自占地轮廓里作为**完整体量**（外墙+屋顶）升起；相机先收窄到长焦近正俯视再张开成三分之四视角；材质前沿从榄仁树根向外，白卡 → 真实材质 + 阳光 + 校园自己的阴影 + 校园地面 + 300 棵校园树。可逆（`U`/`Esc`/后退/按钮）。
3. **三维交互**：拖动旋转、右键/Shift/双指平移、滚轮/捏合缩放、`Q`/`E` 转向、点「北」回北、点选建筑（遮挡感知的三分之四视角）、地点名标在屋顶上方并避开被遮挡者。
4. **单栋剖切（可选）**：地点详情「楼层剖切」只剖所选的一栋（楼面上 1.2 m），三维与总平面状态都可用；室内为推演并在界面标明。
5. **历史/深链接**：`#map/oblique|top`（总平面）→ `#map/3d` → `#map/3d/<地点>`；刷新或从漫游页返回恢复状态。
6. **离开**：已展开时「返回树冠」「继续 · 05」先收回总平面再让水面合拢，第五幕与 V4 原样。
7. 减少动态效果：整个变化压缩到 0.7 s。三维模型加载失败时自动退回上一轮的总平面。

## 2. 与原 DESIGN.md 相比的调整及原因

- **1.2 m 水平剖切不是校园总平面的表达方式（重要）。** 原提示词借鉴 Casa Serra 的「约 1.2 m 水平剖切」。我最初把它机械地用在整座校园（每栋楼在楼面上 1.2 m 剖开），结果第二阶段露出教室隔墙、内走廊和楼梯，第三阶段是「掀开屋顶的教学楼」。用户指出：**Casa Serra 的 1.2 m 剖切是为了展示单栋住宅的室内平面图；HAIZ 第四幕展示整座校园，需要的是总平面（Site Plan），不是楼层平面（Floor Plan）。** 已修正为：
  - 二维 = 总平面（占地、道路、绿地、操场、水体、树冠），三维模型此阶段不绘制；
  - 二维→三维 = 每栋楼从自己的轮廓里**完整**升起，从不出现被剖开的楼层；
  - 借鉴的是「同一套几何 + 长焦即平面 + 镜头张开恢复深度 + 前沿扩张换材质」这些**空间思想**，不是 1.2 m 这个数字；
  - 1.2 m 剖切降级为**单栋建筑的可选探索**。
  - **第二阶段不要把 1.2 m 重新当成校园默认表达。** 未来任何「剖」都只针对单栋。
- 「平面」不再带建筑投影短影：升起的体量有真实光照；总平面状态下 `uBldShadowK` 仍给出制图式短影（`layer.js`）。
- 白模阶段用不计算光照的墨线材质（`inkMaterial`），前沿开始后才切换受光材质：为了总平面状态下零光照开销。
- 校园模型用 r170（`lanren/vendor/three`）程序生成，**没有**复用漫游的 r128 全局脚本建模（`assets/walk/world.js`），原因见 §8；但立面事实（外廊、门廊、圆顶、北门等）沿用漫游已按实拍校正的结论。
- 未做、仍按设计待办：04→05 的连续三维、05→06 电影、漫游、手机横屏、双层地图。

## 3. 关键源码与依赖

```
lanren/js/chapters.js   V4 六幕数据：KEYS（相机关键帧）、LIGHT、GROW、poseAt(p)  ← 一字未改
lanren/js/camera.js     DwellCamera：rail 驱动 + 拖动环顾 + push 转场          ← 未改
lanren/js/scene.js      渲染器、阳光/PCSS 阴影、水面、后期链、岛屿heightAt      ← 未改
lanren/js/home.js       主循环 step()、ScrollTrigger→state.p、七处 map?.… 挂钩  ← 本阶段未改
lanren/map/geo.js       坐标系(plan/campus/world)、features、places、到达场      ← 小改：tree.h、返回 campus
lanren/map/layer.js     水面着色器 hzCampus()（总平面绘制）、显影、调色反演     ← 重构：导出 campusGLSL 供三维地面复用
lanren/map/campus3d.js  NEW 纯函数：campus.json → 26 栋建筑封闭实体（打包数组）
lanren/map/section.js   NEW 三维层：材质、per-building lift/cut、阴影、地面、树、拾取
lanren/map/unfold.js    NEW 纯函数：进度 u 的时间线（相机/升起/前沿/标签）
lanren/map/view.js      地图相机数学 d = s/tan(fov/2)（minScale/clampScale 增加 eyeMin 参数）
lanren/map/map.js       状态机、输入、历史、unfold/fold、聚焦、楼层剖切、api
lanren/map/ui.js        DOM：标注、详情、楼层行、提示
lanren/map/map.css      样式（含手机）
lanren/map/hash.js      #map/<oblique|top|3d>/<id>
assets/walk/campus.json 权威空间数据（34 建筑/11 路/300 树/2 球场区），原 KML 缺失，未独立复核
```

依赖方向：`home.js → map.js → {geo, layer, section, unfold, view, ui, hash}`；`section.js → {campus3d, layer(导出的 GLSL), tone, geo}`；`campus3d.js → geo.rectCampus`；`unfold.js → view.mixView`。`campus3d.js`、`unfold.js`、`geo.js`、`view.js`、`hash.js` 无 three.js，Node 可测。

`home.js` 里与地图有关的挂钩（第四幕以外无效果）：`map?.tick/light/post/camera/overlay`，`?nomap` 可整体关闭。

## 4. 坐标、场景对象、相机、渲染状态、数据

**三个坐标系**（`geo.js` 头部注释有完整说明）：
- plan：校园平面图像素；
- campus：校园本地米，`x=(px−900)·0.167, z=−(py−784)·0.167`，**−Z 指向北门，不是真北**（`meta.orientation`，绝对方向未复核）；
- world：V4 场景（Y 向上）。**榄仁树根 = 原点**；百年榄仁树占地矩形中心 campus (49.098, −78.098) 放在 world (0,0)；只平移（`ROTATION = 0`）；水面/校园地面 `y = −0.85`（`GROUND_Y`，等于 V4 `WATER`）。`makeFrame()` 提供 `toWorld/toCampus`，有往返测试。

**场景对象**（均加在 V4 `world.scene` 里）：
- `campus-section` 组：`campus-buildings`（一个 Mesh，约 24.4 万三角形，13 MB 的类型化数组，打开页面约 0.3–0.5 s 在主线程生成）、`campus-ground`（PlaneGeometry 覆盖 620×580 校园纸面，y=−0.83，`renderOrder −6`）、两个 InstancedMesh（300 棵校园树，阔叶/棕榈）。
- 另有只含建筑与树的 `shadowScene` + 正交 `shadowCam` + 2048²（高画质 4096²）深度纹理，作为**校园自己的阴影贴图**（不改 V4 的 PCSS）。
- 每栋楼的元数据 `section.buildings[i]`：`id, group, form, index, cx, cz, w, d, rot, base, top, height, floors, floorH, levels[], bands[]`。
- 建筑顶点属性：`position(f32) normal(i8) aEdge(u8×4 描线用) aInfo(u8×2: 材质id, 楼号)`；材质表见 `campus3d.js MATERIALS`。

**着色器状态**（`section.js`）：`uLift[26]`（每栋楼向下平移量，≤0；整体在 `GROUND_Y` 以下被丢弃）、`uCut[26]`（楼自身坐标系里的剖切高度，≥ top+1 表示完整）、`uSweepC/R/W/Glow`（材质前沿，圆心在树根）、`uFlag[26]`（悬停 1/选中 2）。`CLIP`：`vHYo > vCutY || vHW.y < GROUND_Y − 0.01 → discard`。剖到的实体用背面涂黑（poché），因此所有构件都是封闭实体（测试验证）。

**相机**：`view = {tx,tz,s,pitch,yaw,fov,auth}`，目标点在地面，`s`=目标处画幅半高，距离 `d = s/tan(fov/2)`（镜头变化不改变目标处地面比例）；`View.applyView()` 写入 V4 的 three 相机，`DwellCamera.fovFor/applyShift` 处理竖屏。地图期间 `cam.enabled=false`，`map.js cameraHook` 返回 `true` 接管；`handBack()` 把 `cur` 写回 `cam.s` 交还 V4。

**渲染状态机**（`map.js`，`S.mode`）：`tree → reveal → map → leave → tree`（+`cancel`）。三维是 `map` 内的 `S.u∈[0,1]` 与 `S.trans`（`{dir, path, u0, t0, dur, then}`）。`S.u>0` 时才绘制三维层；`S.mode!=='map'` 时 tick 会把 `S.u` 清零（见 §7 与 §10 对第二阶段的影响）。

**地图数据**：`assets/walk/campus.json`（几何与文字，权威）、`data/buildings.json`（项目照片与出处）。47 个绘制要素（34 建筑/园林/水体、11 校道、2 球场区）由 `geo.buildFeatures` 生成，同一批要素既画总平面又生成三维体量（测试断言 18 栋位置/尺寸/旋转差 < 1e-9 m；连廊与男生宿舍三翼被裁剪在各自矩形内以避免实体重叠）。

## 5. 从二维到三维的转换机制

一个进度值 `u`（`unfold.js`）驱动三件事，所有视觉量都是 `u` 的纯函数，所以倒放是同一条路径：
1. `cameraAt(path,u)`：`A`（当前总平面机位）→ `M`（整张总平面：长焦 26°、俯角 86°）→ `B`（三分之四：36°、37°、yaw 34°，从西北越过树看教学楼）。相机由 `mixView` 两段缓动混合。
2. `riseAt(u, order)`：每栋楼 `order`（水面到达场归一化顺序，近树先）→ 升起量；`map.js cutsNow()` 写入 `section.setLifts`（升起，带 smoothstep）与 `setCuts`（仅所选单栋的楼层剖切，且避开楼板 `clearOfBands`）。
3. `sweepAt(u)`：前沿半径 = `f · sweepMax`，`glow` 控制暖金色接缝；`section.update()` 在 `sweepR>0.5` 时由墨线材质切换为受光材质，`sweepR>1` 时显示地面与树，并按需重绘校园阴影。
展开中途收回会沿原路径返回（`startTrans` 保存 `path`）；从自己转过的视角收回用 `foldPath()`（回到正下方同一片地面的总平面）。

## 6. 第四幕 → 第五幕：需要保留/交接的状态

当前实现：已展开时「继续 · 05」= `exitMap({then: goTo(4)})` → 先 `fold`（~2.7 s）→ 水面合拢 → `handBack()` → V4 滚到第五幕。第五幕与 V4 **完全一致且没有三维校园**（测试断言：`section.group.visible=false`、`uReveal=0`）。

要做「已展开则不再压回」，需要交接的状态：`S.u`、材质前沿（`sweepR`）、`GROUND_Y` 以上的地面/树/建筑可见性、校园阴影、树的 `uGrow=0.70→0.86` 随滚动变化、被选中的地点 `S.selected`（设计要求可作漫游目的地）、`cur` 相机、`state.p` 与 `scrollY`（`S.lockY`）、浏览器历史条目、第四幕的 `inert/touch-action` 设置（`takeCamera/handBack`）。当前这些都封装在 `map.js` 闭包里，没有导出为可被第五幕读取的对象——第二阶段需要抽出一个「世界状态」对象（见 §10）。

## 7. 测试、截图与复现

均在本机 Chromium + SwiftShader（软件渲染，约 1 帧/秒）上运行：

```bash
node tests/campus-model.cjs            # 6 组：同源/封闭实体/层数高度/剖切跨层/时间线（秒级）
node tests/campus-map.cjs              # 上一轮：坐标、显影、相机数学
node tests/lanren.cjs                  # V4 六幕、生长、光
node tests/campus-unfold-browser.cjs   # 11 项真实输入（约 25 分钟）
node tests/campus-map-browser.cjs      # 上一轮 17 项（约 10 分钟）
```

**最终结果（`3ab9f4e` 的代码）**：`campus-model` 6/6；`campus-unfold-browser` 11/11（无页面或 WebGL 报错）；`campus-map-browser` 17/17；`campus-map`、`lanren`、`open-assets` 通过。结果文本在 `tests/campus-unfold-browser-results.json`、`tests/campus-model-results.json`、`tests/campus-map-browser-results.json`。`tests/site.cjs` 需要 `linkedom`（本容器未装，装锁定依赖会替换预装 Playwright 浏览器），**未运行**，与本阶段无关。

截图（真实渲染）：`docs/lanren/unfold/{stages,compare,interact,phone}.jpg`；说明文档 `docs/lanren-campus-unfold-20261106.md`。`compare.jpg` 是修订前后（1.2 m 全校剖切 vs 总平面）的对照。

自己截图的方法（`lanren/map/map.js` 的 `api`，页面里是 `window.__haizHome.map`）：`?quality=low&test=1#map/oblique` 打开，`holdUnfold(u)` 停在进度 u，`select(id)`/`floor(k)`/`setView({...})`/`settle()`/`unfold()`/`fold()`；用 `__haizHome.still(秒,fps)` 暂停并推进帧后截图。**不要在需要动画的测试里调用 `still()`，它会永久暂停 V4 循环**（只是截图钩子）。SwiftShader 下 1440×900 单帧约 20–60 s，要把 Playwright 截图超时设到 300 s。手机用 `isMobile+hasTouch`。

### 通过 / 仍需验证 / 已知缺陷

**已通过（有自动化或截图证据）**：V4 机位与水面显影保留；总平面不绘制三维模型；展开路径单调连续、建筑完整升起；真实点击/拖动/滚轮/键盘操作；选择建筑、单栋剖切、收回、前进/后退、深链接；「继续 · 05」后第五幕为 V4 原状；减少动态；手机 390×844 无溢出、控件不重叠、触摸点选；上一轮 17 项。

**仍需验证（未测，不要当成已完成）**：
- 任何真实设备上的帧率/内存/发热（iOS Safari、中端安卓）；高画质 4096² 阴影在真实 GPU 上的成本；
- 真实手指的旋转/双指旋转手势（只测了点按；旋转手势代码已写但没有触摸拖动的自动化测试）；
- 三维状态下刷新页面的 token 恢复路径（深链接测过，刷新+token 未单独测）；
- `?pan=tether` 在三维中被忽略（`constrain()` 在三维直接返回）——属于行为差异，未处理；
- 屏幕阅读器；横屏手机；极窄屏下的标签密度；
- `?static`/无 WebGL 页面没有三维版本（只有总平面）。

**已知缺陷与技术债**：
- 第四幕平面右侧有淡粉色榄仁树「残影」，在改动前的 `787b7d3` 上同机位同样存在（不是回归），推测是水面反射贴图里残留第一幕红叶；未修。
- 三维中「百年榄仁树」标签与附近建筑标签可能重叠；左上角标题面板在小窗口遮挡画面。
- 校园阴影在展开过程中每帧重绘（最重的部分）；没有做降频或分块。建筑模型一次性在主线程生成（约 0.3–0.5 s）并常驻 13 MB。
- 校园树是 2 种程序化形体，不是校园实际树种；建筑为近似体量，**不是测绘**；室内（走廊/分隔/楼梯）是推演。
- 数据矛盾：「虎踞龙盘」太湖石在数据里在树以西 38.6 m，而项目照片显示它就在树的长枝下；可能是榄仁树的数据位置偏了。**未改数据**，待用户用现场/KML 核对（影响第五、六幕的构图，见 §9）。
- `S.mode !== 'map'` 时 tick 会强制 `u=0`（见 map.js「left by any other way」），这是为第四幕以外的安全设计，第二阶段要改。
- `holdUnfold` 是评审钩子，会改 `S.trans`，不要用于产品逻辑。

## 8. 为什么不直接复用漫游模型

`assets/walk/world.js` 是 r128 的全局脚本（IIFE，`window.THREE`），按需建造、依赖 `CampusInteriors/Atelier/Surfaces` 等全局，合并网格后才有碰撞体；`lanren/` 用 r170 ES 模块。两个 three 版本不能共用一个渲染器与几何。第一阶段因此从同一份 `campus.json` 重新生成一套 r170 体量，并保证与总平面共用要素。**第二、三阶段若要统一漫游**，需要决定：把漫游的建筑逐步改写进 `campus3d.js`（推荐），或把漫游迁到 r170。

## 9. 第五、六幕的实施条件（准确事实与接口建议）

### 9.1 先看清的两个硬冲突（已用代码核对，`campus3d` 与 V4 `KEYS` 的坐标）

世界坐标里（树根=原点，−Z 北门方向）：
- V4 **第五幕**机位 `eye (−5.5, 5.0, 5.0) → look (−45, 5.5, 14)`，fov 58，朝西北望向泻湖。**视线在约 27 m 处（高 5.3 m）撞上一号教学楼**（它占 x −93…23、z 11…38，高 19 m，北立面离树约 11 m）。也就是说，只要三维校园在第五幕可见，V4 经典的「从树冠望向远方水面」会变成一堵教学楼立面。
- V4 **第六幕**机位 `eye (−21.5, 1.1, 29.5) → look (5, 6.6, 3.3)`（`chapters.js` 末尾关键帧），**相机落在一号教学楼的占地里**（楼内）。第六幕回望的「完整榄仁树」是从泻湖水面外侧远处看的构图。

结论：**不能简单地把第四幕展开的三维校园原样留到第五、六幕**。必须由用户决定构图取舍，然后实现。可选方案（建议先做一次 30 分钟的原型对比再选）：
- **A（推荐先试）**：校园在第五幕保持第四幕的升起状态，但只在「身体落地之后」才可见/才有碰撞：04→05 的远眺保持 V4 原样（校园在 05 远眺时位于视野之外或被雾/泻湖地形隐藏），身体跃下并落在岛屿/校园地面，回头时才看见树；第六幕 `eye` 要重新选在校园之外的泻湖一侧或树前空地（需用户确认，会改 V4 第六幕机位）。
- **B**：让校园整体相对榄仁树旋转/平移（`geo.js ROTATION` 与 `GROUND` 偏移，它们是单一常量，改后总平面、标注、拾取、显影全部同步），使 05 的视线穿过空地。会改变第四幕里「教学楼在树南」的既有真实关系，需要用户同意，并与太湖石位置矛盾一并裁决。
- **C**：05 保持 V4 原样（无校园），校园仅在人物落地后（06）淡入/升起，复用 `unfold` 的 `riseAt/sweepAt`。最安全，但「第四幕展开的校园就是第五幕进入的校园」的体验需要用户接受折中。

### 9.2 当前是否已有共享的场景、相机和坐标

有：同一个 `world.scene/renderer/camera`，同一个世界坐标（树根原点、`GROUND_Y=−0.85`），`geo.frame` 可在 campus↔world 互转，`DwellCamera`/`View.applyView` 能写同一台相机。**没有**的是：一个跨幕的「世界状态」对象（目前 `S` 在 `map.js` 闭包里）、校园三维层在第四幕以外的存在（tick 里被清零）、碰撞、玩家控制器、输入仲裁。

### 9.3 建议的接口（不要求本轮实现）

1. **抽出 `lanren/world/state.js`**：`{ campus: {u, sweepR, visible}, selected, player: {pos, yaw, pitch, mode}, owner: 'scroll'|'map'|'film'|'play' }`，把 `map.js` 里的 `S.u/S.trans/S.selected` 读写改为经过它；`section.update()` 读 `campus.u/sweepR`，去掉「非 map 就清零」。
2. **输入/相机所有权仲裁**：现在 `cam.enabled`（V4 DwellCamera 拖动）、`map.js` 的 `owns()`/`S.owns`、`canvas.touchAction`、`scrollTo(S.lockY)`、`inert` 是分散的。做一个 `owner` 仲裁器，每个状态定义：滚轮/触摸/键盘含义、`touch-action`、是否锁滚动、相机谁写。**参照 `takeCamera()/handBack()` 与 `shelve()` 已有的模式。**
3. **05→06 电影 = `state.p∈[4,5]` 的纯函数**：`p` 已经是 GSAP ScrollTrigger 擦除并吸附的、可逆的进度。人物姿态 `pose = film(q)`（`q=p−4`，关键帧/样条+IK 只在落点修正），不依赖物理积分，向后滚动必然精确倒退。相机仍由 `poseAt(p)` 提供基础路径，叠加一个「身体可见度 / 头部高度 / 点头」的覆盖层（在 `home.js step()` 里 `map?.camera` 同一个位置加 `film?.camera`，同样返回 true 接管）。
4. **从电影交给玩法（第六幕之后）**：`q=1` 停留；再一次明确的向前输入（滚轮 `deltaY>0`、方向键、手机「继续」按钮）→ 读取当前姿态 `{pos,yaw,pitch,footPhase}` 写入 `state.player`，`owner='play'`，锁滚动（`S.lockY` 模式）、`ScrollTrigger.disable()`、`cam.enabled=false`，玩家控制器按 `dt` 积分。返回：`owner='scroll'` 恢复。交接那一帧不要同时给速度。
5. **方块人物进入同一个世界**：用 r170 在 `world.scene` 里建一个 `Group`（头/躯干/双臂/双腿，共享材质，可用 `InstancedMesh` 或合并几何；第一人称相机挂在头骨），位置用世界坐标，落点在 `GROUND_Y`（或岛屿 `world.heightAt(x,z)`，半径 8.6 m 内；注意第四幕时岛屿会下沉 2.7 m，见 `layer.js SINK`）。**不要**创建第二个 Scene 或第二个渲染器；光照/阴影/PCSS 沿用 V4，人物 `castShadow` 即可。
6. **碰撞**：现有 `campus3d.buildings` 有 `cx,cz,w,d,rot` 与 `height`，足以做胶囊 vs 有向矩形的 2D 碰撞；门廊/外廊等外挑部分用轮廓外扩。漫游旧页的碰撞体（`world.js collectColliders`）是 r128 的，不能直接用。
7. **地图（双层）**：随身地图可复用 `ui.js createOverlay` 的投影标注 + 一个独立的俯视小相机/或 2D canvas，避免触发 `unfold`；返回完整第四幕 = 从 `state.player.pos` 起一段 `View.mixView`（`flightView`）升到 `A` 机位并 `fold`——`map.js enterInstant({token})` 已有「直接进入地图并恢复视角」的路径，可参照。
8. **第六幕回头**：电影最后一段用 `yaw` 从落地朝向转到「看向树根」（`atan2(0−x, 0−z)`），相机拉远靠脚下位置而非改相机；六幕的完整树形取决于 §9.1 的落点选择。第六幕的功能入口（窗台、物理实验室、Pocket、登录、书页、搜索）在 `chapters.js` `entries`，保持可发现。
9. **手机横屏**：仓库目前没有方向处理。`scene.js pickTier()` 对「触屏+小屏」给 low/medium；`DwellCamera.shiftFor(aspect)` 只处理竖屏。需要：`matchMedia('(orientation: landscape)')` + `resize` 重排；`screen.orientation.lock` 仅 Android Chrome 全屏时可用、iOS Safari 不可用（要有旋转提示与竖屏退路，不能 CSS 假旋转）；虚拟摇杆/环顾区用 pointer events，注意 `touch-action:none` 与滚动电影的互斥（上一阶段 `map.js` 已有 `touchmove preventDefault`/`scrollable()` 的做法）。

## 10. 下一阶段可直接复用的系统

- `geo.js`：三坐标系、`makeFrame`、`placeAt/featureAt`、`computeArrival`（到达场可用于任何「由树向外」的动效）。
- `campus3d.js`：封闭实体建筑（可直接导出给碰撞、剖切、漫游）。
- `section.js`：per-building `lift/cut`、前沿材质、校园阴影、地面（复用总平面绘制函数）、树的生长。
- `unfold.js`：`riseAt/sweepAt/cameraAt` 纯函数时间线，可用于 04→05 滚动绑定（把 `u` 绑到 `state.p`）。
- `view.js`：`mixView/flightView/zoomAbout/applyView`（相机插值与飞行）。
- `map.js`：`takeCamera/handBack/shelve/hist()/enterInstant/token` 的所有权与历史模式。
- 测试工具：`api.holdUnfold/select/floor/setView/settle`、`tests/campus-unfold-browser.cjs` 里的 `until/frames/screenOf/cuts` 辅助。

## 11. 下一阶段绝对不能无意破坏的东西

- V4 的 `chapters.js/camera.js/scene.js/environment.js/foliage.js` 与所有 GLB/纹理（一字未改，改动要有理由和对照截图）；第一幕快速导航、第二、三幕。
- 第四幕：V4 原机位（俯角 73.5°、镜头 50°）、水面显影、榄仁树为原点的统一坐标、「默认斜俯视、正俯视由用户选择」、关闭后恢复树/机位/生长值、浏览器历史逐级后退。
- **总平面是 Site Plan**：二维不绘制三维模型、不使用 1.2 m 全校剖切；单栋剖切只能是可选探索。
- 总平面与三维必须同源（`geo.buildFeatures` ↔ `campus3d`），测试 `campus-model.cjs` 会拦住不一致。
- `S.mode`/历史的 `pendingPops/hist()` 队列（改历史写入前要读 `map.js` 注释）。
- 不虚构数据：模型是近似、室内是推演；`campus.json` 的 `meta.notice` 要继续显示；不把未测绘内容写成真实校园结构。
- 已有服务入口与用户数据（登录、书页、Pocket、窗台等）、`campus-3d.html/director.html/descent.html`（要整合，不要删）。
- 性能策略：先消除浪费，不要用「手机直接关光影」冒充优化。
- 不要未经用户授权合并或推送 `main`。
