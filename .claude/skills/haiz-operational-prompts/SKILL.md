---
name: haiz-operational-prompts
description: "Use when writing accurate Claude Code implementation prompts or handing off HAIZ 2.0 work across sessions with clear constraints and no excessive micromanagement."
---

# haiz-operational-prompts

## 何时使用
输出 Claude 能执行的目标、边界和验收，而非几千字干扰创造力的设计规格。

## 实施流程
1. 提示词包含：目标用户、待解决问题、当前代码位置、审美反例、可自由发挥范围、数据安全约束、交付形式和验证门槛。
2. 避免预先规定像素、精确颜色、组件个数、动画毫秒数；这些由试验、视觉比较与用户反馈决定。
3. 说清“不要 AI 味”：无意义标语/空统计/统一卡片/廉价阴影；让设计师研究已发布产品。
4. 给第一版明确定义：真正可交互页面、核心任务实际持久化、对比截图、可运行预览。
5. 把阶段性交接浓缩为 commit、已经验证的事实、下一步可重现命令、未完成真实风险。
6. 不要求无权限的上线动作，也不在提示词中写机密账号或凭证。

## 验收条件
- 未来协作者读一页交接即可知道怎样推进。
- 提示词既有野心又可检验，不是纯美术口号。
