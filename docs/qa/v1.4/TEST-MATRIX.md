# v1.4 独立测试矩阵

状态：PASS=列明证据通过；FAIL=实际失败；GAP=实现缺口；BLOCKED=缺目标运行条件；NOT VERIFIED=未执行。总判定见[QA主报告](QA-REPORT.md)。合成存储不等于真机磁盘。

| 范围/场景 | 状态 | 实际测试层、证据或限制 |
|---|---|---|
| PR head与祖先 | PASS | 两远程head重复核对；集成父提交保留，见INTEGRATION-REPORT |
| 后端旧接口、v1契约 | PASS | 63/63，backend-current.log；包含原51 |
| Guest未登录身份/同步/资源 | PASS | qa-probe.test.mjs，401且data=null |
| A/B跨班与待核准成员 | PASS | security/v1/QA HTTP，不含他班资源，直接读拒绝 |
| 过期会话、角色、展示凭据边界 | PASS | security/QA，合法资源版本确认仍被拒绝 |
| 同名账号跨实例/服务 | PASS | 两独立fixture、真实cookie双向重放401、游标400 |
| namespace origin/instance/user | PASS | student_isolation_test及真实HTTP客户端 |
| A/B/Guest任务、笔记、课程、专注隔离 | PASS | 原隔离suite+qa_probe_test；内存prefs |
| 登录迟到响应/切服/身份变化 | PASS | academic_session_test，generation守卫，重新验证身份 |
| 新任务/Inbox/旧档确认跨账号 | PASS | account_switch_ui_test；用户确认时重新核身份 |
| Study Relay普通保存/跨账号保存 | FAIL | QA-UI-01/02：controller disposed框架异常；无B笔记泄漏证据 |
| legacy原键备份、显式归属、重复ID | PASS | student_isolation_test+QA-RECOVER-05；源字节保留 |
| migration同账号并发编辑 | FAIL P0 | QA-STORAGE-01；claim等待窗口编辑，普通后续保存清除新任务 |
| migration不存在日历日期 | FAIL P2 | QA-STORAGE-02，2026-02-31被接收 |
| claim后目的写失败、同owner重试 | PASS | QA-STORAGE-05，原字节与owner保留，可重试 |
| claim期间切B | PASS | QA-STORAGE-04，B保持空，无跨账号归档 |
| 损坏个人JSON/写失败 | PASS | QA-RECOVER-01/02，报错、最后commit和坏字节保留；synthetic |
| 真磁盘满/损坏、OS kill/断电/Android重启 | NOT VERIFIED | fake异常不证明文件系统原子性/设备恢复 |
| 后端增量迁移/校验/事务回滚 | PASS | 原storage suite；checksum、FK、SQL故障、锁503及重试 |
| 后端revision/event/idempotency原子性 | PASS | storage/v1 suite，无部分事务写入 |
| 发布draft→review→publish | PASS | 后端与真实Flutter HTTP lifecycle；未发布不对学生公开 |
| 修改标题/日期/版本 | PASS | 后端与QA-LIVE-01，手动refresh读取新官方值 |
| 撤回、公开展示过滤 | PASS | 后端delta tombstone、旧列表移除、classroom不含撤回 |
| 幂等重放/载荷冲突 | PASS | 后端suite，当前权限先于receipt重放 |
| 同教师两个HTTP会话冲突 | PASS | 一次成功、旧expectedVersion409；不是两台真机 |
| 游标签名/账号/实例/权限epoch | PASS | backend-current.log；撤权再恢复旧游标仍拒绝 |
| App已查看版本与重导入去重 | PASS | QA-LIVE-01，真实HTTP，私人笔记保留 |
| App断网delta重放/page+cursor原子持久化 | GAP | App没有调用/api/v1/sync，不能用后端模拟客户端替代 |
| 个人副本更新/撤回提示 | GAP | 实测旧title保留、无撤回提示；私人笔记仍在 |
| 今日任务增删/完成/笔记/课程存储 | PASS | personal_store_operations、widget和QA-FLOW；合成store |
| 当前课表排序/日界线/专注按日 | PASS | widget_test、personal_store_operations |
| 专注删除目标/立即停止/A与B统计 | PASS | QA-FLOW-02/03、QA-RECOVER-04 |
| Command键盘全流程/真实导航压力 | NOT VERIFIED | dock五tab smoke不等于完整Command或压力测试 |
| 三主题/五dock tab | PASS | widget_test，widget层；非设备截图验收 |
| Inbox中文候选、歧义日期/重复/确认 | PASS | haiz_v1_test、ui_smoke、account_switch_ui |
| DOCX段落提取/ICS日期导出 | PASS | import_calendar_test，合成archive与文本断言 |
| Android文件picker/PDF/OCR真实图片 | BLOCKED | APK含模型但无设备识别、权限或文件路径运行 |
| 纸带物理模型/移动UI | PASS | haiz_v1_test数学断言+ui_smoke；非真实交互性能 |
| Flutter analyze | PASS | 0issues |
| Flutter整体回归/覆盖率 | FAIL | 78pass/4fail/5skip，76.54%行覆盖；live另5pass |
| Android原Release/合成签名构建 | PASS | 构建和签名层；版本仍旧preview |
| Android安装、启动、权限、切号、断网、重启 | BLOCKED | adb为空、无AVD，不能声称设备通过 |
| QQ SDK事件形状/签名relay/待审/来源去重 | PASS | 原2+合成3，platform evidence；不启动腾讯连接 |
| QQ授权、真实消息/掉线重连/可靠补发 | BLOCKED | 无真实腾讯凭据/授权；无durable retry是静态实现限制 |
| ClassIsland Release/cipx内容及校验 | PASS | .NET0warning0error；CRC/manifest/MD5一致 |
| Windows导入/渲染/切班/撤权/CPU内存 | BLOCKED | macOS无授权Windows宿主；编译不能替代 |
| HTTPS代理cookie/日志/学校IdP/名册撤权 | NOT VERIFIED | 无生产配置或真实学校授权测试 |
| 依赖/敏感文件 | PARTIAL | npm0known；.NETaudit TLS失败；只提交合成数据与文本证据 |

## 重复执行

在仓库根目录执行（先安装锁定依赖和Flutter SDK）：

```bash
npm --prefix services/academic run test:coverage
```

```bash
flutter test --coverage --reporter expanded
```

Flutter命令在app目录执行，预期保留4项失败，不能通过排除qa文件使其变绿。

```bash
node scripts/qa/run-live.mjs
```

该入口建立临时独立服务、播种合成账号、串行执行两份live文件并清理；预期5/5。CI定义在 `.github/workflows/qa-v1.4.yml`；远程runner结果以实际运行记录为准。
