# HAIZ 自动化工程验收 · Automated acceptance

一条命令跑完回归测试，并且把**实际执行过的**和**没有条件执行的**分开写清楚。
One command runs the regression suites and reports what ran separately from what could not run.

## 怎么跑 · Running it

```bash
npm ci
node tests/acceptance/run.mjs                    # core：不需要浏览器，约 1–2 分钟
node tests/acceptance/run.mjs --tier=browser     # 真实 Chromium（装了 WebKit 也会跑）
node tests/acceptance/run.mjs --tier=all
node tests/acceptance/run.mjs --only=cinematic-runtime,rings
```

报告写到 `test-results/acceptance-<tier>.md` 和 `.json`（不进 git）。在 GitHub Actions 里，同一份 Markdown 会出现在 job summary。
有任何已执行的套件失败时退出码为 1。缺少运行条件的套件（例如没装 WebKit）标为 **not run** 并写明原因，不算通过也不算失败。

测试会改写仓库里已跟踪的 `tests/*-results.json` 证据文件；运行器结束时会把运行前是干净的那些文件还原。需要保留新证据时加 `--keep-results`。

## 套件 · Suites

| 层 Tier | 内容 | 说明 |
|---|---|---|
| core | 25 个 Node 套件：站点页面与链接、六幕首页源文件、年轮数据、步行运行时、下降动画控制、Pocket PWA、来源档案等 | 确定性，无浏览器，无网络 |
| core | `workflow-policy` + 自检 | 检查 `.github/workflows/*.yml`：YAML 有效；禁止 `pull_request_target`；禁止把 PR 标题/正文直接插进 `run:`；PR 触发的任务不得 `git push`、请求 Pages 构建或部署。缺 `permissions`、缺 `timeout-minutes`、用 `@main` 引用的 action 只警告 |
| browser | `mobile-compat-chromium` | 每个顶层页面 × iPhone SE（320 px）、iPhone 13、Pixel 7、iPad Mini 横屏，触控 + 移动 UA + DPR 模拟 |
| browser | `mobile-compat-webkit` | 同样的检查在 WebKit（iOS Safari 的引擎，Linux 版）上跑 iPhone SE / iPhone 13 / iPad |
| browser | `mobile-compat-selftest` | 用 `tests/fixtures/mobile-compat/` 里故意写坏的页面证明检查器还能抓到问题 |
| browser | `rings-browser` | 年轮交互、手机深链、无 WebGL 降级 |

### 移动端兼容性检查判定 · What the mobile check fails on

- 页面不是 HTTP 200，或页面自己的脚本 / 样式 / 模块 404
- `<meta name="viewport">` 没有 `width=device-width`
- 加载和 2.5 秒稳定期内有未捕获异常
- 横向溢出：`documentElement.scrollWidth` 大于设备宽度。注意：Chromium 在 `isMobile` 下会把 `innerWidth` 撑大到内容宽度，所以这里和设备本身宽度比较，否则恰好看不到这个问题（自检发现过）。

只警告：禁止双指缩放；独立控件小于 24×24 CSS px（WCAG 2.2 2.5.8，正文里的行内链接除外）；正文小于 12 px。

## 这套验收不覆盖什么 · Not covered

- **真机。** 所有浏览器检查都是 Linux 上的模拟（视口、触控、DPR、UA）。真实 iPhone Safari 和 Android Chrome 的硬件 GPU 没有被测试。
- **帧率和 GPU。** WebGL 在 SwiftShader（软件渲染）上运行；这里的耗时不是性能数据，性能交给基准测试。
- **画面审美。** 没有截图比对；构图、材质、光线仍需人工看。
- **后端。** `node --test backend/tests/*.test.mjs` 由现有的 `HAIZ authenticated backend` workflow 在后端文件变化时运行。
- **六幕首页重型 WebGL 测试**（`tests/home-browser.cjs`）由 `rings-qa.yml` 负责；在慢机器上会超时。
- **线上 haiz.space。** 从不访问；只在 127.0.0.1 上提供检出的文件。

## PR 流程 · PR flow

1. 每个 PR 自动运行 `.github/workflows/pr-acceptance.yml`：`core` 一个任务，`mobile` 按 Chromium / WebKit 两个任务。权限只有 `contents: read`，不推送、不部署。
2. PR 描述使用 `.github/pull_request_template.md`：分别填写实际执行过的测试和没有条件执行的测试。
3. 报告作为 artifact 保留 14 天（`acceptance-core`、`acceptance-mobile-chromium`、`acceptance-mobile-webkit`）。

要把它设为合并门槛，需要仓库管理员在 Settings → Branches 里把 `Core regression (no browser)` 和 `Mobile compatibility (chromium)` 设为 required checks。这一步没有自动做。

## 验证记录 · Verification log

见 [VERIFICATION-20261122.md](VERIFICATION-20261122.md)。
