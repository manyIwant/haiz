# 首页移动端渲染性能：基准与优化（2026-11-22）

范围：`index.html` 首页的六幕榄仁树（`lanren/js/scene.js`、`foliage.js`）。
没有改动 `lanren/free/`、`ruhua-free.html`、`lanren/painted-lab/`、`tests/` 或 `.github/workflows`。
分支 `claude/project-thread-4zg80d`，未合并 main，未触碰 haiz.space 线上版本。

> **定位**：这是一组有依据的工作量优化和一套测量工具，**不是**“手机流畅度已经解决”的结论。
> 真机帧时还没有测（见第七节），在拿到真机数据之前不应作为发布结论。

## 一、结论

1. **画面不变**：12 张固定机位截图（low / medium × 六幕）逐像素对比，PSNR 59.8–67.6 dB，
   平均误差 0.011–0.028 个 8 位色阶，色差超过 2 级的像素 ≤ 0.06%。同一代码自己跑两次的噪声
   在同一量级（60.6 dB–完全一致）。肉眼不可分辨，见 `bench/results/optimized/contact-*.jpg`。
2. **确定的工作量减少**（与硬件无关，可直接核对）：
   * 后处理全屏 pass：low 5 → 3（第 1、4、6 幕）/ 4（第 2、3、5 幕）；medium 6 → 4 / 5。
   * 滚动穿越六幕时的环境光（PMREM）重烘焙：39 → 14 次，且不再每次新建并释放一张
     768×1024 半浮点渲染目标（原来每次烘焙都要分配一张）。
   * 第一幕（冬末空枝）所有尚未萌发的新叶（除去年残留的红叶外，几乎是整个树冠）：顶点着色器在第一行就退出，不再计算风、触碰和光照参数
     （主渲染与阴影两遍都受益）。
3. **在软件渲染（SwiftShader）上测得的时间**：交错 A/B（同一浏览器、同一视角、交替计时）显示第一幕
   low 档 −6.7%、medium 档 −16.1%；其余幕 ±2% 内，属于测量噪声范围。这台机器上帧时间被树冠几何与
   阴影主导，全屏 pass 在 SwiftShader 里很便宜，所以它**低估**了少两个全屏 pass 在填充率受限的手机 GPU
   上的收益。没有在真实手机上测过，下文“没有执行的测试”有说明。

## 二、瓶颈分析（实测）

在 390×844 @3x 手机模拟、low 档下，逐个隐藏物体测主渲染 pass 与阴影图的耗时（SwiftShader）：

| 隐藏的物体 | 第 1 幕主渲染 | 第 1 幕阴影 |
|---|---:|---:|
| 无（全部） | 1159 ms | 1003 ms |
| 树冠 5.1 万片叶子 | −721 ms（62%） | −765 ms（76%） |
| 树干（44.7 万三角形） | −180 ms | −220 ms |
| 第 5 幕的校园建筑（50.9 万三角形） | 第 5 幕 −1221 ms | |

其他发现：
* 后处理链 ScenePass → 大气 → 对焦 → Output → 调色。对焦 pass 在光圈为 0 时只是原样复制，
  调色可以并入 Output 的同一次着色。
* `setStage()` 用两位小数的天空参数做键，滚动时几乎每帧都变 → 每帧一次 `pmrem.fromScene()`，
  而 three r170 的 `fromScene()` 每次都新分配一张渲染目标。
* 阴影图 low 档每 3 帧、medium 每 2 帧刷新一次，刷新那一帧比其他帧贵约 30–50%，会造成帧间不均。
  这一点没有改（见“建议”）。

## 三、改动

| 文件 | 改动 | 画面影响 |
|---|---|---|
| `lanren/js/scene.js` | `FinishOutputPass`：调色/暗角/颗粒写进 OutputPass 的片元着色器末尾，替代单独的 ShaderPass；`uniforms`（含 `uVig`）保持同名，`lanren/map/layer.js` 依旧按“最后一个 pass”找到它 | 去掉一次半浮点中间缓冲，最多 ±1 色阶 |
| `lanren/js/scene.js` | 光圈 < 0.01 时 `focus.enabled = false`（着色器在这时本来就原样输出） | 无 |
| `lanren/js/scene.js` | PMREM 复用一张目标（`reusePMREMTarget`，见第六节守卫）；天空持续变化时最多每 3 帧烘焙一次，停下后最后一次一定会烘焙 | 滚动中环境光最多滞后约 0.1 秒；静止画面相同 |
| `lanren/js/foliage.js` | 叶片顶点着色器：`scl == 0`（未萌发 / 已落）时直接把顶点放到裁剪体外并返回 | 无（这些叶片本来就塌成一个点，不产生像素） |

## 四、基准工具（`bench/`）

