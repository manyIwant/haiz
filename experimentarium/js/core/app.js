// HAIZ · EXPERIMENTARIUM — 全学科数字实验手册主控引擎
import * as THREE from 'three';
import { Stage, PW, PH, PXU } from './stage.js';
import { paint, syncLive } from './print.js';
import { loadCurriculumMatrix, buildCatalog, getExperimentByMeta, loadDomainPack } from './catalog.js';
import { initJournal } from './journal.js';
import { initWorkbench } from './workbench.js';
import { initMatrixAndToc } from './matrix-ui.js';
import { renderEpistemicBar } from './epistemic.js';
import { parseLaunchQuery, registerBridge } from './bridge.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (t) => t * t * (3 - 2 * t);

const launch = parseLaunchQuery();
const isWebKit = /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(navigator.userAgent);
if (isWebKit) document.documentElement.classList.add('webkit-safe');
if (launch.embed) document.documentElement.classList.add('embed-mode');

const coarse = matchMedia('(pointer: coarse)').matches;
const quality = launch.quality !== null && Number.isFinite(launch.quality)
  ? clamp(launch.quality, 0, 2)
  : (coarse && Math.min(screen.width, screen.height) < 820 ? 1 : 2);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || launch.still;

const flow = $('#flow');
const press = $('#press');
let stage;
try {
  stage = new Stage($('#gl'), $('#css3d'), { quality });
} catch (e) {
  $('#fallback').hidden = false;
  throw e;
}
const book = stage.book;
const PANEL_Z = PH / 2 - (6 + 95) / PXU;
const PRINT_SCALE = quality >= 2 ? 3 : 2;

let catalog = null;
let N = 0;
let cur = null;
let T = null;
let peek = null;
let playing = true;
let teachOpen = false;
let stacked = false;
let spaceMode = 'spread'; // spread | gatefold | workbench
let mobileTab = 'read';   // read | workbench | journal
const cache = new Map();
const memory = new Map();
const memoryOf = (id) => {
  let m = memory.get(id);
  if (!m) memory.set(id, (m = {}));
  return m;
};

function fit(inner) {
  if (!inner) return;
  inner.style.transform = '';
  inner.style.width = '';
  inner.dataset.z = '1';
  if (inner.closest('#flow')) return;
  let z = 1;
  while (inner.scrollHeight * z > inner.clientHeight + 0.5 && z > 0.72) {
    z -= 0.02;
    inner.style.transformOrigin = '0 0';
    inner.style.transform = `scale(${z})`;
    inner.style.width = `${100 / z}%`;
  }
  inner.dataset.z = z.toFixed(2);
}

function fmtFormula(s) {
  return esc(s).replace(/([一-鿿（）]+)/g, '<span>$1</span>');
}

