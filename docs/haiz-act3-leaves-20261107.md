# 第三幕「青春 · 生长」— 设计决策补充与第一版实施记录（2026-11-07）

分支 `claude/hopeful-hamilton-x676kb`，基于 `main` 的 `787b7d3`（2026-11-06「Merge continuous spatial world into main」）。母本：`HAIZ-ONE-CONTINUOUS-WORLD-MASTER-86SKILLS-20261106.zip`（只读，未修改，未安装其中的 Skills，`source-v4/` 未被使用于覆盖）。

> 本文是 **补充**，不替代 `DESIGN.md`。凡写「建议 / 待批准」的地方，都不是已定稿的设计。

---

## 0. 一页结论

- **做了什么**：在 V4 第三幕新叶特写之上，新增一个独立模块 `lanren/canopy/`。用户主动点「走进作品树冠」后，镜头前那一簇真实新叶向两旁让开，镜头沿它所在的真实枝条退开、树冠进入盛叶季节，作品树冠展开；不点就和原来一样继续滚到第四幕。
- **空间语义**：五根真实主枝 = 五个创作方向（各有自己的光）；作品 = 枝上真实叶簇里的一片新叶（完成作品是展开的新绿叶片，进行中的共创项目是仍在对折展开的古铜色嫩叶，双人作品是同一叶柄上的两片叶）；接力作品长在源作品旁边的叶位；选中一件作品，镜头以 V4 原第三幕微距的构图去看那一片叶，阳光从叶背透过来，安静的纸页打开阅读。
- **身份**：每件公开作品的位置是持久的叶位地址 `v4-2611:<方向>:<序号>`，由确定性的叶位表 + 只增不减的分配规则给出，不是运行时随机位置；`#leaves/w/<作品编号>` 是可分享、可冷启动直达的「我的叶子」。
- **真实与演示的界线**：仓库里没有任何真实学生投稿，也没有投稿 / 审核 / 发布服务。**默认（生产）状态树上没有作品**，并如实说明原因；`?works=demo` 才加载 11 件明确标注为虚构的开发演示作品（作者为「演示作者 · 甲…」，图像是本站数字榄仁树的渲染，音频为脚本合成）。
- **真实打通的一环**：私人草稿。已登录 HAIZ 账号时保存到账号后台新增的 `works` 私人集合（仅本人可见、有版本、冲突检测、回收站），未登录时只存本机并明说。投稿、审核、公开、撤回、举报、合作邀请 **都没有实现**，界面中对应按钮为禁用状态并说明原因，不伪装。
- **对共享代码的侵入**：`lanren/js/home.js` +16/−4 行（与第四幕地图模块完全同构的挂点），`lanren/js/chapters.js` 只改第三幕的文案与入口（镜头、光、生长均未动），`index.html` 由构建脚本重新生成。

---

## 1. 真实项目基准（审计于 2026-11-07）

| 分支 | HEAD | 相对 `main@787b7d3` | 内容 |
|---|---|---|---|
| `main` | `787b7d3` | — | V4 六幕首页 + 第四幕水面地图（`lanren/map`）+ Cloudflare 账号后台 |
| `claude/friendly-thompson-qdp9tb`（第二幕） | `4609797` 11-07 15:28 | +1 提交，从 main 分出 | `lanren/roots/`：校史投影、胶片调色、年代查找、阅读层；改了 `home.js`（滚动分段映射、吸附点、`railAt`）、`chapters.js`（第二幕 id `campus→roots`）、`build-home.mjs` |
| `claude/vibrant-wozniak-rsrttr`（第四幕） | `30f219c` 11-07 03:28 | +2 提交 | Site Plan 平面 → 整座校园 3D 展开（`lanren/map/section.js, campus3d.js, unfold.js`），**不改 `home.js`** |
| `claude/wonderful-maxwell-ggk0pi`（第五、六幕） | `2382875` 11-07 09:36 | +33 提交，**包含第四幕两个提交** | `lanren/world/`：05→06 电影、方块人物、漫游、随身地图、菜单、`state.js` 输入所有权；A/B/C 三种构图（`?compose=`），B 未获最终批准；改了 `home.js`（`pOfProgress` 分段映射、电影吸附点、`life.*` 挂点）、`home.css`、`index.html`（`.stop.film` 300vh） |
| `claude/haiz-continuous-spatial-world-fl9mw9` | `c093f9b` | main 的祖先（已合并） | 母本 `IMPLEMENTATION_STATUS.md` 所说的「最新」分支，已过时 |

