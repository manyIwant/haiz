// HAIZ Campus Toybox — Main Entry Point
import './styles/toybox.css';
import { HaizToyboxChallenge } from './challenge/HaizToyboxChallenge.js';
import { createAdapterFromConfig } from './challenge/adapters/index.js';

const params = new URLSearchParams(window.location.search);
const mode = params.get('adapter') === 'http' ? 'http' : 'mock';
const adapter = createAdapterFromConfig({
  mode,
  baseUrl: params.get('api') || '/api/toybox',
  allowInProd: true, // Standalone demo / offline showcase permits MockAdapter with visible DEMO badge
});

const mount = document.getElementById('app');
const challenge = new HaizToyboxChallenge(mount, {
  adapter,
  galleryUrl: './gallery.html',
  onVerified: async (payload) => {
    // Demonstrate handing control back to a login system (in demo mode, verify token once on the demo adapter)
    const tokenPreview = `${payload.passToken.slice(0, 14)}…`;
    if (payload.demo && adapter.consumeDemoPassToken) {
      const verdict = await adapter.consumeDemoPassToken(payload.passToken);
      alert(
        `[HAIZ 登录交接演示]\n\n` +
        `迎新伙伴：${payload.character.name} (${payload.character.qualifiedId})\n` +
        `一次性凭证：${tokenPreview}\n` +
        `服务端核销演示：ok=${verdict.ok}, demo=${verdict.demo}\n\n` +
        `注意：当前为 DEMO 演示模式，真实生产登录需接入后端 HttpAdapter 与 Cloudflare Turnstile。`
      );
    } else {
      window.dispatchEvent(new CustomEvent('haiz:toybox:verified', { detail: payload }));
      alert(`已签发服务端一次性凭证（${tokenPreview}），控制权已交还登录系统。`);
    }
  },
});

window.__HAIZ_TOYBOX__ = challenge;
