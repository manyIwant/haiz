# 权限与演示数据边界

## 当前实现

数据键 `haiz.world.demo.v1` 仅存于 localStorage，全部模拟资源 `demo:true`。页面不调用远程业务 API，不请求麦克风或地理位置，不上传便笺/作品，不接入 AI。唯一外部导航是用户主动打开原资料链接。站点托管层的私有访问与模拟角色完全分开。

角色切换只为演示，不是登录或鉴权。`core.js` 状态机约束合法流程，但用户能修改浏览器存储和代码，因此它**不是安全边界**。不可存放真实校内数据。

| 动作 | 演示角色 | 前置条件 |
| --- | --- | --- |
| 保存私有作品 | student | 标题、正文、活动来源记录、已完成确认 |
| 提交作品 | student | draft / returned / withdrawn，活动已完成 |
| 审核作品 | teacher | submitted，完成记录存在 |
| 同意公开 | student | teacher_approved，逐件勾选 |
| 展示展签 | moderator | public_requested + consent + completed + teacherApproved |
| 撤回 | student | 非 draft/withdrawn，清除公开授权与审核标志 |
| 下架 | moderator | published |
| 删除 | student | 本机作品与展签同时删除 |

数字展签只由 `canDisplay()` 过滤已通过全部条件的 Demo。撤回与删除同步移除展示。举报进入本机日志；没有虚构地向学校发送举报。

计时器保存截止时间，恢复时以 Date.now 重新计算；这不是操作系统级通知。便笺输入与所有用户文本按文本转义输出。存储失败显示提示并保留内存数据，可导出备份。不同浏览器/设备不共享记录；同浏览器标签页使用 storage 事件同步。

## 授权试点的服务端契约（设计，未实现）

生产角色需要 visitor、student、club_manager、teacher、moderator、admin。校园身份必须经学校认可的身份提供方和人工/组织校验。不能凭角色选择框升级权限。

- `POST /activities`：teacher/club_manager，服务器核查组织归属。
- `POST /activities/:id/enroll`：student，服务端审批状态、容量事务、幂等键和取消路径。
- `POST /works`：作者归属、媒体授权、保留期限；默认私有。
- `POST /works/:id/review`：被授权指导教师，核查组织与记录，写入服务端审计。
- `POST /works/:id/consent`：已验证作者逐件授权并记录版本；编辑作品使旧授权失效。
- `POST /works/:id/publish`：moderator，重新核验活动、作品版本、审核、授权；不是只看前端状态。
- `DELETE /works/:id/publication`：作者撤回或管理员下架，同时清除公开缓存。
- `DELETE /me/notes` / `DELETE /works/:id`：按资源归属授权，按保留政策处理备份。

后台应逐条做资源级校验、CSRF/会话保护、速率限制、参数验证、不可由客户端改写的审计，以及媒体访问控制。私有业务记录不得进入静态 JSON、Git 或前端打包文件。服务地域、未成年人同意、留存、供应商与跨境要求需在真实试点前由学校确认；本文不作法律合规结论。
