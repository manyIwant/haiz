# v1.4 Release readiness

**Decision: FAIL — DO NOT RELEASE.** 本报告不授权合并PR21/22或发布正式Release。依据[主QA报告](QA-REPORT.md)及[缺陷台账](BUG-REGISTER.md)。

| 发布门 | 结果 | 理由 |
|---|---|---|
| 不丢私人记录 | FAIL / P0 | 同账号migration+edit静默丢失新任务 |
| 后端权限/版本/事务/契约 | PASS，限定测试层 | 63/63与97.78%行覆盖；不是生产安全保证 |
| App隔离及恢复 | FAIL / PARTIAL | 多数隔离通过；P0迁移、2条StudyRelay失败及非法日期 |
| 测试与覆盖 | FAIL | Flutter78pass/4fail/5skip，76.54%行覆盖低于80%；live另5pass |
| 完整作业增量同步 | GAP | App未接sync/cursor；副本修订/撤回协调缺失 |
| Android运行候选 | BLOCKED | Release成功但无设备/AVD；旧版本元数据 |
| ClassIsland Windows宿主 | BLOCKED | .NET/cipx成功，无安装渲染/性能实测 |
| QQ/学校授权 | BLOCKED | 合成链路通过，真实授权和恢复未测 |
| 依赖安全 | PARTIAL | npm0known；.NET audit TLS失败 |
| HTTPS/备份恢复/实际故障 | NOT VERIFIED | 未做生产代理、真磁盘满/断电/kill恢复或学校身份 |
| 托管CI | PENDING | workflow提供，结果以实际运行记录为准；已知回归不豁免 |

FAIL由确定P0驱动，不因缺设备降为单纯BLOCKED，也不因部分测试通过改为CONDITIONAL PASS。

## 放行前必须获得的证据

1. 03组修复QA-STORAGE-01，确定性回归变绿；任务、笔记、课程、focus及标记在迁移期间编辑后内存/磁盘一致，重启仍全在，所有原始字节有恢复路径。
2. 非法日期与StudyRelay生命周期修复，全量无框架异常、不吞错误；覆盖率达到约定80%，所有原测试仍保留。
3. 03/总指挥确认一期同步范围。若要求完整增量同步，须真实App验证page+cursor原子保存、断网重放、重复/乱序、撤回、撤权与私有字段保留；后端suite不能替代。
4. 可用Android真机或模拟器：安装、冷启动、权限拒绝/OCR/文件导入、登录切号、离线重连、进程kill/设备重启、存储失败/恢复及UI压力；记录设备、系统、APK hash、实际结果。
5. 授权Windows/ClassIsland宿主：导入/依赖加载、中文与DPI、切班/撤权/旧响应、离线/重连、生命周期、CPU内存和隐私检查。Unix .NET编译不抵扣此项。
6. QQ和学校授权环境完成真实收发、人工审查、去重、掉线恢复及权限撤销；部署HTTPS、日志脱敏、备份/恢复演练、隐私与事故流程验收。
7. 更新候选版本与构建来源记录，检查远程CI实际结果；由总指挥审阅后另行批准合并/发行。

## 发布材料边界

保留APK/cipx的文本hash和检验日志；不提交APK、私钥、签名properties、SQLite、.env或真实名单。CI只用虚构数据和短期合成证书，不生成正式Release。当前QA交付是Draft evidence PR，允许开发组按失败用例修复后复验。
