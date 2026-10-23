# 测试证据 · 2026-10-23

## 本地自动化通过 WEB_CI_PASS

环境：Linux / Node24.19.0 / Chromium（Playwright1.57.0）；390px视口不是iPhone。最新机器结果browser-results.json；截图screenshots/。截图均为Demo数据。

| 命令 | 退出码 / 结果 |
|---|---|
| npm --prefix world test | 0 / 17领域测试 |
| npm --prefix world run test:server | 0 / 2旧HTTP回归 |
| npm --prefix world run test:flow | 0 / 新Flow集成测试：权限、所有权、409、幂等、确认、公开白名单、撤回、重启持久化 |
| HAIZ_CHROMIUM=/usr/bin/chromium node world/tests/flow-browser.mjs | 0 / 12组浏览器检查 |

浏览器：E2E01手机独立会话创建，Windows独立会话继续；02预览确认；03教室只收摘要；04离线教室重连后移除撤回；05双端冲突与合并；06离线编辑、重载、联网恢复；07学生发布403；08关闭规则仍可保存；09六种屏宽无横向溢出；10命令面板键盘导航与减少动态；11离线有效缓存到期隐藏。学生示例社团到作品草稿刷新恢复通过，纯净课堂通过，pageerror为0。

首次浏览器执行发现主题选择器错误匹配body，已修复为button[data-theme]并完整复跑通过。原型file://被浏览器管理策略阻止，改用受控本地HTTP服务运行原型；不更改浏览器策略。

## 性能记录

2.5秒轮询，本机回环首次完整流程实测2381ms（从确认点击至教室DOM出现），单样本不代表网络分布。browser-results.json记录浏览器UA、资源传输字节与JS堆快照；不是常驻内存趋势、CPU或帧率认证。教师首屏只加载轻量Flow CSS/JS，不加载Three.js或体素图片。

## 云端与未测

新增.github/workflows/haiz-flow.yml，Linux及Windows运行器同套测试；执行状态与链接在下方追加。Windows CI浏览器不等于希沃硬件。

WINDOWS_HARDWARE_PENDING、CLASSISLAND_HARDWARE_PENDING、IOS_HARDWARE_PENDING、ANDROID_HARDWARE_PENDING。未做Mac人工审核、WebKit/iOS软键盘/发热/后台测试、Windows白板遮挡、真实校园端到端延迟。新Flow未构建IPA/APK。保留原有安装包不冒充新包。

局限：自动化并非完整WCAG认证；尚未覆盖所有权限失效/磁盘耗尽/时钟跨日组合；没有三名真实试用者结果；只有本地受控模拟学校角色。不可据此部署学校设备。

云端实际结果：提交42551d6的[Actions 39958810937](https://github.com/manyIwant/haiz/actions/runs/39958810937)中Ubuntu与Windows两个浏览器任务均success。之后补充模拟当前/下一节课程展示、公共屏每12秒翻页和280字摘要上限，Flow API与完整浏览器本地复跑退出码0；最新单次回环延迟2370ms。后续提交的CI以PR检查为准。
