/**
 * HAIZ Human Verification — Scoped Component Stylesheet (Porcelain / Obsidian / Ocean)
 * All selectors are strictly prefixed with `.haiz-hv-` to prevent host CSS pollution.
 */

export const COMPONENT_CSS = `
.haiz-hv-root {
  --hv-backdrop: rgba(18, 22, 28, 0.52);
  --hv-card-bg: #F9F9F7;
  --hv-card-border: rgba(20, 24, 31, 0.08);
  --hv-card-shadow: 0 28px 72px rgba(15, 23, 36, 0.24), 0 4px 16px rgba(15, 23, 36, 0.08);
  --hv-text-primary: #1A1D23;
  --hv-text-secondary: #666E7A;
  --hv-text-muted: #8F97A3;
  --hv-surface-subtle: #EFEFEF;
  --hv-surface-well: #E8E9EC;
  --hv-pill-active-bg: #FFFFFF;
  --hv-pill-active-shadow: 0 1px 4px rgba(16, 20, 28, 0.10);
  --hv-accent: #E25B4A;
  --hv-accent-hover: #D34B3A;
  --hv-accent-glow: rgba(226, 91, 74, 0.28);
  --hv-success: #1F9D68;
  --hv-success-bg: #E7F6EE;
  --hv-success-border: #B7E4CE;

  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Inter", sans-serif;
  -webkit-font-smoothing: antialiased;
  box-sizing: border-box;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.haiz-hv-root *, .haiz-hv-root *::before, .haiz-hv-root *::after {
  box-sizing: border-box;
}

.haiz-hv-root.is-open {
  opacity: 1;
  pointer-events: auto;
}

.haiz-hv-backdrop {
  position: absolute;
  inset: 0;
  background: var(--hv-backdrop);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.haiz-hv-dialog {
  position: relative;
  width: 100%;
  max-width: 448px;
  background: var(--hv-card-bg);
  border: 1px solid var(--hv-card-border);
  border-radius: 26px;
  box-shadow: var(--hv-card-shadow);
  padding: 22px 22px 18px;
  color: var(--hv-text-primary);
  transform: translateY(18px) scale(0.96);
  transition: transform 0.38s cubic-bezier(0.22, 1, 0.36, 1);
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}

.haiz-hv-root.is-open .haiz-hv-dialog {
  transform: translateY(0) scale(1);
}

.haiz-hv-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.haiz-hv-brand-tag {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--hv-text-muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.haiz-hv-mock-pill {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 99px;
  background: var(--hv-surface-subtle);
  color: var(--hv-text-secondary);
  letter-spacing: 0.04em;
}

.haiz-hv-tools {
  display: flex;
  align-items: center;
  gap: 6px;
}

.haiz-hv-icon-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--hv-card-border);
  background: var(--hv-surface-subtle);
  color: var(--hv-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background 0.16s ease, color 0.16s ease, transform 0.12s ease;
}

.haiz-hv-icon-btn:hover {
  color: var(--hv-text-primary);
  background: var(--hv-surface-well);
}

.haiz-hv-icon-btn:active {
  transform: scale(0.93);
}

.haiz-hv-icon-btn.is-active {
  background: var(--hv-pill-active-bg);
  color: var(--hv-text-primary);
  box-shadow: var(--hv-pill-active-shadow);
}

.haiz-hv-header {
  text-align: center;
  margin-bottom: 14px;
}

.haiz-hv-title {
  margin: 0;
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--hv-text-primary);
}

.haiz-hv-prompt {
  margin: 6px 0 0;
  font-size: 13.5px;
  color: var(--hv-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 22px;
}

.haiz-hv-target-swatch {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  display: inline-block;
  box-shadow: inset 0 -1px 2px rgba(0, 0, 0, 0.22), 0 0 0 2px var(--hv-surface-subtle);
  flex-shrink: 0;
}

.haiz-hv-target-name {
  font-weight: 600;
  color: var(--hv-text-primary);
}

/* 3-Step Indicator */
.haiz-hv-steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  background: var(--hv-surface-subtle);
  border-radius: 12px;
  padding: 3px;
  margin-bottom: 14px;
}

.haiz-hv-step {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
  border-radius: 9px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--hv-text-muted);
  transition: background 0.22s ease, color 0.22s ease, box-shadow 0.22s ease;
}

.haiz-hv-step-num {
  width: 17px;
  height: 17px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 650;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(128, 136, 148, 0.16);
  color: inherit;
}

.haiz-hv-step.is-active {
  background: var(--hv-pill-active-bg);
  color: var(--hv-text-primary);
  font-weight: 600;
  box-shadow: var(--hv-pill-active-shadow);
}

.haiz-hv-step.is-active .haiz-hv-step-num {
  background: var(--hv-text-primary);
  color: var(--hv-card-bg);
}

.haiz-hv-step.is-done {
  color: var(--hv-success);
}

.haiz-hv-step.is-done .haiz-hv-step-num {
  background: var(--hv-success-bg);
  color: var(--hv-success);
}

/* 3D Glass Cabinet Stage */
.haiz-hv-stage-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10.6;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid var(--hv-card-border);
  box-shadow:
    inset 0 2px 10px rgba(0, 0, 0, 0.08),
    inset 0 0 0 1px rgba(255, 255, 255, 0.24);
  touch-action: none;
  background: var(--hv-surface-well);
}

.haiz-hv-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

/* Subtle glass vignette & cabinet inner bezel */
.haiz-hv-glass-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: 18px;
  box-shadow: inset 0 0 26px rgba(0, 0, 0, 0.05);
}

/* Subtle chute guide label inside glass */
.haiz-hv-chute-tag {
  position: absolute;
  left: 12px;
  bottom: 10px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 3px 8px;
  border-radius: 99px;
  background: rgba(24, 28, 36, 0.56);
  color: #f4f6f9;
  backdrop-filter: blur(4px);
  pointer-events: none;
  opacity: 0.72;
  transition: opacity 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.haiz-hv-chute-tag.is-ready {
  opacity: 1;
  background: var(--hv-success);
  transform: translateY(-2px);
}

/* Status Toast inside Stage (non-intrusive) */
.haiz-hv-toast {
  position: absolute;
  left: 50%;
  top: 12px;
  transform: translateX(-50%) translateY(-8px);
  background: rgba(22, 26, 33, 0.84);
  color: #f6f7f9;
  font-size: 12px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 99px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  backdrop-filter: blur(8px);
  transition: opacity 0.22s ease, transform 0.22s ease;
  z-index: 4;
}

.haiz-hv-toast.is-visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* Verifying / Success Overlay inside Stage */
.haiz-hv-state-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(249, 249, 247, 0.84);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.28s ease;
  z-index: 6;
  text-align: center;
  padding: 20px;
}

.haiz-hv-root[data-theme="obsidian"] .haiz-hv-state-overlay {
  background: rgba(22, 24, 29, 0.86);
}

.haiz-hv-root[data-theme="ocean"] .haiz-hv-state-overlay {
  background: rgba(243, 247, 250, 0.86);
}

.haiz-hv-state-overlay.is-visible {
  opacity: 1;
  pointer-events: auto;
}

.haiz-hv-check-ring {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--hv-success-bg);
  border: 1.5px solid var(--hv-success-border);
  color: var(--hv-success);
  display: flex;
  align-items: center;
  justify-content: center;
  transform: scale(0.84);
  transition: transform 0.36s cubic-bezier(0.22, 1, 0.36, 1);
}

.haiz-hv-state-overlay.is-visible .haiz-hv-check-ring {
  transform: scale(1);
}

.haiz-hv-spinner {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2.5px solid var(--hv-surface-well);
  border-top-color: var(--hv-text-primary);
  animation: haiz-hv-spin 0.75s linear infinite;
}

@keyframes haiz-hv-spin {
  to { transform: rotate(360deg); }
}

.haiz-hv-overlay-title {
  font-size: 15px;
  font-weight: 650;
  color: var(--hv-text-primary);
}

.haiz-hv-overlay-sub {
  font-size: 12.5px;
  color: var(--hv-text-secondary);
}

/* Physical Mechanical Console Deck */
.haiz-hv-console {
  display: grid;
  grid-template-columns: 76px 1fr 78px;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 18px;
  background: var(--hv-surface-subtle);
  border: 1px solid var(--hv-card-border);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

/* Physical Joystick */
.haiz-hv-joystick {
  position: relative;
  width: 64px;
  height: 64px;
  margin: 0 auto;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 42%, var(--hv-surface-well) 0%, rgba(16, 20, 28, 0.16) 100%);
  border: 1px solid var(--hv-card-border);
  box-shadow: inset 0 3px 8px rgba(0, 0, 0, 0.16), 0 1px 0 rgba(255, 255, 255, 0.45);
  touch-action: none;
  cursor: grab;
}

.haiz-hv-joystick:active {
  cursor: grabbing;
}

.haiz-hv-joystick-boot {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: #232730;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.35);
}

.haiz-hv-joystick-shaft {
  position: absolute;
  left: 50%;
  bottom: 50%;
  width: 6px;
  height: 22px;
  transform-origin: bottom center;
  transform: translateX(-50%) rotate(0deg);
  background: linear-gradient(90deg, #9aa2ad, #f0f3f7 45%, #7c8591);
  border-radius: 3px;
  transition: transform 0.12s cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: none;
}

.haiz-hv-joystick-knob {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 28px;
  height: 28px;
  margin-left: -14px;
  margin-top: -26px;
  border-radius: 50%;
  background: radial-gradient(circle at 34% 28%, #ff9384 0%, var(--hv-accent) 48%, #a63427 100%);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.28), inset 0 1px 2px rgba(255, 255, 255, 0.48);
  transition: transform 0.12s cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: none;
}

/* Prize Slot Recessed Status Bay */
.haiz-hv-prize-slot {
  height: 46px;
  border-radius: 13px;
  background: var(--hv-surface-well);
  border: 1px solid var(--hv-card-border);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--hv-text-secondary);
  padding: 0 10px;
  transition: background 0.22s ease, color 0.22s ease, border-color 0.22s ease;
}

.haiz-hv-prize-slot.is-ready {
  background: var(--hv-success-bg);
  border-color: var(--hv-success-border);
  color: var(--hv-success);
}

.haiz-hv-prize-slot.is-collected {
  background: var(--hv-success-bg);
  border-color: var(--hv-success-border);
  color: var(--hv-success);
}

/* Tactile Physical Push Button */
.haiz-hv-push-btn-well {
  width: 66px;
  height: 66px;
  margin: 0 auto;
  border-radius: 50%;
  padding: 5px;
  background: var(--hv-surface-well);
  box-shadow: inset 0 3px 6px rgba(0, 0, 0, 0.16), 0 1px 0 rgba(255, 255, 255, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.haiz-hv-push-btn {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: 650;
  color: #ffffff;
  background: radial-gradient(circle at 38% 26%, #f58171 0%, var(--hv-accent) 55%, #b93c2d 100%);
  box-shadow:
    0 5px 0 #9e3124,
    0 8px 14px var(--hv-accent-glow),
    inset 0 1px 2px rgba(255, 255, 255, 0.45);
  transform: translateY(-2px);
  transition: transform 0.08s ease, box-shadow 0.08s ease, filter 0.16s ease;
}

.haiz-hv-push-btn:hover:not(:disabled) {
  filter: brightness(1.04);
}

.haiz-hv-push-btn:active:not(:disabled),
.haiz-hv-push-btn.is-pressed:not(:disabled) {
  transform: translateY(2px);
  box-shadow:
    0 1px 0 #9e3124,
    0 3px 6px var(--hv-accent-glow),
    inset 0 1px 2px rgba(255, 255, 255, 0.35);
}

.haiz-hv-push-btn:disabled {
  cursor: not-allowed;
  background: linear-gradient(180deg, #b8bec7, #9aa1ac);
  box-shadow: 0 2px 0 #7f8691, inset 0 1px 1px rgba(255, 255, 255, 0.35);
  transform: translateY(1px);
  color: rgba(255, 255, 255, 0.85);
}

/* Keyboard / Assistive Accessible Mode Panel */
.haiz-hv-a11y-panel {
  display: none;
  padding: 14px;
  border-radius: 16px;
  background: var(--hv-surface-subtle);
  border: 1px solid var(--hv-card-border);
}

.haiz-hv-a11y-panel.is-visible {
  display: block;
}

.haiz-hv-a11y-note {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--hv-text-secondary);
  line-height: 1.5;
}

.haiz-hv-a11y-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.haiz-hv-a11y-option {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--hv-card-border);
  background: var(--hv-pill-active-bg);
  color: var(--hv-text-primary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 550;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.16s ease, transform 0.12s ease;
}

.haiz-hv-a11y-option:hover,
.haiz-hv-a11y-option:focus-visible {
  border-color: var(--hv-accent);
  outline: none;
  transform: translateY(-1px);
}

/* Footer Hint */
.haiz-hv-footer {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11.5px;
  color: var(--hv-text-muted);
}

.haiz-hv-footer-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--hv-text-secondary);
  font-family: inherit;
  font-size: 11.5px;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.haiz-hv-footer-link:hover {
  color: var(--hv-text-primary);
}

@media (max-width: 440px) {
  .haiz-hv-dialog {
    padding: 16px 14px 14px;
    border-radius: 22px;
  }
  .haiz-hv-console {
    grid-template-columns: 68px 1fr 70px;
    padding: 10px;
    gap: 8px;
  }
  .haiz-hv-joystick, .haiz-hv-push-btn-well {
    width: 58px;
    height: 58px;
  }
  .haiz-hv-footer {
    flex-direction: column;
    text-align: center;
    gap: 4px;
  }
}

@media (max-height: 620px) and (orientation: landscape) {
  .haiz-hv-dialog {
    max-width: 560px;
    padding: 14px 18px;
  }
  .haiz-hv-stage-frame {
    aspect-ratio: 16 / 8.2;
  }
}

@media (prefers-reduced-motion: reduce) {
  .haiz-hv-root, .haiz-hv-dialog, .haiz-hv-joystick-knob, .haiz-hv-joystick-shaft {
    transition-duration: 0.01ms !important;
  }
}
`;
