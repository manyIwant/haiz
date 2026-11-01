# 继承与迁移

UI V1仅内存state → Flow明确本机持久化与服务端版本；teacher手机展板 → 全宽DESK加独立移动排布；compose示意 → 正文/摘要分离+预览确认+真实HTTP；club伪报名 → 明确示例活动+可保存作品。

新增world/flow/入口，不修改原主站365个文件，不删除旧world数据键，不迁移原思维记录。旧版本仍通过原路由工作；新增“DESK接力”入口进入Flow。Flow使用独立haiz.flow.*键，不能自动导入旧教师演示账号或把旧本机草稿声明为已同步。

回退：使用上一开发分支/版本即可，原有数据不受新键影响。Flow服务的flow-state.json应先备份再处理；不要提交真实数据和local-demo-keys.json。已发布0.4.0-preview.2不被替换。
