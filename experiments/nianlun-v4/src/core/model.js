/**
 * HAIZ · NIANLUN · 一卷 V4 — Core Domain Model
 *
 * Implements Master v4 §5, §6, §8, §11, §12 plus all 6 resolved design issues:
 *  - Five temporal forms: fog (雾), bead (珠), channel (槽), wall (墙), trace (迹)
 *    plus occupation (占用), background (背景), companion (伴随)
 *  - Seven task statuses ("软件不知道" default for past — never "overdue")
 *  - Seven event statuses + explicit 3-way epistemic kind (plan / verified_fact / personal_record)
 *  - Time sovereignty (school_locked / school_unverified / home_available / unrecorded_blank)
 *  - Multi-dimensional provenance (originChannel × directness × scopeMatch × temporalAnchor)
 *  - Configurable Hainan Middle School (海南中学) schedule with explicit "待确认" markers
 */

export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

/** Seven task statuses — describe the task, never judge the student (§6.1) */
export const TASK_STATUSES = [
  { id: 'unknown', label: '软件不知道', short: '未知', symbol: '◌', muted: false },
  { id: 'not_started', label: '还没做', short: '还没做', symbol: '○', muted: false },
  { id: 'partial', label: '做了一部分', short: '一部分', symbol: '◐', muted: false },
  { id: 'done', label: '已完成', short: '已完成', symbol: '●', muted: true },
  { id: 'past_due_needed', label: '过了截止，仍需要交', short: '仍需交', symbol: '◷', muted: false },
  { id: 'not_needed', label: '不需要了', short: '不需要', symbol: '—', muted: true },
  { id: 'cancelled_by_source', label: '老师取消了', short: '已取消', symbol: '×', muted: true },
];

/** Seven event statuses — distinguishing plan vs verified fact vs rumor (§6.2 + Issue #5) */
export const EVENT_STATUSES = [
  { id: 'planned', label: '原定计划', short: '计划', muted: false },
  { id: 'tentative', label: '暂定', short: '暂定', muted: false },
  { id: 'tbd', label: '待定 · 另行通知', short: '待定', muted: false },
  { id: 'rescheduled', label: '已改期', short: '改期', muted: false },
  { id: 'cancelled', label: '已取消', short: '取消', muted: true },
  { id: 'plan_elapsed', label: '已过计划期（未核实）', short: '按原计划', muted: true },
  { id: 'confirmed_happened', label: '已确认如期进行', short: '已确认', muted: true },
  { id: 'rumor', label: '据传 · 待确认', short: '据传', muted: false },
];

/** Epistemic provenance kinds (Issue #5: Plan ≠ Fact ≠ Personal Record) */
export const EPISTEMIC_KINDS = {
  plan: { id: 'plan', label: '原定计划', hint: '来自通知或课表安排；时间过去不等于软件知道它必然如期发生' },
  verified_fact: { id: 'verified_fact', label: '已确认事实', hint: '经学生本人确认或官方事后核实的记录' },
  personal_record: { id: 'personal_record', label: '个人记录', hint: '你亲手写下的记忆、投入或备注' },
};

/** Time sovereignty categories (Issue #4: Unscheduled ≠ Free) */
export const TIME_SOVEREIGNTY = {
  school_locked: { id: 'school_locked', label: '在校统一时段', schedulable: false },
  school_unverified: { id: 'school_unverified', label: '作息待核实（默认不可自排）', schedulable: false },
  home_available: { id: 'home_available', label: '离校在家 · 可自主安排', schedulable: true },
  student_unlocked: { id: 'student_unlocked', label: '你标记为可自排', schedulable: true },
  unrecorded_blank: { id: 'unrecorded_blank', label: '未录入作息（不假定为空闲）', schedulable: false },
};

/**
 * Multi-dimensional source metadata (Issue #3)
 * Authority is NEVER a single mechanical integer on sender identity.
 */
export const ORIGIN_CHANNELS = {
  official_grade: { id: 'official_grade', label: '学校 / 年级正式发布', baseWeight: 100, scope: 'grade' },
  homeroom_teacher: { id: 'homeroom_teacher', label: '班主任', baseWeight: 82, scope: 'class' },
  subject_teacher: { id: 'subject_teacher', label: '任课教师', baseWeight: 80, scope: 'subject' },
  class_committee: { id: 'class_committee', label: '班委 / 课代表', baseWeight: 62, scope: 'subject_or_class' },
  peer_parent: { id: 'peer_parent', label: '同学 / 家长', baseWeight: 38, scope: 'peer' },
  student_self: { id: 'student_self', label: '我自己', baseWeight: 70, scope: 'personal' },
  unknown: { id: 'unknown', label: '未知来源', baseWeight: 20, scope: 'unknown' },
};

export const DIRECTNESS_LEVELS = {
  original: { id: 'original', label: '原发通知', multiplier: 1.0 },
  verbatim_forward: { id: 'verbatim_forward', label: '原文转发 / 官方截图', multiplier: 0.92 },
  paraphrase: { id: 'paraphrase', label: '转述', multiplier: 0.65 },
  rumor: { id: 'rumor', label: '听闻 / 未核实', multiplier: 0.35 },
};

