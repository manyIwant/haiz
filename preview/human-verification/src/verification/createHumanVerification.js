/**
 * HAIZ Human Verification — Main Component Entry Point
 *
 * Public API:
 *   const verification = createHumanVerification({
 *     container: document.body,
 *     theme: 'porcelain' | 'obsidian' | 'ocean',
 *     challengeProvider,
 *     THREE, // optional: falls back to globalThis.THREE
 *     onSuccess: (result) => {},
 *     onFailure: (error) => {},
 *     onCancel: () => {}
 *   });
 *   verification.open();
 *   verification.reset();
 *   verification.close();
 *   verification.destroy();
 */

import { VerificationState, THEMES, CABINET_BOUNDS, DEFAULT_OPTIONS } from './constants.js';
import { VerificationStateMachine } from './stateMachine.js';
import { MockChallengeAdapter } from '../adapters/challengeAdapter.js';
import { PLUSH_CATALOG, getPlushById } from '../models/plushCatalog.js';
import { ClawMachineScene } from '../scene/clawMachineScene.js';
import { ConsoleController } from '../controls/consoleControls.js';
import { SoundEngine } from '../audio/soundEngine.js';
import { COMPONENT_CSS } from '../styles/componentStyles.js';

const STYLE_TAG_ID = 'haiz-hv-scoped-styles';

function ensureStylesInjected() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_TAG_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_TAG_ID;
  style.textContent = COMPONENT_CSS;
  document.head.appendChild(style);
}