function renderLeft(sp, leaf, live) {
  const exp = sp.exp;
  const meta = exp.meta || {};
  const s = catalog.subjects[exp.subject];
  const lvl = meta.implementation?.currentLevel || 'L3';
  const isMust = meta.curriculum?.isCoreCurriculumExperiment;
  const actMap = { must: '课标必做', lab: '教材实验', inquiry: '证据探究', model: '学科建模', reference: '参考资料' };
  const actLabel = actMap[meta.curriculum?.activityType] || '互动实验';
  const epKinds = meta.science?.epistemicKinds || ['theory', 'model'];

  leaf.style.setProperty('--subj', s.color);
  leaf.innerHTML = `
  <div class="side">
    <div class="margin" data-live></div>
    ${exp.challenge ? `<div class="challenge ink"><b>探究挑战</b>${esc(exp.challenge)}</div>` : ''}
  </div>
  <div class="main">
    <div class="ink">
      <div class="kicker">
        <i></i><span>${esc(s.name)} · ${esc(actLabel)} ${exp.no}</span>
        <em class="lvl-pill lvl-${esc(lvl)}">${esc(lvl)}</em>
        ${isMust ? '<em class="must-pill">必做</em>' : ''}
      </div>
      <h1>${esc(exp.title)}</h1>
      <div class="en">${esc(exp.en)}</div>
      ${exp.lede.map((p) => `<p class="lede">${esc(p)}</p>`).join('')}
      ${exp.law ? '' : `<div class="formula"><div class="f">${fmtFormula(exp.formula)}</div><div class="fn">${esc(exp.formulaNote || '')}</div></div>`}
    </div>
    ${exp.law ? `<div class="formula law" data-live data-law>${exp.law.html || ''}</div>` : ''}
    ${exp.figure ? `<figure class="pfig"><div class="pfig-c" data-live data-fig style="height:${exp.figure.h || 108}px"><canvas></canvas></div><figcaption class="ink"><b>图</b>${esc(exp.figure.caption || '')}</figcaption></figure>` : ''}
    <div class="ep-bar ink">${renderEpistemicBar(epKinds)}</div>
    ${exp.law || exp.figure ? '' : `<div class="ink"><p class="cap">关键词</p><dl class="terms">${(exp.terms || []).map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl></div>`}
    <div class="predict">
      <div class="ink"><p class="cap">先猜一猜</p><p class="q">${esc(exp.predict.q)}</p></div>
      <div role="radiogroup" aria-label="你的预测" data-live>${exp.predict.options.map((o, i) => `<button class="opt" type="button" role="radio" aria-checked="false" data-i="${i}"><i><u></u></i>${esc(o)}</button>`).join('')}</div>
    </div>
    <div class="flap" data-open="0" data-live>
      <div class="flap-in"><b>${esc(exp.predict.options[exp.predict.answer])}。</b>${esc(exp.predict.why)}</div>
      <button class="flap-top" type="button" aria-expanded="false"><b>科学解释</b><span>掀开看原因</span><small>先选出你的预测，再动手操作验证。</small><em>从这里掀开 ↘</em></button>
    </div>
  </div>
  <div class="folio ink"><span>${exp.pageNo}</span><span>HAIZ Experimentarium · ${esc(s.name)}</span></div>`;

  if (!live) return;
  const opts = [...leaf.querySelectorAll('.opt')];
  const mark = () => opts.forEach((o, i) => {
    o.classList.toggle('right', i === exp.predict.answer);
    o.classList.toggle('wrong', i !== exp.predict.answer && o.getAttribute('aria-checked') === 'true');
  });
  opts.forEach((b) => b.addEventListener('click', () => {
    opts.forEach((o) => o.setAttribute('aria-checked', String(o === b)));
    sp.guess = +b.dataset.i;
    if (leaf.querySelector('.flap').dataset.open === '1') mark();
  }));
  const flap = leaf.querySelector('.flap');
  const top = flap.querySelector('.flap-top');
  top.addEventListener('click', () => {
    flap.dataset.open = '1';
    top.setAttribute('aria-expanded', 'true');
    mark();
  });
}

const dec = (step) => {
  const s = String(step);
  return s.includes('.') ? s.split('.')[1].length : 0;
};

function renderRight(sp, panel, live) {
  const exp = sp.exp;
  const params = sp.params;
  panel.innerHTML = `<div class="rin">
    <div class="ink">
      <div class="fig"><b>图 ${exp.no}</b><span>${esc(exp.fig)}</span><button type="button" class="wb-launch" data-wb-launch>${exp.meta?.implementation?.hasWorkbench ? '展开实验台 ⤢' : '数据工作台 ⤢'}</button></div>
      <div class="hint">${esc(exp.hint || '')}</div>
    </div>
    <div class="controls" data-live></div>
  </div>`;

  if (live) {
    panel.querySelector('[data-wb-launch]')?.addEventListener('click', () => {
      if (stacked) setMobileTab('workbench');
      else workbench.toggle(sp);
    });
  }

  const box = panel.querySelector('.controls');
  const acts = el('div', 'acts');
  for (const c of exp.controls || []) {
    if (c.type === 'button') {
      const b = el('button', 'act', esc(c.label));
      b.type = 'button';
      if (live) b.addEventListener('click', () => { sp.inst?.press?.(c.id); stage.dirty = true; });
      acts.append(b);
      continue;
    }
    if (c.type === 'choice' || c.type === 'toggle') {
      const names = c.type === 'toggle' ? (c.options || ['关', '开']) : c.options;
      const wrap = el('div', 'seg', c.label ? `<span>${esc(c.label)}</span>` : '');
      const sel = () => (c.type === 'toggle' ? (params[c.id] ? 1 : 0) : params[c.id]);
      names.forEach((o, i) => {
        const b = el('button', '', esc(o));
        b.type = 'button';
        b.setAttribute('aria-pressed', String(i === sel()));
        if (live) {
          b.addEventListener('click', () => {
            params[c.id] = c.type === 'toggle' ? !!i : i;
            wrap.querySelectorAll('button').forEach((x, j) => x.setAttribute('aria-pressed', String(j === i)));
            sp.inst?.change?.(c.id);
            stage.dirty = true;
          });
        }
        wrap.append(b);
      });
      if (live) sp.sync[c.id] = () => wrap.querySelectorAll('button').forEach((x, j) => x.setAttribute('aria-pressed', String(j === sel())));
      if (c.wide) wrap.style.gridColumn = '1/-1';
      box.append(wrap);
      continue;
    }
    const d = dec(c.step ?? 1);
    const wrap = el('label', 'ctl', `<span>${esc(c.label)}</span><input type="range" min="${c.min}" max="${c.max}" step="${c.step ?? 1}" value="${params[c.id]}"><output></output>`);
    const input = wrap.querySelector('input');
    const out = wrap.querySelector('output');
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

function makeTexture(cv) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

async function getSpread(i) {
  let sp = cache.get(i);
  if (sp) return sp;
  const meta = catalog.completed[i];
  const exp = await getExperimentByMeta(meta);
  if (!exp) throw new Error(`未找到实验模块实现: ${meta.id}`);
  exp.meta = meta;
  exp.no = meta.no;
  exp.pageNo = meta.pageNo;

  const mem = memoryOf(exp.id);
  sp = {
    i, exp, mem, params: (mem.params ||= {}), sync: {}, inst: null, wbInst: null,
    root: null, drags: [], plate: null, pop: 1, popV: 0, popGoal: 1, guess: null, clock: mem.clock || 0, marginKey: '',
  };
  for (const c of exp.controls || []) {
    if (c.type !== 'button' && !(c.id in sp.params)) sp.params[c.id] = c.value;
  }
  const subj = catalog.subjects[exp.subject];
  sp.leafL = el('article', 'leaf leaf-l');
  sp.leafL.setAttribute('aria-label', `${exp.title}：正文`);
  sp.leafR = el('section', 'leaf leaf-r');
  sp.leafR.setAttribute('aria-label', '图注与实验控制');
  renderLeft(sp, sp.leafL, true);
  renderRight(sp, sp.leafR, true);

  sp.pressL = el('article', 'leaf leaf-l');
  sp.pressR = el('section', 'leaf leaf-rp', `<div class="runhead ink"><span>${esc(subj.en)} · Plate ${exp.no}</span><b>${exp.pageNo + 1}</b></div><div class="leaf-r"></div>`);
  renderLeft(sp, sp.pressL, false);
  renderRight(sp, sp.pressR.querySelector('.leaf-r'), false);
  press.append(sp.pressL, sp.pressR);
  fit(sp.pressL.querySelector('.main'));
  fit(sp.pressR.querySelector('.rin'));

  sp.cvL = document.createElement('canvas');
  sp.cvR = document.createElement('canvas');
  sp.texL = makeTexture(sp.cvL);
  sp.texR = makeTexture(sp.cvR);
  printSpread(sp, true);
  cache.set(i, sp);
  return sp;
}

function printSpread(sp, live) {
  paint(sp.pressL, sp.cvL, { scale: PRINT_SCALE, live, side: -1 });
  paint(sp.pressR, sp.cvR, { scale: PRINT_SCALE, live, side: 1 });
  sp.texL.needsUpdate = sp.texR.needsUpdate = true;
  sp.printedLive = live;
  stage.dirty = true;
}

function freeze(sp) {
  if (stacked) return;
  syncLive(sp.leafL, sp.pressL);
  syncLive(sp.leafR, sp.pressR.querySelector('.leaf-r'));
  printSpread(sp, true);
}

function ensureModel(sp) {
  if (sp.root) return;
  sp.root = stage.newRoot();
  sp.drags = [];
  sp.pop = 1;
  sp.popV = 0;
  stage.setPop(sp.root, 1);
  const kit = {
    p: sp.params,
    root: sp.root,
    drag: (m, o) => stage.drag(m, o, sp.drags),
    set: (id, v) => { sp.params[id] = v; sp.sync[id]?.(); },
    record: (row) => journal.push(sp.exp, row),
    memory: sp.mem,
    away: sp.mem.savedAt ? (performance.now() - sp.mem.savedAt) / 1000 : 0,
    dirty: () => { stage.dirty = true; },
    stage,
  };
  try { sp.inst = sp.exp.build(kit) || {}; } catch (e) { console.error(e); sp.inst = {}; }
  sp.ac = new AbortController();
  try { sp.inst.bindPage?.(sp.leafL, sp.leafR, sp.ac.signal); } catch (e) { console.error(e); }
  try { sp.inst.update?.(0, 0); } catch (e) { console.error(e); }
  if (!sp.plate) sp.plate = stage.newPlate();
  stage.bakePlate(sp.root, sp.plate);
}

function dropModel(sp) {
  if (!sp.root) return;
  try { sp.inst?.save?.(sp.mem); } catch (e) { console.error(e); }
  sp.mem.savedAt = performance.now();
  sp.mem.clock = sp.clock;
  sp.ac?.abort();
  stage.disposeRoot(sp.root);
  sp.root = null;
  sp.inst = null;
  sp.drags = [];
}

function dropSpread(sp) {
  dropModel(sp);
  sp.leafL.remove();
  sp.leafR.remove();
  sp.pressL.remove();
  sp.pressR.remove();
  sp.texL.dispose();
  sp.texR.dispose();
  sp.plate?.dispose();
  cache.delete(sp.i);
}

function prune() {
  for (const sp of [...cache.values()]) {
    if (sp !== cur && sp !== T?.next && sp !== peek?.next && Math.abs(sp.i - cur.i) > 1) dropSpread(sp);
  }
}

function mount(sp) {
  if (stacked) {
    flow.append(sp.leafR, sp.leafL);
    sp.leafL.classList.remove('printed');
    sp.leafR.classList.remove('printed');
  } else {
    stage.camEl.append(sp.leafL, sp.leafR);
    sp.leafL.classList.add('printed');
    sp.leafR.classList.add('printed');
    stage.addLeaf(sp.leafL, -1, -PW / 2, 0);
    stage.addLeaf(sp.leafR, 1, PW / 2, PANEL_Z);
  }
  sp.leafL.classList.remove('away');
  sp.leafR.classList.remove('away');
  fit(sp.leafL.querySelector('.main'));
  fit(sp.leafR.querySelector('.rin'));
}

function unmount(sp) {
  stage.removeLeaf(sp.leafL);
  stage.removeLeaf(sp.leafR);
  sp.leafL.remove();
  sp.leafR.remove();
}

const plateK = (sp) => clamp((sp.pop - 0.3) / 0.6);
const progressOf = (i) => (N > 1 ? i / (N - 1) : 0);

function restPrints() {
  book.setPrint('L', cur.texL);
  book.setPrint('R', cur.texR, cur.plate?.texture, plateK(cur));
}

function settle() {
  const exp = cur.exp;
  const s = catalog.subjects[exp.subject];
  stage.drags = cur.drags;
  $('#bTitle b').textContent = `${s.short} ${exp.no}`;
  $('#bTitle span').textContent = exp.title;
  $('#bPrev').disabled = cur.i === 0;
  $('#bNext').disabled = cur.i === N - 1;
  document.title = `${exp.title} · HAIZ 数字实验手册`;
  if (location.hash.slice(1) !== exp.id) {
    history.replaceState(null, '', `${location.pathname}${location.search}#${exp.id}`);
  }
  document.querySelectorAll('#tocList button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.id === exp.id)));
  $('#live').textContent = `${s.name} ${exp.no}：${exp.title}`;
  matrixUI.renderTeach(exp, teachOpen);
  journal.show(exp, cur);
  workbench.setSpread(cur);
  // 预取相邻学科包，保障拖角悬停翻页即时响应
  const prevMeta = catalog.completed[cur.i - 1];
  const nextMeta = catalog.completed[cur.i + 1];
  if (prevMeta?.implementation?.domainPack) loadDomainPack(prevMeta.implementation.domainPack).catch(() => {});
  if (nextMeta?.implementation?.domainPack) loadDomainPack(nextMeta.implementation.domainPack).catch(() => {});
  prune();
}

async function swap(j) {
  cancelPeek(true);
  const next = await getSpread(j);
  ensureModel(next);
  if (cur && cur !== next) { unmount(cur); dropModel(cur); }
  cur = next;
  stage.setBookProgress(progressOf(j));
  mount(cur);
  if (!stacked) printSpread(cur, false);
  cur.pop = 0; cur.popV = 0; cur.popGoal = 0;
  stage.setPop(cur.root, 0);
  restPrints();
  settle();
}

const canTurn = (dir) => !T && cur && cur.i + dir >= 0 && cur.i + dir < N;

function arm(dir, next, grab, withPlates) {
  const pa = withPlates ? cur.plate?.texture : null;
  const pb = withPlates ? next.plate?.texture : null;
  if (dir > 0) {
    book.setPrint('F', cur.texR, pa, plateK(cur)); book.setPrint('B', next.texL);
    book.setPrint('R', next.texR, pb, 1); book.setPrint('L', cur.texL);
  } else {
    book.setPrint('F', cur.texL); book.setPrint('B', next.texR, pb, 1);
    book.setPrint('L', next.texL); book.setPrint('R', cur.texR, pa, plateK(cur));
  }
  book.beginTurn(dir, grab);
}

function startTurn(j, mode, grab, nextReady) {
  if (T || !cur || j < 0 || j >= N || j === cur.i) return null;
  const dir = j > cur.i ? 1 : -1;
  if (peek && peek.dir !== dir) cancelPeek(true);
  const next = nextReady || cache.get(j);
  if (!next) return null;
  ensureModel(next);
  freeze(cur);
  if (!stacked) { cur.leafL.classList.add('away'); cur.leafR.classList.add('away'); }
  if (document.activeElement && (cur.leafL.contains(document.activeElement) || cur.leafR.contains(document.activeElement))) {
    document.activeElement.blur();
  }
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
  const { next, commit, resolve } = T;
  book.endTurn();
  if (commit) {
    const old = cur;
    unmount(old);
    cur = next;
    stage.setBookProgress(T.f1);
    mount(cur);
    if (!stacked) printSpread(cur, false);
    cur.popGoal = 0;
    if (cur.pop > 0.999) cur.popV = 0;
    T = null;
    restPrints();
    settle();
    if (old !== cur) { old.pop = 1; dropModel(old); }
  } else {
    stage.setBookProgress(T.f0);
    cur.leafL.classList.remove('away');
    cur.leafR.classList.remove('away');
    if (!stacked) printSpread(cur, false);
    cur.popGoal = 0;
    T = null;
    restPrints();
    dropModel(next);
    next.pop = 1;
  }
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
    const w = T.mode === 'drag' ? 26 : 9.5;
    for (let n = Math.ceil(dt / 0.008), h = dt / n, i = 0; i < n; i++) {
      const ax = w * w * (T.goalX - T.x) - 2 * w * T.vx;
      const az = w * w * (T.goalZ - T.z) - 2 * w * T.vz;
      T.vx += ax * h; T.vz += az * h; T.x += T.vx * h; T.z += T.vz * h;
    }
    if (T.mode === 'settle' && Math.abs(T.goalX - T.x) < 0.03 && Math.abs(T.vx) < 0.4) {
      T.x = T.goalX; T.z = T.goalZ; book.bend(T.x, T.z); finishTurn(); return;
    }
  }
  book.bend(T.x, T.z);
  const p = book.turn.p;
  stage.setBookProgress(T.f0 + (T.f1 - T.f0) * ease(p));
  if (T.commit && !T.risen && dir > 0 && p > 0.9) { T.risen = true; T.next.popGoal = 0; }
  stage.dirty = true;
}

const _hit = new THREE.Vector3();
function pagePoint(ev, dir, lift) {
  const ray = stage.ray(ev).ray, h = (dir > 0 ? book.hR : book.hL) + lift;
  const t = (h - ray.origin.y) / ray.direction.y;
  _hit.copy(ray.direction).multiplyScalar(t).add(ray.origin);
  return { x: dir * _hit.x, z: _hit.z };
}
function grabLift() {
  const t = book.turn;
  if (!t || t.c === undefined) return 0;
  const d = t.gx * t.nx + t.gz * t.nz - t.c;
  return d <= 0 ? 0 : d < Math.PI * t.R ? t.R * (1 - Math.cos(d / t.R)) : 2 * t.R;
}

stage.on('busy', () => !!T);
stage.on('canTurn', canTurn);
stage.on('turnHover', (z) => setPeek(z));
stage.on('turnStart', (z, ev) => {
  if (!canTurn(z.dir) || reduced) { if (reduced && canTurn(z.dir)) open(cur.i + z.dir); return false; }
  const nextIdx = cur.i + z.dir;
  if (!cache.has(nextIdx)) {
    getSpread(nextIdx).then(() => {}).catch(() => {});
    return false;
  }
  const t = startTurn(nextIdx, 'drag', { s: z.s, z: z.z }, cache.get(nextIdx));
  if (!t) return false;
  t.p0 = pagePoint(ev, z.dir, 0);
  t.gain = z.far || stacked ? 1.6 : 1;
  t.goalX = t.x; t.goalZ = t.z;
  return true;
});
stage.on('turnMove', (ev) => {
  if (!T || T.mode !== 'drag') return;
  const p = pagePoint(ev, T.dir, grabLift() * 0.9);
  T.goalX = clamp(T.gx + (p.x - T.p0.x) * T.gain, -T.gx - 1.5, T.gx + 0.5);
  T.goalZ = T.gz + (p.z - T.p0.z);
  const now = performance.now();
  T.hist.push([now, T.goalX]);
  while (T.hist.length > 2 && now - T.hist[0][0] > 110) T.hist.shift();
});
stage.on('turnEnd', (ev, turn, cancelled) => {
  if (!T || T.mode !== 'drag') return;
  if (!turn.moved && !cancelled && performance.now() - turn.t < 500) {
    T.mode = 'auto'; T.commit = true; T.t = 0.14; T.sx = T.x; T.sz = T.z; return;
  }
  const h = T.hist;
  const v = h.length > 1 ? (h[h.length - 1][1] - h[0][1]) / Math.max(0.016, (h[h.length - 1][0] - h[0][0]) / 1000) : 0;
  const p = book.turn.p;
  T.commit = !cancelled && (v < -14 || (p > 0.42 && v < 14));
  T.mode = 'settle';
  T.goalX = T.commit ? -T.gx : T.gx; T.goalZ = T.gz;
});

function setPeek(zone) {
  if (T || reduced || stacked) return;
  if (!zone || !canTurn(zone.dir)) { if (peek) peek.goal = 0; return; }
  const gz = zone.z >= 0 ? PH / 2 : -PH / 2;
  if (peek && (peek.dir !== zone.dir || peek.gz !== gz)) cancelPeek(true);
  const nextIdx = cur.i + zone.dir;
  if (!peek) {
    const ready = cache.get(nextIdx);
    if (!ready) { getSpread(nextIdx).catch(() => {}); return; }
    arm(zone.dir, ready, { s: PW, z: gz }, false);
    peek = { dir: zone.dir, gz, a: 0, goal: 1, next: ready };
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

function updatePops(dt) {
  for (const sp of cache.values()) {
    if (!sp.root) continue;
    if (Math.abs(sp.popGoal - sp.pop) < 0.0015 && Math.abs(sp.popV) < 0.01) {
      if (sp.pop !== sp.popGoal) { sp.pop = sp.popGoal; stage.setPop(sp.root, sp.pop); }
      continue;
    }
    const down = sp.popGoal > 0.5, w = down ? 17 : 8.5, zeta = down ? 1 : 0.6;
    for (let n = Math.ceil(dt / 0.008), h = dt / n, i = 0; i < n; i++) {
      sp.popV += (w * w * (sp.popGoal - sp.pop) - 2 * zeta * w * sp.popV) * h;
      sp.pop = Math.min(1, sp.pop + sp.popV * h);
    }
    if (sp.pop >= 1) sp.popV = Math.min(0, sp.popV);
    stage.setPop(sp.root, sp.pop);
  }
  if (cur) {
    const k = plateK(cur);
    if (T) { book.setPlateK(T.dir > 0 ? 'F' : 'R', k); book.setPlateK(T.dir > 0 ? 'R' : 'B', plateK(T.next)); }
    else if (!peek) book.setPlateK('R', k);
  }
}

async function open(i, quick) {
  i = clamp(i, 0, N - 1);
  if (T) await T.done;
  if (!cur || quick || reduced) {
    if (!cur || i !== cur.i) await swap(i);
    stage.resetView();
    return true;
  }
  if (i === cur.i) return true;
  if (stage.shot === 'left' || stage.shot === 'right') stage.resetView();
  const next = await getSpread(i);
  const t = startTurn(i, 'auto', null, next);
  return t ? t.done : false;
}

async function openById(id, opts = {}) {
  const idx = catalog.completed.findIndex((m) => m.id === id);
  if (idx < 0) return false;
  await open(idx, opts.quick);
  if (opts.mode) setSpatialMode(opts.mode);
  return true;
}

function setSpatialMode(mode) {
  spaceMode = mode;
  if (mode === 'workbench') {
    if (!workbench.open && cur) workbench.openFor(cur);
  } else {
    if (workbench.open) workbench.close();
  }
  stage.setSpaceMode(mode);
  stage.resize();
}

function setMobileTab(tab) {
  mobileTab = tab;
  document.body.dataset.mtab = tab;
  document.querySelectorAll('#mTabs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mtab === tab)));
  if (tab === 'workbench') {
    if (cur) workbench.openFor(cur);
  } else if (tab === 'journal') {
    if (workbench.open) workbench.close();
    journal.openPanel();
  } else {
    if (workbench.open) workbench.close();
    journal.close();
  }
}

function layout() {
  const st = innerWidth < 860 || innerWidth / innerHeight < 1.12;
  const changed = st !== stacked;
  stacked = st;
  document.body.classList.toggle('stacked', stacked);
  stage.setStacked(stacked);
  stage.resize();
  if (cur && changed) {
    cancelPeek(true);
    unmount(cur);
    mount(cur);
    printSpread(cur, stacked);
    restPrints();
  } else if (cur) {
    fit(cur.leafL.querySelector('.main'));
    fit(cur.leafR.querySelector('.rin'));
  }
}
addEventListener('resize', layout);

let journal, workbench, matrixUI;

function setupToolbar() {
  $('#bPrev').addEventListener('click', () => open(cur.i - 1));
  $('#bNext').addEventListener('click', () => open(cur.i + 1));
  $('#bToc').addEventListener('click', () => { matrixUI.renderToc(cur?.exp.id); $('#toc').hidden = false; $('#tocClose').focus(); });
  $('#tocClose').addEventListener('click', () => { $('#toc').hidden = true; });
  $('#toc').addEventListener('click', (e) => { if (e.target.id === 'toc') $('#toc').hidden = true; });
  $('#bMatrix').addEventListener('click', () => { $('#matrixModal').hidden = false; matrixUI.renderMatrix(); });
  $('#mxClose').addEventListener('click', () => { $('#matrixModal').hidden = true; });
  $('#matrixModal').addEventListener('click', (e) => { if (e.target.id === 'matrixModal') $('#matrixModal').hidden = true; });

  const setPlaying = (v) => { playing = v; $('#bPlay').setAttribute('aria-pressed', String(!v)); stage.dirty = true; };
  $('#bPlay').addEventListener('click', () => setPlaying(!playing));
  $('#bReset').addEventListener('click', async () => {
    if (T || !cur) return;
    const i = cur.i, id = cur.exp.id;
    unmount(cur);
    dropSpread(cur);
    memory.delete(id);
    cur = null;
    await swap(i);
    if (workbench.open) workbench.openFor(cur);
    stage.resetView();
  });
  $('#bWork').addEventListener('click', () => {
    if (stacked) setMobileTab(mobileTab === 'workbench' ? 'read' : 'workbench');
    else workbench.toggle(cur);
  });
  $('#bTeach').addEventListener('click', () => { teachOpen = !teachOpen; matrixUI.renderTeach(cur?.exp, teachOpen); });
  $('#bRec').addEventListener('click', () => journal.toggle());
  $('#bFull').addEventListener('click', () => {
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => {});
  });
  if (!document.documentElement.requestFullscreen) $('#bFull').hidden = true;

  document.querySelectorAll('#mTabs button').forEach((b) => {
    b.addEventListener('click', () => setMobileTab(b.dataset.mtab));
  });

  addEventListener('keydown', (e) => {
    if (e.target.matches('input,textarea,select') && e.key !== 'Escape') return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') open(cur.i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') open(cur.i - 1);
    else if (e.key === 'Home') open(0);
    else if (e.key === 'End') open(N - 1);
    else if (e.key === 'w' || e.key === 'W') workbench.toggle(cur);
    else if (e.key === ' ' && !e.target.matches('button')) { e.preventDefault(); setPlaying(!playing); }
    else if (e.key === 'Escape') {
      $('#toc').hidden = true; $('#matrixModal').hidden = true;
      teachOpen = false; matrixUI.renderTeach(cur?.exp, false);
      journal.close(); workbench.close(); stage.resetView();
    }
  });
  addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    const i = catalog.completed.findIndex((e) => e.id === id);
    if (i >= 0 && cur && i !== cur.i) open(i);
  });
  let wheelAcc = 0, wheelT = 0;
  $('#gl').addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.2) return;
    e.preventDefault();
    const now = performance.now();
    if (now - wheelT > 400) wheelAcc = 0;
    wheelT = now;
    wheelAcc += e.deltaX;
    if (Math.abs(wheelAcc) > 120 && !T) { open(cur.i + Math.sign(wheelAcc)); wheelAcc = 0; }
  }, { passive: false });
}

