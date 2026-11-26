/**
 * HAIZ · NIANLUN · 一卷 V4 — Calendar, Timeline Days & Sovereignty Rules
 *
 * Pure date math (UTC-safe local calendar days), semester/holiday boundaries,
 * and Issue #4 sovereignty verification (never fabricate autonomous school time).
 */

import { WEEKDAY_LABELS } from './model.js';

export function parseIsoDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date, delta) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta);
  return d;
}

export function diffDays(a, b) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

/** Monday = 0 .. Sunday = 6 */
export function weekdayIndex(date) {
  return (date.getDay() + 6) % 7;
}

export function shortDateLabel(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function fullChineseDate(date) {
  return `${date.getMonth() + 1}月${date.getDate()}日 周${WEEKDAY_LABELS[weekdayIndex(date)]}`;
}

/**
 * Determine time sovereignty of any specific (day, hour) coordinate.
 * Strictly enforces Issue #4: unscheduled time is NEVER assumed to be free time.
 */
export function getTimeSovereignty(day, hourFloat, config) {
  if (!day) return 'unrecorded_blank';

  // Holiday or on-leave days are home days (§12)
  if (day.isHoliday || config.boundaryMode === 'holiday' || config.boundaryMode === 'on_leave') {
    if (hourFloat >= 7.0 && hourFloat <= 22.5) return 'home_available';
    return 'unrecorded_blank';
  }

  // Graduated archive: past is readable/editable record, not active scheduling
  if (config.boundaryMode === 'graduated') {
    return 'unrecorded_blank';
  }

  const wd = day.wd; // 0=Mon .. 5=Sat, 6=Sun

  // Monday - Friday: boarding student is on campus
  if (wd < 5) {
    if (hourFloat >= config.eveningStudyStart && hourFloat <= config.eveningStudyEnd) {
      return config.eveningStudyAllowSelfPlan ? 'student_unlocked' : 'school_unverified';
    }
    return 'school_locked';
  }

  // Saturday: morning is on campus until departureHour (unverified/configurable!)
  if (wd === config.departureDay) {
    if (hourFloat < config.departureHour) {
      return config.departureVerified ? 'school_locked' : 'school_unverified';
    }
    return 'home_available';
  }

  // Sunday: home until returnHour (Return Wall!), then campus evening study
  if (wd === config.returnDay) {
    if (hourFloat < config.returnHour) {
      return 'home_available';
    }
    if (hourFloat >= config.eveningStudyStart && hourFloat <= config.eveningStudyEnd) {
      return config.eveningStudyAllowSelfPlan ? 'student_unlocked' : 'school_unverified';
    }
    return config.returnVerified ? 'school_locked' : 'school_unverified';
  }

  return 'unrecorded_blank';
}

/**
 * Validate whether a student can place a personal scheduled block [startHour, endHour] on `day`.
 * Returns { allowed: boolean, reason: string, sovereignty: string }.
 */
export function canScheduleBlock(day, startHour, endHour, config) {
  if (!day) return { allowed: false, reason: '未指定日期', sovereignty: 'unrecorded_blank' };
  const samplePoints = [startHour + 0.05, (startHour + endHour) / 2, endHour - 0.05];
  for (const hr of samplePoints) {
    const sov = getTimeSovereignty(day, hr, config);
    if (sov === 'school_locked') {
      return {
        allowed: false,
        sovereignty: sov,
        reason: '这是在校统一时段，默认不可安排个人学习块（不虚构在校自由时间）。',
      };
    }
    if (sov === 'school_unverified') {
      return {
        allowed: false,
        sovereignty: sov,
        reason: '该时段属于晚修或离返校边界（作息待核实，默认不可自排）。如你所在班级允许自主安排，可在「作息与边界设置」中手动开启。',
      };
    }
    if (sov === 'unrecorded_blank') {
      return {
        allowed: false,
        sovereignty: sov,
        reason: '当前时段不在已确认的离校在家窗口内。',
      };
    }
  }
  return { allowed: true, sovereignty: 'home_available', reason: '离校在家可自主安排时段' };
}

/**
 * Compute default weekly timetable glyph string from CourseSlot list
 * (reusing Pocket's CourseSlot -> first character glyph rule, Master v4 §14).
 */
export function buildTimetableGlyphs(courses) {
  const byWd = [[], [], [], [], [], [], []];
  for (const c of courses || []) {
    const idx = Math.max(0, Math.min(6, (c.weekday || 1) - 1));
    byWd[idx].push(c);
  }
  return byWd.map((list) => {
    list.sort((a, b) => (a.startMinute || 0) - (b.startMinute || 0));
    return list.map((c) => (c.name || '课').trim().slice(0, 1)).join('');
  });
}

/**
 * Build continuous calendar days spanning from enrollment Monday through semester end Sunday.
 * Guarantees annual-ring end-face geometry is strictly 1 ring = 1 calendar week (§4.2, A3).
 */
export function buildTimelineDays(config, courses, holidayIsos = new Set(), semesterSeams = new Set()) {
  const startRaw = parseIsoDate(config.enrollmentIso || '2026-09-01');
  // Snap start to Monday so ring week alignment is exact
  const startMonday = addDays(startRaw, -weekdayIndex(startRaw));
  const endRaw = parseIsoDate(config.semesterEndIso || '2027-01-24');
  const endSunday = addDays(endRaw, 6 - weekdayIndex(endRaw));

  const totalDays = Math.max(56, diffDays(startMonday, endSunday) + 1);
  const glyphs = buildTimetableGlyphs(courses);
  const days = [];

  for (let i = 0; i < totalDays; i++) {
    const d = addDays(startMonday, i);
    const iso = toIsoDate(d);
    const wd = weekdayIndex(d);
    const isHoliday = holidayIsos.has(iso) || config.boundaryMode === 'holiday';
    const isOnLeave = config.boundaryMode === 'on_leave';
    const isSchoolDay = !isHoliday && !isOnLeave && wd < 5;
    const isWeekendHome = !isSchoolDay;
    const weekNumber = Math.floor(i / 7) + 1;

    days.push({
      i,
      iso,
      date: d,
      wd,
      weekNumber,
      school: isSchoolDay,
      isHoliday,
      isWeekendHome,
      isSemesterSeam: semesterSeams.has(iso),
      clsGlyphs: isSchoolDay ? (glyphs[wd] || '语数英物化生体自') : '',
      w: 0,
      tw: 0,
    });
  }
  return days;
}
