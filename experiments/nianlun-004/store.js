// NIANLUN 004 · persistent student time-layer store & HAIZ ecosystem bridge.
//
// Privacy & architecture principles:
//   - Local-first persistence via localStorage (`haiz.nianlun004.v1`), automatically inheriting
//     HAIZ `src/account/session-guard.js` account-scoped localStorage proxy when mounted in HAIZ.
//   - Exams, grades, mistakes, personal schedules, and personal growth notes default to
//     `visibility: 'private'` (visible only to the owner).
//   - Demo data is explicitly tagged `example: true` (matching HAIZ Pocket `pocket_models.dart`),
//     can be cleared in one tap or reset anytime.
//   - Reserves a clean async `SupabaseSnapshotAdapter` interface + `exportPocketSnapshotV1()`
//     aligned with `supabase/migrations/202610310001_pocket_snapshots.sql` and
//     `app/lib/core/personal_snapshot.dart`.

import { createDemoStudentData, TODAY_ISO } from './content.js';
import { buildMistakeReviewPlan, suggestFreeSlot, buildAbsenceDigest } from './analytics.js';

export const STORAGE_KEY = 'haiz.nianlun004.v1';

const newId = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function normalizeState(raw) {
  const base = createDemoStudentData();
  if (!raw || typeof raw !== 'object') return base;
  return {
    version: 1,
    schema: 'haiz.nianlun004.v1',
    ownerMode: raw.ownerMode || 'local-private',
    bellMode: raw.bellMode === 'winter' ? 'winter' : 'summer',
    term: raw.term && raw.term.startIso ? raw.term : base.term,
    courses: Array.isArray(raw.courses) ? raw.courses : base.courses,
    tasks: Array.isArray(raw.tasks) ? raw.tasks : base.tasks,
    personal: Array.isArray(raw.personal) ? raw.personal : base.personal,
    exams: Array.isArray(raw.exams) ? raw.exams : base.exams,
    campusNotes: Array.isArray(raw.campusNotes) ? raw.campusNotes : base.campusNotes,
    updatedAt: raw.updatedAt || new Date().toISOString(),
    casVersion: Number.isInteger(raw.casVersion) ? raw.casVersion : 1
  };
}

export class NianlunStore {
  constructor(storage = null) {
    this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.listeners = new Set();
    this.state = this._load();
  }

