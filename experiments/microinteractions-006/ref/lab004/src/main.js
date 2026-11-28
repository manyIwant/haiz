/**
 * HAIZ · Experiment 004 — Side-by-Side Acceptance & Forensic Frame-Step Workbench
 */

import { createMotionClock } from "./engine/clock-physics.js";
import { DOCK_ITEMS } from "./data/dock-items.js";
import { mountDockBaseline003 } from "./docks/dock-baseline-003.js";
import { mountDockElasticBay } from "./docks/dock-a-elastic-bay.js";
import { mountDockLiquidMembrane } from "./docks/dock-b-liquid-membrane.js";
import { mountDockCreaseStage } from "./docks/dock-c-crease-stage.js";

const clock = createMotionClock();

const state = {
  view: "bench", // 'bench' | 'solo-a' | 'solo-b' | 'solo-c'
  syncMirror: true,
  theme: "light",
  reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false,
  lastEvent: "将鼠标移入任意底部导航栏，或点击上方编排测试脚本观察空间响应",
};

const mainEl = document.getElementById("bench-main");
const telFps = document.getElementById("tel-fps");
const telLat = document.getElementById("tel-lat");
const telFrame = document.getElementById("tel-frame");
const btnMirror = document.getElementById("btn-mirror");
const btnPause = document.getElementById("btn-pause");
const btnStep = document.getElementById("btn-step");
const btnTheme = document.getElementById("btn-theme");
const btnMotion = document.getElementById("btn-motion");

let mountedDocks = [];
let scriptTimers = [];
let metricEls = {};

function clearScript() {
  scriptTimers.forEach(clearTimeout);
  scriptTimers = [];
}

function broadcastHover(source, idx, vx) {
  if (!state.syncMirror) return;
  for (const d of mountedDocks) {
    if (d !== source) d.ctrl.setVirtualHover(idx, vx);
  }
}

function broadcastLeave(source) {
  if (!state.syncMirror) return;
  for (const d of mountedDocks) {
    if (d !== source) d.ctrl.setVirtualHover(-1, 0);
  }
}

function broadcastActive(id) {
  for (const d of mountedDocks) d.ctrl.setActive(id);
}

function logEvent(msg) {
  state.lastEvent = msg;
  const soloLog = document.querySelector("[data-solo-log]");
  if (soloLog) soloLog.textContent = msg;
}

function unmountAll() {
  clearScript();
  mountedDocks.forEach((d) => d.ctrl.destroy());
  mountedDocks = [];
  metricEls = {};
  mainEl.innerHTML = "";
}