* `home-bench.cjs`：加载耗时、每幕帧时间（含 GPU 同步）、draw calls、三角形、逐 pass 耗时分解、
  连续滚动帧时间与 PMREM 次数、CPU 节流下的纯模拟耗时、内存。`--site` 可测另一个 checkout。
* `stills.cjs`：每张截图都在全新页面里拍：`?capture=1` 让页面循环从暂停开始，`Math.random` 固定种子，
  `performance.now` 换成只随固定步长前进的虚拟时钟（相机“呼吸”读它）。
* `compare.cjs`：两次运行的时间对比表 + 截图 PSNR / 误差 / 差异热图 + 缩略对照图。
* `ab.cjs`：两个 checkout 同时打开，同一视角交替计时，取中位数和逐对比值，用来压住 SwiftShader 噪声。

用法见 `bench/README.md`。

## 五、验证记录

### 实际执行过的

| 测试 | 结果 |
|---|---|
| `node bench/home-bench.cjs`（main worktree 与本分支，low + medium，CPU 4× 节流） | 完成，报告 `bench/results/{baseline,optimized}/report.json`，对比 `bench/results/optimized/compare.md` |
| `node bench/stills.cjs` 两次跑 main，检查确定性 | 六幕中 3 幕完全一致，其余 ≥ 60.6 dB |
| `node bench/stills.cjs` main vs 本分支，low + medium | ≥ 59.8 dB，见上 |
| `node bench/ab.cjs` low（9 轮）/ medium（5 轮） | `bench/results/optimized/ab-{low,medium}.json` |
| `node tests/lanren.cjs` | 通过 |
| `node --test tests/home-mobile.test.cjs` | 3/3 通过 |
| `node tests/home-mobile-browser.cjs` | PASS |
| `node bench/env-stability.cjs`（复审后新增） | 全部通过，见第六节 |
| 本分支 + #89 集成候选：`tests/rings.cjs`、`tests/rings-browser.cjs`、`tests/home-browser.cjs` | 全部通过，见第六节 |
| 截图与基准运行期间的页面错误 / 控制台错误 | 0 |

交错 A/B 结果（毫秒为 SwiftShader 时间，不是手机帧率）：

| 幕 | low：main → 本分支 | 比值 | medium：main → 本分支 | 比值 |
|---|---|---:|---|---:|
| 1 | 2258 → 2104 | 0.933 | 7671 → 6284 | 0.839 |
| 2 | 2801 → 2814 | 0.999 | 7458 → 7319 | 0.983 |
| 3 | 3289 → 3276 | 0.990 | 7758 → 7825 | 1.021 |
| 4 | 3988 → 4032 | 1.001 | 10818 → 10536 | 0.982 |
| 5 | 3987 → 3846 | 0.979 | 8507 → 8617 | 1.013 |
| 6 | 4149 → 4111 | 1.008 | 12089 → 11987 | 1.010 |

### 没有条件执行的

* **真机测试**：没有在任何 iPhone / Android 上跑过，也没有用真实 GPU 计时（`EXT_disjoint_timer_query`），
  没有温度 / 降频、真机内存和真机动态截图数据。所有毫秒数都来自 CPU 上的 SwiftShader（数秒一帧），只能当相对比较。
  测量工具已备好（第七节）。
* **动态阶段的画面一致性**：截图对比覆盖的是六幕各一个固定时刻；滚动过渡中间、年轮模式、走进校园后的漫游没有逐像素对比。
* high 档没有跑（最慢，且手机默认不会选到）。
* `tests/home-browser.cjs`（仓库注释说它在 SwiftShader 下有一项不稳定的落叶拾取检查）和其余页面的浏览器测试没有跑。
* 报告里 optimized 的 commit 标为 `b7ad45d+dirty`：基准是在提交前用同样的工作区代码跑的，内容与本分支提交一致。

## 六、复审后补充（PR #91 review）

### P1：在 #89 集成候选上重跑完整工作流

本地把本分支与 #89（`claude/project-thread-1u9ob3`，测试稳定化）合并成一个不推送的集成分支，按
`.github/workflows/rings-qa.yml` 的顺序跑：

| 步骤 | 结果 |
|---|---|
| `node tests/rings.cjs` | 通过 |
| `node tests/rings-browser.cjs` | 11/11 通过 |
| `node tests/home-browser.cjs` | **PASS**（跳转 news.html 在 44.8 s 完成） |

在加入下面的 PMREM 守卫后，用同一集成候选又跑了一次 `home-browser.cjs`（结果见下方“守卫改动后复验”）。
PR #91 自己的 CI 仍是红的，因为它运行的是 main 上未稳定的 `home-browser.cjs`；按分工本 PR 不改 `tests/`。
建议的顺序：先合 #89，再对 #91 重跑工作流，绿了才考虑合入。