let last = performance.now(), mAcc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const real = (now - last) / 1000, dt = Math.min(0.05, real);
  last = now;
  if (document.hidden || !cur) return;
  stage.tick(dt);
  updateTurn(dt);
  updatePeek(dt);
  updatePops(dt);
  const sp = cur, live = sp.inst && sp.pop < 0.5 && !T;
  const d = playing && live ? dt : 0;
  if (live && sp.inst.update) {
    sp.clock += d;
    try { sp.inst.update(d, sp.clock); } catch (e) { if (!frame.err) { frame.err = 1; console.error(e); } }
    if (d > 0) stage.dirty = true;
  }
  workbench.tick(d);
  mAcc += real;
  if (mAcc > 0.12 && sp.inst?.margin && live) {
    mAcc = 0;
    const lines = sp.inst.margin() || [], key = lines.join('\n');
    if (key !== sp.marginKey) {
      sp.marginKey = key;
      const m = sp.leafL.querySelector('.margin');
      if (m) m.innerHTML = lines.map((l) => `<span>${esc(l)}</span>`).join('');
    }
  }
  if (stage.dirty) {
    stage.render();
    if (!launch.fixed) stage.adapt(real * 1000);
  }
}

$('#gl').addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  $('#fallback').textContent = '图形环境被系统暂时回收，恢复后会自动重新载入。';
  $('#fallback').hidden = false;
});
$('#gl').addEventListener('webglcontextrestored', () => location.reload());

