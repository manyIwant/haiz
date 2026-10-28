# v1.4 独立缺陷台账

总判定 **FAIL**。只把复现行为列为确定缺陷；缺设备、未接入功能与静态风险单独记录。关联[主报告](QA-REPORT.md)。

## QA-STORAGE-01 · P0 · 03组 · OPEN

**同账号旧档迁移与新编辑交错，静默丢失新私人任务。** PR22 `b65c783`，集成树 `a03da32`。确定性测试：`app/test/qa_storage_fault_test.dart` 的 QA-STORAGE-01；[独立复跑](evidence/flutter-faults-independent.log)。

前置：虚构旧任务归档、A账号及一条迁移前私人任务。步骤：

1. 启动 `importLegacyArchive(ownerConfirmed: true)`。
2. 用Completer阻塞第一次 `setString(LegacyArchive.ownerKey, ...)`，此时合并快照已构造。
3. 同账号新增私人任务，放行owner写，等待import和flush。
4. 再执行普通 `setAppearance('ocean')` 并flush，模拟后续任何常规保存。

期望：内存及持久文档均有迁移前任务、旧任务、新任务，迁移标记一致。实际：步骤3内存只有迁移前+旧任务，disk只有新任务+迁移前；步骤4disk变成迁移前+旧任务，新任务从内存及目的文档消失，`storageError=null`。原legacy备份从未包含新任务，不能恢复。

原因锚点：`pocket_store.dart:142` 提前捕获普通完整快照；`:191-192` 合并后await claim；`:201-204` 应用过时merged。队列只序列化I/O，没有序列化普通编辑与迁移state应用。建议03组串行化或在迁移提交窗口排队编辑，并验证所有个人字段；QA未修改业务修复。按任务书“不可恢复的数据丢失”定P0。未将其他未复现字段丢失夸大为事实。

复现：在app目录 `flutter test --no-pub test/qa_storage_fault_test.dart`，当前exit1（两项失败）。

## QA-STORAGE-02 · P2 · 03组 · OPEN

旧档 `dueIso=2026-02-31` 被接收。`personal_snapshot.dart:50-57` 只用格式与DateTime.tryParse，Dart会规范化越界日。QA-STORAGE-02期望在claim前拒绝，实际import成功，原字节仍保留。建议严格比较年月日或严格日期解析。证据同storage日志。未证实跨账号泄漏或清空源字节。

## QA-UI-01/02 · P2 · 03组 · OPEN / inherited

Study Relay保存后 `TextEditingController was used after being disposed`，widget overlay继续产生框架断言。`focus_page.dart` 在await showDialog后立即dispose controller，退出动画仍引用。普通保存的最小回归是 `qa_study_relay_test.dart`；切账号保存是 `qa_probe_test.dart` QA-UI-01。[最小失败日志](evidence/study-relay-failure.log)。

期望：保存退出无框架异常，切号时拒绝写入并提示。实际：框架异常，切号提示断言也失败。B的tasks/notes未见泄漏，不将此报成账号泄漏。v1.3已有相同dispose模式，不是PR22新引入；尚未在release真机证明崩溃。没有吞异常或skip。

## PLATFORM-06 · P3 · 05组 · OPEN

QQ `relayMention` 的HTTP loopback列表比较 `::1`，Node URL.hostname返回 `[::1]`，导致IPv6本地地址被HTTPS校验拒绝。[合成证据](evidence/platform/qq-edge-cases.log)。IPv4/localhost路径可用；不是生产数据泄漏。

## 功能/验收缺口（不混为已复现漏洞）

| ID | 负责人 | 实际边界 | 关闭条件 |
|---|---|---|---|
| GAP-SYNC | 03/总指挥 | App未接/api/v1/sync和持久cursor；个人副本旧值/无撤回提示 | 明确一期策略并完成真实App修订/撤回/断网恢复验收 |
| GAP-CLASSROOM | 06 | 插件仍旧key URL/polling，无version/cache/freshness；迟到旧班响应只是静态风险 | 实现约定并在Windows宿主复现/验证 |
| GAP-QQ-RECOVERY | 05 | 无持久重试队列；真实腾讯消息丢失未复现 | 授权连接、掉线/重投/恢复测试及明确交付语义 |
| GAP-ANDROID | QA/设备提供方 | 编译成功，无运行设备 | 真机/模拟器安装至重启恢复全流程 |
| GAP-WINDOWS | QA/设备提供方 | .NET成功不等于宿主安装 | Windows ClassIsland导入、渲染、性能与生命周期 |
| GAP-COVERAGE | 03/QA | Flutter行76.54%，整体4fail | 修复且覆盖要求达标；不写镜像实现的空测试 |
| GAP-VERSION | 发布工程 | APK仍1.3.0-preview.1+4 | 正式候选版本策略与构建来源记录 |

平台自由文本内容审核、配置文件权限及代理路径日志属于部署控制边界；本次没有确认相关泄漏。详情见[平台记录](platform-notes.md)。
