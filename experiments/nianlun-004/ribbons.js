// NIANLUN 004 · Multi-material peeled time ribbons, synchronized fisheye,
// cross-ribbon drag-and-drop targets, silk association threads, absence veil,
// and Day-view hourly bell horizon ribbon.
//
// Craft materials (harmonizing with paper #efe8da and WebGL wood):
//   schedule  Carved Bamboo Slats (竹简) — rhythmic periods & mineral-pigment subject weave
//   homework  Embossed Cotton Paper (纸签) — protruding task slips, urgent cinnabar edge, draggable!
//   personal  Indigo-Washed Linen (靛布) — glowing pale-paper free slots & vermilion conflict ripples
//   exam      Xuan Paper + Vermilion Seals (朱印) — carved seals & continuous ink-wash score ridge
//   campus    Botanical Rubbing Strip (拓叶) — teal campus notices & private amber growth leaf marks

import { BELL_SCHEDULES, subjectByName, TODAY_ISO } from './content.js';
import {
  doyOfIso, isoOfYearDoy, parseIso, itemsForDate, freeSlotsForDate,
  detectConflictsForDate, examTrendSeries, fmtMin
} from './analytics.js';
import { clamp, lerp } from './physics.js';

export const LAYER_META = [
  { id: 'schedule', short: '竹', label: '课表作息', material: '竹简', accent: '#566d4e', bg: '#dde2ce' },
  { id: 'homework', short: '纸', label: '作业待办', material: '棉纸', accent: '#9a5a34', bg: '#f8f4ea' },
  { id: 'personal', short: '靛', label: '个人日程', material: '靛布', accent: '#2f5570', bg: '#e5ebf0' },
  { id: 'exam',     short: '朱', label: '考试成绩', material: '朱印', accent: '#a83628', bg: '#f6eee0' },
  { id: 'campus',   short: '叶', label: '校园成长', material: '拓叶', accent: '#486b54', bg: '#eae6da' }
];

const SERIF = '"Songti SC", "STSong", "Noto Serif SC", "Source Han Serif SC", serif';
const SANS  = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", sans-serif';
const WEEK  = ['日', '一', '二', '三', '四', '五', '六'];

// Interactive hit regions rebuilt each frame for crisp pointer/touch/drag hit-testing
export const hitRegions = [];

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rr);
}

/**
 * Compute screen-space strip geometry for each peeled secondary ribbon.
 * Desktop: horizontal ribbons stacked cleanly below the wooden ribbon.
 * Portrait mobile: parallel vertical scrolls peeling rightward beside the slim left wooden ribbon.
 */
export function computeLaneRects({ portrait, W, H, railX, railY, railLen, halfBase, activeLayers, peelSprings }) {
  const lanes = [];
  const active = LAYER_META.filter((m) => activeLayers.includes(m.id));
  const count = active.length;
  if (!count) return lanes;

  if (!portrait) {
    const topStart = railY + halfBase + 34;
    const availH = Math.max(220, H - topStart - 46);
    const gap = count >= 4 ? 12 : 16;
    const laneH = clamp(Math.floor((availH - gap * (count - 1)) / count), 56, 90);
    active.forEach((meta, idx) => {
      const p = clamp(peelSprings[meta.id]?.x ?? 1, 0, 1);
      const targetY = topStart + idx * (laneH + gap);
      const y = lerp(railY - laneH / 2, targetY, p);
      lanes.push({
        ...meta,
        idx, p, portrait: false,
        x: railX, y, w: railLen, h: laneH,
        labelX: railX - 14, labelY: y + laneH / 2
      });
    });
  } else {
    const leftStart = railX + halfBase + 16;
    const rightPad = 14;
    const gap = count >= 4 ? 6 : 8;
    const availW = Math.max(150, W - leftStart - rightPad);
    const laneW = Math.max(54, Math.floor((availW - gap * (count - 1)) / count));
    active.forEach((meta, idx) => {
      const p = clamp(peelSprings[meta.id]?.x ?? 1, 0, 1);
      const targetX = leftStart + idx * (laneW + gap);
      const x = lerp(railX - laneW / 2, targetX, p);
      lanes.push({
        ...meta,
        idx, p, portrait: true,
        x, y: railY, w: laneW, h: railLen,
        labelX: x + laneW / 2, labelY: railY - 14
      });
    });
  }
  return lanes;
}

