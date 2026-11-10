# haiz · Architecture, not interface spectacle

Reference research: [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md), commit `3b605329240ce735b510037cca322f1831fdd7f8`, especially `design-md/oura/DESIGN.md` and `design-md/linear.app/DESIGN.md`. Their analysis is MIT licensed; attribution is in `assets/vendor/AWESOME-DESIGN-MD-LICENSE.txt`. This is an independent adaptation, not an Oura or Linear brand reproduction.

## Visual language

The campus photography and 3D architecture carry the experience. Reading pages use warm paper `#f7f3eb`, charcoal `#292e2a`, quiet green `#293f36`, muted text `#626e62` and a restrained clay accent. The world-view tools use translucent charcoal `#172b24`, warm light text and 1px edges. Do not let interface panels obscure the architecture.

Large Chinese headings use the existing system serif stack; body/UI use bundled Sora and system Chinese fonts. No proprietary typefaces are copied. Separate large editorial statements from small, functional labels. Section rhythm is generous; imagery is large; notes are readable and not reduced to decorative hairlines.

Use 8px UI corners, 12–16px media/card corners, and full rounding for compact actions. A photograph is not a floating tilted card. Let original image proportions remain legible; do not crop a campus photo to imply a different building or remove authorship marks.

## Motion

Finite, soft entrances: 15px / 700ms with `cubic-bezier(.22,1,.36,1)`. Dialogs use a short 250ms reveal. Hover images may scale slightly within their frame; the entire reading page does not drift. Chapter navigation tracks actual sections. Respect reduced motion, keyboard focus, coarse-pointer use and document visibility; do not add an always-running visual effects loop.

## Architecture

Model proportions, negative space and lighting precede microtexture. Curved roof surfaces and eave ends are real geometry. Window reveals are real depth. Dome seams, stair profiles, mullions and layered cornices remain visible in silhouette and shadow. A detailed color image on a block is not sufficient.

Preserve existing spatial anchors and classroom access. Keep survey uncertainty explicit. Actual photographs and the model appear as separate reference views; do not paste a photo in front of the camera and call it higher-fidelity modelling. Licensed decorative models are credited as creative set dressing, not records of the real campus.

## Verification

Inspect fresh browser screenshots of Fengqitang, the library and a teaching block before accepting visual work. Automated geometry checks cannot establish photorealism. Check the silhouette, camera crop, highlight intensity, shadow direction, local texture scale, mobile overflow and failure fallback. Record limitations without claiming a photographic reconstruction.


---

## HAIZ · One Continuous World — current creative direction (2026-11-05)

> **This section records user-confirmed product direction and the first-chapter brief.** It takes priority over earlier illustrative motion, shape or layout prescriptions when designing the cinematic homepage. Existing numerical style values are examples from previous work, not limits on the designer's creativity.

### What HAIZ should feel like

HAIZ is not a beautiful 3D landing page that sends visitors into unrelated webpages. The existing V4 tropical-almond tree is the persistent spatial foundation of a digital campus. Different camera shots reveal different functions; each function should belong to the meaning of its shot, not merely float beside it as a menu.

Preserve V4's established tree, six-shot camera experience, natural light, water and growth progression as the visual baseline. Build on it instead of gratuitously remaking its art. Distinct sections may have distinct moods and interactions; they need not share a rigid UI template.

### Chapter 01 · 初遇 — First encounter

**Purpose:** Introduce the actual tree and the HAIZ world, orient the visitor, and make onward exploration effortless. The whole tree represents the whole experience. This is a deliberate, spacious opening — not another dense feature dashboard.

**Requirements:**

- Let the V4 first shot and the tree carry the visual impact. Present only information that helps users understand what and where this tree is, and how to explore HAIZ. Avoid hollow slogans, repetitive feature cards and unnecessary spectacle.
- **Fast destination access is a first-class interaction.** From Chapter 01, users must be able to move directly to any named chapter using the existing orbit/chapter navigation, without having to scroll through every intermediate chapter; keep the existing site-wide search accessible as an alternative route to content.
- **Design actual camera trajectories for fast chapter switching.** A direct selection must feel like travelling through the same real space, not teleporting between disconnected screenshots. This applies especially to nonadjacent destinations (for example, 01→04 or 01→06). Motion must feel deliberate, legible and responsive; it must preserve the continuity of the V4 tree, growth and scene state, and work appropriately on desktop and mobile.
- The travel should be *fast enough to serve navigation*, not force repeat visitors through a long cinematic sequence. Rapid repeated selections, interruption, back/return, reduced-motion preference and accessibility should have coherent behaviour.
- First-time visitors should discover how to explore, while returning visitors should be able to reach their destination immediately. Keep the opening uncluttered.
- A small optional “observe the tree” interaction (botanical details, campus location, honest model provenance) is a **proposal for design exploration, not a confirmed requirement**. Do not invent a mandatory mini-feature or bury the main navigation behind it.

