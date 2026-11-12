// HAIZ 实验册 · 书页界面、翻页与实验记录
import * as THREE from 'three';
import { Stage, PW, PH, PXU } from './stage.js';
import { paint, syncLive } from './print.js';
import { SUBJECTS, EXPERIMENTS, STAGES, KINDS } from './catalog.js';
import { initNotebook } from './notebook.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (t) => t * t * (3 - 2 * t);
const N = EXPERIMENTS.length;

const qs = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer: coarse)').matches;
const quality = qs.has('q') ? clamp(+qs.get('q'), 0, 2) : coarse && Math.min(screen.width, screen.height) < 820 ? 1 : 2;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || qs.has('still');
const flow = $('#flow'), press = $('#press');
let stage;
try { stage = new Stage($('#gl'), $('#css3d'), { quality }); } catch (e) { $('#fallback').hidden = false; throw e; }
const book = stage.book;
const PANEL_Z = PH / 2 - (6 + 95) / PXU;   // 右页下方图注与控件的中心
const PRINT_SCALE = quality >= 2 ? 3 : 2;

let cur = null, T = null, peek = null, playing = true, teachOpen = false, stacked = false;
const cache = new Map();

// ---------------------------------------------------------------- 排版保险：字体宽窄不一，放不下时整体略缩
function fit(inner) {
  if (!inner) return;
  inner.style.transform = ''; inner.style.width = ''; inner.dataset.z = '1';
  if (inner.closest('#flow')) return;
  let z = 1;
  while (inner.scrollHeight * z > inner.clientHeight + 0.5 && z > 0.7) {
    z -= 0.02;
    inner.style.transformOrigin = '0 0'; inner.style.transform = `scale(${z})`; inner.style.width = `${100 / z}%`;
  }
  inner.dataset.z = z.toFixed(2);
}

// ---------------------------------------------------------------- 一页的内容
function fmtFormula(s) { return esc(s).replace(/([一-鿿（）]+)/g, '<span>$1</span>'); }
function renderLeft(sp, leaf, live) {
  const exp = sp.exp, s = SUBJECTS[exp.subject], c = exp.course || {};
  leaf.style.setProperty('--subj', s.color);
  leaf.innerHTML = `
  <div class="side">
    <div class="margin" data-live></div>
    ${exp.challenge ? `<div class="challenge ink"><b>挑战</b>${esc(exp.challenge)}</div>` : ''}
  </div>
  <div class="main">
    <div class="ink">
      <div class="kicker"><i></i>${s.name} · ${esc(c.kindLabel || '互动演示')} ${exp.no}</div>
      <h1>${esc(exp.title)}</h1>
      <div class="en">${esc(exp.en)}</div>
      ${exp.lede.map((p) => `<p class="lede">${esc(p)}</p>`).join('')}
      <div class="formula"><div class="f">${fmtFormula(exp.formula)}</div><div class="fn">${esc(exp.formulaNote || '')}</div></div>
      <p class="cap">关键词</p>
      <dl class="terms">${exp.terms.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>
    </div>
    <div class="predict">
      <div class="ink"><p class="cap">先猜一猜</p><p class="q">${esc(exp.predict.q)}</p></div>
      <div role="radiogroup" aria-label="你的预测" data-live>${exp.predict.options.map((o, i) => `<button class="opt" type="button" role="radio" aria-checked="false" data-i="${i}"><i><u></u></i>${esc(o)}</button>`).join('')}</div>
    </div>
    <div class="flap" data-open="0" data-live>
      <div class="flap-in"><b>${esc(exp.predict.options[exp.predict.answer])}。</b>${esc(exp.predict.why)}</div>
      <button class="flap-top" type="button" aria-expanded="false"><b>为什么？</b><span>掀开这张纸看答案</span><small>先做出你的预测，再动手试一试。</small><em>从这里掀开 ↘</em></button>
    </div>
  </div>
  <div class="folio ink"><span>${exp.pageNo}</span><span>HAIZ 实验册 · ${s.name}</span></div>`;
  if (!live) return;
  const opts = [...leaf.querySelectorAll('.opt')];
  const mark = () => opts.forEach((o, i) => {
    o.classList.toggle('right', i === exp.predict.answer);
    o.classList.toggle('wrong', i !== exp.predict.answer && o.getAttribute('aria-checked') === 'true');
  });
  opts.forEach((b) => b.addEventListener('click', () => {
    opts.forEach((o) => o.setAttribute('aria-checked', o === b));
    sp.guess = +b.dataset.i;
    if (leaf.querySelector('.flap').dataset.open === '1') mark();
  }));
  const flap = leaf.querySelector('.flap'), top = flap.querySelector('.flap-top');
  top.addEventListener('click', () => { flap.dataset.open = '1'; top.setAttribute('aria-expanded', 'true'); mark(); });
}

