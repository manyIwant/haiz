// 年轮 · the tree remembers every day.
//
// A seventh way to stand at the tree. A cross-section drawn from 31,000 real days
// (ERA5 reanalysis for the campus's place on the map, 1940 → last week) is laid beside
// it; choosing a cell takes the tree to that day: the leaves' place in the year, the sun
// and the moon where they stood, that day's cloud, wind and rain. A day can be played
// through its hours, a year through its days, and a span — a life so far, three years of
// senior school — can be lit on the ring, counted and kept as a poster.
//
// Contract with lanren/js/home.js (which owns the loop):
//   attach(ctx) → { open, close, active, stage(dt), apply(), camera(dt), api }
//   stage()  null unless open; else what the loop should stage instead of the film's
//            growth and light: { lush, L, wind, parts, sunAlt }
//   apply()  writes the leaf and wind uniforms after the loop has set its own
//   camera() true while this module holds the camera
// Without WebGL (ctx.world = null) the ring, the day's facts and the poster still work.
//
// Honesty: weather is a model reanalysis on a ~25 km grid, not a station in the school;
// the ring is a drawing of that data, not this tree's growth rings; leaf state is a
// phenology model (推演); sky colours are art direction keyed to the computed sun.
import * as THREE from 'three';
import { UNIFORMS } from '../js/foliage.js';
import { AXIS } from '../js/chapters.js';
import { haikouParts, formatClock, dayOfYearFor, isLeap } from '../js/sun.js';
import { loadClimate, parts as partsOf, indexOfDate, dateLabel, weekdayLabel, isoOfIndex, yearStart, yearLength, FIRST_YEAR } from './climate.js';
import { layout, paint, pick, place, spanPath, sectorPath, wobble, LENSES, FRAME, BARK } from './disc.js';
import { stageFor, describeDay, sunTimes, beaufort } from './almanac.js';
import { NODES } from '../roots/history.js';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const KEY = 'haiz.rings.v1';
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const nf = new Intl.NumberFormat('zh-CN');
const store = {
  read() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } },
  write(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage blocked: the span lives for this visit */ } }
};

// school history that names a year (or a run of years): shown when the ring stands in it
const HISTORY = NODES.map((n) => { const m = /^(\d{4})(?:—(\d{4}))?/.exec(n.year); return m ? { a: +m[1], b: +(m[2] || m[1]), id: n.id, title: n.title, year: n.year, gap: n.grade === 'gap' } : null; }).filter(Boolean);
const historyFor = (y) => HISTORY.filter((h) => !h.gap && y >= h.a && y <= h.b).sort((p, q) => (p.b - p.a) - (q.b - q.a))[0] || null;

const CSS = new URL('./rings.css?v=1', import.meta.url).href;

