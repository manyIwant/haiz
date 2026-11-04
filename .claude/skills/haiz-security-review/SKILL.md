---
name: haiz-security-review
description: "Use when performing HAIZ code and architecture security review for student data, untrusted imports, third-party skills, permissions and build supply chain."
---

# haiz-security-review

## 何时使用
前端与服务端均按不可信输入设计；允许安全学习，不应把安全口号当审计。

## 实施流程
1. 追踪用户数据：设备通知/截图 → 提取 → 存储 → 云端 → 备份/日志 → 删除；画出信任边界和授权点。
2. 评估反序列化数据限额、ZIP/DOCX 解压占用、PDF/OCR 内存、恶意文本渲染、URL 处理、路径/文件选择。
3. 检查 Supabase RLS、API session、CSRF/CORS 边界、token 存储、WebView 导航允许列表、Flutter MethodChannel 调用权限。
4. Review 第三方 Skill/脚本中的提示词注入、自动执行、遥测、`curl | sh`、删除命令；只有经过审核才允许运行。
5. CI 最小权限，依赖锁定，签名密钥不入 Git；审查供应链来源。
6. 发现高风险漏洞先停下联网发布/真实学生数据测试，使用隔离数据复现并提供防御修复。

## 验收条件
- 不会由于重构把隐私边界弱化。
- 每项风险有攻击面、证据、缓解措施和回归测试。
