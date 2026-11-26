/**
 * HAIZ · NIANLUN · 一卷 V4 — Local-First Store, Persistence, Migration & Export
 *
 * Implements:
 *  - Local-only storage (`localStorage` + graceful in-memory fallback for Node tests)
 *  - 6-hour idle default-view gentle recovery (NO 10s auto-roll! Master v4 §13 #4)
 *  - 10-second in-memory undoable hard delete for private records (§11.3, §13 #7)
 *  - Full batch-import rollback (§8.7, §11.3)
 *  - One-way, undoable HAIZ Pocket `PersonalSnapshot` v1 migration (§14)
 *  - RFC 5545 `.ics` export (reusing HAIZ Pocket `CalendarExport` date-only honesty!)
 *  - Shared-phone Privacy Lock (§12)
 */

import { createDefaultSchoolConfig, createId } from './model.js';
import {
  DEMO_NOW_ISO,
  DEMO_NOW_HOUR,
  DEMO_HOLIDAY_ISOS,
  DEMO_SEMESTER_SEAMS,
  createDemoCourses,
  createDemoItems,
  createDemoBackgrounds,
  createDemoSpans,
  createHighDensityStressItems,
} from './demo_data.js';
import { buildTimelineDays, parseIsoDate, toIsoDate } from './calendar.js';

const STORAGE_KEY = 'haiz_nianlun_v4_state_v1';
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export function createInitialAppState({ blankMode = false } = {}) {
  const config = createDefaultSchoolConfig();
  const courses = blankMode ? [] : createDemoCourses();
  const items = blankMode ? [] : createDemoItems(config);
  const backgrounds = blankMode ? [] : createDemoBackgrounds();
  const spans = blankMode ? [] : createDemoSpans();

  return {
    version: 4,
    isDemoActive: !blankMode,
    highDensityStress: false,
    nowIso: DEMO_NOW_ISO,
    nowHour: DEMO_NOW_HOUR,
    lastActiveAt: Date.now(),
    lastImportedLabel: blankMode ? '尚未导入群消息' : '截至 11 月 28 日，已包含演示校历与 11 条示例记录',
    config,
    courses,
    items,
    backgrounds,
    spans,
    seenFingerprints: [],
    unparsedMessages: [],
    importBatches: [], // [{ id, label, createdIds, addedLayerIds, addedUnparsedIds, addedFingerprints }]
    // View & accessibility preferences
    privacyLocked: false,
    privacyPin: '0000',
    theme: 'auto', // 'auto' | 'light' | 'dark'
    reducedMotionOverride: false,
    lowPowerTextureOff: false,
    leftHandedDial: false,
    soundEnabled: false, // Quiet by default; opt-in wood/paper foley
    hasDismissedHint: false,
    // Saved elastic weights keyed by ISO date so reopening within 6h preserves exact state (§13 #4)
    savedWeights: null,
  };
}

export class NianlunStore {
  constructor(storage = null) {
    this.storage = storage || (typeof window !== 'undefined' ? window.localStorage : null);
    this.listeners = new Set();
    this.undoStack = []; // snapshots for gesture/action undo (§9.7)
    this.pendingHardDeletes = new Map(); // id -> { item, timer, expiresAt }
    this.state = this._load();
    this.days = [];
    this.nowIdx = 0;
    this.rebuildTimeline(true);
  }

