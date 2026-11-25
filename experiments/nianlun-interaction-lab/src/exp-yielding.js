/**
 * Experiment I: 让位生长 · Spatial Yielding & Multi-Object Confluence
 *
 * Open-source engines reused:
 * - d3-force (ISC): Velocity Verlet simulation, forceCollide, forceRadial, forceX/Y
 * - flubber (MIT): Smooth 2D SVG shape interpolation (organic seed arc <-> open aperture)
 * - gsap (GSAP Standard License): Elastic overshoot spring choreography
 *
 * Core interaction thesis:
 * Touching a Nianlun node does NOT pop up a detached modal or sidebar card.
 * The node ITSELF grows in-place via flubber morphing while d3-force pushes
 * surrounding nodes smoothly aside (Spatial Yielding). Dragging any two nodes
 * close together stretches an elastic bridge that couples their live physics.
 */

import { forceSimulation, forceCollide, forceRadial, forceX, forceY } from 'd3-force';
import { interpolate as flubberInterpolate } from 'flubber';
import gsap from 'gsap';
import {
  SPECIMENS,
  world,
  describeCoupling,
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

/** Generate a closed organic pebble/ring-petal SVG path centered at (0,0) */
function makeSeedBlobPath(r) {
  const pts = [];
  const N = 24;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    // Slight botanical asymmetry like a cross-section bud
    const wobble = 1 + 0.08 * Math.cos(3 * a) + 0.04 * Math.sin(2 * a);
    pts.push([Math.cos(a) * r * wobble, Math.sin(a) * r * wobble]);
  }
  return 'M ' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L ') + ' Z';
}

/** Generate a closed superellipse / squircle aperture path centered at (0,0) */
function makeAperturePath(rx, ry, exp = 3.2) {
  const pts = [];
  const N = 36;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const x = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / exp) * rx;
    const y = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / exp) * ry;
    pts.push([x, y]);
  }
  return 'M ' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L ') + ' Z';
}