const ICONS = {
  soundOn: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
  soundOff: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`,
  a11y: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><path d="M5 9h14"/><path d="M12 9v11"/><path d="M9 20l3-5 3 5"/></svg>`,
  close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  tray: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>`,
  check: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
};

export function createHumanVerification(userOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...userOptions };
  const container = opts.container || (typeof document !== 'undefined' ? document.body : null);
  const THREE = opts.THREE || (typeof globalThis !== 'undefined' ? globalThis.THREE : null);

  const challengeProvider = opts.challengeProvider || new MockChallengeAdapter();
  const fsm = new VerificationStateMachine(VerificationState.CLOSED);
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let reducedMotion = Boolean(opts.reducedMotion || prefersReduced);
  let accessibleMode = false;
  let currentTheme = THEMES[opts.theme] ? opts.theme : 'porcelain';
  let activeChallenge = null;
  let challengeStartMs = 0;
  let attemptIndex = 0;
  let moveSamplesCount = 0;
  let isDestroyed = false;
  let toastTimer = null;
  let phaseTimer = null;

  const sound = new SoundEngine(opts.soundEnabled);
  let scene = null;
  let controls = null;
  let resizeObserver = null;

  ensureStylesInjected();

  // Build isolated component DOM
  const root = document.createElement('div');
  root.className = 'haiz-hv-root';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'HAIZ 人类验证');
  root.innerHTML = `
    <div class="haiz-hv-backdrop"></div>
    <div class="haiz-hv-dialog">
      <div class="haiz-hv-topbar">
        <span class="haiz-hv-brand-tag">
          HAIZ VERIFY
          ${challengeProvider.isMock ? '<span class="haiz-hv-mock-pill">MOCK DEMO</span>' : ''}
        </span>
        <div class="haiz-hv-tools">
          <button type="button" class="haiz-hv-icon-btn" data-role="sound" data-hv-secondary="true" title="开关声音" aria-label="开关声音"></button>
          <button type="button" class="haiz-hv-icon-btn" data-role="a11y" data-hv-secondary="true" title="键盘无障碍模式" aria-label="切换键盘无障碍模式">${ICONS.a11y}</button>
          <button type="button" class="haiz-hv-icon-btn" data-role="close" data-hv-secondary="true" title="关闭" aria-label="关闭验证">${ICONS.close}</button>
        </div>
      </div>

      <div class="haiz-hv-header">
        <h2 class="haiz-hv-title">请验证您是人类</h2>
        <p class="haiz-hv-prompt" data-role="prompt">正在唤醒机械爪…</p>
      </div>

      <div class="haiz-hv-steps" aria-label="验证步骤">
        <div class="haiz-hv-step is-active" data-step="1"><span class="haiz-hv-step-num">1</span>移动</div>
        <div class="haiz-hv-step" data-step="2"><span class="haiz-hv-step-num">2</span>抓取</div>
        <div class="haiz-hv-step" data-step="3"><span class="haiz-hv-step-num">3</span>投放</div>
      </div>

      <div class="haiz-hv-stage-frame" data-role="stageFrame">
        <canvas class="haiz-hv-canvas" data-role="canvas"></canvas>
        <div class="haiz-hv-glass-overlay"></div>
        <div class="haiz-hv-chute-tag" data-role="chuteTag">奖品位</div>
        <div class="haiz-hv-toast" data-role="toast" aria-live="polite"></div>
        <div class="haiz-hv-state-overlay" data-role="overlay"></div>
      </div>

      <div class="haiz-hv-a11y-panel" data-role="a11yPanel">
        <p class="haiz-hv-a11y-note">无障碍键盘模式：使用 Tab / Enter 直接选择目标玩偶，并通过同一套服务端验证通道提交。</p>
        <div class="haiz-hv-a11y-grid" data-role="a11yGrid"></div>
      </div>

      <div class="haiz-hv-console" data-role="console">
        <div class="haiz-hv-joystick" data-role="joystick" role="slider" aria-label="移动机械爪摇杆" tabindex="0">
          <div class="haiz-hv-joystick-boot"></div>
          <div class="haiz-hv-joystick-shaft" data-role="shaft"></div>
          <div class="haiz-hv-joystick-knob" data-role="knob"></div>
        </div>
        <div class="haiz-hv-prize-slot" data-role="prizeSlot">
          ${ICONS.tray}
          <span data-role="prizeSlotText">奖品位</span>
        </div>
        <div class="haiz-hv-push-btn-well">
          <button type="button" class="haiz-hv-push-btn" data-role="actionBtn">抓取</button>
        </div>
      </div>

      <div class="haiz-hv-footer">
        <span data-role="hint">摇杆或 ← → / A D 移动，空格键抓取与投放</span>
        <button type="button" class="haiz-hv-footer-link" data-role="a11yToggleText" data-hv-secondary="true">键盘辅助验证</button>
      </div>
    </div>
  `;

  if (container) {
    container.appendChild(root);
  }

  const q = (role) => root.querySelector(`[data-role="${role}"]`);
  const els = {
    backdrop: root.querySelector('.haiz-hv-backdrop'),
    soundBtn: q('sound'),
    a11yBtn: q('a11y'),
    closeBtn: q('close'),
    prompt: q('prompt'),
    stageFrame: q('stageFrame'),
    canvas: q('canvas'),
    chuteTag: q('chuteTag'),
    toast: q('toast'),
    overlay: q('overlay'),
    a11yPanel: q('a11yPanel'),
    a11yGrid: q('a11yGrid'),
    consoleEl: q('console'),
    joystick: q('joystick'),
    shaft: q('shaft'),
    knob: q('knob'),
    prizeSlot: q('prizeSlot'),
    prizeSlotText: q('prizeSlotText'),
    actionBtn: q('actionBtn'),
    a11yToggleText: q('a11yToggleText'),
    steps: Array.from(root.querySelectorAll('.haiz-hv-step'))
  };

  function applyThemeVars(themeId) {
    const t = THEMES[themeId] || THEMES.porcelain;
    currentTheme = t.id;
    root.dataset.theme = t.id;
    root.style.setProperty('--hv-backdrop', t.backdrop);
    root.style.setProperty('--hv-card-bg', t.cardBg);
    root.style.setProperty('--hv-card-border', t.cardBorder);
    root.style.setProperty('--hv-card-shadow', t.cardShadow);
    root.style.setProperty('--hv-text-primary', t.textPrimary);
    root.style.setProperty('--hv-text-secondary', t.textSecondary);
    root.style.setProperty('--hv-text-muted', t.textMuted);
    root.style.setProperty('--hv-surface-subtle', t.surfaceSubtle);
    root.style.setProperty('--hv-surface-well', t.surfaceWell);
    root.style.setProperty('--hv-pill-active-bg', t.pillActiveBg);
    root.style.setProperty('--hv-pill-active-shadow', t.pillActiveShadow);
    root.style.setProperty('--hv-accent', t.accent);
    root.style.setProperty('--hv-accent-hover', t.accentHover);
    root.style.setProperty('--hv-accent-glow', t.accentGlow);
    root.style.setProperty('--hv-success', t.success);
    root.style.setProperty('--hv-success-bg', t.successBg);
    root.style.setProperty('--hv-success-border', t.successBorder);
    if (scene) scene.applyTheme(t.id);
  }

  function updateSoundIcon() {
    els.soundBtn.innerHTML = sound.enabled ? ICONS.soundOn : ICONS.soundOff;
    els.soundBtn.classList.toggle('is-active', sound.enabled);
  }

  function showToast(msg, duration = 2200) {
    if (toastTimer) clearTimeout(toastTimer);
    els.toast.textContent = msg;
    els.toast.classList.add('is-visible');
    toastTimer = setTimeout(() => {
      els.toast.classList.remove('is-visible');
    }, duration);
  }

  function setOverlay(mode, title = '', sub = '') {
    if (!mode) {
      els.overlay.classList.remove('is-visible');
      els.overlay.innerHTML = '';
      return;
    }
    if (mode === 'verifying') {
      els.overlay.innerHTML = `
        <div class="haiz-hv-spinner"></div>
        <div class="haiz-hv-overlay-title">${title || '正在确认验证结果…'}</div>
        <div class="haiz-hv-overlay-sub">${sub || '等待服务端签发验证凭证'}</div>
      `;
    } else if (mode === 'success') {
      els.overlay.innerHTML = `
        <div class="haiz-hv-check-ring">${ICONS.check}</div>
        <div class="haiz-hv-overlay-title">${title || '抓到啦，欢迎来到 HAIZ。'}</div>
        <div class="haiz-hv-overlay-sub">${sub || '服务端验证已通过'}</div>
      `;
    } else if (mode === 'error') {
      els.overlay.innerHTML = `
        <div class="haiz-hv-overlay-title">${title || '验证暂时中断'}</div>
        <div class="haiz-hv-overlay-sub">${sub || '请点击重试'}</div>
        <button type="button" class="haiz-hv-footer-link" data-role="retryErrBtn" style="margin-top:6px;font-size:13px;">重新获取挑战</button>
      `;
      const retryBtn = els.overlay.querySelector('[data-role="retryErrBtn"]');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => startChallenge());
      }
    }
    els.overlay.classList.add('is-visible');
  }

  function syncStepUI() {
    const activeStep = fsm.getStepIndex();
    const isSuccess = fsm.state === VerificationState.SUCCESS;
    els.steps.forEach((el) => {
      const idx = Number(el.dataset.step);
      el.classList.toggle('is-active', !isSuccess && idx === activeStep);
      el.classList.toggle('is-done', isSuccess || idx < activeStep);
    });

    const state = fsm.state;
    const isBusy =
      state === VerificationState.WAKING ||
      state === VerificationState.DESCENDING ||
      state === VerificationState.GRASPING ||
      state === VerificationState.LIFTING ||
      state === VerificationState.DROPPING ||
      state === VerificationState.VERIFYING ||
      state === VerificationState.SUCCESS;

    els.actionBtn.disabled = isBusy;
    if (state === VerificationState.CARRYING) {
      els.actionBtn.textContent = '投放';
    } else {
      els.actionBtn.textContent = '抓取';
    }
  }

  function renderPrompt() {
    if (!activeChallenge) {
      els.prompt.textContent = '正在唤醒机械爪…';
      return;
    }
    const target = getPlushById(activeChallenge.targetPlushId);
    const swatchColor = target ? target.accentHex : '#E25B4A';
    const targetName = target ? target.nameZh : activeChallenge.targetLabel || activeChallenge.targetPlushId;
    els.prompt.innerHTML = `请带走那只 <span class="haiz-hv-target-swatch" style="background:${swatchColor}"></span><span class="haiz-hv-target-name">${targetName}</span>`;
  }

  function buildA11yGrid() {
    els.a11yGrid.innerHTML = '';
    PLUSH_CATALOG.forEach((plush) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'haiz-hv-a11y-option';
      btn.innerHTML = `<span class="haiz-hv-target-swatch" style="background:${plush.accentHex}"></span><span>${plush.nameZh}</span>`;
      btn.addEventListener('click', () => {
        if (fsm.state !== VerificationState.SEEKING) return;
        sound.unlock();
        sound.playButtonClick();
        attemptIndex += 1;
        submitToServer(plush.id, 'accessible');
      });
      els.a11yGrid.appendChild(btn);
    });
  }

  function toggleAccessibleMode(forceValue) {
    accessibleMode = typeof forceValue === 'boolean' ? forceValue : !accessibleMode;
    els.a11yBtn.classList.toggle('is-active', accessibleMode);
    els.a11yPanel.classList.toggle('is-visible', accessibleMode);
    els.stageFrame.style.display = accessibleMode ? 'none' : '';
    els.consoleEl.style.display = accessibleMode ? 'none' : '';
    els.a11yToggleText.textContent = accessibleMode ? '返回抓娃娃机' : '键盘辅助验证';
    if (accessibleMode) {
      buildA11yGrid();
      if (scene) scene.pause();
    } else if (scene && fsm.state !== VerificationState.CLOSED) {
      scene.resume();
      scene.resize();
    }
  }

  function ensureSceneInitialized() {
    if (scene) return true;
    if (!THREE) {
      // Graceful fallback to keyboard-accessible mode if WebGL/Three.js is unavailable
      toggleAccessibleMode(true);
      return false;
    }
    try {
      scene = new ClawMachineScene(THREE, els.canvas, {
        theme: currentTheme,
        reducedMotion,
        onFrame: handleSceneFrame
      });
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (scene) scene.resize();
        });
        resizeObserver.observe(els.stageFrame);
      }
      return true;
    } catch (_err) {
      toggleAccessibleMode(true);
      return false;
    }
  }

  function handleSceneFrame(dt) {
    if (!scene) return;
    const state = fsm.state;
    const allowMove = state === VerificationState.SEEKING || state === VerificationState.CARRYING;
    const inputX = controls ? controls.getHorizontalInput() : 0;
    const hasPayload = Boolean(scene.carriedEntry);

    const { speedRatio } = scene.kinematics.step(dt, inputX, allowMove, hasPayload);
    if (allowMove && speedRatio > 0.08) {
      sound.updateServo(speedRatio);
    } else {
      sound.stopServo();
    }

    const overChute = hasPayload && scene.kinematics.isOverPrizeChute();
    scene.setChuteHighlighted(overChute);
    els.chuteTag.classList.toggle('is-ready', overChute);
    els.prizeSlot.classList.toggle('is-ready', overChute);
    if (state === VerificationState.CARRYING) {
      els.prizeSlotText.textContent = overChute ? '准备投放 · 按下松开' : '向左移至奖品位';
    }
  }

  function clearPhaseTimer() {
    if (phaseTimer) {
      clearTimeout(phaseTimer);
      phaseTimer = null;
    }
  }

  function handleActionButton() {
    if (fsm.state === VerificationState.SEEKING) {
      beginGrabSequence();
    } else if (fsm.state === VerificationState.CARRYING) {
      beginDropSequence();
    }
  }

  function beginGrabSequence() {
    if (!scene || !fsm.transition(VerificationState.DESCENDING)) return;
    attemptIndex += 1;
    sound.playButtonClick();
    sound.playDescent();
    syncStepUI();

    scene.kinematics.targetProngOpen = 0.92;
    scene.kinematics.targetClawY = CABINET_BOUNDS.grabMinY;

    clearPhaseTimer();
    phaseTimer = setTimeout(() => {
      if (isDestroyed || fsm.state !== VerificationState.DESCENDING) return;
      fsm.transition(VerificationState.GRASPING);
      const caught = scene.findCatchablePlush();
      scene.kinematics.targetProngOpen = caught ? 0.14 : 0.04;

      phaseTimer = setTimeout(() => {
        if (isDestroyed || fsm.state !== VerificationState.GRASPING) return;
        fsm.transition(VerificationState.LIFTING);
        sound.playGrab(Boolean(caught));
        if (caught) {
          scene.attachPlushToClaw(caught);
        }
        scene.kinematics.targetClawY = CABINET_BOUNDS.restClawY;

        phaseTimer = setTimeout(() => {
          if (isDestroyed || fsm.state !== VerificationState.LIFTING) return;
          if (caught) {
            fsm.transition(VerificationState.CARRYING);
            syncStepUI();
            showToast(`已抓起「${caught.meta.nameZh}」，移至左侧奖品位投放`);
          } else {
            fsm.transition(VerificationState.RETRY_HINT);
            scene.kinematics.targetProngOpen = 0.28;
            sound.playSoftRetry();
            showToast('差一点点，再往玩偶上方移移看');
            phaseTimer = setTimeout(() => {
              if (isDestroyed || fsm.state !== VerificationState.RETRY_HINT) return;
              fsm.transition(VerificationState.SEEKING);
              syncStepUI();
            }, 520);
          }
        }, 560);
      }, 240);
    }, 520);
  }

  function beginDropSequence() {
    if (!scene || !scene.carriedEntry) return;
    sound.playButtonClick();

    const overChute = scene.kinematics.isOverPrizeChute();
    if (!overChute) {
      // Gentle guidance: move left to the prize chute before dropping
      showToast('请先向左移动至左侧发光的「奖品位」上方再松开');
      scene.kinematics.impulseSwing(0.24);
      return;
    }

    if (!fsm.transition(VerificationState.DROPPING)) return;
    syncStepUI();
    scene.kinematics.targetProngOpen = 0.92;
    sound.playDrop();
    const dropped = scene.releaseCarriedPlush(true);

    clearPhaseTimer();
    phaseTimer = setTimeout(() => {
      if (isDestroyed || fsm.state !== VerificationState.DROPPING) return;
      scene.kinematics.targetProngOpen = 0.28;

      if (!dropped) {
        fsm.transition(VerificationState.SEEKING);
        syncStepUI();
        return;
      }

      // Check local target match only to give immediate gentle tactile feedback;
      // server still performs authoritative verification!
      if (activeChallenge && dropped.id !== activeChallenge.targetPlushId) {
        fsm.transition(VerificationState.RETRY_HINT);
        sound.playSoftRetry();
        const target = getPlushById(activeChallenge.targetPlushId);
        showToast(`这只是「${dropped.meta.nameZh}」，我们需要的是「${target ? target.nameZh : ''}」`, 2600);
        scene.returnPlushToPile(dropped);
        els.prizeSlot.classList.remove('is-ready');
        els.prizeSlotText.textContent = '奖品位';
        phaseTimer = setTimeout(() => {
          if (isDestroyed || fsm.state !== VerificationState.RETRY_HINT) return;
          fsm.transition(VerificationState.SEEKING);
          syncStepUI();
        }, 720);
        return;
      }

      els.prizeSlot.classList.add('is-collected');
      els.prizeSlotText.textContent = '已收取';
      submitToServer(dropped.id, controls ? controls.lastModality : 'joystick');
    }, 460);
  }

  async function submitToServer(selectedPlushId, modality) {
    if (!activeChallenge) return;
    if (!fsm.transition(VerificationState.VERIFYING)) return;
    syncStepUI();
    setOverlay('verifying', '正在等待服务端验证…', '前端抓取仅代表交互完成，由服务端签发最终凭证');

    try {
      const result = await challengeProvider.verifyAttempt({
        challengeId: activeChallenge.challengeId,
        nonce: activeChallenge.nonce,
        selectedPlushId,
        inputModality: modality,
        elapsedMs: Date.now() - challengeStartMs,
        moveSamplesCount,
        attemptIndex
      });

      if (isDestroyed || fsm.state === VerificationState.CLOSED) return;

      if (result && result.verified === true && result.verificationToken) {
        fsm.transition(VerificationState.SUCCESS);
        syncStepUI();
        sound.playSuccess();
        setOverlay('success', result.message || '抓到啦，欢迎来到 HAIZ。', result.isMock ? '演示模式已模拟签发 Mock Token' : '验证已通过，正在返回登录');
        if (typeof opts.onSuccess === 'function') {
          setTimeout(() => {
            if (!isDestroyed && fsm.state === VerificationState.SUCCESS) {
              opts.onSuccess(result);
            }
          }, 920);
        }
      } else {
        sound.playSoftRetry();
        const msg = (result && result.message) || '验证未通过，请再试一次。';
        if (result && result.code === 'WRONG_TARGET') {
          setOverlay(null);
          fsm.transition(VerificationState.RETRY_HINT);
          showToast(msg, 2600);
          setTimeout(() => {
            if (!isDestroyed && fsm.state === VerificationState.RETRY_HINT) {
              fsm.transition(VerificationState.SEEKING);
              syncStepUI();
            }
          }, 600);
        } else {
          fsm.transition(VerificationState.ERROR);
          setOverlay('error', '服务端验证未通过', msg);
          if (typeof opts.onFailure === 'function') {
            opts.onFailure(result || { code: 'REJECTED', message: msg });
          }
        }
      }
    } catch (err) {
      if (isDestroyed || fsm.state === VerificationState.CLOSED) return;
      fsm.transition(VerificationState.ERROR);
      setOverlay('error', '网络连接异常', '未能连接到验证服务，请重试。');
      if (typeof opts.onFailure === 'function') {
        opts.onFailure({ code: 'NETWORK_ERROR', message: err.message || String(err) });
      }
    }
  }

  async function startChallenge() {
    clearPhaseTimer();
    setOverlay(null);
    els.prizeSlot.classList.remove('is-ready', 'is-collected');
    els.prizeSlotText.textContent = '奖品位';
    els.chuteTag.classList.remove('is-ready');
    attemptIndex = 0;
    moveSamplesCount = 0;

    fsm.forceReset(VerificationState.WAKING);
    syncStepUI();
    els.prompt.textContent = '正在唤醒机械爪…';

    if (!accessibleMode) {
      const ok = ensureSceneInitialized();
      if (ok && scene) {
        scene.triggerWakeAnimation();
        scene.resume();
        scene.resize();
      }
    }

    try {
      activeChallenge = await challengeProvider.fetchChallenge();
      if (isDestroyed || fsm.state === VerificationState.CLOSED) return;
      challengeStartMs = Date.now();
      renderPrompt();
      sound.playWake();

      phaseTimer = setTimeout(() => {
        if (isDestroyed || fsm.state !== VerificationState.WAKING) return;
        fsm.transition(VerificationState.SEEKING);
        syncStepUI();
      }, reducedMotion ? 80 : 480);
    } catch (err) {
      if (isDestroyed || fsm.state === VerificationState.CLOSED) return;
      fsm.transition(VerificationState.ERROR);
      setOverlay('error', '获取验证挑战失败', err.message || '请稍后重试');
      if (typeof opts.onFailure === 'function') {
        opts.onFailure({ code: 'CHALLENGE_FETCH_ERROR', message: err.message || String(err) });
      }
    }
  }

  // Bind UI controls
  controls = new ConsoleController(
    {
      joystickEl: els.joystick,
      joystickShaftEl: els.shaft,
      joystickKnobEl: els.knob,
      actionBtnEl: els.actionBtn,
      stageEl: els.stageFrame
    },
    {
      onFirstGesture: () => sound.unlock(),
      onAction: handleActionButton,
      onCancel: () => api.close(true),
      onInputSample: () => {
        moveSamplesCount += 1;
      }
    }
  );
  controls.setEnabled(false);

  els.soundBtn.addEventListener('click', () => {
    sound.setEnabled(!sound.enabled);
    if (sound.enabled) sound.unlock();
    updateSoundIcon();
  });

  els.a11yBtn.addEventListener('click', () => toggleAccessibleMode());
  els.a11yToggleText.addEventListener('click', () => toggleAccessibleMode());
  els.closeBtn.addEventListener('click', () => api.close(true));
  els.backdrop.addEventListener('click', () => {
    if (opts.closeOnBackdrop) api.close(true);
  });

  // Pause WebGL render loop automatically when browser tab is hidden
  const handleVisibilityChange = () => {
    if (!scene || isDestroyed) return;
    if (document.hidden) {
      scene.pause();
      sound.stopServo();
    } else if (fsm.state !== VerificationState.CLOSED && !accessibleMode) {
      scene.resume();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  applyThemeVars(currentTheme);
  updateSoundIcon();

  const api = {
    open() {
      if (isDestroyed) return;
      root.classList.add('is-open');
      controls.setEnabled(true);
      startChallenge();
    },

    reset() {
      if (isDestroyed) return;
      if (!root.classList.contains('is-open')) {
        this.open();
        return;
      }
      startChallenge();
    },

    close(notifyCancel = false) {
      if (isDestroyed) return;
      clearPhaseTimer();
      root.classList.remove('is-open');
      controls.setEnabled(false);
      sound.stopServo();
      if (scene) scene.pause();
      const wasActive = fsm.state !== VerificationState.CLOSED && fsm.state !== VerificationState.SUCCESS;
      fsm.forceReset(VerificationState.CLOSED);
      if (notifyCancel && wasActive && typeof opts.onCancel === 'function') {
        opts.onCancel();
      }
    },

    setTheme(themeId) {
      if (THEMES[themeId]) {
        applyThemeVars(themeId);
      }
    },

    setReducedMotion(flag) {
      reducedMotion = Boolean(flag);
      if (scene) scene.setReducedMotion(reducedMotion);
    },

    getState() {
      return {
        state: fsm.state,
        theme: currentTheme,
        accessibleMode,
        challengeId: activeChallenge ? activeChallenge.challengeId : null
      };
    },

    destroy() {
      if (isDestroyed) return;
      isDestroyed = true;
      clearPhaseTimer();
      if (toastTimer) clearTimeout(toastTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (controls) controls.destroy();
      if (scene) scene.destroy();
      sound.destroy();
      if (root.parentNode) root.parentNode.removeChild(root);
    }
  };

  return api;
}
