# HAIZ 动物验证码 · 资产与第三方授权说明

本目录（`preview/haiz-verifier/`）所有模型、材质与代码均具备清晰可追溯的来源与合法授权，未使用参考视频中的任何素材、角色或品牌元素。

## 一、3D 动物玩偶模型与程序化材质（原创）

- 文件范围：
  - `assets/models/duck.glb`（黄鸭子 🐤）
  - `assets/models/panda.glb`（黑白熊猫 🐼）
  - `assets/models/fox.glb`（橙色狐狸 🦊）
  - `assets/models/frog.glb`（绿色青蛙 🐸）
  - `assets/models/pig.glb`（粉色小猪 🐷）
  - `assets/models/elephant.glb`（浅蓝色大象 🐘）
  - `assets/models/manifest.json`
  - 完整建模与导出源码：`src/animals/builders.js`、`src/animals/plush-kit.js`、`src/animals/glb-exporter.js`、`src/animals/catalog.js`、`scripts/export-animals.html`、`scripts/export-animals.py`
- 来源与技术说明：
  - 六款动物几何、顶点色花纹、128×128 无缝短毛绒法线贴图与 5 段标准 glTF 骨骼/节点动画（`idle` / `touch` / `lifted` / `land` / `celebrate`）均由上述开源源码在本地程序化生成并导出为标准 glTF 2.0 Binary（`.glb`），不依赖任何外部闭源贴图或商业模型。
  - 短毛绒 PBR `sheen` 材质与程序化雕塑思路延续自本仓库 `haiz-campus-toybox-original/src/toys/kit/`，原有校园角色资产完整保留在 `haiz-campus-toybox-original/` 中未被覆盖或删除。
- 授权协议：随本仓库主协议授权（MIT / 仓库 `LICENSE` 与 `ARTWORK-LICENSING.md`）。

## 二、三维渲染引擎与第三方依赖

- **Three.js（r170）**：复用本仓库 `lanren/vendor/three/`，不依赖外部 CDN。
  - 许可证：MIT License（详见 `lanren/vendor/three/LICENSE`）。
- **验证协议与适配器**：复用本仓库 `haiz-campus-toybox-original/shared/` 与 `haiz-campus-toybox-original/src/challenge/adapters/`（Mock / HTTP / Cloudflare Turnstile 接入规范）。
- **系统 Emoji 与字体**：界面任务提示与无障碍名单使用的动物 Emoji（🐤🐼🦊🐸🐷🐘）与无衬线/衬线字体均使用系统原生字形，不打包第三方版权字体文件。