const dec = (step) => { const s = String(step); return s.includes('.') ? s.split('.')[1].length : 0; };
function panelHTML(exp) {
  return `<div class="rin"><div class="ink"><div class="fig"><b>图 ${exp.no}</b><span>${esc(exp.fig)}</span></div><div class="hint">${esc(exp.hint || '')}</div></div><div class="controls" data-live></div></div>`;
}
function renderRight(sp, panel, live) {
  const exp = sp.exp, params = sp.params;
  panel.innerHTML = panelHTML(exp);
  const box = panel.querySelector('.controls');
  const acts = el('div', 'acts');
  for (const c of exp.controls || []) {
    if (c.type === 'button') {
      const b = el('button', 'act', esc(c.label)); b.type = 'button';
      if (live) b.addEventListener('click', () => { sp.inst?.press?.(c.id); stage.dirty = true; });
      acts.append(b); continue;
    }
    if (c.type === 'choice' || c.type === 'toggle') {
      const names = c.type === 'toggle' ? (c.options || ['关', '开']) : c.options;
      const wrap = el('div', 'seg', c.label ? `<span>${esc(c.label)}</span>` : '');
      const sel = () => (c.type === 'toggle' ? (params[c.id] ? 1 : 0) : params[c.id]);
      names.forEach((o, i) => {
        const b = el('button', '', esc(o)); b.type = 'button'; b.setAttribute('aria-pressed', i === sel());
        if (live) b.addEventListener('click', () => {
          params[c.id] = c.type === 'toggle' ? !!i : i;
          wrap.querySelectorAll('button').forEach((x, j) => x.setAttribute('aria-pressed', j === i));
          sp.inst?.change?.(c.id); stage.dirty = true;
        });
        wrap.append(b);
      });
      if (live) (sp.sync[c.id] = () => wrap.querySelectorAll('button').forEach((x, j) => x.setAttribute('aria-pressed', j === sel())));
      if (c.wide) wrap.style.gridColumn = '1/-1';
      box.append(wrap); continue;
    }
    const d = dec(c.step ?? 1);
    const wrap = el('label', 'ctl', `<span>${esc(c.label)}</span><input type="range" min="${c.min}" max="${c.max}" step="${c.step ?? 1}" value="${params[c.id]}"><output></output>`);
    const input = wrap.querySelector('input'), out = wrap.querySelector('output');
    const show = () => { out.innerHTML = `${c.fmt ? c.fmt(params[c.id]) : (+params[c.id]).toFixed(d)}${c.unit ? ` <small>${esc(c.unit)}</small>` : ''}`; };
    if (live) {
      input.addEventListener('input', () => { params[c.id] = +input.value; show(); sp.inst?.change?.(c.id); stage.dirty = true; });
      sp.sync[c.id] = () => { input.value = params[c.id]; show(); };
    }
    show();
    box.append(wrap);
  }
  if (acts.children.length) box.append(acts);
}