export function mountYieldingExperiment(container) {
  container.innerHTML = '';
  container.className = 'exp-stage exp-yielding';

  const svg = svgEl('svg', { class: 'yielding-svg', 'aria-label': '让位生长极坐标物理实验场' });
  const overlay = document.createElement('div');
  overlay.className = 'yielding-overlay';
  container.appendChild(svg);
  container.appendChild(overlay);

  // Subtle background concentric annual rings (visual anchor, NOT rigid lock)
  const bgGroup = svgEl('g', { class: 'yielding-bg' });
  const linkGroup = svgEl('g', { class: 'yielding-links' });
  const nodeGroup = svgEl('g', { class: 'yielding-nodes' });
  svg.appendChild(bgGroup);
  svg.appendChild(linkGroup);
  svg.appendChild(nodeGroup);

  let width = container.clientWidth || 960;
  let height = container.clientHeight || 680;
  let cx = width / 2;
  let cy = height / 2;
  let isMobile = width < 680;
  let orbitRadius = isMobile ? Math.min(width, height) * 0.28 : Math.min(width, height) * 0.27;
  let rSeed = isMobile ? 40 : 50;
  let rOpen = isMobile ? 124 : 148;

  // Build flubber morph interpolator once per sizing
  let morphInterp = flubberInterpolate(
    makeSeedBlobPath(rSeed),
    makeAperturePath(rOpen, rOpen * 0.96, 3.0),
    { maxSegmentLength: 8 }
  );

  // Create simulation nodes
  const nodes = SPECIMENS.map((spec) => {
    const rad = (spec.angle * Math.PI) / 180;
    return {
      id: spec.id,
      spec,
      x: cx + Math.cos(rad) * orbitRadius,
      y: cy + Math.sin(rad) * orbitRadius,
      r: rSeed,
      morphT: 0,
      expanded: false,
      dragging: false,
      dragMoved: false,
      elG: null,
      pathEl: null,
      ringAccent: null,
      domEl: null,
      seedDom: null,
      liveDom: null,
      liveUpdater: null,
      tween: null,
    };
  });

  // Draw gentle background Nianlun guide rings
  function drawBackground() {
    bgGroup.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const baseR = orbitRadius;
    for (const frac of [0.38, 0.72, 1.0, 1.35]) {
      bgGroup.appendChild(svgEl('circle', {
        cx, cy, r: (baseR * frac).toFixed(1),
        fill: 'none',
        stroke: 'var(--ink)',
        'stroke-opacity': frac === 1.0 ? '0.11' : '0.055',
        'stroke-dasharray': frac === 1.0 ? 'none' : '2 6',
      }));
    }
    // Center pith mark
    bgGroup.appendChild(svgEl('circle', {
      cx, cy, r: 4,
      fill: 'var(--ink)',
      'fill-opacity': '0.22',
    }));
  }

  // Create SVG + HTML live interior for each node
  for (const node of nodes) {
    const g = svgEl('g', { class: 'y-node', 'data-specimen': node.id });
    const pathEl = svgEl('path', {
      d: morphInterp(0),
      fill: 'var(--paper-elev)',
      stroke: node.spec.color,
      'stroke-width': '1.8',
      class: 'y-shell',
    });
    const ringAccent = svgEl('circle', {
      r: (rSeed - 7).toFixed(1),
      fill: 'none',
      stroke: node.spec.color,
      'stroke-opacity': '0.22',
      'stroke-width': '1',
      'stroke-dasharray': '3 4',
    });
    g.appendChild(pathEl);
    g.appendChild(ringAccent);
    nodeGroup.appendChild(g);
    node.elG = g;
    node.pathEl = pathEl;
    node.ringAccent = ringAccent;

    // Co-located DOM interior that rides 1:1 with the morphed SVG shell
    const domEl = document.createElement('div');
    domEl.className = 'y-dom-node';
    domEl.dataset.specimen = node.id;
    domEl.style.setProperty('--spec-color', node.spec.color);

    const seedDom = document.createElement('div');
    seedDom.className = 'y-seed';
    seedDom.innerHTML = `
      <span class="y-glyph">${node.spec.glyph}</span>
      <span class="y-name">${node.spec.name}</span>
      <span class="y-readout"></span>
    `;

    const liveDom = document.createElement('div');
    liveDom.className = 'y-live-wrap';
    liveDom.style.display = 'none';

    domEl.appendChild(seedDom);
    domEl.appendChild(liveDom);
    overlay.appendChild(domEl);

    node.domEl = domEl;
    node.seedDom = seedDom;
    node.liveDom = liveDom;

    // Unified Pointer Interaction: Drag to move/couple OR Tap to yield-grow!
    let pDown = null;
    domEl.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, input, .sl-svg')) return;
      e.stopPropagation();
      pDown = { x: e.clientX, y: e.clientY, nx: node.x, ny: node.y, id: e.pointerId };
      node.dragging = true;
      node.dragMoved = false;
      node.fx = node.x;
      node.fy = node.y;
      domEl.setPointerCapture(e.pointerId);
      sim.alphaTarget(0.32).restart();
    });

    domEl.addEventListener('pointermove', (e) => {
      if (!pDown || !node.dragging) return;
      const dx = e.clientX - pDown.x;
      const dy = e.clientY - pDown.y;
      if (Math.hypot(dx, dy) > 6) node.dragMoved = true;
      node.fx = Math.max(node.r + 12, Math.min(width - node.r - 12, pDown.nx + dx));
      node.fy = Math.max(node.r + 12, Math.min(height - node.r - 12, pDown.ny + dy));
      checkProximityCouplings(node);
    });

    const endPointer = () => {
      if (!pDown) return;
      const wasDrag = node.dragMoved;
      pDown = null;
      node.dragging = false;
      node.fx = null;
      node.fy = null;
      sim.alphaTarget(0);

      if (!wasDrag) {
        toggleNodeExpand(node);
      }
    };
    domEl.addEventListener('pointerup', endPointer);
    domEl.addEventListener('pointercancel', endPointer);
  }

  // Click empty background to fold all expanded nodes back into the Nianlun ring
  svg.addEventListener('pointerdown', (e) => {
    if (e.target === svg || e.target.closest('.yielding-bg')) {
      for (const n of nodes) {
        if (n.expanded) collapseNode(n);
      }
    }
  });

  function toggleNodeExpand(node) {
    if (node.expanded) {
      // Already open: keep open (close via its × button or clicking empty space)
      return;
    }
    expandNode(node);
  }

  function expandNode(node) {
    // On mobile, allow 1 expanded at a time so space stays breathable; on desktop allow up to 2!
    const maxOpen = isMobile ? 1 : 2;
    const currentlyOpen = nodes.filter((n) => n.expanded && n !== node);
    while (currentlyOpen.length >= maxOpen) {
      collapseNode(currentlyOpen.shift());
    }

    node.expanded = true;
    node.domEl.classList.add('is-expanded');
    node.seedDom.style.display = 'none';
    node.liveDom.style.display = 'flex';
    node.liveUpdater = mountInPlaceInstrument(node.liveDom, node.id, {
      compact: isMobile,
      onClose: () => collapseNode(node),
    });

    if (node.tween) node.tween.kill();
    node.tween = gsap.to(node, {
      morphT: 1,
      duration: 0.72,
      ease: 'elastic.out(0.85, 0.58)',
      onUpdate: () => {
        const tClamped = Math.max(0, Math.min(1, node.morphT));
        node.r = rSeed + (rOpen - rSeed) * Math.max(0, node.morphT);
        node.pathEl.setAttribute('d', morphInterp(tClamped));
        updateCollideForce();
      },
    });
    sim.alpha(0.65).restart();
    emitWorldChange(`${node.spec.name} 在原位生长展开`);
  }

  function collapseNode(node) {
    if (!node.expanded) return;
    node.expanded = false;
    node.domEl.classList.remove('is-expanded');
    node.liveDom.style.display = 'none';
    node.liveDom.innerHTML = '';
    node.liveUpdater = null;
    node.seedDom.style.display = 'flex';

    if (node.tween) node.tween.kill();
    node.tween = gsap.to(node, {
      morphT: 0,
      duration: 0.45,
      ease: 'power3.out',
      onUpdate: () => {
        const tClamped = Math.max(0, Math.min(1, node.morphT));
        node.r = rSeed + (rOpen - rSeed) * tClamped;
        node.pathEl.setAttribute('d', morphInterp(tClamped));
        updateCollideForce();
      },
    });
    sim.alpha(0.55).restart();
  }

  // Detect dragging one node near another to forge a live Confluence Coupling!
  function checkProximityCouplings(draggedNode) {
    for (const other of nodes) {
      if (other === draggedNode) continue;
      const dist = Math.hypot(draggedNode.x - other.x, draggedNode.y - other.y);
      const threshold = draggedNode.r + other.r + 36;
      const pair = [draggedNode.id, other.id].sort().join('+');
      const existingIdx = world.couplings.findIndex((c) => c.pair === pair);
      if (dist < threshold && existingIdx === -1) {
        const c = describeCoupling(draggedNode.id, other.id);
        world.couplings.push(c);
        emitWorldChange(`建立共生连结：${c.label}（${c.desc}）`);
        renderConfluenceBadges();
      }
    }
  }

  // Coupling badge DOM elements
  const badgeLayer = document.createElement('div');
  badgeLayer.className = 'yielding-badges';
  overlay.appendChild(badgeLayer);

  function renderConfluenceBadges() {
    badgeLayer.innerHTML = '';
    for (const c of world.couplings) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'confluence-pill';
      btn.dataset.pair = c.pair;
      btn.title = `${c.desc}（点击解除共生）`;
      btn.innerHTML = `<strong>${c.label}</strong> <span>×</span>`;
      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        world.couplings = world.couplings.filter((x) => x.pair !== c.pair);
        renderConfluenceBadges();
        emitWorldChange(`已解除：${c.label}`);
      });
      badgeLayer.appendChild(btn);
    }
  }

  // d3-force Simulation: Organic radial orbit + firm elastic spatial yielding
  const collideForce = forceCollide((d) => d.r + 14).strength(0.95).iterations(4);
  const radialForce = forceRadial(
    (d) => (d.expanded ? orbitRadius * 0.28 : orbitRadius),
    cx,
    cy
  ).strength((d) => (d.expanded ? 0.16 : 0.22));

  const sim = forceSimulation(nodes)
    .force('collide', collideForce)
    .force('radial', radialForce)
    .force('x', forceX((d) => {
      const rad = (d.spec.angle * Math.PI) / 180;
      return d.expanded ? cx : cx + Math.cos(rad) * orbitRadius;
    }).strength((d) => (d.expanded ? 0.05 : 0.08)))
    .force('y', forceY((d) => {
      const rad = (d.spec.angle * Math.PI) / 180;
      return d.expanded ? cy : cy + Math.sin(rad) * orbitRadius;
    }).strength((d) => (d.expanded ? 0.05 : 0.08)))
    .velocityDecay(0.32)
    .alphaDecay(0.018);

  function updateCollideForce() {
    collideForce.radius((d) => d.r + 14);
    sim.force('collide', collideForce);
    radialForce.radius((d) => (d.expanded ? orbitRadius * 0.25 : orbitRadius));
    sim.alpha(Math.max(sim.alpha(), 0.25)).restart();
  }

  // Keep nodes strictly inside viewport bounds
  function clampPositions() {
    for (const n of nodes) {
      const pad = n.r + 14;
      n.x = Math.max(pad, Math.min(width - pad, n.x));
      n.y = Math.max(pad + 6, Math.min(height - pad - 24, n.y));
    }
  }

  // Render Elastic Catenary Tendons for active Couplings
  function renderLinks() {
    linkGroup.innerHTML = '';
    for (const c of world.couplings) {
      const na = nodes.find((x) => x.id === c.a);
      const nb = nodes.find((x) => x.id === c.b);
      if (!na || !nb) continue;
      const mx = (na.x + nb.x) / 2;
      const my = (na.y + nb.y) / 2;
      // Gentle elastic curve pulled slightly toward center
      const qx = mx + (cx - mx) * 0.14;
      const qy = my + (cy - my) * 0.14;
      const d = `M ${na.x.toFixed(1)} ${na.y.toFixed(1)} Q ${qx.toFixed(1)} ${qy.toFixed(1)} ${nb.x.toFixed(1)} ${nb.y.toFixed(1)}`;
      linkGroup.appendChild(svgEl('path', {
        d,
        fill: 'none',
        stroke: na.spec.color,
        'stroke-width': '2.4',
        'stroke-opacity': '0.55',
        'stroke-dasharray': '5 4',
      }));
      const pill = badgeLayer.querySelector(`[data-pair="${c.pair}"]`);
      if (pill) {
        pill.style.transform = `translate(${qx.toFixed(1)}px, ${qy.toFixed(1)}px) translate(-50%, -50%)`;
      }
    }
  }

  // Quick action bar inside stage for effortless Coupling Demo + Reset
  const dock = document.createElement('div');
  dock.className = 'exp-floating-dock';
  dock.innerHTML = `
    <button type="button" class="dock-btn" id="btn-demo-couple">演示双体共生（日照 ⇄ 校景）</button>
    <button type="button" class="dock-btn" id="btn-reset-ring">全部回归年轮</button>
  `;
  container.appendChild(dock);

  dock.querySelector('#btn-demo-couple').addEventListener('click', () => {
    const h = nodes.find((n) => n.id === 'helios');
    const a = nodes.find((n) => n.id === 'atlas');
    const pair = 'atlas+helios';
    if (!world.couplings.some((c) => c.pair === pair)) {
      world.couplings.push(describeCoupling('helios', 'atlas'));
      renderConfluenceBadges();
    }
    if (h && !h.expanded) expandNode(h);
    if (a && !a.expanded && !isMobile) expandNode(a);
    emitWorldChange('已触发双体共生：拖动太阳，校景日影随之旋转');
  });

  dock.querySelector('#btn-reset-ring').addEventListener('click', () => {
    world.couplings = [];
    renderConfluenceBadges();
    for (const n of nodes) collapseNode(n);
    sim.alpha(0.7).restart();
    emitWorldChange('全部节点回归初始年轮');
  });

  // 60fps synchronization frame
  function frame() {
    clampPositions();
    for (const n of nodes) {
      n.elG.setAttribute('transform', `translate(${n.x.toFixed(1)}, ${n.y.toFixed(1)})`);
      n.ringAccent.setAttribute('opacity', (1 - Math.min(1, n.morphT * 1.4)).toFixed(2));
      n.domEl.style.transform = `translate(${n.x.toFixed(1)}px, ${n.y.toFixed(1)}px) translate(-50%, -50%)`;
      n.domEl.style.width = `${Math.round(n.r * 1.88)}px`;
      n.domEl.style.height = `${Math.round(n.r * 1.84)}px`;

      if (n.expanded && n.liveUpdater) {
        n.liveUpdater();
      } else {
        const rd = n.seedDom.querySelector('.y-readout');
        if (rd) rd.textContent = getSpecimenReadout(n.id);
      }
    }
    renderLinks();
  }

  function resize() {
    width = container.clientWidth || 960;
    height = container.clientHeight || 680;
    cx = width / 2;
    cy = height / 2;
    isMobile = width < 680;
    orbitRadius = isMobile ? Math.min(width, height) * 0.28 : Math.min(width, height) * 0.27;
    rSeed = isMobile ? 40 : 50;
    rOpen = isMobile ? 124 : 148;
    morphInterp = flubberInterpolate(
      makeSeedBlobPath(rSeed),
      makeAperturePath(rOpen, rOpen * 0.96, 3.0),
      { maxSegmentLength: 8 }
    );
    drawBackground();
    radialForce.x(cx).y(cy);
    for (const n of nodes) {
      n.r = n.expanded ? rOpen : rSeed;
      n.pathEl.setAttribute('d', morphInterp(n.expanded ? 1 : 0));
    }
    updateCollideForce();
  }

  drawBackground();
  renderConfluenceBadges();
  sim.alpha(0.75).restart();

  return {
    frame,
    resize,
    destroy() {
      sim.stop();
      for (const n of nodes) if (n.tween) n.tween.kill();
    },
  };
}
