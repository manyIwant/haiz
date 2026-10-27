## HAIZ Academic v1.3 · 自建班级协作预览

本地运行的独立教学平台：services/academic/ (Node 24 + SQLite、教师/学生/班级与权限、作业发布、教室只读凭据)；可授权 QQ 官方机器人 integrations/qq-bot/；ClassIsland 原生组件 integrations/classisland/；Flutter App 的「探索 → HAIZ Academic」入口。

- 开启本地演示：运行 tools/start-academic-local.command，同一台 Mac 访问 http://127.0.0.1:8780/；本地管理员初始凭据存放在私有 ~/.config/haiz-academic/local.env，不得提交到仓库。
- 官方学校身份/名册接口未经授权尚未接入。只有收到校方明确批准的接口和签名密钥后才可启用伪匿名名册同步。
- QQ 自动接入仅限获腾讯许可的机器人、已授权的群 @事件，教师确认之后才发布；不自动读取全部群聊历史或他人账号。
- ClassIsland cipx 已在 Mac 编译，未在 Windows ClassIsland 真机安装测试。
- 详细状态及数据边界见 docs/academic/RELEASE-V1.3.md。

# HAIZ v1 Preview · 跨端学习与教学原型

> **状态：可运行的本地 v1 预览，不是正式发布。** 非海南中学或郑州大学官方服务。
>
> 项目隔离在 `~/Documents/HAIZ-UI-Research/HAIZ-v1/`。没有覆盖 `manyIwant/haiz` 的主分支、没有自动部署、没有 QQ 登录或学校账号接入。

## v1.2 功能发行候选（2026-10-27）

新增截图/文档导入、人工核对及原文来源、作业日历与 ICS 导出、Study Relay 学习笔记、HAIZ Command、Classroom Surface。详情以 [`docs/HAIZ-V1.2-RELEASE-NOTES.md`](docs/HAIZ-V1.2-RELEASE-NOTES.md) 为准。APK 只有在构建完成并验证签名后才算完成。

## 这版真正完成的功能

| 来源思想 | HAIZ v1 自主实现 | 使用场景 |
|---|---|---|
| ZZUPocket（MIT） | 今日聚合、每周课表、简单课程编辑、离线存储 | 学生了解今天和下一节课程 |
| Super Productivity（MIT，作为设计参考） | 学生任务清单、任务 → 专注、任务上下文保存 | 从作业开始专注，并在下次打开时恢复选择的任务 |
| Notice Hub（新增部分非商业许可；**没有复制代码**） | 本地规则提取作业、人工编辑/确认、去重 | 把手动粘贴的通知变成任务候选 |
| Every Joule（已公开发布产物没有整体复用许可；**没有复制代码**） | 原创 Flutter 交互打点计时器：小车、50 Hz 纸带、计数点、v-t 图 | 用参数和测量理解高一物理 |
| HAIZ 自有方向 | Porcelain、Obsidian、Ocean + Glass Dock 与渐进式动效 | 跨模块一致的体验 |

## App · Flutter

Flutter 页面：今天、课表、收件、专注、探索。探索中有可进入的“打点计时器”实验。

- 今日页面支持添加、完成、删除任务；每项任务可点击播放图标选择为当前专注任务。
- 课表按每周重复规则显示；支持添加/删除本地课程（尚无学期/轮次/课表导入）。
- 收件箱可以粘贴文本，提取候选、编辑内容/日期、选择确认后才写入任务。
- 专注计时和历史记录、本地选择的关联任务，通过设备端缓存保存。计时运行期间切换页面继续；**应用结束或系统杀进程时不会保证继续计时**。
- 探索中的互动实验为**理想匀加速运动**，每 0.02 s 打一原始点、每 5 个间隔一个计数点（0.10 s），中间时刻使用中心差分求速度，再拟合 v-t 加速度。没有建模完整滑轮动力学、摩擦及实际测量随机误差。

**所有初始化的课表和任务都是示例数据，不代表真实课程或教师发布。**

## Web · 教师整理工作台

地址：`web/teacher/index.html`。

- 添加科目、任务内容、可选截止日期。
- 当前浏览器 localStorage 本地保留草稿。
- 生成可复制的标准文本（不代表教师身份认证）：
  `【HAIZ任务】物理｜整理打点计时器报告｜2026-10-29｜HAIZ Teacher 演示（身份未验证）`
- 浏览器打印为纸质任务单。
- **不直接向学生发送消息，不访问学校数据库，不提供真实跨设备登录同步。**

