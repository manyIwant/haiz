# HAIZ · Supabase Free 首次接入（2026-11-01）

## 已有实现与这次新建的项目

- Supabase 项目：`haiz-prod`，公开地址：`https://zifcxtjwzbjabcjpqhgp.supabase.co`。
- Flutter Auth 入口：`app/lib/core/pocket_auth.dart`。账号与云端同步逻辑、登录界面已经存在，不应重做灯光登录动画。
- **实际云同步使用 `public.pocket_snapshots`**：每个确认邮箱的用户一行，内含待办、课表、笔记、专注记录等 JSON 快照；并发写入通过 `version` 比较拒绝过期覆盖。
- 之前手动创建的 `public.tasks` 是另一张独立表。它不会自动与 Flutter 的 `PocketStore` 同步，也不应在不迁移数据的前提下删掉。

## 只需一次的 Supabase 数据库迁移（必须手动执行）

1. 在 [haiz-prod SQL Editor](https://supabase.com/dashboard/project/zifcxtjwzbjabcjpqhgp/sql/new) 打开新查询。
2. 打开仓库文件 [202610310001_pocket_snapshots.sql](../supabase/migrations/202610310001_pocket_snapshots.sql)，复制其**全部 SQL**，粘贴进控制台，点击 **Run**。
3. 在 SQL Editor 运行以下只读检查：

```sql
select to_regclass('public.tasks') as old_tasks,
       to_regclass('public.pocket_snapshots') as app_cloud_table;

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('tasks','pocket_snapshots')
order by tablename, policyname;
```

期望 `app_cloud_table` 返回 `pocket_snapshots`，并显示 `pocket_snapshots` 的 SELECT / INSERT / UPDATE 三条所有者策略。**这只能证明结构存在，不能代替两账号的越权测试。**

## 把公开密钥加到 GitHub 自动发布

在 [GitHub 仓库 Actions variables](https://github.com/manyIwant/haiz/settings/variables/actions) 添加 Repository variable：

| Name | Value |
| --- | --- |
| `HAIZ_SUPABASE_PUBLISHABLE_KEY` | 在 Supabase **Settings → API Keys** 复制 `default` 行以 `sb_publishable_` 开头的密钥 |

- `HAIZ_SUPABASE_URL` 可不填：仓库默认使用上面新建项目地址；未来换项目时可在 GitHub Actions variables 中覆写。
- 这是**可在浏览器使用的公开密钥**，仍要依赖数据库 RLS 安全策略；但不要上传 `sb_secret_`、`service_role`、Postgres 密码、签名证书或登录账号密码。
- 当前仅 `pocket-autopublish.yml` 会给 **`/pocket/` 网页版**注入以上变量。Android APK、iOS IPA 的原生发布流程需要在**各自构建命令**中注入同样的公开密钥，不能因此声称 APK/IPA 已启用云端登录。

## 发布与验收门槛

- 完成 SQL 迁移且设置公开变量后，运行 [HAIZ Pocket Auto Publish PWA](https://github.com/manyIwant/haiz/actions/workflows/pocket-autopublish.yml)（main 上）；它会测试、打包并只更新 `/pocket/`，不会改主站页面。
- 在 `https://haiz.space/pocket/` 尝试使用**已手动创建、邮箱已确认**的测试账号登录。登录后添加待办、刷新页面，再检查两台设备的账号数据；浏览器刷新会失去登录态，这是当前客户端刻意采取的 Web 临时会话行为，需重新登录才能再次加载云端数据。
- 用第二个测试账号尝试读取第一个账号的任务，确认只能看到自己的内容。检查断网、冲突提交、退出登录的数据清空。不要把 RLS 代码存在就当作数据库已验证。
- 邮件注册、密码找回的**公开上线**需要可用的外部 SMTP 服务。默认 Supabase 邮件仅供有限的测试使用，不要承诺能向所有学生发送验证码。
- 这些操作不会自动迁移旧版设备的游客任务到云端；若要迁移，必须设计显式的用户确认与备份/合并流程，严禁静默覆盖。
