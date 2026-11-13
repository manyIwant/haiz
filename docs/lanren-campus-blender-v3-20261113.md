# 第四幕与第一人称漫游共用的 Blender V3 校园

当前六幕首页的第四幕原先由 `lanren/map/campus3d.js` 生成体量与剖面，第五、六幕和漫游已经共用这套渲染。Blender V3 R3 是旧校园原型中的高精度源，本次将它接入了这条共用路径。

## 资产来源

- Blender 源文件 `HAIZ-BLENDER-V3/HAIZ-Campus-V3.blend` 的 SHA-256 为 `37ed29c0c191a5f27f3dddf6555cdd944e21329f4a69a711e69aede389b73e9b`，与 [历史导出清单](https://github.com/manyIwant/haiz/blob/787b7d39c9bdbf7ea269920d4ff1d1feb06f4dcf/prototypes/haiz-world/docs/v3/blender-assets.json) 一致。
- 旧原型 `prototypes/haiz-world/public/haiz/world/v3/assets/` 中的 `hero.glb` 提供一号楼，`campus.glb` 提供其余 25 个建筑、校门、亭子和连廊。两份输入的 SHA-256 分别为 `35d8680c7801db7a2b6dc775e9f95a1080e641b8c178e93133dca9f459c9a3d7` 和 `263a8f525b7eeca55c36fc52c45d41fd1601475717916a6d5fb2fff00d53f16d`。
- 网页使用 `lanren/assets/campus-v3/architecture.glb`（11.17 MiB）。合并时保留各建筑锚点及 PBR 纹理，移除与现有地面重叠的铺装边条，按建筑及材质合批并用 Meshopt 压缩几何。保留 752,666 个场景三角形，无抽稀。该资源包含用户提供的校园建筑及其程序材质。[原工程来源及许可](https://github.com/manyIwant/haiz/blob/787b7d39c9bdbf7ea269920d4ff1d1feb06f4dcf/prototypes/haiz-world/public/haiz/world/v3/ASSET-LICENSES.md)

## 坐标与交接

Blender 的 `(X,Y,Z)` 导出为 glTF 的 `(X,Z,-Y)`，单位是米。每个建筑锚点与 `assets/walk/campus.json` 的占地中心比对，再由第四幕和漫游共用的 `geo.frame` 平移、旋转到榄仁树原点。科技楼导出锚点的偏航符号与现行校园数据相反，本次采用地图的 −0.267 弧度。校园铺装和建筑基底在世界 Y = −0.83 米，树、岛、太湖石和校园树位沿用六幕已有资产与高度场。

第四幕的白卡、材质显影和后续漫游使用同一组 Blender 网格。每次只绘制当前选中建筑的既有剖面，供查看楼层。GLB 在接近第四幕时开始请求，一次载入供各幕与漫游共用。请求失败时继续使用原场景。一号楼门廊、图书馆台阶、门柱和连廊侧墙的碰撞按模型尺寸设置，门洞和廊下保留通行，脚底跟随连廊和亭子的台面高度。楼内通行维持室外漫游的原设计。

## 验证

Chromium（Apple M5 / ANGLE Metal）与 Playwright WebKit 桌面通过建筑锚点、材质渲染、碰撞和交接检查。默认构图采样 101 个电影机位，交接前后镜头位置一致。390×844 Chromium 触屏模拟验证了竖屏继续、摇杆移动、右侧拖动环顾和地图。模拟中断 GLB 请求，仍能进入漫游。测试入口为 `node tests/campus-v3-browser.cjs`，设置 `SHOTS` 可以保存实景截图。

M5 桌面中画质、一号楼固定漫游机位的 90 个帧间隔样本中，中位数 16.7 ms，P95 为 16.8 ms。

`npm test` 的旧版地理下降页 `tests/cinematic-runtime.cjs` 在本分支和基线 `917afc2` 均触发相同的渲染／释放断言。校园地图、模型与电影轨道的独立测试通过。

Safari 应用、iPhone／Android 真机、持续帧率、发热和弱网耗时尚未验证。坐标依据为项目内的校区模型。
