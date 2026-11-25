// HAIZ 动物验证码 · 界面与流程
// 继承 PR #113 的三步流程：① 移动 ② 抓住 ③ 投放 → 服务端判定 → 已验证。
// 前端只负责交互；是否通过始终由 adapter（生产环境 = 可信服务端 + 反机器人校验）决定。
import { createAntiBotProvider } from '../../../haiz-campus-toybox-original/src/challenge/adapters/index.js';
import { resolveAnimal } from './animals/catalog.js';

const STEPS = ['移动', '抓住', '投放'];

const ICON = {
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
  arrows: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01"/></svg>',
};

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

/**
 * @param {{
 *   container: HTMLElement,
 *   adapter: { isDemo: boolean, createChallenge: Function, submitAttempt: Function, cancelChallenge: Function },
 *   onVerified?: (r: { passToken: string, passTokenExpiresAt: number, demo: boolean }) => void,
 *   onClose?: () => void,
 * }} opts
 */
export function createHaizVerifier({ container, adapter, onVerified, onClose }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = el('section', 'hv');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'hv-title');
  root.innerHTML = `
    <header class="hv-head">
      <span class="hv-badge" hidden>${ICON.check}</span>
      <button class="hv-icon hv-close" type="button" aria-label="关闭验证">${ICON.close}</button>
      <h2 id="hv-title" class="hv-title">请验证您是人类</h2>
      <p class="hv-sub"><span class="hv-sub-text">正在准备玩偶柜…</span></p>
      <ol class="hv-steps" aria-label="验证步骤">
        ${STEPS.map((s, i) => `<li data-i="${i}"><b>${i + 1}</b>${s}</li>`).join('')}
      </ol>
    </header>
    <div class="hv-stage">
      <canvas class="hv-canvas" aria-hidden="true"></canvas>
      <div class="hv-chute-label" aria-hidden="true">投放口</div>
      <div class="hv-loading" role="status">正在摆放玩偶…</div>
      <ul class="hv-list" hidden aria-label="选择目标玩偶"></ul>
    </div>
    <div class="hv-console">
      <div class="hv-stick" role="slider" tabindex="0" aria-label="摇杆：左右移动爪子" aria-valuemin="-1" aria-valuemax="1" aria-valuenow="0">
        <span class="hv-stick-base"></span><span class="hv-stick-knob"></span>
      </div>
      <p class="hv-pill" aria-live="polite">${ICON.arrows}<span>拖动摇杆</span></p>
      <button class="hv-go" type="button" disabled><span>抓</span></button>
    </div>
    <footer class="hv-foot">
      <button class="hv-alt" type="button">${ICON.list}<span>看不清或不方便操作？换一种方式</span></button>
      <span class="hv-demo" hidden>演示模式 · 不能用于真实登录</span>
    </footer>`;
  container.appendChild(root);

  const $ = (s) => root.querySelector(s);
  const ui = {
    badge: $('.hv-badge'), title: $('.hv-title'), sub: $('.hv-sub-text'), steps: [...root.querySelectorAll('.hv-steps li')],
    canvas: $('.hv-canvas'), loading: $('.hv-loading'), list: $('.hv-list'), chuteLabel: $('.hv-chute-label'),
    stick: $('.hv-stick'), knob: $('.hv-stick-knob'), pill: $('.hv-pill'), go: $('.hv-go'), alt: $('.hv-alt'), demo: $('.hv-demo'),
  };

  let scene = null;
  let challenge = null;
  let antiBot = null;
  let startedAt = 0;
  let state = 'loading'; // loading | move | grabbing | hold | submitting | verified | failed | accessible
  let held = null;
  let stickV = 0;
  let keyV = 0;
  let moved = false;
  let raf = 0;
  let destroyed = false;
  const ac = new AbortController();

  function setStep(i, done = false) {
    ui.steps.forEach((li, k) => {
      li.classList.toggle('is-on', k === i);
      li.classList.toggle('is-done', k < i || (done && k <= i));
    });
  }

  function pill(text, tone = '', icon = '') {
    ui.pill.className = `hv-pill ${tone ? 'is-' + tone : ''}`;
    ui.pill.innerHTML = `${icon}<span>${text}</span>`;
  }

  function setGo(label, enabled) {
    ui.go.querySelector('span').textContent = label;
    ui.go.disabled = !enabled;
  }

  function targetLabel(characterId) {
    const a = resolveAnimal(characterId);
    return `<strong class="hv-target" style="--tc:${a.textColor}">${a.name}</strong><span class="hv-emoji" aria-hidden="true">${a.emoji}</span>`;
  }

  // ---------- 控制：摇杆 / 键盘 / 直接拖动或轻点画面 ----------
  const canMove = () => state === 'move' || state === 'hold';

  let stickPointer = null;
  ui.stick.addEventListener('pointerdown', (e) => {
    if (!canMove()) return;
    stickPointer = { id: e.pointerId, x0: e.clientX };
    ui.stick.setPointerCapture(e.pointerId);
    ui.stick.classList.add('is-active');
  });
  ui.stick.addEventListener('pointermove', (e) => {
    if (!stickPointer || e.pointerId !== stickPointer.id) return;
    stickV = Math.max(-1, Math.min(1, (e.clientX - stickPointer.x0) / 26));
  });
  const stickUp = () => {
    stickPointer = null;
    stickV = 0;
    ui.stick.classList.remove('is-active');
  };
  ui.stick.addEventListener('pointerup', stickUp);
  ui.stick.addEventListener('pointercancel', stickUp);

  let dragPointer = null;
  ui.canvas.addEventListener('pointerdown', (e) => {
    if (!canMove() || !scene) return;
    dragPointer = e.pointerId;
    ui.canvas.setPointerCapture(e.pointerId);
    followPointer(e);
  });
  ui.canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId === dragPointer) followPointer(e);
  });
  const dragUp = () => (dragPointer = null);
  ui.canvas.addEventListener('pointerup', dragUp);
  ui.canvas.addEventListener('pointercancel', dragUp);
  function followPointer(e) {
    if (!canMove()) return;
    const r = ui.canvas.getBoundingClientRect();
    const target = scene.screenToX(e.clientX - r.left, e.clientY - r.top);
    dragTarget = target;
    noteMove();
  }
  let dragTarget = null;

  const keys = new Set();
  function onKey(e) {
    if (destroyed || state === 'accessible') return;
    const down = e.type === 'keydown';
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'a' || e.key === 'd') {
      if (!canMove()) return;
      e.preventDefault();
      const k = e.key === 'ArrowLeft' || e.key === 'a' ? 'L' : 'R';
      down ? keys.add(k) : keys.delete(k);
      keyV = (keys.has('R') ? 1 : 0) - (keys.has('L') ? 1 : 0);
    } else if (down && (e.key === ' ' || e.key === 'Enter') && document.activeElement !== ui.alt && document.activeElement !== root.querySelector('.hv-close')) {
      if (!ui.go.disabled) {
        e.preventDefault();
        ui.go.click();
      }
    } else if (down && e.key === 'Escape') {
      close();
    }
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  function noteMove() {
    if (moved) return;
    moved = true;
    if (state === 'move') {
      pill('对准后按下「抓」', '', ICON.arrows);
      setGo('抓', true);
    }
  }

  let lastTick = 0;
  function tick(now = performance.now()) {
    raf = requestAnimationFrame(tick);
    const dt = lastTick ? Math.min(0.1, Math.max(0.004, (now - lastTick) / 1000)) : 1 / 60;
    lastTick = now;
    if (!scene || !canMove()) return;
    const v = stickV || keyV;
    if (v) {
      scene.setClawX(scene.clawX + v * 2.15 * dt);
      dragTarget = null;
      noteMove();
    } else if (dragTarget != null) {
      const d = dragTarget - scene.clawX;
      const alpha = 1 - Math.exp(-14 * dt);
      scene.setClawX(scene.clawX + d * alpha);
      if (Math.abs(d) < 0.004) {
        scene.setClawX(dragTarget);
        dragTarget = null;
      }
    }
    ui.knob.style.transform = `translate(calc(-50% + ${v * 10}px), -50%) rotate(${v * 18}deg)`;
    ui.stick.setAttribute('aria-valuenow', String(Math.round(v * 100) / 100));
    if (state === 'hold') {
      const ok = scene.overChute();
      scene.setChuteGlow(ok);
      ui.chuteLabel.classList.toggle('is-on', ok);
      if (ok) pill('可以投放', 'ready', ICON.check);
      else pill('移到左边的投放口', '', ICON.arrows);
      setGo('放', ok);
    }
  }

  // ---------- 流程 ----------
  async function begin({ fresh = true } = {}) {
    state = 'loading';
    held = null;
    moved = false;
    dragTarget = null;
    setStep(0);
    setGo('抓', false);
    pill('正在准备…');
    try {
      if (fresh || !challenge) {
        if (challenge) adapter.cancelChallenge({ challengeId: challenge.challengeId }).catch(() => {});
        challenge = await adapter.createChallenge({ mode: 'game', signal: ac.signal });
        antiBot?.destroy?.();
        antiBot = createAntiBotProvider(challenge.antiBot?.provider);
        await antiBot.prepare({
          container: root,
          siteKey: challenge.antiBot?.siteKey,
          action: challenge.antiBot?.action,
          cData: challenge.antiBot?.cData,
        });
        ui.demo.hidden = !challenge.demo;
        ui.loading.hidden = false;
        await scene.loadLayout(challenge.layout);
        scene.setClawX(0.4);
        startedAt = performance.now();
      }
      ui.loading.hidden = true;
      ui.sub.innerHTML = `用爪子抓起那只 ${targetLabel(challenge.target)}`;
      state = 'move';
      pill('拖动摇杆', '', ICON.arrows);
      ui.stick.focus({ preventScroll: true });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error('[haiz-verifier]', err);
      fail('暂时连不上验证服务，请稍后再试');
    }
  }

  ui.go.addEventListener('click', async () => {
    if (state === 'move') {
      state = 'grabbing';
      setGo('抓', false);
      setStep(1);
      pill('抓取中…');
      const toy = await scene.dropAndGrab();
      if (destroyed) return;
      if (!toy) {
        state = 'move';
        setStep(0);
        pill('没抓到，再试一次', 'warn', ICON.arrows);
        setGo('抓', true);
        return;
      }
      held = toy;
      state = 'hold';
      setStep(2);
    } else if (state === 'hold' && scene.overChute()) {
      state = 'submitting';
      setGo('放', false);
      scene.setChuteGlow(false);
      ui.chuteLabel.classList.remove('is-on');
      pill('验证中…');
      await scene.release();
      await submit(held);
    }
  });

  async function submit(toy, mode = 'game') {
    let res;
    try {
      const antiBotToken = await antiBot.getToken({ signal: ac.signal });
      res = await adapter.submitAttempt({
        challengeId: challenge.challengeId,
        nonce: challenge.nonce,
        pick: { slot: toy.slot, characterId: toy.characterId },
        antiBotToken,
        elapsedMs: Math.round(performance.now() - startedAt),
        signal: ac.signal,
      });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      res = { status: 'error' };
    }
    if (destroyed) return;
    antiBot.reset?.();
    if (res.status === 'passed') return verified(res);

    if (res.status === 'invalid' && res.attemptsLeft > 0 && mode === 'accessible') {
      state = 'accessible';
      pill('慢一点，再点一次', 'warn', ICON.list);
      return;
    }
    if (res.status === 'wrong' && res.attemptsLeft > 0) {
      const animal = resolveAnimal(toy.characterId);
      if (mode === 'game') {
        await scene.returnToy(scene.toys.find((t) => t.slot === toy.slot));
        await scene.home();
      }
      held = null;
      moved = false;
      state = mode === 'game' ? 'move' : 'accessible';
      setStep(0);
      setGo('抓', false);
      pill(`那是${animal.name} ${animal.emoji}，还可以试 ${res.attemptsLeft} 次`, 'warn', ICON.arrows);
      return;
    }
    const msg = {
      exhausted: '次数用完了，换一局',
      expired: '这一局超时了，换一局',
      rate_limited: '操作太频繁，请稍等片刻',
      antibot_failed: '没有通过安全检查，换一局',
    }[res.status] || '出了点问题，换一局';
    pill(msg, 'warn');
    await new Promise((r) => setTimeout(r, reduced ? 300 : 1100));
    if (!destroyed) (mode === 'game' ? begin({ fresh: true }) : enterAccessible(true));
  }

  function verified(res) {
    state = 'verified';
    setStep(2, true);
    root.classList.add('is-verified');
    ui.badge.hidden = false;
    ui.title.textContent = '已验证';
    ui.sub.textContent = '欢迎回来，正在为你打开 HAIZ';
    pill('已验证', 'ok', ICON.check);
    setGo('✓', false);
    scene?.celebrate();
    setTimeout(() => {
      if (!destroyed) onVerified?.({ passToken: res.passToken, passTokenExpiresAt: res.passTokenExpiresAt, demo: !!res.demo });
    }, reduced ? 200 : 1300);
  }

  function fail(text) {
    state = 'failed';
    ui.loading.hidden = false;
    ui.loading.textContent = text;
    pill(text, 'warn');
    setGo('重试', true);
    ui.go.onclick = () => {
      ui.go.onclick = null;
      ui.loading.textContent = '正在摆放玩偶…';
      begin({ fresh: true });
    };
  }

  // ---------- 无障碍替代：直接从动物名单里选 ----------
  async function enterAccessible(fresh = false) {
    state = 'loading';
    root.classList.add('is-accessible');
    try {
      if (fresh || !challenge || challenge.mode !== 'accessible') {
        if (challenge) adapter.cancelChallenge({ challengeId: challenge.challengeId }).catch(() => {});
        challenge = await adapter.createChallenge({ mode: 'accessible', signal: ac.signal });
        antiBot?.destroy?.();
        antiBot = createAntiBotProvider(challenge.antiBot?.provider);
        await antiBot.prepare({
          container: root,
          siteKey: challenge.antiBot?.siteKey,
          action: challenge.antiBot?.action,
          cData: challenge.antiBot?.cData,
        });
        ui.demo.hidden = !challenge.demo;
        startedAt = performance.now();
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      fail('暂时连不上验证服务，请稍后再试');
      return;
    }
    state = 'accessible';
    ui.sub.innerHTML = `在下面选出 ${targetLabel(challenge.target)}`;
    ui.list.innerHTML = '';
    for (const item of [...challenge.layout].sort((a, b) => a.slot - b.slot)) {
      const a = resolveAnimal(item.characterId);
      const li = el('li');
      const b = el(
        'button',
        'hv-list-btn',
        `<span class="hv-list-emoji" aria-hidden="true">${a.emoji}</span><span class="hv-list-name" style="color:${a.textColor}">${a.name}</span>`
      );
      b.type = 'button';
      b.dataset.characterId = item.characterId;
      b.dataset.animalId = a.id;
      b.addEventListener('click', () => {
        if (state !== 'accessible') return;
        state = 'submitting';
        pill('验证中…');
        submit({ slot: item.slot, characterId: item.characterId }, 'accessible');
      });
      li.appendChild(b);
      ui.list.appendChild(li);
    }
    ui.list.hidden = false;
    ui.loading.hidden = true;
    pill('点一下对应动物即可', '', ICON.list);
    setGo('抓', false);
    ui.alt.querySelector('span').textContent = '回到抓娃娃';
    ui.list.querySelector('button')?.focus();
  }

  ui.alt.addEventListener('click', () => {
    if (state === 'verified' || state === 'grabbing' || state === 'submitting') return;
    if (root.classList.contains('is-accessible') && scene) {
      root.classList.remove('is-accessible');
      ui.list.hidden = true;
      ui.alt.querySelector('span').textContent = '看不清或不方便操作？换一种方式';
      begin({ fresh: true });
    } else {
      enterAccessible(true);
    }
  });

  function close() {
    if (state === 'verified') return;
    onClose?.();
  }
  root.querySelector('.hv-close').addEventListener('click', close);

  // ---------- 启动 ----------
  (async () => {
    try {
      const { ClawScene } = await import('./claw-scene.js');
      scene = new ClawScene(ui.canvas, { reducedMotion: reduced });
      scene.start();
      raf = requestAnimationFrame(tick);
      await begin({ fresh: true });
    } catch (err) {
      console.warn('[haiz-verifier] 3D 不可用，改用名单验证', err);
      scene = null;
      ui.alt.hidden = true;
      enterAccessible(true);
    }
  })();

  return {
    element: root,
    getScene: () => scene,
    getChallenge: () => challenge,
    destroy() {
      destroyed = true;
      ac.abort();
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      if (challenge && state !== 'verified') adapter.cancelChallenge({ challengeId: challenge.challengeId }).catch(() => {});
      antiBot?.destroy?.();
      scene?.destroy();
      root.remove();
    },
  };
}