**Creative freedom:** Claude should propose and refine the camera choreography, transitions, interface appearance, pacing and technical architecture based on the live V4 scene. Do **not** treat this document as prescribing particular splines, camera keyframes, durations, easing curves, animation packages, panel positions or copywriting. Choose the strongest artistic and usable approach, test it in a real browser, and explain the trade-offs only where they matter.

**Acceptance:** A visitor can recognize the world, identify how to navigate, choose any chapter directly, watch a coherent spatial transition, and immediately use the destination. The original six-shot scroll journey must remain available, and the V4 scene should remain recognizably intact.

### Relationship to the other chapters

- Chapter 03 **「青春 · 生长」** is now an explicitly approved theme: fresh green leaves evoke youthful energy, ongoing campus life and creativity. Its exact function grouping and interaction design will be decided when that chapter is discussed.
- Chapter 04's previously agreed design stays unchanged: V4 default oblique camera; reflective water reveals a usable **2D** campus map; a deliberate action unfolds **the entire campus into 3D**; selecting a place allows deeper detail; overhead camera is an optional toggle, not the default. The same tree remains rooted at the correct campus-relative location.
- For the other chapters, do not assume earlier proposed groupings are final. Clarify each chapter's symbolism and settle its functions **one by one** before committing to large-scale redesign.

### How to collaborate going forward

We will specify **intent, user value, approved decisions, essential constraints and what success should feel like** — not micromanage the creative solution. Claude is expected to exercise design and engineering judgement, try ambitious options, and present real screenshots or interactive previews so we can make informed choices.

Do not turn an unapproved idea into a hard requirement. Do not modify other chapters merely because a global redesign seems efficient. Preserve working features and existing worktrees; focus on one chapter at a time.


### Chapter 02 · 根脉 / 来处 — 沿着树干，走过校园历史（已确认）

**体验主题：** 树干承载过去，新叶正在生长。第二幕不是将「新闻档案 / 校友 / 建筑观察手册」摆成三个孤立的跳转卡片，而是让用户沿着真实 V4 树干的生长方向，经历一段可探索的校园历史。它最终自然通向已确认的第三幕「青春 · 生长」。

**已确认的设计要求：**

- **沿树干弧度展开空间时间轴。** 在 V4 第二幕已有的靠近树干、向上仰望的镜头基础上，将重要年代、事件、历史图片与资料融入围绕树干的空间组织；位置与节奏应回应树干的真实曲率和枝条结构。不是另外开一条独立的普通网页时间轴。
- **方向明确：从过去走向今天。** 时间顺序由树干下部的 **1923 年**（学校创办）开始，随相机向树冠、新叶方向上升，逐渐推进至当代。向上生长的空间方向与时间前进的叙事方向相一致，最终衔接第三幕的新绿叶片特写。具体节点须由可核实的史料决定，不能为了填满整段树干而杜撰。
- **滚动本身就是走过历史。** 沿用用户的自然向下滚动，镜头却在三维空间中顺着树干缓慢向上。历史段落可以适度放慢镜头节奏，让用户来得及观察事件与图片；不是要求所有节点匀速滑过。
- **可以停留阅读，也可以继续前进。** 用户可选择某个历史节点，阅读事件、照片、人物、建筑和出处；阅读时保持操作稳定，退出后顺畅恢复探索进度。应有快速选择年代/阶段的方式，不强迫回访用户从 1923 年逐年滑到今天。
- **校史为骨架，个人记忆为血肉。** 历史主干包含学校发展、重要事件、报道、校友与历史建筑；也允许纳入有日期、有来源或经当事人授权的旧照片、教师/学生/毕业生的校园生活片段、个人回忆。个人记忆与官方记载应清楚区分，不擅自推断年代、人物关联或真实性。
- **原有内容与功能不丢失。** 复用 news.html、alumni.html、architecture.html 等既有资料与能力，在时间节点内按真实关联呈现。尚无确切年代的校友身份、建筑材质研究等内容，可以由对应内容入口继续访问，但不要强行伪装为某一年的历史事件；正在发生的校园内容应与第三幕「青春 · 生长」形成清楚分工。
- **V4 与六幕世界保持连续。** 保留同一棵树、原有自然光、树木生长与已形成的相机空间关系。第二幕历史探索结束后自然进入第三幕，不重载或跳切到另一棵树；第一幕既定的快速镜头切换仍能直接前往其他章节，不必强制看完历史。
- **可信与尊重。** 每张真实照片、史料、回忆需有来源/出处及必要的授权与隐私处理；数字榄仁树为概念模型，不能把模型树皮或虚构年轮当成校史证据。缺资料可以坦诚留白，不填充看似真实的虚构人物、图片和事件。

