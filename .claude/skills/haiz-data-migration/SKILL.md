---
name: haiz-data-migration
description: "Use when migrating HAIZ guest/account snapshots, JSON schemas, backups and persistence stores while preserving compatibility and reversibility."
---

# haiz-data-migration

## 何时使用
任何替换 SharedPreferences / 快照模型之前，先验证双向恢复路径。

## 实施流程
1. 描述旧序列化模式 `PersonalSnapshot`、现有命名空间和备份文件签名；写迁移测试夹具（含空、损坏、重复、超大、旧版本）。
2. 采用 additive schema、显式版本号和逐步启用；不要直接删除旧键或覆盖原始记录。
3. 先备份→迁移到新位置→校验条数与稳定 ID→切换读取→保留只读旧版本作为回退窗口。
4. 对访客与 Supabase 账号分别制定策略，不能借“迁移”把访客资料自动归属给任意账号。
5. 故障注入：磁盘写入失败、更新一半崩溃、下载中断、重复导入、混合账号会话。
6. 任何不可逆步骤必须明确列出且等待授权；生成 `MIGRATION.md` / `ROLLBACK.md`。

## 验收条件
- 成功迁移后任务/课表/专注记录的 ID、完成状态和备注无丢失。
- 重复运行迁移安全幂等。
- 旧版或回退方案有可靠数据恢复路径。

## 相关文件和参考
- `app/lib/core/personal_snapshot.dart`
- `app/lib/core/personal_backup.dart`
- `app/lib/core/storage_scope.dart`
