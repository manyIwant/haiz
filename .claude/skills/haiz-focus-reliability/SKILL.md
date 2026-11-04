---
name: haiz-focus-reliability
description: "Use when rebuilding HAIZ focus timer and session history to remain correct across pause, process death, foreground/background and account transitions."
---

# haiz-focus-reliability

## 何时使用
不把漂亮倒计时误当成可靠计时。

## 实施流程
1. 明确 session 状态：idle, running, paused, completed, discarded；记录稳定 session ID、startedAt、elapsed/paused、finishedAt 和关联任务。
2. 计时依据真实时间差计算 UI；1 秒定时器只驱动显示，不作为事实来源。
3. 处理系统强杀、重启、长时间后台、跨午夜、用户改系统时间和时区；必要时标注恢复估算与人工确认。
4. 完成事件必须幂等，避免 resume / tick / button 多次写入记录；账号切换锁定私有会话。
5. 增加错误与暂停的显式状态，数据写入失败可恢复；动效遵循系统减少动画设置。
6. 对 Android/iOS/PWA 平台通知能力分别标注真实支持范围，不能承诺后台无限计时。

## 验收条件
- 每次会话最多生成一条完成记录。
- 进程死亡后能恢复或提示，而非无声重置。
- 用户可看见精确的会话状态。