async function boot() {
  const matrix = await loadCurriculumMatrix();
  catalog = buildCatalog(matrix);
  N = catalog.completed.length;

  journal = initJournal({
    esc,
    subjects: catalog.subjects,
    onRestoreParams(saved) {
      if (!cur) return;
      for (const [k, v] of Object.entries(saved)) {
        if (k in cur.params) {
          cur.params[k] = v;
          cur.sync[k]?.();
          cur.inst?.change?.(k);
        }
      }
      stage.dirty = true;
      workbench.setSpread(cur);
    },
  });

  workbench = initWorkbench({
    esc,
    subjects: catalog.subjects,
    recordRow: (exp, row) => journal.push(exp, row),
    getRows: (id) => journal.rows(id),
    openJournal: () => journal.openPanel(),
    markDirty: () => { stage.dirty = true; },
    onModeChange: (mode) => {
      spaceMode = mode;
      stage.setSpaceMode(mode);
      requestAnimationFrame(() => stage.resize());
    },
  });

  matrixUI = initMatrixAndToc({
    esc,
    catalog,
    onOpenExp: (id) => openById(id),
    closeTeach: () => { teachOpen = false; matrixUI.renderTeach(cur?.exp, false); },
  });

  matrixUI.initTocFilters(() => cur?.exp.id);
  setupToolbar();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  const targetId = launch.exp || location.hash.slice(1);
  const startIdx = Math.max(0, catalog.completed.findIndex((e) => e.id === targetId));
  await (document.fonts?.ready || Promise.resolve());
  try {
    await Promise.all([
      document.fonts.load('italic 20px "Cormorant Garamond"'),
      document.fonts.load('500 20px "Cormorant Garamond"'),
    ]);
  } catch {}

  layout();
  await open(startIdx, true);
  if (launch.mode === 'workbench' || launch.mode === 'gatefold') setSpatialMode(launch.mode);
  matrixUI.renderToc(cur?.exp.id);
  document.body.classList.add('ready');
  requestAnimationFrame(frame);

  window.__lab = {
    stage, book, open, openById, catalog, journal, workbench, memory,
    get inst() { return cur?.inst; },
    get params() { return cur?.params; },
    get index() { return cur?.i; },
    get turning() { return !!T; },
    get turn() { return T; },
    get spread() { return cur; },
    get list() { return catalog.completed; },
  };

  registerBridge({
    openById,
    setSpatialMode,
    getMatrix: () => matrix,
    exportJournal: () => journal.exportAll(),
    getState: () => ({ expId: cur?.exp.id, index: cur?.i, mode: spaceMode, params: cur?.params }),
  });
}

boot().catch((e) => {
  console.error(e);
  $('#fallback').textContent = `加载实验手册失败：${e.message}`;
  $('#fallback').hidden = false;
});
