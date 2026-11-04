---
name: haiz-state-lifecycle
description: "Use when preventing drafts, navigation state, focus sessions and async results from leaking or disappearing across tab switches, backgrounding and account changes."
---

# haiz-state-lifecycle

## 何时使用
修复页面切换时草稿被 dispose 以及 Timer / async 回调跨账号误写。

## 实施流程
1. 状态分类：ephemeral（动画进度）、screen session（搜索条件/滚动位置）、draft（未提交文本）、domain state（正式任务）、principal-scoped（账号数据）。
2. 对 drafts 建立临时持久化/草稿恢复策略；切换标签不应无声抛弃未提交输入。离开流程可提供保存草稿/放弃选择。
3. 每个 async 操作携带 generation/user namespace，返回时重新核验；dispose 后不能 setState。
4. 专注计时依据墙钟时间恢复，处理进程终止、设备时间变化和重复完成事件；不要仅依赖每秒 Timer。
5. 测试：切换 5 页、App 后台→杀进程→重启、账号 A→B、断网→重新联网、弹窗中登出。
6. 对弹窗、输入控制器、订阅和事件监听执行正确 dispose。

## 验收条件
- 数据不会跨账号混合，草稿不会在正常标签切换后无警告消失。
- 定时器与耗时结果不因重复回调造成记录重复。
