/**
 * Experiment IV: 年轮解体 · Semantic Sunburst Dissolution
 *
 * Open-source engines reused:
 * - d3-hierarchy (ISC): hierarchy() & partition() polar coordinate subdivision
 * - d3-shape (ISC): arc() precise annular wedge geometry
 * - d3-interpolate (ISC): continuous polar domain interpolation
 * - gsap (GSAP Standard License): Interruptible polar unrolling & re-coiling transitions
 *
 * Core interaction thesis:
 * Entering a specimen dissolves the parent ring itself: the touched wedge unrolls
 * smoothly to 360°, its children inherit its exact angle and momentum to form the
 * surrounding operational arcs, and the central pith blooms into the live canvas.
 */

import { hierarchy, partition } from 'd3-hierarchy';
import { arc as d3Arc } from 'd3-shape';
import { interpolate as d3Interpolate } from 'd3-interpolate';
import gsap from 'gsap';
import {
  SPECIMENS,
  runSpecimenAction,
  getSpecimenReadout,
  mountInPlaceInstrument,
  emitWorldChange,
} from './specimens.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

export function mountSunburstExperiment(container) {
  container.innerHTML = '';
  container.className = 'exp-stage exp-sunburst';

  const svg = svgEl('svg', { class: 'sunburst-svg', 'aria-label': '年轮解体语义缩放实验场' });
  const rootG = svgEl('g');
  svg.appendChild(rootG);

  const pithOverlay = document.createElement('div');
  pithOverlay.className = 'sb-pith-overlay';

  const dock = document.createElement('div');
  dock.className = 'exp-floating-dock';
  dock.innerHTML = `
    <button type="button" class="dock-btn" id="sb-recoil">收拢回总年轮</button>
    <span class="dock-hint">点击任意环弧，年轮将沿其角度展开为 360° 操作空间；圆心同步变为实操画布</span>
  `;

  container.appendChild(svg);
  container.appendChild(pithOverlay);
  container.appendChild(dock);

  let width = container.clientWidth || 960;
  let height = container.clientHeight || 680;
  let isMobile = width < 680;
  let maxR = Math.min(width, height) * (isMobile ? 0.45 : 0.41);
  let innerCoreR = maxR * 0.44;

  // Build hierarchical data structure from the 5 shared specimens
  const treeData = {
    id: 'root',
    name: '年轮',
    color: 'var(--ink)',
    children: SPECIMENS.map((s) => ({
      id: s.id,
      name: s.name,
      en: s.en,
      glyph: s.glyph,
      color: s.color,
      specimen: s,
      children: s.children.map((c) => ({
        id: c.id,
        name: c.label,
        color: s.color,
        specimen: s,
        action: c.action,
        value: c.value,
        val: 1,
      })),
    })),
  };

  const rootNode = partition().size([2 * Math.PI, 3])(
    hierarchy(treeData).sum((d) => d.val || 0)
  );

  // Store animated current polar bounds on each node
  rootNode.each((d) => {
    d.current = { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1 };
    d.target = { ...d.current };
  });

  let focusedNode = rootNode;
  let liveUpdater = null;
  let transTween = null;

  // Map normalized depth y in [0..3] to radial pixel distance
  function yToR(y) {
    if (y <= 1) return innerCoreR * Math.max(0, y);
    return innerCoreR + ((y - 1) / 2) * (maxR - innerCoreR);
  }

  const arcGen = d3Arc()
    .startAngle((d) => d.x0)
    .endAngle((d) => d.x1)
    .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.016))
    .padRadius(180)
    .innerRadius((d) => Math.max(0, yToR(d.y0) + 3))
    .outerRadius((d) => Math.max(0, yToR(d.y1) - 3))
    .cornerRadius(6);

  const descendants = rootNode.descendants().filter((d) => d.depth > 0);
  const pathEls = new Map();
  const labelEls = new Map();

  function buildArcs() {
    rootG.innerHTML = '';
    pathEls.clear();
    labelEls.clear();

    for (const d of descendants) {
      const p = svgEl('path', {
        class: `sb-arc sb-depth-${d.depth}`,
        fill: d.data.color,
        'fill-opacity': d.depth === 1 ? '0.18' : '0.09',
        stroke: d.data.color,
        'stroke-width': d.depth === 1 ? '1.6' : '1.1',
        style: 'cursor:pointer',
      });
      p.addEventListener('click', (e) => {
        e.stopPropagation();
        handleArcClick(d);
      });
      rootG.appendChild(p);
      pathEls.set(d, p);

      const t = svgEl('text', {
        class: `sb-label sb-label-d${d.depth}`,
        'text-anchor': 'middle',
        'pointer-events': 'none',
      });
      t.textContent = d.depth === 1 ? `${d.data.glyph} ${d.data.name}` : d.data.name;
      rootG.appendChild(t);
      labelEls.set(d, t);
    }

    // Center pith ring
    const pithBg = svgEl('circle', {
      class: 'sb-pith-circle',
      r: (innerCoreR - 4).toFixed(1),
      fill: 'var(--paper-elev)',
      stroke: 'var(--ink)',
      'stroke-opacity': '0.18',
      'stroke-width': '1.2',
    });
    rootG.appendChild(pithBg);
  }

  function handleArcClick(d) {
    if (d.depth === 1) {
      // Zoom & dissolve into this specimen!
      zoomTo(d);
    } else if (d.depth === 2) {
      // Leaf action! Execute immediately & pulse arc
      runSpecimenAction(d.data.specimen.id, d.data.action, d.data.value);
      const p = pathEls.get(d);
      if (p) {
        gsap.fromTo(p, { 'fill-opacity': 0.55 }, { 'fill-opacity': 0.16, duration: 0.45, ease: 'power2.out' });
      }
      // If we weren't already zoomed into its parent specimen, zoom in seamlessly!
      if (focusedNode !== d.parent) {
        zoomTo(d.parent);
      }
    }
  }

  function zoomTo(targetNode) {
    focusedNode = targetNode;
    const isRoot = targetNode === rootNode;

    // Compute target polar coordinates for every arc
    rootNode.each((d) => {
      const nx0 = Math.max(0, Math.min(1, (d.x0 - targetNode.x0) / (targetNode.x1 - targetNode.x0))) * 2 * Math.PI;
      const nx1 = Math.max(0, Math.min(1, (d.x1 - targetNode.x0) / (targetNode.x1 - targetNode.x0))) * 2 * Math.PI;
      const ny0 = Math.max(0, d.y0 - targetNode.depth);
      const ny1 = Math.max(0, d.y1 - targetNode.depth);
      d.target = { x0: nx0, x1: nx1, y0: ny0, y1: ny1 };
    });

    // Build interpolators from current -> target (fully interruptible!)
    const interps = descendants.map((d) => ({
      d,
      interp: d3Interpolate({ ...d.current }, d.target),
    }));

    const proxy = { t: 0 };
    if (transTween) transTween.kill();
    transTween = gsap.to(proxy, {
      t: 1,
      duration: 0.65,
      ease: 'power3.inOut',
      onUpdate: () => {
        for (const item of interps) {
          item.d.current = item.interp(proxy.t);
        }
        renderArcPositions();
      },
    });

    // Update Center Pith live canvas!
    if (isRoot) {
      liveUpdater = null;
      pithOverlay.innerHTML = `
        <div class="sb-root-pith">
          <span class="sb-root-title">NIANLUN</span>
          <span class="sb-root-sub">点击任一扇弧<br/>展开 360° 语义层</span>
        </div>
      `;
    } else {
      liveUpdater = mountInPlaceInstrument(pithOverlay, targetNode.data.id, {
        compact: true,
        onClose: () => zoomTo(rootNode),
      });
      emitWorldChange(`年轮解体 → ${targetNode.data.name} 展开为 360° 操作环`);
    }
  }

  function renderArcPositions() {
    for (const d of descendants) {
      const p = pathEls.get(d);
      const t = labelEls.get(d);
      const c = d.current;
      const span = c.x1 - c.x0;
      const visible = c.y1 > 1.02 && c.y0 < 2.98 && span > 0.04;

      if (!visible) {
        p.setAttribute('opacity', '0');
        p.style.pointerEvents = 'none';
        t.setAttribute('opacity', '0');
        continue;
      }

      p.setAttribute('opacity', '1');
      p.style.pointerEvents = 'auto';
      p.setAttribute('d', arcGen(c));

      const midA = (c.x0 + c.x1) / 2 - Math.PI / 2;
      const midR = (yToR(c.y0) + yToR(c.y1)) / 2;
      const lx = Math.cos(midA) * midR;
      const ly = Math.sin(midA) * midR;
      t.setAttribute('x', lx.toFixed(1));
      t.setAttribute('y', (ly + 4).toFixed(1));
      t.setAttribute('opacity', span > 0.24 ? '1' : '0');
    }
  }

  dock.querySelector('#sb-recoil').addEventListener('click', () => {
    zoomTo(rootNode);
    emitWorldChange('年轮已收拢回总览态');
  });

  function frame() {
    if (liveUpdater) liveUpdater();
  }

  function resize() {
    width = container.clientWidth || 960;
    height = container.clientHeight || 680;
    isMobile = width < 680;
    maxR = Math.min(width, height) * (isMobile ? 0.45 : 0.42);
    innerCoreR = maxR * (isMobile ? 0.48 : 0.45);

    svg.setAttribute('viewBox', `${-width / 2} ${-height / 2} ${width} ${height}`);
    const pithBg = rootG.querySelector('.sb-pith-circle');
    if (pithBg) pithBg.setAttribute('r', (innerCoreR - 4).toFixed(1));

    pithOverlay.style.width = `${Math.round(innerCoreR * 1.82)}px`;
    pithOverlay.style.height = `${Math.round(innerCoreR * 1.82)}px`;
    renderArcPositions();
  }

  buildArcs();
  resize();
  zoomTo(rootNode);

  return {
    frame,
    resize,
    destroy() {
      if (transTween) transTween.kill();
    },
  };
}
