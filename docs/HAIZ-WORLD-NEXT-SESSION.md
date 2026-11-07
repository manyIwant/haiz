# HAIZ · 下一次对话快速读取（第五幕 · 第六幕 · 第一人称漫游）

> **2026-11-07 更新：第二阶段已实现第五、六幕电影、交接与漫游，见 `docs/HAIZ-WORLD-STAGE2.md`（分支 `claude/wonderful-maxwell-ggk0pi`）。** 构图冲突已用数据与截图对比，三种方案都可用 `?compose=a|b|c` 切换，默认 B（校园绕树转 90°，V4 两个机位原样）——**等待作者最终确认**。下文是第一阶段结束时写的，保留作背景。

完整交接见 `docs/HAIZ-WORLD-STAGE1-HANDOFF.md`（必读 §0、§7、§9、§11）。设计权威：仓库 `DESIGN.md`（「四至六幕连续空间与手机漫游」一节）。86 个 Skill 在用户提供的 MASTER 包里，入口 `/haiz-studio-director`，只按需读 2–4 个：`haiz-scroll-cinematic`、`haiz-blocky-character`、`haiz-firstperson-camera`、`haiz-locomotion-animation`、`haiz-foot-ik`、`haiz-mobile-controls`；动画研究 `references/HAIZ_FirstPerson_Animation_Research_2026-11-06.md`。不要重复做资料搜索。

## 项目与六幕
HAIZ（海南中学府城校区的非官方数字校园）：一棵 V4 榄仁树 + 一座校园 + 六幕滚动电影（01 初遇 · 02 根脉 · 03 青春生长 · 04 地图 · 05 远眺 · 06 回望）。不是六个无关网页。美术：校园与树写实，只有人物是 Minecraft 式方块。

## 已确认决策
- 04：V4 斜俯瞰默认；水面显影出**校园总平面（Site Plan）**；用户主动展开整座三维校园；总平面与三维同源。**1.2 m 水平剖切只用于单栋可选探索，不是校园默认**（曾被误用，已纠正）。
- 05：保留 V4 树冠远眺机位；继续滚动，方块身体出现、跃下、落地（可逆的滚动电影，不用不可逆物理）。
- 06：落地后回头，看见完整榄仁树并**停留**；用户再次主动向前，才交出第一人称控制权。
- 漫游：随身地图 + 可返回完整第四幕并恢复位置；无 UI 模式；手机默认简洁、控件按需显现。
- 手机：横屏优先，但浏览器不能强制旋转时要有旋转提示与竖屏退路；不用 CSS 假旋转；不因手机删光影。
- 不虚构校园数据；模型是近似，室内是推演。不破坏 01–03、既有入口与用户数据。

## 第一阶段成果（分支 `claude/vibrant-wozniak-rsrttr`）
04 的总平面 → 三维校园：建筑从自己的轮廓完整升起、长焦→三分之四相机、材质从树根向外恢复、校园阴影/地面/300 棵树、旋转/平移/缩放/点选、单栋剖切、`#map/3d` 历史、可逆、手机布局。测试：`campus-model` 6/6，`campus-unfold-browser` 11/11，`campus-map-browser` 17/17（Chromium+SwiftShader，**无真机数据**）。

## 仓库状态
仓库 github.com/manyIwant/haiz；分支 `claude/vibrant-wozniak-rsrttr`，第一阶段提交 `3ab9f4e`，其后只有交接文档提交（`git log` 为准）。**`origin/main` 停在 11-01 的 `1fb630c`，不含 V4 与第四幕**；从该分支继续，不要从 main 拉。不要合并/推送 main。`tests/*-results.json` 每次运行会变，提交前还原。

## 源码地图
`lanren/js/{chapters,camera,scene,home}.js` V4（未改）；`lanren/map/geo.js` 坐标；`campus3d.js` 建筑体量；`section.js` 三维层；`unfold.js` 时间线；`map.js` 状态机；`view.js` 相机数学；`layer.js` 水面/总平面着色器。世界坐标：树根=原点，水面/地面 y=−0.85，−Z 指向北门（非真北），1 m=1 m。页面里 `window.__haizHome` / `.map` 是调试与测试 API。