**留给 Claude 的创造空间：** 以上只确立体验目标、内容原则与必要边界；不指定时间轴必须是某种曲线、某种标牌、某种悬浮相框、具体镜头关键帧、固定时长、速度曲线、Shader 或技术实现。Claude 应在真实 V4 场景中判断如何让历史与树干曲率、镜头上升、时间流逝形成自然且高级的视觉关系，避免把树干变成拥挤的展板。

**验收标准：** 用户能从 V4 第一幕进入第二幕，沿树干向上走过有出处的校园历史；辨认并打开节点的真实图片/资料，停留、退出并继续探索；能够快速定位年代或跳过第二幕；最后无割裂地到达第三幕「青春 · 生长」。桌面和移动端均能真正操作，并保留可访问性与减少动态的路径。

**实施节奏：** 当前阶段只记录已经确认的设计共识，不代表授权立即改造第二幕代码；在后续具体实施前检查现有仓库与真实内容资产，再提出原型与浏览器验证结果。


---

### Chapter 03 · 青春 · 生长 — 第三幕最终设计共识 V1.0（已确认）

> **核心命题：** 第二幕沿树干走过学校历史，第三幕来到阳光照透的新叶。历史讲述这所学校从哪里来；青春不只是展示已经完成的成果，更是让新作品、新想法与新的合作在这里发生。**学生的创作成为这棵树的一部分。** 这棵树不是荣誉墙，也不是普通校园论坛换上 3D 外壳。

#### 1. 空间关系与体验入口

- **A + B 的结合已确定。** V4 原有的榄仁树始终是真实的视觉与空间锚点：第三幕保留既定的绿叶微距机位，部分枝叶可以承载学生作品与创作方向。用户主动选择枝条/叶片或进入创作探索后，这一局部**展开为更广阔、更有层次的作品树冠空间**。它源自同一棵树，而不是强制替换为无关的第二棵树或另一套割裂网页。
- **正常滚动不强制进入社区。** 保留六幕连续的 V4 滚动观影路径：从第二幕的树干上升抵达第三幕新叶，再可自然进入第四幕。只有用户主动交互才深入展开作品树冠；支持直接抵达本幕和退出后回到进入前的镜头/探索状态。
- **枝条代表创作方向；叶片代表作品；相连的双叶代表两位作者的合作。** 多人合作、跨学科创作或衍生作品可形成更丰富的关系。双叶是重要的视觉创意意象，不是必须把每个多人作品强行切成固定数量的叶片。
- **作品可探索，而非粘贴式陈列。** 用户能够沿方向发现作品、选择作品后完整欣赏与阅读，也能进一步进入投稿、编辑和合作空间。照片不必直接贴在自然叶面上；树叶的真实质感、树冠形态与光学品质不应被缩略图或 UI 破坏。
- **探索时自由，创作时安静。** 在枝叶空间里发现内容和联系，进入长文阅读、照片整理、音频制作、表单提交时提供稳定、清晰、方便操作的界面。空间体验服务内容，而非让文本编辑被三维特效绑架。

#### 2. 内容与既有功能整合

- **两类内容共同构成第三幕：** 已完成、适合欣赏的公开作品；以及仍在推进、能够寻找参与者的共创项目。明确显示两者状态，并允许项目完成后转化为可独立欣赏的作品，作品在获授权后也可以衍生新的共创项目。
- **三种核心行为：发现、发起、共创。** 用户可浏览校园创作、照片和生活内容；发表自己的创意与作品或提出合作计划；在获得允许的情况下贡献新内容、合作或接续作品。
- **复用现有能力，不做四个孤立菜单：** 校园杂志（journal.html）提供校园内容与作品发现基础；社团提案（clubs.html）提供创意活动与项目发起基础；课间电台（life.html）承载校园生活表达、微小说等轻量内容；共感暗房（darkroom.html）已有照片显影、声景编排、导出与链接接力，宜成为可用的创作工具与共创起点。保留这些可用成果，组织为完整体验；实际功能缺口不得假装已存在。
- 真实校园记录、虚构故事、创作提案和校方正式活动要清楚区分；不能以虚构投稿、假的观看人数或假的活动来填满作品树。

#### 3. 创作者权利与作品生命周期