### P2：私有 API 的守卫与资源稳定性回归

`pmrem._allocateTargets` 不是公开 API（three r170 的 `fromScene()` 没有传入目标的参数；更新的版本才有 `renderTarget` 选项）。现在封装为 `reusePMREMTarget()`：

* 只在 `THREE.REVISION === '170'`（验证过的版本）时启用；升级 three.js 后自动回到原生的每次分配路径，不会静默出错，`world.envStats.reason` 会写明原因。
* 每次仍调用原方法（它顺带维护生成器自己的 ping-pong 目标），只有当新目标的宽、高、映射与保留目标一致时才复用，并丢弃那个从未上传到 GPU 的新对象；不一致就释放旧的、改用新的。
* 保留的目标被外部 `dispose()` 时会放手，下次重新分配。
* `world.envStats` 暴露 `active / allocations / bakes / target`，供回归使用。

新增 `bench/env-stability.cjs`（真实首页、手机模拟），全部通过：

| 检查 | 结果 |
|---|---|
| 3 次 0→5→0 滚动中的重烘焙 | 120 次烘焙，只分配 1 个目标，纹理数 17 → 17，`scene.environment` 始终指向它 |
| 环境光不陈旧 | 走到第 3.5 幕时纹素平均变化 0.1156；回到第 1 幕后与初次只差 0.00049（0.42%，小于页面重烘焙键的一个步长） |
| resize + `adapt()` 式像素比下降 | 同一个目标，下一次天空变化照常烘焙，同视角纹理数不变 |
| WebGL 上下文丢失再恢复 | 收到 lost / restored，之后照常烘焙进同一目标，仍绑定为环境光 |
| 页面错误 / WebGL 错误 | 0 |

### 守卫改动后复验

* 截图（`bench/results/guarded/compare.md`）：low 六幕 58.3–64.9 dB、medium 六幕 52.9–68.3 dB，色差 > 2 级的像素 ≤ 0.48%。
  最低的一张（medium 第 1 幕）差异集中在画面左缘一小块和零星光点（飘落叶 / 光尘的位置），渲染路径与上一轮完全相同，
  上一轮同一张是 61.2 dB，属于截图工具残余的模拟状态差异，不是渲染改动造成的。
* 本分支（含守卫）+ #89 集成候选：`tests/home-browser.cjs` **PASS**（跳转 news.html 41.9 s）。
* `bench/env-stability.cjs`：全部通过（上表）。

**升级 three.js 时的注意事项**：`reusePMREMTarget` 绑定 r170。升级后它会自动停用（回到每次烘焙分配一张目标，功能正确、只是失去这项节省）；
如果新版本的 `PMREMGenerator.fromScene()` 已支持 `renderTarget` 选项，改用公开参数并删掉这个函数，然后跑 `node bench/env-stability.cjs` 确认。

## 七、真机测量（尚未执行，可选）

按复审意见，真机数据不是推进开发的前置条件；有设备时做有代表性的实际体验和对照即可。本环境没有手机，以下未做。为了让真机数据可以直接拿到，新增 `bench/device-probe.js`：
在手机上打开首页（本分支可在电脑上 `npx http-server` 后用局域网地址打开，或打开 haiz.space 测线上版对照），
用 Safari Web Inspector / `chrome://inspect` 连接，把文件内容粘进控制台即可。它用页面自己的动画循环（真实 GPU）
把六幕走两轮，每幕输出帧间隔 P50 / P95 / 最大值、实际 fps、超过 50 ms 的长帧数、结束时的像素比（页面在卡顿时会
自行降低它）、draw calls、JS 堆（浏览器提供时），并给出第二轮相对第一轮的 P50 变化——同一视角第二轮变慢通常是
热降频的迹象。脚本已在模拟环境自检能跑通（数值无意义，是 SwiftShader）。建议至少测一台中端安卓和一台 iPhone，
分别对 main（haiz.space）和本分支各测一次，并记录机型、系统、浏览器、电量与是否在充电。

## 八、建议（未实施）

1. **阴影图分摊**：现在每 2–3 帧整张重画一次，刷新帧明显更贵。可以把静态投影物（树干、岛）
   和摇动的叶子分开缓存，或者把刷新改为每帧更新一部分。需要美术确认软阴影观感，所以没动。
2. **树干 LOD**：44.7 万三角形，各个机位都全量画两遍（主渲染 + 阴影）。在 Blender 构建流程
   （`scripts/lanren/build_tree.py`）里导出一个给阴影用的减面版本，收益明确、画面风险小，但需要 Blender。
3. **真机基线**：用 Safari / Chrome 远程调试在一台中端安卓机和一台 iPhone 上跑 `home-bench.cjs`
   的同样场景（可以改成 `?bench` 页内脚本），得到真实帧时间后再决定是否值得做 1、2。
