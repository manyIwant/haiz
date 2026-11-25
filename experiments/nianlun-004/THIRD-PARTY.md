# NIANLUN 004 · 第三方授权、复用资产与算法来源说明

本实验（`experiments/nianlun-004/`）基于 PR #114（`experiments/nianlun-pull-a-year/`，NIANLUN 003）独立演进，未覆盖原版目录，代码遵循仓库根目录 [LICENSE](../../LICENSE)（PolyForm Noncommercial 1.0.0）与 [LICENSING.md](../../LICENSING.md) 的非商业授权边界。

---

## 一、直接复用的 HAIZ 自有代码与数据资产

| 内容 | 位置 | 来源与授权 | 说明 |
| --- | --- | --- | --- |
| NIANLUN 003 核心渲染与物理基础 | `gl.js`、`sky.js`、`sound.js`、`physics.js`、`app.js` | 继承自 PR #114（`experiments/nianlun-pull-a-year/`，HAIZ 自有代码） | 保留木质年轮截面着色器、弹性抽环、长度守恒滚动展开、天空与日月轨迹及可逆交互，扩展非均匀形成层、语义缩放与多层材质时间带 |
| HAIZ「年轮」气候与历法模块 | `lib/rings/`、`lib/js/` | 原样复制自 HAIZ `lanren/rings/` 与 `lanren/js/` | 未修改核心解码与天文公式，保证独立静态预览离线可用 |
| 逐日天气档案 `climate.bin` / `climate.json` | `lib/rings/data/` | **ERA5 再分析**（Copernicus Climate Change Service / ECMWF），经 [Open-Meteo](https://open-meteo.com/) 获取，**CC BY 4.0**；包含经修改的 Copernicus 气候变化服务信息 | 1940-01-01 至 2026-11-16 共 31,732 天，约 25 km 网格模式再分析，非校内气象站实测 |
| 校史与公开新闻条目 | `content.js` | 摘自 HAIZ 第二幕「根脉」（`lanren/roots/history.js`）与 `data/news.json` 中 `demo:false` 的公开条目 | 保留史料等级与原文链接；不杜撰未经核实的校史 |
| 海南中学夏季作息时间表 | `content.js`（`BELL_SCHEDULES.summer`） | 源自 HAIZ 仓库 `data/news.json`（`id: n10`，2026-04-07 海南中学 2025-2026 学年第二学期夏季作息实录） | 作为「竹简课表带」与「日视图时辰地平线」的默认基准；冬季作息已明示为季节微调参考 |
| 校园建筑锚点与实验册目录 | `content.js`（`BUILDINGS`、`LAB_EXPERIMENTS`） | 对齐 HAIZ `data/buildings.json` 建筑 ID 与 `lab/js/catalog.js` / `curriculum.js` 实验 ID | 为课程、考场、错题知识点与校园地图/实验册的后续联动预留稳定引用 |
| 照片 9 张 | `photos/` | 原样复制自 PR #114（源自 HAIZ `assets/images/`） | **沿用 HAIZ 原有版权与授权待确认说明**，每张图均随附来源与署名；不在 PolyForm 许可范围内 |
| Supabase RLS 同步蓝图 | `supabase-schema.sql` | 参照 HAIZ `supabase/migrations/202610310001_pocket_snapshots.sql` 与 `app/lib/core/personal_snapshot.dart` | 保持非匿名 `auth.uid()` 行级隔离与 `(user_id, version)` CAS 并发契约，不触碰根仓库现有迁移文件 |

---

## 二、移植与采用的开源算法及理论

| 算法 / 理论 | 使用位置 | 来源与授权 | 说明 |
| --- | --- | --- | --- |
| Sarkar–Brown 一维鱼眼变换及其逆变换 | `physics.js`（`fisheye` / `fisheyeInv`） | 移植自 Mike Bostock 的 [d3-plugins/fisheye](https://github.com/d3/d3-plugins/tree/master/fisheye)（**BSD-3-Clause**，Copyright (c) 2012–2015 Michael Bostock） | 结合 Living Cambium 非均匀半径映射与自适应失真系数，解决细密历史圈在手机端的精确选取 |
| 阻尼谐振弹簧模型（stiffness / damping / mass） | `physics.js`（`Spring` / `stepParticles`） | 参数化思路参考 [Motion](https://motion.dev/)（MIT）与 react-spring | 驱动年轮抽拉、多时间带剥离、语义缩放与可逆打断 |
| 区间扫描线并集与补集算法（Interval Sweep-Line） | `analytics.js`（`freeSlotsForDate` / `detectConflictsForDate`） | 经典计算几何算法（公开领域） | $O(n \log n)$ 实时计算扣除作息/课表/考试/已有日程后的空闲时段，并精确检测时间冲突 |
| 间隔重复复习节律（Ebbinghaus / SM-2 思路） | `analytics.js`（`buildMistakeReviewPlan`） | 经典教育记忆曲线 / SuperMemo 间隔原则（公开教学理论） | 将考试错题一键转化为 +1 天 / +3 天 / +7 天复习任务并自动排入未来空闲时段 |
| 学情均衡与失分归因诊断思路 | `analytics.js`（`analyzeExam` / `compareExams`） | 借鉴智学网与博拉图等学生学情分析工具在学科均衡、历次对比、失分归因与知识点薄弱链上的设计方法 | **纯本地前端统计实现**：零第三方代码拷贝，不调用未经授权的智学网接口，不收集任何外部账号密码 |

> **BSD-3-Clause 版权保留声明**：Copyright (c) 2012–2015, Michael Bostock. All rights reserved. 本实验仅移植 Sarkar–Brown 鱼眼数学公式的一维可逆形式，未复制源码文件，且不代表原作者背书。

---

## 三、外部依赖与隐私边界

- **零外部 CDN / 零第三方追踪脚本**：使用系统宋体与无衬线字体栈，Web Audio 实时合成木/竹/纸/印声效，整页支持离线静态部署。
- **演示数据与真实隐私隔离**：所有演示课表、作业、日程与成绩均标注 `example: true` 与「演示」徽记；考试成绩、错题与个人日程默认 `visibility: "private"`，仅保存于本机浏览器。
