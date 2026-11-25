/**
 * NIANLUN · Chronoscope — Event, Recurrence & Memory Engine
 *
 * Clearly distinguishes:
 * - 'history': Curated historical / astronomical milestones (labelled as such)
 * - 'sample':  Illustrative personal schedule & creative logs (labelled 「示例」)
 * - 'user':    User-created events persisted in localStorage
 */

import { getObserverLocalParts, makeUtcFromObserverLocal, daysInMonth } from './astro.js';

const STORAGE_KEY = 'nianlun-chronoscope-events-v1';

export const EVENT_CATEGORIES = [
  { id: 'focus',   label: '专注 · 研习', color: '#D4A359' },
  { id: 'rhythm',  label: '日常 · 节律', color: '#9BB865' },
  { id: 'memory',  label: '记忆 · 留痕', color: '#7EA2C4' },
  { id: 'history', label: '历史 · 纪年', color: '#C87944' },
];

export const RECURRENCE_OPTIONS = [
  { id: 'none',    label: '单次' },
  { id: 'daily',   label: '每日' },
  { id: 'weekly',  label: '每周' },
  { id: 'monthly', label: '每月' },
  { id: 'yearly',  label: '每年' },
];

export const BUILTIN_EVENTS = [
  // Sample schedule around 2026-11-25 (current era)
  {
    id: 'smp-morning-walk',
    title: '晨光观察 · 环校步测',
    category: 'rhythm',
    source: 'sample',
    date: '2026-11-01',
    startMin: 6 * 60 + 45,
    endMin: 7 * 60 + 30,
    recurrence: 'daily',
    note: '日出前后绕榄仁树记录风向与晨光角度。',
  },
  {
    id: 'smp-studio-crit',
    title: '极坐标界面设计工坊',
    category: 'focus',
    source: 'sample',
    date: '2026-11-25',
    startMin: 9 * 60 + 30,
    endMin: 11 * 60 + 45,
    recurrence: 'weekly',
    note: '每周三上午 · 讨论多尺度时间仪与拇指象限交互。',
  },
  {
    id: 'smp-noon-reading',
    title: '午间静读 · 《时间的秩序》',
    category: 'focus',
    source: 'sample',
    date: '2026-11-25',
    startMin: 13 * 60 + 30,
    endMin: 14 * 60 + 45,
    recurrence: 'none',
    note: '第 4 章：在热力学与记忆之间理解不可逆性。',
  },
  {
    id: 'smp-dusk-sketch',
    title: '暮色写生 · 光影弧线',
    category: 'memory',
    source: 'sample',
    date: '2026-11-25',
    startMin: 17 * 60 + 15,
    endMin: 18 * 60 + 30,
    recurrence: 'none',
    note: '日落前 30 分钟，记录天顶由金转靛的渐变。',
  },
  {
    id: 'smp-night-log',
    title: '夜间复盘 · 归档当日轨迹',
    category: 'rhythm',
    source: 'sample',
    date: '2026-11-10',
    startMin: 21 * 60 + 30,
    endMin: 22 * 60 + 15,
    recurrence: 'daily',
    note: '每日睡前将当天的零碎笔记折叠入年轮。',
  },
  {
    id: 'smp-monthly-moon',
    title: '月相观测与胶片显影',
    category: 'memory',
    source: 'sample',
    date: '2026-11-15',
    startMin: 20 * 60,
    endMin: 21 * 60 + 30,
    recurrence: 'monthly',
    note: '每月 15 日固定检查月相与暗房显影记录。',
  },
  {
    id: 'smp-friday-music',
    title: '周五夜听 · 极简主义循环曲',
    category: 'memory',
    source: 'sample',
    date: '2026-11-27',
    startMin: 20 * 60 + 30,
    endMin: 22 * 60,
    recurrence: 'weekly',
    note: '每周五晚的相位音乐实验。',
  },
  {
    id: 'smp-dec-review',
    title: '冬至年度年轮封存',
    category: 'focus',
    source: 'sample',
    date: '2026-12-21',
    startMin: 16 * 60,
    endMin: 18 * 60,
    recurrence: 'yearly',
    note: '每年冬至整理全年最深的三道生长纹。',
  },
  // Curated Historical & HAIZ Milestones
  {
    id: 'hist-haiz-1923',
    title: '海口榄仁树 · 建校纪年原点',
    category: 'history',
    source: 'history',
    date: '1923-10-15',
    startMin: 9 * 60,
    endMin: 11 * 60,
    recurrence: 'yearly',
    note: 'HAIZ 年轮系统的空间与时间原点（圆心）。',
  },
  {
    id: 'hist-apollo-1969',
    title: '阿波罗 11 号登月',
    category: 'history',
    source: 'history',
    date: '1969-07-20',
    startMin: 20 * 60 + 17,
    endMin: 22 * 60,
    recurrence: 'none',
    note: 'UTC 20:17 · 人类首次踏上另一颗天体。',
  },
  {
    id: 'hist-typhoon-2014',
    title: '超强台风「威马逊」登陆海南',
    category: 'history',
    source: 'history',
    date: '2014-07-18',
    startMin: 14 * 60,
    endMin: 17 * 60,
    recurrence: 'none',
    note: 'HAIZ 历史气象年轮记录的极端台风日（日雨量 211mm）。',
  },
  {
    id: 'hist-eclipse-2024',
    title: '北美日全食（朔月校验点）',
    category: 'history',
    source: 'history',
    date: '2024-04-08',
    startMin: 18 * 60,
    endMin: 19 * 60 + 30,
    recurrence: 'none',
    note: '天文星历新月校验锚点。',
  },
  {
    id: 'hist-rings-2026',
    title: 'NIANLUN · 时间仪实验启动',
    category: 'history',
    source: 'history',
    date: '2026-11-25',
    startMin: 5 * 60 + 30,
    endMin: 7 * 60,
    recurrence: 'none',
    note: '从第一代年轮走向连续多尺度极坐标仪器。',
  },
];

