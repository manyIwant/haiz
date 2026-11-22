# 首页移动端渲染性能：基准与优化（2026-11-22）

范围：`index.html` 首页的六幕榄仁树（`lanren/js/scene.js`、`foliage.js`）。
没有改动 `lanren/free/`、`ruhua-free.html`、`lanren/painted-lab/`、`tests/` 或 `.github/workflows`。
分支 `claude/project-thread-4zg80d`，未合并 main，未触碰 haiz.space 线上版本。

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
| `lanren/js/scene.js` | PMREM 复用一张目标；天空持续变化时最多每 3 帧烘焙一次，停下后最后一次一定会烘焙 | 滚动中环境光最多滞后约 0.1 秒；静止画面相同 |
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

* **真机测试**：没有在任何 iPhone / Android 上跑过，也没有用真实 GPU 计时（`EXT_disjoint_timer_query`）。
  所有毫秒数都来自 CPU 上的 SwiftShader，只能当相对比较。
* high 档没有跑（最慢，且手机默认不会选到）。
* `tests/home-browser.cjs`（仓库注释说它在 SwiftShader 下有一项不稳定的落叶拾取检查）和其余页面的浏览器测试没有跑。
* 报告里 optimized 的 commit 标为 `b7ad45d+dirty`：基准是在提交前用同样的工作区代码跑的，内容与本分支提交一致。

## 六、建议（未实施）

1. **阴影图分摊**：现在每 2–3 帧整张重画一次，刷新帧明显更贵。可以把静态投影物（树干、岛）
   和摇动的叶子分开缓存，或者把刷新改为每帧更新一部分。需要美术确认软阴影观感，所以没动。
2. **树干 LOD**：44.7 万三角形，各个机位都全量画两遍（主渲染 + 阴影）。在 Blender 构建流程
   （`scripts/lanren/build_tree.py`）里导出一个给阴影用的减面版本，收益明确、画面风险小，但需要 Blender。
3. **真机基线**：用 Safari / Chrome 远程调试在一台中端安卓机和一台 iPhone 上跑 `home-bench.cjs`
   的同样场景（可以改成 `?bench` 页内脚本），得到真实帧时间后再决定是否值得做 1、2。
