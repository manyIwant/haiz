---
name: haiz-auth-privacy
description: "Use when reviewing HAIZ Supabase authentication, RLS, permissions, account lifecycle, device-local data boundaries and privacy consent."
---

# haiz-auth-privacy

## 何时使用
学生数据敏感；严禁把公开客户端密钥错当成服务端管理员密钥，也不能把 UI 的隔离检查当作数据库权限。

## 实施流程
1. 认证：核查会话校验、secure storage、Web 策略、邮箱验证、登出/会话失效；避免凭“UI 显示锁定”推断安全。
2. RLS：在服务端测试 user A 可操作自己的记录、对 B 的 select/insert/update/delete 均无法越权；按设计区分不允许 delete 与账户删除合规流程。
3. 本地：所有持久记录、草稿、系统分享队列和 OCR 缓存都确认账号隔离、清理与生命周期。
4. 详细审查日志、崩溃报告、导出文件、网络请求是否携带通知原文或账号凭据；默认避免上传未经授权的内容。
5. 新权限需先明确用户利益、具体数据、保存位置、关闭方式；不能把通知监听包装成默认功能。
6. 不把 `service_role`、私钥、完整 OAuth token、真实学生样本放进 App/CI Artifact/公共 repo。

## 验收条件
- 有运行于实际后端的跨账号负面测试证据。
- 退出与切换账号后老数据不可展示。
- 明确可执行的数据导出/删除及故障支持路径。