function renderBench() {
  unmountAll();
  mainEl.innerHTML = `
    <div class="compare-grid">
      <article class="dock-card">
        <header class="dc-head">
          <div>
            <span class="dc-eyebrow mono">CONTROL · LAB 003 BASELINE</span>
            <h2 class="dc-h2">基线 003：独立按钮 + 静态容器</h2>
            <p class="dc-desc">容器宽高锁定不变，按钮各占固定格位；仅光环滑动与局部微放，作为对照参照。</p>
          </div>
          <span class="dc-metrics mono" data-m="baseline">ΔW 0 · ΔH 0</span>
        </header>
        <div class="dock-arena" data-arena="baseline"></div>
        <footer class="dc-foot">
          <span>空间机制：<strong>静态栅格</strong></span>
          <span class="mono">无让位 · 无容器变形</span>
        </footer>
      </article>

      <article class="dock-card is-featured">
        <header class="dc-head">
          <div>
            <span class="dc-eyebrow mono">SYSTEM A · ELASTIC BAY / SPATIAL YIELDING</span>
            <h2 class="dc-h2">方案 A：弹性空间让位 · 建筑排席</h2>
            <p class="dc-desc">静息仅呈纯粹图标；悬停格位大幅扩张 3× 展开双行语义，相邻格位主动压缩并向外侧倾让位，整体容器随指针质心呼吸位移。</p>
          </div>
          <span class="dc-metrics mono" data-m="system-a">ΔW 0 · ΔH 0</span>
        </header>
        <div class="dock-arena" data-arena="system-a"></div>
        <footer class="dc-foot">
          <span>空间机制：<strong>耦合 1D 弹簧链让位</strong></span>
          <button class="seg-btn" data-open-solo="solo-a">独立底栏体验 →</button>
        </footer>
      </article>

      <article class="dock-card is-featured">
        <header class="dc-head">
          <div>
            <span class="dc-eyebrow mono">SYSTEM B · CONTINUOUS SVG CONTOUR MEMBRANE</span>
            <h2 class="dc-h2">方案 B：连续液态几何 · 单一轮廓膜</h2>
            <p class="dc-desc">放弃矩形边框，整条导航由单一实时三次 Bézier SVG 轮廓膜构成；顶缘无缝隆起并生长为一体穹顶，内部焦点胶囊随速度拉伸传递动量。</p>
          </div>
          <span class="dc-metrics mono" data-m="system-b">ΔW 0 · ΔH 0</span>
        </header>
        <div class="dock-arena" data-arena="system-b"></div>
        <footer class="dc-foot">
          <span>空间机制：<strong>单一 Bézier 轮廓 + 速度拉伸膜</strong></span>
          <button class="seg-btn" data-open-solo="solo-b">独立底栏体验 →</button>
        </footer>
      </article>

      <article class="dock-card is-featured">
        <header class="dc-head">
          <div>
            <span class="dc-eyebrow mono">SYSTEM C · CREASE STAGE / ARCHITECTURAL UNFOLDING</span>
            <h2 class="dc-h2">方案 C：折痕舞台 · 空间生长仪</h2>
            <p class="dc-desc">Hairline 1px 连续基准弦线随焦点弯折抬升，邻位图标依距错峰 3D 侧转分列，容器向上生长为可直接点击子操作的微工作台并沿手势方向滑动交接。</p>
          </div>
          <span class="dc-metrics mono" data-m="system-c">ΔW 0 · ΔH 0</span>
        </header>
        <div class="dock-arena" data-arena="system-c"></div>
        <footer class="dc-foot">
          <span>空间机制：<strong>基准弦线弯折 + 3D 分列 + 向上生长</strong></span>
          <button class="seg-btn" data-open-solo="solo-c">独立底栏体验 →</button>
        </footer>
      </article>
    </div>

    <section class="matrix-card">
      <header class="dc-head">
        <div>
          <span class="dc-eyebrow mono">ARCHITECTURAL COMPARISON · 本质空间机制差异对照</span>
          <h2 class="dc-h2">为什么三种方案代表截然不同的空间交互哲学</h2>
        </div>
      </header>
      <div class="matrix-wrap">
        <table class="matrix-table">
          <thead>
            <tr>
              <th>维度</th>
              <th>基线 003</th>
              <th>方案 A · 弹性排席</th>
              <th>方案 B · 液态轮廓膜</th>
              <th>方案 C · 折痕生长仪</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>空间让位</strong></td>
              <td>无让位，固定格宽</td>
              <td><strong>焦点扩至 164px，邻位压至 39px 并向外侧倾</strong></td>
              <td>邻位沿水平让开 ±9px，焦点上浮 9.5px</td>
              <td>邻位向外分列 ±13px 并 <strong>3D 侧转 ±22°</strong> 腾出舞台</td>
            </tr>
            <tr>
              <td><strong>运动传递</strong></td>
              <td>各自独立弹簧</td>
              <td><strong>跨格注入压缩波速度</strong> + 容器质心水平惯性</td>
              <td>内部胶囊<strong>保体积速度拉伸 (最高 +62px)</strong> 流向落点</td>
              <td>内部微工作台沿<strong>手势进入方向矢量滑动交接</strong></td>
            </tr>
            <tr>
              <td><strong>容器参与</strong></td>
              <td>静态矩形框</td>
              <td>整条胶囊宽 (+76px) 与高 (+6px) 同步呼吸</td>
              <td><strong>整条外轮廓为动态 Bézier 路径</strong>，凹弧圆角无缝隆起穹顶</td>
              <td>向上生长 <strong>+74px</strong> 为集成操作台，1px 基准弦线实时弯折</td>
            </tr>
            <tr>
              <td><strong>适用气质</strong></td>
              <td>常规工具栏</td>
              <td>高效率、极致克制的瑞士精密仪器感</td>
              <td>有机生命力、无缝连续的流体雕塑感</td>
              <td>一步直达子功能的建筑折纸空间工作台</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `;

  const specs = [
    { key: "baseline", fn: mountDockBaseline003 },
    { key: "system-a", fn: mountDockElasticBay },
    { key: "system-b", fn: mountDockLiquidMembrane },
    { key: "system-c", fn: mountDockCreaseStage },
  ];

  specs.forEach(({ key, fn }) => {
    const entry = { key, ctrl: null };
    metricEls[key] = mainEl.querySelector(`[data-m="${key}"]`);
    entry.ctrl = fn({
      host: mainEl.querySelector(`[data-arena="${key}"]`),
      clock,
      onSelect: (item, src) => {
        broadcastActive(item.id);
        logEvent(`已激活「${item.fullTitle}」(${src})`);
      },
      onAction: (item, act) => {
        broadcastActive(item.id);
        logEvent(`方案 C 空间生长直接执行：${item.title} → 「${act}」`);
      },
      onMirrorHover: (idx, vx) => broadcastHover(entry, idx, vx),
      onMirrorLeave: () => broadcastLeave(entry),
    });
    mountedDocks.push(entry);
  });

  mainEl.querySelectorAll("[data-open-solo]").forEach((b) => {
    b.addEventListener("click", () => setView(b.dataset.openSolo));
  });
}

