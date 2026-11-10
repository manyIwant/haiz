// Without WebGL (or with ?static): chapter 04 still holds the campus plan, as a
// drawing built from the same data and the same tree-centred frame, with every
// place readable and its walk link. No three.js is loaded.
import { buildGeo, featureSDF } from './geo.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FILL = { botanic: '#afbd95', garden: '#c3cca9', field: '#c4937d', court: '#9fb0b6', road: '#efeadf', water: '#86aaa6', tree: '#b9c197', building: '#d2c9b7', gate: '#b48a68', corridor: '#e9e3d5', pavilion: '#c7a888', rock: '#9d998f' };

export async function renderStatic(target = document.querySelector('#p-map')) {
  if (!target || target.querySelector('.cmap-static')) return;
  const base = new URL('../../', import.meta.url);
  const [campus, extras] = await Promise.all([
    fetch(new URL('assets/walk/campus.json', base)).then((r) => r.json()),
    fetch(new URL('data/buildings.json', base)).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  ]);
  const geo = buildGeo(campus, extras);
  const { x0, x1, z0, z1 } = geo.frame.sheet;
  const shapes = geo.features.map((f) => {
    const deg = (-f.rot * 180) / Math.PI;
    const r = f.kind === 'field' ? f.hd : f.kind === 'water' ? Math.min(f.hw, f.hd) * 0.35 : 0;
    return `<rect x="${(f.cx - f.hw).toFixed(1)}" y="${(f.cz - f.hd).toFixed(1)}" width="${(f.hw * 2).toFixed(1)}" height="${(f.hd * 2).toFixed(1)}" rx="${r.toFixed(1)}"`
      + ` transform="rotate(${deg.toFixed(2)} ${f.cx.toFixed(1)} ${f.cz.toFixed(1)})" fill="${FILL[f.kind] || '#ccc'}" stroke="${['building', 'gate', 'pavilion', 'rock'].includes(f.kind) ? '#3c4a41' : '#b9b09c'}" stroke-width="0.5"><title>${esc(f.name)}</title></rect>`;
  }).join('');
  const labels = geo.places.filter((p) => p.priority <= 1).map((p) => `<text x="${p.x.toFixed(1)}" y="${p.z.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${esc(p.name)}</text>`).join('');
  const list = geo.places.map((p) => `<li><details><summary><b>${esc(p.name)}</b><small>${p.id === 'lanshu' ? '原点' : `${esc(p.fromTree.bearing)} · 约 ${Math.round(p.fromTree.distance)} m`}</small></summary>`
    + `${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)} · 项目已有照片" loading="lazy">` : ''}<p>${esc(p.desc)}</p><a href="${esc(p.walk)}">从这里步入校园 ↗</a></details></li>`).join('');
  const fig = document.createElement('figure');
  fig.className = 'cmap-static';
  fig.innerHTML = `<svg viewBox="${x0} ${z0} ${x1 - x0} ${z1 - z0}" role="img" aria-label="校园平面：以百年榄仁树为原点，北门方向朝上">
      <rect x="${x0}" y="${z0}" width="${x1 - x0}" height="${z1 - z0}" fill="#e4ddcd"/>${shapes}
      <circle cx="0" cy="0" r="9" fill="none" stroke="#2b3d33" stroke-width="1.6"/><circle cx="0" cy="0" r="2.4" fill="#2b3d33"/>
      <g font-size="9" fill="#22302a" font-family="serif">${labels}</g></svg>
    <figcaption>校园平面 · 以百年榄仁树（圆圈）为原点，北门方向朝上，1 米即 1 米。沿用项目既有数据，为近似表达，不作实地导航。</figcaption>
    <ol class="cmap-static-list">${list}</ol>`;
  target.append(fig);
  if (!document.querySelector('style[data-cmap-static]')) {
    const st = document.createElement('style');
    st.dataset.cmapStatic = '';
    st.textContent = `.cmap-static{margin:24px 0 0;max-width:760px}.cmap-static svg{width:100%;height:auto;border-radius:12px;display:block}
.cmap-static figcaption{font-size:11px;color:var(--ink-3);margin:8px 0 12px}.cmap-static-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px 18px}
.cmap-static-list summary{cursor:pointer;display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--edge);font:14px var(--serif)}
.cmap-static-list small{color:var(--ink-3);font-size:11px}.cmap-static-list img{width:100%;border-radius:8px;margin-top:8px}.cmap-static-list p{font:12.5px/1.8 var(--serif);color:var(--ink-2)}`;
    document.head.append(st);
  }
  return { geo, featureSDF };
}
