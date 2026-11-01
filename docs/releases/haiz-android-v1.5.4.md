# HAIZ Android 1.5.4 · 云端项目接入更新

Build: 2104 | Android package: `space.haiz.app.preview` | upgrade from 1.5.3 without uninstalling

## 更新
- 默认使用 HAIZ 的 Supabase Free 项目 URL 和公开 `sb_publishable_` 客户端密钥（无私密管理密钥）。
- 保留 1.5.3 微信通知诊断：原生监听、指定群名、过滤原因、人工审核；不上传未审核的被过滤聊天正文。
- 后端 `services/academic` 与 Supabase Auth 是两套不同服务。不会将班级身份或本地消息静默迁移到 Supabase。
- 修复旧 RC 工作流重复创建 `pocket-v1.5.3-rc.1` 固定标签造成的后续构建错误；归档为手动 QA。
- 本机正式签名证书应与 1.5.3 完全一致；APK 无须卸载重装。

## 验收边界
- 经公开 API 探测，Supabase Auth 健康端点返回 HTTP 200；`pocket_snapshots` 表存在，匿名 SELECT 返回 401。
- 这些结果不能替代两账号 RLS 越权验证、注册邮件、登录同步或设备端实测。请在真实用户数据中谨慎测试，先备份。
- 不要发布 CI 临时签名候选；正式包需要本机原始签名密钥签署、验证和 SHA-256 校验。
