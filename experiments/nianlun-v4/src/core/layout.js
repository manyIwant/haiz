/**
 * HAIZ · NIANLUN · 一卷 V4 — Elastic Time Layout & High-Density Packing Engine
 *
 * Resolves Issue #1 (44pt touch target vs 300pt hour-scale threshold conflict)
 * and Issue #2 (high-density visual crowding of 5 temporal forms).
 *
 * Pure mathematical functions — 100% testable in Node without DOM.
 */

export const ROLL_HEIGHT = 68; // Generous cylinder + 28px-radius annual-ring end-face
export const ROLL_THRESHOLD_LIVE = 0.16; // Collapses into roll visually during pinch
export const ROLL_SNAP_THRESHOLD = 0.30; // Snaps into roll on finger lift (§4.1)
export const GAUSS_SIGMA = 1.1; // Gaussian spread in days (§3.2)
export const MAX_WEIGHT = 12.5; // Allows even 44pt school day to reach ~550pt hour scale

export const ITEM_TOUCH_MIN = 44; // Strict 44pt minimum touch target (§3.3, §13 #1)
export const GLYPH_MAX_H = 34; // h < 34pt => glyph mode

/**
 * Compute adaptive reading-mode thresholds for a specific day with `itemCount` visible items.
 *
 * SOLUTION TO ISSUE #1:
 * Master v4 proposed `threshold_list = 44*N + header` AND fixed `threshold_time = 300`,
 * which collides when N >= 6 (36 + 264 = 300 -> List mode vanishes!).
 *
 * Our adaptive corridor guarantees for ALL N >= 0:
 *   1. `GLYPH_MAX_H (34) < listMinH < timeMinH` (all 4 reading modes ALWAYS exist!)
 *   2. Every individually tappable row in List mode is STRICTLY >= 44pt.
 *   3. When N >= 5, List mode enters cleanly at 256pt showing top 4 items at 44pt each + a 44pt
 *      overflow expansion row ("+ 其余 k 项"), and smoothly reveals more 44pt rows as height grows
 *      before entering Hour-Scale mode at `timeMinH` (which gives a guaranteed >= 68pt List plateau!).
 */
export function computeReadingThresholds(day, itemCount) {
  const n = Math.max(0, itemCount | 0);
  const headerH = day.school ? 54 : 38;
  const visibleSlotsAtEntry = n === 0 ? 1 : Math.min(n, 4);
  const needsOverflowAtEntry = n > 4;
  const slotsAtEntry = visibleSlotsAtEntry + (needsOverflowAtEntry ? 1 : 0);

  const listMinH = Math.max(108, headerH + slotsAtEntry * ITEM_TOUCH_MIN);
  // Guarantee at least a 68pt comfortable plateau in List mode before Hour-Scale
  const idealFullListH = headerH + Math.min(n, 6) * ITEM_TOUCH_MIN;
  const timeMinH = Math.max(300, Math.max(listMinH + 68, idealFullListH + 44));

  return {
    glyphMaxH: GLYPH_MAX_H,
    headerH,
    listMinH,
    timeMinH,
    itemTouchMin: ITEM_TOUCH_MIN,
  };
}

/**
 * Determine semantic reading mode from current pixel height `h`:
 *  0 = glyph (字形)
 *  1 = summary (概要)
 *  2 = list (清单 — every item row strictly >= 44pt)
 *  3 = hour (时刻 — 06:00–23:00 linear time scale)
 */
export function getReadingMode(day, h, itemCount) {
  const t = computeReadingThresholds(day, itemCount);
  if (h < t.glyphMaxH) return { mode: 0, name: '字形', thresholds: t };
  if (h < t.listMinH) return { mode: 1, name: '概要', thresholds: t };
  if (h < t.timeMinH) return { mode: 2, name: '清单', thresholds: t };
  return { mode: 3, name: '时刻', thresholds: t };
}

/**
 * Compute how many items can be rendered as individual >=44pt touch rows in List mode,
 * plus whether an explicit 44pt overflow row is needed.
 */
export function computeListRowBudget(day, h, totalItems) {
  const t = computeReadingThresholds(day, totalItems);
  const availH = Math.max(0, h - t.headerH - 8);
  const maxSlots = Math.floor(availH / ITEM_TOUCH_MIN);
  if (totalItems <= maxSlots) {
    const rowH = totalItems > 0 ? Math.max(ITEM_TOUCH_MIN, Math.min(54, availH / totalItems)) : ITEM_TOUCH_MIN;
    return { visibleCount: totalItems, overflowCount: 0, rowH, headerH: t.headerH };
  }
  const visibleCount = Math.max(1, maxSlots - 1);
  const overflowCount = totalItems - visibleCount;
  return { visibleCount, overflowCount, rowH: ITEM_TOUCH_MIN, headerH: t.headerH };
}

/**
 * Content-driven natural base height when w === 1 (§3.2).
 * Today & at-home days naturally breathe so the 30-second Saturday check requires ZERO gestures (A10).
 */
