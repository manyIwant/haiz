# HAIZ · Toybox V2 集成与安全适配文档（面向 Codex）

## 1. 部署路径与 V1 共存

将本工程部署至 `https://haiz.space/preview/human-verification-v2/`，与现有 V1（`/preview/human-verification/`）目录隔离，零构建、零外部 CDN 依赖：
- 抓娃娃机体验页：`/preview/human-verification-v2/index.html`
- 六款角色艺术验收台：`/preview/human-verification-v2/studio.html`

## 2. 前端低耦合接入

```js
import { createHumanVerification, HttpDualLayerAdapter } from '/preview/human-verification-v2/src/index.js';

const challengeProvider = new HttpDualLayerAdapter({
  baseUrl: '/api/human-verify/v2',
  credentials: 'include',
  antiBotProvider: {
    async getToken(signal) {
      return await requestTurnstileToken({ signal });
    }
  }
});

const verification = createHumanVerification({
  container: document.body,
  theme: document.documentElement.dataset.theme || 'porcelain',
  challengeProvider,
  onSuccess: async (result) => {
    await submitHaizLogin({ verificationToken: result.verificationToken });
    verification.close();
  },
  onFailure: (err) => console.warn('[HAIZ Toybox V2]', err.code, err.message),
  onCancel: () => {}
});
```

## 3. 双层安全验证协议

- `POST /api/human-verify/v2/challenge`：服务端返回 `challengeId`、`nonce`、`layoutOrder`（随机排列）、`targetCharacterId`、`expiresAt`、`status`。
- `POST /api/human-verify/v2/verify`：前端提交 `challengeId`、`nonce`、`selectedCharacterId`、`antiBotToken`（Cloudflare Turnstile）、`inputModality`、`elapsedMs`、`attemptIndex`。服务端强制校验 Turnstile 与挑战一致性并签发一次性 `verificationToken`。
- 每次 `open()` / `reset()` / `close()` 自动递增会话编号并调用 `AbortController.abort()` 取消进行中请求。
