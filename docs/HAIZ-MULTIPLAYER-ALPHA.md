# HAIZ 共游 Alpha · 工程交接

版本：2026-11-17。基准：main `1605c311b558bb20aa84658c0b5bec56c41a5f02`。
入口：`multiplayer-alpha.html`。改动在独立 `codex/haiz-multiplayer-alpha` 分支。
**尚未对生产 Supabase 应用迁移，尚未完成真实跨账号联网验收。**

## 审计结论

- 主站为 buildless 原生模块；`ruhua.html` 载入 `lanren/ruhua/main.js`。
  独立工程页不修改原入口、六幕、V2、动画美术或活点地图。
- 入画使用 `ruhua/walker.js` 以及 `ruhua-stroll/player.js`。
  `stroll/player.js` 与 `ruhua-stroll/player.js` 都有相同的第三人称输入、碰撞和移动状态；
  当前入画实际引用后者，验收页也引用后者。Walker 以真实位移生成步态，网络只传 pose。
- 复用 `assets/walk/campus.json`、`map/geo.js`、`map/campus3d.js`、
  `ruhua-stroll/campus.js` 与 `world/collide.js`；没有第二套校园或人物控制器。
- 坐标为 Y 向上，米制，以榄仁树为原点的世界坐标。方向为 Three.js rotation.y 弧度：
  yaw=0 朝 +Z，yaw=π/2 朝 +X。线上入画 world 与本页均使用 `buildGeo(...,{rotation:0})`。
  不要把 V4 原场景坐标直接当成漫游坐标；入画的 V4 美术旋转见 `ruhua/v4.js`。
  校园模型绝对方位未经原 KML 复核，不是 GPS 导航。
- Pocket 已有 Supabase Auth：`app/lib/core/pocket_auth.dart`。
  公开配置指向 `haiz-prod`。仅复用这套服务的账号，工程页调用现成
  `signInWithPassword`，不注册新账号、不发邮件、不新建认证后端；
  Pocket Flutter 的内存会话不会自动转给本页。
  `backend/` 的 Node + SQLite 账号与 Academic 账号是独立身份域，不能冒充 Supabase JWT。
- 既有迁移只有 Pocket snapshot RLS，仓库没有本共游所需的 Realtime 策略。
  **代码审计不能证明云端控制台的实际权限、余额或项目套餐。**
- 只读核实：GitHub Pages 为 legacy 从 `main:/` 发布，CNAME 为 haiz.space；
  现有 `ruhua.html` HTTP 200。开发分支不会自动上线。
- 既有根 `npm test`、walk、map 与浏览器脚本可复用；新增独立多人测试。

## 架构与选择

选用 Supabase 私有 Presence + Broadcast，GitHub Pages 只提供静态资源。
数据库仅保存受邀房间、账号与每房间匿名 alias，不保存位置、轨迹或最后位置。
不把高频运动写到 Postgres，也不逐帧传骨骼。选用已有技术，无新增常驻服务器。

每个受邀玩家有一个频道 `haiz-mp:v1:<room>:<alias>`。
所有受邀成员可以读，只有这个 alias 对应的 Auth 用户可以写
Broadcast 与 Presence。**接收者以被授权频道的 alias 定身份，忽略 payload 自报身份。**
这比共享一个人人可写的 topic 多一些订阅，却能在服务端阻止 A 冒充 B。
一个客户端只使用一个 WebSocket，订阅至多 20 个 topic；非本人 topic 不调用 track。
目录 RPC 仅返回本房间匿名 alias 与容量；不返回 Auth user UUID、邮箱、班级、宿舍。
昵称不是身份，允许同名，展示必须使用 textContent。

Alpha 每房间最多 5 个受邀账号，目录与容量由操作者预先配置；
没有自助邀请、扩容或 NPC。目录在 connect 时读取：
**增加/删除邀请后，应让全部客户端退出再加入；不要在进行中的房间改名单并承诺即时生效。**
同账号多标签页只渲染一个玩家，按 session UUID 排序选发布者；主实例退出后交棒。
重复标签仍是付费订阅者，并消耗 Presence/连接额度；不算额外真实玩家。
去重是可用性措施，不阻止同账号故意伪造多个 session 来抢占自己的形象。