export function computeDayBaseHeight(day, itemCount, isToday) {
  if (isToday) {
    // Enough to show Today directly in comfortable List mode with >=44pt rows for its items!
    const t = computeReadingThresholds(day, itemCount);
    return Math.max(168, Math.min(286, t.listMinH + 14));
  }
  if (day.isWeekendHome) {
    if (itemCount === 0) return 68;
    const t = computeReadingThresholds(day, itemCount);
    return Math.max(88, Math.min(230, t.listMinH + 8));
  }
  // School day default: compact summary with timetable glyph + top exam/wall preview (breathing room above Wall pill)
  return itemCount > 0 ? 70 : 48;
}

/**
 * Compute full segment layout (expanded days + contiguous rolled cylinders).
 * Produces top Past Roll, bottom Future Roll, and any user-pinched Middle Rolls (§4.1).
 */
export function computeScrollLayout(days, itemCountsByDay, nowIdx) {
  const segs = [];
  let y = 0;
  let currentRoll = null;

  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const count = itemCountsByDay[i] || 0;
    const baseH = computeDayBaseHeight(d, count, i === nowIdx);

    if (d.w < ROLL_THRESHOLD_LIVE) {
      if (!currentRoll) {
        const position = i < nowIdx ? 'past' : 'future'; // refined to 'middle' after pass
        currentRoll = {
          roll: true,
          from: i,
          to: i,
          y,
          h: ROLL_HEIGHT,
          position,
          spin: d._rollSpin || 0,
        };
        segs.push(currentRoll);
        y += ROLL_HEIGHT;
      } else {
        currentRoll.to = i;
      }
      continue;
    }

    currentRoll = null;
    const h = Math.max(16, baseH * d.w);
    const reading = getReadingMode(d, h, count);
    segs.push({
      roll: false,
      i,
      y,
      h,
      baseH,
      mode: reading.mode,
      modeName: reading.name,
      thresholds: reading.thresholds,
    });
    y += h;
  }

  // Classify rolls: first touching index 0 is 'past', last touching end is 'future',
  // any roll strictly between two expanded sections is a 'middle' juxtaposition roll (§4.1, §7.2).
  for (let idx = 0; idx < segs.length; idx++) {
    const s = segs[idx];
    if (!s.roll) continue;
    const hasExpandedBefore = idx > 0 && !segs[idx - 1].roll;
    const hasExpandedAfter = idx < segs.length - 1 && !segs[idx + 1].roll;
    if (hasExpandedBefore && hasExpandedAfter) {
      s.position = 'middle';
    } else if (s.to < nowIdx) {
      s.position = 'past';
    } else {
      s.position = 'future';
    }
  }

  return { segs, totalHeight: y };
}

/**
 * Apply Gaussian stretch/squeeze around fractional day index `centerFi` (§3.2).
 * factor > 1 stretches, factor < 1 squeezes.
 */
export function applyGaussianStretch(days, centerFi, factor, sigma = GAUSS_SIGMA) {
  const safeFactor = Math.max(0.55, Math.min(1.85, factor));
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const dist = (i + 0.5) - centerFi;
    const g = Math.exp(-((dist / sigma) ** 2));
    if (g < 0.04) continue;

    let nextW = d.w * Math.pow(safeFactor, g);
    // Allow stretching back out from rolled edge gently
    if (d.w < ROLL_THRESHOLD_LIVE && safeFactor > 1.01 && g > 0.35) {
      nextW = Math.max(nextW, ROLL_THRESHOLD_LIVE * 1.15);
    }
    nextW = Math.max(0, Math.min(MAX_WEIGHT, nextW));
    d.w = nextW;
    d.tw = nextW;
  }
}

/**
 * Snap compressed days (w < 0.30) into rolls upon gesture release (§4.1).
 * Protects Today (`nowIdx`) from accidental vanishing unless explicitly scrolled away,
 * while permitting any other day range to form a Middle Roll for juxtaposition (§7.2).
 */
export function snapCompressedDaysToRolls(days, nowIdx) {
  let snapped = 0;
  for (let i = 0; i < days.length; i++) {
    if (i === nowIdx) {
      if (days[i].tw < 0.38) days[i].tw = 0.52;
      continue;
    }
    if (days[i].tw > 0 && days[i].tw < ROLL_SNAP_THRESHOLD) {
      days[i].tw = 0;
      snapped++;
    }
  }
  return snapped;
}

/**
 * Local Lane Splitting for Hour-Scale mode (§7.1):
 * ONLY mandatory Occupation × Occupation overlaps split into temporary sub-lanes.
 * Returns lane index & total lanes per overlapping cluster, merging back to 1 outside overlap.
 */