- 三个章节分支的共同基准都是 `787b7d3`；本分支即从这里开出，工作区干净，无未提交改动需要保护。
- 第三幕在任何分支上都还没有创作功能；`main` 的第三幕是 V4 新叶特写 + 「档案 · 来处」三个链接（新闻 / 校友 / 建筑）。
- 后端：`backend/`（Node + SQLite；`backend/cloudflare/` 为免费云端部署，Workers + SQLite Durable Object）提供账号、会话、个人数据集合（`notes / bookmarks / preferences`，本人可见、带版本历史与回收站）、教师 Flow 草稿→确认发布、实时房间。`supabase/` 只有 Pocket 的 `pocket_snapshots`（本人 RLS）。**网站登录用的是 HAIZ 后端账号，不是 Supabase。**
- 已有校园创作内容：`data/campus-journal.json` 的 6 个社团提案、4 条课间电台全部标注为创作示例（`sample: true`）；`darkroom.html` 的接力是把作品编码在链接里，不经服务器。**没有任何真实学生作品数据。**

## 2. 母本中仍然有效的已确认设计

- `DESIGN.md` 第三幕共识 V1.0 全部条目（A+B 结合、正常滚动不强制进入、枝 = 方向 / 叶 = 作品 / 双叶 = 合作、发现-发起-共创、私人草稿 → 申请 → 审核 → 作者选择公开、撤回权、找到我的叶子、编辑精选 + 同学推荐 + 初生新叶 + 向阳轮换与历期荣誉、可审核生长的细枝、免费云起步、诚实与隐私）。
- V4 是视觉与六镜头基准；同一棵树、同一套相机与光；第一幕可直达任意幕；减少动态、键盘、无 WebGL 路径必须保留。
- 不虚构学生、投稿量、参与度和学校认可；涉及未成年人的照片与身份要授权与隐私保护。

## 3. 已被更新的旧结论（本轮按用户最新确认执行）

| 旧说法 | 现行结论 |
|---|---|
| `DESIGN.md` 四至六幕节：第四幕平面「本质上是 3D 校园约 1.2 m 水平剖面」 | **第四幕默认是 Site Plan 校园总平面**；1.2 m 剖切只用于单栋建筑的可选探索（用户已确认的修订） |
| 第五、六幕「方案 B 为默认」（`wonderful-maxwell` 的 `compose.js` 注释） | A/B/C 只是构图实验，**B 未获最终批准**，不作为设计权威 |
| 母本 `IMPLEMENTATION_STATUS.md`：最新原型在 `haiz-continuous-spatial-world-fl9mw9` | 该分支已并入 main；第二、四、五、六幕各有更新的独立分支（见 §1） |
| V4 `chapters.js` 第三幕 = 「档案 · 来处」（新闻 / 校友 / 建筑） | 第三幕 = 「青春 · 生长」；「来处」归第二幕。为避免功能丢失，三个链接**暂留**在第三幕面板（标注「来处」），待第二幕整合后移除 |
| V4 第五幕面板承载杂志 / 社团 / 电台 / 暗房 | 设计上这四项归第三幕复用；本轮**没有改第五幕面板**（不跨幕修改），第三幕在「种下一片新叶」中链接这四个工具。整合时再决定第五幕面板是否移除重复项 |

## 4. 各分支已实现的真实能力（第三幕相关）

