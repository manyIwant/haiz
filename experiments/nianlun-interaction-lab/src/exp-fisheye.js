/**
 * Experiment II: 时空透镜 · Continuous Fisheye Voronoi Membrane
 *
 * Open-source engines reused:
 * - d3-fisheye (BSD-3-Clause, duaneatat/d3-fisheye): Smooth Sarkar-Brown radial fisheye distortion
 * - d3-delaunay (ISC): Real-time 60fps Voronoi cellular tessellation
 * - gsap (GSAP Standard License): Smooth optical focal lock & lens tension spring
 *
 * Core interaction thesis:
 * The interface is ONE continuous cellular membrane with zero floating cards.
 * Moving or pressing warps local space optically (Focus + Context): the focused
 * cell expands into an active instrument right inside its bent polygon walls,
 * while neighboring cells compress cleanly around the rim without ever disappearing.
 */

import { radial as fisheyeRadial } from 'd3-fisheye';
import { Delaunay } from 'd3-delaunay';
import gsap from 'gsap';
import {
  SPECIMENS,
  emitWorldChange,
  getSpecimenReadout,
  mountInPlaceInstrument,
} from './specimens.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

export function mountFisheyeExperiment(container) {
  container.innerHTML = '';
  container.className = 'exp-stage exp-fisheye';

  const svg = svgEl('svg', { class: 'fisheye-svg', 'aria-label': '时空透镜连续细胞膜实验' });
  const cellGroup = svgEl('g', { class: 'fe-cells' });
  const labelGroup = svgEl('g', { class: 'fe-labels' });
  svg.appendChild(cellGroup);
  svg.appendChild(labelGroup);

  const liveOverlay = document.createElement('div');
  liveOverlay.className = 'fe-live-overlay';
  liveOverlay.style.display = 'none';

  const dock = document.createElement('div');
  dock.className = 'exp-floating-dock';
  dock.innerHTML = `
    <label class="dock-slider-label">
      <span>透镜张力</span>
      <input type="range" id="fe-dist-slider" min="0.5" max="5.2" step="0.1" value="2.2" />
    </label>
    <button type="button" class="dock-btn" id="fe-relax">松弛透镜</button>
  `;

  container.appendChild(svg);
  container.appendChild(liveOverlay);
  container.appendChild(dock);

  let width = container.clientWidth || 960;
  let height = container.clientHeight || 680;
  let cx = width / 2;
  let cy = height / 2;
  let minDim = Math.min(width, height);
  let isMobile = width < 680;

  // Optical lens state animated via GSAP
  const lens = {
    x: cx,
    y: cy,
    distortion: 2.0,
    radius: minDim * 0.48,
    lockedId: null, // specimen id when locked open
    targetDistortion: 2.2,
  };

  const fe = fisheyeRadial()
    .radius(lens.radius)
    .distortion(lens.distortion)
    .smoothing(0.28);

  // Build resting lattice: 1 pith + 5 primary specimens + 10 outer cambium context cells
  let baseSites = [];
  function buildLattice() {
    cx = width / 2;
    cy = height / 2;
    minDim = Math.min(width, height);
    isMobile = width < 680;
    lens.radius = minDim * (isMobile ? 0.56 : 0.49);
    fe.radius(lens.radius);

    const rSpec = minDim * (isMobile ? 0.23 : 0.21);
    const rOuter = minDim * (isMobile ? 0.44 : 0.41);

    baseSites = [
      { id: 'pith', type: 'pith', x: cx, y: cy, label: '原点', color: 'var(--ink)' },
    ];

    for (const s of SPECIMENS) {
      const rad = (s.angle * Math.PI) / 180;
      baseSites.push({
        id: s.id,
        type: 'specimen',
        spec: s,
        x: cx + Math.cos(rad) * rSpec,
        y: cy + Math.sin(rad) * rSpec,
        label: s.name,
        color: s.color,
      });
    }

    for (let i = 0; i < 10; i++) {
      const rad = ((i * 36 - 72) * Math.PI) / 180;
      baseSites.push({
        id: `bark-${i}`,
        type: 'bark',
        x: cx + Math.cos(rad) * rOuter,
        y: cy + Math.sin(rad) * rOuter,
        label: '',
        color: 'var(--ink)',
      });
    }
  }

  // Create persistent SVG elements for each Voronoi cell
  let cellEls = [];
  let labelEls = [];
  let liveUpdater = null;

  function initCellElements() {
    cellGroup.innerHTML = '';
    labelGroup.innerHTML = '';
    cellEls = [];
    labelEls = [];

    baseSites.forEach((site, idx) => {
      const path = svgEl('path', {
        class: `fe-cell fe-cell-${site.type}`,
        'data-site-id': site.id,
      });
      if (site.type === 'specimen') {
        path.style.setProperty('--spec-color', site.color);
        path.style.cursor = 'pointer';
        path.addEventListener('click', (e) => {
          e.stopPropagation();
          lockSpecimen(site.id);
        });
      } else if (site.type === 'pith') {
        path.style.cursor = 'pointer';
        path.addEventListener('click', (e) => {
          e.stopPropagation();
          unlockLens();
        });
      }
      cellGroup.appendChild(path);
      cellEls.push(path);

      const g = svgEl('g', { class: `fe-label-g fe-label-${site.type}`, 'pointer-events': 'none' });
      if (site.type === 'specimen') {
        const glyph = svgEl('text', { class: 'fe-glyph', 'text-anchor': 'middle', y: -14, fill: site.color });
        glyph.textContent = site.spec.glyph;
        const name = svgEl('text', { class: 'fe-name', 'text-anchor': 'middle', y: 6 });
        name.textContent = site.spec.name;
        const sub = svgEl('text', { class: 'fe-sub', 'text-anchor': 'middle', y: 24 });
        g.appendChild(glyph);
        g.appendChild(name);
        g.appendChild(sub);
      } else if (site.type === 'pith') {
        const name = svgEl('text', { class: 'fe-pith-txt', 'text-anchor': 'middle', y: 4 });
        name.textContent = '年轮心';
        g.appendChild(name);
      }
      labelGroup.appendChild(g);
      labelEls.push(g);
    });
  }

  function lockSpecimen(id) {
    const site = baseSites.find((s) => s.id === id);
    if (!site) return;

    if (lens.lockedId === id) return;
    lens.lockedId = id;

    // Smoothly spring optical lens center & deep magnification directly onto the cell!
    gsap.killTweensOf(lens);
    gsap.to(lens, {
      x: site.x,
      y: site.y,
      distortion: isMobile ? 4.2 : 4.6,
      duration: 0.62,
      ease: 'power3.out',
    });

    const slider = dock.querySelector('#fe-dist-slider');
    if (slider) slider.value = String(isMobile ? 4.2 : 4.6);

    liveOverlay.style.display = 'flex';
    liveUpdater = mountInPlaceInstrument(liveOverlay, id, {
      compact: isMobile,
      onClose: () => unlockLens(),
    });
    emitWorldChange(`透镜聚焦：${site.spec.name}（周围细胞自动折叠让位）`);
  }

  function unlockLens() {
    lens.lockedId = null;
    liveOverlay.style.display = 'none';
    liveOverlay.innerHTML = '';
    liveUpdater = null;

    gsap.killTweensOf(lens);
    gsap.to(lens, {
      x: cx,
      y: cy,
      distortion: lens.targetDistortion,
      duration: 0.55,
      ease: 'power3.out',
    });
    const slider = dock.querySelector('#fe-dist-slider');
    if (slider) slider.value = String(lens.targetDistortion);
  }

  // Hovering bends the tissue live when unlocked
  svg.addEventListener('pointermove', (e) => {
    if (lens.lockedId) return;
    const rect = svg.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    gsap.to(lens, { x: px, y: py, duration: 0.24, ease: 'power2.out', overwrite: 'auto' });
  });

  svg.addEventListener('pointerleave', () => {
    if (lens.lockedId) return;
    gsap.to(lens, { x: cx, y: cy, duration: 0.6, ease: 'power3.out', overwrite: 'auto' });
  });

  // Slider & Relax button
  const distSlider = dock.querySelector('#fe-dist-slider');
  distSlider.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    lens.targetDistortion = v;
    lens.distortion = v;
  });
  dock.querySelector('#fe-relax').addEventListener('click', () => {
    lens.targetDistortion = 1.6;
    unlockLens();
    emitWorldChange('时空透镜已松弛回中性态');
  });

  function polygonCentroid(poly) {
    let x = 0, y = 0, area = 0;
    for (let i = 0, n = poly.length - 1; i < n; i++) {
      const [x0, y0] = poly[i];
      const [x1, y1] = poly[i + 1];
      const f = x0 * y1 - x1 * y0;
      area += f;
      x += (x0 + x1) * f;
      y += (y0 + y1) * f;
    }
    if (Math.abs(area) < 1e-4) return [poly[0][0], poly[0][1]];
    area *= 3;
    return [x / area, y / area];
  }

  function frame() {
    fe.focus([lens.x, lens.y]).distortion(lens.distortion);
    const warped = baseSites.map((s) => {
      const [wx, wy, wz] = fe([s.x, s.y]);
      return [wx, wy, wz];
    });

    const pad = 16;
    const delaunay = Delaunay.from(warped, (d) => d[0], (d) => d[1]);
    const voronoi = delaunay.voronoi([pad, pad, width - pad, height - pad - 54]);

    for (let i = 0; i < baseSites.length; i++) {
      const site = baseSites[i];
      const poly = voronoi.cellPolygon(i);
      if (!poly) continue;
      const d = 'M ' + poly.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L ') + ' Z';
      const pathEl = cellEls[i];
      pathEl.setAttribute('d', d);

      const isLocked = lens.lockedId === site.id;
      pathEl.classList.toggle('is-locked', isLocked);

      const [mx, my] = polygonCentroid(poly);
      const zScale = Math.max(0.76, Math.min(1.35, 0.8 + warped[i][2] * 0.2));

      const lbl = labelEls[i];
      if (site.type === 'specimen') {
        if (isLocked) {
          lbl.setAttribute('opacity', '0');
          // Position live instrument directly inside the warped Voronoi cell!
          liveOverlay.style.left = `${mx.toFixed(1)}px`;
          liveOverlay.style.top = `${my.toFixed(1)}px`;
          if (liveUpdater) liveUpdater();
        } else {
          lbl.setAttribute('opacity', '1');
          lbl.setAttribute('transform', `translate(${mx.toFixed(1)}, ${my.toFixed(1)}) scale(${zScale.toFixed(2)})`);
          const sub = lbl.querySelector('.fe-sub');
          if (sub) sub.textContent = getSpecimenReadout(site.id);
        }
      } else if (site.type === 'pith') {
        lbl.setAttribute('transform', `translate(${mx.toFixed(1)}, ${my.toFixed(1)})`);
      }
    }
  }

  function resize() {
    width = container.clientWidth || 960;
    height = container.clientHeight || 680;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    buildLattice();
    if (!lens.lockedId) {
      lens.x = cx;
      lens.y = cy;
    } else {
      const site = baseSites.find((s) => s.id === lens.lockedId);
      if (site) { lens.x = site.x; lens.y = site.y; }
    }
  }

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  buildLattice();
  initCellElements();

  return {
    frame,
    resize,
    destroy() {
      gsap.killTweensOf(lens);
    },
  };
}
