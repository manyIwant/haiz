// HAIZ · EXPERIMENTARIUM — 展开式学科实验台（空间模式 3：破页入台）
// 当实验需要更宽敞的二维精密读数、动态几何作图、显微镜视野或史料互证台时，从书页自然展开工作台。
import { linearRegression } from './epistemic.js';

export function initWorkbench(ctx) {
  const el = document.querySelector('#workbench');
  const btn = document.querySelector('#bWork');
  let isOpen = false;
  let currentCleanup = null;
  let curSpread = null;

  function teardown() {
    if (currentCleanup) {
      try { currentCleanup(); } catch {}
      currentCleanup = null;
    }
    if (el) el.innerHTML = '';
  }

  function buildHelpers(sp) {
    const body = el.querySelector('.wb-body');
    const cleanups = [];
    const helpers = {
      root: body,
      onCleanup: (fn) => cleanups.push(fn),
      section(title, extraClass = '') {
        const sec = document.createElement('section');
        sec.className = `wb-sec ${extraClass}`;
        if (title) {
          const h = document.createElement('h3');
          h.textContent = title;
          sec.append(h);
        }
        body.append(sec);
        return sec;
      },
      /** HiDPI 响应式交互画布 */
      canvas(parent, logicalW, logicalH, drawFn) {
        const wrap = document.createElement('div');
        wrap.className = 'wb-canvas-wrap';
        const cv = document.createElement('canvas');
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = Math.round(logicalW * dpr);
        cv.height = Math.round(logicalH * dpr);
        cv.style.aspectRatio = `${logicalW} / ${logicalH}`;
        wrap.append(cv);
        parent.append(wrap);
        const cx = cv.getContext('2d');
        const redraw = (...args) => {
          cx.save();
          cx.setTransform(dpr, 0, 0, dpr, 0, 0);
          cx.clearRect(0, 0, logicalW, logicalH);
          drawFn(cx, logicalW, logicalH, ...args);
          cx.restore();
        };
        const toLocal = (ev) => {
          const r = cv.getBoundingClientRect();
          return {
            x: ((ev.clientX - r.left) / Math.max(1, r.width)) * logicalW,
            y: ((ev.clientY - r.top) / Math.max(1, r.height)) * logicalH,
          };
        };
        return { cv, wrap, redraw, toLocal };
      },
      /** 自动构建带线性回归的科学散点图 SVG/Canvas */
      regressionChart(parent, opts) {
        const { w = 480, h = 230, xLabel = 'x', yLabel = 'y', xRange = [0, 1], yRange = [0, 1] } = opts || {};
        const chart = helpers.canvas(parent, w, h, (x, W, H, data = {}) => {
          const pad = { l: 50, r: 18, t: 18, b: 36 };
          const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
          const xr = data.xRange || xRange, yr = data.yRange || yRange;
          const sx = (v) => pad.l + ((v - xr[0]) / Math.max(1e-9, xr[1] - xr[0])) * pw;
          const sy = (v) => pad.t + ph - ((v - yr[0]) / Math.max(1e-9, yr[1] - yr[0])) * ph;

          x.fillStyle = '#fffdf7';
          x.fillRect(0, 0, W, H);
          x.strokeStyle = 'rgba(30,43,54,0.12)';
          x.lineWidth = 1;
          for (let i = 0; i <= 4; i++) {
            const gx = pad.l + (pw * i) / 4, gy = pad.t + (ph * i) / 4;
            x.beginPath(); x.moveTo(gx, pad.t); x.lineTo(gx, pad.t + ph); x.stroke();
            x.beginPath(); x.moveTo(pad.l, gy); x.lineTo(pad.l + pw, gy); x.stroke();
          }
          x.strokeStyle = '#1e2b36';
          x.lineWidth = 1.6;
          x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();

          // 理论曲线或参考线
          if (data.theoryFn) {
            x.save(); x.setLineDash([6, 4]); x.strokeStyle = '#b4653a'; x.lineWidth = 1.8; x.beginPath();
            for (let i = 0; i <= 60; i++) {
              const xv = xr[0] + ((xr[1] - xr[0]) * i) / 60, yv = data.theoryFn(xv);
              if (i === 0) x.moveTo(sx(xv), sy(yv)); else x.lineTo(sx(xv), sy(yv));
            }
            x.stroke(); x.restore();
          }
          // 最小二乘拟合线
          const pts = data.pts || [];
          const reg = data.fit !== false ? linearRegression(pts) : null;
          if (reg) {
            x.strokeStyle = '#1f4a3e'; x.lineWidth = 2; x.beginPath();
            x.moveTo(sx(xr[0]), sy(reg.k * xr[0] + reg.b));
            x.lineTo(sx(xr[1]), sy(reg.k * xr[1] + reg.b));
            x.stroke();
          }
          // 散点
          for (const pt of pts) {
            const px = sx(pt[0]), py = sy(pt[1]), kind = pt[2] || 'simulated';
            x.beginPath(); x.arc(px, py, 4.5, 0, Math.PI * 2);
            if (kind === 'human') { x.fillStyle = '#1f4a3e'; x.fill(); }
            else { x.fillStyle = '#fffdf7'; x.fill(); x.strokeStyle = '#51606b'; x.lineWidth = 1.8; x.stroke(); }
          }
          // 刻度与标题
          x.fillStyle = '#51606b'; x.font = '11px Georgia, serif'; x.textAlign = 'center';
          x.fillText(String(+xr[0].toFixed(2)), pad.l, H - 18);
          x.fillText(String(+xr[1].toFixed(2)), pad.l + pw, H - 18);
          x.fillText(xLabel, pad.l + pw / 2, H - 6);
          x.textAlign = 'right';
          x.fillText(String(+yr[0].toFixed(2)), pad.l - 6, pad.t + ph);
          x.fillText(String(+yr[1].toFixed(2)), pad.l - 6, pad.t + 8);
          x.textAlign = 'left';
          x.fillText(yLabel, pad.l + 6, pad.t + 12);
          if (reg) {
            x.fillStyle = '#1f4a3e'; x.textAlign = 'right';
            x.fillText(`拟合 y=${reg.k.toFixed(3)}x${reg.b >= 0 ? '+' : ''}${reg.b.toFixed(3)} (R²=${reg.r2.toFixed(4)})`, W - 14, pad.t + 12);
          }
        });
        return chart;
      },
      record(row) { ctx.recordRow(sp.exp, row); },
      rows: () => ctx.getRows(sp.exp.id),
      setParam(id, v) { sp.params[id] = v; sp.sync[id]?.(); sp.inst?.change?.(id); ctx.markDirty(); },
      press(id) { sp.inst?.press?.(id); ctx.markDirty(); },
    };
    return { helpers, dispose: () => cleanups.forEach((f) => { try { f(); } catch {} }) };
  }

  function render(sp) {
    if (!el || !sp) return;
    teardown();
    const exp = sp.exp, meta = exp.meta || {}, s = ctx.subjects[exp.subject] || {};
    const level = meta.implementation?.currentLevel || 'L3';
    el.innerHTML = `<header class="wb-head">
      <div>
        <div class="wb-kicker"><i></i><span>${ctx.esc(s.name || '')} · ${ctx.esc(level)} 开放探究实验台</span></div>
        <h2>${ctx.esc(exp.title)}</h2>
      </div>
      <div class="wb-head-acts">
        <button type="button" class="wb-btn" data-wb="journal">查看实验记录</button>
        <button type="button" class="wb-btn primary" data-wb="close">收起返回书页 ✕</button>
      </div>
    </header>
    <div class="wb-body"></div>`;
    el.style.setProperty('--subj', s.color || '#b4653a');
    el.querySelector('[data-wb="close"]').addEventListener('click', () => api.close());
    el.querySelector('[data-wb="journal"]').addEventListener('click', () => ctx.openJournal());

    const { helpers, dispose } = buildHelpers(sp);
    let wbInst = null;
    if (typeof exp.buildWorkbench === 'function') {
      try { wbInst = exp.buildWorkbench(helpers, sp) || {}; } catch (e) { console.error('buildWorkbench error:', e); }
    } else {
      const sec = helpers.section('实验工作台');
      sec.innerHTML += `<p class="wb-muted">${ctx.esc(exp.lede?.[0] || '')}</p>`;
    }
    currentCleanup = () => { try { wbInst?.dispose?.(); } catch {} dispose(); };
    sp.wbInst = wbInst;
  }

  const api = {
    get open() { return isOpen; },
    setSpread(sp) {
      curSpread = sp;
      if (isOpen && sp) render(sp);
    },
    openFor(sp) {
      curSpread = sp || curSpread;
      if (!curSpread) return;
      isOpen = true;
      document.body.classList.add('wb-open');
      el.hidden = false;
      btn?.setAttribute('aria-pressed', 'true');
      render(curSpread);
      ctx.onModeChange('workbench');
    },
    close() {
      if (!isOpen) return;
      isOpen = false;
      document.body.classList.remove('wb-open');
      el.hidden = true;
      btn?.setAttribute('aria-pressed', 'false');
      teardown();
      if (curSpread) curSpread.wbInst = null;
      ctx.onModeChange('spread');
    },
    toggle(sp) { isOpen ? api.close() : api.openFor(sp || curSpread); },
    tick(dt) {
      if (isOpen && curSpread?.wbInst?.update) {
        try { curSpread.wbInst.update(dt); } catch {}
      }
    },
  };
  return api;
}
