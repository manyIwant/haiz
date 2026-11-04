---
name: haiz-accessibility
description: "Use when ensuring HAIZ mobile UI works with screen readers, large Chinese text, reduced motion, keyboard navigation and accessible touch interactions."
---

# haiz-accessibility

## 何时使用
无障碍不是发布末期加 tooltip：要在组件状态与导航设计时一起考虑。

## 实施流程
1. 建立对比度、可读中文尺寸、按键与触摸目标、文本缩放、语义名称、焦点顺序及系统减少动画的基线。
2. 任务勾选明确 `checked` 与完成状态，装饰图层不抢走可交互命中测试；输入框准确关联 label/error。
3. 测试 TalkBack/VoiceOver 的列表、弹窗、底部导航与返回动作；对状态变化提供合理语义提醒，不刷屏。
4. 200% 文本缩放 + 小屏 + 键盘弹出时检查溢出、固定位置按钮和遮挡。
5. 不能只用颜色区别“已完成/待确认/错误”，增加形态/文本/图标冗余。
6. 用户减少动态效果时所有主要交互仍然存在。

## 验收条件
- 有真实辅助功能测试记录或明确待验证项。
- 关键按钮可被单独聚焦并正确命名。
- 交互不会把可访问性牺牲给玻璃效果。