- **第二幕**：沿树干到第三幕新叶特写的连续镜头（`roots/path.js` 的长枝路径终点就是第三幕镜头所看的叶簇）；「今天」一站把画面交给第三幕；`#roots/<id>` 地址；阅读层（纸页、Esc、上一条 / 下一条）。第三幕的阅读纸页与它在视觉语言上一致（同色纸、同字体层级）。
- **第四幕**：`map.attach()` 挂点 + 状态机 + 历史栈 + sessionStorage 恢复 + 页面滚动锁定——第三幕模块按同一协议实现。
- **第五、六幕**：`lanren/world/state.js` 的输入所有权（scroll / map / hold / play / pocket / menu / transit）；人物、漫游与地图互通。第三幕的进入 / 退出已预留 `ctx.worldState.claim('canopy')` 调用（见 §6）。

## 5. 第三幕依赖的现有模块（只读使用，未修改）

| 模块 | 用法 |
|---|---|
| `lanren/js/scene.js` 的 `world` | `renderer / scene / camera / canopy / rosettes / stride / setStage` |
| `lanren/js/foliage.js` | `makeLeafMaterial`（作品叶片用 V4 原叶片材质：同一张叶片贴图、法线、风、触碰、透光），`leafGeometry`（与 V4 hero 叶同参数），`UNIFORMS`（风、触碰槽 `uTouchO/D` 的后两个、生长） |
| `lanren/js/camera.js` 的 `DwellCamera` | `fovFor / applyShift / screen`（手机竖屏的镜头平移规则保持一致）；进入时读取 `cam.s`，退出时写回并清零自由视角 |
| `lanren/assets/rosettes.bin`、`tree.json` | 叶位表的唯一来源（seed 2611，10947 个叶簇点，192 个叶团） |
| 第三幕镜头、光照与生长（`chapters.js` 的 `KEYS[t=2]`、`LIGHT[2]`、`GROW[2]`，`home.js` 的 `aimStudy`） | 原样保留，作为进入与退出的锚点 |
| `backend/repository-core.mjs` 个人数据集合 | 新增 `works` 私人集合（草稿） |

## 6. 与其他章节整合时最可能冲突的共享代码，以及第三幕提供的接口

**冲突热点**

1. `lanren/js/home.js` `wireScroll()`：第二幕（`measureKnots / pFromU / snapPoints`，第二幕停靠点加长）与第五、六幕（`pOfProgress / FILM_BEATS`，`.stop.film` 300vh）**各自改写了滚动→进度映射与吸附点**，二者必然冲突，需合并成一套「按停靠点真实位置分段线性 + 各幕声明自己的吸附点」。第三幕**没有改这里**，也不需要额外滚动长度（进入作品树冠是主动操作，期间页面滚动锁定）。
2. `home.js` `start3D()` 的地址解析行：三个分支都改了同一行（第二幕 `#roots|#campus`，第五六幕 `#walk`，本分支 `#leaves|#archive`）。合并时写成一个按前缀分派的小函数即可。
3. `home.js` `step()` 的相机链：`map?.camera() || life?.camera() || canopy?.camera() || cam.update()`；`setActive` 判定（第二幕 `roots.owns(p)`、第五六幕 05→06 特判）与本分支互不干扰。
4. `chapters.js`：第二幕改第 2 项、本分支改第 3 项，相邻对象，git 可能报上下文冲突，内容上不冲突。`build-home.mjs` 第二幕加了入口分组，本分支未改该脚本。
5. **章节 id**：第三幕 id 定为 `leaves`（地址 `#leaves`、`#leaves/w/<作品编号>`）。不能用 `growth`：`index.html` 里 V4 的生长曲线控件已占用 `id="growth"`，`getElementById` 与浏览器锚点都会指向它（本轮首次浏览器测试即因此失败，已改）。旧 `#archive` 地址仍打开第三幕。
6. `tests/home-browser.cjs`：本分支把 `#archive` 改为 `#leaves`；第二幕若也改此测试需合并。
7. **构图风险**：第五六幕把校园铺在树下（构图 A/B/C）。第三幕「全部方向」远景机位在距树轴 31 m、高 12.5 m 处；若整合后第三幕时校园已立起，该机位可能落进建筑体。整合时应以校园 footprint 检查远景机位（或把半径收到 ~22 m）。目前 main 上第三幕时校园不可见，无此问题。

