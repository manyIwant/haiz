# HAIZ Pocket 账号认证、安全会话与用户数据隔离

## 状态及安全边界
这是**真实后端接入代码**，不是本地密码比较。需要为 HAIZ 配置并部署自己的 Supabase 项目、执行数据库迁移后，账号登录才可用。**静态 GitHub Pages 不能自己验证密码或建立可靠的服务端会话。**

该实现只修改 Flutter Pocket：它不让网站预览里的 \`demo@haiz.test\` 变成真实账号，也不会自动把访客或现有教务账号中的数据认作新用户的数据。

## 部署步骤

1. 创建独立 Supabase 项目，开启 Auth 邮箱密码登录、邮箱验证；设置正常的重定向网址、可信域名和邮件发送配置。公开注册是否启用由部署者决定。若用于真实学生，请先配置数据处理与隐私政策。
2. 在 Supabase SQL Editor 或 migrations 运行 \`supabase/migrations/202610310001_pocket_snapshots.sql\`。必须确认 RLS 已启用，且 anon 不能读/写，账号 A 不可读取/更新 B 的行。**迁移未应用时，不要开放云端账号登录。**
3. **仅使用 publishable/anon key（不是 service_role、secret API key）**：
   \`\`\`sh
   flutter run --dart-define=HAIZ_SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
     --dart-define=HAIZ_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
   \`\`\`
4. GitHub Actions 可以设置 \`HAIZ_SUPABASE_URL\` 和 \`HAIZ_SUPABASE_PUBLISHABLE_KEY\` 仓库 Secrets 或 Variables，并把它们传入 Flutter 构建参数。没有配置时，App 保留访客模式，账号按钮提示不可用；**不会提供虚假账号验证**。
5. 发布前必须在真实服务端使用两个测试账户 A/B 检查权限：A 登入后创建记录；B 绝不能看到或修改 A 的记录；退出并重新启动 App 后 A 可以安全恢复且读取自己的记录；撤销 A 的刷新令牌后应在联网校验时锁定账号数据；断网时新会话不会未经验证自动解锁。

## 交互与数据语义

- Supabase Auth 在服务端核验邮箱/密码。冷启动通过 \`auth.getUser()\` 远程确认会话，受 SDK 管理的刷新令牌保存到 Android Keystore / Apple Keychain，应用只持有 public key。Web 端会话不持久化，刷新后必须重新登录。
- 账号个人记录仅存在于 \`public.pocket_snapshots\` 中，以 \`user_id=auth.uid()\` 使用 RLS 校验；PocketStore 仅在网络认证后打开对应内存命名空间，账号记录**不写入 SharedPreferences**。游客记录继续设备本机保存。
- 数据写入按本机排队串行、携带版本号；另一台设备写入新版本后，当前设备的过时保存将停止而不是静默覆盖。
- 账号退出、会话撤销或身份变化时立即清空当前内存数据；没有成功认证时无法打开账号命名空间。
- 原 AcademicSession 教务账号仍保持独立，只能在退出 Pocket 账号后操作，避免其旧账号 API 切换存储 namespace。
- 不自动迁移访客数据。跨用户共享设备的访客空间仍是**共享访客数据**，不应在里面存放敏感个人资料。系统通知/分享原始队列也是设备级别：新的云账号默认不显示它，以防跨账户泄露。

## 尚需完成的运营与产品要求

- 当前没有可复用的生产 Supabase 项目或管理员凭据，迁移文件尚未在真实数据库上应用；因此仓库 CI 只能验证本地逻辑和构建，**不能声称线上认证已启用**。
- 账号数据采用服务器在线优先：断网时已登录账号不解锁个人记录，也不自动创建离线草稿；访客仍可离线操作。
- 尚未开发 Web 网站 \`/login/\` 与 Supabase 的直接集成；该页面此前的密码输入不可用于实际认证。Flutter App 账号登录必须经原生 \`PocketAccountSheet\`，不要经 WebView 传密码。
- 真实用户上线前，还需部署账号生命周期、个人数据导出/删除、滥用防护、邮件可达性、泄露预案及备份恢复流程。发布合规与监护人/学校授权事项由运营方落实。