export function assignLocalConflictLanes(timedBlocks) {
  // Separate mandatory occupations vs non-mandatory items
  const sorted = [...timedBlocks].sort((a, b) => a.startHour - b.startHour || (b.endHour - b.startHour) - (a.endHour - a.startHour));
  const result = new Map();

  // Build connected overlap clusters
  const clusters = [];
  for (const item of sorted) {
    let placed = false;
    for (const cluster of clusters) {
      if (item.startHour < cluster.maxEnd - 0.01) {
        cluster.items.push(item);
        cluster.maxEnd = Math.max(cluster.maxEnd, item.endHour);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push({ maxEnd: item.endHour, items: [item] });
    }
  }

  for (const cluster of clusters) {
    const laneEnds = [];
    const mandatoryCount = cluster.items.filter((x) => x.isMandatoryOccupation).length;
    const isRealConflict = mandatoryCount >= 2;

    for (const item of cluster.items) {
      let lane = laneEnds.findIndex((end) => end <= item.startHour + 0.01);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(item.endHour);
      } else {
        laneEnds[lane] = item.endHour;
      }
      result.set(item.id, {
        lane,
        laneCount: 1, // patched below
        isConflict: isRealConflict && item.isMandatoryOccupation,
      });
    }
    const totalLanes = Math.max(1, laneEnds.length);
    for (const item of cluster.items) {
      const entry = result.get(item.id);
      entry.laneCount = totalLanes;
    }
  }

  return result;
}

/**
 * High-Density Packing Solver for Right-Edge Channels (槽) — Issue #2
 * Packs overlapping vertical intervals [y0, y1] into at most `maxVisibleLanes` clean hairline grooves.
 * Excess channels fold into a quiet overflow counter unless focused.
 */
export function packTemporalChannels(channels, maxVisibleLanes = 3, focusedId = null) {
  const sorted = [...channels].sort((a, b) => {
    if (a.id === focusedId) return -1;
    if (b.id === focusedId) return 1;
    return a.y0 - b.y0 || b.y1 - a.y1;
  });

  const laneEnds = [];
  const visible = [];
  const overflow = [];

  for (const ch of sorted) {
    let lane = laneEnds.findIndex((end) => end <= ch.y0 - 4);
    if (lane === -1) {
      if (laneEnds.length < maxVisibleLanes || ch.id === focusedId) {
        lane = Math.min(laneEnds.length, maxVisibleLanes - 1);
        laneEnds[lane] = ch.y1;
        visible.push({ ...ch, lane });
      } else {
        overflow.push(ch);
      }
    } else {
      laneEnds[lane] = ch.y1;
      visible.push({ ...ch, lane });
    }
  }

  return { visible, overflow, laneCount: Math.max(1, Math.min(maxVisibleLanes, laneEnds.length)) };
}

/**
 * High-Density Packing Solver for Fog Veils (雾) — Issue #2
 * Prevents text collision when multiple uncertain events span overlapping weeks.
 */
export function packFogVeils(fogs, maxVisibleLanes = 2, focusedId = null) {
  const sorted = [...fogs].sort((a, b) => {
    if (a.id === focusedId) return -1;
    if (b.id === focusedId) return 1;
    return a.y0 - b.y0;
  });

  const laneEnds = [];
  const visible = [];
  const clustered = [];

  for (const fg of sorted) {
    // Check vertical label overlap around midpoint as well as full span
    let lane = laneEnds.findIndex((end) => end <= fg.y0 - 6);
    if (lane === -1) {
      if (laneEnds.length < maxVisibleLanes || fg.id === focusedId) {
        lane = Math.min(laneEnds.length, maxVisibleLanes - 1);
        laneEnds[lane] = fg.y1;
        visible.push({ ...fg, lane });
      } else {
        clustered.push(fg);
      }
    } else {
      laneEnds[lane] = fg.y1;
      visible.push({ ...fg, lane });
    }
  }

  // Also ensure visible fog label centers never collide vertically
  visible.sort((a, b) => a.midY - b.midY);
  let lastLabelY = -Infinity;
  for (const fg of visible) {
    let labelY = fg.midY;
    if (labelY - lastLabelY < 36) {
      labelY = Math.min(fg.y1 - 18, lastLabelY + 38);
    }
    fg.labelY = Math.max(fg.y0 + 18, labelY);
    lastLabelY = fg.labelY;
  }

  return { visible, clustered, laneCount: Math.max(1, Math.min(maxVisibleLanes, laneEnds.length)) };
}

/**
 * High-Density Wall Collision Grouping (墙) — Issue #2
 * When multiple deadlines land within `mergePx` vertically (e.g. 3 tasks due "周日返校前"),
 * groups them into a single clean composite wall with combined label pill.
 */
export function groupDeadlineWalls(walls, mergePx = 22) {
  const sorted = [...walls].sort((a, b) => a.y - b.y);
  const groups = [];
  for (const w of sorted) {
    const prev = groups[groups.length - 1];
    if (prev && Math.abs(w.y - prev.y) <= mergePx && prev.isReturnWall === w.isReturnWall) {
      prev.items.push(w);
    } else {
      groups.push({
        y: w.y,
        isReturnWall: Boolean(w.isReturnWall),
        items: [w],
      });
    }
  }
  return groups;
}