**第三幕的接口**（`lanren/canopy/canopy.js` 顶部注释有完整说明）

```
attach(ctx) → { tick, grow, light, camera, overlay, tap, arrive, api }
ctx = { world, cam, state, goTo, DwellCamera, reduceMotion, entry, worldState? }
api.enter(dir) / exit() / dir(id) / open(workId) / close() / find(workId) / suspend() / resume()
api.info() → { mode: shot|enter|canopy|leave, owns, dir, sel, reading, status, hash, … }
```

- **进入**：只在用户主动时（面板按钮、`#leaves/<dir>` 或 `#leaves/w/<id>` 地址、点中镜头里的作品叶）；锁定页面滚动（与地图模块同法），`cam.enabled=false`。
- **退出**：Esc / 「回到新叶」/ 浏览器返回；镜头飞回进入时的**真实镜头状态**（含自由视角已转动的方向），然后把 `cam.s` 交还 V4，V4 自己缓缓归位到第三幕轨道。浏览器测试中回到原位误差 < 0.08 m。
- **暂停 / 恢复**：`api.suspend() / resume()` 供全局菜单临时拿走输入。
- **状态恢复**：所有状态都在地址里（`#leaves/<dir>`、`#leaves/w/<id>`），刷新、分享、返回都按地址恢复；历史栈一层一层退出（与地图模块同样的 `pendingPops` 处理）。
- **与第五六幕的输入所有权**：若 `ctx.worldState` 存在，进入 / 退出时调用 `claim('canopy') / release('canopy')`。`state.js` 的 `POLICY` 目前没有 `canopy`，整合时需加一行：`canopy: { scroll: false, touch: 'none', v4cam: false, wheel: 'canopy' }`；在加之前调用会被捕获并忽略，第三幕自己的锁仍然有效。
- `?nocanopy` 关闭模块，用于与纯 V4 对照。

## 7. 美术方案

### 7.1 我在真实画面里比较过的两条路

在同一根「摄影」主枝前分别从**树冠外**与**树冠内**渲染（截图见 `docs/lanren/canopy/probe-inside-outside.jpg`）。树冠内的画面被深色枝干占满、叶片几乎都是逆光剪影，作品叶难以辨认，也容易穿进枝干；树冠外则是一面有层次、透光的叶墙，和 V4 第三幕微距是同一种光与构图。**选择从树冠外、在叶层高度绕树冠移动。**

### 7.2 现在的方案

