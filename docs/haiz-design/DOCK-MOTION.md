# Dock 运动与验证

实时 Dock 用 requestAnimationFrame 与带速度状态的阻尼弹簧；不是 Remotion 视频。单个透镜跨三个导航项移动，路径、图标与文字随其位置变化。快速改变目标保留当前位置和速度，拖动释放依据位置与速度投影选择页面。导航选中状态由实际 hash 统一推导。

Dock Lab 提供 precise(520/44/0.10)、balanced(390/35/0.16)、soft(250/25/0.20) 三组刚度/阻尼/形变量。balanced 是当前候选，并未经过用户盲测证明“最自然”。运动单测覆盖20次改变目标、低帧率收敛和减少动效。

搜索展开使用同一玻璃球边界作为起点；收起中再次打开从当前 transform 续接。导航只使用一个主要背景模糊层，缩小不改变文档布局。visualViewport、safe-area 与 Android 返回监听有实现，但真机键盘、系统返回手势仍待验收。

`world/apps/mobile/tests/native-web.mjs` 使用真实打包页面测试30次导航、20次快速中断点击、8次指针拖动、主题持久化和搜索。录像为 Linux Chromium 自动化，不代表物理触屏验收。运行结果以 evidence/web/results.json 为准。

2026-10-25 浏览器回归通过上述8组检查，0个pageerror。此次实际发现并修复了链接原生拖拽抢占指针事件，以及停住后松手仍带入过期速度的问题。录制文件见 evidence/web/recordings；它验证功能与操作连续性，不是设备帧率或美术评分。