export function parseIsoDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y, month: m, day: d };
}

export function loadAllEvents() {
  let userEvents = [];
  let hiddenIds = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.userEvents)) userEvents = parsed.userEvents;
      if (Array.isArray(parsed.hiddenIds)) hiddenIds = parsed.hiddenIds;
    }
  } catch {
    // ignore storage errors in restricted environments
  }

  const hiddenSet = new Set(hiddenIds);
  const map = new Map();
  for (const ev of BUILTIN_EVENTS) {
    if (!hiddenSet.has(ev.id)) map.set(ev.id, { ...ev });
  }
  for (const ev of userEvents) {
    map.set(ev.id, { ...ev, source: ev.source || 'user' });
  }
  return Array.from(map.values());
}

export function saveEventState(allEvents, hiddenIds = []) {
  const userEvents = allEvents.filter((e) => e.source === 'user' || BUILTIN_EVENTS.some((b) => b.id === e.id && e.edited));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ userEvents, hiddenIds }));
  } catch {
    // ignore
  }
}

export function getHiddenIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.hiddenIds) ? parsed.hiddenIds : [];
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Check if an event occurs on a specific (year, month, day) in observer's calendar.
 */
export function occursOnDate(ev, year, month, day, tzHours = 8) {
  const base = parseIsoDate(ev.date);
  if (year < base.year) return false;
  if (year === base.year && month < base.month) return false;
  if (year === base.year && month === base.month && day < base.day) return false;

  if (ev.recurrence === 'none') {
    return base.year === year && base.month === month && base.day === day;
  }
  if (ev.recurrence === 'daily') {
    return true;
  }
  if (ev.recurrence === 'weekly') {
    const baseUtc = makeUtcFromObserverLocal(base.year, base.month, base.day, 12, 0, 0, tzHours);
    const targetUtc = makeUtcFromObserverLocal(year, month, day, 12, 0, 0, tzHours);
    const baseWd = getObserverLocalParts(baseUtc, tzHours).weekday;
    const targetWd = getObserverLocalParts(targetUtc, tzHours).weekday;
    return baseWd === targetWd;
  }
  if (ev.recurrence === 'monthly') {
    const maxD = daysInMonth(year, month);
    const targetDay = Math.min(base.day, maxD);
    return day === targetDay;
  }
  if (ev.recurrence === 'yearly') {
    if (month !== base.month) return false;
    const maxD = daysInMonth(year, month);
    return day === Math.min(base.day, maxD);
  }
  return false;
}

export function getEventsForDate(events, year, month, day, tzHours = 8) {
  return events
    .filter((ev) => occursOnDate(ev, year, month, day, tzHours))
    .sort((a, b) => a.startMin - b.startMin);
}

export function getCategoryMeta(catId) {
  return EVENT_CATEGORIES.find((c) => c.id === catId) || EVENT_CATEGORIES[0];
}
