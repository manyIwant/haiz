/**
 * HAIZ Toybox V2 — Main Human Verification Component Entry Point
 */

import { VerificationState, TOYBOX_THEMES, SHOWCASE_BOUNDS } from './constants.js';
import { VerificationStateMachine } from './stateMachine.js';
import { MockToyboxAdapter } from '../adapters/verificationAdapter.js';
import { CHARACTER_REGISTRY, getCharacterMeta } from '../toybox/characterRegistry.js';
import { ToyboxMachineScene } from '../scene/toyboxMachineScene.js';
import { ConsoleController } from '../controls/consoleControls.js';
import { SoundEngine } from '../audio/soundEngine.js';
import { MACHINE_CSS } from '../styles/machineStyles.js';

const STYLE_ID = 'haiz-toybox-v2-styles';

function injectStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = MACHINE_CSS;
  document.head.appendChild(s);
}

const ICONS = {
  soundOn: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
  soundOff: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`,
  a11y: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><path d="M5 9h14"/><path d="M12 9v11"/><path d="M9 20l3-5 3 5"/></svg>`,
  close: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
};

export function createHumanVerification(userOptions = {}) {
  const opts = {
    theme: 'porcelain',
    soundEnabled: true,
    reducedMotion: false,
    closeOnBackdrop: false,
    preserveDrawingBuffer: false,
    ...userOptions
  };

  const container = opts.container || (typeof document !== 'undefined' ? document.body : null);
  const challengeProvider = opts.challengeProvider || new MockToyboxAdapter();
  const fsm = new VerificationStateMachine(VerificationState.CLOSED);
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let reducedMotion = Boolean(opts.reducedMotion || prefersReduced);
  let accessibleMode = false;
  let currentTheme = TOYBOX_THEMES[opts.theme] ? opts.theme : 'porcelain';
  let activeChallenge = null;
  let sessionSeq = 0;
  let abortCtrl = null;
  let challengeStartMs = 0;
  let attemptIndex = 0;
  let isDestroyed = false;
  let toastTimer = null;
  let phaseTimer = null;

  const sound = new SoundEngine(opts.soundEnabled);
  let scene = null;
  let controls = null;
  let resizeObserver = null;

  injectStyles();

  const root = document.createElement('div');
  root.className = 'haiz-tb-root';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'HAIZ Toybox 人类验证');

  root.innerHTML = `
    <div class="haiz-tb-backdrop"></div>
    <div class="haiz-tb-machine">
      <div class="haiz-tb-canopy">
        <div class="haiz-tb-canopy-top">
          <span class="haiz-tb-plate">
            <span class="haiz-tb-power-led"></span>
            HAIZ TOYBOX · V2
            ${challengeProvider.isMock ? '<span class="haiz-tb-mock-badge">MOCK</span>' : ''}
          </span>
          <div class="haiz-tb-canopy-tools">
            <button type="button" class="haiz-tb-mini-btn" data-role="sound" data-tb-secondary="true" title="开关声音" aria-label="开关声音"></button>
            <button type="button" class="haiz-tb-mini-btn" data-role="a11y" data-tb-secondary="true" title="键盘无障碍验证" aria-label="键盘无障碍验证">${ICONS.a11y}</button>
            <button type="button" class="haiz-tb-mini-btn" data-role="close" data-tb-secondary="true" title="关闭" aria-label="关闭">${ICONS.close}</button>
          </div>
        </div>
        <div class="haiz-tb-marquee-row">
          <div class="haiz-tb-target-readout" data-role="prompt">正在唤醒抓娃娃机…</div>
          <div class="haiz-tb-step-leds" aria-label="步骤指示">
            <span class="haiz-tb-led-item is-active" data-step="1"><span class="haiz-tb-led-dot"></span>移动</span>
            <span class="haiz-tb-led-item" data-step="2"><span class="haiz-tb-led-dot"></span>抓取</span>
            <span class="haiz-tb-led-item" data-step="3"><span class="haiz-tb-led-dot"></span>投放</span>
          </div>
        </div>
      </div>

      <div class="haiz-tb-vitrine" data-role="vitrine">
        <canvas class="haiz-tb-canvas" data-role="canvas"></canvas>
        <div class="haiz-tb-glass-sheen"></div>
        <div class="haiz-tb-chute-pill" data-role="chutePill">奖品出口</div>
        <div class="haiz-tb-toast" data-role="toast" aria-live="polite"></div>
        <div class="haiz-tb-welcome-card" data-role="welcomeCard">
          <div class="haiz-tb-welcome-kicker" data-role="welcomeKicker">HAIZ · VERIFIED</div>
          <p class="haiz-tb-welcome-title" data-role="welcomeTitle">欢迎来到 HAIZ</p>
          <p class="haiz-tb-welcome-sub" data-role="welcomeSub"></p>
        </div>
        <div class="haiz-tb-status-veil" data-role="statusVeil"></div>
      </div>

      <div class="haiz-tb-a11y-panel" data-role="a11yPanel">
        <p class="haiz-tb-a11y-note">键盘无障碍验证通道：使用 Tab 与 Enter 直接选择目标玩偶，并通过同一套双层服务端验证接口校验。</p>
        <div class="haiz-tb-a11y-grid" data-role="a11yGrid"></div>
      </div>

      <div class="haiz-tb-deck" data-role="deck">
        <div class="haiz-tb-joystick" data-role="joystick" role="slider" aria-label="移动机械爪摇杆" tabindex="0">
          <div class="haiz-tb-joy-boot"></div>
          <div class="haiz-tb-joy-shaft" data-role="shaft"></div>
          <div class="haiz-tb-joy-knob" data-role="knob"></div>
        </div>
        <div class="haiz-tb-chute-door" data-role="chuteDoor">
          <span class="haiz-tb-chute-door-bar"></span>
          <span class="haiz-tb-chute-door-label" data-role="chuteDoorLabel">奖品出口</span>
        </div>
        <div class="haiz-tb-btn-bezel">
          <button type="button" class="haiz-tb-arcade-btn" data-role="actionBtn">抓取</button>
        </div>
      </div>

      <div class="haiz-tb-foot">
        <span>摇杆、触屏滑动或 ← → / A D 移动 · 空格键抓取与投放</span>
        <button type="button" class="haiz-tb-link-btn" data-role="a11yLink" data-tb-secondary="true">键盘辅助入口</button>
      </div>
    </div>
  `;

  if (container) container.appendChild(root);

  const q = (r) => root.querySelector(`[data-role="${r}"]`);
  const els = {
    backdrop: root.querySelector('.haiz-tb-backdrop'),
    soundBtn: q('sound'),
    a11yBtn: q('a11y'),
    closeBtn: q('close'),
    prompt: q('prompt'),
    vitrine: q('vitrine'),
    canvas: q('canvas'),
    chutePill: q('chutePill'),
    toast: q('toast'),
    welcomeCard: q('welcomeCard'),
    welcomeKicker: q('welcomeKicker'),
    welcomeTitle: q('welcomeTitle'),
    welcomeSub: q('welcomeSub'),
    statusVeil: q('statusVeil'),
    a11yPanel: q('a11yPanel'),
    a11yGrid: q('a11yGrid'),
    deck: q('deck'),
    joystick: q('joystick'),
    shaft: q('shaft'),
    knob: q('knob'),
    chuteDoor: q('chuteDoor'),
    chuteDoorLabel: q('chuteDoorLabel'),
    actionBtn: q('actionBtn'),
    a11yLink: q('a11yLink'),
    steps: Array.from(root.querySelectorAll('.haiz-tb-led-item'))
  };

  function applyThemeVars(themeId) {
    const t = TOYBOX_THEMES[themeId] || TOYBOX_THEMES.porcelain;
    currentTheme = t.id;
    root.dataset.theme = t.id;
    root.style.setProperty('--tb-backdrop', t.backdrop);
    root.style.setProperty('--tb-shell-top', t.shellTop);
    root.style.setProperty('--tb-shell-body', t.shellBody);
    root.style.setProperty('--tb-shell-trim', t.shellTrim);
    root.style.setProperty('--tb-shell-border', t.shellBorder);
    root.style.setProperty('--tb-marquee-bg', t.marqueeBg);
    root.style.setProperty('--tb-marquee-text', t.marqueeText);
    root.style.setProperty('--tb-marquee-sub', t.marqueeSub);
    root.style.setProperty('--tb-deck-bg', t.deckBg);
    root.style.setProperty('--tb-deck-inset', t.deckInset);
    root.style.setProperty('--tb-text-primary', t.textPrimary);
    root.style.setProperty('--tb-text-secondary', t.textSecondary);
    root.style.setProperty('--tb-text-muted', t.textMuted);
    root.style.setProperty('--tb-accent', t.accent);
    root.style.setProperty('--tb-accent-deep', t.accentDeep);
    root.style.setProperty('--tb-success', t.success);
    root.style.setProperty('--tb-success-bg', t.successBg);
    if (scene) scene.applyTheme(t.id);
  }

  function updateSoundBtn() {
    els.soundBtn.innerHTML = sound.enabled ? ICONS.soundOn : ICONS.soundOff;
    els.soundBtn.classList.toggle('is-active', sound.enabled);
  }

  function showToast(msg, ms = 2200) {
    if (toastTimer) clearTimeout(toastTimer);
    els.toast.textContent = msg;
    els.toast.classList.add('is-visible');
    toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), ms);
  }

  function setStatusVeil(mode, title = '', sub = '') {
    if (!mode) {
      els.statusVeil.classList.remove('is-visible');
      els.statusVeil.innerHTML = '';
      return;
    }
    if (mode === 'verifying') {
      els.statusVeil.innerHTML = `<div class="haiz-tb-spinner"></div><strong style="font-size:14px">${title}</strong><span style="font-size:12px;opacity:.75">${sub}</span>`;
    } else if (mode === 'error') {
      els.statusVeil.innerHTML = `<strong style="font-size:14px">${title}</strong><span style="font-size:12px;opacity:.75">${sub}</span><button type="button" class="haiz-tb-link-btn" data-role="retryErr" style="margin-top:6px;font-size:12.5px">重新开始</button>`;
      const b = els.statusVeil.querySelector('[data-role="retryErr"]');
      if (b) b.addEventListener('click', () => startSession());
    }
    els.statusVeil.classList.add('is-visible');
  }

  function syncUI() {
    const step = fsm.getStepIndex();
    const isSuccess = fsm.state === VerificationState.SUCCESS;
    els.steps.forEach((el) => {
      const idx = Number(el.dataset.step);
      el.classList.toggle('is-active', !isSuccess && idx === step);
      el.classList.toggle('is-done', isSuccess || idx < step);
    });
    const busy = [
      VerificationState.WAKING,
      VerificationState.DESCENDING,
      VerificationState.GRASPING,
      VerificationState.LIFTING,
      VerificationState.DROPPING,
      VerificationState.CELEBRATING,
      VerificationState.VERIFYING,
      VerificationState.SUCCESS
    ].includes(fsm.state);
    els.actionBtn.disabled = busy;
    els.actionBtn.textContent = fsm.state === VerificationState.CARRYING ? '投放' : '抓取';
  }

  function renderPrompt() {
    if (!activeChallenge) {
      els.prompt.textContent = '正在唤醒抓娃娃机…';
      return;
    }
    const meta = getCharacterMeta(activeChallenge.targetCharacterId);
    const color = meta ? meta.accentHex : '#D4573F';
    const name = meta ? meta.nameZh : activeChallenge.targetNameZh || activeChallenge.targetCharacterId;
    els.prompt.innerHTML = `<span class="haiz-tb-swatch" style="background:${color}"></span><span>请带走那只「${name}」</span>`;
  }

  function buildA11yGrid() {
    els.a11yGrid.innerHTML = '';
    CHARACTER_REGISTRY.forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'haiz-tb-a11y-btn';
      btn.innerHTML = `<span class="haiz-tb-swatch" style="background:${c.accentHex}"></span><span>${c.nameZh}</span>`;
      btn.addEventListener('click', () => {
        if (fsm.state !== VerificationState.SEEKING) return;
        sound.unlock();
        sound.playButtonClick();
        attemptIndex += 1;
        submitVerification(c.id, 'accessible');
      });
      els.a11yGrid.appendChild(btn);
    });
  }

  function toggleAccessible(force) {
    accessibleMode = typeof force === 'boolean' ? force : !accessibleMode;
    els.a11yBtn.classList.toggle('is-active', accessibleMode);
    els.a11yPanel.classList.toggle('is-visible', accessibleMode);
    els.vitrine.style.display = accessibleMode ? 'none' : '';
    els.deck.style.display = accessibleMode ? 'none' : '';
    els.a11yLink.textContent = accessibleMode ? '返回抓娃娃机' : '键盘辅助入口';
    if (accessibleMode) {
      buildA11yGrid();
      if (scene) scene.pause();
    } else if (scene && fsm.state !== VerificationState.CLOSED) {
      scene.resume();
      scene.resize();
    }
  }

  function ensureScene() {
    if (scene) return true;
    try {
      scene = new ToyboxMachineScene(els.canvas, {
        theme: currentTheme,
        reducedMotion,
        preserveDrawingBuffer: opts.preserveDrawingBuffer,
        onFrame: handleFrame
      });
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => { if (scene) scene.resize(); });
        resizeObserver.observe(els.vitrine);
      }
      return true;
    } catch (_err) {
      toggleAccessible(true);
      return false;
    }
  }

  function handleFrame(dt) {
    if (!scene) return;
    const allowMove = fsm.state === VerificationState.SEEKING || fsm.state === VerificationState.CARRYING;
    const inputX = controls ? controls.getHorizontalInput() : 0;
    const hasPayload = Boolean(scene.carriedEntry);
    const { speedRatio } = scene.kinematics.step(dt, inputX, allowMove, hasPayload);
    if (allowMove && speedRatio > 0.08) sound.updateServo(speedRatio);
    else sound.stopServo();

    const overChute = hasPayload && scene.kinematics.isOverPrizeChute();
    scene.setChuteHighlighted(overChute);
    els.chutePill.classList.toggle('is-ready', overChute);
    els.chuteDoor.classList.toggle('is-ready', overChute);
    if (fsm.state === VerificationState.CARRYING) {
      els.chuteDoorLabel.textContent = overChute ? '准备投放 · 按下松开' : '左移至出口投放';
    }
  }

  function clearTimers() { if (phaseTimer) { clearTimeout(phaseTimer); phaseTimer = null; } }
  function abortInFlight() { if (abortCtrl) { try { abortCtrl.abort(); } catch (_e) {} abortCtrl = null; } }

  function onAction() {
    if (fsm.state === VerificationState.SEEKING) startGrab();
    else if (fsm.state === VerificationState.CARRYING) startDrop();
  }

  function startGrab() {
    if (!scene || !fsm.transition(VerificationState.DESCENDING)) return;
    attemptIndex += 1;
    sound.playButtonClick();
    sound.playDescent();
    syncUI();

    scene.kinematics.targetProngOpen = 0.94;
    scene.kinematics.targetClawY = SHOWCASE_BOUNDS.grabMinY;

    clearTimers();
    phaseTimer = setTimeout(() => {
      if (isDestroyed || fsm.state !== VerificationState.DESCENDING) return;
      fsm.transition(VerificationState.GRASPING);
      const caught = scene.findCatchableCharacter();
      scene.kinematics.targetProngOpen = caught ? 0.14 : 0.04;

      phaseTimer = setTimeout(() => {
        if (isDestroyed || fsm.state !== VerificationState.GRASPING) return;
        fsm.transition(VerificationState.LIFTING);
        sound.playGrab(Boolean(caught));
        if (caught) scene.attachToClaw(caught);
        scene.kinematics.targetClawY = SHOWCASE_BOUNDS.restClawY;

        phaseTimer = setTimeout(() => {
          if (isDestroyed || fsm.state !== VerificationState.LIFTING) return;
          if (caught) {
            fsm.transition(VerificationState.CARRYING);
            syncUI();
            showToast(`抓起「${caught.meta.nameZh}」，左移至奖品出口投放`);
          } else {
            fsm.transition(VerificationState.RETRY_HINT);
            scene.kinematics.targetProngOpen = 0.30;
            sound.playSoftRetry();
            showToast('差一点点，再往玩偶上方移移看');
            phaseTimer = setTimeout(() => {
              if (isDestroyed || fsm.state !== VerificationState.RETRY_HINT) return;
              fsm.transition(VerificationState.SEEKING);
              syncUI();
            }, 480);
          }
        }, 500);
      }, 220);
    }, 480);
  }

  function startDrop() {
    if (!scene || !scene.carriedEntry) return;
    sound.playButtonClick();
    if (!scene.kinematics.isOverPrizeChute()) {
      showToast('请先向左移动至左侧「奖品出口」上方再松开');
      scene.kinematics.impulseSwing(0.22);
      return;
    }
    if (!fsm.transition(VerificationState.DROPPING)) return;
    syncUI();
    scene.kinematics.targetProngOpen = 0.94;
    sound.playDrop();
    const dropped = scene.releaseCarried(true);

    clearTimers();
    phaseTimer = setTimeout(() => {
      if (isDestroyed || fsm.state !== VerificationState.DROPPING) return;
      scene.kinematics.targetProngOpen = 0.30;
      if (!dropped) {
        fsm.transition(VerificationState.SEEKING);
        syncUI();
        return;
      }

      if (activeChallenge && dropped.id !== activeChallenge.targetCharacterId) {
        fsm.transition(VerificationState.RETRY_HINT);
        sound.playSoftRetry();
        const target = getCharacterMeta(activeChallenge.targetCharacterId);
        showToast(`这只是「${dropped.meta.nameZh}」，我们要找的是「${target ? target.nameZh : ''}」`, 2500);
        scene.returnToPile(dropped);
        els.chuteDoor.classList.remove('is-ready');
        els.chuteDoorLabel.textContent = '奖品出口';
        phaseTimer = setTimeout(() => {
          if (isDestroyed || fsm.state !== VerificationState.RETRY_HINT) return;
          fsm.transition(VerificationState.SEEKING);
          syncUI();
        }, 680);
        return;
      }

      els.chuteDoor.classList.add('is-collected');
      els.chuteDoorLabel.textContent = '已收取';
      submitVerification(dropped.id, controls ? controls.lastModality : 'joystick');
    }, 430);
  }

  async function submitVerification(selectedCharacterId, modality) {
    if (!activeChallenge) return;
    const mySession = sessionSeq;
    const meta = getCharacterMeta(selectedCharacterId);

    if (scene && !accessibleMode) {
      scene.startPopUpCelebration(selectedCharacterId);
      sound.playPopUpCelebration();
    }

    if (!fsm.transition(VerificationState.VERIFYING)) return;
    syncUI();

    els.welcomeKicker.textContent = '正在等待服务端签发凭证…';
    els.welcomeTitle.textContent = '抓到啦！';
    els.welcomeSub.textContent = meta ? meta.welcomeLineZh : '正在确认真人验证结果…';
    els.welcomeCard.classList.add('is-visible');

    abortInFlight();
    abortCtrl = new AbortController();

    try {
      const result = await challengeProvider.verifyChallenge(
        {
          challengeId: activeChallenge.challengeId,
          nonce: activeChallenge.nonce,
          selectedCharacterId,
          inputModality: modality,
          elapsedMs: Date.now() - challengeStartMs,
          attemptIndex
        },
        abortCtrl.signal
      );

      if (isDestroyed || mySession !== sessionSeq || fsm.state === VerificationState.CLOSED) return;

      if (result && result.verified === true && result.verificationToken) {
        fsm.transition(VerificationState.SUCCESS);
        syncUI();
        els.welcomeKicker.textContent = result.isMock ? 'HAIZ · MOCK DEMO VERIFIED' : 'HAIZ · VERIFIED';
        els.welcomeTitle.textContent = '欢迎来到 HAIZ';
        els.welcomeSub.textContent = meta ? meta.welcomeLineZh : '服务端验证已通过。';
        els.welcomeCard.classList.add('is-visible');
        if (typeof opts.onSuccess === 'function') {
          setTimeout(() => {
            if (!isDestroyed && mySession === sessionSeq && fsm.state === VerificationState.SUCCESS) {
              opts.onSuccess(result);
            }
          }, 1150);
        }
      } else {
        els.welcomeCard.classList.remove('is-visible');
        sound.playSoftRetry();
        const msg = (result && result.message) || '服务端验证未通过，请重试。';
        fsm.transition(VerificationState.ERROR);
        setStatusVeil('error', '服务端验证未通过', msg);
        if (typeof opts.onFailure === 'function') opts.onFailure(result || { code: 'REJECTED', message: msg });
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      if (isDestroyed || mySession !== sessionSeq) return;
      els.welcomeCard.classList.remove('is-visible');
      fsm.transition(VerificationState.ERROR);
      setStatusVeil('error', '验证连接中断', '未能连接到验证服务，请重试。');
      if (typeof opts.onFailure === 'function') opts.onFailure({ code: 'NETWORK_ERROR', message: String(err) });
    }
  }

  async function startSession() {
    sessionSeq += 1;
    const mySession = sessionSeq;
    clearTimers();
    abortInFlight();
    setStatusVeil(null);
    els.welcomeCard.classList.remove('is-visible');
    els.chuteDoor.classList.remove('is-ready', 'is-collected');
    els.chuteDoorLabel.textContent = '奖品出口';
    els.chutePill.classList.remove('is-ready');
    attemptIndex = 0;

    fsm.forceReset(VerificationState.WAKING);
    syncUI();
    els.prompt.textContent = '正在唤醒抓娃娃机…';

    if (!accessibleMode) {
      const ok = ensureScene();
      if (ok && scene) {
        scene.triggerWakeAnimation();
        scene.resume();
        scene.resize();
      }
    }

    abortCtrl = new AbortController();
    try {
      const chl = await challengeProvider.fetchChallenge(abortCtrl.signal);
      if (isDestroyed || mySession !== sessionSeq || fsm.state === VerificationState.CLOSED) return;
      activeChallenge = chl;
      challengeStartMs = Date.now();
      if (scene && Array.isArray(chl.layoutOrder)) {
        scene.applyLayout(chl.layoutOrder);
      }
      renderPrompt();
      sound.playWake();

      phaseTimer = setTimeout(() => {
        if (isDestroyed || mySession !== sessionSeq || fsm.state !== VerificationState.WAKING) return;
        fsm.transition(VerificationState.SEEKING);
        syncUI();
      }, reducedMotion ? 60 : 420);
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      if (isDestroyed || mySession !== sessionSeq) return;
      fsm.transition(VerificationState.ERROR);
      setStatusVeil('error', '无法获取挑战', err.message || '请稍后重试');
      if (typeof opts.onFailure === 'function') opts.onFailure({ code: 'FETCH_ERROR', message: String(err) });
    }
  }

  controls = new ConsoleController(
    {
      joystickEl: els.joystick,
      shaftEl: els.shaft,
      knobEl: els.knob,
      actionBtnEl: els.actionBtn,
      stageEl: els.vitrine
    },
    {
      onFirstGesture: () => sound.unlock(),
      onAction,
      onCancel: () => api.close(true)
    }
  );
  controls.setEnabled(false);

  els.soundBtn.addEventListener('click', () => {
    sound.setEnabled(!sound.enabled);
    if (sound.enabled) sound.unlock();
    updateSoundBtn();
  });
  els.a11yBtn.addEventListener('click', () => toggleAccessible());
  els.a11yLink.addEventListener('click', () => toggleAccessible());
  els.closeBtn.addEventListener('click', () => api.close(true));
  els.backdrop.addEventListener('click', () => { if (opts.closeOnBackdrop) api.close(true); });

  const onVis = () => {
    if (!scene || isDestroyed) return;
    if (document.hidden) {
      scene.pause();
      sound.stopServo();
    } else if (fsm.state !== VerificationState.CLOSED && !accessibleMode) {
      scene.resume();
    }
  };
  document.addEventListener('visibilitychange', onVis);

  applyThemeVars(currentTheme);
  updateSoundBtn();

  const api = {
    open() {
      if (isDestroyed) return;
      root.classList.add('is-open');
      controls.setEnabled(true);
      startSession();
    },
    reset() {
      if (isDestroyed) return;
      if (!root.classList.contains('is-open')) { this.open(); return; }
      startSession();
    },
    close(notifyCancel = false) {
      if (isDestroyed) return;
      clearTimers();
      abortInFlight();
      root.classList.remove('is-open');
      controls.setEnabled(false);
      sound.stopServo();
      if (scene) scene.pause();
      const wasActive = fsm.state !== VerificationState.CLOSED && fsm.state !== VerificationState.SUCCESS;
      fsm.forceReset(VerificationState.CLOSED);
      if (notifyCancel && wasActive && typeof opts.onCancel === 'function') opts.onCancel();
    },
    setTheme(themeId) { if (TOYBOX_THEMES[themeId]) applyThemeVars(themeId); },
    setReducedMotion(flag) { reducedMotion = Boolean(flag); if (scene) scene.setReducedMotion(reducedMotion); },
    getState() {
      return {
        state: fsm.state,
        theme: currentTheme,
        accessibleMode,
        challengeId: activeChallenge ? activeChallenge.challengeId : null,
        targetCharacterId: activeChallenge ? activeChallenge.targetCharacterId : null
      };
    },
    _getScene() { return scene; },
    _forceShowcaseCelebration(charId) {
      if (!scene) return;
      const id = charId || (activeChallenge && activeChallenge.targetCharacterId) || 'lanren-spirit';
      const meta = getCharacterMeta(id);
      scene.startPopUpCelebration(id);
      els.chuteDoor.classList.add('is-collected');
      els.chuteDoorLabel.textContent = '已收取';
      els.welcomeKicker.textContent = 'HAIZ · VERIFIED';
      els.welcomeTitle.textContent = '欢迎来到 HAIZ';
      els.welcomeSub.textContent = meta ? meta.welcomeLineZh : '欢迎来到 HAIZ。';
      els.welcomeCard.classList.add('is-visible');
      fsm.forceReset(VerificationState.SUCCESS);
      syncUI();
    },
    destroy() {
      if (isDestroyed) return;
      isDestroyed = true;
      clearTimers();
      abortInFlight();
      if (toastTimer) clearTimeout(toastTimer);
      document.removeEventListener('visibilitychange', onVis);
      if (resizeObserver) resizeObserver.disconnect();
      if (controls) controls.destroy();
      if (scene) scene.destroy();
      sound.destroy();
      if (root.parentNode) root.parentNode.removeChild(root);
    }
  };

  return api;
}
