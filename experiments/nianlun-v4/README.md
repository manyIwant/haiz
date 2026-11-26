# HAIZ · NIANLUN · 一卷 V4（实验版本）

> ⚠️ **独立实验分支（`experiment/nianlun-v4`），未覆盖原有 HAIZ Pocket Flutter 应用、主站页面、历代 NIANLUN 实验或用户数据，未经验收请勿合并主分支。**

基于四轮深度研究形成的设计母本 `HAIZ-APP-NIANLUN-DESIGN-MASTER-v4.md`、`DESIGN-EVOLUTION-v4.md` 与 `INTERACTION-RESEARCH-v4.md`，将 V4 核心思想转化为面向**海南中学**住校生的完整、可操作、本地优先的单一连续时间物体。

- **独立公网 HTTPS 交互预览**：`https://manyiwant.github.io/haiz-nianlun-v4-preview/`（独立预览仓库 `manyIwant/haiz-nianlun-v4-preview`）
- **交互录屏**：
  - 手机端（390×844 触摸仿真，含双指缩放、年轮拨轮、中间并置卷、雾凝聚、槽穿墙、9 条群消息归流、高密度压力测试、局部分道与深色模式）：[`shots/mobile-flow.mp4`](shots/mobile-flow.mp4)
  - 桌面端（1440×900，含桌面导览伴随栏、中间并置卷、局部分道与让位关系线、侧边归流与所见即所带导出）：[`shots/desktop-flow.mp4`](shots/desktop-flow.mp4)

---

## 一、六个已发现具体问题的实际工程解法

| # | 原问题 | V4 实验版解法 | 代码位置 |
|---|---|---|---|
| 1 | 清单读法单项触控 ≥ 44pt 与 300pt 时刻读法阈值在多事项时冲突（N ≥ 6 时清单读法消失） | 引入动态阅读阈值走廊 `computeReadingThresholds()`：始终保证 `34pt < listMinH < timeMinH`（至少 68pt 清单平台）；当 N ≥ 5 时以 4 项 × 44pt + 1 个 44pt「还有 k 项」展开行进入清单读法，继续拉长则逐项以完整 44pt 展开，零压缩触控；时刻读法中将无具体时刻事项单列于 06:00 上方托盘，绝不编造钟点 | [`src/core/layout.js`](src/core/layout.js)、[`src/render/scroll_canvas.js`](src/render/scroll_canvas.js) |
| 2 | 五种时间形态（雾、珠、槽、墙、迹）在高信息密度下可能视觉拥挤 | 架构分层 + 碰撞消解：`packTemporalChannels()` 将右侧并发槽收束为最多 3 道细墨槽 + `+k 槽` 折叠口（聚焦时让位高亮）；`packFogVeils()` 在窄屏多雾时自动限道并避让截止墙标签 + 聚类入口；`groupDeadlineWalls()` 自动合并同刻截止为复合标签（如「17:30 返校 · 5 项待交」）；内置一键「高密度压力测试（周六 8 项 + 4 雾 + 6 槽）」供实测 | [`src/core/layout.js`](src/core/layout.js)、[`src/render/scroll_canvas.js`](src/render/scroll_canvas.js) |
| 3 | 信息归流不能仅凭发送者身份机械判断权威性 | 构建四维可信归流模型 `evaluateProvenance()`：**原始出处**（区分转发人与落款原出处）× **传递方式**（原发 / 原文转发 / 转述 / 听闻）× **职责范围**（如化学老师提及物理考试判定为跨学科转述，不覆盖物理任课通知）× **原发时间锚点**（旧通知晚转发自动拦截为「旧通知重转」，恢复消息仅回溯有效权威层，不采信被驳回的传言） | [`src/core/convergence.js`](src/core/convergence.js) |
| 4 | 未安排的时间 ≠ 学生自由支配时间 | 引入显式时间主权 `getTimeSovereignty()` 与 `canScheduleBlock()`：在校统一时段与未核实晚修默认锁定不可排个人块；仅离校在家或学生主动开放的时段允许新建「安排块」；尝试排进校内课程时给出诚实说明并拦截 | [`src/core/calendar.js`](src/core/calendar.js)、[`src/ui/item_sheet.js`](src/ui/item_sheet.js) |
| 5 | 过去的学校安排 ≠ 实际发生过的事情 | 引入三元认识论标签 `epistemicKind`：**原定计划（plan） / 已确认事实（verified_fact） / 个人记录（personal_record）**。过去的校方安排默认标注「已过计划期（未核实）」，不假定如期发生；过去的未标记任务默认为「软件不知道」，静默收进过去卷计数，绝不显示红色「逾期」 | [`src/core/model.js`](src/core/model.js)、[`src/ui/item_sheet.js`](src/ui/item_sheet.js) |
| 6 | 「海口中学」应修正为「海南中学」，离校、返校及晚修时间需可配置/待确认 | 全工程统一修正为「海南中学」（自动化单测强制零残留）；引用仓库 `data/news.json (n10)` 2026-04-07 夏季作息作为公开参考，同时将周六离校、周日返校墙与晚修起止及自排权限全部设为**待确认 · 可配置**，修改后实时联动卷面返校墙与主权规则 | [`src/core/model.js`](src/core/model.js)、[`src/ui/settings_sheet.js`](src/ui/settings_sheet.js) |

---

