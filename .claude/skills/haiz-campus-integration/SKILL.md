---
name: haiz-campus-integration
description: "Use when connecting HAIZ Pocket to haiz.space content, 3D campus, school information pages or future officially authorized campus services."
---

# haiz-campus-integration

## 何时使用
App 不是网站外链合集；建立清晰的场景和边界，不让复杂 Three.js 首屏拖慢学习工具。

## 实施流程
1. 把校园内容分为：真实地点/照片与导览、校园专题、实验工具、待授权校园服务。
2. 对每个入口说明用户价值与网络限制；外部打开与内部 WebView 的取舍由性能/导航/隐私共同决定。
3. 校园信息需有可信来源和更新日期，勿伪造校园卡余额、宿舍电量、空教室或学校许可。
4. 导览/3D 采取可选惰性加载和低性能替代路径，避免普通待办与课表承担 3D 资源。
5. 校园板块可用真正摄影讲故事，但任务管理页避免频繁插入无关影像。
6. Web 入口要保留回退、安全域名白名单、离线提示和可访问性。

## 验收条件
- 使用者能区分校园编辑内容与已连接的学校官方服务。
- 常用学习功能不因 3D/外部站点不可达而失效。

## 相关文件和参考
- `app/lib/ui/campus_page.dart`
- `campus-3d.html`
