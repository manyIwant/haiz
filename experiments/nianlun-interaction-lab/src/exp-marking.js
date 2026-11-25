/**
 * Experiment III: 一笔穿层 · Continuous Marking Gesture & Radial Dissolution
 *
 * Open-source engines reused:
 * - Kando GestureDetector (MIT, Simon Schneegans / github.com/kando-menu/kando)
 * - gsap (GSAP Standard License): Kinetic radial bloom & tether spring
 *
 * Core interaction thesis:
 * Instead of opening menus, switching pages, and dismissing dialogs, the Nianlun
 * spawns RIGHT WHERE YOUR HAND TOUCHES. One uninterrupted stroke (press → glide
 * → sharp turn or pause → release) traverses multiple hierarchy levels in <0.5s,
 * while novices can step through effortlessly by clicking.
 */

import gsap from 'gsap';
import { KandoGestureDetector } from './kando-gesture.js';
import {
  SPECIMENS,
  CAMPUS_LANDMARKS,
  world,
  runSpecimenAction,
  formatHour,
  getCambiumRecord,
  emitWorldChange,
} from './specimens.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

export function mountMarkingExperiment(container) {
  container.innerHTML = '';
  container.className = 'exp-stage exp-marking';

  const svg = svgEl('svg', { class: 'marking-svg', 'aria-label': '一笔穿层连续径向手势实验场' });
  const worldGroup = svgEl('g', { class: 'mk-world' });
  const trailGroup = svgEl('g', { class: 'mk-trails' });
  const menuGroup = svgEl('g', { class: 'mk-menu' });
  svg.appendChild(worldGroup);
  svg.appendChild(trailGroup);
  svg.appendChild(menuGroup);

  const hudBadge = document.createElement('div');
  hudBadge.className = 'mk-live-readout';

  const dock = document.createElement('div');
  dock.className = 'exp-floating-dock';
  dock.innerHTML = `
    <button type="button" class="dock-btn" id="mk-summon">在中心唤出年轮（点击模式）</button>
    <span class="dock-hint">或在画布任意处 <strong>按住拖动 → 拐弯/停顿 → 松手</strong> 完成一笔穿层</span>
  `;

  container.appendChild(svg);
  container.appendChild(hudBadge);
  container.appendChild(dock);

  let width = container.clientWidth || 960;
  let height = container.clientHeight || 680;
  let cx = width / 2;
  let cy = height / 2;
  let isMobile = width < 680;

  // Live unified world sculpture elements (shows all 5 specimens breathing together!)
  let worldRefs = {};
  function buildWorldSculpture() {
    worldGroup.innerHTML = '';
    const R = Math.min(width, height) * (isMobile ? 0.32 : 0.28);
    const g = svgEl('g', { transform: `translate(${cx}, ${cy})` });

    // 1. Cambium rings (outer context)
    const cambiumRing = svgEl('circle', {
      r: R.toFixed(1),
      fill: 'none',
      stroke: '#7B563A',
      'stroke-width': '1.6',
      'stroke-opacity': '0.35',
    });
    const cambiumInner = svgEl('circle', {
      r: (R * 0.65).toFixed(1),
      fill: 'none',
      stroke: '#7B563A',
      'stroke-dasharray': '3 6',
      'stroke-opacity': '0.24',
    });
    g.appendChild(cambiumRing);
    g.appendChild(cambiumInner);

    // 2. Pulse ripple wave
    const pulseWave = svgEl('circle', {
      r: (R * 0.5).toFixed(1),
      fill: 'none',
      stroke: '#C24B36',
      'stroke-width': '2',
      'stroke-opacity': '0.25',
    });
    g.appendChild(pulseWave);

    // 3. Helios solar shadow ray + sun orb
    const shadowRay = svgEl('line', {
      x1: 0, y1: 0,
      stroke: '#C48426',
      'stroke-width': '3',
      'stroke-opacity': '0.25',
      'stroke-linecap': 'round',
    });
    const sunOrb = svgEl('circle', { r: '9', fill: '#C48426' });
    g.appendChild(shadowRay);
    g.appendChild(sunOrb);

    // 4. Atlas active landmark bearing vector
    const atlasRay = svgEl('line', {
      x1: 0, y1: 0,
      stroke: '#4D7349',
      'stroke-width': '1.8',
      'stroke-dasharray': '4 4',
    });
    const atlasDot = svgEl('circle', { r: '5', fill: '#4D7349' });
    g.appendChild(atlasRay);
    g.appendChild(atlasDot);

    // 5. Pendulum live rod & bob anchored at origin
    const pendTrail = svgEl('path', { fill: 'none', stroke: '#3A5A78', 'stroke-opacity': '0.25', 'stroke-width': '1.6' });
    const pendRod = svgEl('line', { x1: 0, y1: 0, stroke: 'var(--ink)', 'stroke-width': '1.6', 'stroke-opacity': '0.7' });
    const pendBob = svgEl('circle', { r: '8', fill: '#3A5A78' });
    g.appendChild(pendTrail);
    g.appendChild(pendRod);
    g.appendChild(pendBob);

    // Origin pith
    g.appendChild(svgEl('circle', { r: '4.5', fill: 'var(--ink)' }));

    worldGroup.appendChild(g);
    worldRefs = { R, cambiumRing, cambiumInner, pulseWave, shadowRay, sunOrb, atlasRay, atlasDot, pendTrail, pendRod, pendBob };
  }

  // ─── Marking Menu Stack (Kando architecture: each level spawns at exact pointer pivot) ───
  const menuState = {
    open: false,
    mode: 'idle', // 'marking' (pointer held) | 'click' (tapped open)
    stack: [],    // [{ cx, cy, items, parentSpecimen, parentAngle, radius, hoveredIdx }]
    pointer: { x: cx, y: cy },
    strokePoints: [],
    fadingTrails: [],
  };

  function getRootItems() {
    return SPECIMENS.map((s) => ({
      id: s.id,
      label: s.name,
      sub: s.glyph,
      color: s.color,
      specimen: s,
      isSubmenu: true,
    }));
  }

  function getChildItems(spec) {
    return spec.children.map((c) => ({
      id: c.id,
      label: c.label,
      sub: spec.glyph,
      color: spec.color,
      specimen: spec,
      action: c.action,
      value: c.value,
      isSubmenu: false,
    }));
  }

  function itemAngle(idx, count, offsetDeg = -90) {
    return offsetDeg + (idx / count) * 360;
  }

  function findClosestIndex(level, px, py) {
    const dx = px - level.cx;
    const dy = py - level.cy;
    const dist = Math.hypot(dx, dy);
    if (dist < 26) return -1; // dead-zone center
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI; // -180..180
    let bestIdx = 0;
    let bestDiff = 999;
    level.items.forEach((_, idx) => {
      const a = itemAngle(idx, level.items.length, level.offsetDeg);
      let diff = ((ang - a + 540) % 360) - 180;
      if (Math.abs(diff) < bestDiff) {
        bestDiff = Math.abs(diff);
        bestIdx = idx;
      }
    });
    return bestIdx;
  }

  function openMenuAt(x, y, mode = 'marking') {
    const pad = isMobile ? 96 : 118;
    const safeX = Math.max(pad, Math.min(width - pad, x));
    const safeY = Math.max(pad, Math.min(height - pad - 44, y));

    menuState.open = true;
    menuState.mode = mode;
    menuState.pointer = { x: safeX, y: safeY };
    menuState.strokePoints = [{ x: safeX, y: safeY }];

    const rootLevel = {
      cx: safeX,
      cy: safeY,
      items: getRootItems(),
      offsetDeg: -90,
      radius: 0,
      targetRadius: isMobile ? 84 : 104,
      hoveredIdx: -1,
      parentSpecimen: null,
    };
    menuState.stack = [rootLevel];
    gsap.to(rootLevel, { radius: rootLevel.targetRadius, duration: 0.34, ease: 'back.out(1.6)' });
    renderMenuSVG();
  }

  function enterSubmenu(pivotX, pivotY, item, triggerKind = 'click') {
    const pad = isMobile ? 88 : 112;
    const sx = Math.max(pad, Math.min(width - pad, pivotX));
    const sy = Math.max(pad, Math.min(height - pad - 44, pivotY));

    const prev = menuState.stack[menuState.stack.length - 1];
    const backAngle = prev ? (Math.atan2(prev.cy - sy, prev.cx - sx) * 180) / Math.PI : 180;

    const childLevel = {
      cx: sx,
      cy: sy,
      items: getChildItems(item.specimen),
      offsetDeg: backAngle + 55,
      radius: 0,
      targetRadius: isMobile ? 80 : 96,
      hoveredIdx: -1,
      parentSpecimen: item.specimen,
    };
    menuState.stack.push(childLevel);
    gsap.to(childLevel, { radius: childLevel.targetRadius, duration: 0.32, ease: 'back.out(1.5)' });
    if (triggerKind !== 'click') {
      emitWorldChange(`一笔穿层 → ${item.specimen.name}（继续划向子项并松手）`);
    }
    renderMenuSVG();
  }

  function closeMenu(recordTrail = true) {
    if (recordTrail && menuState.strokePoints.length > 2) {
      menuState.fadingTrails.push({
        points: [...menuState.strokePoints],
        opacity: 0.85,
      });
    }
    menuState.open = false;
    menuState.mode = 'idle';
    menuState.stack = [];
    menuState.strokePoints = [];
    detector.reset();
    renderMenuSVG();
  }

  // Instantiate Kando's authentic GestureDetector!
  const detector = new KandoGestureDetector({
    minStrokeLength: isMobile ? 68 : 82,
    minStrokeAngle: 24,
    jitterThreshold: 7,
    pauseTimeout: 165,
    onSelection: (pivot, reason) => {
      if (!menuState.open || menuState.mode !== 'marking') return;
      const top = menuState.stack[menuState.stack.length - 1];
      if (!top) return;
      const idx = findClosestIndex(top, pivot.x, pivot.y);
      if (idx < 0) return;
      const item = top.items[idx];
      if (item.isSubmenu && menuState.stack.length < 2) {
        enterSubmenu(pivot.x, pivot.y, item, reason);
      }
    },
  });

  // Pointer events on full open canvas
  let pressInfo = null;
  svg.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.mk-item-hit') || e.target.closest('.mk-back-hit')) return;
    const rect = svg.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // If click-mode menu is open and user taps outside, close it
    if (menuState.open && menuState.mode === 'click') {
      closeMenu(false);
      return;
    }

    pressInfo = { x: px, y: py, moved: false, pointerId: e.pointerId };
    svg.setPointerCapture(e.pointerId);
    openMenuAt(px, py, 'marking');
    detector.reset({ x: px, y: py });
  });

  svg.addEventListener('pointermove', (e) => {
    if (!menuState.open) return;
    const rect = svg.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    menuState.pointer = { x: px, y: py };

    if (menuState.mode === 'marking' && pressInfo) {
      if (Math.hypot(px - pressInfo.x, py - pressInfo.y) > 10) {
        pressInfo.moved = true;
      }
      menuState.strokePoints.push({ x: px, y: py });
      if (menuState.strokePoints.length > 90) menuState.strokePoints.shift();
      detector.onMotionEvent({ x: px, y: py });
    }

    const top = menuState.stack[menuState.stack.length - 1];
    if (top) {
      top.hoveredIdx = findClosestIndex(top, px, py);
    }
  });

  const endStroke = (e) => {
    if (!pressInfo) return;
    const rect = svg.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const wasMoved = pressInfo.moved;
    pressInfo = null;

    if (!menuState.open || menuState.mode !== 'marking') return;

    if (!wasMoved) {
      // Quick tap -> switch gracefully to Novice Click Mode!
      menuState.mode = 'click';
      renderMenuSVG();
      return;
    }

    // Complete marking selection on release!
    const top = menuState.stack[menuState.stack.length - 1];
    if (top) {
      const idx = findClosestIndex(top, px, py);
      if (idx >= 0) {
        const item = top.items[idx];
        if (item.isSubmenu) {
          // Released on a Level-1 specimen without turning -> open its sub-ring in Click Mode!
          menuState.mode = 'click';
          enterSubmenu(px, py, item, 'click');
          return;
        } else if (item.action) {
          runSpecimenAction(item.specimen.id, item.action, item.value);
          closeMenu(true);
          return;
        }
      }
    }
    closeMenu(true);
  };
  svg.addEventListener('pointerup', endStroke);
  svg.addEventListener('pointercancel', () => { pressInfo = null; closeMenu(false); });

  dock.querySelector('#mk-summon').addEventListener('click', (e) => {
    e.stopPropagation();
    if (menuState.open) {
      closeMenu(false);
    } else {
      openMenuAt(cx, cy, 'click');
    }
  });

  // Render active Marking Menu levels & tethers
  function renderMenuSVG() {
    menuGroup.innerHTML = '';
    if (!menuState.open) return;

    // 1. Tethers connecting parent -> child pivots
    for (let i = 0; i < menuState.stack.length - 1; i++) {
      const a = menuState.stack[i];
      const b = menuState.stack[i + 1];
      menuGroup.appendChild(svgEl('line', {
        x1: a.cx.toFixed(1), y1: a.cy.toFixed(1),
        x2: b.cx.toFixed(1), y2: b.cy.toFixed(1),
        stroke: b.parentSpecimen ? b.parentSpecimen.color : 'var(--ink)',
        'stroke-width': '2',
        'stroke-dasharray': '4 3',
      }));
    }

    // 2. Render each level in stack (inactive parent recedes gently, top level is crisp & live)
    menuState.stack.forEach((level, lvlIdx) => {
      const isTop = lvlIdx === menuState.stack.length - 1;
      const g = svgEl('g', { opacity: isTop ? '1' : '0.35' });

      // Guide ring
      g.appendChild(svgEl('circle', {
        cx: level.cx, cy: level.cy,
        r: Math.max(1, level.radius).toFixed(1),
        fill: 'var(--paper)',
        'fill-opacity': isTop ? '0.86' : '0.35',
        stroke: level.parentSpecimen ? level.parentSpecimen.color : 'var(--ink)',
        'stroke-opacity': '0.26',
        'stroke-width': '1.2',
      }));

      // Active pointer direction ray on top level
      if (isTop && level.hoveredIdx >= 0) {
        const aDeg = itemAngle(level.hoveredIdx, level.items.length, level.offsetDeg);
        const rad = (aDeg * Math.PI) / 180;
        const tx = level.cx + Math.cos(rad) * level.radius;
        const ty = level.cy + Math.sin(rad) * level.radius;
        const hovItem = level.items[level.hoveredIdx];
        g.appendChild(svgEl('line', {
          x1: level.cx, y1: level.cy,
          x2: tx.toFixed(1), y2: ty.toFixed(1),
          stroke: hovItem.color,
          'stroke-width': '2.4',
        }));
      }

      // Items around ring
      level.items.forEach((item, idx) => {
        const aDeg = itemAngle(idx, level.items.length, level.offsetDeg);
        const rad = (aDeg * Math.PI) / 180;
        const ix = level.cx + Math.cos(rad) * level.radius;
        const iy = level.cy + Math.sin(rad) * level.radius;
        const isHov = isTop && level.hoveredIdx === idx;

        const ig = svgEl('g', {
          class: 'mk-item-hit',
          transform: `translate(${ix.toFixed(1)}, ${iy.toFixed(1)})`,
          style: isTop ? 'cursor:pointer' : 'pointer-events:none',
        });

        ig.appendChild(svgEl('circle', {
          r: isHov ? '30' : '24',
          fill: isHov ? item.color : 'var(--paper-elev)',
          stroke: item.color,
          'stroke-width': isHov ? '2.4' : '1.5',
        }));

        const lbl = svgEl('text', {
          'text-anchor': 'middle',
          y: '4',
          'font-size': item.label.length > 5 ? '10' : '11.5',
          'font-weight': '600',
          fill: isHov ? '#fff' : 'var(--ink)',
          'pointer-events': 'none',
        });
        lbl.textContent = item.label.length > 6 ? item.label.slice(0, 6) : item.label;
        ig.appendChild(lbl);

        if (isTop) {
          ig.addEventListener('pointerdown', (e) => e.stopPropagation());
          ig.addEventListener('click', (e) => {
            e.stopPropagation();
            if (item.isSubmenu) {
              enterSubmenu(ix, iy, item, 'click');
            } else {
              runSpecimenAction(item.specimen.id, item.action, item.value);
              closeMenu(false);
            }
          });
        }
        g.appendChild(ig);
      });

      // Center pivot (click to step back or close)
      const cg = svgEl('g', {
        class: 'mk-back-hit',
        transform: `translate(${level.cx}, ${level.cy})`,
        style: 'cursor:pointer',
      });
      cg.appendChild(svgEl('circle', {
        r: '18',
        fill: 'var(--paper-elev)',
        stroke: level.parentSpecimen ? level.parentSpecimen.color : 'var(--ink)',
        'stroke-width': '1.4',
      }));
      const ct = svgEl('text', { 'text-anchor': 'middle', y: '4', 'font-size': '10.5', fill: 'var(--ink)' });
      ct.textContent = lvlIdx === 0 ? '×' : '↩';
      cg.appendChild(ct);
      cg.addEventListener('pointerdown', (e) => e.stopPropagation());
      cg.addEventListener('click', (e) => {
        e.stopPropagation();
        if (lvlIdx === 0) closeMenu(false);
        else {
          menuState.stack.pop();
          renderMenuSVG();
        }
      });
      g.appendChild(cg);

      menuGroup.appendChild(g);
    });
  }

  function frame() {
    // 1. Update live unified world sculpture
    const { R, cambiumRing, pulseWave, shadowRay, sunOrb, atlasRay, atlasDot, pendTrail, pendRod, pendBob } = worldRefs;
    if (R) {
      // Pulse wave
      pulseWave.setAttribute('r', (R * 0.42 + world.pulse.pulseFlash * 28).toFixed(1));
      pulseWave.setAttribute('stroke-opacity', (0.15 + world.pulse.pulseFlash * 0.65).toFixed(2));

      // Helios sun & shadow
      const azRad = ((world.helios.azimuth - 90) * Math.PI) / 180;
      const sunR = R * 0.88;
      sunOrb.setAttribute('cx', (Math.cos(azRad) * sunR).toFixed(1));
      sunOrb.setAttribute('cy', (Math.sin(azRad) * sunR).toFixed(1));
      const shLen = world.helios.altitude > 2 ? Math.min(R * 0.8, R * 0.55) : 0;
      shadowRay.setAttribute('x2', (-Math.cos(azRad) * shLen).toFixed(1));
      shadowRay.setAttribute('y2', (-Math.sin(azRad) * shLen).toFixed(1));

      // Atlas bearing
      const lm = CAMPUS_LANDMARKS.find((l) => l.id === world.atlas.activeLandmarkId) || CAMPUS_LANDMARKS[1];
      const bRad = ((lm.bearing - 90) * Math.PI) / 180;
      const bDist = (lm.dist / 185) * R * 0.92;
      atlasRay.setAttribute('x2', (Math.cos(bRad) * bDist).toFixed(1));
      atlasRay.setAttribute('y2', (Math.sin(bRad) * bDist).toFixed(1));
      atlasDot.setAttribute('cx', (Math.cos(bRad) * bDist).toFixed(1));
      atlasDot.setAttribute('cy', (Math.sin(bRad) * bDist).toFixed(1));

      // Pendulum
      const pLen = R * (0.42 + world.pendulum.length * 0.25);
      pendRod.setAttribute('x2', (Math.sin(world.pendulum.theta) * pLen).toFixed(1));
      pendRod.setAttribute('y2', (Math.cos(world.pendulum.theta) * pLen).toFixed(1));
      pendBob.setAttribute('cx', (Math.sin(world.pendulum.theta) * pLen).toFixed(1));
      pendBob.setAttribute('cy', (Math.cos(world.pendulum.theta) * pLen).toFixed(1));
      if (world.pendulum.trail.length > 2) {
        pendTrail.setAttribute('d', world.pendulum.trail.map((pt, i) =>
          `${i === 0 ? 'M' : 'L'} ${(Math.sin(pt.t) * pLen).toFixed(1)} ${(Math.cos(pt.t) * pLen).toFixed(1)}`
        ).join(' '));
      }

      // Cambium ring thickness
      const rec = getCambiumRecord(world.cambium.year);
      cambiumRing.setAttribute('stroke-width', ((rec.rain - 1100) / 360).toFixed(1));
    }

    // 2. Render live & fading calligraphic stroke trails
    trailGroup.innerHTML = '';
    if (menuState.open && menuState.strokePoints.length > 1) {
      const d = menuState.strokePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      trailGroup.appendChild(svgEl('path', {
        d, fill: 'none', stroke: 'var(--ink)', 'stroke-width': '2.2', 'stroke-opacity': '0.55', 'stroke-linecap': 'round',
      }));
    }
    for (let i = menuState.fadingTrails.length - 1; i >= 0; i--) {
      const ft = menuState.fadingTrails[i];
      ft.opacity -= 0.018;
      if (ft.opacity <= 0) {
        menuState.fadingTrails.splice(i, 1);
        continue;
      }
      const d = ft.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      trailGroup.appendChild(svgEl('path', {
        d, fill: 'none', stroke: '#C24B36', 'stroke-width': '2.4', 'stroke-opacity': ft.opacity.toFixed(2), 'stroke-linecap': 'round',
      }));
    }

    // Keep menu SVG synced during GSAP bloom & hover
    if (menuState.open) renderMenuSVG();

    // Update whisper telemetry strip
    const lm = CAMPUS_LANDMARKS.find((l) => l.id === world.atlas.activeLandmarkId) || CAMPUS_LANDMARKS[1];
    hudBadge.innerHTML = `
      <span><b>节律</b> ${world.pulse.bpm} BPM</span>
      <span><b>日照</b> ${formatHour(world.helios.hour)}</span>
      <span><b>单摆</b> ${(world.pendulum.theta * 57.3).toFixed(0)}°</span>
      <span><b>校景</b> ${lm.name}</span>
      <span><b>年轮</b> ${world.cambium.year}</span>
    `;
  }

  function resize() {
    width = container.clientWidth || 960;
    height = container.clientHeight || 680;
    cx = width / 2;
    cy = height / 2;
    isMobile = width < 680;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    buildWorldSculpture();
  }

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  buildWorldSculpture();

  return {
    frame,
    resize,
    destroy() {
      detector.reset();
    },
  };
}