## 二、对既有 HAIZ Pocket 与 NIANLUN 工程资产的复用

1. **HAIZ Pocket Flutter 工程资产（`app/lib/`、`pocket/`）**：
   - 沿用并扩展 `noticeProposalKey` 的规范化 FNV-1a 双 32 位哈希去重算法（`src/core/model.js`）。
   - 实现母本 §14 规定的 **HAIZ Pocket `PersonalSnapshot` 单向可撤销迁移**（跳过 `example:true` 示例、仅日期截止不编造 23:59、过去未完成映射为「软件不知道」、`FocusLog` 迁为独立「迹」不影响年轮几何）（`src/core/store.js`、`src/ui/intake_sheet.js`）。
   - 复用同源本地 `HAIZ_OCR`（Tesseract.js WASM + 中英文离线语言包，零上传）（`src/ocr-bridge.js`）。
   - 沿用 `CalendarExport` 的 RFC 5545 全天 `.ics` 诚实导出逻辑（`src/core/store.js`）。
2. **NIANLUN 历代实验与主站资产（`lanren/rings/`、`experiments/nianlun-004/`、`data/news.json`）**：
   - 接入 `lanren/rings/data/climate.bin` + `climate.json`（海口 ERA5 真实气象再分析档案），仅用于细微调制木色湿润度与包浆质感，严格遵循母本 §13 #6「年轮几何只由日历决定」。
   - 借鉴 `marialarsson/procedural_knots`（SIGGRAPH 2022，MIT 思路）早材/晚材密度曲线与 `lanren/rings/disc.js` 极坐标结构，合成高 DPI 离屏缓存的榄仁木年轮端面（`src/render/wood_textures.js`）。
   - 借鉴 `experiments/nianlun-004/sound.js` 零音频文件的 WebAudio 微量木质/纸张拨轮声效与触觉反馈（默认静音，可选开启）（`src/ui/foley.js`）。

---

## 三、测试方法与诚实边界声明

> **重要声明**：以下全部自动化与交互测试均在 **macOS 桌面环境下的 Node.js + Playwright 浏览器仿真（Chromium 390×844 DPR2 触摸 / 1440×900 桌面 + WebKit 390×844 移动端引擎冒烟）** 中完成，**不是 Flutter 模拟器测试，也不是真机测试，更不代表真实海南中学住校生的现场验收**。

- **纯逻辑单元测试**（`node tests/unit_tests.mjs`）：15 / 15 项通过（覆盖问题 1–6、44pt/300pt N=0..20 数学不变量、高密度槽/雾/墙排布、9 条多维群消息归流、时间主权拦截、中间卷生成、10 秒真删除与 Pocket 迁移回退）。
- **Playwright 浏览器仿真 E2E 与性能基准**（`node tests/browser_e2e_record.mjs`）：
  - Console 报错：`0`，未捕获页面异常：`0`。
  - 真实 CDP 双指捏合拉伸进入时刻读法：通过；拉伸期间实测 `98` 帧平均 `60 fps`（P95 帧耗时 `17 ms`）。
  - 真实 CDP 端面年轮拨轮顺时针转 `3.3/7` 圈：精确卷出 `3` 天。
  - 真实 CDP 双指捏紧中间日子：成功生成「并置中间卷」。
  - 常规清单读法与高密度考前周压力模式最小事项触控高度：均严格 `44 px`（≥ 44pt）。
  - WebKit（iOS Safari 引擎）390×844 冒烟加载与状态校验：通过。

---

## 四、已知局限与尚未验证的问题

1. **未在真机与真实住校生中验证**：母本 §16.1–16.3 的 P0–P5 访谈与实测（包括：学生是否会停留在中间注意力长度、是否能直觉读出年轮「第几周周几」、拨轮误触率是否 < 15%、真实 10–20 条微信截图归流耗时中位数是否 ≤ 2 分钟、中低端安卓真机帧率与 VoiceOver/TalkBack 真机操作）尚未开展。
2. **本地 OCR 实图精度与体积**：本实验沿用同源 Tesseract.js（`chi_sim + eng`）通路；真实微信深色模式长截图或斜拍作业单的中文识别率及移动端首次加载耗时仍需真机实测，复杂场景后续宜在原生端接入 PaddleOCR / ML Kit。
3. **极端高密度叠加的可读性边界**：在开启「高密度压力测试」且叠加导入多条无日期雾时，虽已通过单道限流与墙标签避让避免文字直接盖死，但窄屏下同时展示 5 项以上跨周待定雾仍建议引导用户展开搜索或逐项凝聚。
4. **中文时间表达解析覆盖度**：当前纯本地规则引擎覆盖了常见相对日期、绝对日期、节次、时长、改期/取消/恢复与跨学科转述；对于高度口语化或省略主语的连续多轮微信聊天（如「嗯那个推一天吧」），仍保守归入「没看懂的消息」由学生手工确认。
5. **技术栈说明**：本实验版本采用零构建依赖的原生 Web / PWA + 高 DPI Canvas 2D + 同步 ARIA 语义 DOM 架构以保障首屏速度、中文排版精度与公网直接交互体验；若后续并入 HAIZ Pocket Flutter 主工程，需将核心布局、归流引擎与端面着色器向 Dart / Impeller `FragmentProgram` 移植，并补充原生 Android/iOS 模拟器与真机测试。