- **明确的发布机制已确定：** 私人草稿 → 作者主动申请投稿 → 必要审核通过 → 作者选择公开展示。没有审核通过的内容不得冒充公开作品；私人草稿默认仅作者可见。
- 作者决定是否允许共创、如何授权衍生使用以及是否撤回公开；合作、转载、改编与署名应尊重原作者与其他贡献者权利。公开展示应具备报告问题、处理不当内容和保护个人信息的机制，尤其注意涉及未成年人的照片及真实身份。
- **作品不必走完一条标准化流水线。** 独立作品可以直接完成；未完成的想法也可以被继续推进；项目可以有阶段性成果。作品成长记录仅公开经作者允许展示的版本和贡献，不暴露私人草稿。
- **作品身份与荣誉身份分离。** 作品的公开状态决定它是否可被发现；是否入选精选不决定它有没有资格在树上存在。

#### 4. 「找到我的叶子」——必须保留的情感核心

- **所有审核通过且作者选择公开的作品，都在作品树中拥有稳定、可抵达的归属。** 作者应能通过个人作品入口、创作方向或专属链接真正找到自己的作品，看到作品内容、署名及其关联。无需先获得推荐、排名或人气。
- 发布通过后，可自然引导作者「去树上看看」，以第三幕作品树中的真实归属给予创作正向认可；这不是仅弹出「发布成功」的通用反馈，也不是虚拟成就徽章替代作品展示。
- 作者能分享自己的叶片/作品链接；他人能抵达并欣赏，若作者授权也可进一步提出接力或参与合作。公开被撤回后，公共路径和展示权限必须相应更新，不以“永久荣誉”剥夺作者对公开状态的控制权。

#### 5. 共创接力与枝叶关系

- 合作可以在**同一主作品中贡献**，也可以在作者许可下从原作品**生长出独立衍生作品**；两种路径并存。任何形式都保留可追溯的作品出处、参与者及其真实贡献。
- 一个例子：校园摄影 → 经授权的诗歌回应 → 再发展为配乐/影像。作品与新创作相连，原作品不会被覆盖或被新作者“夺走”。相连双叶及其进一步生长，是这一关系的空间隐喻。
- 共创的评价重点是合作对作品和彼此创作的真实贡献，而非参与人数或点赞量。可以呈现具有启发意义的接力作品，但不承诺虚假的活跃度。

#### 6. 「向阳」——优秀创作与公平发现并行

- **编辑精选 + 同学推荐** 已确定：编辑侧重内容质量、创造力和表达价值；同学可以推荐喜欢的作品并附推荐理由。推荐是发现信号，不让点赞/票数自动决定全部排名，也避免把粉丝量当成作品价值。
- 同时保留**初生新叶**：新公开作品可得到轮流展示或被发现的机会，避免没有粉丝的同学永远被埋没；允许按方向浏览、搜索和分享所有公开作品。
- 可区分**本期向阳**（编辑精选）、**同学推荐**、**初生新叶**、**枝叶相连**（优秀共创与创意接力）。这些是内容职责与发现逻辑，并非要求固定四张卡片、四个面板或固定视觉布局。
- **向阳作品定期轮换，历期入选记录长期保留。** 新一期让新作品获得曝光；曾入选的作品在仍然公开时保留可查询的期数、入选说明与历史荣誉。荣誉记录不会要求作者永久公开，也不能长期垄断树冠最显眼的位置。
- 允许作品质量得到清楚、可信的认可；但避免强制排名、刷量竞争、以公开人气压低普通创作者参与意愿。策展标准与推荐机制应尽量透明且可维护。

#### 7. 可以生长的分类枝条（已确认选 B）

- **主枝相对稳定，细枝可以生长。** 初始主方向可覆盖摄影/影像、文学、音乐/声音、绘画/设计、数字创作等，具体组织可由内容和实际投稿决定，示例不是一套永久锁死的分类表。
- 学生可提出新的创作细分方向，经审核、去重和整理后纳入作品树的新枝条。不能让任意自由标签无节制地生成独立空间枝条；也不应阻止跨领域作品与多个方向建立联系。
- 创作方向应能随真实学生作品与学校社区发展，分类系统服务发现与共创，而非强迫艺术表达服从僵硬的树状目录。

#### 8. 规模、诚实性与可持续性

- 前期运行在免费云服务、投稿量预期较少：优先实现真实可用的投稿、审核、发现、找叶子与授权共创；避免为了想象中的百万用户过早引入昂贵、复杂的体系。
- **所有公开作品可被找到，不等于所有叶子/照片必须同时以独立高精度模型出现在屏幕。** 随规模增长可分层发现、按需载入、聚合等，但作品的稳定身份、可搜索性和作者的叶子归属不能被牺牲。
- 后续是否接入学校服务器、学校是否参与官方运营尚未经确认；不以此作为第一版必要前提。设计应能逐渐扩展，但不能假定已有学校背书或无限审核能力。

