# v1.4 QA 集成与复现报告

关联[主报告](QA-REPORT.md)。最终产品基线是 `a03da324386b17d305e6a3698adc21f2b4bcf905`，QA补充只含测试、脚本、CI和报告。

## 来源链

| 来源 | 完整提交 | 集成方式 |
|---|---|---|
| Academic preview | 663b51ddde896671602e74000747fa71d9e7fc41 | 共同基线 |
| 02 / PR21 | b308312a8f5d8387c66e319c642223b399440a3f | merge父提交保留，17ff764c36711ab20b35f89a54845dee1dfcc131 |
| 03 / PR22 | b65c783ddd216193b39e44daec3a5841a6bb3813 | merge父提交保留，a03da324386b17d305e6a3698adc21f2b4bcf905 |
| 审计输入 | 9b5cea198991c111e21aaeadf012cae1beb4f672 | 仅读四报告，未合入业务 |

PR21/22文件没有交集，集成未发生内容冲突。两个远程head在报告前再次核对不变。main与Academic没有共同祖先，未尝试强制合并。

原 `qa/haiz-v1.4-integration` 后来出现教师工作台提交f73852c及merge0d983d9。QA不重写/删除其历史，另从已验收a03da32建立 `qa/haiz-v1.4-verification` 作为交付分支。额外教师单元112/112日志保留作范围说明；未纳入本次产品认证。后端/app/integrations在该额外提交前后无业务差异，已有相关测试证据仍对应相同代码。

## 实际端到端链路

`node scripts/qa/run-live.mjs` 启动临时SQLite及随机loopback端口，关闭学校/QQ秘密，创建虚构admin/teacher/A/B和班级，以真实Dart http.Client运行原四条live及新增生命周期测试。两文件串行执行，防止新增撤权改变旧测试fixture。结束关闭数据库并清理临时目录。

验证：教师draft/review/publish→学生登录刷新→显式导入→私人笔记→教师修订标题/日期→学生刷新新官方version→重复导入不重复→已查看→撤回→官方列表及展示接口无该id→撤权清空官方scope→logout/B空/A恢复私人记录。5/5通过，[独立入口日志](evidence/live-isolated.log)。

这是实际Flutter会话类对后端的HTTP联调；SharedPreferences平台为内存fake，不是Android界面/硬盘E2E。展示撤回断言没有在同一Dart测试中先断言发布可见，发布至展示可见性由后端/platform独立测试提供。教师动作由真实HTTP调用执行，不声称点击过教师网页。

## 契约与实现差距

identity的instance/user/role/authorizedClassIds/cacheScope被客户端校验；客户端namespace额外绑定标准化HTTPS origin。A/B/跨实例及权限变化测试通过。

后端sync具备固定快照watermark、分页、delta、签名游标、permission epoch、撤回tombstone和重启续传。App `_refresh` 仍读legacy类列表及 `/api/my/assignments`，不调用sync、不持久cursor、不具备page+cursor原子应用。个人导入为本机副本：官方修改不覆盖私人笔记，也不更新副本标题/日期，撤回无提示。明确列为GAP，不能以5/5或后端模拟协调器认证完整同步。

QQ真实adapter与后端合成联调3/3、SDK事件shape离线验证；未启动Tencent。ClassIsland仍旧URL key接口，JSON字段兼容通过，不等于v1.4 bearer/cache/freshness或Windows渲染验收。

## QA 自动化与审查

新增四份Flutter QA测试、12条后端探针；原测试未删改。Flutter全量保留4项红色，后端63/63。CI拆分backend、flutter-regressions、real-http、qq-contract、ClassIsland编译、Android合成签名构建。没有continue-on-error或排除已知失败；不上传私钥/APK/DB。

专项ECC审查代理因provider403认证失败未产出；随后可用fork只读审查完成，未发现阻断性测试断言缺陷，指出终止信号与临时目录清理问题，已在QA脚本修正。该审查不代表产品全面安全审计。GitHub托管CI、Windows产包及Linux Android构建须以远程实际记录为准。

## 复现与隔离

- 后端：`npm --prefix services/academic ci --ignore-scripts` 后 `npm --prefix services/academic run test:coverage`。
- App：app目录 `flutter pub get`、`flutter analyze`、`flutter test --coverage --reporter expanded`。
- HTTP：根目录 `node scripts/qa/run-live.mjs`。
- QQ：`npm --prefix integrations/qq-bot ci --ignore-scripts`、`npm --prefix integrations/qq-bot test`；再运行平台probe（见platform-notes）。
- Android/ClassIsland：精确命令、环境、hash和受阻项见专项记录。编译、包检查、设备运行分开判断。

日志只含虚构数据和本机路径。没有正式Release、强制推送、main写入或原PR合并。QA Draft PR只供证据审阅，当前发行判定FAIL。
