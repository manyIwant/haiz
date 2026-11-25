// HAIZ Campus Toybox — Mountable Verification Challenge Component.
// Orchestrates the 3D Qilou claw machine, accessible alternative flow, ChallengeAdapter,
// AntiBotProvider, AbortController lifecycle isolation, and final handoff to the login host.
import { ClawScene } from '../machine/ClawScene.js';
import { TOY_BY_ID } from '../toys/registry.js';
import { createAntiBotProvider } from './adapters/index.js';
import { ATTEMPT_STATUS } from '../../shared/protocol.js';

export class HaizToyboxChallenge {
  /**
   * @param {HTMLElement} mountEl
   * @param {{ adapter: object, onVerified?: (payload: object) => void, onCancel?: () => void, galleryUrl?: string }} opts
   */
  constructor(mountEl, { adapter, onVerified, onCancel, galleryUrl = './gallery.html' }) {
    if (!mountEl || !adapter) throw new Error('HaizToyboxChallenge requires mountEl and adapter');
    this.mountEl = mountEl;
    this.adapter = adapter;
    this.onVerified = onVerified || (() => {});
    this.onCancel = onCancel || (() => {});
    this.galleryUrl = galleryUrl;

    this.mode = 'game'; // 'game' | 'accessible'
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false;
    this.muted = false;
    this.challenge = null;
    this.challengeStartedAt = 0;
    this.antiBot = null;
    this._gen = 0;
    this._ac = null;
    this._keys = new Set();

    this._renderDOM();
    this.scene = new ClawScene(this.els.canvasHost, {
      reducedMotion: this.reducedMotion,
      onDropComplete: (pick) => this._handleSubmit(pick),
      onStateChange: (state, info) => this._onSceneState(state, info),
    });
    this._bindControls();
    this.startChallenge('game');
  }

  _renderDOM() {
    this.mountEl.innerHTML = `
      <div class="tbx-shell">
        <header class="tbx-header">
          <div class="tbx-brand">
            <h1>HAIZ · 校园玩偶屋</h1>
            <span>CAMPUS TOYBOX</span>
          </div>
          <div class="tbx-tools">
            <span class="tbx-badge-demo hidden" data-role="demo-badge">DEMO 演示模式 · 非正式授权</span>
            <a class="tbx-btn-ghost" href="${this.galleryUrl}" data-role="gallery-link">角色艺术验收馆</a>
            <button type="button" class="tbx-btn-ghost" data-role="btn-a11y" aria-pressed="false">无障碍模式</button>
            <button type="button" class="tbx-btn-ghost" data-role="btn-rm" aria-pressed="${this.reducedMotion}">减弱动效</button>
            <button type="button" class="tbx-btn-ghost" data-role="btn-mute" aria-pressed="false">音效: 开</button>
          </div>
        </header>

        <main class="tbx-stage-wrap">
          <div class="tbx-canvas-host" data-role="canvas-host" aria-label="海南中学微缩抓娃娃机三维画布"></div>

          <div class="tbx-target-strip" data-role="target-strip" aria-live="polite">
            <span class="tbx-target-dot" data-role="target-dot"></span>
            <span>寻找伙伴：<strong class="tbx-target-name" data-role="target-name">加载中…</strong></span>
            <span class="tbx-target-hint" data-role="target-hint"></span>
          </div>

          <section class="tbx-welcome hidden" data-role="welcome" aria-live="polite">
            <div class="tbx-welcome-kicker">HAIZ · CAMPUS WELCOME</div>
            <h2 data-role="welcome-title">欢迎回到海南中学</h2>
            <p data-role="welcome-body"></p>
            <div class="tbx-welcome-actions">
              <button type="button" class="tbx-btn-primary" data-role="btn-continue">继续进入校园 →</button>
              <button type="button" class="tbx-btn-ghost" data-role="btn-replay">再玩一次</button>
            </div>
          </section>

          <section class="tbx-a11y-panel hidden" data-role="a11y-panel" aria-label="无障碍替代真人验证">
            <div class="tbx-a11y-inner">
              <h2>无障碍入校验证</h2>
              <p data-role="a11y-prompt" style="margin:0;color:var(--ink-soft);font-size:0.9rem;"></p>
              <div class="tbx-a11y-grid" data-role="a11y-grid"></div>
              <p style="margin-top:14px;font-size:0.78rem;color:var(--ink-soft);">
                此流程与抓娃娃机共享完全一致的服务端挑战校验与反机器人验证安全保障。
              </p>
            </div>
          </section>
        </main>

        <footer class="tbx-console">
          <div class="tbx-status" data-role="status" role="status" aria-live="polite">
            正在唤醒校园玩偶屋…
            <small data-role="status-sub">点击/拖动画面或使用方向键移动机械爪，按空格键抓取</small>
          </div>
          <div class="tbx-antibot-slot" data-role="antibot-slot"></div>
          <div class="tbx-controls" data-role="controls">
            <div class="tbx-dpad" aria-label="方向控制">
              <button type="button" class="tbx-dir" data-dir="up" aria-label="向后移动">▲</button>
              <button type="button" class="tbx-dir" data-dir="left" aria-label="向左移动">◀</button>
              <button type="button" class="tbx-dir" data-dir="down" aria-label="向前移动">▼</button>
              <button type="button" class="tbx-dir" data-dir="right" aria-label="向右移动">▶</button>
            </div>
            <button type="button" class="tbx-grab-btn" data-role="btn-grab">抓取</button>
            <button type="button" class="tbx-btn-ghost hidden" data-role="btn-refresh">换一局</button>
          </div>
        </footer>
      </div>
    `;

    const q = (r) => this.mountEl.querySelector(`[data-role="${r}"]`);
    this.els = {
      demoBadge: q('demo-badge'),
      btnA11y: q('btn-a11y'),
      btnRm: q('btn-rm'),
      btnMute: q('btn-mute'),
      canvasHost: q('canvas-host'),
      targetDot: q('target-dot'),
      targetName: q('target-name'),
      targetHint: q('target-hint'),
      welcome: q('welcome'),
      welcomeTitle: q('welcome-title'),
      welcomeBody: q('welcome-body'),
      btnContinue: q('btn-continue'),
      btnReplay: q('btn-replay'),
      a11yPanel: q('a11y-panel'),
      a11yPrompt: q('a11y-prompt'),
      a11yGrid: q('a11y-grid'),
      status: q('status'),
      statusSub: q('status-sub'),
      antibotSlot: q('antibot-slot'),
      controls: q('controls'),
      btnGrab: q('btn-grab'),
      btnRefresh: q('btn-refresh'),
    };
  }