/** Paint all peeled secondary ribbons + cross-ribbon threads + drag ghost + absence veil. */
export function paintRibbons(ctx, cfg) {
  const {
    W, H, dpr, portrait, level, phase, year, yearLen,
    railX, railY, railLen, halfBase, winA, winB,
    activeLayers, peelSprings, state, scaleMode,
    xOfDay, focusDay, hoverLink, dragState, absenceRange, time,
    subjectFilter, daySel, dayHorizonMode, dayMinutes
  } = cfg;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  hitRegions.length = 0;

  if (level === 'day' && dayHorizonMode === 'hour') {
    paintDayHourRibbon(ctx, { W, H, portrait, year, daySel, state, dayMinutes, time });
    return [];
  }

  if (level !== 'ribbon' || phase !== 'laid') return [];

  // Draw coiled scroll caps at zoomed window edges on the wood ribbon
  paintScrollCaps(ctx, { portrait, railX, railY, railLen, halfBase, winA, winB, yearLen });

  const lanes = computeLaneRects({ portrait, W, H, railX, railY, railLen, halfBase, activeLayers, peelSprings });
  if (!lanes.length) {
    if (absenceRange) paintAbsenceVeil(ctx, { portrait, railX, railY, railLen, halfBase, lanes: [], xOfDay, year, absenceRange });
    return lanes;
  }

  const visibleDays = Math.max(1, winB - winA);
  const dStart = Math.max(0, Math.floor(winA + 0.08));
  const dEnd = Math.min(yearLen - 1, Math.max(dStart, Math.ceil(winB - 0.08) - 1));
  const linkAnchors = new Map(); // id -> { x, y }

  // Paint each peeled material strip
  for (const lane of lanes) {
    if (lane.p <= 0.02) continue;
    ctx.save();
    ctx.globalAlpha = lane.p;
    paintLaneMaterial(ctx, lane, { year, yearLen, dStart, dEnd, xOfDay, visibleDays });
    paintLaneLabel(ctx, lane);

    ctx.save();
    roundRectPath(ctx, lane.x, lane.y, lane.w, lane.h, 5);
    ctx.clip();
    if (lane.id === 'schedule') {
      paintScheduleLane(ctx, lane, { year, dStart, dEnd, visibleDays, xOfDay, state, subjectFilter, hoverLink, linkAnchors });
    } else if (lane.id === 'homework') {
      paintHomeworkLane(ctx, lane, { year, dStart, dEnd, visibleDays, xOfDay, state, subjectFilter, hoverLink, dragState, linkAnchors });
    } else if (lane.id === 'personal') {
      paintPersonalLane(ctx, lane, { year, dStart, dEnd, visibleDays, xOfDay, state, dragState, time, linkAnchors });
    } else if (lane.id === 'exam') {
      paintExamLane(ctx, lane, { year, dStart, dEnd, visibleDays, xOfDay, state, hoverLink, linkAnchors });
    } else if (lane.id === 'campus') {
      paintCampusLane(ctx, lane, { year, dStart, dEnd, visibleDays, xOfDay, state, linkAnchors });
    }
    ctx.restore();
    ctx.restore();
  }

  // Synchronized time hairline spanning wood + all peeled ribbons
  if (focusDay >= dStart && focusDay <= dEnd) {
    const pos = xOfDay(focusDay + 0.5);
    const last = lanes[lanes.length - 1];
    ctx.save();
    ctx.strokeStyle = 'rgba(130, 74, 42, 0.42)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    if (!portrait) {
      ctx.moveTo(railX + pos, railY - halfBase - 4);
      ctx.lineTo(railX + pos, last.y + last.h + 4);
    } else {
      ctx.moveTo(railX - halfBase - 4, railY + pos);
      ctx.lineTo(last.x + last.w + 4, railY + pos);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Draw silk association threads connecting linked items across ribbons!
  paintAssociationThreads(ctx, { state, linkAnchors, hoverLink });

  // Absence selection veil spanning wood + all peeled ribbons
  if (absenceRange) {
    paintAbsenceVeil(ctx, { portrait, railX, railY, railLen, halfBase, lanes, xOfDay, year, absenceRange });
  }

  // Active homework-to-personal drag ghost & magnetic silk tether
  if (dragState?.active) {
    paintDragGhost(ctx, dragState);
  }

  return lanes;
}

function paintScrollCaps(ctx, { portrait, railX, railY, railLen, halfBase, winA, winB, yearLen }) {
  const hasLeft = winA > 0.5;
  const hasRight = winB < yearLen - 0.5;
  if (!hasLeft && !hasRight) return;
  ctx.save();
  const drawCap = (isStart) => {
    ctx.fillStyle = 'rgba(90, 58, 34, 0.28)';
    ctx.strokeStyle = 'rgba(72, 44, 24, 0.55)';
    ctx.lineWidth = 1;
    if (!portrait) {
      const cx = isStart ? railX - 5 : railX + railLen + 5;
      roundRectPath(ctx, cx - 4, railY - halfBase - 3, 8, (halfBase + 3) * 2, 4);
      ctx.fill(); ctx.stroke();
    } else {
      const cy = isStart ? railY - 5 : railY + railLen + 5;
      roundRectPath(ctx, railX - halfBase - 3, cy - 4, (halfBase + 3) * 2, 8, 4);
      ctx.fill(); ctx.stroke();
    }
  };
  if (hasLeft) drawCap(true);
  if (hasRight) drawCap(false);
  ctx.restore();
}

function paintLaneMaterial(ctx, lane, { year, dStart, dEnd, xOfDay, visibleDays }) {
  const { x, y, w, h, id, portrait } = lane;
  ctx.save();

  // Soft cast paper shadow
  ctx.shadowColor = 'rgba(52, 36, 20, 0.16)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetX = portrait ? 2 : 0;
  ctx.shadowOffsetY = portrait ? 3 : 5;

  // Base gradient giving rounded physical strip feel
  const grad = portrait
    ? ctx.createLinearGradient(x, y, x + w, y)
    : ctx.createLinearGradient(x, y, x, y + h);

  if (id === 'schedule') {
    grad.addColorStop(0, '#cfd8be');
    grad.addColorStop(0.45, '#e5ead8');
    grad.addColorStop(1, '#c5cfb3');
  } else if (id === 'homework') {
    grad.addColorStop(0, '#f3eee2');
    grad.addColorStop(0.5, '#fcfaf3');
    grad.addColorStop(1, '#ece5d6');
  } else if (id === 'personal') {
    grad.addColorStop(0, '#d8e2eb');
    grad.addColorStop(0.5, '#eaf0f5');
    grad.addColorStop(1, '#cedae5');
  } else if (id === 'exam') {
    grad.addColorStop(0, '#efe5d3');
    grad.addColorStop(0.5, '#faf4e8');
    grad.addColorStop(1, '#e8dcc6');
  } else {
    grad.addColorStop(0, '#dfe3d5');
    grad.addColorStop(0.5, '#f0efe6');
    grad.addColorStop(1, '#d7dccb');
  }

  roundRectPath(ctx, x, y, w, h, 5);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Crisp subtle edge & tactile surface grain
  ctx.save();
  roundRectPath(ctx, x, y, w, h, 5);
  ctx.clip();

  if (id === 'schedule') {
    // Bamboo longitudinal fiber lines
    ctx.strokeStyle = 'rgba(82, 102, 70, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 6; i < (portrait ? w : h); i += 6) {
      ctx.beginPath();
      if (!portrait) { ctx.moveTo(x, y + i); ctx.lineTo(x + w, y + i); }
      else { ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + h); }
      ctx.stroke();
    }
  } else if (id === 'homework') {
    // Laid cotton-paper faint rule lines
    ctx.strokeStyle = 'rgba(130, 108, 82, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 10; i < (portrait ? w : h); i += 10) {
      ctx.beginPath();
      if (!portrait) { ctx.moveTo(x, y + i); ctx.lineTo(x + w, y + i); }
      else { ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + h); }
      ctx.stroke();
    }
  } else if (id === 'personal') {
    // Indigo linen subtle cross-weave
    ctx.strokeStyle = 'rgba(47, 85, 112, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 8; i < (portrait ? h : w); i += 14) {
      ctx.beginPath();
      if (!portrait) { ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + h); }
      else { ctx.moveTo(x, y + i); ctx.lineTo(x + w, y + i); }
      ctx.stroke();
    }
  }

  // Day / Week boundary ticks synchronized with wood ribbon
  const step = visibleDays > 90 ? 7 : 1;
  for (let d = dStart; d <= dEnd; d += step) {
    const p0 = xOfDay(d);
    const iso = isoOfYearDoy(year, d);
    const p = parseIso(iso);
    const isToday = iso === TODAY_ISO;
    const isMon = p?.weekday === 1;
    const isFirst = p?.d === 1;

    if (isToday) {
      const p1 = xOfDay(d + 1);
      ctx.fillStyle = 'rgba(196, 98, 52, 0.08)';
      if (!portrait) ctx.fillRect(x + p0, y, Math.max(2, p1 - p0), h);
      else ctx.fillRect(x, y + p0, w, Math.max(2, p1 - p0));
    }

    if (step === 1 || isFirst || isMon) {
      ctx.strokeStyle = isFirst
        ? 'rgba(72, 52, 34, 0.30)'
        : isMon
          ? 'rgba(72, 52, 34, 0.16)'
          : 'rgba(72, 52, 34, 0.08)';
      ctx.lineWidth = isFirst ? 1.2 : 0.8;
      ctx.beginPath();
      if (!portrait) { ctx.moveTo(x + p0, y); ctx.lineTo(x + p0, y + h); }
      else { ctx.moveTo(x, y + p0); ctx.lineTo(x + w, y + p0); }
      ctx.stroke();
    }

    // Crisp date captions inside Week/Month scale on first peeled lane
    if (lane.idx === 0 && visibleDays <= 35 && step === 1) {
      const p1 = xOfDay(d + 1);
      const cell = p1 - p0;
      if (cell > (portrait ? 26 : 28)) {
        ctx.fillStyle = isToday ? '#a83628' : 'rgba(65, 52, 38, 0.62)';
        ctx.font = `500 10px ${SANS}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const txt = visibleDays <= 10 ? `${p.m}/${p.d} 周${WEEK[p.wd0]}` : `${p.d}`;
        if (!portrait) ctx.fillText(txt, x + p0 + 4, y + 3);
        else ctx.fillText(txt, x + 4, y + p0 + 3);
      }
    }
  }
  ctx.restore();

  // Outer fine hairline border
  roundRectPath(ctx, x, y, w, h, 5);
  ctx.strokeStyle = 'rgba(78, 60, 42, 0.20)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function paintLaneLabel(ctx, lane) {
  ctx.save();
  const { portrait, labelX, labelY, short, label, accent, id } = lane;
  if (!portrait) {
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent;
    ctx.font = `600 13px ${SERIF}`;
    ctx.fillText(`${short} · ${label}`, labelX - 2, labelY - 7);
    ctx.fillStyle = 'rgba(105, 92, 76, 0.78)';
    ctx.font = `10px ${SANS}`;
    ctx.fillText(id === 'exam' ? '点印抽出' : '+ 新增', labelX - 2, labelY + 9);
    hitRegions.push({
      kind: 'lane-add', layer: id,
      x: labelX - 88, y: labelY - 22, w: 90, h: 44
    });
  } else {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = accent;
    ctx.font = `600 11px ${SERIF}`;
    ctx.fillText(`${short}·${label.slice(0, 2)}`, labelX, labelY);
    hitRegions.push({
      kind: 'lane-add', layer: id,
      x: lane.x, y: labelY - 20, w: lane.w, h: 22
    });
  }
  ctx.restore();
}

function paintScheduleLane(ctx, lane, { year, dStart, dEnd, visibleDays, xOfDay, state, subjectFilter, hoverLink, linkAnchors }) {
  const { x, y, w, h, portrait } = lane;
  const courses = state.courses || [];
  const showDetail = visibleDays <= 14;
  const showCompact = visibleDays <= 45;

  for (let d = dStart; d <= dEnd; d++) {
    const iso = isoOfYearDoy(year, d);
    const p = parseIso(iso);
    if (!p) continue;
    const dayCourses = courses
      .filter((c) => c.weekday === p.weekday && (!subjectFilter || c.subject === subjectFilter))
      .sort((a, b) => a.startMinute - b.startMinute);
    if (!dayCourses.length) continue;

    const p0 = xOfDay(d), p1 = xOfDay(d + 1);
    const span = Math.max(2, p1 - p0);

    if (showDetail) {
      // Week view: render individual mineral-pigment bamboo tiles for each class!
      const n = dayCourses.length;
      const topPad = lane.idx === 0 ? 15 : 5;
      const pad = 3;
      if (!portrait) {
        const innerW = Math.max(8, span - pad * 2);
        const cols = span > 132 ? 3 : span > 76 ? 2 : 1;
        const rows = Math.ceil(n / cols);
        const cellW = (innerW - (cols - 1) * 3) / cols;
        const cellH = Math.max(10, (h - topPad - 5 - (rows - 1) * 2) / rows);
        dayCourses.forEach((c, idx) => {
          const col = idx % cols, row = Math.floor(idx / cols);
          const bx = x + p0 + pad + col * (cellW + 3);
          const by = y + topPad + row * (cellH + 2);
          const sub = subjectByName(c.subject);
          const isHl = hoverLink?.courseId === c.id || hoverLink?.subject === c.subject;
          roundRectPath(ctx, bx, by, cellW, cellH, 3);
          ctx.fillStyle = isHl ? sub.color : sub.soft;
          ctx.fill();
          ctx.strokeStyle = sub.color;
          ctx.lineWidth = isHl ? 1.4 : 0.7;
          ctx.stroke();
          if (cellH >= 9 && cellW >= 18) {
            ctx.fillStyle = isHl ? '#fffaf0' : '#2b241c';
            ctx.font = `500 ${cellH >= 14 ? 10 : 9}px ${SANS}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const txt = cellW > 46 ? `${sub.short} ${fmtMin(c.startMinute)}` : sub.short;
            ctx.fillText(txt, bx + 3, by + cellH / 2 + 0.5);
          }
          linkAnchors.set(`course:${c.id}:${iso}`, { x: bx + cellW / 2, y: by + cellH });
          hitRegions.push({ kind: 'course', item: c, dateIso: iso, x: bx, y: by, w: cellW, h: cellH });
        });
      } else {
        // Portrait Week: compact subject pill sequence inside the day's vertical cell
        const innerH = Math.max(10, span - 16);
        const tileH = Math.max(11, Math.min(18, innerH / Math.min(n, 4)));
        const maxShow = Math.max(1, Math.floor(innerH / (tileH + 2)));
        dayCourses.slice(0, maxShow).forEach((c, idx) => {
          const bx = x + 4, by = y + p0 + 14 + idx * (tileH + 2);
          const bw = w - 8;
          const sub = subjectByName(c.subject);
          roundRectPath(ctx, bx, by, bw, tileH, 3);
          ctx.fillStyle = sub.soft;
          ctx.fill();
          ctx.strokeStyle = sub.color;
          ctx.lineWidth = 0.7;
          ctx.stroke();
          ctx.fillStyle = '#2b241c';
          ctx.font = `500 9px ${SANS}`;
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(`${sub.short} ${fmtMin(c.startMinute)}`, bx + 3, by + tileH / 2);
          hitRegions.push({ kind: 'course', item: c, dateIso: iso, x: bx, y: by, w: bw, h: tileH });
        });
      }
    } else if (showCompact) {
      // Month view: stacked colored bamboo-slat bars per day
      const n = dayCourses.length;
      const topPad = lane.idx === 0 ? 15 : 5;
      dayCourses.forEach((c, idx) => {
        const sub = subjectByName(c.subject);
        ctx.fillStyle = sub.color;
        ctx.globalAlpha = 0.75;
        if (!portrait) {
          const bh = (h - topPad - 5) / n;
          ctx.fillRect(x + p0 + 1.5, y + topPad + idx * bh, Math.max(2, span - 3), Math.max(1.5, bh - 1));
        } else {
          const bw = (w - 8) / n;
          ctx.fillRect(x + 4 + idx * bw, y + p0 + 2, Math.max(2, bw - 1), Math.max(2, span - 4));
        }
      });
      ctx.globalAlpha = 1;
      hitRegions.push({
        kind: 'day-layer', layer: 'schedule', dateIso: iso,
        x: portrait ? x : x + p0, y: portrait ? y + p0 : y,
        w: portrait ? w : span, h: portrait ? span : h
      });
    } else {
      // Term / Year view: subtle bamboo rhythmic weave on school weekdays
      if (p.weekday <= 5) {
        ctx.fillStyle = 'rgba(86, 109, 78, 0.24)';
        if (!portrait) ctx.fillRect(x + p0, y + 8, Math.max(1.2, span - 0.5), h - 16);
        else ctx.fillRect(x + 6, y + p0, w - 12, Math.max(1.2, span - 0.5));
      }
    }
  }
}

