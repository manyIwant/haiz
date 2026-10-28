# HAIZ · Mission 10 · v1.4 第一阶段独立 QA

**结论：FAIL。已复现 P0 私人任务静默丢失，不能批准发行。**

任务日期 2026-10-27。执行环境：macOS arm64，Node 24.22.1 / npm 11.19.1，Flutter 3.47.8 / Dart 3.13.7，.NET SDK 8.0.133。全部教师、学生、班级和凭据均为虚构测试数据，没有使用生产数据库、学校名册或腾讯连接。

## 验收对象

- [PR21 后端](https://github.com/manyIwant/haiz/pull/21)：`b308312a8f5d8387c66e319c642223b399440a3f`。
- [PR22 学生隔离](https://github.com/manyIwant/haiz/pull/22)：`b65c783ddd216193b39e44daec3a5841a6bb3813`。
- Academic基线：`663b51ddde896671602e74000747fa71d9e7fc41`；审计分支：`9b5cea198991c111e21aaeadf012cae1beb4f672`。四份审计已读，完整来源副本在 evidence/source-audit-*.md。
- 保留父提交的QA集成树：`a03da324386b17d305e6a3698adc21f2b4bcf905`；交付分支 `qa/haiz-v1.4-verification`。业务源文件没有由QA修改。
- 工作期间原 integration 分支出现教师工作台 merge `0d983d9`。保留该分支，从a03da32建立本交付分支，避免把额外业务改动纳入PR21/22认证。该教师树另行跑过112/112单元测试，但不属于本任务的浏览器或产品验收。

没有强制合并无共同祖先的main，没有修改原PR、发布Release或合并远程PR。

## 实际结果

| 检查 | 结果 | 证据与限制 |
|---|---|---|
| 后端原基线 | 51/51 PASS | 随完整suite复跑 |
| 后端加QA | 63/63 PASS，0 skip | [backend-current.log](evidence/backend-current.log)，行97.78%、分支88.30%、函数98.95% |
| Flutter原基线 | 67 PASS、4 live SKIP | [flutter-original-baseline.log](evidence/flutter-original-baseline.log) |
| Flutter全量加QA | 78 PASS、4 FAIL、5 live SKIP，exit1 | [flutter-coverage.log](evidence/flutter-coverage.log)，行1638/2140=76.54%，未达80% |
| Flutter analyze | 0 issues | [flutter-analyze.log](evidence/flutter-analyze.log) |
| 真实Flutter HTTP | 5/5 PASS，另行执行无skip | [live-isolated.log](evidence/live-isolated.log)，临时SQLite、真实HTTP、内存prefs |
| 后端/QQ npm audit | 0 known vulnerabilities | [backend-audit.json](evidence/backend-audit.json)、[QQ审计](evidence/platform/qq-audit.json)，不等于全面安全审计 |
| QQ | 原2/2 + 合成联调3/3 PASS | 无腾讯生产连接 |
| Android Release | 编译、元数据、v2签名检查 PASS | [Android记录](android-notes.md)，版本仍1.3.0-preview.1+4 |
| Android设备运行 | BLOCKED | 无设备、无可用AVD，镜像安装/下载未获得可用系统 |
| ClassIsland | .NET Release及.cipx检查 PASS | [平台记录](platform-notes.md)，无Windows宿主运行 |
| .NET依赖审计 | INCONCLUSIVE | TLS unexpected EOF，不能报告clean |
| GitHub Actions | workflow已提供；待远程运行 | 本地结果不冒充托管runner结果，已知Flutter回归应红 |

PASS仅对应列明的测试层，不可推导到设备、部署或完整产品。

## 三个关键问题

**学生教师数据是否安全？** 合成测试未复现跨账号、跨班、跨服务Cookie或游标泄漏。A/B/Guest namespace、迟到响应、确认弹窗和损坏文档保护的列明路径通过。但同账号迁移期间的新私人任务会丢失；真实Android存储、学校身份与HTTPS部署尚未验收，不能作无条件保证。

**教师修改是否同步？** 后端修订、撤回、幂等、冲突、游标及撤权通过。真实AcademicSession手动刷新可见官方标题/日期修订，撤回后官方列表移除，私人笔记保留。App仍使用 `/api/classes` 和 `/api/my/assignments`，未接入 `/api/v1/sync`、持久游标及page+cursor原子应用。个人副本保持旧标题/日期，撤回后无提示，不能认证完整增量同步。

**断网、切换账号、重启是否丢记录？** 合成异常证明部分已提交文档保留、损坏原字节不覆盖，B不接收A笔记。真实断电、磁盘满、Android进程kill/重启未测；同账号迁移编辑竞态已经证实静默丢任务，不能回答“不会丢”。

## 发行条件

03组须修复QA-STORAGE-01并让保留的失败回归变绿，补测其他个人字段的并发保存；修复非法日期和Study Relay生命周期；完成全量回归及80%覆盖要求。明确App增量同步及个人副本修订/撤回策略，取得Android、Windows及授权QQ/学校条件后完成目标环境验收。

详见 [矩阵](TEST-MATRIX.md)、[台账](BUG-REGISTER.md)、[集成](INTEGRATION-REPORT.md)、[发行就绪](RELEASE-READINESS.md)。QA未代替开发组修业务，未以skip、吞异常或降低断言隐藏失败。
