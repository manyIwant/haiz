// HAIZ 实验册 · 书页界面与翻页
import { Stage, PW, PH, PXU } from './stage.js';
import { SUBJECTS, EXPERIMENTS } from './catalog.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const leafL = $('#leafL'), leafR = $('#leafR'), flow = $('#flow');
let stage;
try { stage = new Stage($('#gl'), $('#css3d')); } catch (e) { $('#fallback').hidden = false; throw e; }

stage.addLeaf(leafL, -PW / 2 - 0.05, 0);
stage.addLeaf(leafR, PW / 2 + 0.05, PH / 2 - 190 / PXU / 2 - 0.12);

let index = 0, inst = null, exp = null, params = {}, playing = true, marginKey = '', teachOpen = false;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 布局：横屏贴在书上，竖屏排在下面 ----------
function layout() {
  const stacked = innerWidth < 860 || innerWidth / innerHeight < 1.12;
  document.body.classList.toggle('stacked', stacked);
  const home = stacked ? flow : stage.camEl;
  if (leafL.parentNode !== home) { if (stacked) { home.append(leafR, leafL); } else { home.append(leafL, leafR); } }
  stage.setStacked(stacked);
  stage.resize();
  refit();
}
addEventListener('resize', layout);
layout();

// ---------- 排版保险：不同系统的字体宽窄不一，内容放不下时整体略微缩小 ----------
function fit(inner) {
  if (!inner) return;
  inner.style.transform = ''; inner.style.width = ''; inner.dataset.z = '1';
  if (document.body.classList.contains('stacked')) return;
  let z = 1;
  while (inner.scrollHeight * z > inner.clientHeight + 0.5 && z > 0.7) {
    z -= 0.02;
    inner.style.transformOrigin = '0 0'; inner.style.transform = `scale(${z})`; inner.style.width = `${100 / z}%`;
  }
  inner.dataset.z = z.toFixed(2);
}
function refit() { fit(leafL.querySelector('.main')); fit(leafR.querySelector('.rin')); }

// ---------- 左页 ----------
function fmtFormula(s) { return esc(s).replace(/([一-鿿（）]+)/g, '<span>$1</span>'); }
function renderLeft() {
  const s = SUBJECTS[exp.subject];
  leafL.style.setProperty('--subj', s.color);
  leafL.innerHTML = `
  <div class="side">
    <div class="margin" id="margin"></div>
    ${exp.challenge ? `<div class="challenge"><b>挑战</b>${esc(exp.challenge)}</div>` : ''}
  </div>
  <div class="main">
    <div class="kicker"><i></i>${s.name} · 实验 ${exp.no}</div>
    <h1>${esc(exp.title)}</h1>
    <div class="en">${esc(exp.en)}</div>
    ${exp.lede.map((p) => `<p class="lede">${esc(p)}</p>`).join('')}
    <div class="formula"><div class="f">${fmtFormula(exp.formula)}</div><div class="fn">${esc(exp.formulaNote || '')}</div></div>
    <p class="cap">关键词</p>
    <dl class="terms">${exp.terms.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>
    <div class="predict">
      <p class="cap">先猜一猜</p>
      <p class="q">${esc(exp.predict.q)}</p>
      <div role="radiogroup" aria-label="你的预测">${exp.predict.options.map((o, i) => `<button class="opt" type="button" role="radio" aria-checked="false" data-i="${i}"><i></i>${esc(o)}</button>`).join('')}</div>
    </div>
    <div class="flap" data-open="0">
      <div class="flap-in"><b>${esc(exp.predict.options[exp.predict.answer])}。</b>${esc(exp.predict.why)}</div>
      <button class="flap-top" type="button" aria-expanded="false"><b>为什么？</b><span>掀开这张纸看答案</span><small>……先做出你的预测，再动手试一试。</small><em>从这里掀开 ↘</em></button>
    </div>
  </div>
  <div class="folio"><span>${exp.no * 2}</span><span>HAIZ 实验册 · ${s.name}</span></div>`;
  const opts = [...leafL.querySelectorAll('.opt')];
  opts.forEach((b) => b.addEventListener('click', () => {
    opts.forEach((o) => o.setAttribute('aria-checked', o === b));
    if (leafL.querySelector('.flap').dataset.open === '1') mark();
  }));
  const mark = () => opts.forEach((o, i) => {
    o.classList.toggle('right', i === exp.predict.answer);
    o.classList.toggle('wrong', i !== exp.predict.answer && o.getAttribute('aria-checked') === 'true');
  });
  const flap = leafL.querySelector('.flap'), top = flap.querySelector('.flap-top');
  top.addEventListener('click', () => { flap.dataset.open = '1'; top.setAttribute('aria-expanded', 'true'); mark(); });
  fit(leafL.querySelector('.main'));
}