// ---------------------------------------------------------------- 一个摊开的实验（左页 + 右页 + 装置）
function makeTexture(cv) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
function getSpread(i) {
  let sp = cache.get(i);
  if (sp) return sp;
  const exp = EXPERIMENTS[i];
  sp = { i, exp, params: {}, sync: {}, inst: null, root: null, drags: [], plate: null, pop: 1, popV: 0, popGoal: 1, guess: null, clock: 0, marginKey: '' };
  for (const c of exp.controls || []) if (c.type !== 'button') sp.params[c.id] = c.value;
  sp.leafL = el('article', 'leaf leaf-l'); sp.leafL.setAttribute('aria-label', `${exp.title}：正文`);
  sp.leafR = el('section', 'leaf leaf-r'); sp.leafR.setAttribute('aria-label', '图注与实验控制');
  renderLeft(sp, sp.leafL, true); renderRight(sp, sp.leafR, true);
  sp.pressL = el('article', 'leaf leaf-l');
  sp.pressR = el('section', 'leaf leaf-rp', `<div class="runhead ink"><span>${esc(SUBJECTS[exp.subject].en)} · Plate ${exp.no}</span><b>${exp.pageNo + 1}</b></div><div class="leaf-r"></div>`);
  renderLeft(sp, sp.pressL, false); renderRight(sp, sp.pressR.querySelector('.leaf-r'), false);
  press.append(sp.pressL, sp.pressR);
  fit(sp.pressL.querySelector('.main')); fit(sp.pressR.querySelector('.rin'));
  sp.cvL = document.createElement('canvas'); sp.cvR = document.createElement('canvas');
  sp.texL = makeTexture(sp.cvL); sp.texR = makeTexture(sp.cvR);
  printSpread(sp, true);
  cache.set(i, sp);
  return sp;
}
/** live=true：连同控件、勾选等实时内容一起印上去（翻页时、手机上）；false：这些由贴在纸面上的 DOM 显示 */
function printSpread(sp, live) {
  paint(sp.pressL, sp.cvL, { scale: PRINT_SCALE, live, side: -1 });
  paint(sp.pressR, sp.cvR, { scale: PRINT_SCALE, live, side: 1 });
  sp.texL.needsUpdate = sp.texR.needsUpdate = true;
  sp.printedLive = live; stage.dirty = true;
}
function freeze(sp) {
  if (stacked) return;
  syncLive(sp.leafL, sp.pressL); syncLive(sp.leafR, sp.pressR.querySelector('.leaf-r'));
  printSpread(sp, true);
}
function ensureModel(sp) {
  if (sp.root) return;
  sp.root = stage.newRoot(); sp.drags = []; sp.pop = 1; sp.popV = 0;
  stage.setPop(sp.root, 1);
  const kit = {
    p: sp.params, root: sp.root,
    drag: (m, o) => stage.drag(m, o, sp.drags),
    set: (id, v) => { sp.params[id] = v; sp.sync[id]?.(); },
    record: (row) => notebook.push(sp.exp, row),
  };
  try { sp.inst = sp.exp.build(kit) || {}; } catch (e) { console.error(e); sp.inst = {}; }
  try { sp.inst.update?.(0, 0); } catch (e) { console.error(e); }
  if (!sp.plate) sp.plate = stage.newPlate();
  stage.bakePlate(sp.root, sp.plate);
}
function dropModel(sp) {
  if (!sp.root) return;
  stage.disposeRoot(sp.root); sp.root = null; sp.inst = null; sp.drags = [];
}
function dropSpread(sp) {
  dropModel(sp);
  sp.leafL.remove(); sp.leafR.remove(); sp.pressL.remove(); sp.pressR.remove();
  sp.texL.dispose(); sp.texR.dispose(); sp.plate?.dispose();
  cache.delete(sp.i);
}
function prune() { for (const sp of [...cache.values()]) if (sp !== cur && sp !== T?.next && sp !== peek?.next && Math.abs(sp.i - cur.i) > 1) dropSpread(sp); }

function mount(sp) {
  if (stacked) { flow.append(sp.leafR, sp.leafL); sp.leafL.classList.remove('printed'); sp.leafR.classList.remove('printed'); }
  else {
    stage.camEl.append(sp.leafL, sp.leafR);
    sp.leafL.classList.add('printed'); sp.leafR.classList.add('printed');
    stage.addLeaf(sp.leafL, -1, -PW / 2, 0); stage.addLeaf(sp.leafR, 1, PW / 2, PANEL_Z);
  }
  sp.leafL.classList.remove('away'); sp.leafR.classList.remove('away');
  fit(sp.leafL.querySelector('.main')); fit(sp.leafR.querySelector('.rin'));
}
function unmount(sp) { stage.removeLeaf(sp.leafL); stage.removeLeaf(sp.leafR); sp.leafL.remove(); sp.leafR.remove(); }
function restPrints() {
  book.setPrint('L', cur.texL);
  book.setPrint('R', cur.texR, cur.plate?.texture, plateK(cur));
}
const plateK = (sp) => clamp((sp.pop - 0.3) / 0.6);
const progressOf = (i) => (N > 1 ? i / (N - 1) : 0);

