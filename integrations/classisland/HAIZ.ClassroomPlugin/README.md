# HAIZ 晚修自动作业看板 v0.4（ClassIsland 2.x 预览）

这是**不占据 ClassIsland 顶部课表/组件栏**的独立自动化插件。普通组件已从插件注册和编译中移除。依然通过 ClassIsland 官方插件机制运行：使用 `ILessonsService` 与 `IProfileService` 只读取当天实际课表，独立后台服务在最后两节有效自习/晚修期间打开正常的非置顶作业窗口。

## 连接流程（不需要 JSON 手填）

1. 从 HAIZ Academic 后台复制所选班级的完整「教室展示链接」。
2. 进入 ClassIsland → 设置 → HAIZ 教室连接，粘贴链接 →「验证并连接」。
3. 确认显示正确的班级和公开作业数量；连接保存后「自动晚修投放」**仍然默认关闭**。
4. 教师在经许可的测试环境下勾选「按最后两节自习自动打开独立作业看板」。
5. 此后插件后台检测到最后两节自习的任一节时自动打开作业看板；课间和下课自动隐藏，教师关闭后本节不再弹出。

**不用到 ClassIsland「添加组件」页面找 HAIZ，也不应为 HAIZ 保留顶部组件位置。** 如果曾在旧版本中添加过「HAIZ 班级任务」，升级前在当前档案中手动移除该旧组件，保留 ClassIsland 原有课表及铃声。

## 实现边界

- 本版本是**自动化行为**（由插件自身的后台日程监听触发），但不是 ClassIsland 自动化编辑器中的独立 `Action` / `Trigger` 工作流条目。这样无需教师再次配置两节课程的触发器，也避免双重时间表。
- 只显示真实 ClassIsland 日期/课表识别到的最后两节有效自习。判断周期约 2 秒；读取作业最多约每 45 秒一次。
- `EveningHomeworkWindow` 设置 `Topmost=false`、`ShowActivated=false`；不改动 ClassIsland 的课程、提醒、计时器或原有任务栏布局。不强制覆盖其他教学软件。
- 密钥通过插件配置目录中的 `haiz-screen.json` 保存，粘贴完整链接自动提取 96 位屏幕密钥。禁止提交到 GitHub。
- 通过只读 `/api/screens/{key}` 接口获取班级公开作业，不显示个人身份。
- 当前 Node.js Academic v1.3 后端未提供严格的任务日期/撤回版本字段，因此不保证「今天的任务」完全筛选准确；无法替代真实作业通知，正式部署前需补后端协议。
- 暂不支持 GD/Supabase；临时 Cloudflare 隧道必须保持 Mac、Node.js 和 cloudflared 进程运行。
- 旧版在 Windows ClassIsland 2.1.0.1 的真实宿主加载与看板显示尚需现场验收；CI 编译成功不等于现场通过。

## 源码及构建验证

```bash
dotnet build integrations/classisland/HAIZ.ClassroomPlugin/HAIZ.ClassroomPlugin.csproj -c Release -p:CreateCipx=false
dotnet run --project integrations/classisland/HAIZ.ClassroomPlugin.Tests/HAIZ.ClassroomPlugin.Tests.csproj -c Release
```

GitHub Actions Windows 验证还包括检测最终 DLL 未包含 `HomeworkComponent` 和 `manifest.yml`、`README.md`、`icon.png` 完整性。安装包只用于获授权的 Windows 测试电脑，验收需确认自动启用、结束隐藏、教师关闭后的行为、课程临时变更、断网及投影焦点。

项目：https://github.com/manyIwant/haiz
