# HAIZ · 历史人物模型与人体运动系统完整调研报告（Section 01）

本报告对 HAIZ 仓库及所有相关实验分支中此前由 Claude（及 Codex / Hunyuan 实验）开发的人物模型、骨骼、材质、运动系统与历史验收数据进行了完整核查，严格区分「**已在代码与资产中真实实现**」与「**仅为设计目标或未完全落地**」。

---

## 一、全仓库人物系统谱系盘点

| 代际 / 分支 | 代表入口与路径 | 模型与骨骼 | 运动与控制实现 | 历史实测指标 |
| --- | --- | --- | --- | --- |
| **0. 方块人原型** | `lanren/world/body.js`<br>`lanren/world/skeleton.js` | 15 个 Box 拼装块体，无蒙皮 | 解析正弦摆臂摆腿 + 按最长支撑腿算髋高 `a.hip` | 无滑步实验室数据，纯第一/第三人称占位 |
| **1. 校园漫步 V1 / V2** | `claude/clever-bohr-w00gax`<br>`scripts/toon/build_student.py`<br>`lanren/toon/student.js`<br>`lanren/stroll/student.js`<br>`lanren/assets/toon/student.glb` (44.3 KB) | 几何体拼装单一 SkinnedMesh，**3,908 面，18 根骨骼**，白衬衫+绿领+深蓝裤+橙色书包，赛璐璐 + 反向外壳描边 (`cel` + `outlineMaterial`) | `THREE.AnimationMixer` 混合 `Idle / Walk / Run / Jump` 四段烘焙片段，无脚部 IK 与接地约束 | `docs/life-20261117.md` 实测：**匀速走 97.9% 支撑帧在滑步，跑/转身/起步 100% 滑步，全脚本平均滑速 51 cm/s** |
| **2. 「入画」第一版 (v1)** | `claude/stoic-davinci-w1ljtc`<br>`scripts/ruhua/build_student.py`<br>`lanren/ruhua/walker.js`<br>`lanren/assets/ruhua/student.glb` (291.3 KB) | Blender `Skin` 修改器 + `Subsurf` 生成连续管状身体，**8,952 面，22 根骨骼**（无手指、无扭转骨），刘海锯齿发帽 + 方形硬边书包 | 自研纯程序化步态 `walker.js`：世界空间脚印锚定 + 两骨 IK + 骨盆侧移/起伏 + 胸椎反扭 + 雨伞打开 + 头部注视 | `docs/life-20261117.md` 实测：**平均滑速 6.6 cm/s，但跑步向后仰「踢正步」(56.3% 滑步)，原地转先转根节点再补脚 (66.7% 滑步)，正面双臂外张成 A 字** |
| **3. 「入画 · 校园活着」** | `claude/loving-knuth-2k1siw` (PR #86, 已合入)<br>`scripts/life/build_people.py`<br>`lanren/life/gait.js` + `player.js` + `npc.js`<br>`lanren/assets/life/*.glb` (4 位人物) | MakeHuman 1.x CC0 `hm08` 基础网格裁剪服装 + 壳状头发，**28k–31.6k 面，51 根骨骼**（含五指 3 节） | 引入 MIT `three-procedural-locomotion` v0.3.0 (`HAIZ_MAPPING_HANDS`)，NPC 与玩家共用同一套步态，按日程表 A* 寻路、避让、手持物姿势覆盖 | `docs/life-20261117.md` 实测：**全脚本平均滑速降至 0.54 cm/s**；但地面探测器仅用 `heightAt(x,z)` 返回 `(0,1,0)` 法线（**无真实坡度与台阶梯级响应**），**面部偏冷白模型感**，无 Jog/Run 分级 |
| **4. 「入画 · 自由共游」** | `claude/project-thread-cguzm8` (PR #90, 已合入)<br>`lanren/free/rig.js` + `ride.js` | 复用 `lanren/assets/life/*.glb` 51 骨模型 | `rig.js` 实现世界空间两骨 IK（脚踩踏板、手握车把/滑板/扫帚）与 **0.45 s 逐骨本地四元数 slerp 上下车连续过渡** | `docs/free-20261122.md`：单车脚踝距踏板 8.3 cm、手腕距车把 6.1 cm，仅限载具态，未改动步行算法 |
| **5. 「六层手绘校园」** | `claude/adoring-dirac-u464gi` (未合并)<br>`lanren/painted/figure.js`<br>`docs/painted-campus-20261122.md` | 复用 51 骨人物模型 | **微风水粉厚涂人物着色器 (`createFigureArt`)**：受风场驱动的衣摆/发梢位移 + `uClothVel` 运动滞后惯性 + 暖色明部/冷紫蓝暗部 + 地面反射色 + 遮挡感知墨线（退除脸部刺痕） | 有完整对比截图，但未合并至 `main`，也未接入 Round 2 引擎 |
| **6. 「共游 Alpha」** | `codex/haiz-multiplayer-alpha` (PR #84, 未合并)<br>`lanren/multiplayer/avatars.js` | 复用 `ruhua` / `toon` 人物 | 距离分级远程人物节流（45 m 内全帧率，45–120 m 降为 15 Hz，上限 6 人） | 仅多人 Alpha 独立实验，无自身步态改善 |
| **7. 「混元学生与步态 A/B」** | `character-lab/hunyuan/` (已在 `main`)<br>`build.py` + `rig.py` + `paint.py` + `avatar.js`<br>`motion-ab/build-clips.js` + `driver.js` | 1.5M 雕塑减面出 **LOD0 (63.4k) / LOD1 (22.1k) / LOD2 (7.2k)**，**22 骨（含 `bag` 骨）**，真实 2K/1K/512 PBR 贴图（白 Polo 衫 + 湖蓝运动裤 + 白鞋 + 棕橙背包） | `avatar.js` 接 `walker.js` v1 程序化 IK；`motion-ab/driver.js` 用 `AnimationMixer` 播放 Quaternius UAL1 CC0 重定向片段 + 双骨 IK 脚底锁地 | `evidence/pose-results.json`：**肩膀伸缩高达 4.11×、腋下与融合肩带拉扯、裆部伸缩 5.69×**；`motion-ab.json`：B 组跑步前倾达 **35.1°** 过于夸张，右转支撑脚滑移 0.93 cm |
| **8. Round 2 现状 (PR #121)** | `world-reconstruction-r2/engine/world/vehicles.js` & `living-campus.js` | 玩家退回 **16 个无骨骼基础几何体拼接**（Capsule + Cylinder + Box）；NPC 虽异步载入 51 骨 MakeHuman GLB，但**未接 IK 也没有膝踝弯曲** | 玩家与 NPC 全部退化为 **`Math.sin(phase)` 单关节大腿前后摆动 + 整体刚体 `yaw` 旋转插值**；脚部悬空/穿地/滑步严重，典型「炮塔式转身」 | 无任何人体运动指标验证，人物质感严重拖累已获认可的 Round 2 校园建筑 |

---

## 二、「已真正实现」vs「仅为设计目标或半成品」对照核查

| 方向 | 真实落地状况 | 差距与遗留问题 |
| --- | --- | --- |
| **可编辑的骨骼角色模型** | **部分实现**：`scripts/life/build_people.py` (CC0 MakeHuman 51 骨) 与 `character-lab/hunyuan/build.py` (1.5M 雕塑 + `haiz-student.blend` 22 骨) 均可无头脚本重建。 | MakeHuman 面部缺乏艺术化温度且与海中学生服装/气质有模型感；混元母版的**双肩背包肩带与衬衫、腋下、裆部完全融合为单一连续壳体**，抬臂和跨步时产生 4.11×–5.69× 形变拉扯，且**没有斜挎包 (crossbody satchel)** 与扭转骨 (twist bones)。 |
| **实时多状态运动** | **部分实现**：`gait.js` 实现了 Idle / Walk / Run / Jump；`motion-ab` 测试了 Start / Walk / Jog / Sprint / Turn90 / Stop。 | `gait.js` 基于 v0.3.0，缺乏独立的 Jog 与 Run 分段控制（导致高速奔跑压低劈叉）；**缺乏真正的上下台阶步态、坡道倾斜适应、斜向移动 (strafe) 与减速急停折返 (Brake-Plant-Pivot)**；Round 2 完全未接入。 |
| **脚部 IK 与地面接触** | **在 `ruhua-alive` 中实现，Round 2 丢失**：v0.3.0 在平地实现 0.54 cm/s 平均滑步。 | `gait.js` 的 `heightGround()` 只返回垂直法线 `(0,1,0)`，**无法处理真实斜坡法线对齐与台阶踏面逐级落脚**；`walker.js` 缺乏软膝缓冲 (soft-IK)，腿伸直时膝关节偶发弹跳。 |
| **骨盆重心转移与支撑缓冲** | **部分实现**：`procedural-locomotion` v0.3.0 具备侧移、骨盆偏航/倾斜和膝盖缓冲，但参数按 1.83 m 成人调校，且缺少高动态启停质量感。 | Round 2 中骨盆完全僵直（`vehicles.js` 中 `torso` 甚至固定在 `y=0.78` 上无侧移、无倾斜、无起伏）。 |
| **胸廓与骨盆反向扭转** | **在 `gait.js` / `walker.js` 中部分实现**，但上身仅靠程序化曲线摆动，缺少真人动作捕捉的胸腔呼吸感与肩胛自然联动。 | `motion-ab` 虽接入 Quaternius 上半身片段，但存在与程序化下半身相位漂移及前倾过度（35.1°）问题。 |
| **视线—颈部—胸椎—骨盆—脚步转向级联** | **仅停留在设计目标 / 浅层实现**：`gait.js` 与 `player.js` 只有简单的头部注视叠加 (`lookAt`)，`v0.3.0` 行进中有轻微头胸提前量。 | **原地转身与急停折返仍存在明显「炮塔式转身」**：没有严格的「视线先行 → 头颈跟随 → 胸廓预转 → 重心切换 → 迈步/枢轴换向」五级时间级联；小角度转向（< 30°）时脚步也会无谓挪动或原地打滑旋转。 |
| **微风水粉厚涂角色艺术方向** | **在未合入分支 `claude/adoring-dirac-u464gi` 中实现**：`lanren/painted/figure.js` 完整实现了衣摆/发梢风场惯性滞后、冷暖调暗部与地面反弹光。 | 未集成到 Round 2 的 `南海晴光` / `入画水粉` / `建筑剖面` 三画境着色器管线中，目前 Round 2 人物只有生硬的标准 PBR 塑料感。 |
| **第三人称背影、斜挎包及服装细节** | **仅实现双肩背包**（`ruhua` 硬方盒、`life` 软背包、`hunyuan` 融合棕橙背包）。 | **「斜挎包 (crossbody satchel)」和衬衫下摆/马尾/包带次级物理摆动尚未在任何分支真正落地**；Round 2 的玩家角色是纯几何圆柱拼装。 |

---

## 三、Round 3 继承策略结论

1. **视觉母版继承**：以 `character-lab/hunyuan/source/20261121124835_b26256ec.glb`（用户认可的真实写意中学生比例与服饰气质）为核心造型源，保留「白色短袖校服 Polo 衫 + 湖蓝运动裤 + 白球鞋 + 棕橙背包」与「入画」的暖肤质感，**彻底修复腋下/裆部/肩带粘连拓扑，拆出独立模块网格，并新增可实时切换的帆布斜挎包与多角色变体（林知夏马尾、符老师、吴伯）**，绝不用通用 MakeHuman 模型替代。
2. **运动内核继承与跨越**：升级引入 `three-procedural-locomotion` **v0.11.0 (MIT)**（原生支持 Twist Bones、Jog/Run 分离、真实斜坡限制与楼梯检测）作为**零滑步下肢与平衡底座**，融合 **Quaternius UAL1 (CC0) + CMU Motion Capture (BVH)** 在 Blender 中严格重定向的上半身真实人类动捕韵律，并自研 **5 级生理转向级联控制器 (`turn-cascade.js`)** 与 **二阶弹簧次级运动系统 (`secondary-motion.js`)**。
3. **画境与环境融合继承**：继承 `claude/adoring-dirac-u464gi` (`figure.js`) 的水粉厚涂与微风滞后着色语言，将其无缝接入 Round 2 `CampusAtmosphere` 的双画境 (`南海晴光` / `入画水粉`)；继承 `claude/project-thread-cguzm8` (`rig.js`) 的双骨骑行 IK，让新人物顺畅衔接 Round 2 的单车与滑翔伞。
