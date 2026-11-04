---
name: haiz-review-before-merge
description: "Use when reviewing a HAIZ 2.0 pull request, comparing a redesign with main and deciding whether it is safe and ready for a release candidate."
---

# haiz-review-before-merge

## 何时使用
这是最终防线：每个 PR 不能只凭截图或自动化绿灯就合并。

## 实施流程
1. 查看 diff、提交历史、是否触碰签名/认证/备份/数据库/Service Worker，核对变更范围与任务目标。
2. 检查旧版可用业务是否被误删；尝试与主分支相比的用户流程回归。
3. 运行静态分析、测试、产物构建、视觉截图对照；报告无法运行项。
4. 审核 SDK/API 调用正确性、状态销毁、异步竞态、数据迁移/撤销、访问权限和性能预算。
5. 大范围 UI 变动必须有旧新版对照图与原生/网页平台限制说明。
6. 给结论：可合并 / 有条件阻塞 / 必须修复，并为每项阻塞关联具体代码和验证步骤。

## 验收条件
- 没有证据不足却声称“生产级”的标签。
- 保留可回滚提交点，不强推 main。
