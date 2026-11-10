# HAIZ 数据安全与可维护性扩展

用户已授权自主选定并实施后端功能；沿用 Node 24 + SQLite 单实例架构与现有深蓝暖光 /login/，不另造认证体系。当前工作区为已有无 .git 的源码副本；后续通过 GitHub API 对 main 作带预期 SHA 的增量发布，保留远端其他产品。

## 设计选择

优先补齐用户自己的数据恢复、查询和记录，以及服务器备份。继续使用独立 SQLite Worker 与事务；不为这批功能引入 Redis、外部搜索或邮件服务。所有接口沿用身份前置条件与 worker 会话复核，管理员也不能通过个人接口读取别人正文。

### 数据层（schema 3）

- 新表 personal_versions 保存每次修改前的状态，字段 owner,collection,id,revision,deleted,data,updated_at,stored_at；PK 前四项；随账号注销删除。
- 历史最多每条20个、每用户2000个、30天。以 stored_at 表示归档时间；旧内容在删除时才归档，因此长期未修改的记录被删后也能恢复30天。历史到期清除正文，原个人墓碑仍保留防止旧设备覆盖。
- GET /api/v1/data/:collection/:id/history -> {items:[普通item对象，按revision倒序，包含当前版本],retention:{days:30,perItem:20,perUser:2000}}；只列尚保留的历史。
- POST /api/v1/data/:collection/:id/restore {expectedRevision,revision?} -> {item}。revision 指历史中的未删除版本；省略时仅用于恢复回收站，选最新未删除历史。恢复为新版本而非回退版本号；版本冲突409返回remote；找不到历史404，不越权。
- GET /api/v1/trash/:collection?limit=100&cursor=... -> {items,nextCursor}；仅已删除且有可恢复历史的项，data 是可恢复正文，revision 是当前墓碑版本，updatedAt 是删除时间。
- GET /api/v1/search?q=...&collection=...&limit=100&cursor=... -> {items:[{collection,...item}],nextCursor}；按 collection,id 排序，cursor 用 collection:id；默认全部三集合，搜索当前未删JSON文本的字面子串，q 1..100字符，limit1..200。不把SQL通配符当搜索语法。
- GET /api/v1/usage -> {collections:{notes:{active,deleted,bytes},bookmarks:...,preferences:...},totals:{active,deleted,bytes,historyBytes,historyVersions},limits:{items:5000,itemBytes:16000,historyPerItem:20,historyPerUser:2000,historyDays:30}}。
- GET /api/v1/activity?limit=50&cursor=... -> {events:[{id,action,target,revision,at}],nextCursor}；本人的 audit，sequence 倒序数字游标；不含正文、密码、token、IP等。补登录、退出/退出全部/撤销本人会话、个人创建/修改/删除/恢复审计；写入和审计同一事务。

### 自动备份

backend/maintenance.mjs 导出 createBackupScheduler({database,directory,intervalMs=86400000,keep=7,logger})，返回 {start(),stop(),status}。start 不阻塞监听；stop 停止定时并等待进行中的备份。备份位于私有数据目录/backups，目录0700、文件0600；只清理自身命名的、已完成的备份，保留最新7个。使用现有 worker backup；先写临时文件，独立 SQLite Worker 做 quick_check，再原子改名，成功后轮换。失败保留已有备份，清理自身临时文件，日志不含凭据/路径/错误堆栈。启动时按最新已完成备份时间判断是否到期，无可用备份即创建；失败后至少1分钟重试，定时器 unref。管理员 metrics 增加 backup {enabled,running,lastSuccessAt,lastFailureAt,retained}，不暴露文件路径。生产默认每日，开发默认关闭；环境 HAIZ_BACKUP_INTERVAL_HOURS=0 关闭或1..168小时。同磁盘备份不能替代异地备份，明确记录。

## 分工与验证

1. repository.mjs 与独立 recovery.test.mjs/database.test.mjs：先写数据恢复、边界、跨用户/管理员、升级与旧数据保留的失败测试，再实现。禁止修改 server/client/UI。
2. maintenance.mjs 与维护测试：先测试真实SQLite备份可恢复、轮换、失败不删旧文件、停止等待等，再实现。不改server/repository。
3. server.mjs/client.mjs 与独立 data-safety-http.test.mjs：接上述接口、自动备份生命周期和配置，使用真实HTTP验证未登录/身份切换/CSRF/版本冲突及SDK；不修改repository/UI/maintenance。
4. src/account/app.js/style.css：沿用当前界面样式，加入搜索、回收站/历史恢复、用量与操作记录入口。恢复前明确按钮说明、保留冲突提示、请求响应用epoch拦截；不动灯光页。导出仍导出当前有效数据。
5. 全量 npm test、build、test:sites；浏览器实际操作保存/修改/搜索/删除/恢复；独立安全审查后发布 main 并检查远端CI。

## Review focus

历史保留上限与30天淘汰；delete之后的原正文；恢复并发冲突；注销清除历史；搜索字面匹配与分页/非法游标；活动不能看到他人；备份中断不破坏旧文件、不可跟随恶意软链接；关闭时避免worker先关闭；本地/远端布局不同。公网Node服务器仍未部署，main发布不等于生产上线。
