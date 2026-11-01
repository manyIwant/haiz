
## 今日作业增量

公开 Assignment 字段：id、version、scope、studyDate（Asia/Shanghai YYYY-MM-DD）、subject、content（1–400 字）、materials、due、status、review、actor、updatedAt、demo。没有学生名单、成绩、私人笔记或完成状态。todayAssignments 仅展示本班当天已批准且未撤回内容。

POST /api/assignments：teacher/admin。教师仅本班且只能改自己的作业；POST /api/assignment-action 操作 approve/withdraw，approve 仅 admin。乐观版本冲突返回 409；未知身份和越班写入由服务端拒绝。GET /api/snapshot 和 SSE 按身份过滤，display/student 不收到待审作业。已有通知和作业分别存储。离线只读不伪造服务端发布成功。

Bridge 的 scheduleDate 和每节 startAt/endAt 必须来自允许的课表来源；模拟适配器显式标记 simulator。客户端支持最多 64 节，取当天最后两节有效自习；缺失、重叠或冲突不展示。auto 展示设置是设备本地偏好，不由教师发布任意远程命令改变。
