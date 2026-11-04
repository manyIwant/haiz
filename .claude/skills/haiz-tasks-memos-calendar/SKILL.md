---
name: haiz-tasks-memos-calendar
description: "Use when redesigning HAIZ task, quick memo, calendar and class assignment flows with separate semantics and stable source links."
---

# haiz-tasks-memos-calendar

## 何时使用
用户能快速记录想法但不会被偷偷转成待办；课程、作业、通知有不同身份和生命周期。

## 实施流程
1. 任务 `Task`、备忘 `Note`、课程 `CourseSlot`、班级作业 `AssignmentLink` 建立清晰实体/关系；避免所有文本都写到 `addTask`。
2. 快捷输入在操作前给清楚结果：保存备忘、创建任务、识别日期后供用户确认，不自动假设。
3. 班级来源采用不变 source ID/version，个人完成状态独立于教师发布/撤回状态。
4. 设计当前时段课程、考试/作业截止日、已完成/待确认/逾期不同视觉优先级，支持撤销与历史回查。
5. 对重复任务、无日期任务、跨时区、临时调课、没有学校正式接口时的手动课表进行实际测试。
6. 与首页、收件、专注间保持同一数据实体，避免复制粘贴形成重复记录。

## 验收条件
- 可以明确说出“速记”和“待办”的差异。
- 进入焦点/任务详情不会丢失班级来源。
- 任务保存、编辑、撤销等可操作并可测试。