export function attach(ctx) {
  const { world, cam, W, DwellCamera, reduceMotion, filmGrow, sound } = ctx;
  const body = document.body;
  if (!document.querySelector('link[data-rg]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.rg = '1'; l.href = CSS; document.head.append(l);
  }
  let climate = null, lay = null, loading = null;
  const S = {
    open: false, index: 0, minutes: 720, lens: 'wood', span: null, play: null,
    k: 0,                 // 0 film … 1 ring (camera and overlay)
    cur: null,            // smoothed stage on the tree
    hover: null, dragging: false, orbit: { az: 0, el: 0, vaz: 0 }, saved: null
  };

  // ---------------------------------------------------------------- DOM
  const root = el('section', 'rg');
  root.id = 'rings';
  root.setAttribute('aria-label', '年轮：这棵树记得的每一天');
  root.hidden = true;
  root.tabIndex = -1;
  root.innerHTML = `
  <p class="rg-kicker"><b>年轮</b><span>Rings</span><em id="rgCount"></em></p>
  <div class="rg-disc" id="rgDisc">
    <canvas class="rg-wood" id="rgWood" aria-hidden="true"></canvas>
    <canvas class="rg-over" id="rgOver" role="img" aria-label="年轮图：一圈是一年，1 月 1 日在正上方，顺时针一格是一天"></canvas>
    <p class="rg-tip" id="rgTip" hidden></p>
    <p class="rg-wait" id="rgWait">正在读取三万多个日子……</p>
  </div>
  <div class="rg-lens">
    <div class="rg-lens-row" role="radiogroup" aria-label="年轮上画什么">
      ${LENSES.map((l) => `<button type="button" role="radio" aria-checked="${l.id === 'wood'}" data-lens="${l.id}">${l.label}</button>`).join('')}
      <details class="rg-about"><summary>这些数据从哪来</summary><p id="rgNote"></p></details>
    </div>
    <p class="rg-lens-note" id="rgLensNote"></p>
  </div>
  <div class="rg-panel">
    <header class="rg-head">
      <h2 class="rg-date" id="rgDate" aria-live="polite"><span class="y">—</span><span class="md">—</span></h2>
      <p class="rg-week" id="rgWeek"></p>
      <p class="rg-wx" id="rgWx"></p>
      <p class="rg-tree" id="rgTree"></p>
      <p class="rg-hist" id="rgHist" hidden></p>
      <div class="rg-step" role="group" aria-label="换一天">
        <button type="button" data-step="-365" aria-label="上一年">‹ 年</button>
        <button type="button" data-step="-1" aria-label="前一天">‹ 日</button>
        <label class="rg-pick"><span>选日期</span><input type="date" id="rgInput" aria-label="直接选一个日期"></label>
        <button type="button" data-step="1" aria-label="后一天">日 ›</button>
        <button type="button" data-step="365" aria-label="下一年">年 ›</button>
      </div>
    </header>
    <div class="rg-clock">
      <div class="rg-hours">
        <canvas id="rgSky" width="600" height="40" aria-hidden="true"></canvas>
        <input type="range" id="rgHour" min="0" max="1435" step="5" value="720" aria-label="这一天的几点">
      </div>
      <p class="rg-now"><b id="rgTime">12:00</b><span id="rgSun"></span></p>
      <p class="rg-plays">
        <button type="button" class="rg-play" data-play="day" aria-pressed="false" title="让这一天从这一刻走到明天"><i aria-hidden="true"></i><span>过完这一天</span></button>
        <button type="button" class="rg-play" data-play="year" aria-pressed="false" title="一天一天地走过一年"><i aria-hidden="true"></i><span>走过一年</span></button>
      </p>
    </div>
  </div>
  <div class="rg-side">
    <button type="button" class="tool" id="rgMineBtn" aria-expanded="false" aria-controls="rgMine">我的日子</button>
    <button type="button" class="tool" id="rgClose">回到树下 <kbd>Esc</kbd></button>
  </div>
  <aside class="rg-mine" id="rgMine" hidden aria-label="我的日子">
    <p class="rg-mine-head">在年轮上点亮一段日子</p>
    <label><span>从哪一天起，到年轮最外面的一格</span><input type="date" id="rgBirth"></label>
    <label><span>或者：高中三年（哪一年毕业）</span><select id="rgClass"><option value="">—</option></select></label>
    <div class="rg-facts" id="rgFacts" hidden></div>
    <p class="rg-mine-actions"><button type="button" id="rgPoster" hidden>存成海报</button><button type="button" id="rgClear" hidden>清除</button></p>
    <p class="rg-small">日期只存在这台设备的浏览器里，不会上传。高中三年按 9 月 1 日入学、第三年 6 月 30 日离校推算，不是校历。</p>
  </aside>
  <div class="rg-wipe" id="rgWipe" aria-hidden="true"></div>`;
  body.append(root);
  const $ = (id) => root.querySelector('#' + id);
  const wood = $('rgWood'), over = $('rgOver'), discBox = $('rgDisc');
  const woodCache = new Map();   // lens → canvas

  // ---------------------------------------------------------------- data
  function ready() {
    if (climate) return Promise.resolve(climate);
    loading ||= loadClimate().then((c) => {
      climate = c; lay = layout(c);
      $('rgWait').hidden = true;
      $('rgCount').textContent = `这棵树记得 ${nf.format(c.days)} 个日子`;
      const input = $('rgInput'), birth = $('rgBirth');
      input.min = birth.min = c.meta.start; input.max = birth.max = c.meta.last;
      const sel = $('rgClass');
      for (let y = c.lastYear + 3; y >= FIRST_YEAR + 3; y--) sel.append(new Option(`${y} 届`, String(y)));
      $('rgNote').innerHTML = `天气：ERA5 再分析（Copernicus / ECMWF，经 Open-Meteo），${c.meta.start.slice(0, 4)} 年至 ${dateLabel(c.days - 1)}，网格约 25 公里，是模式重建，不是校内观测，极端值常被低估；逐日数据，一天之内不分时刻。年轮是这些数据的画法，不是这棵树真实的年轮；1923–1939 年没有数据，留白。叶的状态为物候推演；日月位置为天文计算。`;
      return c;
    }).catch((err) => { $('rgWait').textContent = '年轮数据没有读到，请稍后再试。'; loading = null; throw err; });
    return loading;
  }

  // ---------------------------------------------------------------- the disc
  let D = 0, dpr = 1;
  function sizeDisc() {
    const r = discBox.getBoundingClientRect();
    const d = Math.floor(Math.min(r.width, r.height));
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    if (d < 40 || (d === D && ratio === dpr)) return;
    D = d; dpr = ratio;
    for (const c of [wood, over]) { c.width = c.height = Math.round(D * dpr); c.style.width = c.style.height = D + 'px'; }
    woodCache.clear();
    drawWood(); drawOver();
  }
  function drawWood() {
    if (!climate || !D) return;
    const size = wood.width;
    let cv = woodCache.get(S.lens);
    if (!cv) {
      cv = document.createElement('canvas'); cv.width = cv.height = size;
      paint(cv.getContext('2d'), size, climate, lay, S.lens);
      woodCache.set(S.lens, cv);
    }
    const g = wood.getContext('2d');
    g.clearRect(0, 0, size, size);
    g.drawImage(cv, 0, 0);
  }
  const MONTHS = ['1 月', '2 月', '3 月', '4 月', '5 月', '6 月', '7 月', '8 月', '9 月', '10 月', '11 月', '12 月'];
  function drawOver() {
    if (!climate || !D) return;
    const g = over.getContext('2d'), size = over.width, c = size / 2, R = c / FRAME;
    g.clearRect(0, 0, size, size);
    const px = dpr;
    // a lit span: everything else on the ring steps back
    if (S.span) {
      g.save();
      g.beginPath();
      for (let k = 0; k < lay.rings.length; k++) sectorPath(g, lay, k, 0, TAU, R, c, c);
      g.fillStyle = 'rgba(14, 18, 16, .66)';
      g.fill();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath();
      spanPath(g, lay, partsOf, S.span.from, S.span.to, R, c, c);
      g.fill();
      g.restore();
      g.beginPath();
      spanPath(g, lay, partsOf, S.span.from, S.span.to, R, c, c);
      g.strokeStyle = 'rgba(255, 240, 200, .5)'; g.lineWidth = 0.6 * px; g.stroke();
    }
    // months round the bark
    g.font = `${10.5 * px}px Sora, "PingFang SC", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let acc = 0;
    const ML = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (let m = 0; m < 12; m++) {
      const a0 = (acc / 365) * TAU, am = ((acc + ML[m] / 2) / 365) * TAU;
      const r0 = (1 + BARK * 0.9) * wobble(a0) * R, r1 = r0 + 6 * px;
      g.beginPath(); g.moveTo(c + Math.sin(a0) * r0, c - Math.cos(a0) * r0); g.lineTo(c + Math.sin(a0) * r1, c - Math.cos(a0) * r1);
      g.strokeStyle = 'rgba(246, 241, 231, .5)'; g.lineWidth = px; g.stroke();
      const rt = (1 + BARK) * wobble(am) * R + 15 * px;
      g.fillStyle = 'rgba(246, 241, 231, .72)';
      g.fillText(MONTHS[m], c + Math.sin(am) * rt, c - Math.cos(am) * rt);
      acc += ML[m];
    }
    // decades, read along the 1 January line
    g.font = `${9 * px}px Sora, sans-serif`;
    for (const y of [1923, 1940, 1960, 1980, 2000, 2020]) {
      const k = lay.ringOfYear(y);
      if (k < 0 || k >= lay.rings.length) continue;
      const r = lay.edges[k] * wobble(0) * R;
      const tw = g.measureText(String(y)).width + 6 * px;
      g.fillStyle = 'rgba(24, 22, 18, .62)';
      g.fillRect(c - tw / 2, c - r - 6.5 * px, tw, 12 * px);
      g.fillStyle = '#f3e7cd';
      g.fillText(String(y), c, c - r);
    }
    // the chosen day: its ring, its day line, its cell
    const mark = (idx, strong) => {
      const q = place(lay, idx, partsOf);
      g.beginPath();
      sectorPath(g, lay, q.k, 0, TAU, R, c, c);
      g.strokeStyle = strong ? 'rgba(255, 252, 240, .95)' : 'rgba(255, 252, 240, .5)';
      g.lineWidth = (strong ? 1.2 : 0.8) * px; g.stroke();
      const rOut = (1 + BARK * 0.6) * wobble(q.th) * R;
      g.beginPath(); g.moveTo(c + Math.sin(q.th) * lay.edges[0] * R, c - Math.cos(q.th) * lay.edges[0] * R); g.lineTo(c + Math.sin(q.th) * rOut, c - Math.cos(q.th) * rOut);
      g.strokeStyle = strong ? 'rgba(255, 252, 240, .7)' : 'rgba(255, 252, 240, .35)'; g.lineWidth = 0.8 * px; g.stroke();
      if (strong) {
        const x = c + q.x * R, y = c + q.y * R;
        g.beginPath(); g.arc(x, y, 5.5 * px, 0, TAU); g.strokeStyle = '#fffdf2'; g.lineWidth = 1.6 * px; g.stroke();
        g.beginPath(); g.arc(x, y, 8.5 * px, 0, TAU); g.strokeStyle = 'rgba(20, 16, 12, .7)'; g.lineWidth = px; g.stroke();
      }
    };
    if (S.hover != null && S.hover !== S.index) mark(S.hover, false);
    mark(S.index, true);
  }

  // pointer on the disc → a day
  function dayAt(e) {
    if (!climate || !D) return null;
    const r = over.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width * 2 - 1) * FRAME, y = ((e.clientY - r.top) / r.height * 2 - 1) * FRAME;
    const hit = pick(lay, x, y);
    return hit && hit.index != null ? hit.index : hit && hit.future ? climate.days - 1 : hit && hit.blank ? { blank: hit.y } : null;
  }
  const tip = $('rgTip');
  function showTip(e, idx) {
    if (idx == null) { tip.hidden = true; return; }
    const r = discBox.getBoundingClientRect();
    tip.hidden = false;
    tip.textContent = typeof idx === 'object' ? `${idx.blank} 年 · 没有数据，留白` : `${dateLabel(idx)} · ${describeDay(climate.row(idx))}`;
    tip.style.left = clamp(e.clientX - r.left, 80, r.width - 80) + 'px';
    tip.style.top = (e.clientY - r.top - 18) + 'px';
  }
  over.addEventListener('pointerdown', (e) => {
    const idx = dayAt(e);
    if (typeof idx !== 'number') return;
    S.dragging = true; over.setPointerCapture?.(e.pointerId);
    stopPlay(); select(idx);
    showTip(e, idx);
  });
  over.addEventListener('pointermove', (e) => {
    const idx = dayAt(e);
    if (S.dragging) { if (typeof idx === 'number') { select(idx); showTip(e, idx); } return; }
    if (e.pointerType === 'touch') return;
    const h = typeof idx === 'number' ? idx : null;
    if (h !== S.hover) { S.hover = h; drawOver(); }
    showTip(e, idx);
    over.style.cursor = h != null ? 'crosshair' : '';
  });
  const endDrag = () => { S.dragging = false; tip.hidden = true; };
  over.addEventListener('pointerup', endDrag);
  over.addEventListener('pointercancel', endDrag);
  over.addEventListener('pointerleave', () => { if (!S.dragging) { S.hover = null; tip.hidden = true; drawOver(); } });

  // ---------------------------------------------------------------- choosing a day and an hour
  function select(index, { minutes = null, silent = false } = {}) {
    if (!climate) return;
    index = climate.clampIndex(Math.round(index));
    const changed = index !== S.index;
    S.index = index;
    if (minutes != null) S.minutes = clamp(minutes, 0, 1439);
    if (changed || minutes != null) { writeCard(); drawOver(); if (!silent) writeHash(); }
  }
  function when() { const p = partsOf(S.index); return { y: p.y, m: p.m, d: p.d, minutes: S.minutes }; }
  let lastSkyDay = -1;
  function writeCard() {
    const p = partsOf(S.index), row = climate.row(S.index), st = stageFor(when(), row);
    $('rgDate').innerHTML = `<span class="y">${p.y}</span><span class="md">${p.m} 月 ${p.d} 日</span>`;
    $('rgWeek').textContent = `${weekdayLabel(S.index)} · 这棵树记得的第 ${nf.format(S.index + 1)} 天${S.index === climate.days - 1 ? ' · 年轮最外面的一格' : ''}`;
    $('rgWx').textContent = describeDay(row);
    $('rgTree').textContent = `树上：${st.season.label}（推演）`;
    const h = historyFor(p.y), hist = $('rgHist');
    hist.hidden = !h;
    if (h) hist.innerHTML = `<span>这一年的学校 · ${h.year}</span><a href="#roots/${h.id}" data-roots="${h.id}">${h.title}</a>`;
    $('rgInput').value = isoOfIndex(S.index);
    $('rgHour').value = String(Math.round(S.minutes / 5) * 5);
    $('rgTime').textContent = formatClock(S.minutes);
    const sunTxt = st.sun.altitude > -0.8 ? `太阳高 ${Math.round(st.sun.altitude)}°` : st.moon.altitude > 0 ? `${st.moon.name}在天上，亮面 ${Math.round(st.moon.fraction * 100)}%` : `夜里 · ${st.moon.name}还没升起`;
    $('rgSun').textContent = sunTxt;
    if (S.index !== lastSkyDay) { lastSkyDay = S.index; drawSkyBar(p); }
  }
  /** the day as a strip: night, twilight, day, with sunrise and sunset marked */
  function drawSkyBar(p) {
    const cv = $('rgSky'), g = cv.getContext('2d'), w = cv.width, h = cv.height;
    const { rise, set } = sunTimes(p.y, p.m, p.d);
    const grad = g.createLinearGradient(0, 0, w, 0);
    const stop = (min, col) => grad.addColorStop(clamp(min / 1440), col);
    const night = 'rgba(16, 24, 44, .85)', dusk = 'rgba(214, 128, 86, .9)', day = 'rgba(206, 224, 240, .9)';
    stop(0, night);
    if (rise != null && set != null) {
      stop(rise - 45, night); stop(rise, dusk); stop(rise + 50, day); stop(set - 50, day); stop(set, dusk); stop(set + 45, night);
    }
    stop(1440, night);
    g.clearRect(0, 0, w, h);
    g.fillStyle = grad; g.fillRect(0, h * 0.3, w, h * 0.4);
    g.fillStyle = 'rgba(246, 241, 231, .75)'; g.font = '15px Sora, sans-serif'; g.textBaseline = 'top';
    if (rise != null) { g.textAlign = 'center'; g.fillText('日出 ' + formatClock(rise), clamp(rise / 1440 * w, 46, w - 46), h * 0.72 + 1); }
    if (set != null) { g.textAlign = 'center'; g.fillText('日落 ' + formatClock(set), clamp(set / 1440 * w, 46, w - 46), h * 0.72 + 1); }
  }

  for (const b of root.querySelectorAll('[data-step]')) {
    b.addEventListener('click', () => { stopPlay(); step(+b.dataset.step); });
  }
  function step(n) {
    if (!climate) return;
    if (Math.abs(n) === 365) {   // same calendar day in the neighbouring year
      const p = partsOf(S.index), y = p.y + Math.sign(n);
      const d = Math.min(p.d, p.m === 2 && !isLeap(y) ? 28 : 31);
      select(indexOfDate(y, p.m, d));
    } else select(S.index + n);
  }
  $('rgInput').addEventListener('change', (e) => { const v = e.target.value; if (/^\d{4}-\d\d-\d\d$/.test(v)) { stopPlay(); select(indexOfDate(+v.slice(0, 4), +v.slice(5, 7), +v.slice(8, 10))); } });
  $('rgHour').addEventListener('input', (e) => { stopPlay(); select(S.index, { minutes: +e.target.value }); });
  for (const b of root.querySelectorAll('[data-lens]')) {
    b.addEventListener('click', () => setLens(b.dataset.lens));
  }
  function setLens(id) {
    if (!LENSES.some((l) => l.id === id)) return;
    S.lens = id;
    for (const b of root.querySelectorAll('[data-lens]')) b.setAttribute('aria-checked', String(b.dataset.lens === id));
    $('rgLensNote').textContent = LENSES.find((l) => l.id === id).note;
    drawWood();
  }
  setLens('wood');

  // ---------------------------------------------------------------- playing a day, a year
  function stopPlay() {
    if (!S.play) return;
    S.play = null;
    for (const b of root.querySelectorAll('[data-play]')) b.setAttribute('aria-pressed', 'false');
    writeHash();
  }
  for (const b of root.querySelectorAll('[data-play]')) {
    b.addEventListener('click', () => {
      const kind = b.dataset.play, on = S.play?.kind !== kind;
      stopPlay();
      if (!on) return;
      S.play = { kind, acc: 0, left: kind === 'day' ? 1440 : yearLength(partsOf(S.index).y) };
      b.setAttribute('aria-pressed', 'true');
    });
  }
  function advance(dt) {
    const P = S.play;
    if (!P || !climate) return;
    if (P.kind === 'day') {
      const step = dt * (reduceMotion ? 30 : 60);          // a day in 24 s
      P.left -= step;
      let m = S.minutes + step, idx = S.index;
      if (m >= 1440) { m -= 1440; idx = Math.min(climate.days - 1, idx + 1); }
      select(idx, { minutes: m, silent: true });
    } else {
      P.acc += dt * (reduceMotion ? 4 : 9);                  // nine days a second
      const n = Math.floor(P.acc);
      if (n > 0) { P.acc -= n; P.left -= n; select(S.index + n, { silent: true }); if (S.index >= climate.days - 1) P.left = 0; }
    }
    if (P.left <= 0) stopPlay();
  }

  // ---------------------------------------------------------------- a span of one's own
  const fmtDay = (i) => { const p = partsOf(i); return `${p.y} 年 ${p.m} 月 ${p.d} 日`; };
  function setSpan(span, { save = true } = {}) {
    S.span = span;
    const facts = $('rgFacts');
    $('rgPoster').hidden = $('rgClear').hidden = facts.hidden = !span;
    if (span) {
      const s = climate.span(span.from, span.to);
      span.stats = s;
      const open = span.to >= climate.days - 1;
      facts.innerHTML = `
        <p class="lead">${span.title}</p>
        <p>从 ${fmtDay(s.from)} 到 ${open ? '年轮最外面的一格' : fmtDay(s.to)}，这棵树下过去了 <b>${nf.format(s.days)}</b> 天。</p>
        <p>其中 <b>${nf.format(s.wet)}</b> 天下过雨（≥ 1 mm），一共 ${nf.format(Math.round(s.rain))} mm；${s.gale ? `有 <b>${s.gale}</b> 天阵风到了 8 级以上。` : '没有一天阵风到 8 级。'}</p>
        <ul>
          <li><button type="button" data-goto="${s.hot.i}">最热的一天 · ${fmtDay(s.hot.i)} · ${s.hot.v.toFixed(1)}°C</button></li>
          <li><button type="button" data-goto="${s.cold.i}">最冷的一夜 · ${fmtDay(s.cold.i)} · ${s.cold.v.toFixed(1)}°C</button></li>
          <li><button type="button" data-goto="${s.wettest.i}">雨最大的一天 · ${fmtDay(s.wettest.i)} · ${s.wettest.v.toFixed(1)} mm</button></li>
          <li><button type="button" data-goto="${s.windiest.i}">风最大的一天 · ${fmtDay(s.windiest.i)} · 阵风 ${beaufort(s.windiest.v)} 级</button></li>
          <li><button type="button" data-goto="${s.from}">回到第一天 · ${fmtDay(s.from)}</button></li>
        </ul>`;
      for (const b of facts.querySelectorAll('[data-goto]')) b.addEventListener('click', () => { stopPlay(); select(+b.dataset.goto); });
    }
    if (save) store.write(span ? { span: { kind: span.kind, value: span.value } } : {});
    drawOver();
  }
  function spanFrom(kind, value) {
    if (!climate) return null;
    if (kind === 'since' && /^\d{4}-\d\d-\d\d$/.test(value)) {
      const from = indexOfDate(+value.slice(0, 4), +value.slice(5, 7), +value.slice(8, 10));
      if (from < 0 || from >= climate.days) return null;
      return { kind, value, from, to: climate.days - 1, title: '我的日子' };
    }
    if (kind === 'class' && /^\d{4}$/.test(value)) {
      const y = +value, from = indexOfDate(y - 3, 9, 1), to = Math.min(climate.days - 1, indexOfDate(y, 6, 30));
      if (from < 0 || from >= climate.days) return null;
      return { kind, value, from, to, title: `${y} 届 · 高中三年` };
    }
    return null;
  }
  $('rgBirth').addEventListener('change', (e) => { const s = spanFrom('since', e.target.value); if (s) { $('rgClass').value = ''; setSpan(s); select(s.from); } });
  $('rgClass').addEventListener('change', (e) => { const s = spanFrom('class', e.target.value); if (s) { $('rgBirth').value = ''; setSpan(s); select(s.from); } else if (!e.target.value) setSpan(null); });
  $('rgClear').addEventListener('click', () => { $('rgBirth').value = ''; $('rgClass').value = ''; setSpan(null); });
  $('rgMineBtn').addEventListener('click', () => toggleMine());
  function toggleMine(on = $('rgMine').hidden) {
    $('rgMine').hidden = !on;
    $('rgMineBtn').setAttribute('aria-expanded', String(on));
    body.classList.toggle('rg-mine-open', on);
  }
  $('rgPoster').addEventListener('click', () => poster());

  /** the lit span as a sheet of paper to keep: the ring, the count, where the numbers come from */
  function poster() {
    if (!S.span || !climate) return null;
    const s = S.span.stats, Wd = 1080, Hd = 1440;
    const cv = document.createElement('canvas'); cv.width = Wd; cv.height = Hd;
    const g = cv.getContext('2d');
    g.fillStyle = '#f3ecdd'; g.fillRect(0, 0, Wd, Hd);
    const SERIF = '"Noto Serif SC", "Songti SC", "STSong", serif', SANS = 'Sora, "PingFang SC", "Noto Sans SC", sans-serif';
    g.fillStyle = '#2b2f2a'; g.textBaseline = 'alphabetic';
    g.font = `500 64px ${SERIF}`; g.fillText(S.span.title, 80, 150);
    g.font = `26px ${SANS}`; g.fillStyle = '#6a6a5c';
    g.fillText(`${fmtDay(s.from)} — ${fmtDay(s.to)}`, 80, 200);
    // the ring, with the span lit
    const size = 900, ring = document.createElement('canvas'); ring.width = ring.height = size;
    const rg = ring.getContext('2d');
    paint(rg, size, climate, lay, 'wood');
    const c = size / 2, R = c / FRAME;
    rg.save();
    rg.beginPath(); for (let k = 0; k < lay.rings.length; k++) sectorPath(rg, lay, k, 0, TAU, R, c, c);
    rg.clip();
    rg.beginPath(); rg.rect(0, 0, size, size); spanPath(rg, lay, partsOf, s.from, s.to, R, c, c);
    rg.fillStyle = 'rgba(243, 236, 221, .78)'; rg.fill('evenodd');
    rg.restore();
    g.drawImage(ring, (Wd - size) / 2, 230);
    g.fillStyle = '#2b2f2a'; g.font = `500 44px ${SERIF}`;
    g.fillText(`这棵树下，过去了 ${nf.format(s.days)} 天`, 80, 1175);
    g.font = `25px ${SANS}`; g.fillStyle = '#4b4f47';
    const lines = [
      `${nf.format(s.wet)} 天下过雨，共 ${nf.format(Math.round(s.rain))} mm${s.gale ? ` · ${s.gale} 天阵风 8 级以上` : ''}`,
      `最热 ${fmtDay(s.hot.i)} ${s.hot.v.toFixed(1)}°C · 最冷 ${fmtDay(s.cold.i)} ${s.cold.v.toFixed(1)}°C`,
      `雨最大 ${fmtDay(s.wettest.i)} ${s.wettest.v.toFixed(1)} mm · 风最大 ${fmtDay(s.windiest.i)} 阵风 ${beaufort(s.windiest.v)} 级`
    ];
    lines.forEach((t, i) => g.fillText(t, 80, 1225 + i * 40));
    g.font = `18px ${SANS}`; g.fillStyle = '#8a8776';
    g.fillText('一圈是一年，1 月 1 日在正上方，顺时针一格是一天；圈的宽窄随当年雨量。亮着的是这一段日子。', 80, 1362);
    g.fillText('HAIZ 年轮 · haiz.space/#rings · 天气：ERA5 再分析（Copernicus/ECMWF，经 Open-Meteo），非校内观测，非真实年轮', 80, 1392);
    cv.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'haiz-rings.png'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
    return cv;
  }

  // ---------------------------------------------------------------- address
  const hashOf = () => `#rings/${isoOfIndex(S.index)}/${String(Math.floor(S.minutes / 60)).padStart(2, '0')}${String(Math.floor(S.minutes % 60)).padStart(2, '0')}`;
  let hashTimer = 0;
  function writeHash() {
    if (!S.open || S.play || S.closing) return;
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => { if (S.open && !S.closing) history.replaceState({ rg: 1 }, '', hashOf()); }, 250);
  }
  function parseHash(h) {
    const m = /^#rings(?:\/(\d{4})-(\d\d)-(\d\d)(?:\/(\d\d)(\d\d))?)?$/.exec(h || '');
    if (!m) return null;
    return m[1] ? { y: +m[1], m: +m[2], d: +m[3], minutes: m[4] ? +m[4] * 60 + +m[5] : null } : {};
  }
  addEventListener('popstate', () => {
    const p = parseHash(location.hash);
    if (p && !S.open) open(p, { fromHistory: true });
    else if (!p && S.open) close({ fromHistory: true });
    else if (p && p.y && climate) select(indexOfDate(p.y, p.m, p.d), { minutes: p.minutes, silent: true });
  });

  // ---------------------------------------------------------------- opening and closing
  const wipe = $('rgWipe');
  function dip(mid) {
    if (reduceMotion) { mid(); return; }
    wipe.classList.add('on');
    setTimeout(() => { mid(); requestAnimationFrame(() => requestAnimationFrame(() => wipe.classList.remove('on'))); }, 420);
  }
  let weather = null, weatherLoading = null;
  function ensureWeather() {
    if (!world || weather || weatherLoading) return;
    weatherLoading = import('./weather.js').then((m) => { weather = m.createWeather(world.water.position.y); world.scene.add(weather.group); weather.group.visible = S.open; })
      .catch((err) => console.warn('rings: weather unavailable', err));
  }
  async function open(arg = {}, { fromHistory = false } = {}) {
    if (S.open) { if (arg.y && climate) select(indexOfDate(arg.y, arg.m, arg.d), { minutes: arg.minutes }); return; }
    if (W && W.owner !== 'scroll' && W.owner !== 'hold') return;   // the map, the canopy or the walk has the camera: finish there first
    S.open = true;
    root.hidden = false;
    ensureWeather();
    const start = () => {
      body.classList.add('rg-on');
      try { W?.claim('rings'); } catch { /* an older world state without this owner */ }
      if (world) {
        S.saved = { windDir: UNIFORMS.uWindDir.value.clone() };
        world.litter.falling.length = 0;
        world.litter.settled = world.litter.settled.filter((s) => s.mature);
        world.litter.lastGrow = 1;
        if (weather) weather.group.visible = true;
        S.orbit.az = 0; S.orbit.el = 0; S.orbit.vaz = 0;
        S.cur = null;
      }
      S.k = 1;
      requestAnimationFrame(() => { sizeDisc(); drawOver(); });
    };
    dip(start);
    if (!fromHistory) history.pushState({ rg: 1 }, '', '#rings');
    try { await ready(); } catch { return; }
    // where to stand first: the address, else the newest cell at the clock on the campus wall right now
    const now = haikouParts(Date.now());
    let idx = climate.days - 1, minutes = Math.round(now.minutes);
    if (arg.y) { idx = indexOfDate(arg.y, arg.m, arg.d); if (arg.minutes != null) minutes = arg.minutes; }
    S.index = -1;
    select(idx, { minutes, silent: true });
    const saved = store.read().span;
    if (saved && !S.span) {
      const s = spanFrom(saved.kind, saved.value);
      if (s) { setSpan(s, { save: false }); if (saved.kind === 'since') $('rgBirth').value = saved.value; else $('rgClass').value = saved.value; }
    }
    sizeDisc(); drawWood(); drawOver();
    writeHash();
    root.focus({ preventScroll: true });
  }
  function close({ fromHistory = false } = {}) {
    if (!S.open || S.closing) return;
    S.closing = true;
    stopPlay();
    clearTimeout(hashTimer);
    toggleMine(false);
    const end = () => {
      S.open = false; S.k = 0; S.closing = false; S.applied = null;
      body.classList.remove('rg-on');
      root.hidden = true;
      if (world) {
        UNIFORMS.uYear.value = 0;
        if (S.saved) UNIFORMS.uWindDir.value.copy(S.saved.windDir);
        if (weather) weather.group.visible = false;
        world.litter.falling.length = 0;
        world.litter.settled = [];
        world.litter.lastGrow = filmGrow ? filmGrow() : 1;
        sound?.setRain?.(0);
        if (cam) { DwellCamera.applyShift(world.camera); world.camera.updateProjectionMatrix(); cam.snap(); }
      }
      try { W?.release('rings'); } catch { /* see open() */ }
    };
    dip(end);
    if (!fromHistory) { if (history.state?.rg) history.back(); else history.replaceState(null, '', location.pathname + location.search); }
  }
  $('rgClose').addEventListener('click', () => close());
  root.addEventListener('click', (e) => {
    const a = e.target.closest('[data-roots]');
    if (!a) return;
    // leave through the film: close first, then let chapter 02 open the node
    e.preventDefault();
    const id = a.dataset.roots;
    close({ fromHistory: true });
    setTimeout(() => { history.replaceState(null, '', '#roots/' + id); ctx.openRoots?.(id); }, reduceMotion ? 0 : 520);
  });
  addEventListener('keydown', (e) => {
    if (!S.open || e.metaKey || e.ctrlKey || e.altKey) return;
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== 'range';
    if (e.key === 'Escape') { if (!$('rgMine').hidden) toggleMine(false); else close(); e.preventDefault(); return; }
    if (typing) return;
    const n = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: 365, ArrowDown: -365 }[e.key];
    if (n && e.target.type !== 'range') { stopPlay(); step(n); e.preventDefault(); }
  });
  addEventListener('resize', () => { if (S.open) requestAnimationFrame(sizeDisc); });

  // ---------------------------------------------------------------- the tree on that day
  const NUM = ['I', 'density', 'mist', 'rays', 'exposure', 'warm', 'sat', 'contrast', 'cloud', 'cloudLit', 'sunEl'];
  const VEC = ['sunCol', 'zenith', 'horizon', 'glow', 'fog'];
  function smoothStage(target, dt) {
    const T = {
      L: target.L, turn: target.leaf.turn, flushG: target.leaf.flushG, lush: target.leaf.lush,
      wind: target.weather.wind, rain: target.weather.rain, stars: target.stars, windDir: target.weather.windDir, disc: target.L.disc
    };
    if (!S.cur) {
      S.cur = { L: { ...T.L, ...Object.fromEntries(VEC.map((k) => [k, [...T.L[k]]])) }, turn: T.turn, flushG: T.flushG, lush: T.lush, wind: T.wind, rain: T.rain, stars: T.stars, windDir: [...T.windDir], disc: T.disc };
      return S.cur;
    }
    const C = S.cur, k = 1 - Math.exp(-dt * (S.play?.kind === 'year' ? 3.2 : 5.5));
    for (const key of NUM) C.L[key] = lerp(C.L[key], T.L[key], k);
    for (const key of VEC) for (let i = 0; i < 3; i++) C.L[key][i] = lerp(C.L[key][i], T.L[key][i], k);
    let d = T.L.sunAz - C.L.sunAz;
    d -= Math.round(d / 360) * 360;
    C.L.sunAz += d * k;
    // the leaves' year has two invisible resets (season.js): never ease across those
    C.turn = Math.abs(T.turn - C.turn) > 0.45 ? T.turn : lerp(C.turn, T.turn, k);
    C.flushG = Math.abs(T.flushG - C.flushG) > 0.45 ? T.flushG : lerp(C.flushG, T.flushG, k);
    C.lush = lerp(C.lush, T.lush, k);
    C.wind = lerp(C.wind, T.wind, k); C.rain = lerp(C.rain, T.rain, k); C.stars = lerp(C.stars, T.stars, k); C.disc = lerp(C.disc, T.disc, k);
    for (let i = 0; i < 3; i++) C.windDir[i] = lerp(C.windDir[i], T.windDir[i], k);
    return C;
  }
  let fallAcc = 0, clockT = 0;
  const tmpV = new THREE.Vector3();
  /** what the loop stages while the ring is open (null otherwise) */
  function stage(dt) {
    if (!S.open || !S.k || !climate || !world || S.index < 0) return null;
    advance(dt);
    clockT += dt;
    const w = when(), target = stageFor(w, climate.row(S.index));
    const C = smoothStage(target, dt);
    // the lamp's disc: dim it in the sky without dimming its light (colour × intensity stays the same)
    const kDisc = Math.max(0.03, C.disc);
    const L = { ...C.L, sunCol: C.L.sunCol.map((v) => v * kDisc), I: C.L.I / kDisc, aperture: 0, focus: 0 };
    // leaves that let go on this day of the year, carried by this day's wind
    const rate = (target.season.fallRate / 60) * (0.5 + C.wind * 1.6 + target.weather.storm * 6);
    fallAcc += dt * Math.min(3, rate);
    const leavesOn = C.turn > 0 ? clamp((1.38 - C.turn) / 0.9) : 1;
    while (fallAcc > 1) {
      fallAcc -= 1;
      if (reduceMotion || leavesOn < 0.05) continue;
      const ros = world.rosettes, st = world.stride;
      for (let tries = 0; tries < 30; tries++) {
        const i = Math.floor(Math.random() * (ros.length / st)) * st;
        if (ros[i + 9] < 0 || ros[i + 1] < 4) continue;
        const age = C.turn > 0.05 ? 0.55 + Math.random() * 0.5 : Math.random() < 0.3 ? 0.4 + Math.random() * 0.5 : 0.05 + Math.random() * 0.2;
        const f = world.litter.release(tmpV.set(ros[i], ros[i + 1], ros[i + 2]), age);
        if (f) { f.mature = true; f.ring = true; }
        break;
      }
    }
    weather?.update(clockT, world.camera, { rain: C.rain, wind: C.wind, windDir: C.windDir, stars: C.stars, horizon: C.L.horizon }, world.renderer.getPixelRatio());
    sound?.setRain?.(C.rain);
    S.applied = C;
    return { lush: C.lush, L, wind: C.wind, sunAlt: target.sun.altitude, fallen: C.turn > 0 ? 1 - leavesOn : 0,
      parts: { dayOfYear: Math.floor(target.doy), minutes: S.minutes } };
  }
  /** after the loop has written its own wind and growth: the year's leaves and the day's wind */
  function apply() {
    if (!S.open || !S.applied) return;
    const C = S.applied;
    UNIFORMS.uYear.value = 1;
    UNIFORMS.uTurn.value = C.turn;
    UNIFORMS.uFlushG.value = C.flushG;
    UNIFORMS.uWind.value = reduceMotion ? Math.min(0.12, C.wind) : C.wind;
    const n = Math.hypot(C.windDir[0], C.windDir[2]) || 1;
    UNIFORMS.uWindDir.value.set(C.windDir[0] / n, 0, C.windDir[2] / n);
    if (C.wind > 0.8) UNIFORMS.uGust.value = Math.min(1, UNIFORMS.uGust.value + 0.25);
  }

  // ---------------------------------------------------------------- camera: stand back, the tree to one side
  // V4's first shot, a little further off, so the ring has its half of the screen. A drag
  // walks round the tree (sun and moon are where they were: go and look for them).
  const TARGET = new THREE.Vector3(AXIS.x, 6.6, AXIS.z);
  function pose() {
    const cv = world.renderer.domElement, a = cv.clientWidth / Math.max(1, cv.clientHeight);
    const portrait = a < 0.9;
    const dist = portrait ? 62 : a < 1.5 ? 62 : 55, fov = portrait ? 60 : 33;
    const az = 0.204 + S.orbit.az, h = 0.95 + S.orbit.el;
    return { portrait, fov, a,
      eye: tmpV.set(TARGET.x + Math.sin(az) * dist, h, TARGET.z + Math.cos(az) * dist).clone(),
      // where the tree's axis sits on the screen (fractions from the left and from the top)
      at: portrait ? [0.5, 0.25] : [a < 1.5 ? 0.77 : 0.755, 0.40] };
  }
  function camera(dt) {
    if (!S.open || !S.k || !world) return false;
    const o = S.orbit;
    if (!o.down) { o.az += o.vaz * dt; o.vaz *= Math.exp(-dt * 3.5); }
    const p = pose(), c = world.camera;
    const t = performance.now() / 1000, breath = reduceMotion ? 0 : Math.sin(t * 0.9) * 0.012 + Math.sin(t * 0.31) * 0.01;
    c.position.copy(p.eye); c.position.y += breath;
    c.lookAt(TARGET);
    c.fov = p.fov;
    // a lens shift (not a turn of the head) puts the tree beside the ring
    const fw = 1000 * p.a, fh = 1000;
    c.setViewOffset(fw, fh, -(p.at[0] - 0.5) * fw, -(p.at[1] - 0.5) * fh, fw, fh);
    c.updateProjectionMatrix();
    return true;
  }
  if (world) {
    const cv = world.renderer.domElement;
    cv.addEventListener('pointerdown', (e) => { if (!S.open) return; S.orbit.down = { x: e.clientX, y: e.clientY, id: e.pointerId }; S.orbit.vaz = 0; cv.setPointerCapture?.(e.pointerId); });
    cv.addEventListener('pointermove', (e) => {
      const d = S.orbit.down;
      if (!S.open || !d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      d.x = e.clientX; d.y = e.clientY;
      S.orbit.az -= dx * 0.0052; S.orbit.vaz = -dx * 0.0052 * 30;
      S.orbit.el = clamp(S.orbit.el + dy * 0.03, 0, 9);
    });
    const up = (e) => { if (S.orbit.down?.id === e.pointerId) S.orbit.down = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  }

  const api = {
    open, close, select: (iso, minutes = null) => select(indexOfDate(+iso.slice(0, 4), +iso.slice(5, 7), +iso.slice(8, 10)), { minutes }),
    setLens, setSpan: (kind, value) => { const s = spanFrom(kind, String(value)); setSpan(s, { save: false }); return s?.stats || null; },
    play: (kind) => root.querySelector(`[data-play="${kind}"]`).click(), poster, toggleMine,
    orbit: (az, elv = 0) => { S.orbit.az = az; S.orbit.el = elv; S.orbit.vaz = 0; },
    state: () => ({ open: S.open, iso: climate && S.index >= 0 ? isoOfIndex(S.index) : null, minutes: S.minutes, lens: S.lens, days: climate?.days || 0,
      span: S.span ? { from: S.span.from, to: S.span.to, days: S.span.stats?.days } : null, play: S.play?.kind || null,
      applied: S.applied ? { turn: S.applied.turn, flushG: S.applied.flushG, rain: S.applied.rain, wind: S.applied.wind, stars: S.applied.stars } : null }),
    ready, settle: () => { S.cur = null; }
  };
  return { open, close, active: () => S.open, stage, apply, camera, parseHash, api };
}
