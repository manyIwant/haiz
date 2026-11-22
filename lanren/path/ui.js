// The page's few words. No floating glass: captions are set like title cards in the film, and a
// photograph's record is a paper slip — what it is, who made it, what is not known, and where the
// model disagrees with it. Everything else stays out of the picture.
import { STATIONS } from './memory.js';

const $ = (s, r = document) => r.querySelector(s);
const pad = (n) => String(n).padStart(2, '0');

export function createUI({ coarse, reduce }) {
  const root = $('#pw-ui');
  root.innerHTML = `
  <div class="pw-load" id="pwLoad"><p><b>晨径</b><span>北门 → 太湖石 → 百年榄仁树</span></p><i><em id="pwBar"></em></i><small id="pwStatus">准备…</small></div>
  <header class="pw-top">
    <a class="pw-mark" href="index.html" aria-label="回到 HAIZ 首页">haiz</a>
    <p class="pw-when" id="pwWhen"></p>
  </header>
  <nav class="pw-tools" aria-label="观看方式">
    <button type="button" id="pwDirector" aria-pressed="true" title="导演的镜头 / 自己走（任何操作都会接过镜头）">导演镜头</button>
    <button type="button" id="pwTime" title="电影里的清晨，或者海口此刻真实的太阳">初夏清晨</button>
    <button type="button" id="pwSound" aria-pressed="false">声音</button>
    <button type="button" id="pwAbout" aria-expanded="false" aria-controls="pwInfo">关于</button>
  </nav>
  <section class="pw-caption" id="pwCaption" aria-live="polite"><h2></h2><p></p></section>
  <aside class="pw-slip" id="pwSlip" hidden aria-live="polite">
    <p class="pw-slip-k"><span id="pwSlipPlace"></span><b id="pwSlipState">显影中</b></p>
    <h3 id="pwSlipTitle"></h3>
    <dl>
      <dt>来源</dt><dd id="pwSlipSource"></dd>
      <dt>拍摄</dt><dd id="pwSlipAuthor"></dd>
      <dt>权利</dt><dd id="pwSlipRights"></dd>
    </dl>
    <details><summary>照片与模型的差异</summary><p id="pwSlipNote"></p><p class="pw-fit" id="pwSlipFit"></p></details>
  </aside>
  <p class="pw-hint" id="pwHint" aria-live="polite"></p>
  <ol class="pw-line" id="pwLine" aria-label="导演镜头的段落"></ol>
  <div class="pw-stick" id="pwStick" hidden><i></i></div>
  <section class="pw-info" id="pwInfo" hidden>
    <h2>晨径 · 这是什么</h2>
    <p>从北门沿中轴线走到太湖石「虎踞龙盘」和一号教学楼前的百年榄仁树。建筑是项目的 Blender V3 近似模型，树是物种概念模型；位置按校园数据 <code>campus.json</code>（原始 KML 缺失，方向未经测绘复核），太阳按海口校园的真实位置计算。</p>
    <p>路上有三张项目里已有的照片。站到拍摄者当时的位置、朝同一个方向看，照片会重新落回它拍下的地方；走开，它还留在墙上，但不再对得上——那些对不上的地方，就是模型和真实校园的差别。</p>
    <p>${coarse ? '左手拖动行走，右手拖动环顾。' : 'WASD / 方向键行走，Shift 快走，拖动画面环顾。'}任何操作都会接过导演的镜头；「导演镜头」按钮从你所在的位置继续。</p>
    <p class="pw-small">非官方。照片的来源与授权状态见每张照片的说明；未注明的年代与作者不作推断。</p>
    <button type="button" id="pwInfoClose">继续</button>
  </section>`;
  const el = { load: $('#pwLoad'), bar: $('#pwBar'), status: $('#pwStatus'), when: $('#pwWhen'), director: $('#pwDirector'), time: $('#pwTime'), sound: $('#pwSound'),
    caption: $('#pwCaption'), slip: $('#pwSlip'), hint: $('#pwHint'), line: $('#pwLine'), stick: $('#pwStick'), info: $('#pwInfo'), about: $('#pwAbout') };
  const cb = { director: [], time: [], sound: [], seek: [] };
  el.director.addEventListener('click', () => cb.director.forEach((f) => f()));
  let timeKey = 'film';
  el.time.addEventListener('click', () => { timeKey = timeKey === 'film' ? 'now' : 'film'; cb.time.forEach((f) => f(timeKey)); });
  let soundOn = false;
  el.sound.addEventListener('click', () => { soundOn = !soundOn; el.sound.setAttribute('aria-pressed', soundOn); cb.sound.forEach((f) => f(soundOn)); });
  const toggleInfo = (open) => { el.info.hidden = !open; el.about.setAttribute('aria-expanded', open); };
  el.about.addEventListener('click', () => toggleInfo(el.info.hidden));
  $('#pwInfoClose').addEventListener('click', () => toggleInfo(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleInfo(false); });
  for (const s of ['pointerdown', 'keydown']) el.info.addEventListener(s, (e) => e.stopPropagation());

  const progress = { tree: 0, buildings: 0 };
  let lastCue = null, slipFor = null, film = null;

  function showSlip(st, state) {
    if (!st) { el.slip.hidden = true; slipFor = null; return; }
    if (slipFor !== st.id) {
      slipFor = st.id;
      $('#pwSlipPlace').textContent = st.place;
      $('#pwSlipTitle').textContent = st.title;
      $('#pwSlipSource').textContent = st.source;
      $('#pwSlipAuthor').textContent = `${st.author} · ${st.date}`;
      $('#pwSlipRights').textContent = st.rights;
      $('#pwSlipNote').textContent = st.note;
      $('#pwSlipFit').textContent = '对位方法：' + st.fit;
      el.slip.hidden = false;
    }
    $('#pwSlipState').textContent = state;
  }

  return {
    status(t) { el.status.textContent = t || ''; if (t) el.status.dataset.last = t; },
    progress(k, f) { progress[k] = f; el.bar.style.transform = `scaleX(${Math.min(1, (progress.tree * 0.6 + progress.buildings * 0.4) + 0.05)})`; },
    ready() { el.load.classList.add('done'); setTimeout(() => (el.load.hidden = true), reduce ? 0 : 900); },
    onDirector: (f) => cb.director.push(f),
    onTime: (f) => cb.time.push(f),
    onSound: (f) => cb.sound.push(f),
    onSeek: (f) => cb.seek.push(f),
    when(w, key) {
      timeKey = key;
      el.time.textContent = key === 'now' ? '海口此刻' : '初夏清晨';
      el.when.textContent = `${w.year}-${pad(w.month)}-${pad(w.day)} ${pad(w.hour)}:${pad(w.minute)} · 太阳按校园真实位置计算`;
    },
    mode(m) {
      el.director.setAttribute('aria-pressed', m === 'film');
      el.director.textContent = m === 'film' ? '导演镜头' : '回到导演镜头';
      document.body.dataset.mode = m;
    },
    /** the film's timeline, with the stations as stops */
    setFilm(f, seek) {
      film = f;
      el.line.innerHTML = f.cues.filter((c) => c.kind !== 'handover').map((c) => {
        const st = c.id ? STATIONS.find((s) => s.id === c.id) : null;
        const label = st ? st.title : c.text;
        return `<li style="left:${(c.t0 / f.duration) * 100}%"><button type="button" data-t="${c.t0}" title="${label}"><span>${label}</span></button></li>`;
      }).join('') + '<li class="pw-now" aria-hidden="true"></li>';
      el.line.addEventListener('click', (e) => { const b = e.target.closest('button[data-t]'); if (b) seek(+b.dataset.t); });
    },
    update(S, f) {
      const now = el.line.querySelector('.pw-now');
      if (now) now.style.left = (S.filmT / f.duration) * 100 + '%';
      const cue = S.mode === 'film' ? f.cueAt(S.filmT) : null;
      if (cue !== lastCue) {
        lastCue = cue;
        if (cue && (cue.kind === 'place' || cue.kind === 'handover')) {
          el.caption.querySelector('h2').textContent = cue.text;
          el.caption.querySelector('p').textContent = cue.sub || '';
          el.caption.dataset.kind = cue.kind;
        }
      }
      // captions are a function of film time (seekable, no CSS clock): 1.2 s in, 1 s out
      let a = 0;
      if (cue && (cue.kind === 'place' || cue.kind === 'handover')) a = Math.min(1, (S.filmT - cue.t0) / (reduce ? 0.3 : 1.2), (cue.t1 - S.filmT) / (reduce ? 0.3 : 1.0));
      a = Math.max(0, a);
      el.caption.style.opacity = a.toFixed(3);
      el.caption.style.transform = `translateY(${((1 - a) * 10).toFixed(1)}px)`;
      el.caption.classList.toggle('on', a > 0);
    },
    memory(st, what) {
      if (what === 'enter') showSlip(st, '显影中');
      else if (what === 'developed') showSlip(st, '已显影');
      else if (what === 'leave') showSlip(null);
    },
    hint(state, m) {
      // the record is as present as the print it describes
      if (!el.slip.hidden) el.slip.style.opacity = Math.min(1, (state.amt || 0) * 1.6 + (state.active ? 0.15 : 0)).toFixed(3);
      if (document.body.dataset.mode !== 'free') { el.hint.textContent = ''; return; }
      const st = m.near;
      let t = '';
      if (st && m.nearD < 14 && !(state.active === st && state.amt > 0.5)) {
        t = m.nearD > 1.4 ? `${st.title} · 拍摄者站在前方约 ${Math.round(m.nearD)} 米的圆环上` : (st.align > 0.05 ? '对准了：别动' : '转向白色取景框');
      }
      el.hint.textContent = t;
    },
    stick(on, x, y, dx, dy) {
      el.stick.hidden = !on;
      if (on) { el.stick.style.left = x + 'px'; el.stick.style.top = y + 'px'; el.stick.firstElementChild.style.transform = `translate(${dx || 0}px, ${dy || 0}px)`; }
    },
  };
}