#### 9. Claude 的自由与不可越过的边界

**创作自由：** Claude 应在 V4 真实树冠、实际相机和现有内容基础上，自主提出最成熟的空间展开、枝叶叙事、交互、相机编排、光学表现、内容阅读以及数据映射方案。不要把上述概念机械地翻译成固定粒子、照片贴叶、树状图、分叉几何、玻璃卡片或预设 Shader；也不要锁定枝叶数量、固定节点坐标、相机样条、停留秒数、具体动画库、组件结构或技术栈。允许大胆探索、比较和迭代，避免 AI 式空洞标语与幼稚的特效堆叠。

**必要边界：** 保留 V4 树木与六幕世界连续性；正常滚动不强制进入社区；第四幕既定水面→2D 地图→主动展开整个校园 3D 的方案不变；不虚构参与度/作品/学校认证；维护真实审核、作者控制、作品来源与学生隐私；在手机、键盘、减少动态环境下能真正完成关键操作。

#### 10. 目标体验与验收

用户从第二幕百年树干进入第三幕新绿；可以不展开直接继续六幕旅程，也可以主动进入源于原树的创作树冠，辨认不同创作方向和已完成作品/进行中项目；可完整观看、阅读、保存私人草稿、申请审核公开；公开通过后能通过可分享的路径找到**自己的叶子**；作者授权后能与其他人合作、看到可追溯的共创关系；新作公平获得发现机会，精选作品按期轮换且历期荣誉可查；最后无缝返回原镜头继续进入第四幕。

**工作阶段：** 这是产品与艺术设计共识，不代表立即大规模改造代码或假定后台已具备全部能力。先核查现有模块和媒体、权限、审核能力，再由 Claude 自主提出实现方案与真实浏览器原型。我们提需求、核心价值与必要限制；Claude 负责设计如何把它做到最好。


---

## HAIZ · 四至六幕连续空间与手机漫游 — 已确认设计共识 V1.0（续记 2026-11-06）

> 本节补全此前第一、二、三幕之后的讨论成果，特别是 **04→05→06 的同一世界转换、方块人物、第一人称漫游、手机专属横屏过渡、双层地图与高保真优化**。保留前文已确认的第一幕快速导航、第二幕历史树干、第三幕创作树冠与「找到我的叶子」，不覆盖这些设计。前文较早写下的「待定」陈述应以本节及第三幕正式共识为准。**我们确认目标、行为和边界；具体美术、相机、技术实现交给 Claude 充分发挥。**

### Chapter 04 · 地图 / 空间 — 图纸就是这座校园（已确认并细化）

**意义：** 第四幕从高处认识空间及其结构，第五幕将同一座校园变为可以置身其中的世界。第四幕绝不是独立的地图网页，也不是一张假装被拉伸为 3D 的图片。

**明确保留的既定设计：**
- 保留 V4 第四幕**树冠俯侧视/斜俯瞰的默认机位**、水面反射及「水面显露校园地图」的叙事。俯视正交/俯视机位可以由用户主动选择，但**不替换默认斜视构图**。
- 默认提供清晰、可用的**二维校园平面阅读**；用户能够选择地点、理解校园道路与建筑，主动操作后可令**整座校园**而非只有单栋建筑展开为三维，并进一步进入选中建筑的局部细节或深入体验。不能因为要做第五幕而取消第四幕自身完整的 2D→3D 操作能力。
- 榄仁树仍处在同一个连续世界的正确相对位置，不替换为第二棵树或断裂空间；场景关系必须与 V4 已有相机和校园空间数据对得上。

