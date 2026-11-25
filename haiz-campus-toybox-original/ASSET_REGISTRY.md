# ASSET_REGISTRY · Campus Toybox 角色资产规范与复用指南

> 本资产体系专为未来 **HAIZ Campus Toybox 校园收藏馆**、学生个人空间与三维校园漫游设计。所有角色均可脱离抓娃娃机独立加载、实例化与扩展。

---

## 一、统一规范（Asset Specification）

- **注册表版本**：`1.0.0`
- **坐标系**：右手系 **Y-up**，角色正面向 **+Z**，原点 `(0, 0, 0)` 位于角色自然站立/坐姿的底面中心（`y = 0`）。
- **物理尺度**：国际单位制 **米（m）**，桌面手工玩偶比例，高度范围 `0.145 m – 0.178 m`（约 14.5 – 17.8 cm）。
- **稳定 ID 规则**：采用 `haiz.toy.<id>` 命名空间，一经发布**永不重命名或复用**。
- **双轨交付**：
  1. **标准独立三维模型**：`assets/models/<id>.glb`（含 PBR 材质、嵌入程序化纹理及烘焙后的 7 组标准 glTF `AnimationClip`）。
  2. **可编辑程序化源码**：`src/toys/characters/<id>.js` + `src/toys/registry.js` + `src/toys/kit/*`，可通过 `npm run export:assets` 一键重新生成全部 `.glb`、`.png` 纹理与 `assets/registry.json`。

---

## 二、角色登记表

| 稳定 ID | 名称 | 定位 | 高度 (m) | 独立 GLB 路径 | 主题外观扩展 |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `haiz.toy.lanren` | **仁仁 (Lanren)** | 榄仁树精灵 · HAIZ 吉祥物 | 0.178 | `assets/models/lanren.glb` | `classic`, `autumn` |
| `haiz.toy.wuwu` | **午午 (Wuwu)** | 午后暖阳抱枕精 | 0.155 | `assets/models/wuwu.glb` | `classic`, `sunset` |
| `haiz.toy.fantuan` | **饭团 (Fantuan)** | 校猫三花小胖 | 0.145 | `assets/models/fantuan.glb` | `classic`, `bellBlue` |
| `haiz.toy.zaozao` | **早早 (Zaozao)** | 背大书包的早读小生 | 0.168 | `assets/models/zaozao.glb` | `classic`, `summer` |
| `haiz.toy.chaochao` | **潮潮 (Chaochao)** | 潮汐海玻璃水母 | 0.165 | `assets/models/chaochao.glb` | `classic`, `twilight` |
| `haiz.toy.changchang` | **长长 (Changchang)** | 海南长臂猿小玩偶 | 0.168 | `assets/models/changchang.glb` | `classic`, `golden` |

---

## 三、标准动画片段（7 组）

所有角色在运行时（`ToyBehavior`）与导出的 `.glb` 中均统一提供以下 7 组动作：

1. `idle` — 个性化闲置呼吸与微动作
2. `look` — 好奇张望
3. `touch` — 被触碰/惊动反应
4. `lifted` — 被提起时的重量感与悬挂动态
5. `land` — 落地挤压与弹性缓冲
6. `celebrate` — 成功欢迎仪式
7. `signature` — 角色专属招牌动作（抖落雨滴 / 午后伸懒腰 / 端庄理毛 / 认真推眼镜 / 潮汐浮游 / 雨林长臂挥手）

---

## 四、在未来校园场景中复用角色

### 方式 1：直接通过 JS 工厂（推荐，支持实时视线追踪与物理弹簧）
```js
import { createToy } from './src/toys/registry.js';

const lanren = createToy('lanren', { variant: 'classic' });
scene.add(lanren.root);
lanren.behavior.play('celebrate');
// 在渲染循环中：
lanren.behavior.update(dt);
```

### 方式 2：加载独立标准 GLB（适用于任意 glTF 引擎：Three.js / Babylon.js / Unity / Blender）
```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltf = await new GLTFLoader().loadAsync('assets/models/lanren.glb');
scene.add(gltf.scene);
// gltf.animations 包含全部 7 组已烘焙动画片段
```
