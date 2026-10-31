# HAIZ ClassIsland · v0.3 教室连接预览版

本插件适用于 ClassIsland 2.x 的授权测试环境。Windows ClassIsland 2.1.0.1 真机加载尚待验证。

## 新的无密码手填配置流程

1. 在 HAIZ Academic 后台选择正确班级，点击「复制教室展示链接」。
2. 打开 ClassIsland → 设置 → 扩展设置分组下的「HAIZ 教室连接」。
3. 点击「从剪贴板粘贴」，或用 Ctrl+V 粘贴完整链接；不必截取或输入 96 位 screenKey。
4. 点击「验证并连接」。插件访问 HTTPS 只读 API，验证 readOnly=true、containsStudentIdentity=false 和 assignments 数组，显示班级名、任务数。
5. 连接成功才自动保存配置；无效密钥、404、Cloudflare Tunnel 502/530、网络超时等只显示不含凭据的错误信息。
6. 在 ClassIsland 的组件区域添加「HAIZ 班级任务」，即刻显示已经发布的任务。
7. 晚修自动投放默认关闭。只有在获教师许可的测试场景下，才主动勾选「晚修自动投放」。

整个过程不需要 Node.js 安装在 Windows，不需要老师手动创建 JSON。原有 haiz-screen.json 保留兼容；本插件存储在 ClassIsland 的 PluginConfigFolder，并使用临时文件原子覆盖，避免写一半损坏。用户可点击「测试当前连接」检查已经存在的配置，或二次确认后「断开连接」清除本地密钥。

### 功能与限制

- 普通组件每 45 秒轮询 HAIZ Academic 只读 API；配置保存会触发一次即时刷新。
- 晚修逻辑每 2 秒读取 ClassIsland 当前课表，识别当天最后两节自习/晚修，打开非置顶看板；教师关闭后本节不再弹出。
- Cloudflare Quick Tunnel 必须保持 Mac 上 Node.js、cloudflared 运行；重建 Quick Tunnel 后须在新设置页面重新粘贴新的链接。
- 目前兼容的是旧 HAIZ Academic Node.js API /api/screens/{key}。**尚未适配秒哒 GD/Supabase**。
- 旧后端没有严格的作业日期/撤回版本字段，暂不能保证只显示当天作业；生产教室部署前需完成字段协议与 Windows 真机验收。
- 请只使用虚构作业和教师允许的测试课表。完整展示链接及其 screenKey 均属访问凭据，禁止在聊天/截图/仓库公开。
- README.md 与 icon.png 均应位于 .cipx 根目录。请不要安装旧版 v0.2.0 的缺文件包。

## 构建与测试

```bash
dotnet build integrations/classisland/HAIZ.ClassroomPlugin/HAIZ.ClassroomPlugin.csproj -c Release /p:CreateCipx=false
dotnet run --project integrations/classisland/HAIZ.ClassroomPlugin.Tests/HAIZ.ClassroomPlugin.Tests.csproj -c Release
```

当且仅当 GitHub Actions Windows build/test 通过并生成新包后，才可在授权的 Windows 设备上使用预览版本。单纯通过编译不等于已完成 ClassIsland 2.1.0.1 宿主和希沃真机验收。

项目：https://github.com/manyIwant/haiz