  _load() {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (raw) return normalizeState(JSON.parse(raw));
    } catch (_) {
      /* corrupt or blocked storage — fall back gracefully without throwing */
    }
    const demo = normalizeState(createDemoStudentData());
    this._save(demo);
    return demo;
  }

  _save(nextState = this.state) {
    nextState.updatedAt = new Date().toISOString();
    nextState.casVersion = (nextState.casVersion || 0) + 1;
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch (_) {
      /* quota or private mode */
    }
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(change = 'update') {
    this._save(this.state);
    for (const fn of this.listeners) {
      try { fn(this.state, change); } catch (err) { console.error(err); }
    }
  }

  getState() { return this.state; }

  hasDemoItems() {
    const s = this.state;
    return [s.courses, s.tasks, s.personal, s.exams, s.campusNotes].some((arr) => arr.some((x) => x.example));
  }

  // ---- Bell schedule
  setBellMode(mode) {
    this.state.bellMode = mode === 'winter' ? 'winter' : 'summer';
    this._emit('bell');
  }

  // ---- Courses CRUD
  addCourse(data) {
    const item = {
      id: newId('c'),
      weekday: Math.max(1, Math.min(7, Number(data.weekday) || 1)),
      startMinute: Number(data.startMinute) || 480,
      endMinute: Math.max((Number(data.startMinute) || 480) + 15, Number(data.endMinute) || 520),
      subject: String(data.subject || '数学').trim(),
      name: String(data.name || data.subject || '新课程').trim(),
      room: String(data.room || '').trim(),
      buildingId: String(data.buildingId || 'yihao'),
      teacher: String(data.teacher || '').trim(),
      labId: String(data.labId || ''),
      example: false
    };
    this.state.courses.push(item);
    this._emit('courses');
    return item;
  }

  updateCourse(id, patch) {
    const c = this.state.courses.find((x) => x.id === id);
    if (!c) return null;
    Object.assign(c, patch, { example: false });
    this._emit('courses');
    return c;
  }

  deleteCourse(id) {
    this.state.courses = this.state.courses.filter((x) => x.id !== id);
    this._emit('courses');
  }

  // ---- Homework / Tasks CRUD
  addTask(data) {
    const item = {
      id: newId('hw'),
      title: String(data.title || '新作业').trim(),
      subject: String(data.subject || '数学').trim(),
      dueIso: String(data.dueIso || TODAY_ISO),
      estMinutes: Math.max(10, Number(data.estMinutes) || 35),
      priority: ['high', 'normal', 'low'].includes(data.priority) ? data.priority : 'normal',
      completed: !!data.completed,
      linkedCourseId: data.linkedCourseId || null,
      linkedExamId: data.linkedExamId || null,
      linkedMistakeId: data.linkedMistakeId || null,
      scheduledBlockId: data.scheduledBlockId || null,
      labId: String(data.labId || ''),
      source: String(data.source || '本人录入').trim(),
      note: String(data.note || '').trim(),
      example: false
    };
    this.state.tasks.push(item);
    this._emit('tasks');
    return item;
  }

  updateTask(id, patch) {
    const t = this.state.tasks.find((x) => x.id === id);
    if (!t) return null;
    Object.assign(t, patch, { example: false });
    this._emit('tasks');
    return t;
  }

  toggleTask(id) {
    const t = this.state.tasks.find((x) => x.id === id);
    if (!t) return null;
    t.completed = !t.completed;
    // Sync linked personal block completion gently
    if (t.scheduledBlockId) {
      const b = this.state.personal.find((p) => p.id === t.scheduledBlockId);
      if (b) b.completed = t.completed;
    }
    this._emit('tasks');
    return t;
  }

  deleteTask(id) {
    this.state.tasks = this.state.tasks.filter((x) => x.id !== id);
    this.state.personal.forEach((p) => { if (p.linkedTaskId === id) p.linkedTaskId = null; });
    this._emit('tasks');
  }

  // ---- Personal Schedule CRUD (private by default)
  addPersonal(data) {
    const start = Number(data.startMinute) || 1170;
    const end = Math.max(start + 15, Number(data.endMinute) || start + 45);
    const item = {
      id: newId('ps'),
      dateIso: String(data.dateIso || TODAY_ISO),
      startMinute: start,
      endMinute: end,
      title: String(data.title || '个人安排').trim(),
      kind: ['study', 'review', 'club', 'life'].includes(data.kind) ? data.kind : 'study',
      linkedTaskId: data.linkedTaskId || null,
      linkedExamId: data.linkedExamId || null,
      linkedMistakeId: data.linkedMistakeId || null,
      buildingId: String(data.buildingId || 'yihao'),
      completed: !!data.completed,
      visibility: 'private',
      note: String(data.note || '').trim(),
      example: false
    };
    this.state.personal.push(item);
    this._emit('personal');
    return item;
  }

  updatePersonal(id, patch) {
    const p = this.state.personal.find((x) => x.id === id);
    if (!p) return null;
    Object.assign(p, patch, { example: false });
    this._emit('personal');
    return p;
  }

  togglePersonal(id) {
    const p = this.state.personal.find((x) => x.id === id);
    if (!p) return null;
    p.completed = !p.completed;
    if (p.linkedTaskId) {
      const t = this.state.tasks.find((x) => x.id === p.linkedTaskId);
      if (t) t.completed = p.completed;
    }
    this._emit('personal');
    return p;
  }

  deletePersonal(id) {
    this.state.personal = this.state.personal.filter((x) => x.id !== id);
    this.state.tasks.forEach((t) => { if (t.scheduledBlockId === id) t.scheduledBlockId = null; });
    this._emit('personal');
  }

  // ---- Cross-Layer Operation 1: Drag / Pin Homework into Free Slot on Personal Schedule
  scheduleTaskIntoSlot(taskId, { dateIso, startMinute, endMinute }) {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) return null;
    const dur = Math.max(20, task.estMinutes || 40);
    const s = startMinute != null ? startMinute : suggestFreeSlot(this.state, dateIso || task.dueIso || TODAY_ISO, dur).startMinute;
    const e = endMinute != null ? Math.max(s + 15, endMinute) : s + dur;
    const targetDate = dateIso || task.dueIso || TODAY_ISO;

    // If already scheduled, move the existing linked block instead of duplicating
    if (task.scheduledBlockId) {
      const existing = this.state.personal.find((p) => p.id === task.scheduledBlockId);
      if (existing) {
        existing.dateIso = targetDate;
        existing.startMinute = s;
        existing.endMinute = e;
        existing.example = false;
        this._emit('cross-schedule');
        return existing;
      }
    }
    const block = {
      id: newId('ps'),
      dateIso: targetDate,
      startMinute: s,
      endMinute: e,
      title: `完成：${task.title}`,
      kind: 'study',
      linkedTaskId: task.id,
      buildingId: 'yihao',
      completed: task.completed,
      visibility: 'private',
      note: `由作业带拖入（${task.subject} · 预计 ${dur} 分钟）`,
      example: false
    };
    this.state.personal.push(block);
    task.scheduledBlockId = block.id;
    this._emit('cross-schedule');
    return block;
  }

  // ---- Cross-Layer Operation 2: Resolve Conflict by shifting personal block to next free slot
  resolveConflict(personalId) {
    const block = this.state.personal.find((p) => p.id === personalId);
    if (!block) return null;
    const dur = Math.max(25, block.endMinute - block.startMinute);
    // Exclude this block temporarily when searching for free slots
    const without = { ...this.state, personal: this.state.personal.filter((p) => p.id !== personalId) };
    const slot = suggestFreeSlot(without, block.dateIso, dur);
    block.dateIso = slot.dateIso;
    block.startMinute = slot.startMinute;
    block.endMinute = slot.endMinute;
    block.title = block.title.replace(/（与.*?冲突！）/, '');
    block.note = `${block.note ? block.note + ' · ' : ''}已顺延至 ${slot.dateIso} ${slot.label}`;
    block.example = false;
    this._emit('conflict-resolved');
    return { block, slot };
  }

  // ---- Exams, Scores & Mistakes CRUD (private by default)
  addExam(data) {
    const item = {
      id: newId('ex'),
      title: String(data.title || '阶段测验').trim(),
      dateIso: String(data.dateIso || TODAY_ISO),
      startMinute: Number(data.startMinute) || 480,
      endMinute: Number(data.endMinute) || 600,
      buildingId: String(data.buildingId || 'yihao'),
      room: String(data.room || '一号教学楼').trim(),
      status: data.scores?.length ? 'graded' : (data.status || 'upcoming'),
      visibility: 'private',
      note: String(data.note || '').trim(),
      scores: Array.isArray(data.scores) ? data.scores : [],
      mistakes: Array.isArray(data.mistakes) ? data.mistakes : [],
      example: false
    };
    this.state.exams.push(item);
    this._emit('exams');
    return item;
  }

  updateExam(id, patch) {
    const ex = this.state.exams.find((e) => e.id === id);
    if (!ex) return null;
    Object.assign(ex, patch, { example: false });
    if (ex.scores?.length && ex.status === 'upcoming') ex.status = 'graded';
    this._emit('exams');
    return ex;
  }

  deleteExam(id) {
    this.state.exams = this.state.exams.filter((e) => e.id !== id);
    this._emit('exams');
  }

  upsertExamScores(examId, scores) {
    const ex = this.state.exams.find((e) => e.id === examId);
    if (!ex) return null;
    ex.scores = scores.map((s) => ({
      subject: String(s.subject).trim(),
      score: Number(s.score),
      full: Number(s.full) || 100,
      classAvg: s.classAvg != null && s.classAvg !== '' ? Number(s.classAvg) : null,
      percentile: s.percentile != null && s.percentile !== '' ? Number(s.percentile) : null
    }));
    ex.status = ex.scores.length ? 'graded' : ex.status;
    ex.example = false;
    this._emit('exams');
    return ex;
  }

  addMistake(examId, data) {
    const ex = this.state.exams.find((e) => e.id === examId);
    if (!ex) return null;
    const m = {
      id: newId('m'),
      subject: String(data.subject || '物理').trim(),
      qNo: String(data.qNo || '第 1 题').trim(),
      lost: Math.max(1, Number(data.lost) || 4),
      topic: String(data.topic || '知识点待补充').trim(),
      reason: String(data.reason || '概念不清'),
      note: String(data.note || '').trim(),
      labId: String(data.labId || ''),
      mastered: false,
      reviewIds: []
    };
    ex.mistakes = ex.mistakes || [];
    ex.mistakes.push(m);
    ex.example = false;
    this._emit('exams');
    return m;
  }

  toggleMistakeMastered(examId, mistakeId) {
    const ex = this.state.exams.find((e) => e.id === examId);
    const m = ex?.mistakes?.find((x) => x.id === mistakeId);
    if (!m) return null;
    m.mastered = !m.mastered;
    this._emit('exams');
    return m;
  }

  deleteMistake(examId, mistakeId) {
    const ex = this.state.exams.find((e) => e.id === examId);
    if (!ex) return;
    ex.mistakes = (ex.mistakes || []).filter((x) => x.id !== mistakeId);
    this._emit('exams');
  }

  // ---- Cross-Layer Operation 3: Convert Exam Mistake into Spaced-Repetition Review Tasks + Personal Blocks
  convertMistakeToReviews(examId, mistakeId, { baseDateIso = TODAY_ISO, intervals = [1, 3, 7] } = {}) {
    const ex = this.state.exams.find((e) => e.id === examId);
    const m = ex?.mistakes?.find((x) => x.id === mistakeId);
    if (!ex || !m) return [];
    const plan = buildMistakeReviewPlan(this.state, ex, m, { baseDateIso, intervals });
    const created = [];
    for (const step of plan) {
      const task = {
        id: newId('hw'),
        title: step.title,
        subject: step.subject,
        dueIso: step.dateIso,
        estMinutes: step.estMinutes,
        priority: 'high',
        completed: false,
        linkedExamId: ex.id,
        linkedMistakeId: m.id,
        labId: step.labId,
        source: `错题复盘 · ${ex.title}`,
        note: step.note,
        example: false
      };
      const block = {
        id: newId('ps'),
        dateIso: step.dateIso,
        startMinute: step.startMinute,
        endMinute: step.endMinute,
        title: step.title,
        kind: 'review',
        linkedTaskId: task.id,
        linkedExamId: ex.id,
        linkedMistakeId: m.id,
        buildingId: 'library',
        completed: false,
        visibility: 'private',
        note: step.note,
        example: false
      };
      task.scheduledBlockId = block.id;
      this.state.tasks.push(task);
      this.state.personal.push(block);
      m.reviewIds = m.reviewIds || [];
      m.reviewIds.push(block.id);
      created.push({ task, block });
    }
    this._emit('mistake-reviews');
    return created;
  }

  // ---- Cross-Layer Operation 4: Convert Absence Digest into Catch-up Personal Blocks
  scheduleAbsenceCatchup(startIso, endIso, baseDateIso = TODAY_ISO) {
    const digest = buildAbsenceDigest(this.state, startIso, endIso);
    const created = [];
    const subjects = digest.courseSummary.slice(0, 4);
    subjects.forEach((entry, idx) => {
      const slot = suggestFreeSlot(this.state, baseDateIso, 40);
      const block = {
        id: newId('ps'),
        dateIso: slot.dateIso,
        startMinute: slot.startMinute,
        endMinute: slot.endMinute,
        title: `缺席补课：${entry.subject}（补 ${entry.count} 节笔记）`,
        kind: 'review',
        linkedTaskId: null,
        buildingId: 'yihao',
        completed: false,
        visibility: 'private',
        note: `汇总 ${digest.startIso} 至 ${digest.endIso} 期间错过课程`,
        example: false
      };
      this.state.personal.push(block);
      created.push(block);
      void idx;
    });
    if (created.length) this._emit('absence-catchup');
    return created;
  }

  // ---- Campus Notices & Personal Growth Notes CRUD
  addCampusNote(data) {
    const kind = data.kind === 'campus' ? 'campus' : 'growth';
    const item = {
      id: newId(kind === 'campus' ? 'cn' : 'gr'),
      dateIso: String(data.dateIso || TODAY_ISO),
      kind,
      visibility: kind === 'growth' ? 'private' : 'campus',
      title: String(data.title || (kind === 'growth' ? '成长记录' : '校园通知')).trim(),
      buildingId: String(data.buildingId || 'lanshu'),
      text: String(data.text || '').trim(),
      example: false
    };
    this.state.campusNotes.push(item);
    this._emit('campus');
    return item;
  }

  deleteCampusNote(id) {
    this.state.campusNotes = this.state.campusNotes.filter((n) => n.id !== id);
    this._emit('campus');
  }

  // ---- Demo data lifecycle & Backup / HAIZ Pocket Snapshot v1 bridge
  clearDemoData() {
    this.state.courses = this.state.courses.filter((x) => !x.example);
    this.state.tasks = this.state.tasks.filter((x) => !x.example);
    this.state.personal = this.state.personal.filter((x) => !x.example);
    this.state.exams = this.state.exams.filter((x) => !x.example);
    this.state.campusNotes = this.state.campusNotes.filter((x) => !x.example);
    this._emit('clear-demo');
  }

  resetDemoData() {
    this.state = normalizeState(createDemoStudentData());
    this._emit('reset-demo');
  }

  exportJSON() {
    return JSON.stringify(this.state, null, 2);
  }

  importJSON(raw) {
    const parsed = JSON.parse(raw);
    this.state = normalizeState(parsed);
    this._emit('import');
    return this.state;
  }

  /**
   * Export compatible with HAIZ Pocket `PersonalSnapshot` v1 (`app/lib/core/personal_snapshot.dart`)
   * and Supabase `public.pocket_snapshots(user_id, data jsonb, version, updated_at)`.
   */
  exportPocketSnapshotV1() {
    return {
      version: 1,
      tasks: this.state.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        subject: t.subject,
        completed: !!t.completed,
        example: !!t.example,
        dueIso: t.dueIso || null,
        source: t.source || '',
        originalNotice: t.note || ''
      })),
      courses: this.state.courses.map((c) => ({
        id: c.id,
        weekday: c.weekday,
        startMinute: c.startMinute,
        endMinute: c.endMinute,
        name: c.name,
        location: c.room || '',
        example: !!c.example
      })),
      focusLogs: [],
      taskNotes: Object.fromEntries(this.state.tasks.filter((t) => t.note).map((t) => [t.id, t.note])),
      activeTaskId: null,
      appearance: 'porcelain',
      legacyImported: false
    };
  }
}

/**
 * Reserved Supabase cloud snapshot adapter contract (for future HAIZ integration).
 * Mirrors `supabase/migrations/202610310001_pocket_snapshots.sql` CAS + RLS semantics.
 */
export function createSupabaseBridgeBlueprint() {
  return {
    table: 'public.nianlun_snapshots',
    compatibleWith: 'public.pocket_snapshots',
    auth: 'Supabase Auth (non-anonymous authenticated user_id = auth.uid())',
    privacyBoundary: 'Private layers (exams, grades, mistakes, personal, growth) stay strictly in owner-scoped RLS row; public campus news/climate/history remain read-only shared assets.',
    concurrency: 'Optimistic CAS on (user_id, cas_version)',
    clientStorageFallback: 'haiz.account.<uid>:haiz.nianlun004.v1 (via src/account/session-guard.js)'
  };
}
