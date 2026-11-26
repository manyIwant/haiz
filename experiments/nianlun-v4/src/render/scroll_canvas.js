/**
 * HAIZ · NIANLUN · 一卷 V4 — High-Craft Living Scroll Canvas Renderer
 *
 * Renders the single unified V4 artifact at 60fps:
 *  - Past / Future / Middle cylindrical rolls with wood-pulp specular shading & Larsson annual-ring end-faces
 *  - Material physics: tension fibers (w > 1.25), compression folds (w < 0.72)
 *  - Four continuous semantic reading modes (字形 / 概要 / 清单 ≥44pt / 时刻 06:00-23:00 linear)
 *  - Honest undated header shelf in Hour-Scale mode (never fabricates clock hours!)
 *  - Time Sovereignty tinting (campus locked vs home schedulable)
 *  - Five temporal forms (雾 Fog, 珠 Bead, 槽 Channel + through-wall extension, 墙 Wall + composite pill, 迹 Trace)
 *  - Local Lane Splitting (局部分道) ONLY for mandatory Occupation × Occupation overlaps
 *  - Yield / Focus (让位) with Bezier relation threads terminating directly on ring markers!
 *  - Single-finger edge stretch grip handle for one-handed accessibility
 */

import {
  WEEKDAY_LABELS,
  getTaskStatusMeta,
  formatHour,
  isItemPrivateLocked,
} from '../core/model.js';
import {
  computeScrollLayout,
  computeListRowBudget,
  assignLocalConflictLanes,
  packTemporalChannels,
  packFogVeils,
  groupDeadlineWalls,
} from '../core/layout.js';
import { getAnnualRingDiscCanvas } from './wood_textures.js';