SDK `client.js` 不引用 DOM、Three.js 或 Supabase。传输在 `supabase.js`。
`avatars.js` 接收展示快照；`map.js` 通过现有 frame 转换同一份快照。

## 给 Claude 的稳定接口

所有运行时接口从 `lanren/multiplayer/index.js` 导入，类型在相邻 `index.d.ts`。
实际应用注入已经登录的 Supabase JS client：

```js
import {
  createMultiplayerClient, createSupabaseTransport, createMapAccess,
} from './lanren/multiplayer/index.js';

const mp = createMultiplayerClient({
  transport: createSupabaseTransport(existingSupabase),
  bounds: geo.frame.sheet,
});
mp.setNickname('海风'); // 只能在连接前改；不使用真实姓名或 profile/email 回退
mp.updateLocalPlayer({
  x: 1, y: geo.frame.ground + 0.02, z: -31,
  yaw: 0, speed: 0, motion: 'idle',
});
await mp.connect('campus-alpha'); // 必须来自明确的加入动作
const map = createMapAccess(mp, geo.frame);
const off = map.subscribe('leave', ({ player, reason }) => removeMark(player.id));

// 在场景自己的帧循环里：
const state = player.update(dt); // 当前本地控制器完全独立即时执行
mp.updateLocalPlayer({
  x: state.pos.x, y: state.pos.y, z: state.pos.z,
  yaw: state.yaw, speed: state.speed,
  motion: state.airborne ? 'jump' : state.speed < 0.12 ? 'idle' : state.run ? 'run' : 'walk',
});
const time = performance.now();
const sample = mp.getPlayers({ time });
// 三维与地图消费同一 sample，时间一致，别分别混用 display 与 network。
remoteLayer.update(sample, state.pos, dt);
drawMap(sample.map(map.project)); // 由 Claude 实现 drawMap，本任务不创建地图 UI

await mp.setVisible(false); // 立即停止位置发送，撤下通知不含位置
await mp.setVisible(true);  // Realtime Presence 限流下可能要等待
await mp.disconnect();
off();
await mp.destroy();
```

工程页提供 `window.haizMultiplayer.map`，以及只读 `snapshot()` 供验收；
`haiz:multiplayer-ready` 事件表示该接口可用了。退出账号后接口清空。
最终艺术整合应通过注入/销毁管理生命周期，不依赖工程页 DOM。

`VirtualPlayerState`：
- `id`：本房间 alias，身份不可从昵称推导。
- `nickname`：20 个 Unicode 字符，去控制字符；仍使用 textContent 输出。
- `x,y,z,yaw,speed,motion`：世界位置、朝向、米/秒、idle|walk|run|jump。
- `source:'user'`：SDK 只产生真实用户。以后 NPC/ecosystem 使用独立来源；
  不加入真实在线人数，不通过伪造 Presence 混入。
- `timestamp`：发送方 Unix 毫秒，仅作诊断；不拿跨设备墙钟做插值或排序。
- `isLocal`：当前客户端自己的身份。

地图额外返回 `campus:{x,z,yaw}`、`plan:{px,py}`。
它们由 `geo.frame.toCampus` 与 `campus.meta.transform` 的逆变换得到；
没有另建校园坐标。参数 frame 必须与发送场景相同。

`getPlayers()` 返回包含自己的可见玩家（连接中/失联则为空）。
**隐身成员不会出现在名单或人数里**，避免通过在线计数泄漏隐身。
因此工程页显示「可见玩家」，不声称知道隐身者在内的精确在线人数。
`{mode:'network'}` 是最近收到的有效 pose；默认 display 是插值后 pose。
本地 display 直接读即时本地坐标。返回状态为冻结对象，不允许艺术层改写。

