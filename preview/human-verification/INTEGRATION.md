# HAIZ · 人类验证交互系统集成指南（面向 Codex 与工程维护者）

本文档用于指导将 `haiz-human-verification` 低耦合地接入现有 HAIZ 登录与通行流程，且不重写现有账号体系。

## 1. 前端接入（HAIZ Buildless ES Modules）

将 `haiz-human-verification/src/` 拷贝至 HAIZ 前端静态资源目录（例如 `public/components/human-verification/`），在登录页引入 Three.js 与本组件：

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script type="module">
  import {
    createHumanVerification,
    HttpChallengeAdapter
  } from '/components/human-verification/index.js';

  const challengeProvider = new HttpChallengeAdapter({
    baseUrl: '/api/human-verify',
    credentials: 'include'
  });

  const verification = createHumanVerification({
    container: document.body,
    theme: document.documentElement.dataset.theme || 'porcelain', // porcelain | obsidian | ocean
    challengeProvider,
    soundEnabled: true,
    onSuccess: async (result) => {
      // 将服务端签发的一次性 verificationToken 提交给 HAIZ 登录接口
      await submitHaizLogin({ verificationToken: result.verificationToken });
      verification.close();
    },
    onFailure: (error) => {
      console.warn('[HAIZ Verify] 服务端拒绝或异常:', error.code);
    },
    onCancel: () => {
      // 用户主动关闭验证弹窗，恢复登录按钮可点击状态
    }
  });

  loginButton.addEventListener('click', () => verification.open());
</script>
```

## 2. 组件 API 与生命周期

| 方法 / 配置 | 类型 | 说明 |
| :--- | :--- | :--- |
| `createHumanVerification(options)` | Function | 初始化实例；不立即创建 WebGL 上下文，直到首次调用 `open()` 时懒加载。 |
| `verification.open()` | Method | 展开弹窗、懒加载 3D 场景、触发机械爪唤醒动作并向 `challengeProvider` 请求新挑战。 |
| `verification.reset()` | Method | 重置玩偶位置与机械爪，并拉取新一轮服务端挑战。 |
| `verification.close()` | Method | 关闭弹窗并自动暂停 `requestAnimationFrame` 渲染循环与伺服音效。 |
| `verification.setTheme(themeId)` | Method | 动态切换 `porcelain` / `obsidian` / `ocean`，同步更新 DOM CSS 变量与 Three.js 棚拍灯光。 |
| `verification.setReducedMotion(bool)` | Method | 动态切换减少动画模式。 |
| `verification.getState()` | Method | 返回当前 `{ state, theme, accessibleMode, challengeId }` 只读快照。 |
| `verification.destroy()` | Method | 彻底销毁 DOM、事件监听、Web Audio 上下文及所有 Three.js Geometry / Material / Texture / Renderer 显存。 |

## 3. 服务端验证适配规范（Node.js ESM / Cloudflare Workers）

**安全原则**：严禁信任前端传递的“是否通过”布尔值。生产环境必须替换 `MockChallengeAdapter` 为 `HttpChallengeAdapter`，由服务端独立完成挑战签发与校验：

### 3.1 获取挑战 `POST /api/human-verify/challenge`

服务端生成一个有时效（推荐 120s）且单次有效的挑战记录存入 KV / Redis / Supabase：

```json
{
  "challengeId": "chl_01J...",
  "nonce": "9f3c2a8b1d...",
  "targetPlushId": "lanren-spirit",
  "promptText": "请带走那只「榄仁小芽」。",
  "expiresAt": 1795489200000
}
```

### 3.2 提交与校验 `POST /api/human-verify/verify`

前端通过 `sanitizeSubmission()` 仅提交最小非生物特征载荷（不含摄像头、人脸、指纹或学号）：

```json
{
  "challengeId": "chl_01J...",
  "nonce": "9f3c2a8b1d...",
  "selectedPlushId": "lanren-spirit",
  "inputModality": "joystick",
  "elapsedMs": 4820,
  "moveSamplesCount": 38,
  "attemptIndex": 1,
  "clientTimestamp": 1795489084820
}
```

服务端必须依次校验：
1. `challengeId` 存在、未过期且未被使用（防重放）。
2. `nonce` 与记录严格一致。
3. `selectedPlushId === record.targetPlushId`。
4. 结合 IP / Session 频率限制、Turnstile 或服务端风控策略。
5. 标记挑战已消耗，签发短时效 HMAC/JWT `verificationToken` 返回给前端：

```json
{
  "verified": true,
  "code": "OK",
  "message": "抓到啦，欢迎来到 HAIZ。",
  "verificationToken": "eyJhbGciOi..."
}
```

登录接口收到 `verificationToken` 后须在服务端二次验签并立即作废该 Token。

## 4. 移动端与 WebView 兼容性说明

- **Android Chrome / iOS Safari / HAIZ Flutter WebView**：
  - 摇杆区与 3D 视口均设置 `touch-action: none` 与 Pointer Capture，彻底避免手指拖动摇杆时触发页面橡皮筋回弹或垂直滚动。
  - 音频引擎遵循 iOS Safari / Chrome 自动播放策略，仅在首次 `pointerdown` / `keydown` 后解锁 `AudioContext`。
  - 监听 `document.visibilitychange`，切后台或锁屏时自动停止 WebGL 渲染循环以降低发热与耗电。
  - 低核设备（`hardwareConcurrency <= 4`）自动将 DPR 上限钳制在 `1.5`，在维持模型几何与材质精度的前提下保证帧率。
  - 横屏小高度视口（`max-height: 620px`）自动收紧画幅比例，避免按钮被底部安全区遮挡。

## 5. 扩展自定义玩偶

```js
import { registerPlush } from './src/index.js';

registerPlush(
  {
    id: 'haiz-anniversary-cat',
    nameZh: '校庆领结猫',
    accentHex: '#C94A3E',
    defaultSlot: { x: 0.9, y: -0.92, z: 0.15, rotY: -0.2, tiltZ: 0, scale: 1.0 }
  },
  (THREE, matLib) => {
    const group = new THREE.Group();
    // 返回包含 Mesh 的 THREE.Group
    return group;
  }
);
```

## 6. 已知限制与测试说明

- **无 WebGL 环境降级**：在禁用 WebGL 的老旧 WebView 中，组件会自动降级为内置的键盘/点击无障碍验证面板，依然通过同一套 `challengeProvider` 协议完成服务端校验。
- **本地单元测试**：运行 `npm test` 验证状态机非法跳转拦截、Mock 适配器防重放/防伪造、遥测隐私清洗、机械爪越界与奖品位判定及模块化玩偶注册。
