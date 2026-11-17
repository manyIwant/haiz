// 入画 · the interface: as little as each moment needs, at the edges of the picture.
const $ = (s, r = document) => r.querySelector(s);

export function createUI({ coarse }) {
  const listeners = new Map();
  const emit = (k, ...a) => (listeners.get(k) || []).forEach((f) => f(...a));
  const root = $('#rh-ui');
  const status = $('#rh-status');
  const body = document.body;
  const chipEls = [...root.querySelectorAll('[data-chip]')];
  let lastCap = '', lastOrigin = 'loading';

  root.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('[data-act]') : null;
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'paint') emit('paint');
    else if (act === 'skip') emit('skip');
    else if (act === 'depart') emit('depart');
    else if (act === 'replay') { closePanel(); emit('replay'); }
    else if (act === 'panel') togglePanel();
    else if (act === 'close-panel') closePanel();
    else if (act === 'wx') { emit('weather', b.dataset.wx, b.dataset.hour != null ? Number(b.dataset.hour) : null); markWx(b.dataset.wx); }
    else if (act === 'hour') { emit('weather', null, Number(b.dataset.hour)); markHour(b); }
    else if (act === 'live') { emit('weather', 'live'); markWx('live'); root.querySelectorAll('[data-act="hour"]').forEach((x) => x.setAttribute('aria-pressed', 'false')); }
    else if (act === 'help') { const h = $('#rh-help'); h.hidden = !h.hidden; }
    else if (act === 'close-help') $('#rh-help').hidden = true;
  });
  // hold Space / Enter to paint with the keyboard
  let held = false;
  addEventListener('keydown', (e) => {
    if (!['paint', 'spill'].includes(body.dataset.stage)) return;
    if ((e.code === 'Space' || e.code === 'Enter') && !held && !(e.target instanceof Element && e.target.closest('button'))) { held = true; e.preventDefault(); emit('hold', true); }
  });
  addEventListener('keyup', (e) => { if ((e.code === 'Space' || e.code === 'Enter') && held) { held = false; emit('hold', false); } });

  function togglePanel() { const p = $('#rh-panel'); p.hidden = !p.hidden; $('[data-act="panel"]').setAttribute('aria-expanded', String(!p.hidden)); }
  function closePanel() { $('#rh-panel').hidden = true; $('[data-act="panel"]').setAttribute('aria-expanded', 'false'); }
  function markWx(k) { root.querySelectorAll('[data-act="wx"],[data-act="live"]').forEach((x) => x.setAttribute('aria-pressed', String((x.dataset.wx || 'live') === k))); }
  function markHour(b) { root.querySelectorAll('[data-act="hour"]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }

  const ORIGIN = { live: '海口此刻', cached: '海口 · 稍早的预报', offline: '离线 · 海口气候常态', loading: '海口 · 读取中', free: '自由天气' };
  const api = {
    on(k, f) { if (!listeners.has(k)) listeners.set(k, []); listeners.get(k).push(f); },
    say(t) { if (status) status.textContent = t; },
    progress(p) { $('#rh-bar')?.style.setProperty('--p', String(Math.min(1, p))); },
    ready() { body.classList.add('rh-ready'); api.say(''); },
    stage(name) {
      body.dataset.stage = name;
      const hint = $('#rh-hint');
      const text = {
        hold: '', easel: '支起画架…',
        paint: coarse ? '用手指在画布上画' : '在画布上拖动作画 · 按住空格也可以',
        spill: '画到画框外面去', depart: '', spread: '', enter: '', stroll: '',
      }[name] ?? '';
      hint.textContent = text;
      hint.hidden = !text;
      if (name === 'paint') api.paintStage('起稿', 0);
      if (name === 'spill') api.paintStage('越出画框', 1);
      if (name === 'stroll') {
        const g = $('#rh-arrive');
        $('#rh-arrive-sub').textContent = lastOrigin === 'free' ? '画里是你选的天气；右上角可以回到「海口此刻」。'
          : lastOrigin === 'offline' ? '暂时读不到海口的预报，画里是本月的气候常态。' : '画里的天，跟着海口此刻。';
        g.hidden = false; setTimeout(() => { g.hidden = true; }, 6500);
      }
    },
    paintStage(name) {
      chipEls.forEach((c) => c.setAttribute('aria-current', String(c.dataset.chip === name)));
      const order = chipEls.map((c) => c.dataset.chip), i = order.indexOf(name);
      chipEls.forEach((c, j) => c.classList.toggle('done', j < i));
    },
    weather(cap, S) {
      lastOrigin = cap.origin;
      const line = `${ORIGIN[cap.origin] || ''} · ${cap.name} ${cap.temp}° · ${cap.wind}`;
      if (line !== lastCap) {
        lastCap = line;
        $('#rh-wx').textContent = line;
        const src = $('#rh-src');
        if (src) {
          src.textContent = cap.origin === 'free' ? '自由天气：可随时回到「海口此刻」。'
            : cap.origin === 'offline' ? '暂时读不到预报：显示的是海口本月的气候常态，不是此刻的天气。'
              : `Open-Meteo 预报模型（约 10 km 网格），不是校内观测${cap.age != null ? ` · ${cap.age} 分钟前更新` : ''}${cap.origin === 'cached' ? ' · 网络暂不可用，使用稍早的预报' : ''}。`;
        }
        $('#rh-wx-detail').textContent = `${cap.date} ${cap.clock} · 湿度 ${cap.rh}% · 风 ${cap.windMs} m/s（${cap.windWord}）· 地面 ${S.cur.wet > 0.6 ? '湿' : S.cur.wet > 0.2 ? '潮' : '干'}`;
      }
    },
  };
  return api;
}