## 下一阶段目标（建议顺序）
1. **先做构图决策原型**（见交接 §9.1）：V4 第五幕视线在 27 m 处撞上一号教学楼（高 19 m），第六幕机位在该楼占地内——校园在 05/06 可见就会毁掉 V4 的远眺与回望。用 30 分钟原型对比方案 A/B/C，给用户看截图后再定。
2. 抽出 `world/state` 与输入/相机所有权仲裁（去掉 map 外清零 `S.u`）。
3. 05→06 方块人物电影：`pose = film(p−4)` 纯函数，可前进/停留/后退/反复；落点用 `GROUND_Y` 或岛屿 `heightAt`。
4. 06 回头 + 停留 + 明确的控制权交接；之后第一人称移动（胶囊 vs `campus3d` 有向矩形碰撞）。
5. 双层地图、手机横屏入场、真机测量。

## 参考技术
Three.js r170（`lanren/vendor/three`，ES 模块；漫游旧页是 r128，不能混用）、GSAP ScrollTrigger（`state.p∈[0,5]`）、flat-to-3d（MIT，只借方法；Casa Serra 无许可，不复制）。

## 未解决问题
真机性能；真实手指旋转手势未自动化测试；三维刷新+token 恢复未单独测；第四幕右侧粉色残影（改动前就有）；太湖石位置与榄仁树数据矛盾待用户核对；`tests/site.cjs` 缺 `linkedom` 未运行；每帧重绘校园阴影与主线程生成 13 MB 几何的成本。

## 工作方式
先读交接文档与 `git log`，再动手；用真实浏览器截图证明（`tests/campus-unfold-browser.cjs` 里有可复用的 `until/frames/screenOf` 辅助；SwiftShader 单帧 20–60 s，截图超时设 300 s；不要在动画测试里调 `__haizHome.still()`）。不要夸大已完成部分；提交前先问用户。

## 可直接复制的开场提示词

```
你好。请继续实现 HAIZ 的第五幕、第六幕与第一人称漫游。这是一个已有第一阶段成果的长期项目，不要重新做资料搜索或重新讨论设计。

仓库：https://github.com/manyIwant/haiz，请在分支 claude/vibrant-wozniak-rsrttr 上工作（注意 origin/main 不含 V4 与第四幕，不要从 main 开始；不要合并或推送 main，提交前先问我）。

先按顺序读：
1. docs/HAIZ-WORLD-NEXT-SESSION.md（精炼上下文）
2. docs/HAIZ-WORLD-STAGE1-HANDOFF.md（必读 §0、§7、§9、§11）
3. DESIGN.md 中「四至六幕连续空间与手机漫游」一节
然后检查 git status / git log，确认分支与工作区。需要 Skill 时用 /haiz-studio-director，只按需读 2–4 个（滚动电影、方块人物、第一人称相机、手机控制）。

第一件事不是写人物，而是验证一个已发现的冲突：V4 第五幕机位的视线在约 27 m 处撞上三维一号教学楼，第六幕机位落在该楼占地内，所以第四幕展开的三维校园不能原样留到第五、六幕。请用不超过一小时的原型对比交接文档 §9.1 的方案 A/B/C（含真实浏览器截图），给我看对比后由我决定构图，再往下做。

之后按顺序：抽出共享世界状态与输入/相机所有权仲裁；实现 05→06 可逆的方块人物滚动电影（由 state.p 纯函数驱动，向前/停留/后退/反复进出都一致，不用不可逆物理）；第六幕回头并停留，再由用户主动操作交接第一人称控制权；最后是碰撞、双层地图和手机横屏入场。

要求：保留第一阶段全部成果（总平面是 Site Plan，1.2 m 剖切只用于单栋，不得作为校园默认）；测试与截图用真实浏览器；区分已通过、待验证、已知缺陷；不夸大未测功能。每个阶段给我可操作的预览和准确的测试结论。
```
