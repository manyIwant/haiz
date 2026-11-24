# HAIZ Twin · 海南中学府城校区数字孪生

这里是府城校区数字孪生的独立工程：数据、生成器、标定工具、导出的 GLB 和验证渲染都在 `twin/` 下，与网站现有的 `lanren/`、入画等模块互不依赖。

目标是**真实的府城校区**，不是“像海中的校园”。每个对象都带可信度标签和依据（写在数据文件里，导出后在 glTF 节点的 `extras.haiz_tag` / `extras.haiz_basis` 中），照片推断的尺寸一律按估计值标注，不当作测绘数据。

阶段报告：[`docs/PHASE1.md`](docs/PHASE1.md)、[`docs/PHASE2.md`](docs/PHASE2.md)（按标定照片重画榄仁树、重塑太湖石）· 资料来源库：[`evidence/sources.json`](evidence/sources.json)

前庭独立母版、五个新 GLB、离线预览和多机位对照见[前庭建模记录](docs/FORECOURT_ATELIER.md)。

## 目录

| 路径 | 内容 |
| --- | --- |
| `data/frame.json` | 孪生坐标系：原点、旋转角（暂定） |
| `data/buildings/yihao.json` | 一号教学楼参数（层高、开间、塔楼、翼楼、门廊、屋顶） |
| `data/site.json` | 前庭、中轴路、广场、台阶、绿篱、太湖石台座；各区标高 |
| `data/trees.json` | 百年榄仁树骨架（主枝、贴地巨石、树冠包络）与其他树木 |
| `data/gate.json` | 北门牌坊、石狮、围墙、门卫室（照片标定尺寸） |
| `data/yanchi.json` | 砚池：水位、岸石、叠石跌水、题石、椰子树 |
| `data/campus.json` | 由 Overture/OSM 转换的全校建筑轮廓、水体、用地（`tools/osm_campus.py` 生成） |
| `blender/` | 生成器：`build.py`（总控）、`b_yihao.py`、`b_site.py`、`b_trees.py`、`b_gate.py`、`b_campus.py`、`nature.py`（岩石/树/棕榈）、`arch.py`、`kit.py` |
| `tools/calib.py` | 用照片特征点反求水平相机，并给出检查点残差（hero-2560） |
| `tools/calib_lines.py` | 用照片上的直边反求可俯仰、横滚、带径向畸变的相机，结构参数一起拟合（lanshu-1600、jiaoxuelou-1600） |
| `tools/lanren_backproject.py` | 按标定相机把榄仁树的像素描线反投影成三维骨架，写入 `data/trees.json` |
| `tools/taihu_carve.py` | 按两张标定照片上的轮廓雕刻太湖石（构建时由 `b_site.py` 调用） |
| `tests/check_twin.py` | 轻量自检：数据与标签、标定残差、GLB 容器与标签、坐标锚点 |
| `tools/ortho.py` | 把仓库里的 Esri 影像重采样成孪生坐标系正射图（研究用，不入库） |
| `tools/osm_campus.py` | Overture 提取 → `data/campus.json` |
| `evidence/` | 资料来源库、相机标定点与残差报告 |
| `assets/phase1/` | 导出的分部件 GLB（Draco 压缩）与 `manifest.json` |
| `renders/phase1/`、`renders/phase2/` | 各阶段的多视角验证渲染与构建统计 |

## 坐标系

- 单位米；+x 校园东，+y 校园北（指向北门），+z 向上。
- 原点：中轴线与一号教学楼正立面的交点；WGS84 `19.99847892, 110.34254843`；校园北相对真北逆时针 41.0°（暂定，见 `data/frame.json`）。
- z = 0 为一号教学楼前的前庭道路；一号教学楼室内 ±0.00 在 z = 1.05（估计）。
- 导出 glTF 时 (x, y, z) → (x, z, −y)：在 three.js 里 −Z 指向北门。

## 可信度标签

`surveyed`（实测，本阶段没有）· `public-map`（OSM/Overture）· `documented`（文献或题刻）· `photo-derived`（照片量取，标定处注明残差）· `estimated`（间接推断）· `invented`（无证据的艺术补全）。组合如 `photo-derived/estimated` 表示主体来自照片、细部为估计。

## 运行

依赖：Python 3.13，`bpy==5.2.4`（Blender 作为 Python 模块）、`shapely`、`numpy`、`scipy`、`scikit-image`、`opencv-python-headless`、`pillow`。可选：Node.js 和 `@gltf-transform/cli`（pip 版 bpy 不带 Draco 编码器时用它压缩 GLB）。

