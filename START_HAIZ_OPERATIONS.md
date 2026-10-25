# 校园实用性审查与第一批优化

先读[经营与落地审查](docs/haiz-operations/EXECUTIVE-REVIEW.md)，其中区分当前代码、目标架构和待访谈验证的需求。当前仍是安全本地演示，不是已经接入校园的生产系统。

运行 `npm --prefix world run start:sync`，打开终端给出的localhost页面并进入 `#homework`。在“本地服务与来源”中使用本机生成的教师演示凭据；不输入学校密码。服务仍只监听loopback。教室可在另一浏览器配置用display-a只读凭据打开`#classroom`。模拟晚修前由管理员在作业台载入模拟课表。

走查：输入作业后刷新，重新打开应恢复；预览后可返回修改；快速点击确认只产生一项；发布成功后同一草稿清空。换教师/班级不会在界面载入另一身份草稿。未识别晚修显示0；未建立设备回执，因此不声称“已在教室显示”。

本机草稿是普通浏览器存储，按身份分键是界面隔离，不是加密或正式认证；共享办公电脑还需要学校会话与清理策略。不要输入学生姓名、分数、家庭或健康信息。

验证：`npm --prefix world test`、`npm --prefix world run test:server`、`node --test world/tests/flow-server.test.mjs world/tests/pilot-server.test.mjs`、`node world/tests/operations-browser.mjs`。浏览器测试需Playwright；可通过HAIZ_CHROMIUM指定本机Chromium。CI见`.github/workflows/haiz-operations.yml`。

[验证与变更记录](docs/haiz-operations/VERIFICATION.md)。已有动画、第一人称校园和学习工具保留。本轮不替换先前发行文件，也未完成HTTPS作业服务、SSO、设备回执或真实ClassIsland部署。

HTTPS增量已加入：在现有试用服务的Flow登录后选择“班级作业”，无需重复登录。教师与授权只读会话可验证真实HTTP同步和客户端状态回执。详见[HTTPS链路](docs/haiz-operations/HTTPS-CLASSROOM.md)。新HTTPS教室页当前手动展示，未连接真实ClassIsland；原localhost课表模拟链路继续保留。

教师清单现在可按班级、日期和审核/撤回状态筛选；筛选不改变草稿，发布明日作业后自动切换到对应范围。回执会在教师端离线时本地到期，其他班级更新不影响本班清单。新走查命令：`npm --prefix world run test:workbench:browser`。

多设备修改同一作业时，现在可比较本机与服务器版本，选择冲突字段后回到编辑，再预览发布；刷新后的旧草稿可继续比较。新增“导出草稿”，会话失效后原页面也可导出尚未发布的本机文字，不含会话凭据。走查：`npm --prefix world run test:conflicts:browser`。TXT为人工恢复文字，不是完整数据包导入功能。
