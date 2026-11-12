# HAIZ Sense V1 · 智能待办（开发分支）

适用：Flutter Pocket / 今天页。**尚不等于正式发布**。本地整理即装即用；云端小模型为可选增强，部署前不会对任何用户自动发出模型请求。

## 用户体验

1. 在「想到什么，随手记下来…」输入文字。原有右侧向上箭头仍然是**立即保存一条速记**。
2. 点击「智能整理 · 先预览再创建」，出现离线初步拆分建议，原任务未发生变化。
3. 可逐条取消勾选、修改名称、科目、截止日期；未明确为截止的「今晚复习」不会自动设置期限。
4. 点击「确认创建 N 项任务」才用 PocketStore 一次提交到当前用户快照。
5. 在登录 Cloud 账号时可主动打开「云端 AI 增强」，再点「重新整理」。仅这次输入文本、当日日期和 UTC 时区偏移传往 Edge Function；不发送任务历史。

按钮只在输入非空、Store 已就绪时启用。取消弹窗不写入。账号切换令旧草稿失效，同一批任务稳定 ID 防止重复添加。多项提交采用 PocketStore 单次内存更新及一次快照持久化；**这不是 Supabase public.tasks 表的原子 INSERT**。实际云端快照写入仍可能因网络失败或版本冲突失败，界面会显示存储异常，不能误称已同步。

## 文件

- `app/lib/domain/task_sense_engine.dart`：离线拆分、时间与科目建议，远端原文证据校验
- `app/lib/ui/task_sense_sheet.dart`：可编辑确认弹窗、可选云端增强、重复检测
- `app/lib/ui/today_page.dart`：新增入口，保留普通速记入口
- `app/lib/core/pocket_store.dart`：批量提交、账号 generation 与重复 ID 防护
- `supabase/functions/tasks-analyze/index.ts`：需登录且限流的可选小模型调用
- `supabase/migrations/202611010001_sense_rate_limits.sql`：每用户每小时 30 次的服务端原子计数

## Cloud AI 启用（需项目所有者在 Supabase 环境操作）

未执行以下步骤之前，云端请求会失败并自动退回本地分析；**这不影响待办使用**。

1. 在对应项目的 SQL Editor 审核并运行 `supabase/migrations/202611010001_sense_rate_limits.sql`。这是新增限流表与受控 RPC，不修改现有 `pocket_snapshots`、`tasks` 表。
2. 在 Supabase Edge Functions Secrets 中配置 `HAIZ_AI_BASE_URL`（可信 OpenAI 兼容 API 的 HTTPS v1 根路径）、`HAIZ_AI_MODEL`、`HAIZ_AI_API_KEY`（**仅保存在 Supabase 服务端**）。不要把密钥发在聊天中或提交 GitHub。内置 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 按平台供应的环境变量使用。
3. 通过已登录的 Supabase CLI 部署：
   `supabase functions deploy tasks-analyze --project-ref zifcxtjwzbjabcjpqhgp`
   必须保持 JWT 验证开启，不要传 `--no-verify-jwt`。
4. 使用真实已认证账号执行一条模拟任务，检查 HTTP 200 与结构化 suggestions，再验证用户小时限额、不同用户隔离、被拒绝的无效证据、远端失败时的本地回退。

## 隐私与边界

- 本地离线整理不传输输入内容；云端增强默认**关闭**。
- 通过已经登录的 Supabase 用户 JWT 调用限流 RPC；不支持游客云端 AI。
- 服务端不得记录原文、提示词或模型返回正文，必须阻止未经授权的来源。
- 本地/远端都只生成候选建议，不能自行写入数据库、改优先级或创建班级共享任务。
- 模型必须提供对应的精确原文证据；客户端再次校验。日期由客户端确定性解析，模糊表达不猜测。
- 如果使用第三方模型，项目所有者仍须确认提供商的数据处理条款与校园隐私许可；不要在输入里放入私人敏感信息。

## 验收与发布

在项目 `app/` 下运行：

```bash
flutter pub get
flutter analyze
flutter test
flutter build web --release
```

PR 合并前应通过 GitHub Actions 的 Flutter、Android/iOS 编译及既有身份隔离测试。**不要因为合并代码就宣称原生 APK/IPA 已发布，也不要因为存在 Edge 代码就宣称云端 AI 已上线。** 主站、/pocket/、原生版本和 Supabase 函数部署是独立发布流程。