  _load() {
    if (!this.storage) return createInitialAppState();
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return createInitialAppState();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 4 || !parsed.config) {
        return createInitialAppState();
      }
      // 6-hour idle check (§13 #4): restore default scroll weights ONLY if away > 6 hours
      const elapsed = Date.now() - (parsed.lastActiveAt || 0);
      if (elapsed > SIX_HOURS_MS) {
        parsed.savedWeights = null;
      }
      parsed.lastActiveAt = Date.now();
      return { ...createInitialAppState(), ...parsed };
    } catch {
      return createInitialAppState();
    }
  }

  persist() {
    this.state.lastActiveAt = Date.now();
    // Snapshot current weights keyed by ISO
    const weights = {};
    for (const d of this.days) {
      if (d.tw > 0) weights[d.iso] = Number(d.tw.toFixed(3));
    }
    this.state.savedWeights = weights;
    if (!this.storage) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Quota or private mode — stay functional in memory without crashing
    }
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(reason = 'update') {
    this.persist();
    for (const fn of this.listeners) fn(this.state, reason);
  }

  rebuildTimeline(restoreWeights = false) {
    const prevWeights = new Map();
    for (const d of this.days) prevWeights.set(d.iso, { w: d.w, tw: d.tw });

    this.days = buildTimelineDays(
      this.state.config,
      this.state.courses,
      DEMO_HOLIDAY_ISOS,
      DEMO_SEMESTER_SEAMS,
    );

    // Find nowIdx matching state.nowIso
    let idx = this.days.findIndex((d) => d.iso === this.state.nowIso);
    if (idx < 0) idx = Math.floor(this.days.length / 2);
    this.nowIdx = idx;

    const saved = restoreWeights ? this.state.savedWeights : null;
    if (saved && Object.keys(saved).length > 0) {
      for (const d of this.days) {
        const val = saved[d.iso] ?? 0;
        d.w = val;
        d.tw = val;
      }
    } else if (prevWeights.size > 0 && !restoreWeights) {
      for (const d of this.days) {
        const prev = prevWeights.get(d.iso);
        if (prev) {
          d.w = prev.w;
          d.tw = prev.tw;
        }
      }
    } else {
      this.applyDefaultWeights(true);
    }
  }

  /**
   * Master v4 §3.4 default state:
   * Unrolls last day of previous week through last day of next week (~9 days around Now),
   * Past rolled at top, Future rolled at bottom.
   */
  applyDefaultWeights(immediate = false) {
    for (let i = 0; i < this.days.length; i++) {
      const rel = i - this.nowIdx;
      const target = (rel >= -1 && rel <= 7) ? 1 : 0;
      this.days[i].tw = target;
      if (immediate) this.days[i].w = target;
    }
  }

  isDefaultLayout() {
    return this.days.every((d, i) => {
      const rel = i - this.nowIdx;
      const target = (rel >= -1 && rel <= 7) ? 1 : 0;
      return Math.abs(d.tw - target) < 0.04;
    });
  }

  pushUndo(label = '撤销上一步') {
    const weights = this.days.map((d) => d.tw);
    const snapshot = {
      label,
      weights,
      items: JSON.parse(JSON.stringify(this.state.items)),
      unparsedMessages: JSON.parse(JSON.stringify(this.state.unparsedMessages)),
      seenFingerprints: [...this.state.seenFingerprints],
      importBatches: JSON.parse(JSON.stringify(this.state.importBatches)),
      config: JSON.parse(JSON.stringify(this.state.config)),
    };
    this.undoStack.push(snapshot);
    if (this.undoStack.length > 25) this.undoStack.shift();
  }

  undo() {
    const snap = this.undoStack.pop();
    if (!snap) return null;
    this.state.items = snap.items;
    this.state.unparsedMessages = snap.unparsedMessages;
    this.state.seenFingerprints = snap.seenFingerprints;
    this.state.importBatches = snap.importBatches;
    this.state.config = snap.config;
    this.rebuildTimeline(false);
    for (let i = 0; i < this.days.length && i < snap.weights.length; i++) {
      this.days[i].tw = snap.weights[i];
    }
    this.emit('undo');
    return snap.label;
  }

  /**
   * Toggle high-density stress scenario (Issue #1 & #2 live verification).
   */
  toggleHighDensityStress(enable) {
    const next = enable == null ? !this.state.highDensityStress : Boolean(enable);
    if (next === this.state.highDensityStress) return;
    this.pushUndo(next ? '开启高密度压力测试' : '关闭高密度压力测试');
    this.state.highDensityStress = next;
    this.state.items = this.state.items.filter((x) => !x.isStress);
    if (next) {
      this.state.items.push(...createHighDensityStressItems(this.state.config));
    }
    this.emit('stress_toggle');
  }

  /**
   * Switch between labeled demo mode and honest empty/real blank mode.
   */
  resetToMode({ blankMode = false } = {}) {
    this.undoStack = [];
    for (const entry of this.pendingHardDeletes.values()) clearTimeout(entry.timer);
    this.pendingHardDeletes.clear();
    const keepPrefs = {
      theme: this.state.theme,
      reducedMotionOverride: this.state.reducedMotionOverride,
      lowPowerTextureOff: this.state.lowPowerTextureOff,
      leftHandedDial: this.state.leftHandedDial,
      soundEnabled: this.state.soundEnabled,
    };
    this.state = { ...createInitialAppState({ blankMode }), ...keepPrefs };
    this.rebuildTimeline(false);
    this.applyDefaultWeights(true);
    this.emit('reset');
  }

  /**
   * 10-second in-memory undoable hard delete for PRIVATE records (§11.3, §13 #7).
   * After 10s, content is purged permanently from memory without leaving history.
   * School items CANNOT be deleted — they are only hidden ("标记为与我无关").
   */
  deletePrivateItem(itemId, onFinalPurge = null) {
    const idx = this.state.items.findIndex((x) => x.id === itemId);
    if (idx < 0) return { ok: false, reason: '未找到该事项' };
    const item = this.state.items[idx];
    const isPersonal = item.epistemicKind === 'personal_record' || item.kind === 'memory' || item.kind === 'block';
    if (!isPersonal) {
      return { ok: false, reason: '学校或班级来源的事项不能删除，可改为“标记为与我无关并隐藏”。' };
    }

    this.state.items.splice(idx, 1);
    const expiresAt = Date.now() + 10000;
    const timer = setTimeout(() => {
      // Permanent purge from memory after 10 seconds (zero residual content!)
      this.pendingHardDeletes.delete(itemId);
      // Also strip from undo stack so content truly disappears (§11.3)
      this.undoStack = this.undoStack.map((s) => ({
        ...s,
        items: s.items.filter((x) => x.id !== itemId),
      }));
      if (onFinalPurge) onFinalPurge(itemId);
    }, 10000);

    this.pendingHardDeletes.set(itemId, { item, timer, expiresAt });
    this.emit('delete_private');
    return {
      ok: true,
      item,
      expiresAt,
      backupNotice: '10 秒后将彻底清除，不留历史记录；你此前导出的本地备份文件中仍会保留该条。',
    };
  }

  undoPrivateDelete(itemId) {
    const entry = this.pendingHardDeletes.get(itemId);
    if (!entry) return false;
    clearTimeout(entry.timer);
    this.pendingHardDeletes.delete(itemId);
    this.state.items.push(entry.item);
    this.emit('undo_delete');
    return true;
  }

  /**
   * School items cannot be deleted; hide as irrelevant instead (§11.3).
   */
  toggleHideSchoolItem(itemId, hidden = true) {
    const item = this.state.items.find((x) => x.id === itemId);
    if (!item) return false;
    this.pushUndo(hidden ? `隐藏「${item.title}」` : `恢复显示「${item.title}」`);
    item.hiddenByStudent = hidden;
    this.emit('hide_school_item');
    return true;
  }

  /**
   * Whole-batch import rollback (§8.7, §11.3).
   * Removes generated events and lineage layers belonging to `batchId`.
   */
  undoImportBatch(batchId, { keepRawMessages = false } = {}) {
    const bIdx = this.state.importBatches.findIndex((b) => b.id === batchId);
    if (bIdx < 0) return false;
    const batch = this.state.importBatches[bIdx];
    this.state.importBatches.splice(bIdx, 1);

    // Remove newly created items from this batch
    this.state.items = this.state.items.filter((item) => item.batchId !== batchId);

    // Strip lineage layers added by this batch from pre-existing items and restore previous active layer
    for (const item of this.state.items) {
      if (!item.lineage || item.lineage.length === 0) continue;
      const before = item.lineage.length;
      item.lineage = item.lineage.filter((l) => l.batchId !== batchId);
      if (item.lineage.length !== before && item.lineage.length > 0) {
        const latest = item.lineage[0];
        latest.layerStatus = 'active';
        if (latest.proposedDateIso) {
          item.dateIso = latest.proposedDateIso;
          item.startHour = latest.proposedStartHour ?? null;
          item.endHour = latest.proposedEndHour ?? null;
          item.form = item.startHour != null ? 'occupation' : (item.kind === 'task' ? 'task_channel' : 'day_fog');
          item.status = item.kind === 'task' ? 'not_started' : 'planned';
        }
      }
    }

    // Remove fingerprints so the student can re-import cleanly if desired
    const fpSet = new Set(batch.addedFingerprints || []);
    this.state.seenFingerprints = this.state.seenFingerprints.filter((fp) => !fpSet.has(fp));

    if (!keepRawMessages) {
      this.state.unparsedMessages = this.state.unparsedMessages.filter((u) => u.batchId !== batchId);
    }

    this.emit('undo_batch');
    return true;
  }

  /**
   * Update school config (Issue #6: departure/return/evening-study & boundary modes).
   * Immediately updates the live Return Wall and timetable rings!
   */
  updateSchoolConfig(patch) {
    this.pushUndo('修改作息与边界设置');
    Object.assign(this.state.config, patch);
    // Sync Return Wall item with new returnHour & verification label
    for (const item of this.state.items) {
      if (item.isReturnWall) {
        item.startHour = this.state.config.returnHour;
        item.dueHour = this.state.config.returnHour;
        item.title = `返校时刻${this.state.config.returnVerified ? '' : '（待核实 · 点此配置）'}`;
        item.sourceSummary = this.state.config.returnVerified
          ? `${this.state.config.schoolName} · 已确认作息`
          : `${this.state.config.schoolName} · 演示占位（尚未核实，可点击修改）`;
      }
      if (item.dueLabel === '周日返校前') {
        item.dueHour = this.state.config.returnHour;
      }
    }
    this.rebuildTimeline(false);
    this.emit('config_update');
  }

  /**
   * One-way, undoable HAIZ Pocket `PersonalSnapshot` JSON migration (Master v4 §14)!
   * - Skips `example: true` starter rows
   * - Maps `TaskItem`: completed -> 'done'; uncompleted + future -> 'not_started';
   *   uncompleted + past -> 'unknown' ("软件不知道", NEVER overdue!)
   * - Date-only `dueIso` stays date precision ("当天前"), never invents 23:59
   * - Maps `CourseSlot` -> weekly timetable courses
   * - Maps `FocusLog` -> standalone Trace (`迹`), never touches ring geometry
   * - Preserves `taskNotes` and `originalNotice` as Lineage Layer 1
   */
  migrateFromPocketSnapshot(jsonInput) {
    const raw = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
    const snap = raw.snapshot || raw; // supports both PersonalBackup wrapper & raw PersonalSnapshot
    if (!snap || typeof snap !== 'object') {
      throw new Error('不是有效的 HAIZ Pocket 个人备份 JSON。');
    }

    this.pushUndo('从 HAIZ Pocket 迁移数据');
    const batchId = createId('pocket_mig');
    const notesMap = snap.taskNotes || {};
    const nowDate = parseIsoDate(this.state.nowIso);

    let migratedTasks = 0;
    let skippedExamples = 0;
    let migratedCourses = 0;
    let migratedTraces = 0;

    // 1. Tasks
    for (const t of snap.tasks || []) {
      if (t.example === true) {
        skippedExamples++;
        continue;
      }
      const dueIso = t.dueIso ? String(t.dueIso).slice(0, 10) : null;
      const isPast = dueIso ? parseIsoDate(dueIso) < nowDate : false;
      const status = t.completed
        ? 'done'
        : (isPast ? 'unknown' : 'not_started'); // §14 critical rule!

      const hasDate = Boolean(dueIso);
      const item = {
        id: createId('pk_tk'),
        batchId,
        kind: 'task',
        subject: t.subject || '其他',
        title: t.title || '未命名任务',
        epistemicKind: t.originalNotice ? 'plan' : 'personal_record',
        status,
        form: hasDate ? 'task_channel' : 'fog',
        dateIso: dueIso,
        dueIso,
        dueHour: null, // Date-only dueIso NEVER invents 23:59 (§14)
        dueLabel: hasDate ? `${dueIso.slice(5)} 当天前` : '无截止日期（迁移自 Pocket）',
        channelStartIso: hasDate ? (isPast ? dueIso : this.state.nowIso) : null,
        fogFromIso: hasDate ? null : this.state.nowIso,
        fogToIso: hasDate ? null : toIsoDate(new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + 7)),
        notes: notesMap[t.id] || '',
        sourceSummary: `从 HAIZ Pocket 迁移${t.source ? ` · ${t.source}` : ''}`,
        lineage: t.originalNotice ? [{
          id: createId('lyr'),
          batchId,
          sender: t.source || 'Pocket 原记录',
          originalAuthor: t.source || 'Pocket 原记录',
          sourceLabel: 'Pocket 迁移 · 原始通知',
          originChannel: 'unknown',
          directness: 'verbatim_forward',
          scopeMatch: 'exact',
          effectiveScore: 60,
          originalSentIso: null,
          rawText: t.originalNotice,
          layerStatus: 'active',
          verdictReason: '单向复制自 HAIZ Pocket 原文，原数据未被修改',
        }] : [],
        isDemo: false,
      };
      this.state.items.push(item);
      migratedTasks++;
    }

    // 2. Courses
    const nonExampleCourses = (snap.courses || []).filter((c) => c.example !== true);
    if (nonExampleCourses.length > 0) {
      this.state.courses = nonExampleCourses.map((c) => ({ ...c, isDemo: false }));
      migratedCourses = nonExampleCourses.length;
    }

    // 3. FocusLogs -> standalone Traces (迹), NEVER entering annual ring geometry (§14)
    for (const log of snap.focusLogs || []) {
      const atDate = log.at ? String(log.at).slice(0, 10) : this.state.nowIso;
      const dt = log.at ? new Date(log.at) : null;
      const startHr = dt && !Number.isNaN(dt.getTime()) ? dt.getHours() + dt.getMinutes() / 60 : null;
      const mins = Number(log.minutes) || 25;
      this.state.items.push({
        id: createId('pk_tr'),
        batchId,
        kind: 'trace_log',
        subject: '投入',
        title: `投入迹 · ${log.label || '自主学习'}（${mins} 分钟）`,
        epistemicKind: 'personal_record',
        status: 'confirmed_happened',
        form: 'trace',
        dateIso: atDate,
        startHour: startHr,
        endHour: startHr != null ? Math.min(23, startHr + mins / 60) : null,
        loggedMinutes: mins,
        durationMinutes: mins,
        sourceSummary: '从 HAIZ Pocket 专注记录迁移（不影响年轮几何）',
        isPrivate: true,
        lineage: [],
        isDemo: false,
      });
      migratedTraces++;
    }

    this.state.importBatches.unshift({
      id: batchId,
      label: `HAIZ Pocket 迁移（${migratedTasks} 任务 · ${migratedCourses} 课程 · ${migratedTraces} 投入迹）`,
      createdAt: new Date().toISOString(),
      addedFingerprints: [],
    });

    this.rebuildTimeline(false);
    this.emit('pocket_migration');
    return { batchId, migratedTasks, skippedExamples, migratedCourses, migratedTraces };
  }

  /**
   * Export full local JSON backup (excluding transient UI fields).
   */
  exportJsonBackup() {
    return JSON.stringify({
      format: 'haiz-nianlun-v4-backup',
      exportedAt: new Date().toISOString(),
      note: '本地私人备份文件，未加密，请勿发至公开群聊。',
      state: this.state,
    }, null, 2);
  }

  /**
   * RFC 5545 .ics export (adapted directly from HAIZ Pocket `CalendarExport`!)
   * Keeps date-only due dates as all-day VEVENTs without fabricating exact hours.
   */
  exportIcs() {
    const esc = (v) => String(v || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r\n/g, '\n')
      .replace(/\n/g, '\\n');
    const ymd = (iso) => String(iso).replace(/-/g, '');
    const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//HAIZ//NIANLUN V4//ZH',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    for (const item of this.state.items) {
      if (item.hiddenByStudent || item.isReturnWall) continue;
      if (this.state.privacyLocked && (item.kind === 'memory' || item.isPrivate)) continue;
      if (item.status === 'done' || item.status === 'cancelled' || item.status === 'not_needed') continue;
      const iso = item.dueIso || item.dateIso;
      if (!iso) continue;
      const d = parseIsoDate(iso);
      const next = toIsoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
      lines.push(
        'BEGIN:VEVENT',
        `UID:${esc(item.id)}@haiz-nianlun-v4`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${ymd(iso)}`,
        `DTEND;VALUE=DATE:${ymd(next)}`,
        `SUMMARY:${esc(item.subject)} · ${esc(item.title)}`,
        `DESCRIPTION:${esc(item.sourceSummary || '')}`,
        'END:VEVENT',
      );
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }
}
