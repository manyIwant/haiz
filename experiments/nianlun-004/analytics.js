// NIANLUN 004 · pure scheduling, conflict detection, spaced-repetition & Zhixuewang-inspired local analytics.
//
// Algorithms & open references:
//   - Interval sweep-line free-slot complement & conflict detection: O(n log n) standard computational geometry.
//   - Ebbinghaus / SuperMemo SM-2 inspired spaced-repetition intervals ([1, 3, 7] days) for mistake review.
//   - Educational measurement statistics (score rate, relative balance z-spread, recoverable-loss attribution).
//   - Strictly local & private: zero unauthorized external exam APIs, zero third-party credentials.

import { BELL_SCHEDULES, ENTRIES, SUBJECTS, subjectByName, TODAY_ISO } from './content.js';

export const LOSS_REASONS = ['概念不清', '审题疏漏', '计算失误', '思路受阻', '时间不足'];
export const RECOVERABLE_REASONS = new Set(['审题疏漏', '计算失误', '时间不足']);

export function fmtMin(min) {
  const m = Math.max(0, Math.min(1439, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function parseMin(str, fallback = 480) {
  if (typeof str === 'number' && Number.isFinite(str)) return Math.max(0, Math.min(1439, Math.round(str)));
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(str || '').trim());
  if (!m) return fallback;
  return Math.max(0, Math.min(1439, Number(m[1]) * 60 + Number(m[2])));
}

export function isoOf(y, m, d) {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return null;
  const wd0 = dt.getUTCDay(); // 0=Sun..6=Sat
  return { y, m: mo, d, wd0, weekday: wd0 === 0 ? 7 : wd0, utcMs: dt.getTime() };
}

export function addDaysIso(iso, deltaDays) {
  const p = parseIso(iso);
  if (!p) return TODAY_ISO;
  const dt = new Date(p.utcMs + deltaDays * 86400000);
  return isoOf(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function doyOfIso(iso) {
  const p = parseIso(iso);
  if (!p) return 0;
  return Math.round((p.utcMs - Date.UTC(p.y, 0, 1)) / 86400000);
}

export function isoOfYearDoy(y, doy) {
  const dt = new Date(Date.UTC(y, 0, 1 + doy));
  return isoOf(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function weekRangeOfIso(iso) {
  const p = parseIso(iso) || parseIso(TODAY_ISO);
  const mon = addDaysIso(iso, -(p.weekday - 1));
  const sun = addDaysIso(mon, 6);
  return { startIso: mon, endIso: sun, weekday: p.weekday };
}

export function daysBetweenIso(aIso, bIso) {
  const a = parseIso(aIso), b = parseIso(bIso);
  if (!a || !b) return 0;
  return Math.round((b.utcMs - a.utcMs) / 86400000);
}

/**
 * Compute busy intervals on a given date from courses (matching weekday), exams, and personal plans.
 */
export function itemsForDate(state, dateIso) {
  const p = parseIso(dateIso);
  if (!p) return { courses: [], exams: [], personal: [], tasks: [], campus: [], history: [] };
  const courses = (state.courses || [])
    .filter((c) => c.weekday === p.weekday)
    .slice()
    .sort((a, b) => a.startMinute - b.startMinute);
  const exams = (state.exams || [])
    .filter((e) => e.dateIso === dateIso)
    .slice()
    .sort((a, b) => (a.startMinute || 480) - (b.startMinute || 480));
  const personal = (state.personal || [])
    .filter((x) => x.dateIso === dateIso)
    .slice()
    .sort((a, b) => a.startMinute - b.startMinute);
  const tasks = (state.tasks || [])
    .filter((t) => t.dueIso === dateIso)
    .slice()
    .sort((a, b) => Number(a.completed) - Number(b.completed));
  const campus = (state.campusNotes || []).filter((n) => n.dateIso === dateIso);
  const history = ENTRIES.filter((e) => e.y === p.y && ((e.when === 'day' || e.when === 'about') ? e.m === p.m && e.d === p.d : e.when === 'month' ? e.m === p.m : false));
  return { courses, exams, personal, tasks, campus, history };
}

/**
 * Interval Sweep-Line: compute available free study/personal slots on `dateIso`.
 * On school weekdays (Mon-Fri), free study windows come from the Hainan Middle School bell schedule
 * (after-class activity, evening study sessions 1 & 2, and unscheduled class periods).
 * On weekends (Sat-Sun), daytime 08:30-22:00 is open except lunch/dinner rest.
 */
export function freeSlotsForDate(state, dateIso, minDuration = 25) {
  const p = parseIso(dateIso);
  if (!p) return [];
  const bell = BELL_SCHEDULES[state.bellMode || 'summer'] || BELL_SCHEDULES.summer;
  const isWeekend = p.weekday >= 6;

  // Candidate open windows before subtracting occupied blocks
  let windows;
  if (isWeekend) {
    windows = [
      { start: 510, end: 720, label: '周末上午' },
      { start: 870, end: 1065, label: '周末下午' },
      { start: 1140, end: 1330, label: '周末晚间' }
    ];
  } else {
    // Allow 文体活动, 晚修一, 晚修二, plus any empty daytime class period
    const byId = Object.fromEntries(bell.slots.map((s) => [s.id, s]));
    windows = [
      byId.p8 ? { start: byId.p8.start, end: byId.p8.end, label: '第八节空堂' } : null,
      byId.sport ? { start: byId.sport.start, end: byId.sport.end, label: '文体活动' } : null,
      byId.eve1 ? { start: byId.eve1.start, end: byId.eve1.end, label: '晚修第一节' } : null,
      byId.eve2 ? { start: byId.eve2.start, end: byId.eve2.end, label: '晚修第二节' } : null
    ].filter(Boolean);
  }

  const { courses, exams, personal } = itemsForDate(state, dateIso);
  const occupied = [
    ...courses.map((c) => ({ start: c.startMinute, end: c.endMinute })),
    ...exams.map((e) => ({ start: e.startMinute ?? 480, end: e.endMinute ?? 600 })),
    ...personal.map((b) => ({ start: b.startMinute, end: b.endMinute }))
  ].sort((a, b) => a.start - b.start);

  // Merge occupied intervals
  const merged = [];
  for (const iv of occupied) {
    if (iv.end <= iv.start) continue;
    const prev = merged[merged.length - 1];
    if (prev && iv.start <= prev.end) prev.end = Math.max(prev.end, iv.end);
    else merged.push({ ...iv });
  }

  // Subtract merged busy intervals from each candidate window
  const free = [];
  for (const w of windows) {
    let cur = w.start;
    for (const b of merged) {
      if (b.end <= cur) continue;
      if (b.start >= w.end) break;
      if (b.start > cur && b.start - cur >= minDuration) {
        free.push({ dateIso, startMinute: cur, endMinute: b.start, duration: b.start - cur, label: w.label });
      }
      cur = Math.max(cur, b.end);
    }
    if (w.end - cur >= minDuration) {
      free.push({ dateIso, startMinute: cur, endMinute: w.end, duration: w.end - cur, label: w.label });
    }
  }
  return free;
}

/**
 * Detect exact time overlaps on a given date between personal blocks, exams, and courses.
 */
export function detectConflictsForDate(state, dateIso) {
  const { courses, exams, personal } = itemsForDate(state, dateIso);
  const conflicts = [];

  const checkPair = (a, b, kindA, kindB) => {
    const s = Math.max(a.startMinute, b.startMinute);
    const e = Math.min(a.endMinute, b.endMinute);
    if (e - s > 0) {
      conflicts.push({
        id: `cf-${a.id}-${b.id}`,
        dateIso,
        overlapMinutes: e - s,
        startMinute: s,
        endMinute: e,
        a: { id: a.id, kind: kindA, title: a.title || a.name, startMinute: a.startMinute, endMinute: a.endMinute },
        b: { id: b.id, kind: kindB, title: b.title || b.name, startMinute: b.startMinute, endMinute: b.endMinute },
        severity: (kindA === 'exam' || kindB === 'exam') ? 'high' : 'medium'
      });
    }
  };

  for (const ps of personal) {
    for (const ex of exams) {
      checkPair(ps, { ...ex, startMinute: ex.startMinute ?? 480, endMinute: ex.endMinute ?? 600 }, 'personal', 'exam');
    }
    for (const c of courses) {
      checkPair(ps, c, 'personal', 'course');
    }
  }
  for (let i = 0; i < personal.length; i++) {
    for (let j = i + 1; j < personal.length; j++) {
      checkPair(personal[i], personal[j], 'personal', 'personal');
    }
  }
  return conflicts;
}

/** Detect all conflicts across all dates present in personal schedules & exams. */
export function detectAllConflicts(state) {
  const dates = new Set([
    ...(state.personal || []).map((p) => p.dateIso),
    ...(state.exams || []).map((e) => e.dateIso)
  ]);
  const all = [];
  for (const d of dates) all.push(...detectConflictsForDate(state, d));
  return all.sort((a, b) => a.dateIso.localeCompare(b.dateIso) || a.startMinute - b.startMinute);
}

/** Suggest the next conflict-free slot of `duration` minutes on `dateIso` (or the next 3 days). */
export function suggestFreeSlot(state, dateIso, duration = 45) {
  for (let offset = 0; offset <= 4; offset++) {
    const d = addDaysIso(dateIso, offset);
    const slots = freeSlotsForDate(state, d, Math.min(25, duration));
    const exact = slots.find((s) => s.duration >= duration);
    if (exact) return { dateIso: d, startMinute: exact.startMinute, endMinute: exact.startMinute + duration, label: exact.label };
    if (slots.length) return { dateIso: d, startMinute: slots[0].startMinute, endMinute: Math.min(slots[0].endMinute, slots[0].startMinute + duration), label: slots[0].label };
  }
  return { dateIso: addDaysIso(dateIso, 1), startMinute: 1170, endMinute: 1170 + duration, label: '次日晚修一' };
}

/**
 * Generate Ebbinghaus / SM-2 spaced-repetition review schedule ([+1d, +3d, +7d])
 * for an exam mistake, auto-slotted into real free time windows.
 */
export function buildMistakeReviewPlan(state, exam, mistake, { baseDateIso = TODAY_ISO, intervals = [1, 3, 7] } = {}) {
  const plan = [];
  const tempPersonal = [...(state.personal || [])];
  const roundLabels = ['首轮订正', '三日巩固', '七日闭环'];
  intervals.forEach((days, idx) => {
    const targetIso = addDaysIso(baseDateIso, days);
    const virtualState = { ...state, personal: tempPersonal };
    const slot = suggestFreeSlot(virtualState, targetIso, 35);
    const title = `错题复习(${roundLabels[idx] || `+${days}天`})：${mistake.subject} · ${mistake.topic}`;
    const item = {
      dateIso: slot.dateIso,
      startMinute: slot.startMinute,
      endMinute: slot.endMinute,
      slotLabel: slot.label,
      title,
      subject: mistake.subject,
      estMinutes: slot.endMinute - slot.startMinute,
      examId: exam.id,
      mistakeId: mistake.id,
      labId: mistake.labId || '',
      note: `源自「${exam.title}」${mistake.qNo}（失分 ${mistake.lost} 分 · ${mistake.reason}）`
    };
    plan.push(item);
    tempPersonal.push({ id: `tmp-${idx}`, dateIso: slot.dateIso, startMinute: slot.startMinute, endMinute: slot.endMinute });
  });
  return plan;
}

/**
 * Zhixuewang-inspired academic diagnosis for one graded exam (optionally compared to previous exam).
 * Uses transparent educational statistics — never fakes official rankings.
 */
export function analyzeExam(exam, prevExam = null) {
  const scores = (exam?.scores || []).filter((s) => Number.isFinite(Number(s.score)) && Number(s.full) > 0);
  if (!scores.length) {
    return {
      hasScores: false,
      total: 0, fullTotal: 0, rate: 0,
      standardEst: null, deltaTotal: null, stability: null,
      subjects: [], lossBreakdown: [], recoverableLost: 0, totalLostFromMistakes: 0,
      strengths: [], priorities: [], weakTopics: []
    };
  }

  let total = 0, fullTotal = 0;
  const prevBySub = new Map((prevExam?.scores || []).map((s) => [s.subject, s]));

  const subjects = scores.map((s) => {
    const score = Number(s.score);
    const full = Number(s.full);
    const rate = score / full;
    const classAvg = s.classAvg != null && s.classAvg !== '' ? Number(s.classAvg) : null;
    const avgRate = classAvg != null ? classAvg / full : null;
    const relEdge = avgRate != null ? rate - avgRate : null;
    const prev = prevBySub.get(s.subject);
    const delta = prev ? +(score - Number(prev.score)).toFixed(1) : null;
    const pct = s.percentile != null && s.percentile !== '' ? Number(s.percentile) : null;
    total += score;
    fullTotal += full;
    return {
      ...s,
      score, full, rate,
      classAvg, avgRate, relEdge, delta, percentile: pct,
      meta: subjectByName(s.subject)
    };
  });

  const meanRate = subjects.reduce((acc, s) => acc + s.rate, 0) / subjects.length;
  const variance = subjects.reduce((acc, s) => acc + (s.rate - meanRate) ** 2, 0) / subjects.length;
  const sd = Math.sqrt(variance);
  // Subject balance stability (0..100): higher means fewer extreme weak legs
  const stability = Math.round(Math.max(30, Math.min(99, 100 - (sd / Math.max(0.15, meanRate)) * 120)));

  // Hainan-style standard-score reference estimate (educational T-scale approximation from percentile or rate)
  // Explicitly labeled in UI as local self-reference estimate, NOT provincial official grading.
  const pctValues = subjects.filter((s) => s.percentile != null).map((s) => s.percentile);
  const avgPct = pctValues.length ? pctValues.reduce((a, b) => a + b, 0) / pctValues.length : (total / fullTotal) * 100;
  const standardEst = Math.round(500 + ((avgPct - 50) / 50) * 300);

  // Classify strengths vs focus priorities (Zhixuewang 学科均衡象限)
  const ranked = subjects.slice().sort((a, b) => b.rate - a.rate);
  subjects.forEach((s) => {
    const gap = s.rate - meanRate;
    if (gap >= 0.045 || (s.relEdge != null && s.relEdge >= 0.07)) s.tag = '优势科';
    else if (gap <= -0.045 || (s.relEdge != null && s.relEdge <= 0.02)) s.tag = '优先提分';
    else s.tag = '稳健科';
  });

  const strengths = ranked.slice(0, 2).map((s) => s.subject);
  const priorities = ranked.slice(-2).reverse().map((s) => s.subject);

  const prevTotal = prevExam?.scores?.length
    ? prevExam.scores.reduce((acc, s) => acc + Number(s.score || 0), 0)
    : null;
  const deltaTotal = prevTotal != null ? +(total - prevTotal).toFixed(1) : null;

  // Mistake loss attribution (失分归因矩阵)
  const mistakes = exam.mistakes || [];
  const reasonMap = new Map(LOSS_REASONS.map((r) => [r, { reason: r, lost: 0, count: 0, recoverable: RECOVERABLE_REASONS.has(r) }]));
  let totalLostFromMistakes = 0, recoverableLost = 0;
  const topicMap = new Map();

  for (const m of mistakes) {
    const lost = Number(m.lost || 0);
    totalLostFromMistakes += lost;
    const r = reasonMap.get(m.reason) || { reason: m.reason || '其他', lost: 0, count: 0, recoverable: false };
    r.lost += lost; r.count += 1;
    reasonMap.set(r.reason, r);
    if (RECOVERABLE_REASONS.has(m.reason)) recoverableLost += lost;
    const key = `${m.subject}·${m.topic}`;
    const prevT = topicMap.get(key) || { subject: m.subject, topic: m.topic, lost: 0, count: 0, mastered: true, labId: m.labId || '' };
    prevT.lost += lost; prevT.count += 1; prevT.mastered = prevT.mastered && !!m.mastered;
    topicMap.set(key, prevT);
  }

  const lossBreakdown = [...reasonMap.values()].filter((x) => x.count > 0).sort((a, b) => b.lost - a.lost);
  const weakTopics = [...topicMap.values()].sort((a, b) => b.lost - a.lost);

  return {
    hasScores: true,
    total: +total.toFixed(1),
    fullTotal,
    rate: total / fullTotal,
    standardEst,
    deltaTotal,
    stability,
    subjects,
    strengths,
    priorities,
    lossBreakdown,
    recoverableLost,
    totalLostFromMistakes,
    weakTopics
  };
}

/** Compare two exams side-by-side (B minus A). */
export function compareExams(examA, examB) {
  if (!examA || !examB) return null;
  const mapA = new Map((examA.scores || []).map((s) => [s.subject, s]));
  const mapB = new Map((examB.scores || []).map((s) => [s.subject, s]));
  const names = [...new Set([...mapA.keys(), ...mapB.keys()])];
  const rows = names.map((subject) => {
    const a = mapA.get(subject), b = mapB.get(subject);
    const sa = a ? Number(a.score) : null, sb = b ? Number(b.score) : null;
    const full = Number(b?.full || a?.full || 100);
    return {
      subject,
      scoreA: sa, scoreB: sb, full,
      delta: sa != null && sb != null ? +(sb - sa).toFixed(1) : null
    };
  });
  const totalA = (examA.scores || []).reduce((acc, s) => acc + Number(s.score || 0), 0);
  const totalB = (examB.scores || []).reduce((acc, s) => acc + Number(s.score || 0), 0);
  return { examA, examB, totalA: +totalA.toFixed(1), totalB: +totalB.toFixed(1), deltaTotal: +(totalB - totalA).toFixed(1), rows };
}

/** Longitudinal series of graded exams sorted by date, for the Exam Ribbon ink ridge. */
export function examTrendSeries(exams) {
  return (exams || [])
    .filter((e) => e.status === 'graded' && e.scores?.length)
    .slice()
    .sort((a, b) => a.dateIso.localeCompare(b.dateIso))
    .map((e) => {
      const total = e.scores.reduce((s, r) => s + Number(r.score || 0), 0);
      const full = e.scores.reduce((s, r) => s + Number(r.full || 100), 0) || 1;
      return { id: e.id, dateIso: e.dateIso, title: e.title, total: +total.toFixed(1), full, rate: total / full };
    });
}

/**
 * Parse pasted CSV / TSV / table lines or JSON into structured subject scores.
 * Supports lines like: "数学, 128, 150, 110, 85" or "物理 82/100" or header rows.
 */
export function parseScoreImport(rawText) {
  const txt = String(rawText || '').trim();
  if (!txt) return { ok: false, error: '请输入或粘贴成绩文本（支持 CSV / 制表符 / JSON）。', scores: [] };

  // JSON format
  if (txt.startsWith('[') || txt.startsWith('{')) {
    try {
      const parsed = JSON.parse(txt);
      const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed.scores) ? parsed.scores : [];
      const scores = arr
        .filter((r) => r && r.subject && Number.isFinite(Number(r.score)))
        .map((r) => {
          const meta = subjectByName(r.subject);
          return {
            subject: String(r.subject).trim(),
            score: Number(r.score),
            full: Number(r.full) > 0 ? Number(r.full) : meta.full,
            classAvg: r.classAvg != null && r.classAvg !== '' ? Number(r.classAvg) : null,
            percentile: r.percentile != null && r.percentile !== '' ? Number(r.percentile) : null
          };
        });
      if (!scores.length) return { ok: false, error: 'JSON 中未识别到有效的科目与分数。', scores: [] };
      return { ok: true, scores };
    } catch (_) {
      return { ok: false, error: 'JSON 解析失败，请检查格式或改用逗号分隔行。', scores: [] };
    }
  }

  // CSV / TSV / Space-separated lines
  const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const scores = [];
  for (const line of lines) {
    if (/^(科目|学科|subject)/i.test(line)) continue; // skip header row
    // Handle "物理 82/100" shorthand
    const slash = /^([^\s,，\t]+)\s+(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/.exec(line);
    if (slash) {
      scores.push({ subject: slash[1], score: Number(slash[2]), full: Number(slash[3]), classAvg: null, percentile: null });
      continue;
    }
    const cols = line.split(/[,\t，]+|\s{2,}|\s+/).map((c) => c.trim()).filter(Boolean);
    if (cols.length < 2) continue;
    const subject = cols[0];
    const score = Number(cols[1]);
    if (!Number.isFinite(score)) continue;
    const meta = subjectByName(subject);
    const full = cols[2] && Number.isFinite(Number(cols[2])) && Number(cols[2]) > 0 ? Number(cols[2]) : meta.full;
    const classAvg = cols[3] && Number.isFinite(Number(cols[3])) ? Number(cols[3]) : null;
    const percentile = cols[4] && Number.isFinite(Number(cols[4])) ? Number(cols[4]) : null;
    scores.push({ subject, score, full, classAvg, percentile });
  }
  if (!scores.length) return { ok: false, error: '未解析到成绩行。示例：数学,126,150,110,84', scores: [] };
  return { ok: true, scores };
}

/**
 * Absence Range Digest: aggregate missed courses, homework, exams, and campus notices over [startIso, endIso].
 */
export function buildAbsenceDigest(state, aIso, bIso) {
  const startIso = aIso <= bIso ? aIso : bIso;
  const endIso = aIso <= bIso ? bIso : aIso;
  const spanDays = Math.min(31, Math.max(0, daysBetweenIso(startIso, endIso)) + 1);
  const days = [];
  const missedCourses = [];
  const missedTasks = [];
  const missedExams = [];
  const missedNotices = [];
  const seenTaskIds = new Set(), seenExamIds = new Set(), seenNoticeIds = new Set();

  for (let i = 0; i < spanDays; i++) {
    const dIso = addDaysIso(startIso, i);
    const dayItems = itemsForDate(state, dIso);
    days.push({ dateIso: dIso, ...dayItems });
    dayItems.courses.forEach((c) => missedCourses.push({ dateIso: dIso, ...c }));
    dayItems.tasks.forEach((t) => { if (!seenTaskIds.has(t.id)) { seenTaskIds.add(t.id); missedTasks.push(t); } });
    dayItems.exams.forEach((e) => { if (!seenExamIds.has(e.id)) { seenExamIds.add(e.id); missedExams.push(e); } });
    dayItems.campus.filter((n) => n.kind === 'campus').forEach((n) => { if (!seenNoticeIds.has(n.id)) { seenNoticeIds.add(n.id); missedNotices.push(n); } });
  }

  // Group missed courses by subject for clean catch-up summary
  const bySubject = new Map();
  for (const c of missedCourses) {
    const cur = bySubject.get(c.subject) || { subject: c.subject, count: 0, items: [] };
    cur.count += 1;
    cur.items.push(c);
    bySubject.set(c.subject, cur);
  }

  return {
    startIso, endIso, spanDays,
    days,
    missedCourses,
    courseSummary: [...bySubject.values()].sort((a, b) => b.count - a.count),
    missedTasks,
    missedExams,
    missedNotices
  };
}