/** 当前实验就位：界面文字、深链接、目录高亮 */
function settle() {
  const exp = cur.exp;
  stage.drags = cur.drags;
  $('#bTitle b').textContent = `${SUBJECTS[exp.subject].short} ${exp.no}`;
  $('#bTitle span').textContent = exp.title;
  $('#bPrev').disabled = cur.i === 0; $('#bNext').disabled = cur.i === N - 1;
  document.title = `${exp.title} · HAIZ 实验册`;
  if (location.hash.slice(1) !== exp.id) history.replaceState(null, '', `${location.pathname}${location.search}#${exp.id}`);
  [...document.querySelectorAll('#tocList button')].forEach((b) => b.setAttribute('aria-current', b.dataset.id === exp.id));
  $('#live').textContent = `${SUBJECTS[exp.subject].name} ${exp.no}：${exp.title}`;
  renderTeach(); notebook.show(exp, cur);
  prune();
}
/** 不带动画地换到第 j 个实验 */
function swap(j) {
  cancelPeek(true);
  const next = getSpread(j); ensureModel(next);
  if (cur && cur !== next) { unmount(cur); dropModel(cur); }
  cur = next;
  stage.setBookProgress(progressOf(j));
  mount(cur);
  if (!stacked) printSpread(cur, false);
  cur.pop = 0; cur.popV = 0; cur.popGoal = 0; stage.setPop(cur.root, 0);
  restPrints(); settle();
}

// ---------------------------------------------------------------- 翻页
const canTurn = (dir) => !T && cur && cur.i + dir >= 0 && cur.i + dir < N;
/** 把翻动的那张纸和它上下两面、底下露出的那一页都装好 */
function arm(dir, next, grab, withPlates) {
  const pa = withPlates ? cur.plate?.texture : null, pb = withPlates ? next.plate?.texture : null;
  if (dir > 0) {
    book.setPrint('F', cur.texR, pa, plateK(cur)); book.setPrint('B', next.texL);
    book.setPrint('R', next.texR, pb, 1); book.setPrint('L', cur.texL);
  } else {
    book.setPrint('F', cur.texL); book.setPrint('B', next.texR, pb, 1);
    book.setPrint('L', next.texL); book.setPrint('R', cur.texR, pa, plateK(cur));
  }
  book.beginTurn(dir, grab);
}
/**
 * 开始翻到第 j 个实验。mode: 'auto' 自动翻完 | 'drag' 跟着指针。
 * 过程：装置收拢成纸上的图 → 纸张翻过去（背面是下一页）→ 新装置从图上立起来。
 */
