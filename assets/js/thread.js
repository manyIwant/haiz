/* The thread back to the tree.
 *
 * Every page HAIZ reaches from the tree is a different room with its own character; what makes them
 * one work is that you never lose the way you came. Two small things, on every page that loads the
 * shared experience desk (experience.js), never on the tree itself:
 *
 *   arrival  the tree leaves through a veil shaped by the act (02 sinks into the trunk's shade, 04
 *            draws the crown's contours, 05 walks into the light, 06 steps back ...). The page picks
 *            that veil up in the same colour and finishes the move, so the cut is one gesture
 *            across two documents, not a white flash and a new website.
 *   return   a quiet line in the corner names the act you came from ("05 · 远眺") and takes you back
 *            to exactly that view of the tree (index.html#days), not to the beginning of the film.
 *
 * Nothing is sent anywhere: the tree writes sessionStorage `haiz.thread` as it leaves, and its own
 * `haiz.home` (the act last seen, this tab only). Without either, nothing is shown.
 */
(() => {
  'use strict';
  if (document.body.classList.contains('home')) return;
  const ACTS = [
    ['tree', '01', '初遇'], ['roots', '02', '根脉'], ['leaves', '03', '青春生长'],
    ['map', '04', '地图'], ['days', '05', '远眺'], ['whole', '06', '回望']
  ];
  const read = (k) => { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch { return null; } };
  const thread = read('haiz.thread');
  const home = read('haiz.home');
  try { sessionStorage.removeItem('haiz.thread'); } catch { /* storage blocked */ }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fresh = !!thread && Date.now() - thread.t < 15000;
  const act = fresh ? thread.i : home && Date.now() - home.t < 6 * 3600e3 ? home.c : -1;

  // ---------------------------------------------------------------- arrival
  if (fresh && !reduced) {
    const v = document.createElement('div');
    v.className = 'thread-veil';
    v.dataset.kind = thread.kind || 'leaf';
    v.style.setProperty('--veil', thread.colour || '#f7f3eb');
    if (thread.kind === 'map' && thread.contours) {
      v.innerHTML = `<svg viewBox="-50 -50 100 100" aria-hidden="true">${thread.contours.map((d) => `<path d="${d}"/>`).join('')}</svg>`;
    }
    document.documentElement.append(v);
    const done = () => v.remove();
    v.addEventListener('animationend', (e) => { if (e.target === v) done(); });
    setTimeout(done, 2400);
  }

  // ---------------------------------------------------------------- return
  if (act < 0 || act >= ACTS.length) return;
  const [id, n, name] = ACTS[act];
  const a = document.createElement('a');
  a.className = 'thread-back';
  a.href = 'index.html' + (act > 0 ? '#' + id : '');
  // pages one level down (lab/, windowsill/ ...) reach the tree one level up
  if (/\/(lab|windowsill|pocket|login|lamp|vega)\//.test(location.pathname)) a.href = '../' + a.getAttribute('href');
  a.setAttribute('aria-label', `回到榄仁树：第 ${n} 幕 ${name}`);
  a.innerHTML = `<svg viewBox="0 0 12 18" aria-hidden="true"><path d="M6 1C2.6 4.2 1.4 7.4 1.6 10.4 1.8 13.6 3.8 15.6 6 16.4c2.2-.8 4.2-2.8 4.4-6C10.6 7.4 9.4 4.2 6 1Z"/><path d="M6 3.2V17.4"/></svg><span><b>${n}</b> ${name}</span><em>回到榄仁树</em>`;
  // dressed in the page's own paper and ink, so it belongs to each room rather than to a toolbar
  const cs = getComputedStyle(document.body), bg = cs.backgroundColor;
  a.style.setProperty('--thread-bg', !bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent' ? '#f7f3eb' : bg);
  a.style.setProperty('--thread-ink', cs.color);
  document.body.append(a);
  // the brand mark also goes back to the view you left, not to the start of the film
  for (const b of document.querySelectorAll('a.brand[href="index.html"], a.brand[href="./index.html"], a.brand[href="/"]')) b.setAttribute('href', a.getAttribute('href'));
  // out of the way while reading down, back when you scroll up or reach the end
  let last = scrollY, raf = 0;
  addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const y = scrollY, end = y + innerHeight > document.documentElement.scrollHeight - 40;
      a.classList.toggle('is-away', y > 240 && y > last && !end);
      last = y;
    });
  }, { passive: true });
})();
