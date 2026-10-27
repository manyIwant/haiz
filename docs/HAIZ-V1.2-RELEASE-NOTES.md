# HAIZ App v1.2 Preview — Release Notes

**状态：本地候选发行版，尚不等于 GitHub 已公开发布。**
2026-10-27 · 非官方独立校园工具

## 本轮实装（与 HAIZ V1.1 对比）

1. **HAIZ Inbox · 消息到任务**
   - 用户主动粘贴群通知，或选择本地 TXT / MD / CSV / DOCX / PDF / PNG / JPG。
   - 纯文本、Word 和带文字层的 PDF 在本机提取文本。
   - Android/iOS 截图使用 ML Kit 本地中文 OCR。Flutter Web 图片 OCR 不支持，会明确提示。
   - 依靠可解释的规则提取候选作业，人工修改科目、截止时间后才保存。
   - 保存人工确认任务的原始通知片段及来源，供以后核对；没有自动假定教师身份。
   - 相同科目、标题、日期的任务加入时去重。

2. **作业日历**
   - 在「课表」下显示确认的带截止日期任务，按日期排序。
   - 一键导出标准 `.ics` 日历文件，按全天事件处理，不伪造截止时刻。
   - 文件导出是用户主动选择；不会悄悄读取或改写系统日历。

3. **Study Relay · 学习接力**
   - 任务关联专注、下次打开恢复上次选择。
   - 为每个任务存储 5000 字以内的学习草稿、下一步计划和临时思路。
   - 在专注页可以打开/修改原有笔记，笔记保存在设备端。

4. **HAIZ Command**
   - 学生首页全局搜索，按标题、科目、学习笔记查找本地任务；也可检索课程。
   - 搜索结果直接跳到该任务的专注界面或对应课表日。

5. **One Publish / Paper Bridge / Classroom Surface**
   - 教师 Web 继续支持输入一次任务后导出纯文本、打印纸质清单。
   - 新增教室大屏 `web/teacher/classroom.html`，适合 Windows/希沃投影。
   - 大屏与教师页面使用同一浏览器的本地草稿，同源标签页间可通过 storage 事件更新。
   - 不依赖学生课堂使用手机，也不要求全班注册。

6. **HAIZ Teach**
   - 保留原创打点计时器小车实验：50Hz 原始点、0.10s 计数点、速度/加速度及 v–t 图。
   - 属于理想模型，非真实测量实验；调整参数并观察，数据计算由自动测试验证。

7. **外观与构建**
   - 继承 V1.1 iOS 视觉方向、Cupertino 风格导航、Spring Dock。
   - 自制 HAIZ 几何「h.」App 图标（不使用之前 Flutter 默认标识）。
   - 配置独立 Android 应用 ID 与本机私有签名密钥。

## 尚未实现的长期设想（不能宣称已实装）

- 无登录的 QQ/微信消息自动同步；从平台账户抓取群消息不在本次范围。
- 教师身份验证、服务器发布、跨设备实时同步、作业提交确认。
- 全面 ClassIsland Windows 插件联动；目前是独立的浏览器大屏。
- 所有课程的教材/题库及完整互动教学引擎，目前只有可演示的一节物理实验。
- 学校校园卡、电费、图书馆正式接口，未经授权不得接入。
- 统一的多人学习知识图谱，仅支持任务笔记搜索。
- iOS IPA，因为本机没有完整 Xcode 与 CocoaPods。
- App 真机安装/兼容性测试需要连接 Android 设备，本机暂未见到设备。

## 安全与许可

- 源通知由用户主动导入，不进行消息平台的未授权抓取。
- 文本、OCR 结果、个人任务、笔记默认保存在设备，不主动发往第三方 AI。
- 注意：本地 shared_preferences 没有做加密，**不适宜存储密码、学籍号或特别敏感的学生信息**。
- Notice Hub 部分代码具有 PolyForm Noncommercial 许可，因此本工程没有复制其实现，仅借鉴工作流。
- Every Joule 公开课件无整站自由复用许可，本项目的物理实验由 HAIZ 独立编写。
- 使用的 file_picker (MIT)、archive (MIT)、xml (MIT)、pdfrx (MIT) 和 ML Kit Flutter 桥接包需要保留各自相关声明。

## 发行签名

Android APK 的签名密钥只保存在使用者 Mac：

- `~/.config/haiz-android/haiz-preview-release.jks`
- `~/.config/haiz-android/signing.properties`

两份文件权限均为 600，**不会进入 Git 或交付 ZIP**。后续同一应用 ID 升级必须使用同一签名，请自行安全备份到私有位置；不要在公开仓库上传。

## 本地安装与测试

编译依赖：
- Flutter 3.47.8 / Dart 3.13.7
- JDK 21
- Android SDK 36 + Build Tools 36 + Platform Tools
- NDK 28.2（构建需要时自动安装）

在 `app/` 中：

```bash
~/development/flutter/bin/flutter analyze --no-pub
~/development/flutter/bin/flutter test --no-pub
~/development/flutter/bin/flutter build apk --release --no-pub
```

构建成功后，APK 默认在：
`app/build/app/outputs/flutter-apk/app-release.apk`

连接已授权的 Android 手机后可使用：
`~/Library/Android/sdk/platform-tools/adb install -r <APK路径>`

请在手机上实际测试中文截图、文件选择、PDF 解析、日期确认、本地存储、五个导航页面和应用重开后恢复数据。

## 公开 GitHub 发布状态

当前开发机器 `gh auth status` 显示未登录，且 git Keychain 没有可用的 GitHub HTTPS 凭据。
因此，**不能将已有本地文件自动称为 GitHub Release**。本轮只在本机独立分支创建、审查和整理交付包；GitHub 发布必须在明确授权后由具有发布权限的账号实际创建并上传文件。
