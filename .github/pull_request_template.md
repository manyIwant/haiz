## 改了什么 · What changed

<!-- 一两句话：这个 PR 解决什么问题、给谁用。One or two sentences. -->

## 范围 · Scope

- 主要修改的目录 / Main paths touched:
- 是否触及共享渲染模块、首页或 `haiz.space` 线上页面？ / Shared render modules, the homepage or live pages touched? 否 No / 是 Yes（说明 explain）:

## 验收 · Acceptance

`HAIZ PR acceptance` 会自动运行核心回归和移动端兼容性检查，结果在 Actions 的 job summary 里。
The `HAIZ PR acceptance` workflow runs automatically; its summary lists what ran and what did not.

> **这道门禁的边界 · What the gate does NOT prove**
> 移动端兼容性检查是 **smoke**：页面能加载、自身脚本/样式不 404、没有未捕获异常、手机宽度下不横向溢出。
> 它**不**验证触摸玩法、手势、GPU 帧率/发热、画面质量，也不等于第六幕等专门体验的完整验收。
> 新增业务页或交互请附带它自己的交互测试（参考 `tests/rings-browser.cjs`、`tests/home-browser.cjs`）。
> The mobile check is a smoke test (loads, own assets, no uncaught errors, no sideways overflow). It does not
> verify touch interactions, GPU frame rate or heat, visual quality, or full acceptance of a feature. New pages
> or interactions should bring their own interaction test.

本地可复现 / Reproduce locally:

```bash
npm ci
node tests/acceptance/run.mjs              # core: no browser (add --require-all to fail on skipped suites)
node tests/acceptance/run.mjs --tier=browser   # Chromium (and WebKit if installed)
```

### 实际执行过的测试 · Tests actually run

<!-- 只写真的跑过的命令和结果；没跑的不要写在这里。List only what you really ran, with the result. -->

- [ ] `node tests/acceptance/run.mjs` — 结果 result:
- [ ] 

### 没有条件执行的测试 · Tests not run (and why)

<!-- 例如：真实 iPhone / Android 硬件 GPU、帧率、需要密钥的线上服务。e.g. real devices, real GPU frame rate, services needing secrets. -->

- 

### 移动端 · Mobile

- [ ] 手机尺寸下没有横向滚动、主要按钮可点 / No sideways scroll at phone widths; primary controls tappable
- [ ] 无 WebGL 或低端设备时有可用的降级 / Usable fallback without WebGL or on low-end devices (if the page draws 3D)
- [ ] 若有真机验证，写明机型、系统和浏览器 / If tested on a real device: model, OS, browser:

### 画面 · Visual

- [ ] 附上修改前后截图或录屏（渲染、布局、文字变化时）/ Before–after screenshots or a recording for visual changes
- [ ] 软件渲染（SwiftShader）截图已注明，不当作真机效果 / Software-rendered captures are labelled as such

## 资料与授权 · Sources and licensing

- [ ] 新素材、模型、字体、照片写明来源与许可证（见 CONTRIBUTING.md）/ New assets list source and licence
- [ ] 没有密钥、学生个人信息或未经授权的资料 / No secrets, student personal data or unlicensed material
- [ ] 推演或艺术化内容没有冒充实测或史实 / Interpretive or artistic content is not presented as measured or historical fact

## 合并前 · Before merge

- [ ] 所有 required checks 通过，或失败原因已在下方说明 / Checks green, or each failure explained below
- [ ] 不需要部署；或部署步骤已单独说明并获得同意 / No deploy needed, or deploy steps described and approved separately