事件 `subscribe(event, fn)` 返回取消订阅函数：
- join / update：`{player}`；idle、walk、run、jump 和转身在 update 的 motion/yaw 中。
- leave：`{player,reason}`。reason 包括 visibility / presence / session / timeout /
  connection / disconnect。正常隐身收到 visibility；若撤下包丢失则由 Presence 清除。
- connection：`{status,roomId,playerId,detail}`；状态见类型声明。
- update 是网络级通知，不在每个渲染帧触发，也不为心跳重渲染；显示动画自己采样。
- 回调异常送 onError，不阻断其他订阅者；销毁清理所有监听与计时器。

网络消息带协议 v=1、frame ID、session ID、单调 seq、发送时间。
接收按本地单调 receipt time 插值，最短圆弧转向；12 个样本封顶，
不外推未发生的移动。样本等待窗口约发送间隔+40ms。
2 人约165ms，5 人约374ms；10/20 人低频会有明显延迟，不能称游戏级体验。
远端停止/跳跃在采样时间线上交接。长时间无消息的快照不会跨窗口长距离滑动。
24s 无有效消息清除形象，保留该 session seq 防旧包复活。
Presence leave 通常更早清除；真实冻结/掉网清除时间需 hosted 验收。
临时错误清空旧名单并指数退避+抖动重建；权限错误终止，不降级公开频道。
服务端频道在连接前断开的竞态、旧回调、取消连接都有单元测试。

远程角色工厂只需 `{root,update(speed,airborne,dt,state),dispose?()}`。
工程页用现有 `createWalker`；艺术层以后能替换工厂。
桌面最多显示最近 6 个、触屏 4 个、120m 内角色；地图仍有全部可见玩家。
远处步态降至15Hz；画面位置仍每显示帧更新；退出和异步加载竞态会销毁资源。

## Supabase 迁移与部署

1. **先用隔离 Supabase 测试项目**。核对 Project URL 与客户端公开 key，
   使用与 Pocket 同样的 `sb_publishable_`，不复制 service role、DB 密码或 PAT 到前端。
   默认工程页配置直接取自 Pocket 公开设置；如测试别的项目，手工同步
   `alpha-config.js`。生产 key 可公开不等于该项目适合破坏性测试。
2. 审核并执行 `supabase/migrations/202611170001_haiz_multiplayer.sql`。
   该迁移原子创建专属 schema、目录 RPC 和四条 scoped Realtime RLS，
   不修改 Pocket 数据表，不重复 ALTER 已有的 realtime.messages RLS。
   不是幂等脚本，应用一次即可；迁移失败先排查事务，不盲目重复执行。
3. 由管理员在 SQL Editor 挑选**两个现有已确认邮箱**的测试账号。
   只在 SQL Editor 输入下面两个占位 UUID，不把身份/凭证放入 Git：

```sql
insert into haiz_multiplayer.rooms(id, capacity) values ('campus-alpha', 5);
insert into haiz_multiplayer.room_members(room_id, user_id) values
  ('campus-alpha', '<FIRST_EXISTING_AUTH_UUID>'::uuid),
  ('campus-alpha', '<SECOND_EXISTING_AUTH_UUID>'::uuid);

select r.id, r.capacity, r.enabled, count(m.user_id) as invited_accounts
from haiz_multiplayer.rooms r
left join haiz_multiplayer.room_members m on m.room_id=r.id
group by r.id;
select schemaname, tablename, policyname, permissive, cmd, roles
from pg_policies where schemaname='realtime' and tablename='messages';
```

4. Realtime Settings 开启 private-channel authorization。官方建议关闭
   **Allow public access** 强制整个项目只用私有频道；
   在现有 Pocket 项目先审计其他产品依赖，不能直接停用别的公开频道。
   工程 SDK 永远 private:true，绝不回退。hosted 验收还需验证 private:false
   同名 topic、anon、未受邀账号均收不到受保护频道的数据；public 与 private
   是隔离的 namespace。PGlite 只验证 SQL，不证明该云设置。
5. 操作者控制邀请数量≤capacity，默认5。容量是邀请名单上限检查，
   不是在线 socket 强制限额。20 人建议4个5人房间；不要只把某房 capacity 改20。
