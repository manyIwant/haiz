# 可运行的 HAIZ FLOW 垂直切片

## 启动（Node 20+）

1. 在解压后的仓库根目录运行 `node world/scripts/classroom-server.mjs`。
2. 浏览器打开 `http://127.0.0.1:8787/world/flow/`。
3. 从本机 `world/.haiz-demo/local-demo-keys.json` 复制对应演示凭据到登录框。teacher-a 是教师，student-a 是本班学生，display-a 是本班公共屏，teacher-b/display-b 是隔离的另一班。不要公开此文件。

打开两个独立浏览器会话，以同一 teacher-a 登录；一个调成390px模拟手机，另一个1440px模拟Windows。第三个会话使用display-a。手机新建并保存 → 桌面继续编辑 → 公开摘要预览并确认 → 公共屏出现 → 发布记录撤回。所有网络读写是真实HTTP，服务只监听loopback；这不等于两台物理设备已完成互联。

Windows布局有独立导航、工作区和可折叠上下文。手机优先快速草稿/继续。Ctrl+K搜索与跳转，Ctrl+S保存，Esc关闭模态。自选/拖入图片只在当前会话预览（2MB以内）；正文与公开摘要持久化和跨会话同步，图片未实现上传或跨端接力，界面已明确提示。

学生首页/社团搜索/示例活动/本机作品草稿；未做真实报名。原校园、第一人称、自习、思维续航、晚修作业从导航进入。整个世界没有迁移框架。

## 核心实现

- `world/flow/store.mjs`：教师私有草稿、乐观版本校验、幂等请求、公开投影、确认发布、撤回、审计、原子文件写入。
- `world/flow/app.js`：身份范围内缓存、离线编辑、重新连接、冲突比较/合并/恢复历史、手动预览、公开屏定时失效、规则建议。
- `world/flow/style.css`：桌面/移动分层与主题；`sw.js`只缓存壳，不缓存身份API。
- `world/scripts/classroom-server.mjs`：复用现有身份和loopback边界，新增Flow路由；旧作业接口保留。
- `.github/workflows/haiz-flow.yml`：Linux与Windows云端浏览器验证，无安装生产或改DNS步骤。

## 当前限制

无学校SSO、真实课表/审批部门、通知推送、语音识别、共享附件上传、真实社团报名、批量审核。本地教师演示角色被策略授权向本班发布；不是冒充学校审批完成。三端通过2.5秒轮询同步。多份未同步草稿可在列表恢复，当前打开的草稿联网后自动重试，其余逐份打开后保存。不能描述为生产级队列服务。

iOS/Android既有0.4.0-preview.2安装包不包含本轮新增Flow。新代码可被现有Capacitor打包脚本复制，但本地App没有办公室后端地址，不能把loopback Demo冒充手机跨设备互联。本轮交付Web/PWA源码和证据；新IPA/APK未构建、未签名安装。原生发布继续使用独立现有工作流，稳定服务接入需另外设计授权和HTTPS。