// ---------- 右页下方：图注 + 控件 ----------
const dec = (step) => { const s = String(step); return s.includes('.') ? s.split('.')[1].length : 0; };
function renderRight() {
  leafR.innerHTML = `<div class="rin"><div class="fig"><b>图 ${exp.no}</b><span>${esc(exp.fig)}</span></div><div class="hint">${esc(exp.hint || '')}</div><div class="controls"></div></div>`;
  const box = leafR.querySelector('.controls');
  const acts = el('div', 'acts');
  params = {};
  for (const c of exp.controls || []) {
    if (c.type === 'button') {
      const b = el('button', 'act', esc(c.label)); b.type = 'button';
      b.addEventListener('click', () => inst?.press?.(c.id));
      acts.append(b); continue;
    }
    params[c.id] = c.value;
    if (c.type === 'choice') {
      const wrap = el('div', 'seg', c.label ? `<span>${esc(c.label)}</span>` : '');
      c.options.forEach((o, i) => {
        const b = el('button', '', esc(o)); b.type = 'button'; b.setAttribute('aria-pressed', i === c.value);
        b.addEventListener('click', () => {
          params[c.id] = i; wrap.querySelectorAll('button').forEach((x, j) => x.setAttribute('aria-pressed', j === i));
          inst?.change?.(c.id);
        });
        wrap.append(b);
      });
      if (c.wide) wrap.style.gridColumn = '1/-1';
      box.append(wrap); continue;
    }
    if (c.type === 'toggle') {
      const wrap = el('div', 'seg', `<span>${esc(c.label)}</span>`);
      ['关', '开'].forEach((o, i) => {
        const b = el('button', '', (c.options || ['关', '开'])[i]); b.type = 'button'; b.setAttribute('aria-pressed', !!c.value === !!i);
        b.addEventListener('click', () => {
          params[c.id] = !!i; wrap.querySelectorAll('button').forEach((x, j) => x.setAttribute('aria-pressed', j === i));
          inst?.change?.(c.id);
        });
        wrap.append(b);
      });
      box.append(wrap); continue;
    }
    const d = dec(c.step ?? 1);
    const wrap = el('label', 'ctl', `<span>${esc(c.label)}</span><input type="range" min="${c.min}" max="${c.max}" step="${c.step ?? 1}" value="${c.value}"><output></output>`);
    const input = wrap.querySelector('input'), out = wrap.querySelector('output');
    const show = () => { out.innerHTML = `${c.fmt ? c.fmt(params[c.id]) : (+params[c.id]).toFixed(d)}${c.unit ? ` <small>${esc(c.unit)}</small>` : ''}`; };
    input.addEventListener('input', () => { params[c.id] = +input.value; show(); inst?.change?.(c.id); });
    c._sync = () => { input.value = params[c.id]; show(); };
    show();
    box.append(wrap);
  }
  if (acts.children.length) box.append(acts);
  fit(leafR.querySelector('.rin'));
}

// ---------- 教师备课 ----------
function renderTeach() {
  const t = exp.teach || {}, box = $('#teach');
  box.hidden = !teachOpen;
  $('#bTeach').setAttribute('aria-pressed', teachOpen);
  if (!teachOpen) return;
  box.innerHTML = `<button class="x" type="button" aria-label="关闭">×</button>
    <h3>教师备课 · ${SUBJECTS[exp.subject].name} ${exp.no}</h3><h2>${esc(exp.title)}</h2>
    ${t.where ? `<h3>对应内容</h3><p>${esc(t.where)}</p>` : ''}
    ${t.ask ? `<h3>课堂追问</h3><ul>${t.ask.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}
    ${t.simplify ? `<h3>模型做了哪些简化</h3><p>${esc(t.simplify)}</p>` : ''}
    ${t.safety ? `<h3>真实实验提醒</h3><p class="warn">${esc(t.safety)}</p>` : ''}
    <h3>用法</h3><p>全屏后投影；先让学生在左页投票预测，再操作装置，最后掀开答案。空格键暂停，← → 翻页，拖动空白处可转动视角，双击复位。</p>`;
  box.querySelector('.x').addEventListener('click', () => { teachOpen = false; renderTeach(); });
}

// ---------- 打开一个实验 ----------
function build() {
  stage.clear();
  renderLeft(); renderRight(); renderTeach();
  marginKey = ''; mAcc = 1;
  const kit = {
    p: params, root: stage.root,
    drag: (m, o) => stage.drag(m, o),
    set: (id, v) => { params[id] = v; exp.controls.find((c) => c.id === id)?._sync?.(); },
  };
  try { inst = exp.build(kit) || {}; } catch (e) { console.error(e); inst = {}; }
  $('#bTitle b').textContent = `${SUBJECTS[exp.subject].short} ${exp.no}`;
  $('#bTitle span').textContent = exp.title;
  $('#bPrev').disabled = index === 0; $('#bNext').disabled = index === EXPERIMENTS.length - 1;
  document.title = `${exp.title} · HAIZ 实验册`;
  [...document.querySelectorAll('#tocList button')].forEach((b) => b.setAttribute('aria-current', b.dataset.id === exp.id));
}
async function open(i, quick) {
  i = Math.max(0, Math.min(EXPERIMENTS.length - 1, i));
  if (stage.turning) return;
  const dir = i >= index ? 1 : -1;
  await stage.turn(dir, async () => {
    index = i; exp = EXPERIMENTS[i];
    build();
    if (location.hash.slice(1) !== exp.id) history.replaceState(null, '', `#${exp.id}`);
  }, quick || reduced);
  stage.resetView();
}