6. 启动 `python3 -m http.server 8765 --bind 127.0.0.1`，
   打开 `http://127.0.0.1:8765/multiplayer-alpha.html`。
   两个独立浏览器/设备登录已有 Pocket 测试账号，主动加入同房。
   CDN 固定 supabase-js 2.109.0，带 SHA-384 SRI；与 npm 包字节对照验证。
   页面只临时持有 auth 会话，刷新需重新登录；没有新增登录持久化或 localStorage 令牌。
   网络/SMTP 配置不能由静态页面自动修好。
7. 主仓库从 main 根目录发布。只有审核通过再合入和发布，迁移本身不会
   因推送 GitHub Pages 自动应用。本次不合并、不部署、不改云端权限。

回滚：先停止客户端、导出需要保留的房间邀请，再执行
`supabase/rollback/haiz_multiplayer.sql`。它只移除本模块策略、函数和邀请表；
不会恢复 Realtime Dashboard 设置，需操作者单独恢复。已经发出的坐标无法追回。

## 权限、隐私与明确边界

- 位置只存在浏览器和 Realtime 临时消息；没有位置数据库，也没有 Broadcast replay 配置。
  不申请地理定位，不读真实校园位置、不自动加载账号个人资料。
  昵称建议化名。后端运维日志及同房人的屏幕/抓包副本不受 SDK 控制。
- RLS 是服务端房间/身份边界；接收端 schema、有限数值、校园 bounds、最大8m/s、
  序号、session、合理位移与每源频率验证只是接收端抗异常措施。
  新会话第一帧没有可信历史，不能防穿墙、瞬移作弊或校园内虚假坐标。
- 客户端节流不能防绕过前端的恶意流量或项目额度消耗。共享 Supabase Realtime
  不为每个用户执行运动校验，也不对 Broadcast 每条消息执行自定义 payload RLS。
  若向非受邀公众开放，需受控服务端网关：验证 JWT/房间，校验位置与碰撞、
  每账号 token bucket、同账号连接限额，再由服务端发布已验真快照。
  可部署 Edge/Worker/已有 Node 服务，但须独立评估配额、延迟和费用；本阶段没有虚称已实现。
- 撤销成员或禁用房间会阻止新连接；已经加入的频道权限有缓存，
  依赖 JWT 刷新/到期重新评估，**不是即时踢人**。紧急事件使用控制台终止连接/
  撤销会话并核实生效；若要求即时撤销，需上述网关。
- Presence API 相邻操作间隔6.5s，避免官方5次/30s限制。隐身先发送不含
  坐标的撤下包并立即停止坐标广播，再排队 untrack；取消隐身等待 track 成功后
  才重新公开。快速连按应等待完成，UI不应假装已经重新出现。
- 房间隔离范围为校园 frame版本；不同坐标版本分配不同 topic 前缀/frame，不能混联。
- 不泄露邮箱给玩家不等于法律意义不可识别；alias 在同一房间稳定，账号删除会级联删除邀请。

## 测试入口与交接

- `node --test tests/multiplayer/*.test.mjs`：SDK、传输边界、地图、异步形象。
- `HAIZ_MP_PGLITE=/absolute/path/to/@electric-sql/pglite/dist/index.js node tests/multiplayer/policies.mjs`：
  真正的本地 PostgreSQL RLS执行，但 auth/realtime 请求函数为测试替身。
- `HAIZ_MP_UMD=/absolute/path/to/supabase-js/dist/umd/supabase.js node tests/multiplayer/browser.cjs`：
  Chromium WebGL + 真实 SDK + 本地模拟 Supabase。**不是**真实跨账号联网。
- 官方 SDK/CDN 需联网首次获取；单元测试不需要依赖安装。
- 最终验证记录与待执行项见 `HAIZ-MULTIPLAYER-TEST-REPORT.md`。
- 成本计算、官方来源与容量边界见 `HAIZ-MULTIPLAYER-COST.md`。
