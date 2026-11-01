# ROUND 02 测试与已知限制

日期：2026-10-21，中国时间。环境：Debian GNU/Linux 13，Linux kernel 6.18.55，Node v24.19.0，Playwright 1.57.0，headless Chromium 154.0.8037.57。以下全部是**开发环境模拟测试**，不是 Windows、希沃或 Android 真机验收。

## 已执行

| 验证 | 结果 / 证据 |
| --- | --- |
| 第一轮领域状态机 | 5 项通过，原作品闭环、授权与计时持久化 |
| 第二轮领域状态机 | 5 项通过，思路恢复、显示时段、身份规则、公共白名单、待审导入 |
| 本地服务 API | 1 组综合用例通过，含未认证、只读写入拒绝、跨班拒绝、审核、版本冲突、撤回、模拟来源失效与无远程命令接口 |
| 第一轮浏览器回归 | 43 项通过，browser-results.json；原功能保留，旧自习路径改为 #windowsill |
| 第二轮浏览器 | 60 项通过，round2-results.json；含表单、编辑、删除、备份、打印、角色、断网、WebGL 缺失、键盘、320/390/1440 布局 |
| 服务联动 | 16 项通过，sync-results.json；不同浏览器配置通过实际 HTTP/SSE 连接，非 localStorage 假同步 |
| A4 纸笔卡 | 实际导出 PDF，pdfinfo 确认为 1 页 A4 |
| 活动倒计时 | 最终截图程序验证按 eventAt 显示剩余天/小时；不是写死的倒计时图片 |
| 原站保留 | 基线 main 的 365 文件均保留；独立副本只有 3 个雨夜预设相关文件不同；仓库根旧站文件不改 |

服务联动检查包含：教师送审前不显示、管理员审核后 A 班显示 B 班隔离、同 ID 递增版本、模拟课表读取、隐藏优先、ClassIsland 模拟未启动不崩溃、冲突回退、断连最后有效缓存、断网到期过滤、离线禁止发布、重连持久快照、重连后撤回、设备时钟跳变收起内容。

第一轮补充的实际窗台模型加载测试有 3 项通过记录，见 TESTING.md / extended-results.json。其场景源码未在第二轮重写；保留此前实际加载截图。第二轮的默认学习页不依赖 WebGL，场景按需加载。

## 采样性能（不可外推到希沃）

单教室屏，1920×1080，静态课间态，20.00 秒空闲采样：

- Chromium 所有相关进程 CPU 时间增量 / 墙钟时间：约 **2.30% 单核**。
- 相关 Chromium 进程 RSS 求和约 **488.22 MiB**，包含浏览器开销与共享页重复计数，不能当成应用独占内存。
- 页面 JS 已用堆约 **2.22 MiB**；未加载 Three.js。
- 记录：single-screen-performance.json。

四个独立浏览器配置同时联动，15 秒空闲采样：Chromium 汇总 CPU 约 3.33% 单核、RSS 求和 1205.47 MiB；教室页面 JS 堆 3.30 MiB。Node 服务 CPU 约 0.13% 单核、RSS 123.30 MiB。记录：performance.json。云主机共享负载、headless 和采样长度都限制了结论，尚不能证明长期低负荷或中低端 Windows 表现。

两次本地端到端测量分别约 **165 ms**（点击审核到另一浏览器教室 DOM 更新）和 **49 ms**（API 修改到教室 DOM 更新）。样本只有 2 次，不是 P95，不含真实校园网络和真实 ClassIsland。没有把通信过程画成静态图冒充完成。

## 真实设备未完成项

- 当前没有 Windows / 希沃白板 / ClassIsland 实例，未测试共存 CPU、内存、遮挡、抢焦点、投屏或 3 米辨读；不声称“已适配希沃”。
- 当前浏览器管理策略阻止 file://，报 ERR_BLOCKED_BY_ADMINISTRATOR。未绕过策略。单文件已通过 HTTP 仅加载自身后切断网络验证发布与读取，未请求其他脚本/字体/图片；Windows 双击和 file:// 持久性仍待实测。
- 无真实 Android、中低性能电脑、Intel Mac 的本轮长期运行数据；响应式尺寸与禁用 WebGL属于模拟。
- 没有真实校内身份、活动、课程或设备授权，未安装、启动或修改学校设备，没有生产服务器。
- 未进行教师/学生访谈与对照试用，不能证明节省时间或提升学习效果。
- 本轮没有可运行的 ClassIsland .cipx / 原生伴随 exe。报告核实了官方接口与版本差异，实际交付使用模拟适配器；目标版本确定后再验证并选用 SDK 或 IPC。

## 复现

```sh
npm test
npm run test:server
# 启动静态服务后，在另一终端：
python3 -m http.server 8010 --directory dist
npm run test:browser
npm run test:round2
# 自动启动临时 localhost 服务并清理：
npm run test:sync
```

浏览器测试需要安装 Playwright 与 Chromium（README 中有说明）。`CHROMIUM_PATH` 可指定可执行文件，`HAIZ_QA_DIR` 指定产物目录；本地随机凭据从不写入测试产物。禁止为了重跑 file:// 测试禁用受管浏览器策略。真实教学设备测试必须先取得学校/设备管理员许可。