1. **展开**：点「走进作品树冠」→ 镜头前的新叶被 V4 自身的触碰响应拨开（沿镜头前进方向连续拨动约 1.6 秒）→ 镜头沿柱坐标绕树轴退到这根主枝外 3.7–6 m 处；整棵树在这 2 秒里从第三幕的「舒展」长到盛叶（生长 0.5→0.86）；作品叶按叶位顺序一片接一片「接住阳光」后归于平静。原来眼前那簇新叶就在这根枝上，空间是同一个。
2. **方向 = 枝，各有自己的光**：每根主枝占树冠的一个方位扇区；进入某枝时，太阳从该枝背后（与 V4 第三幕给叶簇打光的方式相同）以该方向的「性情」照过来——摄影：低角度斜射、有光束；文学：高处柔光、偏暖、低反差；声音：风更大，叶子动得更多；绘画 · 设计：正午顺光、饱和；数字：日落后的蓝调。只是对 V4 光照参数的相对调整，不是另一套灯光。
3. **在方向之间移动** 用柱坐标飞行：镜头绕树冠外侧转过去，大角度时向外、向上让出，**不穿过树干与叶团**；中途光线渐变到下一根枝的性情。
4. **作品 = 叶片**：不贴照片。作品叶使用 V4 的叶片材质与 hero 叶几何，但有自己的生长时钟：完成作品是展开的新绿；进行中的项目还在对折、带古铜色（*Terminalia* 新梢的真实颜色）；双人作品是同一叶柄上张开的两片叶。强调靠光：选中 / 找到的叶子让更多阳光透过叶片，没有描边、光晕精灵或连线。
5. **标签**：每片作品叶旁只有一枚细圈与编号（`摄影 · 01`，即它的叶位）和一行标题 / 作者；两个标签在屏幕上靠近时自动错开，圆点始终钉在叶片上。所有标签都是真按钮，可用键盘 ↑↓ 遍历。
6. **阅读**：镜头以 V4 第三幕微距的构图移向那一片叶（叶团外侧上方 1.25 m、看向叶片），景深收浅、阳光从叶背透过；同时右侧（手机为底部 78% 高）升起暖纸色阅读页：原比例照片、长文版式（17px 宋体、2.0 行高）、音频播放器、作者自述、进行中项目的阶段与招募、枝叶相连（来源 / 衍生，可点击飞过去）、向阳与同学推荐、授权、叶位与可复制链接。「安静阅读」让纸页铺满整屏，三维完全退后。
7. **关系的空间表达**：接力作品长在源作品旁边的叶位（同一根枝时取最近的空叶位）；跨方向的接力，点击关系会让镜头跨过树冠飞到另一根枝——关系是**走过去**的，而不是画出来的。「沿着这条接力看下去」会依次飞过整条接力链。
8. **全部方向**：退到水面上空看整个树冠，五根枝各有一个衬线标签。

### 7.3 尚待你审定的美术点（未定稿）

- 「从树冠外绕行」是否就是你想要的「展开」，还是希望进入后有更强的空间转换（例如局部树冠在保持原树的前提下真正向外舒展、拉开层次）。我倾向先保留现方案的克制，等真机效果后再定。
- 作品叶的透光强调强度、标签的显示密度（作品多时是否只显示编号）。
- 「全部方向」远景是否需要（还是只保留枝与枝之间的绕行）。

## 8. 技术方案与文件

| 文件 | 作用 |
|---|---|
| `lanren/canopy/canopy.js` | 运行时：状态机、柱坐标相机飞行、光与生长混合、标签投影与避让、历史栈与地址、输入锁定、键盘、找叶子、草稿面板 |
| `lanren/canopy/leaves.js` | 作品叶 InstancedMesh：V4 叶片材质 + 独立生长时钟 + 每片强调属性 `aWork`（链式 `onBeforeCompile`，不改原材质文件） |
| `lanren/canopy/address.js` | 叶位表、地址解析、只增分配、指纹（纯函数，Node 可测） |
| `lanren/canopy/directions.js` | 五个方向、扇区、性情、细枝（已批准才有空间） |
| `lanren/canopy/model.js` | 生命周期、可见性、公开投影、发现规则（向阳 / 推荐 / 初生 / 相连）、关系与接力链、草稿校验 |
| `lanren/canopy/source.js` | 数据来源：无服务 → 空；`?works=demo` → 演示；私人草稿 → 账号 `works` 集合或本机 |
| `lanren/canopy/ui.js`、`canopy.css`、`route.js`、`static.js` | 界面、地址解析、无 WebGL 文字版 |
| `lanren/canopy/demo/` | 开发演示作品与媒体（由 `scripts/lanren/canopy-demo.mjs`、`canopy-demo-media.py` 可复现生成） |
| `lanren/js/home.js` | +16/−4：`canopy` 挂点（tick / grow / light / camera / overlay / tap / arrive）、`#leaves` 与旧 `#archive` 地址、静态版加载 |
| `lanren/js/chapters.js`、`index.html` | 第三幕 id `archive→leaves`、文案、入口（镜头 / 光 / 生长未改）；`index.html` 由 `build-home.mjs` 生成 |
| `backend/repository-core.mjs` | 个人集合加入 `works`（及分页游标正则） |
| `src/account/app.js` | 「数据用量」表为 `works` 显示「作品草稿」标签（否则显示 undefined） |
| `backend/tests/recovery.test.mjs` | 用量测试的期望集合加入空的 `works` 行（行为变更的必要更新） |
| `backend/tests/works-drafts.test.mjs`、`tests/canopy.cjs`、`tests/canopy-browser.cjs` | 新测试 |
| `tests/home-browser.cjs` | `#archive` → `#leaves`、`#p-archive` → `#p-leaves` |