/**
 * Default Hainan Middle School (海南中学) schedule config (Issue #6)
 * References data/news.json n10 (2026-04-07 summer timetable for Grade 10/11)
 * while explicitly marking departure, return, and evening study as configurable/unverified.
 */
export function createDefaultSchoolConfig() {
  return {
    schoolName: '海南中学',
    campusName: '府城校区 · 高中部（住校演示）',
    scheduleReferenceNote: '参考 2026-04-07 海南中学高一高二夏季作息公开记录；当前 11 月秋冬作息及周末离返校时刻尚未完全核实，可按你所在年级与班级自行修改。',
    enrollmentIso: '2026-09-01',
    semesterStartIso: '2026-09-01',
    semesterEndIso: '2027-01-24',
    departureDay: 5, // 0=Mon..5=Sat
    departureHour: 12.17, // 12:10 placeholder
    departureVerified: false,
    returnDay: 6, // 6=Sun
    returnHour: 17.5, // 17:30 placeholder
    returnVerified: false,
    eveningStudyStart: 19.5, // 19:30 (summer ref)
    eveningStudyEnd: 22.33, // 22:20 (summer ref)
    eveningStudyVerified: false,
    eveningStudyAllowSelfPlan: false, // Issue #4: default locked!
    // Boundary simulation state (§12)
    boundaryMode: 'normal', // 'normal' | 'holiday' | 'graduated' | 'transferred' | 'on_leave'
    previousSchoolName: '海南中学（府城校区）',
    transferredSchoolName: '',
    // Weekday standard 8 periods + evening study (referencing data/news.json n10)
    // Used ONLY when rendering school-day hour scale, clearly tagged as reference/configurable
    periodSlots: [
      { id: 'p0', label: '早读', start: 7.42, end: 7.92, locked: true },
      { id: 'p1', label: '第1节', start: 8.0, end: 8.67, locked: true },
      { id: 'p2', label: '第2节', start: 8.83, end: 9.5, locked: true },
      { id: 'p3', label: '第3节', start: 9.67, end: 10.33, locked: true },
      { id: 'p4', label: '第4节', start: 10.67, end: 11.33, locked: true },
      { id: 'p5', label: '第5节', start: 11.5, end: 12.17, locked: true },
      { id: 'p6', label: '第6节', start: 14.75, end: 15.42, locked: true },
      { id: 'p7', label: '第7节', start: 15.58, end: 16.25, locked: true },
      { id: 'p8', label: '第8节', start: 16.5, end: 17.17, locked: true },
      { id: 'p9', label: '晚修（待核实）', start: 19.5, end: 22.33, locked: true, isEveningStudy: true },
    ],
  };
}

export function createId(prefix = 'nl') {
  const rand = Math.floor(Math.random() * 1e6).toString(36).padStart(4, '0');
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

/**
 * Dual FNV-1a 32-bit hash matching HAIZ Pocket's `noticeProposalKey` (§8.4, §14)
 * Extended with normalization (strip whitespace, forward prefixes, unify punctuation).
 */
export function normalizeNoticeText(raw) {
  return String(raw || '')
    .replace(/^(转发自?[:：]?|【转发】|\[转发\]|Fw:|Fwd:)/i, '')
    .replace(/[，,]/g, ',')
    .replace(/[。．.]/g, '.')
    .replace(/[：:]/g, ':')
    .replace(/[；;]/g, ';')
    .replace(/[“”"'‘’]/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

export function dualFnvHash(signature) {
  let first = 0x811c9dc5 >>> 0;
  let second = 0x5ad1b2e3 >>> 0;
  for (let i = 0; i < signature.length; i++) {
    const unit = signature.charCodeAt(i);
    first = Math.imul((first ^ unit) >>> 0, 0x01000193) >>> 0;
    second = Math.imul((second ^ unit) >>> 0, 0x01000193) >>> 0;
  }
  return `nl_${first.toString(16).padLeft ? first.toString(16) : first.toString(16).padStart(8, '0')}_${second.toString(16).padStart(8, '0')}`;
}

export function messageFingerprint(msg) {
  const norm = normalizeNoticeText(msg.text || msg.original || '');
  const sent = msg.originalSentIso ? msg.originalSentIso.slice(0, 16) : '';
  return dualFnvHash(`${sent}|${norm}`);
}

export function getTaskStatusMeta(id) {
  return TASK_STATUSES.find((s) => s.id === id) || TASK_STATUSES[0];
}

export function getEventStatusMeta(id) {
  return EVENT_STATUSES.find((s) => s.id === id) || EVENT_STATUSES[0];
}

/**
 * Format hour float (e.g. 15.33) -> "15:20"
 */
export function formatHour(hourFloat) {
  if (hourFloat == null || Number.isNaN(hourFloat)) return '';
  const totalMins = Math.round(hourFloat * 60);
  const h = Math.floor(totalMins / 60) % 24;
  const m = Math.abs(totalMins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Check if an item is hidden by privacy lock (§12 共用手机)
 */
export function isItemPrivateLocked(item, privacyLocked) {
  if (!privacyLocked) return false;
  if (item.kind === 'memory') return true;
  if (item.isPrivate) return true;
  return false;
}
