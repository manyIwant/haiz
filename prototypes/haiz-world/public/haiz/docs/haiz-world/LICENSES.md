# 资产与许可清单

| 内容 | 许可/权属 | 对应材料 |
| --- | --- | --- |
| 新增 app/core/data/world3d/style 与本项目文档 | 本次为用户开发的交付代码；不改写第三方权属 | 文件源码 |
| 新首页生成式概念图 | 本项目生成美术，非实拍 | assets/campus.webp；生成来源记录见审计 |
| Three.js r128 | MIT，© Three.js authors | assets/THREE-LICENSE.txt；legacy/assets/vendor/ |
| Sora 400 | SIL Open Font License 1.1 | assets/SORA-OFL.txt；字体沿用旧仓库 |
| 原校园照片、历史与人物资料 | 原作者和发布机构权利保留，未新增转载授权保证 | legacy/contact.html、data/、assets/walk/credits.json |
| 原窗台 qiaosi 场景与 haiz 改编 | AGPL-3.0-only，© 幡幡 / TangfanOVO | legacy/windowsill/LICENSE、SOURCE.md、scene/src、scene/blender、scene/models |
| 窗台 Three r170 | MIT | legacy/windowsill/vendor/three/LICENSE |
| fanfan / Tabler 图标 | MIT | legacy/windowsill/vendor/fanfan/LICENSE、vendor/voice-note/TABLER-LICENSE |
| Poly Haven 地面、木材、草地等 | CC0，具体见原清单 | legacy/assets/walk/credits.json |
| 盆栽改编模型 | 原 Rico Cilliers CC0；Eric Chadwick/DGG 改编 CC BY 4.0 | legacy/assets/walk/models/NOTICE.md |
| 原石岸 GLB 与生成器 | CC0；字体轮廓 Noto Serif CJK OFL，不含字体文件 | legacy/assets/walk/models/NOTICE.md、legacy/scripts/build-landscape.py |
| 旧设计研究文件 | MIT | legacy/assets/vendor/AWESOME-DESIGN-MD-LICENSE.txt |

雨夜预设的修改仍位于独立 AGPL 应用内，未删除任何上游版权、源码或模型生成工具。站内来源入口能访问同版本完整对应源码；独立 ZIP 同时包含这些文件。新应用不把既有学校照片重新标记为原创或 CC0。

## 移动外壳增量（2026-10-22）

Capacitor core/android/ios/cli 固定 7.6.9，MIT。原生生成模板保留自身注释，完整传递依赖锁在 apps/mobile/package-lock.json；npm 生产依赖漏洞审计 0 项（仅该次已知漏洞数据库结果，不等同许可证全面审计或安全保证）。生成过程使用的 CLI 属开发依赖，不打进业务网页。源站照片、字体、Three.js 和 AGPL 窗台的原许可证仍分别适用。未发布商店安装包。

ClassIsland SDK 工程只声明外部 ClassIsland.Core 包，不分发宿主或包 DLL；构建未完成，其直接及传递依赖许可证必须在恢复依赖后继续单独审计。本轮不宣称已完成原生插件分发许可核查。
