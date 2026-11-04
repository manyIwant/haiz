---
name: haiz-ci-docs
description: "Use when maintaining HAIZ build workflows, release notes, artifact provenance, version documentation and non-misleading production readiness reports."
---

# haiz-ci-docs

## 何时使用
防止生产状态被旧 README 和表面 CI 绿灯误导。

## 实施流程
1. 对照 `pubspec.yaml`、GitHub Releases、`updates/latest.json`、PWA build metadata 和安装页，不一致必须修正或标注。
2. CI 分层：lint/test/build/golden/integration/device-required/backend-required，不允许“报告上传成功”当成设备验收通过。
3. 构建产物记录源 commit、Flutter 版本、依赖锁、包签名/版本、测试清单与剩余风险。
4. 审查 PR 每个阶段的脚本执行路径与发布触发条件；开发分支不能未经允许部署生产。
5. 文档说明功能的真实边界：是否需要授权后端、仅本机还是多设备、平台限制。
6. 每轮发布生成简洁 changelog 与升级/回滚步骤。

## 验收条件
- 页面、文档与发行版版本能互相核对。
- 环境不足的验收有明确阻塞条件。
- 产物来源可追溯且不会混入旧版本。

## 相关文件和参考
- `.github/workflows`
- `scripts/pocket-production-readiness.mjs`
- `app/pubspec.yaml`
