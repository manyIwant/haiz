---
name: haiz-inbox-ocr
description: "Use when improving HAIZ incoming notice capture, screenshot OCR, document parsing and user-reviewed task extraction while respecting privacy and platform limitations."
---

# haiz-inbox-ocr

## 何时使用
把通知消息“输入→理解→确认→任务”改为可靠流程；OCR 和 AI 的不确定性绝不能伪装成最终事实。

## 实施流程
1. 将不同输入来源建模：手动文本、系统分享、指定群通知、PNG/JPEG 截图、PDF/DOCX；每种来源附置信度/来源/时间和失败状态。
2. 将 OCR 结果作为可编辑草稿展示，标出来源片段和未识别内容；不自动发布作业或写入不可撤销实体。
3. OCR 对 Web 采用本地 WASM/Worker；验证模型同源、图片不外传、语言包缓存、取消和大文件/低内存处理；原生优先受支持的本机识别。
4. 对敏感通知启用 AI 预解析前须逐项知情同意；基础脱敏不等于绝对隐私保护。
5. 处理重复收件、不同群同文、日期歧义、内容撤回、未授权消息、跨账号设备队列问题。
6. 验证人类确认、编辑、拒绝、恢复及网络断开后保存逻辑。

## 验收条件
- OCR 不能识别时不会编造任务。
- 未确认候选不偷偷进入已确认待办。
- 所有消息来源和权限状态可追溯。

## 相关文件和参考
- `app/lib/ui/inbox_page.dart`
- `app/lib/domain/notice_import_service.dart`
- `app/lib/domain/message_intake_bridge.dart`