**经用户明确确认的重要升级：借鉴 [Sam1983Aing/casa-serra](https://github.com/Sam1983Aing/casa-serra)。**
- **二维平面本质上是同一套三维校园几何在水平剖面及相应投影视角下的表达，而非独立贴图。** 参考原作说明的约 **1.2 米水平剖切**与长焦俯视平面表达，但数字为建筑示意参考，地形、道路、植被及复杂建筑可采用各自合理表达，不能机械切断一切物体。
- **平面与立体的建筑、坐标、道路和朝向应保持一致。** 用户先前在地图选择的目标地点应能传入后续漫游；如果已经将校园展开为 3D，就不必为了过场刻意压扁再重新升起。
- 这是一座真实三维场景的不同观看状态；**不能用两套内容互不一致的静态图/3D 页面，假装完成转换。** 可按需组织渲染资产，但共享权威空间数据和空间语义。

**从 04 向 05：**
- 正常滚动/章节导航沿 V4 已有第四幕至第五幕的镜头运动自然进行；原本仍处剖面阅读状态的校园随过渡逐渐恢复三维，形成「平面图纸真正成为建筑」的视觉感受。已经展开的校园保持立体状态。
- 用户也可以选择从地图主动前往第五幕；**不把这次导航误当成直接启动自由漫游**，第五幕仍有完整、独立的远眺停留。
- 第四幕选定的建筑或地点可延续为第一人称漫游的目的地；无需将人物直接传送到那里，默认仍可从榄仁树出发。目的地可以更换或清除。
- 在空间内容未足够精确时，诚实标记模型、实际校园导航、室内布局的近似性质；不得将想象教室/未测绘建筑冒称可现实进入的区域。

### Chapter 05 · 远方 / 探索 — 相机成为一个人（已确认）

**意义：** 第四幕是看懂校园，第五幕是看见可以亲自走入的校园。不是再造一套地图，也不是把原有校园第一人称网页粗糙嵌到一个按钮里。

**原镜头与新的身体叙事：**
- 保留 **V4 原有第五幕从树冠内望向远方的机位、轨迹关系与傍晚光影**，这是 04→05 的观赏停留与空间转折。不得为了便于人物控制而直接删掉经典的远眺构图。
- 用户已确认采用的 **05→06 方案 A：继续滚动推进电影式人物过程**。第五幕远眺后，第一人称人物的可见手臂、躯干、双腿逐渐成为画面的一部分，接着在合理的场景与镜头衔接下发生风格化的跃下/抵达地面段落，角色自然落地并恢复稳定，**然后回头望向榄仁树，进入第六幕**。
- 这段人物动作应与相机连续衔接，不是黑屏切换、页面重新加载或先突然生成一个独立玩家。尊重场景真实尺度与安全合理的落点，不要求从 V4 相机的抽象高度直接做物理上不合理的坠落。
- **人物风格确认：类似《我的世界》的简洁方块/像素感第一人称躯体**；仅人物采用鲜明风格化语言，**不将写实、高质量的校园与榄仁树一并降为低多边形世界**。没有必要追求昂贵、复杂的写实人体。
- **几何简洁、动作精致。** 人物不是只在屏幕底部机械摆动的两只手。低头能看见躯干和腿脚；动作具有合理的身体感、视线配合、步伐/环境反馈和连贯的落地缓冲。避免穿模、身体与相机分离、过度晃屏或仅靠震动制造真实感。动作/动画具体表现由 Claude 自行设计，不写死关键帧和骨骼方案。
- 原有 campus-3d.html（第一人称校园）、director.html（路线与取景点）、descent.html（从星球到树荫）应被视为**可继承的既有功能资产**，在新连续空间中重新整合，不盲目删除，不强迫用户每次经历电影式星球下降，不将它们做成三套割裂的世界。

### Chapter 06 · 回望 / 全盛 — 六幕电影终点与漫游起点（已确认）

- **第六幕以人物落地后的回头动作登场。** 再次看到原本那棵枝繁叶茂的 V4 榄仁树，形成与第一幕「初遇」的首尾呼应：最初从外面看树，最后已在世界里回望它。
- **第六幕回望需要停留。** 它是六幕电影真正的终章构图，不能回头的同一瞬间强迫用户走路，也不能为了进入漫游而破坏 V4 第六幕整体树形的艺术表达。
- **用户在第六幕再次主动向前操作，才从电影控制权转入第一人称漫游。** 电脑可用向前滚动或明显的等效确认；手机用明确可发现且不与触控环顾冲突的继续动作。第一次操作承担「交接控制权」，**不同时使人物突然前冲**。
- **后退滚动、章节跳转、快速直达第六幕仍可用。** 未进入漫游前，用户可返回第五幕，或选择其他幕；若通过第一幕快捷导航直达第六幕，不得强迫补放此前全部跃下动画，但要提供可理解的入场与交接体验。
- 漫游启动时人物的位置/朝向与当前回望镜头在逻辑上连续；不因为控制器切换把人物突然送去北门或加载另一片不相干的校园。
- **第六幕的既有功能不丢失：** 课间窗台 windowsill/index.html、物理实验室 physics-lab.html、HAIZ Pocket pocket/index.html、登录、书页/收藏与全站搜索等仍需要可发现的去向；如何与回望终章、全局菜单和工具入口协调，由 Claude 自主提出最成熟的方案，不要求强行铺满最后一屏。


### Cross-chapter · 漫游与地图是一套双向系统（已确认选择 B）

**最重要的原则：用户永远不被困在游戏里，也不必为了找地图重播整段电影。**

- **第一人称漫游 ↔ 随身地图**：已有第一人称漫游时，电脑可用 M 快捷键；手机必须有容易触达的触控入口。随身地图应快速打开/关闭，不播放 04 的完整镜头或建筑变形，保留玩家当前位置和方向。可用来确认当前位置、查看建筑和选择目标。
- **第一人称漫游 → 完整第四幕**：通过暂停/全局导航中的「返回第四幕」主动进入完整地图体验。相机从当前所在位置向高处过渡，完整建筑恢复适合阅读的二维剖面表达；**无需先强迫玩家返回榄仁树、或倒放整段 05→06 电影**。地图标示刚才的探索位置（如场景已有可靠定位信息）。
- **完整第四幕 → 恢复漫游**：返回漫游时保留先前玩家站立的安全位置、朝向和已选择的目的地，恢复三维校园；不无故重生在北门或榄仁树。另保留明确的「从榄仁树重新出发」选择。位置不可恢复时提供诚实、可理解的退路。
- **返回六幕**：用户能从漫游或地图明确选择回归第六幕回望构图、或使用六幕快速导航去任意幕；注意一旦退出漫游，应恢复滚动章节控制，而不是让滚轮同时控制相机和人物。
- **区分三种状态**：电影推进/章节滚动；第六幕回望停留/即将交接；玩家漫游/自由控制。外加随身地图、完整第四幕与菜单等可被打开的工作状态。每一种状态中的滚动、拖动、键盘、触屏含义要一致且互斥，不能因滚轮、上下滑动意外从漫游跳幕或从地图触发角色移动。
- **暂停、设置与无 UI 模式**：借鉴成熟游戏，有轻量、随时可唤出的全局菜单；能继续漫游、打开地图、返回六幕、快速导航和切换无 UI。**无 UI 是为了沉浸/摄影，不是降低画质的性能开关。** 隐藏 UI 后必须仍有可发现且可靠的方式唤回菜单和触控控制；人物身体可根据摄影目的选择是否显示，单独控制，不混同于 UI。
- 原有导演台的路线选择/机位保存、校园地点档案、摄影模式及既有漫游能力应可以被自然接入；无需强迫用户事先制定路线才能漫游。第四幕选定的目的地在漫游中可沿用、更改或取消。

### Mobile-first · 手机是主要舞台，不是电脑版的缩水适配（已确认）

**用户新增确认：在进入第一人称的关键时刻，专门为手机设计「从网页观影进入横屏操控」的转场，并让人物跃下/落地及随后接管控制的电影动作帮助完成这个体验转变。** 不只是简单弹出一句「请横屏」，也不要求把网页硬旋转 90 度当作真正的屏幕方向控制。

- **手机端的仪式感与横屏优先：** 04 的地图、05 的远眺和六幕电影可以保持适合手机当前方向的精致呈现；当进入人物跃下—落地—回望—接管控制的关键阶段，使用专门设计的手机转场与指引，把用户自然带向更适合第一人称漫游的**横屏操作布局**。动作、画面重构、控件显现的关系要让人觉得是同一场戏，不是切换页面或突然横向挤压 UI。
- **横屏是优先体验，不应假定浏览器有权限强制旋转实体设备。** 由 Claude 根据 iOS Safari、Android Chrome 和安装版/PWA 的实际能力选择合理方式：设备主动旋转时无缝重排，必要时做明确且可跳过的旋转提示；仅在浏览器许可的条件下考虑全屏/方向锁定。不能用纯 CSS 假横屏导致点按错位，不能把不愿旋转或无法旋转的用户卡在无法操作的空白屏。竖屏至少保有可用、完整的访问与退路；是否进入完整横屏漫游由用户可理解地选择。
- **手机操作已确认选择 B：默认简洁、按需显现。** 地图与菜单入口必须容易找；移动摇杆、环顾区和其他辅助控制在操作需要时出现或加强可见，闲置时自然淡出；首次进入应帮助用户理解移动、环顾、地图和退出方式。控件不应永久遮挡景观，也不应隐蔽到新用户无法发现。
- **触摸冲突必须彻底解决**：观看六幕时上下滑动推进电影；人物漫游时左右/上下触摸应承担环顾、移动等游戏操作；手机地图打开后切换为地图交互；回到电影时恢复章节滑动。旋屏前后需保留人物状态及必要 UI 操作可用性。
- **横屏进场动画需要适配真实设备变化**：不同长宽比、刘海/安全区、手机浏览器工具栏、转屏中断、用户横屏后再转回竖屏、首次进入/直接跳第六幕、已进入漫游后打开地图等。保持可访问、可取消、不中断的控制权逻辑。
- **减少动态效果/辅助输入**：对于系统减少动态设置、无法完成复杂手势的用户，提供简化动画和明确可操作的进入、退出路径。不会为了追求电影感剥夺使用能力。

### Quality & performance · 保持美术目标，先消除浪费（已确认）

- **手机视觉品质是第一等级设计目标。** 用户明确反对预设「电脑版高清、手机版廉价低画质」的方案；第五幕的方块人物是**主动选择的独立美术风格**，不是因为性能不足才把人物做坏。校园、榄仁树、真实光学玻璃/水面、自然光影和真实材质的目标保持一致。
- **性能优化优先优化计算/资源组织，而不是粗暴删减艺术特征**：共享 04/05/06 的几何、材质和权威场景数据；处理好可见性与遮挡剔除、实例化、远近层次、纹理传输/显存预算、流式加载、资源复用、动画更新范围、渲染循环与设备性能波动；选择对最终视觉观感影响尽可能小的策略。具体技术与取舍由 Claude 通过测量和实机对比决定，不能把任一技术当成硬性指令。
- **一套校园、多个呈现状态** 不等于所有模型永远全量驻留内存。第四幕的平面剖面、第五幕的完整三维、06 的玩家探索应该共享权威数据与坐标，并根据可见区域和进度按需准备渲染/碰撞资源，减少反复下载和不必要的全量加载。
- **不能承诺所有手机与高性能电脑逐像素一致或永远满帧**。遇到现实硬件上限时，优先保住关键构图、光影、树冠、材质和交互连贯性，并坦诚说明兼容性；可以采用视觉质量等效的内部优化，但不得把「直接降低所有材质、删光影」作为默认移动端方案。
- **必须实机检验**：至少在桌面浏览器及有代表性的 iOS/Android 移动浏览器验证加载、转屏、实际帧率/卡顿、内存、发热趋势、UI 安全区、触摸、减少动态模式、长时间漫游以及地图↔漫游↔六幕往返。桌面 M5 顺滑不等于普通学生手机能运行；优化方案以测量为依据，不凭空承诺性能。

### Implementation boundaries · 应明确的设计约束与保留自由

**Claude 必须实现/保留的用户可观察体验：**
1. 旧有 V4 六幕均可到达，第一幕可快速跳任意幕，第二幕树干校史与第三幕创作树冠不因后续改造失效。
2. 第四幕有水面与斜俯视的视觉叙事，有真实 3D 校园模型的约 1.2 米平面剖面视图及主动展开完整 3D 的能力；可选择建筑与深入探索。
3. 04→05 摄影机沿真实 V4 世界过渡、校园从 2D 恢复 3D（如已为 3D 则不重复变形）；第五幕原有远眺镜头有自己的停留与构图。
4. 05→06 通过继续滚动触发方块风格第一人称身体、风格化跃下与自然落地、回头看到完整榄仁树；第六幕暂停观赏，下一次主动操作才接管人物，正常返回章节可用。
5. 漫游时有完整可见第一人称躯体、足够协调的动作反馈与可靠碰撞；存在无 UI/摄影观察能力、随身地图、完整返回第四幕、回原位置、全局菜单以及完整六幕导航。
6. 手机有与身体落地/交接融合的横屏进场设计（尊重浏览器能力与用户转屏选择），默认简洁、需要时显现的操作 UI，不依赖物理键盘 M/Esc。
7. 免费后端阶段重视复用与成本；真实校园地图与模型明确模拟/近似属性；不虚称官方路线、官方建筑数据或学校支持。

**Claude 自主发挥的内容：** 相机镜头、人物入场动画、手机转屏意象、身体比例及动画、图纸美术、自然光和光学处理、地图与人物控制的 UI、转换节奏、性能工程、渐进加载、技术栈、资源组织、可访问性具体方案。禁止把本文件误解成一份逐帧分镜、固定秒数、着色器清单、按键坐标或需要原样照搬的 mockup。

**仍待实施中核实而非已拍板的细节：** 浏览器是否能合法锁横屏；不同手机上横竖屏漫游的最终操作手势；人物第一视角的具体外观与动作；跨段加载/状态管理的具体工程架构；学校服务器/校园真实资料的授权与可用性。为这些问题提出实测方案，不要冒充已实现。

**当前工作阶段：仅记录设计共识。** 未授权因本段文字自动重写当前主页、覆盖原有 worktree、提交 Git 或推送远端。具体实施前审查当前仓库与原型，保留已有功能，并提交分阶段可观察的真实预览以便用户决定最终美术效果。
