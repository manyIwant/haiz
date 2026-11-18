# HAIZ 共游 Alpha · 测试报告

基准：main 1605c311b558bb20aa84658c0b5bec56c41a5f02。
独立开发分支：codex/haiz-multiplayer-alpha。
**工程实现已交付待验收；真实跨账号、跨设备和 hosted RLS 尚未验收。**

## 已执行

### 17 项 Node 合约测试：通过

命令：`npm run test:multiplayer`。

- 两模拟用户互见、移动、run动作与插值位置；原始/展示快照分开。
- 伪造来源、旧序号、未知协议、无穷数、异常速度位移丢弃。
- 隐身撤下不含位置，独立visibility事件；取消隐身产生新session。
- 失联清旧状态、重新建连、旧连接回调不干扰新连接。
- 同账号多个session按规则只展示一个，主session退出后切换。
- 接收超时清除、防旧包复活、闲置/后台与活跃发包节流。
- 观察者/错误报告器抛异常不阻断联网与其余订阅者，取消订阅正常。
- 永久权限失败不重试、未完成连接的取消与资源清理。
- 2/5/10/20容量的理论移动计费预算≤75/s。
- 20个纯模拟身份、30秒持续运动的通信逻辑与有限样本；**不是**20设备/云服务压测。
- 地图逆变换回到geo.frame原坐标，包含旋转frame的heading。
- 远程人物位置/方向/跳跃输入，加载期间离开与销毁竞态。
- 私有频道、绑定目录alias、只能从自己频道发布。
- 目录拒绝时不开任何topic、订阅失败撤销所有topic、取消协商无泄漏。
- 先订阅的observer在其他topic加入前失败时，整次连接拒绝。
- 断开socket禁止SDK自动回退到REST Broadcast。
- Presence操作节流与取消。

### 本地 PostgreSQL RLS 与回滚：通过

命令：
```sh
HAIZ_MP_PGLITE=/absolute/path/to/@electric-sql/pglite/dist/index.js \
  npm run test:multiplayer:policies
```

使用PGlite 0.5.16，执行原样迁移SQL和回滚；
auth.uid / auth.jwt / realtime.topic 是测试的请求上下文替身。

验证了房间目录只向受邀者开放、alias与Auth UUID分离、
另一受邀账号不能在他人topic写Broadcast/Presence、匿名/未受邀账号不可读写、
错误扩展不可写、topic伪造被拒绝、旧宽松策略不能绕过保留namespace、
原有其他namespace规则不受影响、禁用房间生效、回滚删除仅本模块对象。

**本地SQL成功不证明生产已部署，不证明Supabase托管集群的私有频道设置与权限缓存行为。**

### Chromium + WebGL + 真正的 Supabase SDK：通过

命令：
```sh
HAIZ_MP_UMD=/absolute/path/to/supabase-js/dist/umd/supabase.js \
  npm run test:multiplayer:browser
```

- Playwright 1.62.1，Chromium，桌面1024×720、Pixel 7触屏上下文。
- 加载仓库现有完整校园GLB、榄仁树、Walker与控制器；
  真实supabase-js 2.109.0处理Auth / RPC / Phoenix / Presence / Binary Broadcast。
- 通过Playwright路由拦截云API与WebSocket，以本地服务模拟两身份和未授权第三身份；
  **没有向真实Supabase登录、写库或发位置，也没有真实测试账号。**
- 两人登录不自动加入；主动同房互见。
- 远程3D形象实际实例化；运动能从跑/走切到停，触屏拖动影响另一端。
- 地图直接投影同一展示快照；数值世界坐标相等。
- 隐身清除形象，恢复重新出现；模拟socket关闭后重新加入正常。
- 退出移除远程角色；未授权的目录请求失败且未打开WebSocket。
- 无pageerror及模拟网关断言错误。一次远程角色观测146 draw calls。
- **不是性能承诺**：使用软件GPU，测试拦截alpha-scene仅将绘制节流为1fps、
  降低像素倍率；校园/控制/人物/采样逻辑保留。未测真实手机GPU、帧率和温度。
- CDN文件与官方npm包SHA384字节对照一致，页面使用固定版本SRI。

### 既有回归

- `npm test` 前序open-assets、journey、darkroom、windowsill、
  climate、site、journal、descent通过；在原有
  `tests/cinematic-runtime.cjs:30` 的
  `assert(renders>0&&disposed)` 失败。
- 单独重跑该电影测试仍失败；相关源码和测试相对基准HEAD全部未改。
  本报告保留此失败，**不宣称根测试全绿**，不在多人任务内修改六幕电影。
- 补跑 `tests/walk/verify.cjs`（36项）、`tests/walk/runtime.cjs`
  （桌面/手机/离线/失败回退/arrival/journey），以及 `tests/map.cjs`：通过。
- 检查新增模块语法、git diff空白和改动范围。
  根build生成器不消费新增静态工程页，本次未重写全站产物。
- GitHub CI新增无凭据SDK合约验证；远端工作流结果须看PR，不能用本地通过代称。

## 真实验收缺口与环境调查

已查仓库Pocket配置、Supabase setup/迁移、现有QA脚本，
以及旧Codex会话「完善 Haiz 后端服务」与相关登录会话。
找到haiz-prod公开客户端配置；未找到可用于本任务的两个Supabase专用测试账号、
隔离项目授权或迁移已部署的证据。
旧后端会话说明其Cloudflare临时测试账号已清理，且该账号服务与Pocket Supabase独立。

没有新注册生产用户、使用SMTP批量发信、修改haiz-prod权限或伪造跨账号成功。
没有在代码、测试报告或提交中放入真实账号凭证。

## 下一轮 hosted + 真设备验收清单

使用隔离项目和两个受邀的已确认邮箱账号A/B，加一个未受邀账号C。
管理员先按交接文档应用迁移、配置房间/私有授权。

1. 两台不同设备独立登录，同房互见；确认可见玩家人数2。
2. A走向榄仁树，B看见同一方向的位置；走、跑、停、转身、跳跃各测。
3. 地图调用getPlayers/sample投影，与同一时刻3D位置一致。
4. A隐身，B的名单/形象/人数清除；恢复等待Presence节流后重新出现。
5. A退出、关闭标签、强制断网分别检查B消失及24秒兜底；重连没有旧形象复活。
6. 同账号多标签/多设备只见一个人物，关闭主session后交棒；不把多标签当多个人。
7. C和anon目录RPC失败；C对已知topic的private读/写失败；
   private:false同名频道也收不到private位置。
   A不能借已知B alias在B topic写Presence/Broadcast。
8. 对生产等同配置进行JWT refresh/expiry、账号退出和撤销邀请后的权限重算测试。
   记录时间；不得将撤销写入SQL误称即时踢出。
9. 快速连接/关闭/重连与反复隐身，核对Presence限流与退避；
   使用真实网络延迟/丢包，不只用SDK替身。
10. 实际2～5人、iOS Safari和Android Chrome持续15分钟；
    记录frame time、内存、发包、接收数、移动延迟、热耗和Dashboard计费用量；
    Pocket同时在线时仍留项目额度余量。
11. 扩至10～20人前重新评估房间与预算。当前单房20人低频虽然能处理状态，
    插值延迟5秒左右，不是已达多人流畅验收。

通过上述真实验收后，再把PR从草稿变为可合并；不要直接发布未经验证的生产共游。