性能：作品叶只有「作品数 × 1–3」个实例（演示 11 件 = 13 片）；每帧标签投影 O(作品数)；叶位表构建 13 ms（加载时一次）。没有给移动端降低任何树冠质量。本开发容器没有 GPU：SwiftShader 软件渲染下，**未改动的 V4 第三幕本身只有约 1–1.6 fps**，作品树冠各状态与之同一量级（0.4–0.9 fps，单帧 3–4.6 s），去掉 `backdrop-filter` 也没有改善——这些数字只说明软件渲染慢，不能用来评价性能。**未做真机测量**；真机上需重点看：进入时生长 0.5→0.86 的过渡、景深切换、`backdrop-filter` 在低端手机上的合成开销。

## 9. 作品身份、权限与数据流

### 9.1 身份与地址

- **作品编号**：不透明、不可猜、不按顺序（演示数据为 `demo-*`；正式方案为服务端生成的随机 ID）。与作者名无关。
- **叶位地址** `"<asset>:<direction>:<slot>"`：作品**第一次公开时**由服务端在事务中分配并保存；`asset = v4-2611` 表示叶位表数在哪一棵树上。叶位表是 `rosettes.bin` 的纯函数：主枝扇区内、外壳、有新叶、遮挡不过重的叶簇，按离主枝「起点」由近到远的叶团、每三团交替、团内保持 0.45 m 间距排序。五根枝分别有 371 / 277 / 295 / 325 / 231 个叶位（共 1499）。表的指纹 `9f1a9f49` 写在测试里：**若有人改了树或规则，测试会失败**，提醒做一次有序迁移，而不是让叶子悄悄换位。
- **只增不减**：撤回或被隐藏的作品保留叶位；作者重新公开回到原处；他人不会被分进去。接力作品可请求「源作品旁最近的空叶位」。
- **规模**：作品超过某枝的叶位数时，规则末尾已保证所有候选都会被用到；更大规模时可增加内层叶位或细枝层级（`asset` 升级 + 迁移）。「所有公开作品可被找到」靠目录、搜索与地址，而不靠所有叶子同时在屏幕上。

### 9.2 生命周期与权限（`model.js` 与 `docs/act3/works-schema.sql` 一致）

```
draft ─提交─▶ submitted ─通过─▶ approved ─作者公开─▶ public ◀─▶ withdrawn
  ▲              └─退回修改─▶ draft                     │
  └─撤回提交─────┘                       举报成立 ▼ hidden（版主）─恢复─▶ public
```

| 谁 | 能看到 | 能做 |
|---|---|---|
| 任何人 | `public` 的公开投影（无 owner、无审核意见、合作者只显示署名） | 推荐（需登录、需写理由、每人每件一次）、举报（需登录） |
| 作者 | 自己的全部状态 | 编辑草稿、提交 / 撤回提交、**公开**、**撤回公开**、邀请合作者、选择公开哪些版本 |
| 已接受邀请的合作者 | 非草稿状态的共享作品 | 按授权贡献 |
| 审核编辑 | 仅 `submitted / approved`（**看不到私人草稿**） | 通过、退回修改（不能审核自己的作品；**不能公开**） |
| 版主 | 被举报处理中的作品 | 隐藏 / 恢复 |

所有状态变化只经过服务端函数（SQL 草案里的 `transition()`；HAIZ 后端里将是带角色检查的接口）。客户端没有写 `state / address / slot` 的权限。**不在前端放任何管理员密钥或审核权限**；角色表只有服务端可写。

### 9.3 推荐的落地位置