function renderSolo(viewId) {
  unmountAll();
  const metaMap = {
    "solo-a": {
      key: "system-a",
      kicker: "SOLO DEMO · SYSTEM A",
      title: "方案 A · 弹性空间让位 · 建筑排席",
      desc: "请将鼠标慢速与高速扫过底部导航栏，感受静息极简与悬停时 3× 扩张、邻位压缩侧倾、容器质心惯性位移以及单手触屏滑选。",
      fn: mountDockElasticBay,
    },
    "solo-b": {
      key: "system-b",
      kicker: "SOLO DEMO · SYSTEM B",
      title: "方案 B · 连续液态几何 · 单一轮廓膜",
      desc: "观察整条导航唯一连续的 SVG Bézier 外轮廓如何从焦点处无缝隆起为一体穹顶，以及快速跨格时内部胶囊的速度拉伸传递。",
      fn: mountDockLiquidMembrane,
    },
    "solo-c": {
      key: "system-c",
      kicker: "SOLO DEMO · SYSTEM C",
      title: "方案 C · 折痕舞台 · 空间生长仪",
      desc: "悬停任意入口，感受 1px Hairline 基准弦线弯折抬升、邻位 3D 分列以及导航栏向上展开为可点击子操作的微工作台。",
      fn: mountDockCreaseStage,
    },
  };
  const m = metaMap[viewId] || metaMap["solo-a"];

  mainEl.innerHTML = `
    <div class="solo-view">
      <div class="solo-canvas">
        <div class="solo-kicker mono">${m.kicker}</div>
        <h1 class="solo-h1">${m.title}</h1>
        <p class="solo-p">${m.desc}</p>
        <div class="solo-event-log">
          <span class="tel-dot"></span>
          <span data-solo-log>${state.lastEvent}</span>
        </div>
      </div>
      <div class="solo-dock-anchor" data-solo-host></div>
    </div>
  `;

  const entry = { key: m.key, ctrl: null };
  entry.ctrl = m.fn({
    host: mainEl.querySelector("[data-solo-host]"),
    clock,
    onSelect: (item) => logEvent(`已单击直达「${item.fullTitle}」 · ${item.sub}`),
    onAction: (item, act) => logEvent(`直接在生长空间内触发：${item.title} → 「${act}」`),
  });
  mountedDocks.push(entry);
}

function setView(v) {
  state.view = v;
  document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("is-on", b.dataset.view === v));
  if (v === "bench") renderBench();
  else renderSolo(v);
}