const TAU = Math.PI * 2;
const FONT_SANS = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif';
const FONT_SERIF = '"Songti SC", "Noto Serif SC", "Cormorant Garamond", Georgia, serif';

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export class ScrollCanvasRenderer {
  constructor(canvas, store, climateRef) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.store = store;
    this.climateRef = climateRef;

    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.scrollOffset = 0;
    this.totalHeight = 0;
    this.segs = [];

    // Interactive state shared with gesture engine
    this.selectedItemId = null;
    this.hoveredHit = null;
    this.activeJog = null; // { rollSeg, deltaDaysText, currentAngle, accumAngle }
    this.draggingFog = null; // { item, screenY, hoverDayIdx }
    this.activeHandleDayIdx = null;
    this.stressOverflowOpen = false;
    this.reducedMotion = false;

    // Fresh hit-testing regions rebuilt on every render frame!
    this.hitRegions = [];
    this.rollHitBoxes = [];
    this.resizeInitialized = false;
  }

  getPalette() {
    const root = document.documentElement;
    const isDark = root.dataset.theme === 'dark'
      || (root.dataset.theme !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      return {
        dark: true,
        paper: '#171614',
        paperHoliday: '#1c1b18',
        paperSchoolTint: 'rgba(255, 250, 240, 0.025)',
        paperExamBg: 'rgba(118, 168, 240, 0.055)',
        ink: '#ebe6dc',
        inkSoft: '#9d978c',
        inkMuted: '#6f6a61',
        line: 'rgba(235, 230, 220, 0.11)',
        lineStrong: 'rgba(235, 230, 220, 0.24)',
        now: '#76a8f0',
        nowFill: 'rgba(118, 168, 240, 0.17)',
        nowBorder: 'rgba(118, 168, 240, 0.62)',
        mem: '#e6a94c',
        memSoft: 'rgba(230, 169, 76, 0.18)',
        fog: '#8fa8bf',
        fogFill: 'rgba(143, 168, 191, 0.24)',
        fogSolid: '#27313b',
        rollTop: '#312a22',
        rollMid: '#26201a',
        rollBot: '#191511',
        rollShadow: 'rgba(0, 0, 0, 0.45)',
        rollGrain: 'rgba(222, 196, 158, 0.14)',
        fiber: 'rgba(222, 206, 178, 0.15)',
        foldShadow: 'rgba(0, 0, 0, 0.28)',
        foldLight: 'rgba(255, 245, 225, 0.06)',
        schoolBlock: 'rgba(255, 250, 240, 0.055)',
        schoolBorder: 'rgba(235, 230, 220, 0.12)',
        examBg: '#e4ded2',
        examText: '#171614',
        pillBg: '#23211d',
        pillBorder: 'rgba(235, 230, 220, 0.22)',
      };
    }

    return {
      dark: false,
      paper: '#f8f5ee',
      paperHoliday: '#fcfaf5',
      paperSchoolTint: 'rgba(92, 82, 66, 0.032)',
      paperExamBg: 'rgba(42, 94, 168, 0.045)',
      ink: '#1f2421',
      inkSoft: '#636862',
      inkMuted: '#8d918a',
      line: 'rgba(46, 42, 34, 0.11)',
      lineStrong: 'rgba(46, 42, 34, 0.25)',
      now: '#2a5ea8',
      nowFill: 'rgba(42, 94, 168, 0.11)',
      nowBorder: 'rgba(42, 94, 168, 0.54)',
      mem: '#b8761a',
      memSoft: 'rgba(184, 118, 26, 0.13)',
      fog: '#5a6f82',
      fogFill: 'rgba(90, 111, 130, 0.20)',
      fogSolid: '#233240',
      rollTop: '#efe8da',
      rollMid: '#e3d7c1',
      rollBot: '#cbbba0',
      rollShadow: 'rgba(62, 46, 26, 0.17)',
      rollGrain: 'rgba(108, 82, 48, 0.15)',
      fiber: 'rgba(128, 108, 78, 0.14)',
      foldShadow: 'rgba(92, 74, 48, 0.11)',
      foldLight: 'rgba(255, 255, 255, 0.52)',
      schoolBlock: 'rgba(66, 62, 54, 0.055)',
      schoolBorder: 'rgba(66, 62, 54, 0.12)',
      examBg: '#232825',
      examText: '#f8f5ee',
      pillBg: '#fbf9f4',
      pillBorder: 'rgba(46, 42, 34, 0.22)',
    };
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);

    this.recomputeLayout();
    if (!this.resizeInitialized) {
      this.centerOnToday();
      this.resizeInitialized = true;
    }
    this.clampScroll();
    this.draw();
  }

  centerOnToday() {
    this.recomputeLayout();
    const todaySeg = this.segs.find((s) => !s.roll && s.i === this.store.nowIdx);
    if (todaySeg) {
      this.scrollOffset = Math.max(0, todaySeg.y - Math.min(130, this.height * 0.22));
    }
    this.clampScroll();
  }

  clampScroll() {
    const maxOff = Math.max(0, this.totalHeight - this.height + 92);
    this.scrollOffset = clamp(this.scrollOffset, 0, maxOff);
  }

  /** Build per-day visible item index & compute scroll segments */
  recomputeLayout() {
    const days = this.store.days;
    const state = this.store.state;
    const isoToIdx = new Map();
    for (let i = 0; i < days.length; i++) isoToIdx.set(days[i].iso, i);

    const visibleItems = state.items.filter((item) => !item.hiddenByStudent);
    const itemsByDay = Array.from({ length: days.length }, () => []);
    const countsByDay = new Int32Array(days.length);

    for (const item of visibleItems) {
      if (item.form === 'fog' && !item.dateIso) continue;
      const targetIso = item.dateIso || item.dueIso;
      const idx = targetIso ? isoToIdx.get(targetIso) : undefined;
      if (idx != null) {
        itemsByDay[idx].push(item);
        if (!item.isReturnWall) countsByDay[idx]++;
      }
    }

    const { segs, totalHeight } = computeScrollLayout(days, countsByDay, this.store.nowIdx);
    this.segs = segs;
    this.totalHeight = totalHeight;
    this._isoToIdx = isoToIdx;
    this._itemsByDay = itemsByDay;
    this._visibleItems = visibleItems;
  }

  segAtScreenY(screenY) {
    const contentY = screenY + this.scrollOffset;
    return this.segs.find((s) => contentY >= s.y && contentY < s.y + s.h) || null;
  }

  fractionalDayIndexAt(screenY) {
    const s = this.segAtScreenY(screenY);
    if (!s) return null;
    const contentY = screenY + this.scrollOffset;
    if (s.roll) return (s.from + s.to) / 2;
    return s.i + clamp((contentY - s.y) / Math.max(1, s.h), 0, 1);
  }

  anchorFractionalDay(fi, screenY) {
    this.recomputeLayout();
    const k = Math.floor(fi);
    const seg = this.segs.find((s) => !s.roll && s.i === k);
    if (seg) {
      this.scrollOffset = seg.y + (fi - k) * seg.h - screenY;
      this.clampScroll();
    }
  }

  _text(str, x, y, size, color, weight = 400, align = 'left', family = FONT_SANS) {
    const ctx = this.ctx;
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  _fitText(str, maxW, size, weight = 400, family = FONT_SANS) {
    const ctx = this.ctx;
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(str).width <= maxW) return str;
    let s = String(str);
    while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) {
      s = s.slice(0, -1);
    }
    return `${s}…`;
  }

  _isRelatedToSelected(item) {
    if (!this.selectedItemId) return true;
    if (item.id === this.selectedItemId) return true;
    const sel = this.store.state.items.find((x) => x.id === this.selectedItemId);
    if (!sel) return true;
    if (sel.linkedTaskId && item.id === sel.linkedTaskId) return true;
    if (item.linkedTaskId && item.linkedTaskId === sel.id) return true;
    if (sel.relationGroup && item.relationGroup && sel.relationGroup === item.relationGroup) return true;
    if (sel.kind === 'exam' && item.kind === 'exam' && sel.subject !== '综合' && sel.subject === item.subject) return true;
    return false;
  }

  /** Map a day's (iso, hour) to screen Y (if expanded) or to its rolled end-face marker coordinate! */
  _locateItemAnchor(item) {
    const iso = item.dateIso || item.dueIso || item.fogFromIso;
    if (!iso) return null;
    const dayIdx = this._isoToIdx.get(iso);
    if (dayIdx == null) return null;

    // Check expanded day segment
    const daySeg = this.segs.find((s) => !s.roll && s.i === dayIdx);
    if (daySeg) {
      const topY = daySeg.y - this.scrollOffset;
      if (item._screenAnchor) return item._screenAnchor;
      return { x: this.width * 0.5, y: topY + daySeg.h / 2, inRoll: false };
    }

    // Check rolled segment -> exact ring marker coordinate on the annual-ring end-face (§7.3)!
    const rollSeg = this.segs.find((s) => s.roll && dayIdx >= s.from && dayIdx <= s.to);
    if (rollSeg && rollSeg._ringCenter) {
      const { cx, cy, R } = rollSeg._ringCenter;
      const totalDays = rollSeg.to - rollSeg.from + 1;
      const weeks = Math.max(1, Math.ceil(totalDays / 7));
      const isPast = rollSeg.position === 'past';
      const wkFromOuter = isPast
        ? Math.floor((rollSeg.to - dayIdx) / 7)
        : Math.floor((dayIdx - rollSeg.from) / 7);
      const ringIdx = clamp(weeks - 1 - wkFromOuter, 0, weeks - 1);
      const pithR = Math.max(2.6, R * 0.14);
      const usableR = R - pithR - 1.2;
      const rr = pithR + ((ringIdx + 0.5) / weeks) * usableR;
      const wd = this.store.days[dayIdx].wd;
      const ang = -Math.PI / 2 + (wd + 0.5) * (TAU / 7) + (rollSeg.spin || 0);
      return {
        x: cx + Math.cos(ang) * rr,
        y: cy + Math.sin(ang) * rr,
        inRoll: true,
        rollSeg,
      };
    }

    return null;
  }

  /** Draw a cylindrical rolled segment + Larsson procedural annual-ring end-face (§4) */
  _drawRollSegment(s, C) {
    const ctx = this.ctx;
    const y = s.y - this.scrollOffset;
    if (y > this.height + 24 || y + s.h < -24) return;

    const days = this.store.days;
    const state = this.store.state;
    const nDays = s.to - s.from + 1;
    const weeks = Math.max(1, Math.ceil(nDays / 7));
    const leftHanded = state.leftHandedDial;
    const R = 27;
    const cx = leftHanded ? 38 : this.width - 38;
    const cy = y + s.h / 2;
    s._ringCenter = { cx, cy, R };

    // Subtle cast drop shadow beneath cylinder onto the flat strip
    const shadowGrad = ctx.createLinearGradient(0, y + s.h - 4, 0, y + s.h + 10);
    shadowGrad.addColorStop(0, C.rollShadow);
    shadowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = shadowGrad;
    ctx.fillRect(0, y + s.h - 4, this.width, 14);

    // Upper contact shadow from flat strip rolling into cylinder
    if (s.position !== 'past' || s.y > 0) {
      const topShadow = ctx.createLinearGradient(0, y - 8, 0, y + 4);
      topShadow.addColorStop(0, 'transparent');
      topShadow.addColorStop(1, C.rollShadow);
      ctx.fillStyle = topShadow;
      ctx.fillRect(0, y - 8, this.width, 12);
    }

    // Cylindrical paper/timber body with realistic specular highlight ridge
    const cylY = y + 5;
    const cylH = s.h - 10;
    const cylGrad = ctx.createLinearGradient(0, cylY, 0, cylY + cylH);
    cylGrad.addColorStop(0, C.rollBot);
    cylGrad.addColorStop(0.24, C.rollTop);
    cylGrad.addColorStop(0.56, C.rollMid);
    cylGrad.addColorStop(1, C.rollBot);
    ctx.fillStyle = cylGrad;
    ctx.fillRect(0, cylY, this.width, cylH);

    // Subtle cylindrical wood-pulp grain fibers (skipped in lowPower mode)
    if (!state.lowPowerTextureOff) {
      ctx.strokeStyle = C.rollGrain;
      ctx.lineWidth = 0.7;
      const textZoneStart = leftHanded ? 76 : 0;
      const textZoneEnd = leftHanded ? this.width : this.width - 74;
      for (let k = 0; k < 5; k++) {
        const gy = cylY + 7 + (k * (cylH - 14)) / 4;
        ctx.beginPath();
        ctx.moveTo(textZoneStart, gy);
        for (let x = textZoneStart; x < textZoneEnd; x += 28) {
          const wave = Math.sin((x + k * 41) * 0.032) * 1.1;
          ctx.lineTo(Math.min(textZoneEnd, x + 28), gy + wave);
        }
        ctx.stroke();
      }
    }

    // Top & bottom subtle rim hairlines
    ctx.strokeStyle = C.lineStrong;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, cylY + 0.5);
    ctx.lineTo(this.width, cylY + 0.5);
    ctx.moveTo(0, cylY + cylH - 0.5);
    ctx.lineTo(this.width, cylY + cylH - 0.5);
    ctx.stroke();

    // Aggregate honest counts inside this roll
    let examCount = 0;
    let memCount = 0;
    let unknownTaskCount = 0;
    let changeCount = 0;
    for (let i = s.from; i <= s.to; i++) {
      for (const item of this._itemsByDay[i] || []) {
        if (item.kind === 'exam') examCount++;
        else if (item.kind === 'memory') memCount++;
        else if (item.kind === 'task' && item.status === 'unknown' && i < this.store.nowIdx) unknownTaskCount++;
        else if (item.kind === 'change') changeCount++;
      }
    }

    const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
    const dStart = days[s.from].date;
    const dEnd = days[s.to].date;
    const spanStr = nDays < 7 ? `${nDays} 天` : `${weeks} 周`;
    const prefix = s.position === 'past'
      ? '已卷起'
      : s.position === 'middle'
        ? '并置中间卷'
        : '还没展开';

    const tx = leftHanded ? 78 : 16;
    const maxTextW = this.width - 96;
    const titleStr = `${prefix} · ${fmt(dStart)}–${fmt(dEnd)} · ${spanStr}`;
    this._text(this._fitText(titleStr, maxTextW, 13.5, 600, FONT_SERIF), tx, cy - 9, 13.5, C.ink, 600, 'left', FONT_SERIF);

    const subParts = [];
    if (examCount) subParts.push(`${examCount} 场考试`);
    if (memCount) subParts.push(state.privacyLocked ? `${memCount} 条已锁定记录` : `${memCount} 条记忆`);
    if (unknownTaskCount && s.position === 'past') subParts.push(`${unknownTaskCount} 件事软件不知道结果`);
    if (changeCount && subParts.length < 3) subParts.push(`${changeCount} 次变动`);
    const subStr = subParts.length > 0
      ? subParts.join(' · ')
      : (s.position === 'past' ? '这几周留白，也是完整的时间' : '点卷展开一周，或在右侧年轮拨动');
    this._text(this._fitText(subStr, maxTextW, 11.5, 400), tx, cy + 11, 11.5, C.inkSoft, 400);

    // --- Procedural Annual-Ring End-Face Disc (§4.2) ---
    // Build week rings: innermost (0) -> outermost (weeks - 1)
    const isPast = s.position === 'past';
    const weeksData = Array.from({ length: weeks }, () => ({
      isHoliday: false,
      isSemesterSeam: false,
      dayWeather: {},
    }));
    const climate = this.climateRef && this.climateRef.current;

    for (let i = s.from; i <= s.to; i++) {
      const d = days[i];
      const wkFromOuter = isPast
        ? Math.floor((s.to - i) / 7)
        : Math.floor((i - s.from) / 7);
      const ringIdx = clamp(weeks - 1 - wkFromOuter, 0, weeks - 1);
      if (d.isHoliday) weeksData[ringIdx].isHoliday = true;
      if (d.isSemesterSeam) weeksData[ringIdx].isSemesterSeam = true;
      if (climate && climate.available) {
        const w = climate.getDay(d.iso);
        if (w) weeksData[ringIdx].dayWeather[d.wd] = w;
      }
    }

    const discCanvas = getAnnualRingDiscCanvas({
      key: `${s.from}_${s.to}_${s.position}_${climate && climate.available ? 'c1' : 'c0'}`,
      radiusPx: R,
      dpr: this.dpr,
      weeksData,
      dark: C.dark,
      lowPower: state.lowPowerTextureOff,
    });

    // Subtle elevation shadow under end-face cylinder cap
    ctx.save();
    ctx.shadowColor = C.rollShadow;
    ctx.shadowBlur = 7;
    ctx.shadowOffsetX = leftHanded ? 2 : -2;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fillStyle = C.rollMid;
    ctx.fill();
    ctx.restore();

    // Draw rotated wood end-grain texture!
    const spin = s.spin || 0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    const drawSize = discCanvas.width / this.dpr;
    ctx.drawImage(discCanvas, -drawSize / 2, -drawSize / 2, drawSize, drawSize);

    // Subtle 7-day radial tick marks on rim (Monday at 12 o'clock)
    ctx.strokeStyle = C.dark ? 'rgba(235,230,220,0.22)' : 'rgba(62,46,26,0.24)';
    ctx.lineWidth = 0.8;
    for (let wd = 0; wd < 7; wd++) {
      const a = -Math.PI / 2 + (wd * TAU) / 7;
      const inner = wd === 0 ? R - 5 : R - 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      ctx.stroke();
    }

    // Inlaid semantic markers on exact (week ring, weekday angle) coordinates (§4.2)
    const pithR = Math.max(2.6, R * 0.14);
    const usableR = R - pithR - 1.2;
    for (let i = s.from; i <= s.to; i++) {
      const d = days[i];
      const wkFromOuter = isPast
        ? Math.floor((s.to - i) / 7)
        : Math.floor((i - s.from) / 7);
      const ringIdx = clamp(weeks - 1 - wkFromOuter, 0, weeks - 1);
      const rr = pithR + ((ringIdx + 0.5) / weeks) * usableR;
      const ang = -Math.PI / 2 + ((d.wd + 0.5) * TAU) / 7;
      const mx = Math.cos(ang) * rr;
      const my = Math.sin(ang) * rr;

      for (const item of this._itemsByDay[i] || []) {
        if (item.kind === 'exam') {
          // Pale halo + crisp ink dot
          ctx.fillStyle = C.dark ? 'rgba(24,20,16,0.8)' : 'rgba(248,245,238,0.85)';
          ctx.beginPath();
          ctx.arc(mx, my, 3.6, 0, TAU);
          ctx.fill();
          ctx.fillStyle = C.ink;
          ctx.beginPath();
          ctx.arc(mx, my, 2.4, 0, TAU);
          ctx.fill();
        } else if (item.kind === 'memory' && !state.privacyLocked) {
          // Warm amber resin dot (strictly hidden under Privacy Lock! §12)
          ctx.fillStyle = C.mem;
          ctx.beginPath();
          ctx.arc(mx, my, 2.3, 0, TAU);
          ctx.fill();
        } else if (item.kind === 'change') {
          // Fine radial score notch (细刻痕)
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * (rr - 2.2), Math.sin(ang) * (rr - 2.2));
          ctx.lineTo(Math.cos(ang) * (rr + 2.2), Math.sin(ang) * (rr + 2.2));
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    // Fixed 12 o'clock Monday reference index needle (does not spin)
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - R - 3.5);
    ctx.lineTo(cx, cy - R + 3.5);
    ctx.stroke();

    // Active jog-dial glow ring + whisper tooltip
    if (this.activeJog && this.activeJog.rollPosition === s.position) {
      ctx.strokeStyle = C.now;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R + 3, 0, TAU);
      ctx.stroke();

      if (this.activeJog.toastText) {
        const badgeW = 128;
        const bx = leftHanded ? cx + R + 10 : cx - R - badgeW - 10;
        const by = cy - 12;
        ctx.fillStyle = C.pillBg;
        roundRectPath(ctx, bx, by, badgeW, 24, 12);
        ctx.fill();
        ctx.strokeStyle = C.nowBorder;
        ctx.lineWidth = 1;
        ctx.stroke();
        this._text(this.activeJog.toastText, bx + badgeW / 2, by + 12, 11.5, C.now, 600, 'center');
      }
    }

    this.rollHitBoxes.push({ seg: s, cx, cy, R, y, h: s.h });
  }

  /** Draw a single expanded day segment in its dynamic semantic reading mode */
  _drawDaySegment(s, C, rightReservedPx) {
    const ctx = this.ctx;
    const d = this.store.days[s.i];
    const state = this.store.state;
    const y = s.y - this.scrollOffset;
    const h = s.h;
    if (y > this.height + 24 || y + h < -24) return;

    const GX = this.width >= 420 ? 64 : 58;
    const isToday = d.i === this.store.nowIdx;
    const items = (this._itemsByDay[d.i] || []).filter((it) => !it.isReturnWall);
    const hasFocus = Boolean(this.selectedItemId);

    // 1. Base paper tone (holiday sapwood wash vs school neutral paper)
    if (d.isHoliday) {
      ctx.fillStyle = C.paperHoliday;
      ctx.fillRect(0, y, this.width, h);
    } else if (d.school && s.mode < 3) {
      ctx.fillStyle = C.paperSchoolTint;
      ctx.fillRect(GX, y, this.width - GX, h);
    }

    // 2. Background atmospheres (背景: e.g. 考试周)
    for (const bg of state.backgrounds || []) {
      if (d.iso >= bg.fromIso && d.iso <= bg.toIso) {
        ctx.fillStyle = bg.tone === 'holiday' ? C.paperHoliday : C.paperExamBg;
        ctx.fillRect(GX, y, this.width - GX, h);
        if (d.iso === bg.fromIso && h >= 32) {
          this._text(bg.title, this.width - rightReservedPx - 8, y + 12, 10.5, C.inkMuted, 500, 'right');
        }
      }
    }

    // 3. Material Physics (§7.4 & §10): Tension fibers (w > 1.25) & Compression folds (w < 0.72)
    if (!state.lowPowerTextureOff) {
      if (d.w > 1.25) {
        const alpha = clamp((d.w - 1.25) * 0.24, 0, 0.55);
        ctx.save();
        ctx.strokeStyle = C.fiber;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 0.6;
        for (let fx = GX + 10; fx < this.width - 10; fx += 9) {
          ctx.beginPath();
          ctx.moveTo(fx, y + 2);
          ctx.bezierCurveTo(
            fx + Math.sin(fx * 0.13) * 1.1, y + h * 0.35,
            fx - Math.sin(fx * 0.17) * 1.1, y + h * 0.7,
            fx, y + h - 2,
          );
          ctx.stroke();
        }
        ctx.restore();
      } else if (d.w < 0.72) {
        const foldRatio = clamp((0.72 - d.w) / 0.56, 0, 1);
        const creases = Math.max(2, Math.round(foldRatio * 5));
        for (let k = 1; k <= creases; k++) {
          const cy = y + (h * k) / (creases + 1);
          ctx.strokeStyle = C.foldShadow;
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.moveTo(GX, cy);
          ctx.lineTo(this.width, cy);
          ctx.stroke();
          ctx.strokeStyle = C.foldLight;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(GX, cy + 1);
          ctx.lineTo(this.width, cy + 1);
          ctx.stroke();
        }
      }
    }

    // Drag-fog drop target highlight!
    if (this.draggingFog && this.draggingFog.hoverDayIdx === d.i) {
      ctx.fillStyle = C.nowFill;
      ctx.fillRect(GX, y + 1, this.width - GX, h - 2);
      ctx.strokeStyle = C.now;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(GX + 1, y + 2, this.width - GX - 2, h - 4);
      ctx.setLineDash([]);
    }

    // 4. Top day divider (or stitched semester seam §12)
    if (d.isSemesterSeam) {
      ctx.save();
      ctx.strokeStyle = C.inkSoft;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(this.width, y + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    } else {
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(this.width, y + 0.5);
      ctx.stroke();
    }

    // Gutter vertical hairline
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(GX + 0.5, y);
    ctx.lineTo(GX + 0.5, y + h);
    ctx.stroke();

    // 5. Left gutter weekday + date + Today vertical accent bar (non-hour modes, §13 #3!)
    const wdText = `周${WEEKDAY_LABELS[d.wd]}`;
    const dtText = `${d.date.getMonth() + 1}/${d.date.getDate()}`;
    if (isToday && s.mode < 3) {
      ctx.fillStyle = C.now;
      ctx.fillRect(0, y + 1, 3.5, h - 2);
    }
    if (h >= 16) {
      const wdY = h < 34 ? y + h / 2 : y + 15;
      this._text(wdText, 11, wdY, h < 26 ? 11 : 13, isToday ? C.now : C.inkSoft, isToday ? 700 : 500);
      if (h >= 34) {
        this._text(dtText, 11, y + 31, 11.5, isToday ? C.now : C.inkMuted, isToday ? 600 : 400);
      }
      if (h >= 72 && s.mode < 3) {
        const tag = d.isHoliday ? '假期' : d.school ? '在校' : '在家';
        this._text(tag, 11, y + 48, 10, C.inkMuted, 400);
      }
    }

    const X = GX + 10;
    const contentW = Math.max(110, this.width - X - rightReservedPx - 10);

    // Subtle reading-mode badge on Today / stretched days
    if (isToday && s.mode > 0 && s.mode < 3) {
      const nowTxt = `现在 ${formatHour(state.nowHour)}`;
      this._text(nowTxt, this.width - rightReservedPx - 10, y + 16, 11, C.now, 700, 'right');
    }

    // --- MODE 0: GLYPH (字形, h < 34pt) ---
    if (s.mode === 0) {
      const baseStr = d.isHoliday ? '假期 · 在家' : d.school ? d.clsGlyphs.split('').join(' ') : '在家';
      const countStr = items.length ? `  ·  ${items.length} 项` : '';
      this._text(this._fitText(baseStr + countStr, contentW, 11.5), X, y + h / 2, 11.5, C.inkSoft, 400);
      this.hitRegions.push({ kind: 'day_expand', dayIdx: d.i, x: 0, y, w: this.width, h });
      return;
    }

    // --- MODE 1: SUMMARY (概要, 34 <= h < listMinH) — whole day taps to expand (§13 #1) ---
    if (s.mode === 1) {
      const headText = d.isHoliday
        ? '假期 · 在家'
        : d.school
          ? d.clsGlyphs.split('').join('  ')
          : (isToday ? '这个周末 · 在家' : '离校在家');
      this._text(
        this._fitText(headText, contentW - (isToday ? 66 : 0), 13.5, d.school ? 500 : 400),
        X,
        y + 16,
        13.5,
        d.school ? C.ink : C.inkSoft,
        d.school ? 500 : 400,
      );

      let iy = y + 36;
      const maxPreview = Math.max(1, Math.floor((h - 32) / 20));
      const preview = items.slice(0, maxPreview);
      for (const item of preview) {
        if (iy > y + h - 8) break;
        const locked = isItemPrivateLocked(item, state.privacyLocked);
        const rel = this._isRelatedToSelected(item);
        ctx.save();
        if (hasFocus && !rel) ctx.globalAlpha = 0.24;
        const label = locked ? '· 私密记录（已锁定）' : `${this._itemSymbol(item)} ${item.title}`;
        const col = locked ? C.inkMuted : (item.kind === 'memory' ? C.mem : item.kind === 'block' ? C.now : C.ink);
        const weight = item.kind === 'exam' ? 600 : 400;
        this._text(this._fitText(label, contentW, 12.5, weight), X, iy, 12.5, col, weight);
        item._screenAnchor = { x: X + 14, y: iy, inRoll: false };
        ctx.restore();
        iy += 20;
      }
      if (items.length > preview.length && iy <= y + h - 6) {
        this._text(`+ 其余 ${items.length - preview.length} 项（点此展开）`, X, Math.min(iy, y + h - 10), 11, C.inkMuted, 400);
      }

      // Whole day is ONE tap target that expands into List mode (guaranteed >= 44pt items!)
      this.hitRegions.push({ kind: 'day_expand', dayIdx: d.i, x: 0, y, w: this.width - rightReservedPx, h });
      this._drawStretchHandle(d.i, y, h, rightReservedPx, C, isToday || d.w > 1.15);
      return;
    }

    // --- MODE 2: LIST (清单, listMinH <= h < timeMinH) — EVERY item row STRICTLY >= 44pt! ---
    if (s.mode === 2) {
      const budget = computeListRowBudget(d, h, items.length);
      let cy = y + 17;
      if (d.school) {
        this._text(this._fitText(d.clsGlyphs.split('').join('  '), contentW, 13.5, 500), X, cy, 13.5, C.ink, 500);
        this._text('在校课表（默认不可自排）', X, cy + 17, 10.5, C.inkMuted, 400);
        cy = y + budget.headerH;
      } else {
        const sub = d.isHoliday
          ? '假期 · 在家可自主安排'
          : (isToday ? '这个周末 · 离校在家' : '离校在家 · 返校前可安排');
        this._text(sub, X, cy, 12.5, isToday ? C.now : C.inkSoft, isToday ? 600 : 500);
        cy = y + budget.headerH;
      }

      const shown = items.slice(0, budget.visibleCount);
      for (const item of shown) {
        const rowTop = cy;
        const rowH = budget.rowH; // STRICTLY >= 44pt!
        const rowMid = rowTop + rowH / 2;
        const locked = isItemPrivateLocked(item, state.privacyLocked);
        const isSel = this.selectedItemId === item.id;
        const rel = this._isRelatedToSelected(item);
        const muted = item.status === 'done' || item.status === 'not_needed' || item.status === 'cancelled' || item.status === 'cancelled_by_source';

        ctx.save();
        if (hasFocus && !rel) ctx.globalAlpha = 0.22;

        // Subtle row highlight when selected or hovered
        if (isSel) {
          ctx.fillStyle = C.nowFill;
          roundRectPath(ctx, X - 6, rowTop + 3, contentW + 10, rowH - 6, 10);
          ctx.fill();
        } else if (item.kind === 'block') {
          ctx.fillStyle = C.nowFill;
          roundRectPath(ctx, X - 4, rowTop + 4, contentW + 4, rowH - 8, 8);
          ctx.fill();
          // Trace hatching inside block row!
          if (item.loggedMinutes > 0) {
            const frac = clamp(item.loggedMinutes / Math.max(15, item.durationMinutes || 60), 0.1, 1);
            this._drawTraceHatch(X - 4, rowTop + 4, (contentW + 4) * frac, rowH - 8, C.now, 0.22);
          }
        }

        // Row hairline separator
        ctx.strokeStyle = C.line;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(X, rowTop + 0.5);
        ctx.lineTo(X + contentW, rowTop + 0.5);
        ctx.stroke();

        // Status glyph
        const sym = this._itemSymbol(item);
        const symCol = locked ? C.inkMuted : (item.kind === 'memory' ? C.mem : item.kind === 'block' ? C.now : C.ink);
        this._text(sym, X + 2, rowMid - 6, 14, symCol, 600);

        // Title
        const displayTitle = locked ? '私密记录（共用手机隐私锁已开启）' : item.title;
        const titleCol = locked ? C.inkMuted : (muted ? C.inkMuted : (item.kind === 'memory' ? C.mem : C.ink));
        const titleWeight = item.kind === 'exam' ? 600 : 500;
        const titleFont = item.kind === 'memory' ? FONT_SERIF : FONT_SANS;
        const fitT = this._fitText(displayTitle, contentW - 26, 14, titleWeight, titleFont);
        this._text(fitT, X + 20, rowMid - 6, 14, titleCol, titleWeight, 'left', titleFont);

        // Strikethrough if cancelled or not_needed
        if (item.status === 'cancelled' || item.status === 'cancelled_by_source' || item.status === 'not_needed') {
          const tw = ctx.measureText(fitT).width;
          ctx.strokeStyle = C.inkMuted;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(X + 20, rowMid - 6);
          ctx.lineTo(X + 20 + tw, rowMid - 6);
          ctx.stroke();
        }

        // Honest second line: due label + epistemic / trace / status whisper
        const subBits = [];
        if (!locked) {
          if (item.dueLabel) subBits.push(item.dueLabel);
          if (item.startHour != null && item.endHour != null) {
            subBits.push(`${formatHour(item.startHour)}–${formatHour(item.endHour)}`);
          }
          if (item.loggedMinutes > 0) subBits.push(`已投入 ${item.loggedMinutes} 分钟`);
          if (item.status === 'plan_elapsed') subBits.push('已过计划期·未核实');
          else if (item.status === 'past_due_needed') subBits.push('过了截止·仍需交');
          else if (item.status === 'unknown' && d.i < this.store.nowIdx) subBits.push('软件不知道');
          else if (item.status === 'rumor') subBits.push('据传');
          else if (item.estimatedByStudent) subBits.push('我估计');
          else if (item.epistemicKind === 'personal_record' && item.kind === 'memory') subBits.push('个人记录');
        }
        if (subBits.length > 0) {
          this._text(this._fitText(subBits.join(' · '), contentW - 24, 11.5), X + 20, rowMid + 11, 11.5, C.inkSoft, 400);
        }

        item._screenAnchor = { x: X + 10, y: rowMid, inRoll: false };
        ctx.restore();

        // Register STRICT >= 44pt hit target for this item!
        this.hitRegions.push({
          kind: 'item',
          itemId: item.id,
          dayIdx: d.i,
          x: X - 6,
          y: rowTop,
          w: contentW + 10,
          h: rowH,
        });

        cy += rowH;
      }

      // Overflow row (strictly 44pt touch target! Solves Issue #1 for N >= 5)
      if (budget.overflowCount > 0) {
        const ovTop = cy;
        const ovH = 44;
        ctx.fillStyle = C.pillBg;
        roundRectPath(ctx, X, ovTop + 5, contentW, ovH - 10, 10);
        ctx.fill();
        ctx.strokeStyle = C.pillBorder;
        ctx.lineWidth = 0.9;
        ctx.stroke();
        this._text(
          `还有 ${budget.overflowCount} 项（点此拉长查看全部，每项保持 44pt）`,
          X + contentW / 2,
          ovTop + ovH / 2,
          12,
          C.now,
          500,
          'center',
        );
        this.hitRegions.push({
          kind: 'day_expand_more',
          dayIdx: d.i,
          x: X,
          y: ovTop,
          w: contentW,
          h: ovH,
        });
      }

      this._drawStretchHandle(d.i, y, h, rightReservedPx, C, true);
      return;
    }

    // --- MODE 3: HOUR-SCALE (时刻, h >= timeMinH) — 06:00–23:00 STRICT LINEAR AXIS ---
    // Separate undated items cleanly into an honest top shelf above 06:00 (NEVER fake clock hours!)
    const undated = items.filter((it) => it.startHour == null && it.dueHour == null);
    const timed = items.filter((it) => it.startHour != null || it.dueHour != null);
    const shelfH = undated.length > 0 ? Math.min(92, 24 + Math.min(2, undated.length) * 32) : 22;

    // Header / Undated Shelf
    const modeTitle = d.isHoliday
      ? '假期 · 时刻读法（06:00–23:00）'
      : d.school
        ? '在校日 · 时刻读法（左：参考课表 · 右：事件与变动）'
        : '离校在家 · 时刻读法（空白处可自主安排）';
    this._text(this._fitText(modeTitle, contentW, 11.5, 500), X, y + 12, 11.5, C.inkSoft, 500);

    if (undated.length > 0) {
      let sy = y + 26;
      const shelfShown = undated.slice(0, 2);
      for (const it of shelfShown) {
        const locked = isItemPrivateLocked(it, state.privacyLocked);
        ctx.fillStyle = it.kind === 'memory' ? C.memSoft : C.pillBg;
        roundRectPath(ctx, X, sy, contentW, 26, 7);
        ctx.fill();
        ctx.strokeStyle = C.line;
        ctx.lineWidth = 0.7;
        ctx.stroke();
        const txt = locked ? '私密记录（已锁）' : `${this._itemSymbol(it)} ${it.title} · 当天无具体时刻`;
        this._text(this._fitText(txt, contentW - 14, 11.5), X + 8, sy + 13, 11.5, locked ? C.inkMuted : (it.kind === 'memory' ? C.mem : C.ink), 500);
        it._screenAnchor = { x: X + 12, y: sy + 13, inRoll: false };
        this.hitRegions.push({ kind: 'item', itemId: it.id, dayIdx: d.i, x: X, y: sy - 6, w: contentW, h: 44 });
        sy += 30;
      }
    }

    const axisTop = Math.max(y + shelfH + 12, y + 48);
    const axisBottom = y + h - 14;
    const axisH = Math.max(180, axisBottom - axisTop);
    const timeToY = (hr) => axisTop + ((clamp(hr, 6, 23) - 6) / 17) * axisH;

    // Time Sovereignty Background Shading (Issue #4)
    const cfg = state.config;
    if (d.school) {
      // School hours subtly stone-tinted so they never read as free!
      ctx.fillStyle = C.paperSchoolTint;
      ctx.fillRect(X, timeToY(7.3), contentW, timeToY(17.9) - timeToY(7.3));
      // Evening study zone
      ctx.fillStyle = cfg.eveningStudyAllowSelfPlan ? C.nowFill : C.paperSchoolTint;
      ctx.fillRect(X, timeToY(cfg.eveningStudyStart), contentW, timeToY(cfg.eveningStudyEnd) - timeToY(cfg.eveningStudyStart));
    } else if (!d.isHoliday && d.wd === cfg.departureDay) {
      // Saturday morning before departure = unverified school lock
      ctx.fillStyle = C.paperSchoolTint;
      ctx.fillRect(X, timeToY(7.5), contentW, timeToY(cfg.departureHour) - timeToY(7.5));
      this._text(
        `离校前（${formatHour(cfg.departureHour)} ${cfg.departureVerified ? '在校' : '待核实'}）`,
        X + 8,
        timeToY(9.8),
        11,
        C.inkMuted,
        400,
      );
    } else if (!d.isHoliday && d.wd === cfg.returnDay) {
      // Sunday after return wall = campus evening
      ctx.fillStyle = C.paperSchoolTint;
      ctx.fillRect(X, timeToY(cfg.returnHour), contentW, timeToY(22.5) - timeToY(cfg.returnHour));
    }

    // Hourly hairlines & tabular clock labels (07:00..22:00)
    for (let hr = 6; hr <= 23; hr++) {
      const hy = timeToY(hr);
      ctx.strokeStyle = hr % 2 === 0 ? C.line : C.line;
      ctx.globalAlpha = hr % 2 === 0 ? 0.6 : 0.25;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(X, hy);
      ctx.lineTo(X + contentW, hy);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (hr >= 7 && hr <= 22 && (hr % 2 === 1 || axisH > 380)) {
        this._text(`${String(hr).padStart(2, '0')}:00`, GX - 6, hy, 10.5, C.inkMuted, 400, 'right');
      }
    }

    // Left half on school days: Hainan Middle School reference timetable periods
    const leftW = d.school ? contentW * 0.44 : 0;
    const rightX = d.school ? X + leftW + 6 : X;
    const rightW = d.school ? contentW - leftW - 6 : contentW;

    if (d.school) {
      const glyphs = d.clsGlyphs || '语数英物化生体自';
      const slots = cfg.periodSlots || [];
      for (let k = 0; k < slots.length; k++) {
        const sl = slots[k];
        const y0 = timeToY(sl.start);
        const y1 = timeToY(sl.end);
        const bh = Math.max(11, y1 - y0 - 1.5);
        ctx.fillStyle = sl.isEveningStudy && cfg.eveningStudyAllowSelfPlan ? C.nowFill : C.schoolBlock;
        roundRectPath(ctx, X, y0 + 0.5, leftW, bh, 4);
        ctx.fill();
        ctx.strokeStyle = C.schoolBorder;
        ctx.lineWidth = 0.6;
        ctx.stroke();

        const ch = sl.isEveningStudy
          ? (cfg.eveningStudyAllowSelfPlan ? '晚修（已开启自排）' : '晚修（待核实·不可自排）')
          : k === 0
            ? '早读'
            : `${glyphs[k - 1] || sl.label} · ${sl.label}`;
        if (bh >= 9) {
          this._text(this._fitText(ch, leftW - 8, bh < 13 ? 9.5 : 10.5), X + 5, y0 + bh / 2, bh < 13 ? 9.5 : 10.5, C.inkSoft, 500);
        }
      }
    }

    // Right half: Timed events, exams, scheduled blocks with LOCAL LANE SPLITTING (§7.1)!
    const timedBlocks = timed.filter((it) => it.startHour != null && it.endHour != null);
    const laneMap = assignLocalConflictLanes(timedBlocks);

    for (const item of timedBlocks) {
      const laneInfo = laneMap.get(item.id) || { lane: 0, laneCount: 1, isConflict: false };
      const laneW = rightW / laneInfo.laneCount;
      const bx = rightX + laneInfo.lane * laneW + (laneInfo.lane > 0 ? 3 : 0);
      const bw = laneW - (laneInfo.laneCount > 1 ? 3 : 0);
      const by0 = timeToY(item.startHour);
      const by1 = timeToY(item.endHour);
      const bh = Math.max(24, by1 - by0);

      const rel = this._isRelatedToSelected(item);
      const isSel = this.selectedItemId === item.id;
      ctx.save();
      if (hasFocus && !rel) ctx.globalAlpha = 0.22;

      if (item.kind === 'exam') {
        ctx.fillStyle = C.examBg;
        roundRectPath(ctx, bx, by0, bw, bh, 7);
        ctx.fill();
        this._text(this._fitText(item.title, bw - 10, 12, 600), bx + 6, by0 + Math.min(bh / 2, 14), 12, C.examText, 600);
      } else if (item.kind === 'block' || item.kind === 'trace_log') {
        ctx.fillStyle = C.nowFill;
        roundRectPath(ctx, bx, by0, bw, bh, 8);
        ctx.fill();
        // Diagonal Trace hatching (迹) inside scheduled block!
        if (item.loggedMinutes > 0) {
          const frac = clamp(item.loggedMinutes / Math.max(15, item.durationMinutes || 60), 0.12, 1);
          this._drawTraceHatch(bx, by0, bw * frac, bh, C.now, 0.34);
        }
        ctx.strokeStyle = isSel ? C.ink : C.nowBorder;
        ctx.lineWidth = isSel ? 1.8 : 1.2;
        roundRectPath(ctx, bx, by0, bw, bh, 8);
        ctx.stroke();

        this._text(this._fitText(item.title, bw - 10, 12, 600), bx + 7, by0 + 13, 12, C.ink, 600);
        if (bh >= 34) {
          const traceNote = item.loggedMinutes > 0 ? `已投入 ${item.loggedMinutes} 分钟（迹）` : `${formatHour(item.startHour)}–${formatHour(item.endHour)}`;
          this._text(this._fitText(traceNote, bw - 10, 10.5), bx + 7, by0 + 27, 10.5, C.now, 500);
        }
      } else {
        // Campus activity / schedule change / condensed fog occupation
        ctx.fillStyle = C.pillBg;
        roundRectPath(ctx, bx, by0, bw, bh, 7);
        ctx.fill();
        ctx.strokeStyle = isSel ? C.now : C.lineStrong;
        ctx.lineWidth = isSel ? 1.8 : 1.1;
        ctx.stroke();
        this._text(this._fitText(item.title, bw - 10, 12, 600), bx + 6, by0 + Math.min(bh / 2, 14), 12, C.ink, 600);
      }

      // Calm "重叠" badge ONLY for real mandatory Occupation × Occupation conflicts (§7.1)
      if (laneInfo.isConflict && laneInfo.lane === 0) {
        const badgeW = 36;
        ctx.fillStyle = C.pillBg;
        roundRectPath(ctx, bx + bw - badgeW - 3, by0 + 3, badgeW, 16, 8);
        ctx.fill();
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 0.9;
        ctx.stroke();
        this._text('重叠', bx + bw - badgeW / 2 - 3, by0 + 11, 9.5, C.ink, 700, 'center');
      }

      item._screenAnchor = { x: bx + 8, y: by0 + bh / 2, inRoll: false };
      ctx.restore();

      // Generous hit region (at least 44pt tall!)
      const hitH = Math.max(44, bh);
      const hitY = by0 - (hitH - bh) / 2;
      this.hitRegions.push({ kind: 'item', itemId: item.id, dayIdx: d.i, x: bx, y: hitY, w: bw, h: hitH });
    }

    // Now Line (ONLY drawn in Hour-Scale mode! Master v4 §13 #3)
    if (isToday) {
      const ny = timeToY(state.nowHour);
      ctx.strokeStyle = C.now;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(GX - 2, ny);
      ctx.lineTo(this.width - rightReservedPx - 6, ny);
      ctx.stroke();

      ctx.fillStyle = C.paper;
      ctx.beginPath();
      ctx.arc(GX, ny, 4, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = C.now;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw crisp right-aligned Now pill INSIDE hour grid so it never clips or overlaps 14:00!
      const nowLabel = `现在 ${formatHour(state.nowHour)}`;
      ctx.font = `700 10.5px ${FONT_SANS}`;
      const lw = ctx.measureText(nowLabel).width + 12;
      const lx = this.width - rightReservedPx - lw - 8;
      const ly = ny - 18;
      ctx.fillStyle = C.paper;
      roundRectPath(ctx, lx, ly, lw, 16, 8);
      ctx.fill();
      ctx.strokeStyle = C.nowBorder;
      ctx.lineWidth = 0.9;
      ctx.stroke();
      this._text(nowLabel, lx + lw / 2, ly + 8, 10.5, C.now, 700, 'center');
    }

    this._drawStretchHandle(d.i, y, h, rightReservedPx, C, true);
  }

  /** Subtle one-handed single-finger vertical stretch grip on bottom seam (§9.6) */
  _drawStretchHandle(dayIdx, y, h, rightReservedPx, C, show) {
    if (!show || h < 48) return;
    const gx = this.width - rightReservedPx - 36;
    const gy = y + h - 8;
    const ctx = this.ctx;
    ctx.strokeStyle = this.activeHandleDayIdx === dayIdx ? C.now : C.lineStrong;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(gx - 12, gy);
    ctx.lineTo(gx + 12, gy);
    ctx.stroke();
    ctx.lineCap = 'butt';

    this.hitRegions.push({
      kind: 'stretch_handle',
      dayIdx,
      x: gx - 24,
      y: gy - 14,
      w: 48,
      h: 28,
    });
  }

  /** Draw architectural 45° diagonal Trace hatching (迹) inside a clipped rectangle */
  _drawTraceHatch(x, y, w, h, color, alpha = 0.3) {
    if (w <= 1 || h <= 1) return;
    const ctx = this.ctx;
    ctx.save();
    roundRectPath(ctx, x, y, w, h, 6);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1.6;
    const step = 7;
    ctx.beginPath();
    for (let sx = x - h; sx < x + w + h; sx += step) {
      ctx.moveTo(sx, y + h);
      ctx.lineTo(sx + h, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Helper: screen vertical range [topY, bottomY] of an expanded day index */
  _dayScreenRange(dayIdx) {
    const s = this.segs.find((seg) => !seg.roll && seg.i === dayIdx);
    if (!s) return null;
    return [s.y - this.scrollOffset, s.y - this.scrollOffset + s.h, s];
  }

  /** Helper: map (dayIdx, hourFloat?) to exact screen Y (respecting Hour-Scale linearity!) */
  _wallYForDay(dayIdx, hourFloat) {
    const rng = this._dayScreenRange(dayIdx);
    if (!rng) return null;
    const [top, bot, seg] = rng;
    if (seg.mode === 3 && hourFloat != null) {
      const axisTop = top + 30;
      const axisH = Math.max(180, bot - 14 - axisTop);
      return axisTop + ((clamp(hourFloat, 6, 23) - 6) / 17) * axisH;
    }
    // Non-hour mode: anchor cleanly near bottom edge of the due day
    return bot - 4;
  }

  /** Overlay Span Brackets, Channels (槽), Walls (墙), Fog + Beads (雾+珠), and Focus Relation Threads */
  _drawTemporalOverlays(C, rightReservedPx) {
    const ctx = this.ctx;
    const state = this.store.state;
    const GX = this.width >= 420 ? 64 : 58;
    const hasFocus = Boolean(this.selectedItemId);
    const nowRng = this._dayScreenRange(this.store.nowIdx);
    const nowScreenY = nowRng ? (nowRng[0] + nowRng[1]) / 2 : this.height * 0.4;

    // 1. Multi-day Gutter Span Brackets (括线, e.g. 社团纳新报名)
    for (const sp of state.spans || []) {
      const i0 = this._isoToIdx.get(sp.fromIso);
      const i1 = this._isoToIdx.get(sp.toIso);
      if (i0 == null || i1 == null) continue;
      let top = null;
      let bot = null;
      for (let i = i0; i <= i1; i++) {
        const r = this._dayScreenRange(i);
        if (r) {
          if (top == null) top = r[0];
          bot = r[1];
        }
      }
      if (top == null || bot - top < 28) continue;
      ctx.save();
      if (hasFocus) ctx.globalAlpha = 0.25;
      ctx.strokeStyle = C.inkSoft;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(GX - 2, top + 6);
      ctx.lineTo(GX - 7, top + 6);
      ctx.lineTo(GX - 7, bot - 6);
      ctx.lineTo(GX - 2, bot - 6);
      ctx.stroke();

      // Only draw rotated vertical label if midpoint isn't sitting over an Hour-Scale day's clock column!
      const midY = (top + bot) / 2;
      const midSeg = this.segAtScreenY(midY);
      if (!midSeg || midSeg.roll || midSeg.mode < 3) {
        ctx.save();
        ctx.translate(GX - 12, midY);
        ctx.rotate(-Math.PI / 2);
        this._text(sp.title, 0, 0, 10, C.inkSoft, 500, 'center');
        ctx.restore();
      }
      ctx.restore();
    }

    // 2. Channels (槽) — high-density packed right-edge architectural grooves (Issue #2)
    const rawChannels = [];
    for (const item of this._visibleItems) {
      if (item.kind !== 'task' || !item.dueIso) continue;
      const muted = item.status === 'done' || item.status === 'not_needed' || item.status === 'cancelled_by_source';
      const startIdx = this._isoToIdx.get(item.channelStartIso || item.dateIso || state.nowIso);
      const dueIdx = this._isoToIdx.get(item.dueIso);
      if (startIdx == null || dueIdx == null) continue;

      const startRng = this._dayScreenRange(startIdx);
      const wallY = this._wallYForDay(dueIdx, item.dueHour);
      if (!startRng || wallY == null) continue;

      const y0 = Math.min(startRng[0] + 10, wallY - 14);
      const y1 = wallY;
      if (y1 < -40 || y0 > this.height + 40) continue;

      rawChannels.push({
        id: item.id,
        item,
        y0,
        y1,
        muted,
        pastDueNeeded: item.status === 'past_due_needed',
      });
    }

    const packedChannels = packTemporalChannels(rawChannels, 3, this.selectedItemId);
    const channelBaseX = this.width - 14;

    for (const ch of packedChannels.visible) {
      const cx = channelBaseX - ch.lane * 10;
      const rel = this._isRelatedToSelected(ch.item);
      const isSel = this.selectedItemId === ch.id;

      ctx.save();
      ctx.globalAlpha = hasFocus ? (rel ? 0.95 : 0.14) : (ch.muted ? 0.18 : 0.46);
      ctx.strokeStyle = isSel ? C.now : C.inkSoft;
      ctx.lineWidth = isSel ? 1.9 : 1.05;

      // Hollow vertical groove (槽): refined drafted groove stopping squarely at Wall!
      ctx.beginPath();
      ctx.moveTo(cx - 3, ch.y1);
      ctx.lineTo(cx - 3, ch.y0 + 3.5);
      ctx.arcTo(cx - 3, ch.y0, cx, ch.y0, 3);
      ctx.arcTo(cx + 3, ch.y0, cx + 3, ch.y0 + 3.5, 3);
      ctx.lineTo(cx + 3, ch.y1);
      ctx.stroke();

      // Past-Due-Still-Needed (§5.3): Channel pierces THROUGH the Wall as a dashed extension toward Now!
      if (ch.pastDueNeeded) {
        const extEnd = Math.max(ch.y1 + 52, nowScreenY);
        ctx.globalAlpha = hasFocus ? (rel ? 0.95 : 0.2) : 0.78;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(cx - 3, ch.y1 + 2);
        ctx.lineTo(cx - 3, extEnd);
        ctx.moveTo(cx + 3, ch.y1 + 2);
        ctx.lineTo(cx + 3, extEnd);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();

      // Tappable channel groove hit area
      this.hitRegions.push({
        kind: 'item',
        itemId: ch.id,
        x: cx - 10,
        y: ch.y0,
        w: 20,
        h: Math.max(44, ch.y1 - ch.y0),
      });
    }

    // Quiet overflow notch when >= 4 concurrent channels overlap (prevents Gantt clutter!)
    if (packedChannels.overflow.length > 0) {
      const oy = clamp(nowScreenY, 80, this.height - 90);
      const bx = this.width - 42;
      ctx.fillStyle = C.pillBg;
      roundRectPath(ctx, bx, oy - 11, 36, 22, 11);
      ctx.fill();
      ctx.strokeStyle = C.pillBorder;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      this._text(`+${packedChannels.overflow.length}槽`, bx + 18, oy, 10, C.inkSoft, 600, 'center');
    }

    // 3. Deadline Walls (墙) — Full-width crisp ink lines + 44pt hit zones + composite grouping (§13 #2, Issue #2)
    const rawWalls = [];
    for (const item of this._visibleItems) {
      if (item.status === 'done' || item.status === 'cancelled' || item.status === 'cancelled_by_source' || item.status === 'not_needed') continue;
      if (item.isReturnWall) {
        const idx = this._isoToIdx.get(item.dateIso);
        const wy = idx != null ? this._wallYForDay(idx, item.startHour) : null;
        if (wy != null && wy > -20 && wy < this.height + 20) {
          rawWalls.push({
            id: item.id,
            item,
            y: wy,
            isReturnWall: true,
            label: `${formatHour(item.startHour)} 返校${state.config.returnVerified ? '' : '（待核实）'}`,
          });
        }
      } else if (item.kind === 'task' && item.dueIso && item.dueLabel !== '周日返校前') {
        const idx = this._isoToIdx.get(item.dueIso);
        const wy = idx != null ? this._wallYForDay(idx, item.dueHour) : null;
        if (wy != null && wy > -20 && wy < this.height + 20) {
          const shortT = item.title.replace(/（.*）/, '').slice(0, 6);
          rawWalls.push({
            id: item.id,
            item,
            y: wy,
            isReturnWall: false,
            label: `${item.dueLabel || '截止'} · ${shortT}`,
          });
        }
      } else if (item.kind === 'task' && item.dueLabel === '周日返校前') {
        // Group weekend return-deadline tasks visually onto the Return Wall!
        const idx = this._isoToIdx.get(item.dueIso);
        const wy = idx != null ? this._wallYForDay(idx, item.dueHour) : null;
        if (wy != null && wy > -20 && wy < this.height + 20) {
          rawWalls.push({
            id: item.id,
            item,
            y: wy,
            isReturnWall: true,
            isWeekendTaskDue: true,
            label: item.title,
          });
        }
      }
    }

    const wallGroups = groupDeadlineWalls(rawWalls, 24);
    for (const grp of wallGroups) {
      const wy = grp.y;
      const rel = grp.items.some((w) => this._isRelatedToSelected(w.item));
      ctx.save();
      if (hasFocus && !rel) ctx.globalAlpha = 0.22;

      // Full-width 2.5px architectural Wall line
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = grp.isReturnWall ? 2.6 : 2.1;
      ctx.beginPath();
      ctx.moveTo(GX, wy);
      ctx.lineTo(this.width - 8, wy);
      ctx.stroke();

      // Subtle architectural end-cap ticks
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(GX, wy - 4);
      ctx.lineTo(GX, wy + 4);
      ctx.moveTo(this.width - 8, wy - 4);
      ctx.lineTo(this.width - 8, wy + 4);
      ctx.stroke();

      // Composite non-overlapping label pill
      const returnWallEntry = grp.items.find((w) => w.item.isReturnWall);
      const taskCount = grp.items.filter((w) => w.isWeekendTaskDue).length;
      let pillText;
      if (returnWallEntry) {
        pillText = taskCount > 0
          ? `${returnWallEntry.label} · ${taskCount} 项待交`
          : returnWallEntry.label;
      } else if (grp.items.length > 1) {
        pillText = `${grp.items.length} 项截止 · ${grp.items[0].item.dueLabel || ''}`;
      } else {
        pillText = grp.items[0].label;
      }

      ctx.font = `600 10.5px ${FONT_SANS}`;
      const maxPillW = grp.isReturnWall ? Math.min(this.width - GX - 48, 220) : Math.min(this.width - GX - 120, 152);
      const pillW = Math.min(maxPillW, ctx.measureText(pillText).width + 14);
      const px = this.width - rightReservedPx - pillW - 4;
      const py = wy - 16;

      ctx.fillStyle = C.pillBg;
      roundRectPath(ctx, px, py, pillW, 16, 8);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 0.9;
      ctx.stroke();
      this._text(this._fitText(pillText, pillW - 10, 10.5, 600), px + pillW / 2, py + 8, 10.5, C.ink, 600, 'center');
      ctx.restore();

      // Anchor update & generous 44pt hit zone (±22pt vertically around the wall! §13 #2)
      const primaryWall = returnWallEntry || grp.items[0];
      primaryWall.item._screenAnchor = { x: px + 8, y: wy, inRoll: false };
      this.hitRegions.push({
        kind: returnWallEntry ? 'return_wall' : 'item',
        itemId: primaryWall.id,
        x: GX,
        y: wy - 22,
        w: this.width - GX,
        h: 44,
      });
    }

    // 4. Fog Veils (雾) + Duration Beads (珠) — Feathered Gschwandtner Gradient + High-Density Packing!
    const rawFogs = [];
    for (const item of this._visibleItems) {
      if (item.form !== 'fog' && item.form !== 'day_fog') continue;
      if (item.status === 'cancelled' || item.status === 'done') continue;
      const fromIdx = this._isoToIdx.get(item.fogFromIso || item.dateIso);
      const toIdx = this._isoToIdx.get(item.fogToIso || item.dateIso || item.fogFromIso);
      if (fromIdx == null || toIdx == null) continue;

      let top = null;
      let bot = null;
      for (let i = fromIdx; i <= toIdx; i++) {
        const r = this._dayScreenRange(i);
        if (r) {
          if (top == null) top = r[0];
          bot = r[1];
        }
      }
      if (top == null || bot == null || bot < -30 || top > this.height + 30) continue;
      if (bot - top < 24) continue;

      rawFogs.push({
        id: item.id,
        item,
        y0: top + 3,
        y1: bot - 3,
        midY: clamp((top + bot) / 2, Math.max(top + 22, 32), Math.min(bot - 22, this.height - 32)),
      });
    }

    // On narrow phone widths with 3+ overlapping Fogs, cap to 1 crisp atmospheric lane + clean cluster pill (Issue #2!)
    const maxFogLanes = (this.width < 430 && rawFogs.length >= 3) ? 1 : 2;
    const packedFogs = packFogVeils(rawFogs, maxFogLanes, this.selectedItemId);
    const fogStripRight = this.width - Math.max(18, packedChannels.laneCount * 10 + 14);
    const anyHourScaleVisible = this.segs.some((s) => !s.roll && s.mode === 3 && (s.y - this.scrollOffset + s.h) > 0 && (s.y - this.scrollOffset) < this.height);

    // Collect active wall Y positions so Fog labels & cluster pills automatically dodge Wall pills!
    const wallYs = wallGroups.map((g) => g.y);
    const dodgeWalls = (targetY, minY, maxY) => {
      let y = targetY;
      for (const wy of wallYs) {
        if (Math.abs(y - (wy - 10)) < 26) {
          y = (y <= wy - 10) ? Math.max(minY, wy - 38) : Math.min(maxY, wy + 24);
        }
      }
      return clamp(y, minY, maxY);
    };

    for (const fg of packedFogs.visible) {
      const item = fg.item;
      const isDragging = this.draggingFog && this.draggingFog.item.id === item.id;
      const isDayCondensed = item.form === 'day_fog';
      // When an Hour-Scale day is active on screen, tuck multi-day fog softly to the right atmospheric margin so it NEVER blocks timed blocks!
      const veilW = anyHourScaleVisible && !isDragging
        ? 68
        : (isDayCondensed ? 102 : (packedFogs.laneCount > 1 ? 82 : 98));
      const x1 = fogStripRight - fg.lane * (veilW + 5);
      const x0 = Math.max(GX + 110, x1 - veilW);
      const y0 = isDragging ? this.draggingFog.screenY - 26 : fg.y0;
      const y1 = isDragging ? this.draggingFog.screenY + 26 : fg.y1;
      const labelY = isDragging ? this.draggingFog.screenY : dodgeWalls(fg.labelY, y0 + 20, y1 - 20);

      const rel = this._isRelatedToSelected(item);
      const isSel = this.selectedItemId === item.id;

      ctx.save();
      if (hasFocus && !rel) ctx.globalAlpha = 0.18;
      else if (anyHourScaleVisible && !isSel && !isDragging) ctx.globalAlpha = 0.62;

      // Softly feathered atmospheric veil (雾) — vertical + horizontal edge dissolution
      const vGrad = ctx.createLinearGradient(0, y0, 0, y1);
      if (isDayCondensed) {
        vGrad.addColorStop(0, 'transparent');
        vGrad.addColorStop(0.15, C.fogFill);
        vGrad.addColorStop(0.85, C.fogFill);
        vGrad.addColorStop(1, 'transparent');
      } else {
        vGrad.addColorStop(0, 'transparent');
        vGrad.addColorStop(0.22, C.fogFill);
        vGrad.addColorStop(0.78, C.fogFill);
        vGrad.addColorStop(1, 'transparent');
      }
      ctx.fillStyle = vGrad;
      roundRectPath(ctx, x0, y0, x1 - x0, Math.max(32, y1 - y0), isDayCondensed ? 12 : 20);
      ctx.fill();

      if (isSel || isDragging) {
        ctx.strokeStyle = C.fog;
        ctx.lineWidth = 1.3;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Duration Bead (珠): height proportional to actual durationMinutes! (§5)
      const durMins = item.durationMinutes || 40;
      const beadH = clamp(14 + (durMins / 90) * 26, 16, 44);
      const beadX = x1 - 12;
      const beadY = labelY - beadH / 2;
      ctx.fillStyle = C.fog;
      roundRectPath(ctx, beadX, beadY, 7, beadH, 3.5);
      ctx.fill();

      // Label inside veil (staggered so overlapping Fogs NEVER collide!)
      const titleMaxW = Math.max(46, x1 - x0 - 20);
      this._text(this._fitText(item.title, titleMaxW, 12, 600), beadX - 6, labelY - 7, 12, C.ink, 600, 'right');
      const subTxt = isDragging
        ? '拖到某天松手凝聚'
        : item.needsAnchorDateQuestion
          ? '缺原发日·点此确认'
          : isDayCondensed
            ? `${item.estimatedByStudent ? '我估计' : '当天'}·约${durMins}分`
            : `时间待定·约${durMins}分`;
      this._text(this._fitText(subTxt, titleMaxW, 10), beadX - 6, labelY + 8, 10, C.fog, 500, 'right');

      item._screenAnchor = { x: (x0 + x1) / 2, y: labelY, inRoll: false };
      ctx.restore();

      // Generous draggable + tappable hit box
      this.hitRegions.push({
        kind: 'fog',
        itemId: item.id,
        x: x0 - 4,
        y: Math.min(y0, labelY - 24),
        w: (x1 - x0) + 8,
        h: Math.max(48, y1 - y0),
      });
    }

    // Clustered excess overlapping Fogs under extreme density (Issue #2 — dodges Wall pills cleanly!)
    if (packedFogs.clustered.length > 0) {
      const first = packedFogs.clustered[0];
      const baseCy = clamp(first.midY + 46, 68, this.height - 84);
      const cy = dodgeWalls(baseCy, 68, this.height - 84);
      const cw = 114;
      const cx = fogStripRight - cw;
      ctx.fillStyle = C.pillBg;
      roundRectPath(ctx, cx, cy - 16, cw, 32, 16);
      ctx.fill();
      ctx.strokeStyle = C.fog;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
      this._text(`+${packedFogs.clustered.length} 项待定雾 · 查看`, cx + cw / 2, cy, 10.5, C.fog, 600, 'center');
      this.hitRegions.push({
        kind: 'fog_cluster',
        items: packedFogs.clustered.map((x) => x.item.id),
        x: cx,
        y: cy - 22,
        w: cw,
        h: 44,
      });
    }

    // 5. Focus Yield Relation Threads (让位关系线 — terminating cleanly on annual-ring markers! §7.3)
    if (this.selectedItemId) {
      const sel = state.items.find((x) => x.id === this.selectedItemId);
      if (sel) {
        const src = this._locateItemAnchor(sel);
        if (src) {
          const peers = this._visibleItems.filter((it) => it.id !== sel.id && this._isRelatedToSelected(it));
          for (const peer of peers) {
            const dst = this._locateItemAnchor(peer);
            if (!dst) continue;
            ctx.save();
            ctx.strokeStyle = C.now;
            ctx.lineWidth = 1.6;
            ctx.setLineDash([4, 4]);
            const ctrlX = Math.max(GX + 10, Math.min(src.x, dst.x) - 44);
            ctx.beginPath();
            ctx.moveTo(src.x, src.y);
            ctx.bezierCurveTo(ctrlX, src.y, ctrlX, dst.y, dst.x, dst.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Highlight destination ring marker if the related event is inside a rolled cylinder!
            if (dst.inRoll) {
              ctx.fillStyle = C.now;
              ctx.beginPath();
              ctx.arc(dst.x, dst.y, 4.2, 0, TAU);
              ctx.fill();
              ctx.strokeStyle = C.paper;
              ctx.lineWidth = 1.5;
              ctx.stroke();
            }
            ctx.restore();
          }
        }
      }
    }

    // 6. Newly imported item fly-in ripple (§9.4 spatial continuity)
    const nowMs = Date.now();
    for (const item of this._visibleItems) {
      if (!item.flyInAt) continue;
      const age = nowMs - item.flyInAt;
      if (age > 1100 || this.reducedMotion) {
        item.flyInAt = null;
        continue;
      }
      const anc = this._locateItemAnchor(item);
      if (!anc) continue;
      const p = age / 1100;
      ctx.save();
      ctx.strokeStyle = C.now;
      ctx.globalAlpha = (1 - p) * 0.7;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(anc.x, anc.y, 8 + p * 36, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  _itemSymbol(item) {
    if (item.kind === 'exam') return '◉';
    if (item.kind === 'memory') return '◆';
    if (item.kind === 'block') return '▪';
    if (item.kind === 'change') return '↻';
    if (item.kind === 'companion') return '◇';
    if (item.kind === 'trace_log') return '▤';
    if (item.kind === 'task') return getTaskStatusMeta(item.status).symbol;
    return '·';
  }

  draw() {
    if (!this.width || !this.height) return;
    this.recomputeLayout();
    this.clampScroll();

    const ctx = this.ctx;
    const C = this.getPalette();
    this.hitRegions = [];
    this.rollHitBoxes = [];

    // Reset transient screen anchors
    for (const item of this.store.state.items) item._screenAnchor = null;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, this.width, this.height);

    // Reserve clean right margin for Channels (槽) so text never collides
    const rightReservedPx = 38;

    // 1. Draw expanded days first
    for (const s of this.segs) {
      if (!s.roll) this._drawDaySegment(s, C, rightReservedPx);
    }

    // 2. Draw temporal overlays (brackets, channels, walls, fog+beads, focus threads)
    this._drawTemporalOverlays(C, rightReservedPx);

    // 3. Draw rolled cylinders & annual-ring end-faces ON TOP so paper naturally tucks under rolls!
    for (const s of this.segs) {
      if (s.roll) this._drawRollSegment(s, C);
    }
  }
}
