---
name: haiz-reliability-qa
description: "Use when testing HAIZ error states, real-world edge cases, destructive data failures and release gates before declaring a build stable."
---

# haiz-reliability-qa

## 何时使用
关注真实学生会碰到的故障，而不是只看理想路径。

## 实施流程
1. 制作高风险矩阵：账号 A/B 切换、无网、超时、存储被系统清理、旧格式导入、任务多端冲突、重复点击、App 杀进程。
2. 每个流程验证 busy/loading/empty/error/offline/permission-denied/expired-session/data-conflict。
3. 发生保存失败须显示具体状态，恢复后保证不重复插入；不要用成功的动效掩盖失败。
4. 用真实屏幕录制和日志复现，保存去识别化证据；不要上传真实学校群通知或账户凭证。
5. 制定发布门槛：P0 数据丢失/跨账号越权/签名问题必须阻断，视觉瑕疵按风险分级。
6. 报告“有证据通过 / 尚缺环境 / 失败 / 不适用”，不把检测脚本运行成功与生产合格混淆。

## 验收条件
- 没有未知数据丢失路径或可重现跨账号泄漏。
- 任何危险破坏性测试都只在隔离的测试环境/账号执行。