- **建议**：先在现有 HAIZ 后端（`backend/`，Cloudflare 免费部署，与网站登录同一套账号）实现 works 服务。理由：同一身份（Supabase 只服务 Pocket，若作品放在 Supabase，学生会面对两套账号）；已有审计、幂等、版本冲突、配额、备份；服务端天然是审核边界。
- `docs/act3/works-schema.sql` 是同一规则的 Postgres / Supabase RLS 写法，供选择 Supabase 时直接审阅；**未在任何地方执行**，也故意没有放进 `supabase/migrations/`。
- 媒体：私有存储桶，路径 `<owner>/<work>/<file>`，作者可读写自己的路径；作品公开后才对所有人可读；撤回即失效。图片按原比例保存，保留作者署名；含可识别人物的照片需勾选「当事人同意」并由审核确认。

### 9.4 本轮实际打通 vs 演示 vs 下一阶段

| 环节 | 状态 |
|---|---|
| 私人草稿保存到账号（`works` 集合，本人可见、版本、冲突、回收站） | **真实**：后端测试通过（`works-drafts.test.mjs`），浏览器端在同源后端已登录时调用；本次没有在浏览器里对运行中的后端做端到端登录测试（本地无 Node ≥ 24.22，后端声明的最低版本；单元级测试在 Node 22 通过） |
| 未登录草稿只存本机（并明说） | **真实**（浏览器测试通过） |
| 作品树冠、方向、阅读、关系、找叶子、分享链接、撤回后的「目前不公开」页 | 空间与交互**真实**；作品内容是**开发演示** |
| 叶位地址分配 | 规则真实（同一函数分配了演示作品）；服务端事务尚未实现 |
| 投稿审核、公开、撤回、举报处理、合作邀请、贡献记录、授权衍生的申请、编辑精选与推荐的写入、细枝提案 | **未实现**（界面按钮禁用并说明；SQL 草案已设计权限） |
| 「找到我的叶子」的账号版（列出我的公开作品） | 未实现（依赖公开作品服务）；演示版可选虚构作者体验 |

## 10. 清单

**已实现并在 Chromium 中验证**（`tests/canopy-browser.cjs`，SwiftShader）：见 `tests/canopy-browser-results.json`。

**未实现**：见 §9.4 的「未实现」行；视频作品（数据结构与阅读组件支持 `video`，演示没有视频）；作品搜索框（目录与地址可达，未做全文搜索）；声音模式下作品叶的声音反馈。

**待真机验证**：iOS Safari / Android Chrome 的帧率、发热与内存；手机上标签密度与触控命中；底部阅读页与浏览器工具栏 / 安全区；「安静阅读」长文排版；进入时的生长过渡在中低端 GPU 上是否顺滑；`backdrop-filter` 在低端机上的开销。

## 11. 预览

```bash
python3 -m http.server 8080
```

- 默认（真实状态，树上无作品）：`http://localhost:8080/index.html#leaves`，点「走进作品树冠」
- 开发演示：`http://localhost:8080/index.html?works=demo#leaves`（同一标签页会记住；`?works=none` 取消）
- 直达一片叶：`index.html?works=demo#leaves/w/demo-low-voice`；某根枝：`#leaves/words`；全部方向：`#leaves/all`
- 无 WebGL 文字版：`index.html?static=1&works=demo#leaves`
- 与纯 V4 对照：`index.html?nocanopy#leaves`

测试：`node tests/canopy.cjs`、`node tests/canopy-browser.cjs`、`node --test backend/tests/*.test.mjs`、`node tests/lanren.cjs`、`node tests/home-browser.cjs`。

## 12. 需要你决定的事

1. §7.3 的美术点。
2. works 服务放在 HAIZ 后端（建议）还是 Supabase。
3. 五个初始方向的名称与划分（数据里可改，叶位表随扇区变化，需在第一件真实作品公开前定下）。
4. 第五幕面板里杂志 / 社团 / 电台 / 暗房的重复入口，整合时是否移到第三幕。
5. 审核由谁承担（学生编辑部 / 老师 / 两者），这决定 `editor / moderator` 角色怎么发放。