function startTurn(j, mode, grab) {
  if (T || !cur || j < 0 || j >= N || j === cur.i) return null;
  const dir = j > cur.i ? 1 : -1;
  if (peek && peek.dir !== dir) cancelPeek(true);
  const next = getSpread(j);
  ensureModel(next);
  freeze(cur);
  cur.leafL.classList.add('away'); cur.leafR.classList.add('away');
  if (document.activeElement && cur.leafL.contains(document.activeElement) || cur.leafR.contains(document.activeElement)) document.activeElement.blur();
  cur.inst?.update?.(0, cur.clock);
  stage.bakePlate(cur.root, cur.plate);
  cur.popGoal = 1;
  const g = grab || { s: PW, z: PH / 2 * 0.94 };
  const from = peek ? { x: book.turn.tx, z: book.turn.tz } : null;
  arm(dir, next, peek ? { s: book.turn.gx, z: book.turn.gz } : g, true);
  const gx = book.turn.gx, gz = book.turn.gz;
  peek = null;
  T = {
    dir, next, mode, t: 0, gx, gz, x: from?.x ?? gx, z: from?.z ?? gz, sx: from?.x ?? gx, sz: from?.z ?? gz, vx: 0, vz: 0,
    goalX: gx, goalZ: gz, commit: mode === 'auto' ? true : null, f0: progressOf(cur.i), f1: progressOf(j), risen: false, hist: [],
  };
  T.done = new Promise((res) => (T.resolve = res));
  if (from) book.bend(from.x, from.z);
  stage.dirty = true;
  return T;
}
function finishTurn() {
  const { next, commit, resolve, dir } = T;
  book.endTurn();
  if (commit) {
    const old = cur;
    unmount(old); cur = next;
    stage.setBookProgress(T.f1);
    mount(cur);
    if (!stacked) printSpread(cur, false);
    cur.popGoal = 0;
    if (cur.pop > 0.999) cur.popV = 0;
    T = null;
    restPrints(); settle();
    if (old !== cur) { old.pop = 1; dropModel(old); }
  } else {
    stage.setBookProgress(T.f0);
    cur.leafL.classList.remove('away'); cur.leafR.classList.remove('away');
    if (!stacked) printSpread(cur, false);
    cur.popGoal = 0;
    T = null;
    restPrints();
    dropModel(next); next.pop = 1;
  }
  void dir;
  resolve(commit);
}
function updateTurn(dt) {
  if (!T) return;
  T.t += dt;
  const { gx, gz, dir } = T;
  if (T.mode === 'auto') {
    const u = clamp((T.t - 0.14) / 0.98), e = u * u * u * (u * (6 * u - 15) + 10);
    T.x = T.sx + (-gx - T.sx) * e;
    T.z = T.sz + (gz - T.sz) * e - Math.sign(gz || 1) * Math.min(1, Math.abs(gz) / 3) * PH * 0.2 * Math.sin(Math.PI * e);
    if (u >= 1) { finishTurn(); return; }
  } else {
    // 拖动：纸有一点惯性地跟着手；松手后用临界阻尼弹簧滑向终点或弹回
    const w = T.mode === 'drag' ? 26 : 9.5;
    const ax = w * w * (T.goalX - T.x) - 2 * w * T.vx, az = w * w * (T.goalZ - T.z) - 2 * w * T.vz;
    T.vx += ax * dt; T.vz += az * dt; T.x += T.vx * dt; T.z += T.vz * dt;
    if (T.mode === 'settle' && Math.abs(T.goalX - T.x) < 0.03 && Math.abs(T.vx) < 0.4) { T.x = T.goalX; T.z = T.goalZ; book.bend(T.x, T.z); finishTurn(); return; }
  }
  book.bend(T.x, T.z);
  const p = book.turn.p;
  stage.setBookProgress(T.f0 + (T.f1 - T.f0) * ease(p));
  // 下一页的装置：纸翻过去、不再遮挡之后才立起来
  if (T.commit && !T.risen && dir > 0 && p > 0.9) { T.risen = true; T.next.popGoal = 0; }
  stage.dirty = true;
}
/** 指针位置 → 翻动页上被抓住的点应当到的地方（规范方向坐标） */
const _hit = new THREE.Vector3();
function pagePoint(ev, dir, lift) {
  const ray = stage.ray(ev).ray, h = (dir > 0 ? book.hR : book.hL) + lift;
  const t = (h - ray.origin.y) / ray.direction.y;
  _hit.copy(ray.direction).multiplyScalar(t).add(ray.origin);
  return { x: dir * _hit.x, z: _hit.z };
}
function grabLift() {
  const t = book.turn; if (!t || t.c === undefined) return 0;
  const d = t.gx * t.nx + t.gz * t.nz - t.c;
  return d <= 0 ? 0 : d < Math.PI * t.R ? t.R * (1 - Math.cos(d / t.R)) : 2 * t.R;
}
stage.on('busy', () => !!T);
stage.on('canTurn', canTurn);
stage.on('turnHover', (z) => setPeek(z));
stage.on('turnStart', (z, ev) => {
  if (!canTurn(z.dir) || reduced) { if (reduced && canTurn(z.dir)) open(cur.i + z.dir); return false; }
  const t = startTurn(cur.i + z.dir, 'drag', { s: z.s, z: z.z });
  if (!t) return false;
  const p0 = pagePoint(ev, z.dir, 0);
  t.p0 = p0; t.gain = z.far || stacked ? 1.6 : 1;
  t.goalX = t.x; t.goalZ = t.z;
  return true;
});
stage.on('turnMove', (ev) => {
  if (!T || T.mode !== 'drag') return;
  const p = pagePoint(ev, T.dir, grabLift() * 0.9);
  T.goalX = clamp(T.gx + (p.x - T.p0.x) * T.gain, -T.gx - 1.5, T.gx + 0.5);
  T.goalZ = T.gz + (p.z - T.p0.z);
  const now = performance.now();
  T.hist.push([now, T.goalX]); while (T.hist.length > 2 && now - T.hist[0][0] > 110) T.hist.shift();
});
stage.on('turnEnd', (ev, turn, cancelled) => {
  if (!T || T.mode !== 'drag') return;
  if (!turn.moved && !cancelled && performance.now() - turn.t < 500) {   // 轻点页边：直接翻过去
    T.mode = 'auto'; T.commit = true; T.t = 0.14; T.sx = T.x; T.sz = T.z; return;
  }
  const h = T.hist, v = h.length > 1 ? (h[h.length - 1][1] - h[0][1]) / Math.max(0.016, (h[h.length - 1][0] - h[0][0]) / 1000) : 0;
  const p = book.turn.p;
  T.commit = !cancelled && (v < -14 || (p > 0.42 && v < 14));
  T.mode = 'settle';
  T.goalX = T.commit ? -T.gx : T.gx; T.goalZ = T.gz;
});

