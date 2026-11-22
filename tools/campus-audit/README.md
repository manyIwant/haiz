# tools/campus-audit · 校园空间校验工具

这个工具只读取数据，不修改任何校园数据。它检查仓库里描述校园空间的每一份数据：这些数据彼此是否一致、在物理上是否说得通、能否走通、和公开影像能否对上，以及每一项内容有没有如实标明来源。

```bash
node tools/campus-audit/audit.mjs            # 打印检查结果；有 error 时退出码为 1
node tools/campus-audit/audit.mjs --strict   # warning 也会让退出码为 1
node tools/campus-audit/audit.mjs --write    # 写入 docs/campus-audit/audit-output.{md,json}
node tools/campus-audit/audit.mjs --json     # 输出机器可读的完整结果
node tools/campus-audit/audit.mjs --allow-incomplete   # 缺少必需数据源时仍继续运行：结果标为 INCOMPLETE，退出码不为 0
node --test tools/campus-audit/test/*.test.mjs   # 单元测试，同时对当前仓库跑一遍校验
node tools/campus-audit/capture.mjs          # 用 Playwright 生成影像叠加截图（需要 Chromium）
```

只需要 Node 18 及以上版本，不依赖任何 npm 包。叠加截图需要 Playwright，云端开发容器已经预装。

## 检查内容

| 检查 | 内容 | 数据来源 |
| --- | --- | --- |
| `sources` | `campus.json`、`campus-data.js`、`data/buildings.json` 三份副本是否一致；派生字段（`size`、`_u/_v/_w/_d`、层数×层高）是否与平面矩形一致；Blender V3 GLB 的 `SITE_*` 锚点是否落在数据中心；碰撞体样本是否落在对应建筑上 | `assets/walk/*`、`data/buildings.json`、`lanren/assets/campus-v3/architecture.glb`、`tests/fixtures/life-colliders.json` |
| `space` | 实体建筑是否互相重叠；连廊伸进建筑的程度；道路是否穿墙；水体与建筑是否重叠；树点是否落在墙内、水中或底图外 | `campus.json` |
| `scale` | 跑道与标准 400 m 跑道对比；按场地网格和标准球场尺寸检查球场能否放下；层高是否落在常见范围；各类建筑高度是否只是套用统一规则 | `campus.json`、`data/campus-sports.json` |
| `network` | 路网连通性；校门是否接入路网；建筑与门的位置是否靠近路网；导览站点和镜头是否指向真实存在的要素 | `campus.json`、`lanren/life/places.js` |
| `georef` | 旧的高德（GCJ-02）锚点与模型的距离和方位；用人工判读的影像控制点做最小二乘相似变换拟合，求旋转、比例、残差，并做留一法检验 | `assets/cinematic/aligned/manifest.json`、`control-points.json` |
| `credibility` | 把 `data/campus-credibility.json` 展开到每一个要素；没有在仓库中引用原始测绘文件就标为 `surveyed` 的条目一律判为 **error**；检查引用的文件是否存在；扫描访客页面和数据中未加限定的“实测 / 测绘 / surveyed / measured”措辞 | `data/campus-credibility.json`、若干页面 |

**缺少必需数据时直接失败（fail closed）。** 以下数据源是必需的：`campus.json`、`campus-data.js`、`data/buildings.json`、`data/campus-sports.json`、`lanren/life/places.js`、Blender V3 GLB、影像 manifest 及其引用的每一张影像、`control-points.json`、`data/campus-credibility.json`。其中任何一个读取失败都会报 `error`，依赖它的检查会显示为 `skip`，不会悄悄跳过。碰撞体样本和校史数据是可选数据源，缺失时只报 `warn`。

**适用范围。** 这是对仓库内数据的一致性和证据标注审查，**不是实地测绘验收**。CI 显示绿色不能代替精度验收，通过审查也不代表模型与校园 1:1 吻合。审计**不读取 `twin/**`**（#92 的高保真重建）：它的 GLB 和 `twin/data/buildings/*.json` 需要先写好对应的读取适配，才能纳入审计范围。

CI：`.github/workflows/campus-audit.yml` 只在相关路径发生改动时触发，会依次运行单元测试和审计，出现任何 error 都会失败。

严重程度说明：`error` 表示数据自相矛盾，或把内容冒充为实测；`warn` 表示需要人工核实；`info` 表示背景说明；`pass` 表示检查通过。

## 可信度标签

| 标签 | 含义 |
| --- | --- |
| `surveyed` | 现场测量得到，且原始测量文件（KML/GeoJSON/DXF/CSV/点云等）保存在本仓库。**目前没有任何条目满足这个条件。** |
| `public-map` | 读取自公开地图或影像，来源、日期和方法都有记录 |
| `estimated` | 依据照片推断、套用通用尺寸，或来自已无法核实的旧数据 |
| `invented` | 为体验而创作，没有空间依据 |
| `documented` | 名称、用途等非空间事实，来自公开文献 |
| `photo-derived` | 依据带标定的照片量取尺寸，并注明标定残差。该标签与 twin/ 三维重建（#92）共用。也接受 `photo-derived/estimated` 这类组合标签，前一部分描述主体，后一部分描述细部 |

以后如果加入真实测绘，请先把原始文件提交到仓库，例如 `data/survey/…`，再在 `data/campus-credibility.json` 中把对应条目改为 `surveyed`，并同时满足以下两点：

- 在 `sources` 里写明该文件的路径。文件必须能被解析为测量数据：GeoJSON 或 KML 中要有数值坐标，CSV 至少要有两行数值，LAS、E57、PLY、DWG 要带有各自的格式签名。空的 `{}` 不算测量数据。
- 写上 `"survey": {"method", "date", "surveyor", "accuracy"}`，缺少任何一项都会报 error。
- 文件中的坐标必须**落在该对象上**。工具用影像拟合预测该建筑在地面上的位置，再与测量几何的中心比较，容差为占地半对角线 + 3×RMS + 10 m。测的是别的建筑，或者坐标参考系不是 WGS84 经纬度、因而无法核对位置时，都会报 error，不予认可。

组合标签里只要有任意一段是 `surveyed`（例如 `surveyed/estimated` 或 `photo-derived/surveyed`），就和单独的 `surveyed` 一样接受上面全部检查，不能借组合标签绕过。

**`surveyed` 通过只说明满足了可接受的条件，不等于实测认证。** 工具只检查四件事：格式、坐标、位置与对象相符、元数据齐全。它**无法**验证测量是否真实发生，也无法验证声称的精度。

树点按每个点单独展开（`tree-0` 到 `tree-299`），所以可以对单个树点单独覆盖标签。但目前 300 个点共用同一条依据（invented），没有任何一棵树与真实的树一一对应过。

## 控制点

`control-points.json` 里的 6 个点是人工在仓库已有的 Esri 影像（约 0.55 m/px）上判读的地物中心，每个点都附有判读者给出的不确定度 σ。它们是影像判读结果，不是测量值。增加控制点只需编辑这个文件并重新运行，最好选择角点清晰的低层建筑，因为高楼的屋顶在影像中会因视差而偏离实际占地位置。

`overlay.html` 是交互式叠加页：在仓库根目录运行 `python3 -m http.server`，再打开 `/tools/campus-audit/overlay.html`，可以切换路网、树点，以及“按原声称的 41.4° 和比例 1.0 摆放”的对照视图。

## 文件范围

本工具只写入 `docs/campus-audit/`（使用 `--write` 或运行 `capture.mjs` 时），不会改动渲染代码、`lanren/`、`tests/` 或 CI 工作流。
