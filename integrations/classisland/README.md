# HAIZ Classroom Plugin · ClassIsland 原生组件

来源：以 ClassIsland 官方 `ClassIsland.PluginSdk` 2.0.0.2、官方 Sample 项目和 `ComponentBase` API 为基础自行实现。与 ClassIsland 本体保持隔离，没有修改第三方源仓库。

## 构建

```bash
export DOTNET_ROOT=/opt/homebrew/opt/dotnet@8/libexec
export PATH="$HOME/.dotnet/tools:$PATH"
cd HAIZ.ClassroomPlugin
"$DOTNET_ROOT/dotnet" build -c Release
```

ClassIsland 2.0 插件包输出在 `HAIZ.ClassroomPlugin/cipx/HAIZ.ClassroomPlugin.cipx`，校验记录为 `checksums.md`。该代码是 Avalonia/NET8 ClassIsland 原生组件，不是 WebView。

## 在教室 Windows 电脑上使用

- 建议先在获得授权的 Windows 电脑、与你目标版本一致的 ClassIsland 2.0 环境中进行安装和兼容性测试。
- 从 ClassIsland 插件管理界面导入构建的 `.cipx` 后，进入插件的配置目录，将以下内容保存为 `haiz-screen.json`。
- 具体目录由 ClassIsland 的 `PluginConfigFolder` 指定。不要把私有配置随包打包、公开上传。
- 将组件「HAIZ 班级任务」添加到 ClassIsland 显示区域，它会每45秒读取一次任务列表。网络断开不会令 ClassIsland 主程序崩溃。

```json
{
  "serverUrl": "https://academic.example.com",
  "screenKey": "教师端生成的96位只读屏幕密钥"
}
```

`serverUrl` 必须是 HTTPS，或仅用于同一电脑测试的本地 HTTP loopback。教室屏幕密钥不是教师账户 Session，也不含学生的个人信息；教师可以轮换它以吊销旧链接。

## 验证情况

Mac M5 上的 .NET 8 Release 编译通过，官方 SDK 的 .cipx 打包及 MD5 校验生成成功（0 警告、0 错误）。**未在 Windows 上安装运行过真实 ClassIsland**，因此不宣称已完成教室设备兼容性验收。升级 ClassIsland 2.2 需迁移插件 API/SDK 后另行测试。