// 页角的提示：指针靠近页边时，纸角微微翘起，露出下一页
function setPeek(zone) {
  if (T || reduced || stacked) return;
  if (!zone || !canTurn(zone.dir)) { if (peek) peek.goal = 0; return; }
  const gz = zone.z >= 0 ? PH / 2 : -PH / 2;
  if (peek && (peek.dir !== zone.dir || peek.gz !== gz)) cancelPeek(true);
  if (!peek) {
    const next = getSpread(cur.i + zone.dir);
    arm(zone.dir, next, { s: PW, z: gz }, false);
    peek = { dir: zone.dir, gz, a: 0, goal: 1, next };
  }
  peek.goal = 1;
}
function cancelPeek(now) {
  if (!peek) return;
  if (now) { book.endTurn(); peek = null; if (cur) restPrints(); stage.dirty = true; } else peek.goal = 0;
}
function updatePeek(dt) {
  if (!peek || T) return;
  peek.a += (peek.goal - peek.a) * (1 - Math.exp(-11 * dt));
  if (peek.goal === 0 && peek.a < 0.012) { cancelPeek(true); return; }
  const s = Math.sign(peek.gz);
  book.bend(PW - 1.05 * peek.a, peek.gz - s * 0.6 * peek.a);
  if (Math.abs(peek.goal - peek.a) > 0.002) stage.dirty = true;
}
/** 立体装置的收拢与立起：一根带点回弹的弹簧 */
function updatePops(dt) {
  for (const sp of cache.values()) {
    if (!sp.root) continue;
    if (Math.abs(sp.popGoal - sp.pop) < 0.0015 && Math.abs(sp.popV) < 0.01) {
      if (sp.pop !== sp.popGoal) { sp.pop = sp.popGoal; stage.setPop(sp.root, sp.pop); }
      continue;
    }
    const down = sp.popGoal > 0.5, w = down ? 17 : 8.5, zeta = down ? 1 : 0.6;
    sp.popV += (w * w * (sp.popGoal - sp.pop) - 2 * zeta * w * sp.popV) * dt;
    sp.pop = Math.min(1, sp.pop + sp.popV * dt);
    if (sp.pop >= 1) sp.popV = Math.min(0, sp.popV);
    stage.setPop(sp.root, sp.pop);
  }
  if (cur) {
    const k = plateK(cur);
    if (T) { book.setPlateK(T.dir > 0 ? 'F' : 'R', k); book.setPlateK(T.dir > 0 ? 'R' : 'B', plateK(T.next)); }
    else if (!peek) book.setPlateK('R', k);
  }
}

/** 打开第 i 个实验。quick：不放动画。返回的 Promise 在翻页结束后完成。 */
async function open(i, quick) {
  i = clamp(i, 0, N - 1);
  if (T) { await T.done; }
  if (!cur || quick || reduced) { if (!cur || i !== cur.i) swap(i); stage.resetView(); return true; }
  if (i === cur.i) return true;
  if (stage.shot === 'left' || stage.shot === 'right') stage.resetView();
  const t = startTurn(i, 'auto');
  return t ? t.done : false;
}

// ---------------------------------------------------------------- 布局：横屏贴在书上，竖屏排在下面
function layout() {
  const st = innerWidth < 860 || innerWidth / innerHeight < 1.12;
  const changed = st !== stacked;
  stacked = st;
  document.body.classList.toggle('stacked', stacked);
  stage.setStacked(stacked);
  stage.resize();
  if (cur && changed) { cancelPeek(true); unmount(cur); mount(cur); printSpread(cur, stacked); restPrints(); }
  else if (cur) { fit(cur.leafL.querySelector('.main')); fit(cur.leafR.querySelector('.rin')); }
}
addEventListener('resize', layout);

