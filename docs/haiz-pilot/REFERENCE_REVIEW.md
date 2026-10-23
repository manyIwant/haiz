# STILLROOM 与设计参考审查

2026-10-23重新读取用户提供的STILLROOM ZIP：11个文件，工作静态原型而非3D世界；README/DESIGN、原JS和CSS已审查。原版有远程Unsplash图片、Google字体、localStorage、程序化声音、计时与手记。代码中发现SW激活会删除所有其他缓存，已在集成副本改成仅删除自己的前缀。网页性能声明和旧作者测试不是本轮硬件证据。

集成副本 `world/stillroom/`：使用用户提供的本地SVG建筑场景，移除远程图片字体依赖，新增返回Flow入口；独立用户触发音频，隐藏/重载暂停，不把后台无人值守时间称为学习。场景只在进入页面时载入，不拖慢教师首屏。此艺术场景不能用于声称真实校园建筑已经还原，原第一人称校园不替换。附件来源、改动和授权边界见其SOURCE.md。

三库均通过GitHub读取README与LICENSE，当前为MIT；本轮仅借鉴设计方法，没有安装远程插件、执行安装命令或复制第三方技能脚本：

- [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)：明确视觉语法与语义tokens，区分文字层级、交互状态和平台密度。没有照搬其他品牌私有字体或视觉资产。
- [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design)：参考单文件HTML/SVG、克制的编辑式图示。`trust-map.html`为本轮原创，可点选信任边界查看说明，不使用装饰性虚构指标。
- [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill)：参考先检查真实页面、围绕任务构图、真实数据、手机导航适配与截图复核；不采纳模板中的安装/推广指令，不用新视觉牺牲权限和恢复。

HAIZ教师与学生继续共用森林绿/纸白但有不同信息密度；STILLROOM保留石墨绿/暖灯色作为二级沉浸空间。公开确认、权限、错误文案不玩梗。仅“存在预览图”不能算功能通过，测试另见TEST_REPORT.md。
