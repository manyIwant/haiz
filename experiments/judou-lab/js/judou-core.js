/* ═══════════════════════════════════════════════════════════════════════
   JUDOU CORE · 句读二代/三代交互引擎
   Reusable primitives:
   - Paradigmatic Choice (词钮 / 聚合栏)
   - Scrubbable & Editable Number (推敲数钮)
   - Syntactic Switch (句构钮)
   - Unfoldable Gloss/Proof (疏钮)
   - Causal Dependency Anchor (因果溯源钮)
   - Undo / Redo & Snapshot Comparison (可逆推演与探索手记)
   ═══════════════════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  class JudouEngine {
    constructor() {
      this.defs = {};
      this.activePara = null;
      this.activeNum = null;
      this.dragState = null;
      this.onRender = null;
      this.onLog = null; // optional hook for workbench event log

      // Undo / Redo stacks per chapter
      this.history = {};
      this.future = {};

      // Snapshots per chapter
      this.snapshots = this._loadStorage('judou-lab-v2-snapshots', {});
      this.compareSelection = {};
    }

    _loadStorage(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    }

    _saveStorage(key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch {}
    }

    clearDefs() {
      this.defs = {};
    }

    /* ── Token Generators ── */
    choice(id, cfg) {
      this.defs[id] = { type: 'choice', ...cfg };
      const idx = cfg.get();
      const label = cfg.opts[idx] ?? cfg.opts[0];
      return `<button type="button" class="jw jw-choice" data-jid="${esc(id)}" data-token-id="${esc(id)}" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(cfg.name || '词')}: ${esc(label)}（点击或按上下键切换）">${esc(label)}</button>`;
    }

    num(id, cfg) {
      this.defs[id] = { type: 'num', ...cfg };
      const val = cfg.get();
      const text = cfg.fmt ? cfg.fmt(val) : String(val);
      const unit = cfg.unit ? `<span class="jw-unit">${esc(cfg.unit)}</span>` : '';
      return `<button type="button" class="jw jw-num" data-jid="${esc(id)}" data-token-id="${esc(id)}" aria-label="${esc(cfg.name || '数值')}: ${esc(text)}${esc(cfg.unit || '')}（左右拖动或点击调节）">${esc(text)}${unit}</button>`;
    }

    syntax(id, cfg) {
      this.defs[id] = { type: 'syntax', ...cfg };
      const idx = cfg.get();
      const label = cfg.opts[idx] ?? cfg.opts[0];
      return `<button type="button" class="jw jw-syntax" data-jid="${esc(id)}" data-token-id="${esc(id)}" aria-haspopup="listbox" aria-expanded="false" aria-label="句构 ${esc(cfg.name || '')}: ${esc(label)}（点击切换表达结构）">⌜${esc(label)}⌟</button>`;
    }

    unfold(id, cfg) {
      this.defs[id] = { type: 'unfold', ...cfg };
      const exp = !!cfg.expanded();
      return `<button type="button" class="jw jw-unfold" data-jid="${esc(id)}" data-token-id="${esc(id)}" aria-expanded="${exp}">${esc(cfg.label)}</button>`;
    }

    dep(id, cfg) {
      this.defs[id] = { type: 'dep', ...cfg };
      const sources = (cfg.sources || []).join(',');
      return `<span class="jw-dep" tabindex="0" data-dep-sources="${esc(sources)}" data-token-id="${esc(id)}" title="${esc(cfg.title || '悬停或聚焦以追溯此结论依赖的条件')}">${cfg.html || esc(cfg.label)}</span>`;
    }

    go(id, cfg) {
      this.defs[id] = { type: 'go', ...cfg };
      return `<button type="button" class="jw jw-go" data-jid="${esc(id)}" data-token-id="${esc(id)}">${esc(cfg.label)}</button>`;
    }

    jz(top, bottom, tone = '') {
      return `<span class="jz ${esc(tone)}" role="note"><span>${esc(top)}</span><span>${esc(bottom || '')}</span></span>`;
    }

    /* ── History (Undo / Redo) ── */
    recordState(chapterId, stateClone, reason = '') {
      if (!this.history[chapterId]) this.history[chapterId] = [];
      const stack = this.history[chapterId];
      const serialized = JSON.stringify(stateClone);
      if (stack.length && stack[stack.length - 1].data === serialized) return;
      stack.push({ data: serialized, reason, at: Date.now() });
      if (stack.length > 60) stack.shift();
      this.future[chapterId] = [];
    }

    canUndo(chapterId) {
      return (this.history[chapterId] || []).length > 1;
    }

    canRedo(chapterId) {
      return (this.future[chapterId] || []).length > 0;
    }

    undo(chapterId, applyFn) {
      const stack = this.history[chapterId];
      if (!stack || stack.length <= 1) return false;
      const current = stack.pop();
      if (!this.future[chapterId]) this.future[chapterId] = [];
      this.future[chapterId].push(current);
      const prev = JSON.parse(stack[stack.length - 1].data);
      applyFn(prev);
      this.announce('已撤销：' + (current.reason || '上一步'));
      this._emitLog('undo', current.reason || 'step');
      return true;
    }

    redo(chapterId, applyFn) {
      const fut = this.future[chapterId];
      if (!fut || !fut.length) return false;
      const next = fut.pop();
      this.history[chapterId].push(next);
      applyFn(JSON.parse(next.data));
      this.announce('已重做：' + (next.reason || '下一步'));
      this._emitLog('redo', next.reason || 'step');
      return true;
    }

    /* ── Snapshots (探索手记) ── */
    addSnapshot(chapterId, summary, stateObj, metrics) {
      if (!this.snapshots[chapterId]) this.snapshots[chapterId] = [];
      const snap = {
        id: 's' + Date.now() + Math.random().toString(36).slice(2, 5),
        summary,
        state: JSON.parse(JSON.stringify(stateObj)),
        metrics,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      this.snapshots[chapterId].unshift(snap);
      if (this.snapshots[chapterId].length > 12) this.snapshots[chapterId].pop();
      this._saveStorage('judou-lab-v2-snapshots', this.snapshots);
      this.announce('已记入探索手记：' + summary);
      this._emitLog('snapshot', summary);
      return snap;
    }

    getSnapshots(chapterId) {
      return this.snapshots[chapterId] || [];
    }

    deleteSnapshot(chapterId, snapId) {
      if (!this.snapshots[chapterId]) return;
      this.snapshots[chapterId] = this.snapshots[chapterId].filter((s) => s.id !== snapId);
      if (this.compareSelection[chapterId]) {
        this.compareSelection[chapterId] = this.compareSelection[chapterId].filter((id) => id !== snapId);
      }
      this._saveStorage('judou-lab-v2-snapshots', this.snapshots);
    }

    toggleCompare(chapterId, snapId) {
      if (!this.compareSelection[chapterId]) this.compareSelection[chapterId] = [];
      const arr = this.compareSelection[chapterId];
      const idx = arr.indexOf(snapId);
      if (idx >= 0) arr.splice(idx, 1);
      else {
        if (arr.length >= 2) arr.shift();
        arr.push(snapId);
      }
    }

    getComparePair(chapterId) {
      const ids = this.compareSelection[chapterId] || [];
      const list = this.getSnapshots(chapterId);
      return ids.map((id) => list.find((s) => s.id === id)).filter(Boolean);
    }

    /* ── Popover & Direct Manipulation Bindings ── */
    mountInteractions() {
      const para = document.getElementById('para-pop');
      const veil = document.getElementById('para-veil');
      const numPop = document.getElementById('num-pop');
      const numInput = document.getElementById('num-pop-input');
      const numUnit = document.getElementById('num-pop-unit');

      const closeAll = (restoreFocus = false) => {
        if (this.activePara) {
          const el = this.activePara.el;
          el?.setAttribute('aria-expanded', 'false');
          this.activePara = null;
          para.classList.remove('on');
          if (restoreFocus && el && document.body.contains(el)) el.focus();
        }
        if (this.activeNum) {
          this.activeNum = null;
          numPop.classList.remove('on');
        }
        veil.classList.remove('on');
      };

      const openChoicePop = (el, id) => {
        const d = this.defs[id];
        if (!d) return;
        closeAll(false);
        const cur = d.get();
        if (d.opts.length === 2 && !d.alwaysMenu) {
          const next = 1 - cur;
          d.set(next);
          this._emitLog(d.type, `${d.name || id}: ${d.opts[next]}`);
          this.announce(`${d.name || ''}已改为 ${d.opts[next]}`);
          this.onRender?.({ focusId: id });
          return;
        }
        this.activePara = { id, el, sel: cur, cur };
        para.innerHTML = d.opts
          .map((opt, i) => {
            const note = d.notes && d.notes[i] ? `<small>${esc(d.notes[i])}</small>` : '';
            return `<li role="option" data-i="${i}" aria-selected="${i === cur}" class="${i === cur ? 'current' : ''}"><span>${esc(opt)}</span>${note}</li>`;
          })
          .join('');
        para.classList.add('on');
        veil.classList.add('on');
        el.setAttribute('aria-expanded', 'true');

        // Position near token
        const r = el.getBoundingClientRect();
        const pw = para.offsetWidth || 180;
        const ph = para.offsetHeight || 200;
        let left = Math.min(Math.max(8, r.left), window.innerWidth - pw - 8);
        let top = r.bottom + 6;
        if (top + ph > window.innerHeight - 10) {
          top = Math.max(8, r.top - ph - 6);
        }
        para.style.left = left + 'px';
        para.style.top = top + 'px';
      };

      const openNumPop = (el, id) => {
        const d = this.defs[id];
        if (!d) return;
        closeAll(false);
        this.activeNum = { id, el };
        numInput.min = d.min;
        numInput.max = d.max;
        numInput.step = d.step;
        numInput.value = d.get();
        numUnit.textContent = d.unit || '';
        numPop.classList.add('on');
        veil.classList.add('on');

        const r = el.getBoundingClientRect();
        const nw = numPop.offsetWidth || 240;
        const nh = numPop.offsetHeight || 50;
        let left = Math.min(Math.max(8, r.left), window.innerWidth - nw - 8);
        let top = r.bottom + 8;
        if (top + nh > window.innerHeight - 10) top = Math.max(8, r.top - nh - 8);
        numPop.style.left = left + 'px';
        numPop.style.top = top + 'px';
        numInput.focus();
        numInput.select();
      };

      // Click delegation
      document.addEventListener('click', (e) => {
        const li = e.target.closest('#para-pop li');
        if (li && this.activePara) {
          const i = Number(li.dataset.i);
          const { id } = this.activePara;
          const d = this.defs[id];
          closeAll(false);
          if (d) {
            d.set(i);
            this._emitLog(d.type, `${d.name || id}: ${d.opts[i]}`);
            this.announce(`${d.name || ''}已改为 ${d.opts[i]}`);
            this.onRender?.({ focusId: id });
          }
          return;
        }

        const btn = e.target.closest('.jw');
        if (!btn) return;
        if (this.dragState && this.dragState.moved) {
          this.dragState = null;
          return;
        }
        const id = btn.dataset.jid;
        const d = this.defs[id];
        if (!d) return;

        if (d.type === 'choice' || d.type === 'syntax') {
          openChoicePop(btn, id);
        } else if (d.type === 'num') {
          openNumPop(btn, id);
        } else if (d.type === 'unfold') {
          d.toggle();
          this._emitLog('unfold', `${d.label}: ${d.expanded() ? '展开' : '收起'}`);
          this.onRender?.({ focusId: id });
        } else if (d.type === 'go') {
          d.onClick?.();
        }
      });

      veil.addEventListener('click', () => closeAll(true));

      // Num popover controls
      const applyNumVal = (val) => {
        if (!this.activeNum) return;
        const d = this.defs[this.activeNum.id];
        if (!d) return;
        const clamped = Math.min(d.max, Math.max(d.min, Number(val)));
        if (Number.isNaN(clamped)) return;
        const rounded = Math.round(clamped / d.step) * d.step;
        const fixed = Number(rounded.toFixed(4));
        d.set(fixed);
        numInput.value = fixed;
        this._emitLog('num', `${d.name || this.activeNum.id}: ${fixed}`);
        this.onRender?.({ keepNumPop: true });
      };

      document.getElementById('num-pop-dec').addEventListener('click', () => {
        if (!this.activeNum) return;
        const d = this.defs[this.activeNum.id];
        applyNumVal(d.get() - d.step);
      });
      document.getElementById('num-pop-inc').addEventListener('click', () => {
        if (!this.activeNum) return;
        const d = this.defs[this.activeNum.id];
        applyNumVal(d.get() + d.step);
      });
      numInput.addEventListener('input', () => applyNumVal(numInput.value));
      numInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          closeAll(true);
        }
      });

      // Pointer drag scrubbing on .jw-num (both horizontal and vertical)
      document.addEventListener('pointerdown', (e) => {
        const el = e.target.closest('.jw-num');
        if (!el) return;
        const id = el.dataset.jid;
        const d = this.defs[id];
        if (!d) return;
        this.dragState = {
          id,
          startX: e.clientX,
          startY: e.clientY,
          startVal: d.get(),
          moved: false
        };
        el.classList.add('dragging');
        el.setPointerCapture?.(e.pointerId);
      });

      document.addEventListener('pointermove', (e) => {
        if (!this.dragState) return;
        const { id, startX, startY, startVal } = this.dragState;
        const d = this.defs[id];
        if (!d) return;
        const dx = e.clientX - startX;
        const dy = startY - e.clientY;
        const deltaPx = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
        if (Math.abs(deltaPx) > 6) {
          this.dragState.moved = true;
          const steps = Math.round(deltaPx / 12);
          const next = Math.min(d.max, Math.max(d.min, Number((startVal + steps * d.step).toFixed(4))));
          if (next !== d.get()) {
            d.set(next);
            this._emitLog('scrub', `${d.name || id}: ${next}`);
            this.onRender?.({ preserveDrag: true });
          }
        }
      });

      document.addEventListener('pointerup', () => {
        if (this.dragState) {
          document.querySelectorAll('.jw-num.dragging').forEach((n) => n.classList.remove('dragging'));
          setTimeout(() => {
            this.dragState = null;
          }, 0);
        }
      });

      // Wheel & Keyboard stepping directly on focused tokens
      document.addEventListener('keydown', (e) => {
        if (this.activePara) {
          const d = this.defs[this.activePara.id];
          const n = d.opts.length;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.activePara.sel = (this.activePara.sel + 1) % n;
            [...para.children].forEach((li, i) => li.setAttribute('aria-selected', i === this.activePara.sel));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.activePara.sel = (this.activePara.sel - 1 + n) % n;
            [...para.children].forEach((li, i) => li.setAttribute('aria-selected', i === this.activePara.sel));
          } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const sel = this.activePara.sel;
            const id = this.activePara.id;
            closeAll(false);
            d.set(sel);
            this._emitLog(d.type, `${d.name || id}: ${d.opts[sel]}`);
            this.onRender?.({ focusId: id });
          } else if (e.key === 'Escape' || e.key === 'Tab') {
            e.preventDefault();
            closeAll(true);
          }
          return;
        }

        const tok = document.activeElement?.closest?.('.jw');
        if (tok && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          const id = tok.dataset.jid;
          const d = this.defs[id];
          if (!d) return;
          if (d.type === 'num') {
            e.preventDefault();
            const dir = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : -1;
            const next = Math.min(d.max, Math.max(d.min, Number((d.get() + dir * d.step).toFixed(4))));
            d.set(next);
            this._emitLog('key-num', `${d.name || id}: ${next}`);
            this.onRender?.({ focusId: id });
          } else if (d.type === 'choice' || d.type === 'syntax') {
            e.preventDefault();
            const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
            const n = d.opts.length;
            const next = (d.get() + dir + n) % n;
            d.set(next);
            this._emitLog('key-choice', `${d.name || id}: ${d.opts[next]}`);
            this.onRender?.({ focusId: id });
          }
        }
      });

      // Causal dependency highlighting
      const setDepHighlight = (el, on) => {
        const ids = (el.dataset.depSources || '').split(',').filter(Boolean);
        el.classList.toggle('dep-active', on);
        ids.forEach((tid) => {
          document.querySelectorAll(`[data-token-id="${CSS.escape(tid)}"]`).forEach((src) => {
            src.classList.toggle('dep-source-highlight', on);
          });
        });
      };

      document.addEventListener('mouseover', (e) => {
        const dep = e.target.closest('.jw-dep');
        if (dep) setDepHighlight(dep, true);
      });
      document.addEventListener('mouseout', (e) => {
        const dep = e.target.closest('.jw-dep');
        if (dep) setDepHighlight(dep, false);
      });
      document.addEventListener('focusin', (e) => {
        const dep = e.target.closest('.jw-dep');
        if (dep) setDepHighlight(dep, true);
      });
      document.addEventListener('focusout', (e) => {
        const dep = e.target.closest('.jw-dep');
        if (dep) setDepHighlight(dep, false);
      });
    }

    announce(msg) {
      const live = document.getElementById('sr-live');
      if (live) live.textContent = msg;
    }

    _emitLog(kind, detail) {
      if (this.onLog) this.onLog({ kind, detail, time: new Date().toLocaleTimeString('zh-CN') });
    }
  }

  global.Judou = { JudouEngine, esc };
})(window);
