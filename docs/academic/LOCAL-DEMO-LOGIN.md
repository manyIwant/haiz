# HAIZ Academic · 本机学生登录演示

此分支复用现有真实 Node.js 24 / SQLite 后端及网页登录页面，而不是提供假登录。

## 立即体验（仅本机）

在源码根目录运行：

```sh
node tools/start-academic-demo.mjs
```

然后在**运行此命令的同一台电脑**打开 `http://127.0.0.1:8782/`，选择「登录」。

- 账号：`manyiwant`
- 演示密码：`admin`
- 权限：**student**，不是管理员，也不是学校官方账号
- 演示内容：一个虚构班级和一条测试作业。登录后可以读取官方作业列表；网页端还可以查看班级。
- 数据路径：`~/.local/share/haiz-academic-demo/demo.sqlite`，与正式 HAIZ Academic 数据库完全隔离。
- 自带随机强密码的内部演示管理员，不使用 `admin` 作为管理员密码。

演示启动器强制监听 `127.0.0.1`，并拒绝 `HAIZ_PUBLIC_HTTPS=1` 与非 loopback 的 `HAIZ_HOST`。请勿对它开启反向代理、端口转发、Cloudflare Tunnel 或任何公网入口。演示密码过弱，不能用于正式部署。

无需修改已有生产数据，也不会把学校名单、真实作业或个人资料导入测试库。

## 为什么手机和希沃仍然不能直接连接

`127.0.0.1` 只属于当前设备；手机访问自己的 `localhost` 并不会抵达 Mac。GitHub Pages 也不能执行 Node.js + SQLite API。

若要让 HAIZ Pocket 学生端与 Windows ClassIsland 插件跨设备同步：

1. 在能持久运行 Node.js 24 和持久化 SQLite 的服务器上部署 `services/academic/`。
2. 设置**独立强密码**的 `HAIZ_ADMIN_LOGIN`、`HAIZ_ADMIN_PASSWORD`（至少 14 位），服务仅监听 `127.0.0.1`。
3. 通过受控的 HTTPS 反向代理公开，例如 `https://academic.haiz.space`；配置 `HAIZ_PUBLIC_HTTPS=1`。
4. 在服务器上用现有管理员及教师审批流程创建正式学生账号、班级、邀请与屏幕只读密钥。不要使用演示密码或复制演示数据库。
5. 学生 Android App 填写上述 HTTPS 地址并登录独立 HAIZ 学生账号；ClassIsland 配置同一 HTTPS 地址以及已授权的 screenKey。
6. 在真实 Windows ClassIsland 和 Android 设备上完成身份、网络、同步、密钥轮换、断网恢复与安全测试。

**当前 HAIZ Pocket 网页预览不支持原生 Academic 登录**，不能用 `https://haiz.space/app-preview/` 证明云端登录已发布。正式 Academic 服务自身内置浏览器登录页，可由 HTTPS 反向代理提供。

## 发布门槛

- 不直接在静态 GitHub Pages 中存储账号密码。
- 不提供默认弱密码的公网账号。
- HTTPS、强密码、最小权限、数据库持久存储及备份、会话保护、审核与隐私处理必需。
- 不修改 `main`，先在独立预览分支与真实设备上验收。
- ClassIsland 的 .cipx 构建通过不等于 Windows 主机已安装兼容。
