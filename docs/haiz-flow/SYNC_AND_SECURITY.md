# 同步与权限

接口前缀 /api/flow/：GET me、drafts、feed；POST drafts、publish、revoke。身份由随机Bearer凭据对应服务端角色，客户端不能通过选择role获取权限。loopback Host和Origin校验沿用原服务，无跨源CORS。

Draft：id/ownerId/scope/title/body/summary/startsAt/expiresAt/revision/updatedAt/updatedBy/sourceDevice/cursor/visibility。客户端另有pending/request，仅控制本机编辑同步。Notice独立id/draftId/ownerId/publicSummary(summary)/scope/有效期/revision/state/approval。AuditEvent记录actor/object/action/revision/time。User/Role/DeviceIdentity使用原有角色凭据；TeacherContext是服务端班级授权；Teacher CourseOccurrence/Task/MediaAsset完整生产模型尚未实现，仅示例课程和本机图片，不能称完整教务架构。

权限：teacher只能列出/修改自己的草稿、向自己班级发布撤回；student/display只能读取本班当前有效公开投影，不能读取正文/作者私有数据/审计。admin没有Flow私人草稿读取能力。公开白名单严格与草稿分离。

保存携带expectedRevision；冲突409附合法所有者远端快照。客户端可选保留本机/远端/手动合并（拼接后继续编辑），选择前两份快照保留在本机恢复历史。不会静默覆写。服务器重试幂等键和请求摘要保存在磁盘；同键不同内容409；写入失败回滚内存；文件临时写入后rename。单进程Demo，不支持多实例共享文件。

发布需当前版本、明确confirmed=true、与草稿一致的confirmedSummary。Demo授权教师自审本班公开摘要，approval记录此策略，未实现独立学校审核员。发布后先撤回再改，保证确认内容不悄然变化。撤回版本递增；feed只返回仍有效published，重连覆盖缓存。客户端每秒过滤到期，存储已观察到的最高时钟值防止时钟倒退让已过期内容再出现；异常未来时钟会保守隐藏内容，需管理员核对时间并清理公共缓存。

令牌只在当前sessionStorage；私人草稿按身份存在localStorage，退出清理。只适用于个人浏览器Demo：同源脚本/同一OS用户仍可访问，不是加密保险箱；公用设备只用display身份。不上传学生资料、录音或图片，不调用在线AI。私有图片仅当前页内存预览。本地服务磁盘文件权限0600，Windows权限依宿主策略，绝不公开部署当前文件服务。

边界：离线设备无法知道尚未接收的撤回，故在重新连接或既定到期前可能显示旧有效摘要；不声称撤回离线即时生效。当前单打开草稿自动重试，其他本机草稿手动恢复。生产需要HTTPS、SSO、租户隔离、凭据轮换/撤销、审计保留策略、存储配额和附件治理。