function paintHomeworkLane(ctx, lane, { year, dStart, dEnd, visibleDays, xOfDay, state, subjectFilter, hoverLink, dragState, linkAnchors }) {
  const { x, y, w, h, portrait } = lane;
  const tasks = (state.tasks || []).filter((t) => {
    const p = parseIso(t.dueIso);
    if (!p || p.y !== year) return false;
    if (subjectFilter && t.subject !== subjectFilter) return false;
    const d = doyOfIso(t.dueIso);
    return d >= dStart && d <= dEnd;
  });

  // Group by dueIso so multiple tasks on one day stack cleanly
  const byDay = new Map();
  for (const t of tasks) {
    const arr = byDay.get(t.dueIso) || [];
    arr.push(t);
    byDay.set(t.dueIso, arr);
  }

  for (const [iso, list] of byDay.entries()) {
    const d = doyOfIso(iso);
    const p0 = xOfDay(d), p1 = xOfDay(d + 1);
    const span = Math.max(6, p1 - p0);
    const isUrgent = !list.every((t) => t.completed) && iso <= TODAY_ISO;

    list.forEach((task, idx) => {
      const sub = subjectByName(task.subject);
      const isDraggingThis = dragState?.active && dragState.task?.id === task.id;
      const isHl = hoverLink?.taskId === task.id || (hoverLink?.courseId && task.linkedCourseId === hoverLink.courseId) || hoverLink?.subject === task.subject;
      const slotCount = Math.max(1, list.length);
      let bx, by, bw, bh;

      if (!portrait) {
        const minW = visibleDays <= 10 ? Math.max(54, span - 8) : Math.max(20, Math.min(86, span + 18));
        bw = Math.min(w - 8, minW);
        bh = clamp((h - 10) / slotCount - 2, 16, 26);
        bx = clamp(x + (p0 + p1) / 2 - bw / 2, x + 4, x + w - bw - 4);
        by = y + 5 + idx * (bh + 3);
      } else {
        bw = w - 8;
        bh = clamp(Math.max(22, (span - 8) / slotCount), 20, 36);
        bx = x + 4;
        by = clamp(y + p0 + 4 + idx * (bh + 2), y + 4, y + h - bh - 4);
      }

      ctx.save();
      if (isDraggingThis) ctx.globalAlpha = 0.35;
      // Embossed paper slip
      ctx.shadowColor = 'rgba(72, 48, 24, 0.14)';
      ctx.shadowBlur = isHl ? 8 : 4;
      ctx.shadowOffsetY = 2;
      roundRectPath(ctx, bx, by, bw, bh, 4);
      ctx.fillStyle = task.completed ? 'rgba(232, 226, 214, 0.82)' : '#fffdf8';
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // Left pigment / cinnabar urgency fold edge
      ctx.fillStyle = task.completed ? '#989083' : (isUrgent || task.priority === 'high' ? '#b33f2b' : sub.color);
      ctx.fillRect(bx, by + 2, 3.5, bh - 4);

      ctx.strokeStyle = isHl ? '#9a4a2a' : 'rgba(110, 90, 66, 0.28)';
      ctx.lineWidth = isHl ? 1.4 : 0.8;
      roundRectPath(ctx, bx, by, bw, bh, 4);
      ctx.stroke();

      // Label text inside slip
      ctx.fillStyle = task.completed ? 'rgba(105, 95, 82, 0.65)' : '#2b241c';
      ctx.font = `${task.completed ? '400' : '500'} ${bw > 70 ? 11 : 10}px ${SANS}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const prefix = task.completed ? '✓ ' : (task.scheduledBlockId ? '● ' : '');
      const labelTxt = bw > 76 ? `${prefix}${sub.short}·${task.title}` : `${prefix}${sub.short}`;
      const maxChars = Math.max(2, Math.floor((bw - 12) / 10.5));
      const trimmed = labelTxt.length > maxChars ? labelTxt.slice(0, maxChars - 1) + '…' : labelTxt;
      ctx.fillText(trimmed, bx + 7, by + bh / 2 + 0.5);
      if (task.completed) {
        const tw = Math.min(bw - 14, ctx.measureText(trimmed).width);
        ctx.strokeStyle = 'rgba(105, 95, 82, 0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx + 7, by + bh / 2);
        ctx.lineTo(bx + 7 + tw, by + bh / 2);
        ctx.stroke();
      }
      ctx.restore();

      linkAnchors.set(`task:${task.id}`, { x: bx + bw / 2, y: by + bh / 2 });
      hitRegions.push({ kind: 'task', item: task, dateIso: iso, x: bx, y: by, w: bw, h: bh });
    });
  }
}

function paintPersonalLane(ctx, lane, { year, dStart, dEnd, visibleDays, xOfDay, state, dragState, time, linkAnchors }) {
  const { x, y, w, h, portrait } = lane;
  const showFree = visibleDays <= 14 || dragState?.active;

  // 1. Paint available FREE SLOTS as warm pale-paper windows (drop targets!)
  if (showFree) {
    const step = visibleDays <= 14 ? 1 : Math.max(1, Math.floor(visibleDays / 10));
    for (let d = dStart; d <= dEnd; d += step) {
      const iso = isoOfYearDoy(year, d);
      const slots = freeSlotsForDate(state, iso, 25);
      if (!slots.length) continue;
      const p0 = xOfDay(d), p1 = xOfDay(d + 1);
      const span = Math.max(10, p1 - p0);
      const topSlot = slots[slots.length - 1]; // Evening / best study free slot
      const isDropHover = dragState?.active && dragState.hoverSlot?.dateIso === iso;

      let fx, fy, fw, fh;
      if (!portrait) {
        fx = x + p0 + 3; fy = y + h - 22; fw = Math.max(20, span - 6); fh = 18;
      } else {
        fx = x + 4; fy = y + p1 - 22; fw = w - 8; fh = 18;
      }

      ctx.save();
      roundRectPath(ctx, fx, fy, fw, fh, 3);
      ctx.fillStyle = isDropHover
        ? 'rgba(218, 146, 62, 0.34)'
        : dragState?.active
          ? 'rgba(255, 251, 240, 0.88)'
          : 'rgba(255, 252, 244, 0.56)';
      ctx.fill();
      ctx.setLineDash(isDropHover ? [] : [3, 2]);
      ctx.strokeStyle = isDropHover ? '#b34b24' : dragState?.active ? '#2f5570' : 'rgba(47, 85, 112, 0.36)';
      ctx.lineWidth = isDropHover ? 1.8 : 1;
      ctx.stroke();
      ctx.setLineDash([]);

      if (fw >= 44) {
        ctx.fillStyle = isDropHover ? '#8c3114' : 'rgba(47, 85, 112, 0.78)';
        ctx.font = `500 9.5px ${SANS}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const txt = fw > 82 ? `空·${topSlot.label} ${fmtMin(topSlot.startMinute)}` : `空 ${fmtMin(topSlot.startMinute)}`;
        ctx.fillText(txt, fx + fw / 2, fy + fh / 2 + 0.5);
      }
      ctx.restore();

      hitRegions.push({ kind: 'free-slot', slot: topSlot, allSlots: slots, dateIso: iso, x: fx, y: fy, w: fw, h: fh });
    }
  }

  // 2. Paint scheduled personal blocks + conflict ripples!
  const blocks = (state.personal || []).filter((b) => {
    const p = parseIso(b.dateIso);
    if (!p || p.y !== year) return false;
    const d = doyOfIso(b.dateIso);
    return d >= dStart && d <= dEnd;
  });

  const byDay = new Map();
  for (const b of blocks) {
    const arr = byDay.get(b.dateIso) || [];
    arr.push(b);
    byDay.set(b.dateIso, arr);
  }

  for (const [iso, list] of byDay.entries()) {
    const d = doyOfIso(iso);
    const p0 = xOfDay(d), p1 = xOfDay(d + 1);
    const span = Math.max(8, p1 - p0);
    const conflicts = detectConflictsForDate(state, iso);
    const conflictIds = new Set(conflicts.flatMap((c) => [c.a.id, c.b.id]));

    list.forEach((b, idx) => {
      const hasConflict = conflictIds.has(b.id);
      let bx, by, bw, bh;
      const availH = showFree ? h - 28 : h - 10;
      if (!portrait) {
        bw = Math.min(w - 8, visibleDays <= 10 ? Math.max(52, span - 8) : Math.max(22, Math.min(82, span + 14)));
        bh = clamp(availH / Math.max(1, list.length) - 2, 16, 26);
        bx = clamp(x + (p0 + p1) / 2 - bw / 2, x + 4, x + w - bw - 4);
        by = y + 5 + idx * (bh + 2);
      } else {
        bw = w - 8;
        bh = clamp((span - 26) / Math.max(1, list.length), 18, 28);
        bx = x + 4;
        by = clamp(y + p0 + 4 + idx * (bh + 2), y + 4, y + h - bh - 24);
      }

      ctx.save();
      // Animated vermilion conflict ripple!
      if (hasConflict) {
        const pulse = 0.5 + 0.5 * Math.sin(time * 4.5);
        roundRectPath(ctx, bx - 3 - pulse * 3, by - 3 - pulse * 2, bw + 6 + pulse * 6, bh + 6 + pulse * 4, 6);
        ctx.strokeStyle = `rgba(186, 52, 34, ${0.42 + 0.38 * (1 - pulse)})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      roundRectPath(ctx, bx, by, bw, bh, 4);
      ctx.fillStyle = hasConflict
        ? '#9d3223'
        : b.completed
          ? 'rgba(72, 102, 124, 0.45)'
          : b.kind === 'review'
            ? '#3e5c4a'
            : '#2c4f69';
      ctx.fill();

      ctx.fillStyle = '#faf6ee';
      ctx.font = `500 ${bw > 68 ? 10.5 : 9.5}px ${SANS}`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const icon = hasConflict ? '⚠ ' : b.kind === 'review' ? '↻ ' : '';
      const raw = bw > 76 ? `${icon}${fmtMin(b.startMinute)} ${b.title}` : `${icon}${b.title}`;
      const maxC = Math.max(2, Math.floor((bw - 10) / 10));
      const trimmed = raw.length > maxC ? raw.slice(0, maxC - 1) + '…' : raw;
      ctx.fillText(trimmed, bx + 5, by + bh / 2 + 0.5);
      ctx.restore();

      linkAnchors.set(`personal:${b.id}`, { x: bx + bw / 2, y: by + bh / 2 });
      hitRegions.push({ kind: 'personal', item: b, hasConflict, conflicts: conflicts.filter((c) => c.a.id === b.id || c.b.id === b.id), dateIso: iso, x: bx, y: by, w: bw, h: bh });
    });
  }
}

function paintExamLane(ctx, lane, { year, dStart, dEnd, xOfDay, state, hoverLink, linkAnchors }) {
  const { x, y, w, h, portrait } = lane;
  const exams = (state.exams || []).filter((e) => {
    const p = parseIso(e.dateIso);
    if (!p || p.y !== year) return false;
    const d = doyOfIso(e.dateIso);
    return d >= dStart - 1 && d <= dEnd + 1;
  }).sort((a, b) => a.dateIso.localeCompare(b.dateIso));

  // 1. Ink-wash score trajectory ridge connecting graded exams
  const series = examTrendSeries(exams);
  if (series.length >= 2) {
    ctx.save();
    ctx.beginPath();
    series.forEach((pt, idx) => {
      const pos = xOfDay(doyOfIso(pt.dateIso) + 0.5);
      const norm = clamp((pt.rate - 0.5) / 0.45, 0.08, 0.92);
      const px = portrait ? x + lerp(10, w - 10, norm) : x + pos;
      const py = portrait ? y + pos : y + lerp(h - 10, 10, norm);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = 'rgba(138, 48, 34, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // 2. Vermilion Square Seals (朱砂方印) for each exam
  for (const ex of exams) {
    const d = doyOfIso(ex.dateIso);
    const pos = xOfDay(d + 0.5);
    const graded = ex.status === 'graded' && ex.scores?.length > 0;
    const total = graded ? Math.round(ex.scores.reduce((a, s) => a + Number(s.score || 0), 0)) : null;
    const isHl = hoverLink?.examId === ex.id;

    const sw = portrait ? Math.min(w - 10, 56) : Math.min(118, Math.max(66, 74));
    const sh = portrait ? 34 : Math.min(h - 10, 40);
    const sx = portrait ? x + (w - sw) / 2 : clamp(x + pos - sw / 2, x + 4, x + w - sw - 4);
    const sy = portrait ? clamp(y + pos - sh / 2, y + 4, y + h - sh - 4) : y + (h - sh) / 2;

    ctx.save();
    roundRectPath(ctx, sx, sy, sw, sh, 4);
    if (graded) {
      ctx.fillStyle = isHl ? '#8d261a' : '#a83425';
      ctx.fill();
      // Carved inner vermilion seal border
      roundRectPath(ctx, sx + 2.5, sy + 2.5, sw - 5, sh - 5, 2.5);
      ctx.strokeStyle = 'rgba(255, 242, 224, 0.55)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.fillStyle = '#fff6ea';
      ctx.font = `600 11px ${SERIF}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${total}分 · 抽出`, sx + sw / 2, sy + sh * 0.36);
      ctx.font = `9.5px ${SANS}`;
      ctx.fillStyle = 'rgba(255, 240, 222, 0.85)';
      const tShort = ex.title.replace(/^20\d\d[^\u4e00-\u9fa5]*/, '').slice(0, portrait ? 4 : 6);
      ctx.fillText(tShort, sx + sw / 2, sy + sh * 0.72);
    } else {
      ctx.fillStyle = 'rgba(250, 244, 232, 0.94)';
      ctx.fill();
      ctx.setLineDash([4, 2]);
      ctx.strokeStyle = '#b13c2b';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#9c2f20';
      ctx.font = `600 10.5px ${SERIF}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('待考 · 印', sx + sw / 2, sy + sh * 0.36);
      ctx.font = `9.5px ${SANS}`;
      ctx.fillText(ex.title.slice(0, portrait ? 4 : 6), sx + sw / 2, sy + sh * 0.72);
    }
    ctx.restore();

    linkAnchors.set(`exam:${ex.id}`, { x: sx + sw / 2, y: sy + sh / 2 });
    hitRegions.push({ kind: 'exam', item: ex, dateIso: ex.dateIso, x: sx, y: sy, w: sw, h: sh });
  }
}

function paintCampusLane(ctx, lane, { year, dStart, dEnd, xOfDay, state, linkAnchors }) {
  const { x, y, w, h, portrait } = lane;
  const notes = (state.campusNotes || []).filter((n) => {
    const p = parseIso(n.dateIso);
    if (!p || p.y !== year) return false;
    const d = doyOfIso(n.dateIso);
    return d >= dStart && d <= dEnd;
  });

  for (const n of notes) {
    const pos = xOfDay(doyOfIso(n.dateIso) + 0.5);
    const isGrowth = n.kind === 'growth';
    const bw = portrait ? w - 8 : 96;
    const bh = portrait ? 26 : Math.min(h - 12, 30);
    const bx = portrait ? x + 4 : clamp(x + pos - bw / 2, x + 4, x + w - bw - 4);
    const by = portrait ? clamp(y + pos - bh / 2, y + 4, y + h - bh - 4) : y + (h - bh) / 2;

    ctx.save();
    roundRectPath(ctx, bx, by, bw, bh, 12);
    ctx.fillStyle = isGrowth ? 'rgba(164, 108, 48, 0.18)' : 'rgba(47, 93, 107, 0.16)';
    ctx.fill();
    ctx.strokeStyle = isGrowth ? '#9a6026' : '#2f5d6b';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = isGrowth ? '#6b3e12' : '#1f4450';
    ctx.font = `500 10px ${SERIF}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const mark = isGrowth ? '叶·' : '校·';
    const lim = portrait ? 4 : 7;
    ctx.fillText(mark + n.title.slice(0, lim), bx + bw / 2, by + bh / 2 + 0.5);
    ctx.restore();

    linkAnchors.set(`campus:${n.id}`, { x: bx + bw / 2, y: by + bh / 2 });
    hitRegions.push({ kind: 'campus', item: n, dateIso: n.dateIso, x: bx, y: by, w: bw, h: bh });
  }
}

function paintAssociationThreads(ctx, { state, linkAnchors, hoverLink }) {
  ctx.save();
  for (const task of state.tasks || []) {
    if (!task.scheduledBlockId) continue;
    const a = linkAnchors.get(`task:${task.id}`);
    const b = linkAnchors.get(`personal:${task.scheduledBlockId}`);
    if (!a || !b) continue;
    const active = hoverLink?.taskId === task.id || hoverLink?.personalId === task.scheduledBlockId;
    ctx.strokeStyle = active ? 'rgba(168, 72, 40, 0.78)' : 'rgba(130, 88, 56, 0.34)';
    ctx.lineWidth = active ? 1.8 : 1.1;
    ctx.setLineDash(active ? [] : [4, 3]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo((a.x + b.x) / 2 + 12, (a.y + b.y) / 2, b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function paintAbsenceVeil(ctx, { portrait, railX, railY, halfBase, lanes, xOfDay, year, absenceRange }) {
  const { startIso, endIso } = absenceRange;
  const pA = parseIso(startIso), pB = parseIso(endIso);
  if (!pA || !pB || pA.y !== year) return;
  const d0 = Math.min(doyOfIso(startIso), doyOfIso(endIso));
  const d1 = Math.max(doyOfIso(startIso), doyOfIso(endIso)) + 1;
  const pos0 = xOfDay(d0), pos1 = xOfDay(d1);
  const last = lanes[lanes.length - 1];

  ctx.save();
  ctx.fillStyle = 'rgba(146, 86, 46, 0.14)';
  ctx.strokeStyle = 'rgba(146, 86, 46, 0.65)';
  ctx.lineWidth = 1.5;
  if (!portrait) {
    const top = railY - halfBase - 8;
    const bot = last ? last.y + last.h + 8 : railY + halfBase + 8;
    ctx.fillRect(railX + pos0, top, Math.max(8, pos1 - pos0), bot - top);
    ctx.strokeRect(railX + pos0, top, Math.max(8, pos1 - pos0), bot - top);
  } else {
    const left = railX - halfBase - 8;
    const right = last ? last.x + last.w + 8 : railX + halfBase + 8;
    ctx.fillRect(left, railY + pos0, right - left, Math.max(8, pos1 - pos0));
    ctx.strokeRect(left, railY + pos0, right - left, Math.max(8, pos1 - pos0));
  }
  ctx.restore();
}

function paintDragGhost(ctx, drag) {
  const { x, y, originX, originY, task, hoverSlot } = drag;
  ctx.save();
  // Silk tether back to homework slip origin
  ctx.strokeStyle = hoverSlot ? 'rgba(184, 72, 36, 0.72)' : 'rgba(130, 88, 56, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.quadraticCurveTo((originX + x) / 2, Math.min(originY, y) - 18, x, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Floating cotton-paper slip under pointer
  const w = 156, h = 34;
  ctx.shadowColor = 'rgba(54, 34, 16, 0.30)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 8;
  roundRectPath(ctx, x - w / 2, y - h / 2, w, h, 6);
  ctx.fillStyle = '#fffdf7';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = hoverSlot ? '#b34125' : '#9a5a34';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#2b241c';
  ctx.font = `600 11px ${SANS}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const txt = hoverSlot ? `放手排入 · ${hoverSlot.label} ${fmtMin(hoverSlot.startMinute)}` : `${task.subject} · ${task.title.slice(0, 9)}`;
  ctx.fillText(txt, x, y + 0.5);
  ctx.restore();
}

/**
 * Day-View Hourly Horizon Ribbon (06:00–23:00):
 * Aligns Hainan Middle School bell schedule, courses, personal blocks, exams, and free slots
 * directly along the sun's horizontal coordinate at the horizon!
 */
function paintDayHourRibbon(ctx, { W, H, portrait, year, daySel, state, dayMinutes, time }) {
  const iso = isoOfYearDoy(year, daySel);
  const bell = BELL_SCHEDULES[state.bellMode || 'summer'] || BELL_SCHEDULES.summer;
  const { courses, exams, personal } = itemsForDate(state, iso);
  const freeSlots = freeSlotsForDate(state, iso, 20);
  const conflicts = detectConflictsForDate(state, iso);
  const conflictIds = new Set(conflicts.flatMap((c) => [c.a.id, c.b.id]));

  const min0 = 360, min1 = 1380; // 06:00 -> 23:00
  const x0 = portrait ? 16 : W * 0.06;
  const x1 = portrait ? W - 16 : W * 0.94;
  const y = portrait ? H * 0.57 : H - 86;
  const h = portrait ? 48 : 54;
  const mapX = (m) => lerp(x0, x1, clamp((m - min0) / (min1 - min0), 0, 1));

  ctx.save();
  // Translucent smoked-wood & paper bar at the horizon
  roundRectPath(ctx, x0 - 4, y - 4, (x1 - x0) + 8, h + 8, 8);
  ctx.fillStyle = 'rgba(24, 21, 18, 0.58)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 246, 228, 0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Bell rhythm background notches
  for (const sl of bell.slots) {
    const sx = mapX(sl.start), ex = mapX(sl.end);
    if (sl.kind === 'rest' || sl.kind === 'life') {
      ctx.fillStyle = 'rgba(255, 248, 232, 0.07)';
      ctx.fillRect(sx, y + 2, Math.max(2, ex - sx), h - 4);
    }
  }

  // Free study slots (clickable to quick-add personal block)
  for (const fs of freeSlots) {
    const sx = mapX(fs.startMinute), ex = mapX(fs.endMinute);
    if (ex - sx < 10) continue;
    roundRectPath(ctx, sx + 1, y + h / 2 + 2, Math.max(8, ex - sx - 2), h / 2 - 4, 3);
    ctx.fillStyle = 'rgba(248, 240, 220, 0.16)';
    ctx.fill();
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = 'rgba(255, 242, 214, 0.45)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.setLineDash([]);
    hitRegions.push({ kind: 'hour-free', slot: fs, dateIso: iso, x: sx, y: y + h / 2, w: ex - sx, h: h / 2 });
  }

  // Courses on upper half
  for (const c of courses) {
    const sx = mapX(c.startMinute), ex = mapX(c.endMinute);
    const sub = subjectByName(c.subject);
    roundRectPath(ctx, sx + 0.5, y + 3, Math.max(6, ex - sx - 1), h / 2 - 5, 3);
    ctx.fillStyle = sub.color;
    ctx.fill();
    if (ex - sx > 18) {
      ctx.fillStyle = '#fffaf0';
      ctx.font = `500 10px ${SANS}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(sub.short, (sx + ex) / 2, y + h / 4 + 1);
    }
    hitRegions.push({ kind: 'hour-course', item: c, dateIso: iso, x: sx, y, w: Math.max(8, ex - sx), h: h / 2 });
  }

  // Personal & Exams on lower half
  for (const b of personal) {
    const sx = mapX(b.startMinute), ex = mapX(b.endMinute);
    const hasC = conflictIds.has(b.id);
    roundRectPath(ctx, sx + 1, y + h / 2 + 2, Math.max(8, ex - sx - 2), h / 2 - 4, 3);
    ctx.fillStyle = hasC ? `rgba(186, 52, 34, ${0.78 + 0.2 * Math.sin(time * 5)})` : 'rgba(56, 102, 136, 0.88)';
    ctx.fill();
    if (ex - sx > 28) {
      ctx.fillStyle = '#fffaf0';
      ctx.font = `500 9.5px ${SANS}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((hasC ? '⚠' : '') + b.title.slice(0, 5), (sx + ex) / 2, y + h * 0.75);
    }
    hitRegions.push({ kind: 'hour-personal', item: b, dateIso: iso, x: sx, y: y + h / 2, w: Math.max(10, ex - sx), h: h / 2 });
  }

  for (const ex of exams) {
    const sx = mapX(ex.startMinute ?? 480), exX = mapX(ex.endMinute ?? 600);
    roundRectPath(ctx, sx, y + 2, Math.max(12, exX - sx), h - 4, 4);
    ctx.fillStyle = 'rgba(176, 50, 34, 0.72)';
    ctx.fill();
    ctx.strokeStyle = '#ffdfca';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    hitRegions.push({ kind: 'exam', item: ex, dateIso: iso, x: sx, y, w: Math.max(12, exX - sx), h });
  }

  // Hour tick labels (6:00, 8:00, 12:00, 15:00, 18:00, 21:00, 23:00)
  ctx.fillStyle = 'rgba(255, 248, 234, 0.72)';
  ctx.font = `10px ${SANS}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const hr of [6, 8, 10, 12, 14, 16, 18, 20, 22]) {
    const hx = mapX(hr * 60);
    ctx.fillText(`${hr}:00`, hx, y + h + 7);
  }

  // Current solar minute needle
  const curX = mapX(dayMinutes);
  ctx.strokeStyle = '#ffe59f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(curX, y - 7);
  ctx.lineTo(curX, y + h + 4);
  ctx.stroke();
  ctx.restore();
}

/** Hit-test the latest frame's interactive ribbon elements (top-most wins). */
export function hitTestRibbons(px, py) {
  for (let i = hitRegions.length - 1; i >= 0; i--) {
    const r = hitRegions[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r;
  }
  return null;
}

/** Find matching free-slot hit under (px, py) while dragging a homework slip. */
export function hitTestFreeSlot(px, py) {
  for (let i = hitRegions.length - 1; i >= 0; i--) {
    const r = hitRegions[i];
    if (r.kind === 'free-slot' && px >= r.x - 10 && px <= r.x + r.w + 10 && py >= r.y - 16 && py <= r.y + r.h + 16) {
      return r.slot;
    }
  }
  return null;
}