// ---------------------------------------------------------------- 教师备课
function renderTeach() {
  const exp = cur.exp, t = exp.teach || {}, c = exp.course || {}, box = $('#teach');
  box.hidden = !teachOpen;
  $('#bTeach').setAttribute('aria-pressed', teachOpen);
  if (!teachOpen) return;
  box.innerHTML = `<button class="x" type="button" aria-label="关闭">×</button>
    <h3>教师备课 · ${SUBJECTS[exp.subject].name} ${exp.no}</h3><h2>${esc(exp.title)}</h2>
    <h3>教学定位</h3><p><b>${esc(c.kindLabel || '互动演示')}</b> · ${esc(c.stageLabel || '')}${c.grade ? ` · ${esc(c.grade)}` : ''}</p>
    ${c.book ? `<p>${esc(c.book)}</p>` : t.where ? `<p>${esc(t.where)}</p>` : ''}
    ${c.basis ? `<p class="basis">依据：${esc(c.basis)}${c.checked ? '' : '（章节位置未逐页核对，请以手头教材为准）'}</p>` : ''}
    ${t.ask ? `<h3>课堂追问</h3><ul>${t.ask.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}
    ${t.simplify ? `<h3>模型做了哪些简化</h3><p>${esc(t.simplify)}</p>` : ''}
    ${t.safety ? `<h3>真实实验提醒</h3><p class="warn">${esc(t.safety)}</p>` : ''}
    <h3>用法</h3><p>全屏后投影；先让学生在左页投票预测，再操作装置，最后掀开答案。点页边或拖页角翻页，← → 也可以；空格暂停；拖空白处转视角，双击某一页凑近看。</p>`;
  box.querySelector('.x').addEventListener('click', () => { teachOpen = false; renderTeach(); });
}

// ---------------------------------------------------------------- 目录：按学科 / 学段 / 性质检索
const filt = { stage: '', kind: '', q: '' };
function renderToc() {
  const list = $('#tocList'); list.innerHTML = '';
  const q = filt.q.trim().toLowerCase();
  let shown = 0;
  for (const [key, s] of Object.entries(SUBJECTS)) {
    const items = EXPERIMENTS.filter((e) => e.subject === key && (!filt.stage || e.course?.stage === filt.stage) && (!filt.kind || e.course?.kind === filt.kind)
      && (!q || `${e.title} ${e.en} ${s.name} ${e.course?.book || ''} ${e.course?.grade || ''}`.toLowerCase().includes(q)));
    if (!items.length) continue;
    shown += items.length;
    const sec = el('section', 'toc-sub', `<h3><i></i>${s.name}<em>${s.en}</em></h3>`);
    sec.style.setProperty('--subj', s.color);
    for (const e of items) {
      const c = e.course || {};
      const b = el('button', '', `<b>${e.no}</b><span class="t">${esc(e.title)}<small>${esc([c.stageShort, c.kindLabel].filter(Boolean).join(' · '))}</small></span><span class="e">${esc(e.en)}</span>`);
      b.type = 'button'; b.dataset.id = e.id;
      b.setAttribute('aria-current', cur?.exp.id === e.id);
      b.addEventListener('click', () => { $('#toc').hidden = true; open(EXPERIMENTS.indexOf(e)); });
      sec.append(b);
    }
    list.append(sec);
  }
  $('#tocCount').textContent = `${shown} / ${N} 页`;
}
function initToc() {
  const bar = $('#tocFilter');
  const group = (name, key, opts) => {
    const g = el('div', 'chips'); g.setAttribute('role', 'group'); g.setAttribute('aria-label', name);
    g.append(el('span', '', name));
    for (const [v, label] of [['', '全部'], ...opts]) {
      const b = el('button', '', esc(label)); b.type = 'button'; b.setAttribute('aria-pressed', filt[key] === v);
      b.addEventListener('click', () => { filt[key] = v; g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); renderToc(); });
      g.append(b);
    }
    bar.append(g);
  };
  group('学段', 'stage', Object.entries(STAGES).map(([k, v]) => [k, v.label]));
  group('性质', 'kind', Object.entries(KINDS).map(([k, v]) => [k, v.label]));
  const search = el('input'); search.type = 'search'; search.placeholder = '搜索标题、学科、教材…'; search.setAttribute('aria-label', '搜索实验');
  search.addEventListener('input', () => { filt.q = search.value; renderToc(); });
  bar.append(search);
}

// ---------------------------------------------------------------- 工具栏
const notebook = initNotebook({ get cur() { return cur; }, esc, el, SUBJECTS });
$('#bPrev').addEventListener('click', () => open(cur.i - 1));
$('#bNext').addEventListener('click', () => open(cur.i + 1));
$('#bToc').addEventListener('click', () => { renderToc(); $('#toc').hidden = false; $('#tocClose').focus(); });
$('#tocClose').addEventListener('click', () => { $('#toc').hidden = true; });
$('#toc').addEventListener('click', (e) => { if (e.target.id === 'toc') $('#toc').hidden = true; });
const setPlaying = (v) => { playing = v; $('#bPlay').setAttribute('aria-pressed', !v); stage.dirty = true; };
$('#bPlay').addEventListener('click', () => setPlaying(!playing));
$('#bReset').addEventListener('click', () => {
  if (T) return;
  const i = cur.i; unmount(cur); dropSpread(cur); cur = null; swap(i); stage.resetView();
});
$('#bTeach').addEventListener('click', () => { teachOpen = !teachOpen; renderTeach(); });
$('#bRec').addEventListener('click', () => notebook.toggle());
$('#bFull').addEventListener('click', () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => {}); });
if (!document.documentElement.requestFullscreen) $('#bFull').hidden = true;
addEventListener('keydown', (e) => {
  if (e.target.matches('input,textarea,select') && e.key !== 'Escape') return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') open(cur.i + 1);
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') open(cur.i - 1);
  else if (e.key === 'Home') open(0);
  else if (e.key === 'End') open(N - 1);
  else if (e.key === ' ' && !e.target.matches('button')) { e.preventDefault(); setPlaying(!playing); }
  else if (e.key === 'Escape') { $('#toc').hidden = true; teachOpen = false; renderTeach(); notebook.close(); stage.resetView(); }
});
addEventListener('hashchange', () => {
  const i = EXPERIMENTS.findIndex((e) => e.id === location.hash.slice(1));
  if (i >= 0 && cur && i !== cur.i) open(i);
});
// 触控板横向滑动：翻页
let wheelAcc = 0, wheelT = 0;
$('#gl').addEventListener('wheel', (e) => {
  if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.2) return;
  e.preventDefault();
  const now = performance.now(); if (now - wheelT > 400) wheelAcc = 0; wheelT = now;
  wheelAcc += e.deltaX;
  if (Math.abs(wheelAcc) > 120 && !T) { open(cur.i + Math.sign(wheelAcc)); wheelAcc = 0; }
}, { passive: false });

// ---------------------------------------------------------------- 主循环（按需渲染）
let last = performance.now(), mAcc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const real = (now - last) / 1000, dt = Math.min(0.05, real); last = now;
  if (document.hidden || !cur) return;
  stage.tick(dt);
  updateTurn(dt); updatePeek(dt); updatePops(dt);
  const sp = cur, live = sp.inst && sp.pop < 0.5 && !T;
  const d = playing && live ? dt : 0;
  if (live && sp.inst.update) {
    sp.clock += d;
    try { sp.inst.update(d, sp.clock); } catch (e) { if (!frame.err) { frame.err = 1; console.error(e); } }
    if (d > 0) stage.dirty = true;
  }
  mAcc += real;
  if (mAcc > 0.12 && sp.inst?.margin && live) {
    mAcc = 0;
    const lines = sp.inst.margin() || [], key = lines.join('\n');
    if (key !== sp.marginKey) { sp.marginKey = key; const m = sp.leafL.querySelector('.margin'); if (m) m.innerHTML = lines.map((l) => `<span>${esc(l)}</span>`).join(''); }
  }
  if (stage.dirty) {
    stage.render();
    if (!qs.has('fixed')) stage.adapt(real * 1000);
  }
}

const start = Math.max(0, EXPERIMENTS.findIndex((e) => e.id === location.hash.slice(1)));
(document.fonts?.ready || Promise.resolve()).then(async () => {
  try { await Promise.all([document.fonts.load('italic 20px "Cormorant Garamond"'), document.fonts.load('500 20px "Cormorant Garamond"')]); } catch {}
  initToc(); layout();
  await open(start, true);
  renderToc();
  document.body.classList.add('ready');
  requestAnimationFrame(frame);
});
window.__lab = {
  stage, book, open, list: EXPERIMENTS, notebook,
  get inst() { return cur?.inst; }, get params() { return cur?.params; }, get index() { return cur?.i; },
  get turning() { return !!T; }, get turn() { return T; }, get spread() { return cur; },
};
