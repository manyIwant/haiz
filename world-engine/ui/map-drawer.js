// HAIZ World Engine — Interactive Semantic Watercolor Campus Map
//
// Syncs in real time with the 3D world, NPCs, cat, weather wetness, and unified pathfinder.
// Supports clicking any semantic building/tree/landmark to inspect provenance & stories,
// compute A* routes drawn both in 2D and 3D, or jump directly to the landmark.

export function createMapDrawer({
  rootEl,
  graph,
  world,
  getPlayer,
  getNpcs,
  getCat,
  getRoute,
  onNavigate,
  onTeleport,
  onOpenStation,
  onSelectEra,
  onClose,
}) {
  if (!rootEl) return { open() {}, close() {}, render() {}, isOpen: false };

  const canvas = rootEl.querySelector('#we-map-canvas');
  const ctx = canvas.getContext('2d');
  const dossierEl = rootEl.querySelector('#we-map-dossier');
  const filterBar = rootEl.querySelector('#we-map-places');

  let openState = false;
  let selectedId = 'lanshu';
  let scale = 1.65;
  let panX = 10;
  let panZ = -48;
  let dragging = false;
  let dragStart = null;
  let activeRoute = null;

  // World (x, z) -> canvas (px, py)
  function worldToScreen(wx, wz) {
    const w = canvas.width;
    const h = canvas.height;
    return [w * 0.5 + (wx + panX) * scale, h * 0.5 + (wz + panZ) * scale];
  }

  function screenToWorld(sx, sy) {
    const w = canvas.width;
    const h = canvas.height;
    return [(sx - w * 0.5) / scale - panX, (sy - h * 0.5) / scale - panZ];
  }

  function resize() {
    if (!openState) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(240, Math.round(rect.width * dpr));
    const h = Math.max(240, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function renderDossier(node) {
    if (!dossierEl || !node) return;
    const badgeClass = `we-badge we-badge-${node.evidenceTone || 'approx'}`;
    dossierEl.innerHTML = `
      <div class="we-dossier-head">
        <div>
          <h3>${node.name}</h3>
          <p class="we-dossier-sub">${node.purpose}</p>
        </div>
        <span class="${badgeClass}">${node.evidenceLabel}</span>
      </div>
      <p class="we-dossier-story">${node.story}</p>
      <dl class="we-dossier-meta">
        <div><dt>运行坐标</dt><dd>(${node.position[0].toFixed(1)}, ${node.position[2].toFixed(1)}) m</dd></div>
        <div><dt>Twin 基准</dt><dd>(${node.twin[0].toFixed(1)}, ${node.twin[1].toFixed(1)}) m</dd></div>
        <div><dt>WGS84</dt><dd>${node.wgs84.lat.toFixed(5)}°N, ${node.wgs84.lon.toFixed(5)}°E</dd></div>
        <div><dt>楼层 / 溯源</dt><dd>${node.floors > 0 ? `${node.floors} 层` : '开放空间'} · ${node.eraYear}</dd></div>
      </dl>
      <p class="we-dossier-note">数据说明：${node.evidenceNote}</p>
      <div class="we-dossier-actions">
        <button type="button" class="we-btn we-btn-primary" data-map-act="nav">校道导航前往</button>
        <button type="button" class="we-btn" data-map-act="tp">前往此处</button>
        ${node.scienceStation ? `<button type="button" class="we-btn we-btn-accent" data-map-act="sci">打开科学实验站</button>` : ''}
        ${node.eraPreset && node.eraPreset !== 'live' ? `<button type="button" class="we-btn" data-map-act="era">回到 ${node.eraPreset.slice(0, 4)} 年</button>` : ''}
      </div>
    `;

    dossierEl.querySelector('[data-map-act="nav"]')?.addEventListener('click', () => {
      activeRoute = onNavigate?.(node);
      render();
    });
    dossierEl.querySelector('[data-map-act="tp"]')?.addEventListener('click', () => {
      onTeleport?.(node);
      close();
    });
    dossierEl.querySelector('[data-map-act="sci"]')?.addEventListener('click', () => {
      close();
      onOpenStation?.(node.scienceStation);
    });
    dossierEl.querySelector('[data-map-act="era"]')?.addEventListener('click', () => {
      onSelectEra?.(node.eraPreset);
      close();
    });
  }

  function populatePlaceChips() {
    if (!filterBar) return;
    filterBar.innerHTML = '';
    for (const node of graph.nodes) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'we-chip' + (node.id === selectedId ? ' is-active' : '');
      btn.textContent = node.short;
      btn.dataset.placeId = node.id;
      btn.addEventListener('click', () => {
        selectPlace(node.id, true);
      });
      filterBar.appendChild(btn);
    }
  }

  function selectPlace(id, center = false) {
    const node = graph.get(id);
    if (!node) return;
    selectedId = id;
    if (center) {
      panX = -node.position[0];
      panZ = -node.position[2];
    }
    filterBar?.querySelectorAll('.we-chip').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.placeId === id);
    });
    renderDossier(node);
    render();
  }

  function drawRotatedRect(cx, cz, hw, hd, rot, fill, stroke, lineWidth = 1) {
    const [sx, sy] = worldToScreen(cx, cz);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-rot);
    const rw = hw * 2 * scale;
    const rh = hd * 2 * scale;
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(-rw * 0.5, -rh * 0.5, rw, rh);
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.strokeRect(-rw * 0.5, -rh * 0.5, rw, rh);
    }
    ctx.restore();
  }

  function render() {
    if (!openState) return;
    resize();
    const w = canvas.width;
    const h = canvas.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // 1. Warm watercolor paper base (#f4f1e8)
    ctx.fillStyle = '#f4f1e8';
    ctx.fillRect(0, 0, w, h);

    // 2. Subtle 20m survey coordinate grid
    ctx.strokeStyle = 'rgba(31, 58, 48, 0.08)';
    ctx.lineWidth = 1;
    const step = 20;
    const [wx0, wz0] = screenToWorld(0, 0);
    const [wx1, wz1] = screenToWorld(w, h);
    const gxStart = Math.floor(Math.min(wx0, wx1) / step) * step;
    const gxEnd = Math.ceil(Math.max(wx0, wx1) / step) * step;
    const gzStart = Math.floor(Math.min(wz0, wz1) / step) * step;
    const gzEnd = Math.ceil(Math.max(wz0, wz1) / step) * step;
    ctx.beginPath();
    for (let x = gxStart; x <= gxEnd; x += step) {
      const [sx] = worldToScreen(x, 0);
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
    }
    for (let z = gzStart; z <= gzEnd; z += step) {
      const [, sy] = worldToScreen(0, z);
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
    }
    ctx.stroke();

    // 3. Campus features from geo (gardens, sports, roads, water, buildings)
    const features = world?.geo?.features || [];
    for (const f of features) {
      if (f.kind === 'garden' || f.kind === 'botanic') {
        drawRotatedRect(f.cx, f.cz, f.hw, f.hd, f.rot || 0, 'rgba(126, 152, 118, 0.24)', null);
      } else if (f.kind === 'field' || f.kind === 'court') {
        drawRotatedRect(f.cx, f.cz, f.hw, f.hd, f.rot || 0, 'rgba(178, 126, 98, 0.16)', 'rgba(168, 72, 44, 0.35)', 1);
      }
    }
    for (const f of features) {
      if (f.kind === 'road') {
        drawRotatedRect(f.cx, f.cz, f.hw, f.hd, f.rot || 0, '#faf7f0', 'rgba(31, 58, 48, 0.28)', 1);
      } else if (f.kind === 'water') {
        drawRotatedRect(f.cx, f.cz, f.hw, f.hd, f.rot || 0, 'rgba(108, 152, 158, 0.36)', 'rgba(42, 74, 60, 0.45)', 1.2);
      }
    }
    for (const f of features) {
      if (f.kind === 'building' || f.kind === 'gate' || f.kind === 'corridor' || f.kind === 'pavilion') {
        drawRotatedRect(
          f.cx,
          f.cz,
          f.hw,
          f.hd,
          f.rot || 0,
          'rgba(31, 58, 48, 0.13)',
          'rgba(31, 58, 48, 0.68)',
          1.2 * dpr,
        );
      }
    }

    // 4. Active navigation route (vermilion brush stroke)
    const routePts = activeRoute?.points || getRoute?.();
    if (Array.isArray(routePts) && routePts.length >= 2) {
      ctx.save();
      ctx.strokeStyle = '#a8482c';
      ctx.lineWidth = 3 * dpr;
      ctx.setLineDash([6 * dpr, 4 * dpr]);
      ctx.beginPath();
      routePts.forEach(([rx, rz], i) => {
        const [sx, sy] = worldToScreen(rx, rz);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      ctx.restore();
    }

    // 5. Semantic place pins
    ctx.font = `${11 * dpr}px "Noto Serif SC", "Songti SC", serif`;
    ctx.textAlign = 'center';
    for (const node of graph.nodes) {
      const [sx, sy] = worldToScreen(node.position[0], node.position[2]);
      const isSelected = node.id === selectedId;
      ctx.save();
      if (node.id === 'lanshu') {
        ctx.fillStyle = isSelected ? '#a8482c' : '#2a4a3c';
        ctx.beginPath();
        ctx.arc(sx, sy, (isSelected ? 7.5 : 6) * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f4f1e8';
        ctx.lineWidth = 1.6 * dpr;
        ctx.stroke();
      } else {
        ctx.fillStyle = isSelected ? '#a8482c' : node.scienceStation ? '#8f6a1f' : '#1f3a30';
        ctx.beginPath();
        ctx.arc(sx, sy, (isSelected ? 5.5 : 3.8) * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = isSelected ? '#a8482c' : '#1f3a30';
      ctx.fillText(node.short, sx, sy - 8 * dpr);
      ctx.restore();
    }

    // 6. Live NPCs
    const npcs = getNpcs?.() || [];
    ctx.font = `${10 * dpr}px system-ui, sans-serif`;
    for (const p of npcs) {
      const [sx, sy] = worldToScreen(p.x, p.z);
      ctx.save();
      ctx.fillStyle = p.color || '#2f5a46';
      ctx.beginPath();
      ctx.arc(sx, sy, 3.6 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(p.name, sx, sy + 13 * dpr);
      ctx.restore();
    }

    // 7. Orange campus cat
    const catPos = getCat?.();
    if (catPos) {
      const [sx, sy] = worldToScreen(catPos.x, catPos.z);
      ctx.save();
      ctx.fillStyle = '#c46a2c';
      ctx.beginPath();
      ctx.arc(sx, sy, 4 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText('橘猫', sx, sy + 13 * dpr);
      ctx.restore();
    }

    // 8. Player position + heading cone
    const pl = getPlayer?.();
    if (pl) {
      const [sx, sy] = worldToScreen(pl.x, pl.z);
      ctx.save();
      ctx.translate(sx, sy);
      // Gaze cone
      const dirX = Math.sin(pl.yaw || 0);
      const dirY = Math.cos(pl.yaw || 0);
      const ang = Math.atan2(dirY, dirX);
      ctx.fillStyle = 'rgba(168, 72, 44, 0.22)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 22 * dpr, ang - 0.42, ang + 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#a8482c';
      ctx.beginPath();
      ctx.arc(0, 0, 5.2 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f4f1e8';
      ctx.lineWidth = 1.6 * dpr;
      ctx.stroke();
      ctx.restore();
    }

    // 9. Compass & scale bar in paper ink
    ctx.save();
    ctx.fillStyle = '#1f3a30';
    ctx.font = `${11 * dpr}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('↑ 校园北（319.0° 校准基准）· 原点 (0,0) = 百年榄仁树', 14 * dpr, 22 * dpr);
    const barPx = 50 * scale;
    ctx.strokeStyle = '#1f3a30';
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    ctx.moveTo(14 * dpr, h - 18 * dpr);
    ctx.lineTo(14 * dpr + barPx, h - 18 * dpr);
    ctx.stroke();
    ctx.fillText('50 m', 14 * dpr, h - 24 * dpr);
    ctx.restore();
  }

  // Interactive pan, wheel zoom, and pin selection
  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / Math.max(rect.width, 1);
    const sx = (e.clientX - rect.left) * dpr;
    const sy = (e.clientY - rect.top) * dpr;
    dragStart = { x: e.clientX, y: e.clientY, panX, panZ, sx, sy, moved: false };
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || !dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    if (Math.hypot(dx, dy) > 4) dragStart.moved = true;
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / Math.max(rect.width, 1);
    panX = dragStart.panX + (dx * dpr) / scale;
    panZ = dragStart.panZ + (dy * dpr) / scale;
    render();
  });

  canvas.addEventListener('pointerup', () => {
    if (dragStart && !dragStart.moved) {
      const [wx, wz] = screenToWorld(dragStart.sx, dragStart.sy);
      let best = null;
      let bestD = 22;
      for (const node of graph.nodes) {
        const d = Math.hypot(node.position[0] - wx, node.position[2] - wz);
        if (d < bestD) {
          bestD = d;
          best = node;
        }
      }
      if (best) selectPlace(best.id, false);
    }
    dragging = false;
    dragStart = null;
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.88 : 1.14;
    scale = Math.max(0.55, Math.min(5.5, scale * factor));
    render();
  }, { passive: false });

  rootEl.querySelector('[data-map-close]')?.addEventListener('click', () => close());

  function open(focusPlaceId = null) {
    openState = true;
    rootEl.hidden = false;
    populatePlaceChips();
    const pl = getPlayer?.();
    if (focusPlaceId && graph.get(focusPlaceId)) {
      selectPlace(focusPlaceId, true);
    } else {
      if (pl) {
        panX = -pl.x;
        panZ = -pl.z;
      }
      selectPlace(selectedId, false);
    }
    requestAnimationFrame(() => render());
  }

  function close() {
    if (!openState) return;
    openState = false;
    rootEl.hidden = true;
    onClose?.();
  }

  return {
    open,
    close,
    render,
    selectPlace,
    get isOpen() { return openState; },
  };
}
