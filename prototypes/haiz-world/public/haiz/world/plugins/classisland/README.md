# ClassIsland 2.x SDK 实验源码（未完成宿主加载验证）

依赖固定 ClassIsland.Core 2.1.1.1，.NET 8。`dotnet build Haiz.ClassIsland -c Release`。
本环境已安装 .NET 8.0.426，但 NuGet RestoreTask 在系统命名互斥锁 `NuGet-Migrations` 处失败，尚未编译成功；不提供可安装 cipl/dll，不声称兼容希沃或 ClassIsland。

代码依据官方公开 SDK：PluginBase / PluginEntrance、ILessonsService、IProfileService、ClassInfo.CurrentTimeLayoutItem。调用只读属性；不修改宿主课表、程序文件，不使用反射或进程注入。源码参考 https://github.com/ClassIsland/ClassIsland 。正式加载清单/打包必须按实际宿主版本的官方模板补齐并验证。

启用流程（仅经许可的普通 Windows 测试环境）：先完成编译与官方插件清单配置、宿主加载验收，再将示例设置复制到插件配置目录的 haiz.settings.json，填入本地服务 display-a 的只读凭据及班级，显式 Enabled=true。凭据不得提交仓库。当前仅连接 127.0.0.1:8787，不含校园网络配置。

读取当天有效课表，包括临时课表；取最后两节名称含“自习/晚修”的有效课程，也可通过明确的课程 GUID 配置识别。没有两节或时段冲突时不显示。每两秒检查课表并读取公开作业；只显示本班、当天、已审核且未撤回内容。断连保留公开缓存，过期退出。窗口不置顶、不激活抢焦点，关闭后本节不重开。未启用时不联网。异常隔离于后台服务，不停止宿主计时器。

仍待验证：SDK 包与公开主分支 API 差异、宿主生命周期、组件原生设置页、休眠/系统时区跳变、ClassIsland 1.x 独立 WPF 适配、Windows 内存及 CPU、教学软件遮挡。此源码不能替代已经验证的网页作业闭环。1.x 不兼容此 Avalonia 工程。