```bash
python3.13 -m venv ~/.venv-twin
~/.venv-twin/bin/pip install bpy==5.2.4 shapely numpy scipy scikit-image opencv-python-headless pillow
npm install --prefix ~/.gltf-transform @gltf-transform/cli@4.5.1      # 可选
export HAIZ_GLTF_TRANSFORM=~/.gltf-transform/node_modules/.bin/gltf-transform
```

在仓库根目录：

```bash
# 构建全部部件，导出分部件 GLB，并渲染验证视角
~/.venv-twin/bin/python twin/blender/build.py \
    --glb-split twin/assets/phase1 --stats twin/renders/phase1/build_stats.json \
    --render front_eye portal flank_e oblique_ne oblique_nw aerial_n top lanshu taihushi gate_obl yanchi campus_n \
    --samples 48 --res 1600 1000 --renders twin/renders/phase1

# 与 hero-2560.jpg 像素对齐的北门视角（使用标定出的相机，半分辨率）
~/.venv-twin/bin/python twin/blender/build.py --only yihao site trees gate \
    --render gate_n --samples 48 --res 1280 674 --renders twin/renders/phase1

# 只构建某几个部件，另存 .blend
~/.venv-twin/bin/python twin/blender/build.py --only yihao site --blend /tmp/twin.blend

# 相机标定与残差
~/.venv-twin/bin/python twin/tools/calib.py twin/evidence/calibration/hero-2560.json \
    --out twin/evidence/calibration/hero-2560.report.json
~/.venv-twin/bin/python twin/tools/calib_lines.py twin/evidence/calibration/lanshu-1600.json \
    --out twin/evidence/calibration/lanshu-1600.report.json
~/.venv-twin/bin/python twin/tools/calib_lines.py twin/evidence/calibration/jiaoxuelou-1600.json \
    --out twin/evidence/calibration/jiaoxuelou-1600.report.json

# 榄仁树骨架：像素描线 -> 三维枝条，写回 data/trees.json
~/.venv-twin/bin/python twin/tools/lanren_backproject.py twin/evidence/calibration/lanshu-1600.tree.json \
    --write --out twin/evidence/calibration/lanshu-1600.tree.report.json

# 太湖石轮廓检查（构建时会自动雕刻）
~/.venv-twin/bin/python twin/tools/taihu_carve.py twin/evidence/calibration/taihu-silhouettes.json

# 自检（几秒；--carve 另外重算太湖石轮廓，约 20 秒）
~/.venv-twin/bin/python twin/tests/check_twin.py --carve
```

`lanshu`、`jiaoxuelou`、`gate_n` 三个视角使用标定出的相机（`build.py` 的 `CALIBRATED`），以 1600×1280 / 1280×674 的比例渲染即与原照片逐像素对应。

全量构建与导出约 2 分钟，每张 1600×1000、48 采样的 Cycles CPU 渲染约 1.5–4 分钟。所有程序化细节（次级枝、叶、岩石孔洞）都用固定种子，重复运行结果一致。

## 加载 GLB（three.js）

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
const loader = new GLTFLoader().setDRACOLoader(draco);
for (const part of ['yihao', 'site', 'trees', 'gate', 'campus']) {
  loader.load(`twin/assets/phase1/${part}.glb`, (g) => scene.add(g.scene));
}
// 每个节点的 userData.haiz_tag / haiz_basis 就是该对象的可信度标签和依据
```

`assets/phase1/manifest.json` 列出各部件文件、对象数和压缩前后大小。

检查页：在仓库根目录运行 `python3 -m http.server 8000`，打开 `http://localhost:8000/twin/viewer/`。`?tags=1` 按可信度标签着色，`?view=gate` 从北门看，`?view=top` 俯视；点选任一对象会显示它的名称、标签、依据和孪生坐标。three.js 与 Draco 解码器从 jsDelivr 加载（three@0.169.0）。

## 不入库的内容

- 第三方照片的像素：照片保留在仓库原有位置，只按路径和 git blob 引用；照片与渲染的叠加对比图只放在项目私有文件夹，不提交。
- `tools/ortho.py` 生成的正射研究图、Overture 原始提取文件。
- 学生个人信息、活动记录和安防细节：不采集、不建模（门卫室和闸机只建外形）。