// ---------- 目录 ----------
function renderToc() {
  const list = $('#tocList');
  for (const [key, s] of Object.entries(SUBJECTS)) {
    const items = EXPERIMENTS.filter((e) => e.subject === key);
    if (!items.length) continue;
    const sec = el('section', 'toc-sub', `<h3><i></i>${s.name}<em>${s.en}</em></h3>`);
    sec.style.setProperty('--subj', s.color);
    for (const e of items) {
      const b = el('button', '', `<b>${e.no}</b>${esc(e.title)}<span>${esc(e.en)}</span>`); b.type = 'button'; b.dataset.id = e.id;
      b.addEventListener('click', () => { $('#toc').hidden = true; open(EXPERIMENTS.indexOf(e)); });
      sec.append(b);
    }
    list.append(sec);
  }
}
renderToc();

// ---------- 工具栏 ----------
$('#bPrev').addEventListener('click', () => open(index - 1));
$('#bNext').addEventListener('click', () => open(index + 1));
$('#bToc').addEventListener('click', () => { $('#toc').hidden = false; });
$('#tocClose').addEventListener('click', () => { $('#toc').hidden = true; });
$('#toc').addEventListener('click', (e) => { if (e.target.id === 'toc') $('#toc').hidden = true; });
const setPlaying = (v) => { playing = v; $('#bPlay').setAttribute('aria-pressed', !v); };
$('#bPlay').addEventListener('click', () => setPlaying(!playing));
$('#bReset').addEventListener('click', () => { build(); stage.resetView(); });
$('#bTeach').addEventListener('click', () => { teachOpen = !teachOpen; renderTeach(); });
$('#bFull').addEventListener('click', () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => {}); });
if (!document.documentElement.requestFullscreen) $('#bFull').hidden = true;
addEventListener('keydown', (e) => {
  if (e.target.matches('input,textarea') && e.key !== 'Escape') return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') open(index + 1);
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') open(index - 1);
  else if (e.key === ' ') { e.preventDefault(); setPlaying(!playing); }
  else if (e.key === 'Escape') { $('#toc').hidden = true; teachOpen = false; renderTeach(); }
});
addEventListener('hashchange', () => {
  const i = EXPERIMENTS.findIndex((e) => e.id === location.hash.slice(1));
  if (i >= 0 && i !== index) open(i);
});

// ---------- 主循环 ----------
let last = performance.now(), clock = 0, mAcc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const real = (now - last) / 1000, dt = Math.min(0.05, real); last = now;
  if (document.hidden) return;
  const d = playing ? dt : 0;
  clock += d;
  try { inst?.update?.(d, clock); } catch (e) { if (!frame.err) { frame.err = 1; console.error(e); } }
  mAcc += real;
  if (mAcc > 0.12 && inst?.margin) {
    mAcc = 0;
    const lines = inst.margin() || [], key = lines.join('\n');
    if (key !== marginKey) { marginKey = key; const m = $('#margin'); if (m) m.innerHTML = lines.map((l) => `<span>${esc(l)}</span>`).join(''); }
  }
  stage.render();
}

const start = Math.max(0, EXPERIMENTS.findIndex((e) => e.id === location.hash.slice(1)));
(document.fonts?.ready || Promise.resolve()).then(async () => {
  try { await Promise.all([document.fonts.load('italic 20px "Cormorant Garamond"'), document.fonts.load('500 20px "Cormorant Garamond"')]); } catch {}
  await open(start, true);
  document.body.classList.add('ready');
  requestAnimationFrame(frame);
});
window.__lab = { stage, open, list: EXPERIMENTS, get inst() { return inst; }, get params() { return params; } };