  _bindControls() {
    // Grab & Refresh
    this.els.btnGrab.addEventListener('click', () => this.scene.triggerGrab());
    this.els.btnRefresh.addEventListener('click', () => this.startChallenge(this.mode));
    this.els.btnReplay.addEventListener('click', () => this.startChallenge(this.mode));
    this.els.btnContinue.addEventListener('click', () => {
      if (this._passedPayload) this.onVerified(this._passedPayload);
    });

    // Toggles
    this.els.btnA11y.addEventListener('click', () => {
      const next = this.mode === 'game' ? 'accessible' : 'game';
      this.startChallenge(next);
    });
    this.els.btnRm.addEventListener('click', () => {
      this.reducedMotion = !this.reducedMotion;
      this.els.btnRm.setAttribute('aria-pressed', String(this.reducedMotion));
      this.scene.setReducedMotion(this.reducedMotion);
    });
    this.els.btnMute.addEventListener('click', () => {
      this.muted = !this.muted;
      this.els.btnMute.setAttribute('aria-pressed', String(this.muted));
      this.els.btnMute.textContent = this.muted ? '音效: 关' : '音效: 开';
      this.scene.audio.setMuted(this.muted);
    });

    // Virtual D-pad pointer hold
    const dirMap = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    this.mountEl.querySelectorAll('.tbx-dir').forEach((btn) => {
      const [dx, dz] = dirMap[btn.dataset.dir];
      const start = (e) => { e.preventDefault(); this.scene.setInput(dx, dz); };
      const stop = () => this.scene.setInput(0, 0);
      btn.addEventListener('pointerdown', start);
      btn.addEventListener('pointerup', stop);
      btn.addEventListener('pointerleave', stop);
      btn.addEventListener('pointercancel', stop);
    });

    // Keyboard controls
    this._onKeyDown = (e) => {
      if (this.mode !== 'game') return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', ' '].includes(e.key)) {
        if (document.activeElement?.tagName !== 'BUTTON') e.preventDefault();
      }
      if (e.key === ' ' || e.key === 'Enter') {
        if (this.scene.state === 'aiming') this.scene.triggerGrab();
        return;
      }
      this._keys.add(e.key.toLowerCase());
      this._syncKeys();
    };
    this._onKeyUp = (e) => {
      this._keys.delete(e.key.toLowerCase());
      this._syncKeys();
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  _syncKeys() {
    let x = 0, z = 0;
    if (this._keys.has('arrowleft') || this._keys.has('a')) x -= 1;
    if (this._keys.has('arrowright') || this._keys.has('d')) x += 1;
    if (this._keys.has('arrowup') || this._keys.has('w')) z -= 1;
    if (this._keys.has('arrowdown') || this._keys.has('s')) z += 1;
    this.scene.setInput(x, z);
  }

  _setStatus(main, sub = '') {
    this.els.status.childNodes[0].textContent = main;
    this.els.statusSub.textContent = sub;
  }

  async startChallenge(mode = 'game') {
    // Cancel previous in-flight challenge cleanly
    this._gen += 1;
    const gen = this._gen;
    if (this._ac) this._ac.abort();
    if (this.challenge) {
      this.adapter.cancelChallenge({ challengeId: this.challenge.challengeId }).catch(() => {});
    }
    this.antiBot?.destroy();
    this.antiBot = null;

    this._ac = new AbortController();
    this.mode = mode;
    this._passedPayload = null;
    this.els.welcome.classList.add('hidden');
    this.els.btnRefresh.classList.add('hidden');
    this.els.btnA11y.setAttribute('aria-pressed', String(mode === 'accessible'));
    this.els.a11yPanel.classList.toggle('hidden', mode !== 'accessible');
    this.els.controls.classList.toggle('hidden', mode === 'accessible');

    this._setStatus('正在向校园驿站申请本轮挑战…', '每次挑战随机生成玩偶位置与一次性凭证');

    try {
      const ch = await this.adapter.createChallenge({ mode, signal: this._ac.signal });
      if (gen !== this._gen) return;
      this.challenge = ch;
      this.challengeStartedAt = performance.now();
      this.els.demoBadge.classList.toggle('hidden', !ch.demo);

      // Prepare independent anti-bot provider
      this.antiBot = createAntiBotProvider(ch.antiBot?.provider);
      await this.antiBot.prepare({
        container: this.els.antibotSlot,
        siteKey: ch.antiBot?.siteKey,
        action: ch.antiBot?.action,
        cData: ch.antiBot?.cData,
        signal: this._ac.signal,
      });
      if (gen !== this._gen) return;

      const entry = TOY_BY_ID[ch.target];
      this.els.targetDot.style.background = entry.badgeColor;
      this.els.targetName.textContent = `${entry.name}（${entry.title}）`;
      this.els.targetHint.textContent = entry.accessibleHint;

      if (mode === 'accessible') {
        this._renderAccessible(ch, entry);
        this._setStatus(`请选择今日迎新伙伴「${entry.name}」`, `剩余尝试次数：${ch.attemptsLeft}`);
      } else {
        this.scene.loadChallenge(ch);
        this._setStatus(`请抓住「${entry.name}」放入左下角奖品口`, '点击或拖动画面对准玩偶，再按下「抓取」');
      }
    } catch (err) {
      if (err?.name === 'AbortError' || gen !== this._gen) return;
      this._setStatus('暂时无法连接验证服务', err?.message || '请稍后重试');
      this.els.btnRefresh.classList.remove('hidden');
    }
  }

  _renderAccessible(ch, targetEntry) {
    this.els.a11yPrompt.textContent = `请从下方 6 位校园伙伴中找出「${targetEntry.name}（${targetEntry.enName}）」——特征：${targetEntry.accessibleHint}。`;
    this.els.a11yGrid.innerHTML = '';
    for (const item of ch.layout) {
      const e = TOY_BY_ID[item.characterId];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tbx-a11y-card';
      btn.innerHTML = `<strong>${e.name} · ${e.enName}</strong><span>${e.accessibleHint}</span>`;
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const res = await this._handleSubmit({ slot: item.slot, characterId: item.characterId });
        btn.disabled = false;
        if (res?.status === ATTEMPT_STATUS.PASSED) {
          this.els.a11yPanel.classList.add('hidden');
          this._showWelcome(res, TOY_BY_ID[item.characterId]);
        }
      });
      this.els.a11yGrid.appendChild(btn);
    }
  }

  async _handleSubmit(pick) {
    if (!this.challenge || !pick) return { status: ATTEMPT_STATUS.INVALID };
    const gen = this._gen;
    this._setStatus('正在向服务端核验本次抓取与反机器人凭证…', '客户端状态不作为信任依据');
    try {
      const antiBotToken = await this.antiBot.getToken({ signal: this._ac.signal });
      const elapsedMs = Math.max(450, Math.round(performance.now() - this.challengeStartedAt));
      const res = await this.adapter.submitAttempt({
        challengeId: this.challenge.challengeId,
        nonce: this.challenge.nonce,
        pick,
        antiBotToken,
        elapsedMs,
        signal: this._ac.signal,
      });
      if (gen !== this._gen) return { status: ATTEMPT_STATUS.INVALID };

      if (res.status === ATTEMPT_STATUS.PASSED) {
        this._passedPayload = {
          passToken: res.passToken,
          passTokenExpiresAt: res.passTokenExpiresAt,
          demo: res.demo,
          mode: this.mode,
          character: TOY_BY_ID[pick.characterId],
        };
        return res;
      }
      if (res.status === ATTEMPT_STATUS.WRONG) {
        const pickedName = TOY_BY_ID[pick.characterId]?.name || '小玩偶';
        const targetName = TOY_BY_ID[this.challenge.target]?.name;
        this._setStatus(`抓到的是「${pickedName}」，它害羞地回去了！再找找「${targetName}」吧`, `剩余尝试次数：${res.attemptsLeft}`);
      } else if (res.status === ATTEMPT_STATUS.EXPIRED || res.status === ATTEMPT_STATUS.EXHAUSTED) {
        this._setStatus(res.status === ATTEMPT_STATUS.EXPIRED ? '本轮挑战已过期，请刷新新的一局' : '本轮尝试次数已用完，请换一局再试', '');
        this.els.btnRefresh.classList.remove('hidden');
      } else if (res.status === ATTEMPT_STATUS.ANTIBOT_FAILED) {
        this._setStatus('独立反机器人核验未通过，请重试', `剩余尝试次数：${res.attemptsLeft ?? 0}`);
        this.antiBot?.reset();
      } else if (res.status === ATTEMPT_STATUS.RATE_LIMITED) {
        this._setStatus('请求过于频繁，请稍候片刻再试', `建议等待 ${Math.ceil((res.retryAfterMs || 3000) / 1000)} 秒`);
      } else {
        this._setStatus('验证服务暂时不可用，请稍后重试', '');
        this.els.btnRefresh.classList.remove('hidden');
      }
      return res;
    } catch (err) {
      if (err?.name === 'AbortError') return { status: ATTEMPT_STATUS.INVALID };
      this._setStatus('网络或核验异常，请重试', err?.message || '');
      return { status: ATTEMPT_STATUS.ERROR };
    }
  }

  _onSceneState(state, info) {
    this.els.btnGrab.disabled = state !== 'aiming';
    if (state === 'aiming' && info?.emptyGrab) {
      this._setStatus('差一点点就碰到啦！再挪一挪光圈对准玩偶吧', '未抓到玩偶不会扣除尝试次数');
    }
    if (state === 'welcome' && info?.result) {
      this._showWelcome(info.result, info.character);
    }
  }

  _showWelcome(result, entry) {
    this._setStatus(`${entry.name}已经从奖品口探出头来迎接你啦！`, result.demo ? '演示凭证已签发（仅作展示，不可用于生产登录）' : '一次性服务端凭证已签发');
    this.els.welcomeTitle.textContent = `${entry.name}来接你入校啦`;
    this.els.welcomeBody.textContent = `「${entry.story}」`;
    this.els.welcome.classList.remove('hidden');
  }

  dispose() {
    this._gen += 1;
    this._ac?.abort();
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.antiBot?.destroy();
    this.scene?.dispose();
    this.mountEl.innerHTML = '';
  }
}
