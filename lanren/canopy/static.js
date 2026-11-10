// Chapter 03 without WebGL (or with ?static / data saver): the same works, as a readable
// page inside the chapter's panel. Every public work stays reachable at its leaf link.
import { loadWorks } from './source.js';
import { parseHash } from './route.js';
import { DIRECTIONS } from './directions.js';
import { esc, leafLabel, authors, renderWork, renderUnavailable } from './ui.js';
import { related, currentIssue } from './model.js';

export async function renderStatic(entry = { hash: location.hash }) {
  const panel = document.getElementById('p-leaves');
  if (!panel) return;
  if (!document.querySelector('link[data-cnp]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.cnp = '1'; l.href = new URL('./canopy.css?v=1', import.meta.url).href; document.head.append(l);
  }
  const r = await loadWorks();
  const sec = document.createElement('section');
  sec.className = 'cnp-static';
  sec.id = 'leaves-works';
  sec.innerHTML = `<h3>作品树冠 · 文字版</h3>
    <p class="cnp-small">${esc(r.status === 'demo' ? r.notice : r.notice)}</p>
    ${DIRECTIONS.map((d) => {
      const ws = r.works.filter((w) => w.direction === d.id);
      return `<h4>${esc(d.zh)}</h4>${ws.length ? `<ul>${ws.map((w) => `<li><a href="#leaves/w/${esc(w.id)}" data-work="${esc(w.id)}">${esc(w.title)}</a> <small>${esc(authors(w))} · ${esc(leafLabel(w))}${w.demo ? ' · 演示' : ''}</small></li>`).join('')}</ul>` : '<p class="cnp-small">还没有公开作品。</p>'}`;
    }).join('')}
    <article class="cnp-static-read cnp-paper" hidden tabindex="-1"></article>`;
  panel.append(sec);
  const read = sec.querySelector('.cnp-static-read');
  const show = (id) => {
    const w = r.works.find((x) => x.id === id);
    read.innerHTML = w ? renderWork(w, { rel: related(r.works, id), issue: currentIssue(r.works), share: location.origin + location.pathname + '#leaves/w/' + id }) : renderUnavailable(id);
    read.hidden = false;
    read.focus();
  };
  sec.addEventListener('click', (e) => {
    const a = e.target instanceof Element ? e.target.closest('[data-work]') : null;
    if (a) { e.preventDefault(); history.replaceState(null, '', '#leaves/w/' + a.dataset.work); show(a.dataset.work); }
  });
  for (const b of document.querySelectorAll('[data-action="canopy-enter"], [data-action="canopy-find"]')) b.addEventListener('click', () => sec.scrollIntoView({ behavior: 'smooth' }));
  const h = parseHash(entry.hash);
  if (h?.work) { show(h.work); read.scrollIntoView(); }
}