// ==================== AUTOMATED CHOREOGRAPHY SCRIPTS ====================
function runScript(kind) {
  clearScript();
  clock.setPaused(false);
  btnPause.classList.remove("is-on");
  btnPause.textContent = "暂停";

  const stepMs = (ms) => ms / Math.max(0.12, clock.getState().scale);

  if (kind === "sweep") {
    logEvent("正在运行编排：平滑顺扫 (1 → 2 → 3 → 4 → 5 → 归位)");
    [0, 1, 2, 3, 4].forEach((idx, i) => {
      scriptTimers.push(setTimeout(() => {
        clock.markInput();
        mountedDocks.forEach((d) => d.ctrl.setVirtualHover(idx, 1.35));
      }, stepMs(i * 220)));
    });
    scriptTimers.push(setTimeout(() => {
      mountedDocks.forEach((d) => d.ctrl.setVirtualHover(-1, 0));
    }, stepMs(5 * 220 + 280)));
  }

  else if (kind === "jump") {
    logEvent("正在运行编排：跨距跳跃 (1 → 5 → 2 → 4)，观察跨格动量与容器拉伸");
    const seq = [[0, 1.0], [4, 2.5], [1, -2.2], [3, 1.9], [-1, 0]];
    seq.forEach(([idx, vx], i) => {
      scriptTimers.push(setTimeout(() => {
        clock.markInput();
        mountedDocks.forEach((d) => d.ctrl.setVirtualHover(idx, vx));
      }, stepMs(i * 360)));
    });
  }

  else if (kind === "reverse") {
    logEvent("正在运行编排：高速折返与中途打断（85ms 间隔连续变向）");
    const seq = [[0, 2.2], [1, 2.4], [2, 2.5], [3, 2.5], [2, -2.6], [1, -2.6], [3, 2.6], [0, -2.5], [2, 1.8], [-1, 0]];
    seq.forEach(([idx, vx], i) => {
      scriptTimers.push(setTimeout(() => {
        clock.markInput();
        mountedDocks.forEach((d) => d.ctrl.setVirtualHover(idx, vx));
      }, stepMs(i * 95)));
    });
  }

  else if (kind === "press") {
    logEvent("正在运行编排：悬停 → 按压蓄力 → 释放激活 同一连续物理轨迹");
    const target = 2;
    mountedDocks.forEach((d) => d.ctrl.setVirtualHover(target, 1.4));
    scriptTimers.push(setTimeout(() => {
      mountedDocks.forEach((d) => d.ctrl.setVirtualPress(target, true));
    }, stepMs(360)));
    scriptTimers.push(setTimeout(() => {
      mountedDocks.forEach((d) => {
        d.ctrl.setVirtualPress(target, false);
        d.ctrl.setActive(DOCK_ITEMS[target].id);
      });
    }, stepMs(620)));
    scriptTimers.push(setTimeout(() => {
      mountedDocks.forEach((d) => d.ctrl.setVirtualHover(-1, 0));
    }, stepMs(1150)));
  }
}

// ==================== GLOBAL CONTROLS & TELEMETRY ====================
document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));

document.querySelectorAll("[data-speed]").forEach((b) => {
  b.addEventListener("click", () => {
    const sc = Number(b.dataset.speed);
    clock.setScale(sc);
    document.querySelectorAll("[data-speed]").forEach((x) => x.classList.toggle("is-on", x === b));
    btnPause.classList.remove("is-on");
    btnPause.textContent = "暂停";
  });
});

btnPause.addEventListener("click", () => {
  const next = !clock.getState().paused;
  clock.setPaused(next);
  btnPause.classList.toggle("is-on", next);
  btnPause.textContent = next ? "继续" : "暂停";
});

btnStep.addEventListener("click", () => {
  btnPause.classList.add("is-on");
  btnPause.textContent = "继续";
  clock.stepFrame(16.67);
});

document.querySelectorAll("[data-script]").forEach((b) => {
  b.addEventListener("click", () => runScript(b.dataset.script));
});

btnMirror.addEventListener("click", () => {
  state.syncMirror = !state.syncMirror;
  btnMirror.classList.toggle("is-on", state.syncMirror);
  btnMirror.textContent = state.syncMirror ? "同步联动: 开" : "同步联动: 关";
});

function applyTheme(t) {
  state.theme = t;
  document.documentElement.dataset.theme = t;
  btnTheme.textContent = t === "dark" ? "墨砚暗色" : "宣纸亮色";
}
function applyMotion(r) {
  state.reducedMotion = Boolean(r);
  document.documentElement.dataset.reducedMotion = state.reducedMotion ? "true" : "false";
  btnMotion.textContent = state.reducedMotion ? "动态: 减弱" : "动态: 完整";
}

btnTheme.addEventListener("click", () => applyTheme(state.theme === "dark" ? "light" : "dark"));
btnMotion.addEventListener("click", () => applyMotion(!state.reducedMotion));

clock.onTelemetry((tel) => {
  telFps.textContent = `${tel.fps} fps`;
  telLat.textContent = `${tel.latencyMs.toFixed(1)} ms`;
  telFrame.textContent = `F#${String(tel.frameCount).padStart(4, "0")}`;

  for (const d of mountedDocks) {
    const el = metricEls[d.key];
    if (!el) continue;
    const t = d.ctrl.getTelemetry();
    const dw = t.widthDelta >= 0 ? `+${t.widthDelta}` : `${t.widthDelta}`;
    const dh = t.heightDelta >= 0 ? `+${t.heightDelta}` : `${t.heightDelta}`;
    el.textContent = `ΔW ${dw}px · ΔH ${dh}px`;
  }
});

// Expose deterministic test handle
window.__HAIZ_LAB4__ = {
  state,
  clock,
  setView,
  runScript,
  getDocks: () => mountedDocks,
  applyTheme,
  applyMotion,
};

applyTheme("light");
applyMotion(state.reducedMotion);
setView("bench");
