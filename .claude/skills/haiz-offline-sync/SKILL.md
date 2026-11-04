---
name: haiz-offline-sync
description: "Use when making signed-in HAIZ tasks and schedules safely usable offline with durable local writes, explicit pending status and conflict-safe synchronization."
---

# haiz-offline-sync

## 何时使用
解决已登录账号断网不可编辑，以及整份云快照 CAS 冲突后只有错误提示的问题。

## 实施流程
1. 先定义离线信任边界：本机缓存加密/隔离、登录验权、撤销/登出后的锁定行为、设备共享风险；不得把账号数据简单写入公用 SharedPreferences。
2. 定义实体稳定 ID、revision、操作类型、客户端操作 idempotency key、已确认服务器版本和“本机待提交”日志。
3. 将本机**持久写入**与云端**同步确认**分开反馈：local-saved、queued、syncing、synced、conflict、blocked。
4. 引入明确同步协议与冲突策略：任务完成等可处理的字段级合并；有不可自动合并差异时展示比较和手动选择。
5. 解决操作重放、重复上传、设备 A/B 并发新增、删除与恢复、失效 session、网络不稳定、数据库拒绝和存储空间不足。
6. 在真实 Supabase 测试账号 A/B 进行隔离与设备交叉验证；保证安全不因便利性降低。

## 验收条件
- 旧设备不会静默覆盖新设备已提交数据。
- 用户可理解何时本机安全、何时云端已确认。
- 重启和重试后的队列能恢复，冲突有可见解决路径。

## 相关文件和参考
- `app/lib/core/pocket_auth.dart`
- `app/lib/core/pocket_store.dart`
- `supabase/migrations/202610310001_pocket_snapshots.sql`
