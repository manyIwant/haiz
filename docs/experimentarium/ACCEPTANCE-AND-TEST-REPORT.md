# HAIZ · EXPERIMENTARIUM — 全维度测试、浏览器真机与视觉验收报告

## 1. 测试总览表

| 测试项目 | 工具与环境 | 执行结果 | 关键量化指标 |
| --- | --- | --- | --- |
| **核心与分包静态语法校验** | `node --check` (`v24.22.1`) | **通过** | 核心 13 模块 + 8 领域包 0 语法错误 |
| **科学数值内核单元测试** | `node --test science-models.test.mjs` | **8 / 8 通过** | RK4 vs 椭圆积分周期偏差 `< 5e-4`；滴定半当量 pH=pKa 偏差 `< 0.02`；梁立放/平放挠度比 exact `25:1`；三段论/经济学模型全通 |
| **矩阵契约与分支隔离守卫** | `node --test curriculum-and-contracts.test.mjs` | **3 / 3 通过** | `git diff origin/main --diff-filter=MD --name-only` 为空；101 项矩阵统计全自洽；63 项 1:1 映射无缺失、无伪造校本版次 |
| **桌面硬件 GPU 全页验收** | Chromium + Apple M5 Metal 4 (`1280×800`, 2× DPR) | **63 / 63 通过** | Active WebGL Renderer: `ANGLE (Apple, ANGLE Metal Renderer: Apple M5, Unspecified Version)`；`overflowCount: 0`；`errorCount: 0`；30 个深度工作台 & 多批次记录册对照全通 |
| **WebKit 桌面与移动端适配验收** | Playwright `webkit-2336` 桌面 (`1280×800`) + 手机 (`390×844`) | **通过** | `webkitSafe: true`；真实 3D 翻页动效 `turnVerified: true`；10 跨科实验与工作台零报错；手机三页签 (`read`/`workbench`/`journal`) 切换正常、`errors: []` |
| **交互录屏与静帧视觉审核** | Chromium + `/opt/homebrew/bin/ffmpeg` (`9.0.2`, `libx264`) | **已生成并人工目视核查** | `experimentarium-desktop.mp4` (`537 KiB`, 88 frames) · `experimentarium-mobile.mp4` (`102 KiB`, 36 frames) · `still-01`..`07` |

---

## 2. 自动化测试在实践中发现并修复的真实缺陷记录

1. **向量箭头辅助函数 API 失配 (`phy-mechanics.js`)**：Gate 1 验收暴露旧版草稿引用 `fTrue.between(...)` 而新核心库 `ink.js` 提供 `.set(p, q)`，已在 Gate 1 阶段修正并验证 `phy-pendulum` 回复力对比箭头真实渲染。
2. **单摆支架底座跨越走纸纸带视觉遮挡**：目视审核 Gate 1 截图发现门形支架宽木底座横压在走纸记录网格之上，遂把支架底座拆分至走纸带左右外侧铜脚并缩窄走纸带至 `5.0` 单位，走纸格线完全清晰。
3. **左页实时曲线图画布挂载缺失 (`app.js`)**：`makeLeft()` 生成 `[data-fig]` 占位容器时漏写内部 `<canvas>` 元素与高度，导致实验页左页边界曲线初始空白；补齐后在 `still-01-pendulum-book.png` 清晰呈现 `T = 2π√(0.90 m / 9.79 m/s²)` 活公式及 `图 a` 边界图。
4. **化学与地理领域包漏导图元 (`chem-studio.js`, `geo-studio.js`)**：首轮 63 页遍历瞬间捕获两包遗漏导入 `solid, flat, glass`，补全后重测 63 页立即降至 `errorCount: 0`。
5. **移动端 `#notebook` 遮挡顶部 Tab 切换栏 (`experimentarium.css`)**：`webkit-mobile-acceptance.cjs` 在 `390×844` 竖屏点击“实验记录册”再切回“阅读与导引”时暴露出记录册浮层上沿越过 `#mTabs` 截获触控事件的真实交互 bug；通过把 `#mTabs` 设为 `z-index: 38` 并将竖屏 `#notebook` / `#teach` 精确约束在 `top: calc(48dvh + 48px)` 至底部栏之间，在实测 WebKit 移动端中完全消除遮挡。

---

## 3. 多媒体成果与视觉核验清单

- 桌面交互全流程展示片：[experimentarium-desktop.mp4](media/experimentarium-desktop.mp4)（涵盖单摆走纸与 $T^2\text{–}l$ 回归、酸碱滴定曲线、丹德林双球、毕昇活字经济曲面与全科覆盖矩阵弹窗）
- 移动端竖屏交互展示片：[experimentarium-mobile.mp4](media/experimentarium-mobile.mp4)（涵盖半屏 3D 滴定、实验台开关曲线与记录册标签无缝切换）
- 关键视觉验收静帧：`media/still-01-pendulum-book.png`、`media/still-02-pendulum-workbench.png`、`media/still-03-chem-titration.png`、`media/still-04-math-conic.png`、`media/still-05-history-type.png`、`media/still-06-curriculum-matrix.png`、`media/still-07-mobile-workbench.png`。

---

## 4. 现阶段局限与后续迭代路线

1. **待校核海南中学内部征订书单**：非国家统编学科暂按“海南省主流目录参考”建档，获取学校正式征订表后需更新 `curriculum-matrix.json` 中的 `editionVerificationStatus`。
2. **38 项 `L0 / planned` 延伸条目**：目前已实装最核心的 63 项交互实验；矩阵内其余 38 项（如部分拓展探究、无机化合物定性对比微模块与选修拓展）需按同等 L3/L4 质量标准分期增补。
3. **云端班级与 Supabase 批阅协同**：目前保持离线本地隐私存储，若未来决定接入 HAIZ 云端，应在独立的 Supabase 迁移脚本中添加经师生权限校验的 `experiment_runs` RLS 表结构。
