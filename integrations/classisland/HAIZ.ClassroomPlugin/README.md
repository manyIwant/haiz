# HAIZ ClassIsland — 统一插件 v0.2.1 预览版

本插件是独立 HAIZ 项目，不是学校官方系统。仅适用于获得授权的 ClassIsland 2.x Windows 测试环境。2.0 SDK 构建通过不代表 2.1/2.2 已完成兼容验证；ClassIsland 1.x 不兼容。

## 功能
- 「HAIZ 班级任务」原生组件：每 45 秒读取本班公开作业，供教师自行添加到 ClassIsland 显示区域。
- 「晚修自动看板」：可选的后台服务，读取 ClassIsland 当日实际课表，选出最后两节「自习/晚修」课程，在对应时段自动显示。非自习时段自动隐藏；教师关闭后本节不再自动弹出。默认禁用。
- 只访问既有 HAIZ Academic Node.js 后端的公开只读接口，不保存学生姓名、成绩或教师密码；网络错误时自动隐藏，不影响 ClassIsland 原有课程提醒。

## 测试用配置
在本插件配置目录的 haiz-screen.json 中填写：
```json
{
  "enabled": true,
  "eveningAutoShow": false,
  "serverUrl": "https://example.trycloudflare.com",
  "screenKey": "教师后台生成的96位只读屏幕密钥",
  "selfStudySubjectIds": []
}
```

在获授权的测试电脑先保持 eveningAutoShow=false，只检查「HAIZ 班级任务」是否显示虚构作业。之后才可在经许可的测试课表中启用 eveningAutoShow=true。

不要分享 screenKey、管理员密码或完整教室展示链接。Quick Tunnel 仅供临时测试，Mac 后端需要保持开机联网。

## 重要限制
目前只编译和验证了排课逻辑，没有验证真实 Windows ClassIsland/希沃宿主加载、窗口表现和硬件稳定性。原有作业接口没有严格的日期/撤回版本契约，因此不能保证只显示当天任务；正式启用前还需升级后端。

更多源码、验收清单与更新记录：
https://github.com/manyIwant/haiz/pull/46

## 致谢
ClassIsland 社区与公开 Plugin SDK。本项目为非官方独立扩展，不修改 ClassIsland 本体。