### 端到端体验（人工文本交接）

1. 浏览器在教师页面添加一两项作业，点击「复制给 HAIZ App」。
2. 打开 Flutter App 的「收件」，粘贴文本并点击「提取候选」。
3. 检查科目与日期，选择确认并加入任务。
4. 在「今天」选择任务旁的播放按钮，进入「专注」。
5. 关闭页面后再次打开，个人任务和上一次选中的任务会从本地数据恢复（浏览器未清理数据的情况下）。
6. 到「探索」进入物理实验，调整加速度看纸带点距、速度和 v-t 图。

## 启动方式

### 一键同时启动 Web 教师端和 Flutter App Web 预览

Mac 终端：

```bash
cd ~/Documents/HAIZ-UI-Research/HAIZ-v1
bash start.command
```

启动脚本会用已安装的 Flutter SDK 编译 Web，然后同时提供：

- **学生 App Web 预览**：http://127.0.0.1:8766/
- **教师 Web 工作台**：http://127.0.0.1:8767/

两者均只监听本机回环地址。终端保持打开，按 Ctrl+C 关闭。

### 开发命令

```bash
cd ~/Documents/HAIZ-UI-Research/HAIZ-v1/app
~/development/flutter/bin/flutter pub get
~/development/flutter/bin/flutter analyze
~/development/flutter/bin/flutter test
~/development/flutter/bin/flutter build web --release
```

可以用 `bash check.command` 一次运行分析、测试、Web 构建。只在可用的 macOS SDK 环境中运行对应目标。

## 目录

```text
HAIZ-v1/
  app/                      # Flutter 项目：Android/iOS/Web/macOS 工程模板
    lib/domain/
      pocket_models.dart     # 课表、任务、专注模型
      notice_parser.dart     # 原创本地通知候选提取
      ticker_physics.dart    # 纸带及数值计算
    lib/core/pocket_store.dart
    lib/ui/                  # 5 页和实验、设计组件
    test/                    # 自动化测试
  web/teacher/index.html     # 无外部依赖的独立教师页面
  docs/                      # 参考来源、验收记录、截图
  start.command
  check.command
```

## 明确未实现 / 不保证

- **未接入真实学校服务**：没有正式教师身份认证、官方课表、消息自动抓取、校园卡或宿舍数据。
- **未实现在线数据同步**：App 与 Web 依靠复制文本交接；两者各自存储本地数据。
- **未迁移完整四个开源仓库**：只独立实现小范围功能，避免重构与许可证风险。
- **尚未构建 Android APK 或 iOS IPA**：此 Mac 上此前检测缺少 Android SDK 与完整 Xcode；需重新安装并验证后才能真正称为移动原生版本。
- 无多设备离线冲突解决、数据库备份、真实用户权限系统。
- 通知解析是保守规则，不是人工验证、可靠 OCR 或语义级 AI；相对日期以导入当日为准，不等于原消息的发送日期。所有候选都要人工确认。
- Flutter Web 展示的是学生 App 预览；不是对既有 `haiz.space` 网站的替代。**没有部署上线**。

## 版权与技术

参考仓库：
- ZZUPocket: https://github.com/3beuml/ZZUPocket (MIT)
- Super Productivity: https://github.com/super-productivity/super-productivity (MIT)
- Notice Hub: https://github.com/ExpertKT/notice-hub (上游 MIT / 新增 PolyForm Noncommercial，需区别许可范围)
- Every Joule Lesson 1: https://github.com/iamtechartist/every-joule-lesson1 (仅已构建发布文件，未发现整体 LICENSE)

v1 的通知解析、教师 Web 页面和 Flutter 物理实验均为独立实现，并没有将 Notice Hub、Every Joule 的代码或媒体打包进来。
Flutter、shared_preferences 等自身的许可证以依赖包为准。

## 后续 v1.1 应优先处理

1. 任务附加原始消息的可追溯存储（当前仅保留导入来源文字，未长期保存完整原文），提供核对与撤销。
2. 为教师发布增加明确的权限验证与后台同步；没有授权不要试图模拟学校身份。
3. 高中课表增加学期、节次与临时调课，不再用简单每周重复规则覆盖全部情况。
4. 正式 Android 构建、真机离线与性能测试；iOS 环境齐备后再验证。
5. 学习接力从“恢复任务选择”扩展到草稿和资料上下文，避免把现有功能夸大成完整学习恢复。
