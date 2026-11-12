// HAIZ 实验册 · 实验记录
// 理科：一张数据表——记录一组、重复测量、平均值与离散程度、和参考值比较、导出 CSV。
// 文科：证据 → 解释 → 比较 三栏笔记，导出文本。
// 没有专门设计记录表的页面，默认把当前参数记成一行，方便课堂上对照不同条件。
const KEY = 'haiz-lab-notebook-v1';
const $ = (s, r = document) => r.querySelector(s);

function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* 隐私模式下只在本次打开期间保留 */ } }

export const stats = (xs) => {
  const v = xs.filter((x) => Number.isFinite(x)), n = v.length;
  if (!n) return { n: 0, mean: NaN, sd: NaN, se: NaN };
  const mean = v.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : NaN;
  return { n, mean, sd, se: n > 1 ? sd / Math.sqrt(n) : NaN };
};
const fmt = (v, d = 3) => (typeof v === 'number' ? (Number.isFinite(v) ? v.toFixed(d) : '—') : v ?? '—');

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function initNotebook(ctx) {
  const { esc, el, SUBJECTS } = ctx;
  const box = $('#notebook'), btn = $('#bRec');
  const db = load();
  let exp = null, sp = null, isOpen = false;

  /** 这一页用哪种记录表 */
  const specOf = (e) => {
    if (e.record) return { kind: 'table', ...e.record };
    if (e.inquiry) return { kind: 'inquiry', ...e.inquiry };
    const cols = (e.controls || []).filter((c) => c.type !== 'button').map((c) => ({ key: c.id, label: c.label || c.id, unit: c.unit || '', digits: String(c.step ?? 1).includes('.') ? String(c.step).split('.')[1].length : 0, of: c }));
    return {
      kind: 'table', generic: true, title: '参数记录', columns: cols,
      sample: (inst, p) => Object.fromEntries(cols.map((c) => [c.key, c.of.type === 'choice' ? c.of.options[p[c.key]] : c.of.type === 'toggle' ? (p[c.key] ? '开' : '关') : c.of.fmt ? c.of.fmt(p[c.key]) : p[c.key]])),
      note: '本页是模型演示，没有专门的测量表；这里把当前各项条件记成一行，便于对照。读数请写在备注里。',
    };
  };
  const rowsOf = (e) => (db[e.id] ||= { rows: [], notes: {} });

  function render() {
    btn.setAttribute('aria-pressed', isOpen);
    box.hidden = !isOpen;
    if (!isOpen || !exp) return;
    const spec = specOf(exp), rec = rowsOf(exp), s = SUBJECTS[exp.subject];
    let html = `<button class="x" type="button" aria-label="关闭">×</button><h3>实验记录 · ${s.name} ${exp.no}</h3><h2>${esc(exp.title)}</h2>`;
    if (spec.kind === 'table') {
      const cols = spec.columns;
      html += `<p class="nb-note">${esc(spec.note || '每按一次“记录一组”，把装置此刻的读数记成一行。同一条件多记几组，再看平均值与离散程度。')}</p>
      <div class="nb-acts"><button type="button" data-a="add" class="act">记录一组</button><button type="button" data-a="undo">删去末行</button><button type="button" data-a="clear">清空</button><button type="button" data-a="csv">导出 CSV</button></div>
      <div class="nb-scroll"><table><thead><tr><th>#</th>${cols.map((c) => `<th>${esc(c.label)}${c.unit ? `<small> / ${esc(c.unit)}</small>` : ''}</th>`).join('')}</tr></thead>
      <tbody>${rec.rows.map((r, i) => `<tr><td>${i + 1}</td>${cols.map((c) => `<td>${esc(fmt(r[c.key], c.digits ?? 3))}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length + 1}" class="empty">还没有数据</td></tr>`}</tbody></table></div>`;
      const sum = [];
      for (const c of cols.filter((c) => c.stat)) {
        const st = stats(rec.rows.map((r) => r[c.key]));
        if (st.n) sum.push(`<div><dt>${esc(c.label)}</dt><dd>平均 ${fmt(st.mean, (c.digits ?? 3) + 1)}${c.unit ? ` ${esc(c.unit)}` : ''}${st.n > 1 ? `，标准偏差 ${fmt(st.sd, (c.digits ?? 3) + 1)}，n = ${st.n}` : '（只有一组，无法估计离散程度）'}${Number.isFinite(c.ref) ? `；与参考值 ${c.ref} 相对偏差 ${fmt(Math.abs(st.mean - c.ref) / Math.abs(c.ref) * 100, 1)}%` : ''}</dd></div>`);
      }
      const extra = spec.summary ? spec.summary(rec.rows) : [];
      for (const [k, v] of extra || []) sum.push(`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`);
      if (sum.length) html += `<h3>数据处理</h3><dl class="nb-sum">${sum.join('')}</dl>`;
      if (spec.errors) html += `<h3>误差从哪里来</h3><ul class="nb-err">${spec.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`;
      html += `<h3>备注</h3><textarea data-n="memo" rows="3" placeholder="现象、读数、疑问…">${esc(rec.notes.memo || '')}</textarea>`;
    } else {
      html += `<p class="nb-note">${esc(spec.note || '这一页不测量数据，而是练习“用证据说话”：先摆出材料，再给出解释，最后和别的说法比较。')}</p>`;
      for (const st of spec.steps) {
        html += `<h3>${esc(st.label)}</h3><p class="nb-q">${esc(st.prompt)}</p>${st.hints ? `<ul class="nb-err">${st.hints.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}<textarea data-n="${esc(st.key)}" rows="3" placeholder="写下你的记录…">${esc(rec.notes[st.key] || '')}</textarea>`;
      }
      html += `<div class="nb-acts"><button type="button" data-a="txt" class="act">导出笔记</button><button type="button" data-a="clear">清空</button></div>`;
    }
    html += `<p class="nb-foot">记录只保存在这台设备的浏览器里，不会上传。模型数据不能当作真实实验的原始数据上交。</p>`;
    box.innerHTML = html;
    box.querySelector('.x').addEventListener('click', () => api.close());
    box.querySelectorAll('textarea').forEach((t) => t.addEventListener('input', () => { rec.notes[t.dataset.n] = t.value; save(db); }));
    box.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => act(b.dataset.a)));
  }
  function act(a) {
    const spec = specOf(exp), rec = rowsOf(exp);
    if (a === 'add') {
      const row = spec.sample?.(sp?.inst || {}, sp?.params || {});
      if (row) { rec.rows.push(row); save(db); render(); } else flash(spec.pending || '现在还读不出数：先让装置跑起来。');
    } else if (a === 'undo') { rec.rows.pop(); save(db); render(); }
    else if (a === 'clear') { rec.rows = []; rec.notes = {}; save(db); render(); }
    else if (a === 'csv') {
      const cols = spec.columns, q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = [cols.map((c) => q(c.label + (c.unit ? ` (${c.unit})` : ''))).join(','), ...rec.rows.map((r) => cols.map((c) => q(typeof r[c.key] === 'number' ? fmt(r[c.key], c.digits ?? 3) : r[c.key])).join(','))];
      if (rec.notes.memo) lines.push('', q('备注'), q(rec.notes.memo));
      download(`HAIZ-${exp.id}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
    } else if (a === 'txt') {
      const lines = [`# ${exp.title}`, ''];
      for (const st of spec.steps) lines.push(`## ${st.label}`, st.prompt, '', rec.notes[st.key] || '（未填写）', '');
      download(`HAIZ-${exp.id}.txt`, lines.join('\r\n'), 'text/plain;charset=utf-8');
    }
  }
  function flash(msg) { const p = box.querySelector('.nb-note'); if (p) { p.textContent = msg; p.classList.add('warn'); } }

  const api = {
    show(e, spread) { exp = e; sp = spread; render(); },
    toggle() { isOpen = !isOpen; render(); },
    close() { isOpen = false; render(); },
    /** 实验自己往表里写一行（例如“滴定到终点”时自动记一组） */
    push(e, row) { rowsOf(e).rows.push(row); save(db); if (isOpen && exp === e) render(); },
    rows: (id) => db[id]?.rows || [],
    get open() { return isOpen; },
  };
  return api;
}
