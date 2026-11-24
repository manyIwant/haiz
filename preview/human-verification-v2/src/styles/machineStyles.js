/**
 * HAIZ Toybox V2 — Industrial Designer Miniature Claw Machine Stylesheet
 */

export const MACHINE_CSS = `
.haiz-tb-root {
  --tb-backdrop: rgba(22, 18, 15, 0.58);
  --tb-shell-top: #EAE2D2;
  --tb-shell-body: #F4EFE4;
  --tb-shell-trim: #D7CCB7;
  --tb-shell-border: rgba(72, 56, 38, 0.16);
  --tb-marquee-bg: #2F4A3C;
  --tb-marquee-text: #F6F1E5;
  --tb-marquee-sub: #BFD3C6;
  --tb-deck-bg: #E6DEC9;
  --tb-deck-inset: #D6CCB6;
  --tb-text-primary: #241F1B;
  --tb-text-secondary: #665D53;
  --tb-text-muted: #8D8275;
  --tb-accent: #D4573F;
  --tb-accent-deep: #9D3422;
  --tb-success: #2A7C59;
  --tb-success-bg: #DFEFE6;

  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Inter", sans-serif;
  -webkit-font-smoothing: antialiased;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.haiz-tb-root *, .haiz-tb-root *::before, .haiz-tb-root *::after { box-sizing: border-box; }
.haiz-tb-root.is-open { opacity: 1; pointer-events: auto; }

.haiz-tb-backdrop {
  position: absolute;
  inset: 0;
  background: var(--tb-backdrop);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.haiz-tb-machine {
  position: relative;
  width: 100%;
  max-width: 456px;
  border-radius: 30px;
  background: linear-gradient(180deg, var(--tb-shell-top) 0%, var(--tb-shell-body) 22%, var(--tb-shell-body) 100%);
  border: 1.5px solid var(--tb-shell-border);
  box-shadow:
    0 34px 80px rgba(10, 12, 16, 0.42),
    0 8px 20px rgba(10, 12, 16, 0.16),
    inset 0 2px 1px rgba(255, 255, 255, 0.55),
    inset 0 -3px 6px rgba(0, 0, 0, 0.08);
  padding: 14px 14px 16px;
  transform: translateY(20px) scale(0.95);
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  user-select: none;
  -webkit-user-select: none;
}

.haiz-tb-root.is-open .haiz-tb-machine { transform: translateY(0) scale(1); }

.haiz-tb-canopy {
  background: var(--tb-marquee-bg);
  color: var(--tb-marquee-text);
  border-radius: 20px 20px 12px 12px;
  padding: 12px 15px 13px;
  margin-bottom: 11px;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.25), 0 1px 0 rgba(255, 255, 255, 0.35);
}

.haiz-tb-canopy-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.haiz-tb-plate {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--tb-marquee-sub);
}

.haiz-tb-power-led {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #53D298;
  box-shadow: 0 0 8px rgba(83, 210, 152, 0.8);
}

.haiz-tb-mock-badge {
  font-size: 9.5px;
  padding: 2px 6px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.12);
  color: var(--tb-marquee-text);
  letter-spacing: 0.05em;
}

.haiz-tb-canopy-tools { display: flex; align-items: center; gap: 5px; }

.haiz-tb-mini-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.08);
  color: var(--tb-marquee-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s ease, transform 0.1s ease;
}

.haiz-tb-mini-btn:hover { background: rgba(255, 255, 255, 0.18); }
.haiz-tb-mini-btn:active { transform: scale(0.92); }
.haiz-tb-mini-btn.is-active { background: rgba(255, 255, 255, 0.24); }

.haiz-tb-marquee-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.haiz-tb-target-readout {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--tb-marquee-text);
  min-height: 24px;
}

.haiz-tb-swatch {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: inset 0 -1px 2px rgba(0, 0, 0, 0.28), 0 0 0 2px rgba(255, 255, 255, 0.24);
}

.haiz-tb-step-leds {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 99px;
  background: rgba(0, 0, 0, 0.22);
  flex-shrink: 0;
}

.haiz-tb-led-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.45);
  transition: color 0.2s ease;
}

.haiz-tb-led-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

.haiz-tb-led-item.is-active { color: var(--tb-marquee-text); }
.haiz-tb-led-item.is-active .haiz-tb-led-dot { background: #F4C43D; box-shadow: 0 0 7px rgba(244, 196, 61, 0.85); }
.haiz-tb-led-item.is-done { color: #8FE4BC; }
.haiz-tb-led-item.is-done .haiz-tb-led-dot { background: #4CD495; box-shadow: 0 0 6px rgba(76, 212, 149, 0.75); }

.haiz-tb-vitrine {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 11.4;
  border-radius: 18px;
  overflow: hidden;
  border: 3px solid var(--tb-shell-trim);
  box-shadow:
    inset 0 4px 14px rgba(0, 0, 0, 0.16),
    inset 0 0 0 1px rgba(255, 255, 255, 0.35),
    0 2px 6px rgba(0, 0, 0, 0.08);
  touch-action: none;
  background: #DFD8CA;
}

.haiz-tb-canvas { width: 100%; height: 100%; display: block; }

.haiz-tb-glass-sheen {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: 15px;
  background: linear-gradient(
    126deg,
    rgba(255, 255, 255, 0.16) 0%,
    rgba(255, 255, 255, 0.05) 18%,
    rgba(255, 255, 255, 0.0) 34%,
    rgba(255, 255, 255, 0.0) 76%,
    rgba(255, 255, 255, 0.07) 84%,
    rgba(255, 255, 255, 0.0) 94%
  );
  box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.22);
}

.haiz-tb-chute-pill {
  position: absolute;
  left: 11px;
  bottom: 10px;
  font-size: 10.5px;
  font-weight: 650;
  letter-spacing: 0.04em;
  padding: 4px 9px;
  border-radius: 99px;
  background: rgba(24, 22, 20, 0.62);
  color: #F6F2E9;
  backdrop-filter: blur(4px);
  pointer-events: none;
  transition: background 0.2s ease, transform 0.2s ease;
}

.haiz-tb-chute-pill.is-ready { background: var(--tb-success); transform: translateY(-2px); }

.haiz-tb-toast {
  position: absolute;
  left: 50%;
  top: 10px;
  transform: translateX(-50%) translateY(-8px);
  background: rgba(26, 23, 20, 0.84);
  color: #F7F3EA;
  font-size: 12px;
  font-weight: 550;
  padding: 6px 13px;
  border-radius: 99px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  backdrop-filter: blur(6px);
  transition: opacity 0.22s ease, transform 0.22s ease;
  z-index: 5;
}

.haiz-tb-toast.is-visible { opacity: 1; transform: translateX(-50%) translateY(0); }

.haiz-tb-welcome-card {
  position: absolute;
  right: 16px;
  bottom: 18px;
  max-width: 230px;
  background: #FBF8F1;
  color: #231F1B;
  border: 1.5px solid rgba(72, 56, 38, 0.16);
  border-radius: 16px;
  padding: 12px 14px;
  box-shadow: 0 14px 32px rgba(20, 16, 12, 0.24);
  transform: translateY(18px) scale(0.92);
  opacity: 0;
  pointer-events: none;
  transition: transform 0.42s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.32s ease;
  z-index: 6;
}

.haiz-tb-welcome-card.is-visible { transform: translateY(0) scale(1); opacity: 1; pointer-events: auto; }
.haiz-tb-welcome-kicker { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--tb-success); margin-bottom: 4px; }
.haiz-tb-welcome-title { font-size: 15px; font-weight: 700; margin: 0 0 4px; color: #1F1B18; }
.haiz-tb-welcome-sub { font-size: 12px; line-height: 1.45; color: #61584E; margin: 0; }

.haiz-tb-status-veil {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(244, 239, 228, 0.86);
  backdrop-filter: blur(7px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
  z-index: 7;
  text-align: center;
  padding: 18px;
  color: var(--tb-text-primary);
}

.haiz-tb-root[data-theme="obsidian"] .haiz-tb-status-veil { background: rgba(22, 24, 30, 0.86); }
.haiz-tb-status-veil.is-visible { opacity: 1; pointer-events: auto; }

.haiz-tb-spinner {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2.5px solid var(--tb-deck-inset);
  border-top-color: var(--tb-accent);
  animation: haiz-tb-spin 0.75s linear infinite;
}

@keyframes haiz-tb-spin { to { transform: rotate(360deg); } }

.haiz-tb-deck {
  margin-top: 12px;
  padding: 13px 14px;
  border-radius: 20px;
  background: linear-gradient(180deg, var(--tb-deck-bg) 0%, var(--tb-shell-top) 100%);
  border: 1px solid var(--tb-shell-border);
  box-shadow: inset 0 2px 3px rgba(255, 255, 255, 0.45), inset 0 -2px 5px rgba(0, 0, 0, 0.08);
  display: grid;
  grid-template-columns: 78px 1fr 80px;
  align-items: center;
  gap: 12px;
}

.haiz-tb-joystick {
  position: relative;
  width: 66px;
  height: 66px;
  margin: 0 auto;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 42%, var(--tb-deck-inset) 0%, rgba(20, 18, 16, 0.26) 100%);
  border: 1.5px solid var(--tb-shell-border);
  box-shadow: inset 0 4px 10px rgba(0, 0, 0, 0.22), 0 1px 0 rgba(255, 255, 255, 0.5);
  touch-action: none;
  cursor: grab;
}

.haiz-tb-joystick:active { cursor: grabbing; }
.haiz-tb-joy-boot { position: absolute; left: 50%; top: 50%; width: 24px; height: 24px; border-radius: 50%; transform: translate(-50%, -50%); background: #232220; box-shadow: 0 3px 6px rgba(0, 0, 0, 0.35); }
.haiz-tb-joy-shaft { position: absolute; left: 50%; bottom: 50%; width: 7px; height: 24px; transform-origin: bottom center; transform: translateX(-50%) rotate(0deg); background: linear-gradient(90deg, #8f96a0, #f4f6f8 46%, #747b86); border-radius: 4px; transition: transform 0.11s cubic-bezier(0.22, 1, 0.36, 1); pointer-events: none; }
.haiz-tb-joy-knob { position: absolute; left: 50%; top: 50%; width: 30px; height: 30px; margin-left: -15px; margin-top: -28px; border-radius: 50%; background: radial-gradient(circle at 34% 28%, #f7927e 0%, var(--tb-accent) 50%, var(--tb-accent-deep) 100%); box-shadow: 0 7px 14px rgba(0, 0, 0, 0.32), inset 0 1.5px 2px rgba(255, 255, 255, 0.45); transition: transform 0.11s cubic-bezier(0.22, 1, 0.36, 1); pointer-events: none; }

.haiz-tb-chute-door {
  height: 54px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(20, 18, 16, 0.16) 0%, rgba(20, 18, 16, 0.06) 100%);
  border: 1.5px solid var(--tb-shell-border);
  box-shadow: inset 0 5px 10px rgba(0, 0, 0, 0.16), 0 1px 0 rgba(255, 255, 255, 0.45);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 0 10px;
  color: var(--tb-text-secondary);
  transition: background 0.22s ease, border-color 0.22s ease, color 0.22s ease;
}

.haiz-tb-chute-door-bar { width: 44px; height: 4px; border-radius: 99px; background: rgba(128, 122, 112, 0.36); transition: background 0.22s ease, box-shadow 0.22s ease; }
.haiz-tb-chute-door-label { font-size: 12px; font-weight: 650; letter-spacing: 0.03em; }
.haiz-tb-chute-door.is-ready, .haiz-tb-chute-door.is-collected { background: var(--tb-success-bg); border-color: var(--tb-success); color: var(--tb-success); }
.haiz-tb-chute-door.is-ready .haiz-tb-chute-door-bar, .haiz-tb-chute-door.is-collected .haiz-tb-chute-door-bar { background: var(--tb-success); box-shadow: 0 0 8px rgba(42, 124, 89, 0.65); }

.haiz-tb-btn-bezel {
  width: 68px;
  height: 68px;
  margin: 0 auto;
  border-radius: 50%;
  padding: 5px;
  background: linear-gradient(180deg, var(--tb-deck-inset), var(--tb-shell-trim));
  box-shadow: inset 0 3px 7px rgba(0, 0, 0, 0.22), 0 1px 0 rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.haiz-tb-arcade-btn {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #FFFBF6;
  background: radial-gradient(circle at 38% 28%, #f0826e 0%, var(--tb-accent) 56%, var(--tb-accent-deep) 100%);
  box-shadow: 0 5px 0 var(--tb-accent-deep), 0 8px 16px rgba(157, 52, 34, 0.34), inset 0 1.5px 2px rgba(255, 255, 255, 0.45);
  transform: translateY(-2px);
  transition: transform 0.08s ease, box-shadow 0.08s ease;
}

.haiz-tb-arcade-btn:active:not(:disabled), .haiz-tb-arcade-btn.is-pressed:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 var(--tb-accent-deep), 0 3px 6px rgba(157, 52, 34, 0.25), inset 0 1px 2px rgba(255, 255, 255, 0.32); }
.haiz-tb-arcade-btn:disabled { cursor: not-allowed; background: linear-gradient(180deg, #b5b0a6, #98938a); box-shadow: 0 2px 0 #7b7770; transform: translateY(1px); color: rgba(255, 255, 255, 0.85); }

.haiz-tb-a11y-panel { display: none; padding: 14px; border-radius: 16px; background: var(--tb-deck-bg); border: 1px solid var(--tb-shell-border); }
.haiz-tb-a11y-panel.is-visible { display: block; }
.haiz-tb-a11y-note { margin: 0 0 10px; font-size: 12px; color: var(--tb-text-secondary); line-height: 1.5; }
.haiz-tb-a11y-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.haiz-tb-a11y-btn { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--tb-shell-border); background: var(--tb-shell-body); color: var(--tb-text-primary); font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.haiz-tb-a11y-btn:hover, .haiz-tb-a11y-btn:focus-visible { border-color: var(--tb-accent); outline: none; }

.haiz-tb-foot { margin-top: 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 4px; font-size: 11px; color: var(--tb-text-muted); }
.haiz-tb-link-btn { background: none; border: none; padding: 0; font-family: inherit; font-size: 11px; font-weight: 600; color: var(--tb-text-secondary); cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }

@media (max-width: 440px) {
  .haiz-tb-machine { padding: 11px 11px 13px; border-radius: 26px; }
  .haiz-tb-canopy { padding: 10px 12px 11px; }
  .haiz-tb-marquee-row { flex-direction: column; align-items: flex-start; gap: 6px; }
  .haiz-tb-deck { grid-template-columns: 68px 1fr 70px; padding: 10px; gap: 8px; }
  .haiz-tb-joystick, .haiz-tb-btn-bezel { width: 60px; height: 60px; }
  .haiz-tb-foot { flex-direction: column; text-align: center; gap: 4px; }
}

@media (max-height: 620px) and (orientation: landscape) {
  .haiz-tb-machine { max-width: 560px; padding: 10px 14px; }
  .haiz-tb-vitrine { aspect-ratio: 16 / 8.6; }
}

@media (prefers-reduced-motion: reduce) {
  .haiz-tb-root, .haiz-tb-machine, .haiz-tb-joy-knob, .haiz-tb-joy-shaft, .haiz-tb-welcome-card { transition-duration: 0.01ms !important; }
}
`;
