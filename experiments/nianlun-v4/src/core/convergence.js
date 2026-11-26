/**
 * HAIZ · NIANLUN · 一卷 V4 — Information Convergence & Provenance Engine
 *
 * Implements Master v4 §8 AND solves Issue #3:
 *   Authority is NEVER judged mechanically by sender identity alone!
 *   It evaluates FOUR explicit dimensions:
 *     1. originChannel (原始出处 — separated from forwarder!)
 *     2. directness (原发通知 / 原文转发 / 转述 / 听闻)
 *     3. scopeMatch (职责范围 — e.g. chemistry teacher commenting on physics exam is out-of-scope!)
 *     4. temporalAnchor (原始发布时间 vs 转发/导入时间 — prevents outdated forwards from overwriting newer notices!)
 *
 * Reuses HAIZ Pocket's conservative "don't guess when uncertain" philosophy and FNV-1a dual-hash dedup.
 */

import {
  ORIGIN_CHANNELS,
  DIRECTNESS_LEVELS,
  createId,
  messageFingerprint,
  normalizeNoticeText,
} from './model.js';
import { addDays, parseIsoDate, toIsoDate, weekdayIndex } from './calendar.js';

const SUBJECTS = [
  '语文', '数学', '英语', '物理', '化学', '生物',
  '历史', '地理', '政治', '体育', '信息', '通用',
];

const EVENT_TYPE_RULES = [
  { type: 'exam', regex: /月考|期中|期末|考试|测验|统测|模考|模拟考|小测|听写|考(?:语文|数学|英语|物理|化学|生物|历史|地理|政治)/ },
  { type: 'task', regex: /作业|练习|试卷|卷子|作文|实验报告|交齐|上交|提交|背诵|默写|预习|整理|完成/ },
  { type: 'activity', regex: /体检|运动会|彩排|升旗|班会|社团|开放日|讲座|核酸|疫苗|家长会/ },
  { type: 'schedule_change', regex: /调课|换课|改上|停课|补课|(?:离校|返校|放假)(?:时间|改|调|提前|推迟|延后|定在|\s*\d)/ },
];

const CANCEL_REGEX = /取消|不考了|不用交|免交|停办|作废/;
const POSTPONE_TBD_REGEX = /延期|推迟|另行通知|待定|时间未定|改期.*另行|暂缓/;
const RESTORE_REGEX = /照常|恢复|如期进行|按原计划/;
const RESCHEDULE_REGEX = /改到|改为|调到|调至|推迟到|延后到|提前到|换到/;
const RUMOR_REGEX = /听说|好像|据说|大概|可能|疑似|听同学说|应该是在/;
const VERBATIM_FORWARD_REGEX = /转发自?【([^】]+)】|原通知[:：]|【(海南中学|高[一二三]年级组?|教务处|德育处)[^】]*】/;

/**
 * Parse Chinese relative/absolute date anchored strictly to `referenceDate` (originalSentAt!).
 * Never uses import time when originalSentAt is missing — instead returns `ambiguous: true` (Fog!).
 */
export function parseChineseTemporal(text, referenceDate) {
  const raw = String(text || '');
  const result = {
    dateIso: null,
    dateEndIso: null,
    startHour: null,
    endHour: null,
    periodHint: null,
    durationMinutes: null,
    precision: 'none', // 'time' | 'day' | 'range' | 'none'
    derivation: '',
    needsAnchorDate: false,
    isTbd: POSTPONE_TBD_REGEX.test(raw),
  };

  // Extract duration (e.g. "约40分钟", "1小时", "90分钟")
  const durMin = raw.match(/约?\s*(\d{1,3})\s*分钟/);
  const durHr = raw.match(/约?\s*(\d(?:\.\d)?)\s*(?:个)?小时/);
  if (durMin) result.durationMinutes = Number(durMin[1]);
  else if (durHr) result.durationMinutes = Math.round(Number(durHr[1]) * 60);

  // Extract explicit clock time range or single time (e.g. "15:20-16:00", "17:00前", "下午3点半")
  const timeRange = raw.match(/(\d{1,2})[:：](\d{2})\s*[-–—~至到]\s*(\d{1,2})[:：](\d{2})/);
  const singleTime = raw.match(/(\d{1,2})[:：](\d{2})/);
  const periodMatch = raw.match(/第\s*([一二三四五六七八1-8])\s*节/);
  if (timeRange) {
    result.startHour = Number(timeRange[1]) + Number(timeRange[2]) / 60;
    result.endHour = Number(timeRange[3]) + Number(timeRange[4]) / 60;
  } else if (singleTime) {
    result.startHour = Number(singleTime[1]) + Number(singleTime[2]) / 60;
  } else if (periodMatch) {
    const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8 };
    const pNum = map[periodMatch[1]] || Number(periodMatch[1]);
    result.periodHint = `第${pNum}节`;
    // Map to Hainan Middle School reference slots (explicitly labeled as reference!)
    const refHours = {
      1: [8.0, 8.67], 2: [8.83, 9.5], 3: [9.67, 10.33], 4: [10.67, 11.33],
      5: [11.5, 12.17], 6: [14.75, 15.42], 7: [15.58, 16.25], 8: [16.5, 17.17],
    };
    if (refHours[pNum]) {
      result.startHour = refHours[pNum][0];
      result.endHour = refHours[pNum][1];
    }
  }

  if (result.isTbd) {
    result.precision = 'range';
    result.derivation = '原文明确写明"另行通知 / 待定" → 不猜测具体日期，保持为雾';
    return result;
  }

  // Absolute YYYY-MM-DD / YYYY年M月D日
  const absYmd = raw.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})[日号]?/);
  if (absYmd) {
    const d = new Date(Number(absYmd[1]), Number(absYmd[2]) - 1, Number(absYmd[3]));
    result.dateIso = toIsoDate(d);
    result.precision = result.startHour != null ? 'time' : 'day';
    result.derivation = `绝对日期 ${result.dateIso}`;
    return result;
  }

  // Month-Day (e.g. "12月3日")
  const md = raw.match(/(\d{1,2})月(\d{1,2})[日号]/);
  if (md) {
    const year = referenceDate ? referenceDate.getFullYear() : 2026;
    const d = new Date(year, Number(md[1]) - 1, Number(md[2]));
    result.dateIso = toIsoDate(d);
    result.precision = result.startHour != null ? 'time' : 'day';
    result.derivation = `明确日期 ${md[1]}月${md[2]}日`;
    return result;
  }

  // Relative date expressions — MUST have referenceDate (originalSentAt)
  const relDayMatch = raw.match(/(大后天|后天|明天|今天|今晚)/);
  const relWeekDayMatch = raw.match(/(下周|本周|这周|周|星期)([一二三四五六日天])/);
  const relVagueWeek = raw.match(/(下周|这周|本周)(?:某天|内|左右|找时间)?/);

  if (relDayMatch || relWeekDayMatch || relVagueWeek) {
    if (!referenceDate) {
      result.needsAnchorDate = true;
      result.precision = 'range';
      const tok = (relDayMatch && relDayMatch[0]) || (relWeekDayMatch && relWeekDayMatch[0]) || (relVagueWeek && relVagueWeek[0]);
      result.derivation = `含相对日期"${tok}"，但缺少原始发送日期 → 不猜日期，先放成雾并向你确认`;
      return result;
    }

    const refIso = toIsoDate(referenceDate);
    const refWd = weekdayIndex(referenceDate); // 0=Mon..6=Sun

    if (relDayMatch) {
      const tok = relDayMatch[1];
      const deltaMap = { 今天: 0, 今晚: 0, 明天: 1, 后天: 2, 大后天: 3 };
      const target = addDays(referenceDate, deltaMap[tok]);
      result.dateIso = toIsoDate(target);
      result.precision = result.startHour != null ? 'time' : 'day';
      result.derivation = `"${tok}" → ${result.dateIso}（按消息原发日 ${refIso} 推算）`;
      return result;
    }

    if (relWeekDayMatch) {
      const prefix = relWeekDayMatch[1];
      const wdChar = relWeekDayMatch[2];
      const wdMap = { 一: 0, 二: 1, 三: 2, 四: 3, 五: 4, 六: 5, 日: 6, 天: 6 };
      const targetWd = wdMap[wdChar];
      let delta;
      if (prefix === '下周') {
        delta = (7 - refWd) + targetWd;
      } else if (prefix === '本周' || prefix === '这周') {
        delta = targetWd - refWd;
      } else {
        // Bare "周三": same week if >= refWd, else next week
        delta = targetWd >= refWd ? targetWd - refWd : (7 - refWd) + targetWd;
      }
      const target = addDays(referenceDate, delta);
      result.dateIso = toIsoDate(target);
      result.precision = result.startHour != null ? 'time' : 'day';
      result.derivation = `"${prefix}${wdChar}" → ${result.dateIso}（按消息原发日 ${refIso} 周${['一','二','三','四','五','六','日'][refWd]}推算）`;
      return result;
    }

    if (relVagueWeek) {
      const prefix = relVagueWeek[1];
      const mondayOffset = prefix === '下周' ? (7 - refWd) : -refWd;
      const mon = addDays(referenceDate, mondayOffset);
      const fri = addDays(mon, 4);
      result.dateIso = toIsoDate(mon);
      result.dateEndIso = toIsoDate(fri);
      result.precision = 'range';
      result.derivation = `"${prefix}"未指明具体某天 → 保持为 ${result.dateIso} 至 ${result.dateEndIso} 的雾`;
      return result;
    }
  }

  return result;
}

/**
 * Evaluate multi-dimensional provenance (Issue #3).
 * Never relies purely on sender role! Evaluates:
 *   originChannel × directness × scopeMatch × temporalAnchor
 */
export function evaluateProvenance(msg, eventSubject, eventKind) {
  const text = String(msg.text || '');

  // 1. Detect if sender forwarded an official/original notice verbatim
  let originChannel = msg.originChannel || 'unknown';
  let directness = msg.directness || 'original';
  let detectedForwardOrigin = null;

  const fwdMatch = text.match(VERBATIM_FORWARD_REGEX);
  if (fwdMatch) {
    detectedForwardOrigin = fwdMatch[1] || fwdMatch[2];
    if (msg.senderChannel === 'peer_parent' || originChannel === 'peer_parent') {
      directness = msg.directness || 'verbatim_forward';
      if (/年级|学校|教务|德育|海南中学/.test(detectedForwardOrigin)) {
        originChannel = 'official_grade';
      } else if (/班主任/.test(detectedForwardOrigin)) {
        originChannel = 'homeroom_teacher';
      } else if (/老师/.test(detectedForwardOrigin)) {
        originChannel = 'subject_teacher';
      }
    }
  }

  // Detect rumor phrasing even from higher roles
  if (RUMOR_REGEX.test(text) && directness === 'original') {
    directness = 'rumor';
  }

  const originMeta = ORIGIN_CHANNELS[originChannel] || ORIGIN_CHANNELS.unknown;
  const directMeta = DIRECTNESS_LEVELS[directness] || DIRECTNESS_LEVELS.paraphrase;

  // 2. Scope match (职责范围)
  let scopeMatch = 'exact'; // 'exact' | 'relay' | 'out_of_scope' | 'unknown'
  let scopeNote = '职责范围匹配';
  const senderSubject = msg.senderSubject || '';

  if (originChannel === 'official_grade') {
    scopeMatch = 'exact';
    scopeNote = '年级/校级统一职责范围';
  } else if (originChannel === 'homeroom_teacher') {
    if (eventKind === 'task' && eventSubject && senderSubject && eventSubject !== senderSubject) {
      scopeMatch = 'relay';
      scopeNote = '班主任转达学科安排';
    } else {
      scopeMatch = 'exact';
      scopeNote = '班主任班级事务职责范围';
    }
  } else if (originChannel === 'subject_teacher' || originChannel === 'class_committee') {
    if (senderSubject && eventSubject && eventSubject !== '其他' && senderSubject !== eventSubject) {
      scopeMatch = 'out_of_scope';
      scopeNote = `跨学科发言（${senderSubject}来源提及${eventSubject}，不自动覆盖本学科任课通知）`;
    } else {
      scopeMatch = 'exact';
      scopeNote = `${senderSubject || '本学科'}${originMeta.label}职责范围`;
    }
  } else if (originChannel === 'peer_parent') {
    scopeMatch = directness === 'verbatim_forward' ? 'relay' : 'out_of_scope';
    scopeNote = directness === 'verbatim_forward'
      ? '家长/同学原文转发（保留原出处但需核实截图完整度）'
      : '同学/家长口头转述（仅作附注）';
  } else if (originChannel === 'student_self') {
    scopeMatch = 'exact';
    scopeNote = '学生本人记录 / 估计';
  } else {
    scopeMatch = 'unknown';
    scopeNote = '来源身份未确认';
  }

  const scopeFactor = { exact: 1.0, relay: 0.85, out_of_scope: 0.45, unknown: 0.4 }[scopeMatch] || 0.5;
  const effectiveScore = Math.round(originMeta.baseWeight * directMeta.multiplier * scopeFactor);

  // Can this message authoritatively supersede an existing active layer?
  const canSupersede = (existingLayer) => {
    if (!existingLayer) return { action: 'create', reason: `${originMeta.label} · ${directMeta.label} · ${scopeNote}` };

    // Rumor or out-of-scope NEVER silently overwrites an authoritative layer!
    if (directness === 'rumor' || scopeMatch === 'out_of_scope' || originChannel === 'unknown') {
      return {
        action: 'advisory_rumor',
        reason: `${originMeta.label}（${directMeta.label}，${scopeNote}）→ 仅作附注，不覆盖当前有效安排`,
      };
    }

    // Temporal anchor guard: an OLDER original notice forwarded later MUST NOT overwrite a newer notice!
    if (msg.originalSentIso && existingLayer.originalSentIso) {
      const incomingTime = Date.parse(msg.originalSentIso);
      const existingTime = Date.parse(existingLayer.originalSentIso);
      if (!Number.isNaN(incomingTime) && !Number.isNaN(existingTime) && incomingTime < existingTime) {
        return {
          action: 'outdated_forward',
          reason: `原发时间（${msg.originalSentIso.slice(5, 16).replace('T', ' ')}）早于当前有效层（${existingLayer.originalSentIso.slice(5, 16).replace('T', ' ')}）→ 判定为旧通知重转，保留在谱系但不覆盖`,
        };
      }
    }

    // Compare effective multi-dimensional authority
    const existingScore = existingLayer.effectiveScore ?? 50;
    if (effectiveScore >= existingScore - 5) {
      // Verbatim forward from parent of an official notice needs student confirmation if unverified
      if (directness === 'verbatim_forward' && msg.senderChannel === 'peer_parent' && !msg.verifiedForward) {
        return {
          action: 'confirm_supersede',
          reason: `转发自「${detectedForwardOrigin || originMeta.label}」（有效权值 ${effectiveScore} ≥ ${existingScore}），请确认原文无截断后覆盖旧层`,
        };
      }
      return {
        action: 'supersede',
        reason: `${originMeta.label} · ${directMeta.label} · ${scopeNote}（权值 ${effectiveScore}，晚于旧层）→ 更新当前安排，旧层划线保留`,
      };
    }

    return {
      action: 'conflict_needs_review',
      reason: `与更早的「${existingLayer.sourceLabel}」（权值 ${existingScore}）存在不一致（当前 ${effectiveScore}）→ 标注不一致，由你决定是否采纳`,
    };
  };

  return {
    originChannel,
    originLabel: originMeta.label,
    directness,
    directLabel: directMeta.label,
    scopeMatch,
    scopeNote,
    effectiveScore,
    detectedForwardOrigin,
    canSupersede,
  };
}

/**
 * Extract structured candidate info from a raw Chinese school message.
 * Conservative ("没看懂不猜", Master v4 §8.5): returns `confidence: 'unparsed'` if unrecognizable.
 */
export function parseIncomingMessage(msg) {
  const text = String(msg.text || '').trim();
  if (!text) return null;

  // Support HAIZ Pocket structured export: 【HAIZ任务】科目｜标题｜日期｜来源
  const haizStructured = text.match(/^【HAIZ任务】\s*([^｜|]+)[｜|]([^｜|]+)[｜|](\d{4}-\d{2}-\d{2}|待定)(?:[｜|](.*))?$/);
  if (haizStructured) {
    const due = haizStructured[3] === '待定' ? null : haizStructured[3];
    return {
      parsed: true,
      confidence: due ? 'high' : 'review',
      subject: haizStructured[1].trim(),
      eventType: 'task',
      intent: 'create_or_update',
      title: haizStructured[2].trim(),
      temporal: {
        dateIso: due,
        dateEndIso: null,
        startHour: null,
        endHour: null,
        durationMinutes: null,
        precision: due ? 'day' : 'range',
        derivation: due ? `HAIZ 结构化任务 · ${due}` : 'HAIZ 结构化任务 · 日期待定',
        needsAnchorDate: false,
        isTbd: !due,
      },
      fingerprint: messageFingerprint(msg),
    };
  }

  // Detect subject
  let subject = '其他';
  for (const s of SUBJECTS) {
    if (text.includes(s)) {
      subject = s;
      break;
    }
  }

  // Detect event type
  let eventType = null;
  for (const rule of EVENT_TYPE_RULES) {
    if (rule.regex.test(text)) {
      eventType = rule.type;
      break;
    }
  }

  // Detect intent
  let intent = 'create_or_update';
  if (RESTORE_REGEX.test(text)) intent = 'restore';
  else if (CANCEL_REGEX.test(text) && !POSTPONE_TBD_REGEX.test(text)) intent = 'cancel';
  else if (POSTPONE_TBD_REGEX.test(text)) intent = 'postpone_tbd';
  else if (RESCHEDULE_REGEX.test(text)) intent = 'reschedule';

  const refDate = msg.originalSentIso ? parseIsoDate(msg.originalSentIso.slice(0, 10)) : null;
  const temporal = parseChineseTemporal(text, refDate);

  // If no recognizable event type AND no temporal signal AND no action keyword -> UNPARSED (§8.5)
  const hasActionOrEvent = Boolean(eventType) || intent !== 'create_or_update';
  if (!hasActionOrEvent && temporal.precision === 'none') {
    return {
      parsed: false,
      confidence: 'unparsed',
      subject,
      eventType: 'unknown',
      intent: 'unparsed',
      title: text.slice(0, 28),
      temporal,
      reason: '没看懂这条消息里有没有具体安排或截止时间，原文已完整保留，你可以手动选出或忽略。',
      fingerprint: messageFingerprint(msg),
    };
  }

  // Build concise human title
  let cleanTitle = text
    .replace(/^转发自?【[^】]+】[:：]?\s*/, '')
    .replace(/^【[^】]+】\s*/, '')
    .replace(/^(老师通知|班主任通知|通知|作业|提醒)[:：]\s*/, '')
    .trim();

  let title;
  if (eventType === 'exam') {
    if (cleanTitle.includes('月考')) title = subject !== '其他' ? `${subject}月考` : '月考';
    else if (cleanTitle.includes('期中')) title = '期中考试';
    else if (cleanTitle.includes('期末')) title = '期末考试';
    else title = subject !== '其他' ? `${subject}考试` : cleanTitle.slice(0, 18);
  } else if (eventType === 'activity' && cleanTitle.includes('体检')) {
    title = '全校体检';
  } else {
    title = cleanTitle.length > 22 ? `${cleanTitle.slice(0, 22)}…` : cleanTitle;
  }

  const confidence = (temporal.needsAnchorDate || temporal.isTbd || RUMOR_REGEX.test(text))
    ? 'review'
    : 'high';

  return {
    parsed: true,
    confidence,
    subject,
    eventType: eventType || 'task',
    intent,
    title,
    temporal,
    fingerprint: messageFingerprint(msg),
  };
}

/**
 * Find whether an incoming parsed message matches an existing item (for convergence / lineage merging).
 * Obeys Master v4 §8.4: same subject + same type + temporal window overlap + keyword match.
 * Never merges a current-week update into a month-old elapsed composite exam!
 */
export function findMergeTarget(parsed, existingItems, refIso = null) {
  if (!parsed || !parsed.parsed) return null;

  const incomingDate = parsed.temporal.dateIso
    ? parseIsoDate(parsed.temporal.dateIso)
    : (refIso ? parseIsoDate(refIso.slice(0, 10)) : null);

  let best = null;
  let bestScore = 0;

  for (const item of existingItems) {
    if (item.kind === 'memory' || item.kind === 'return_wall' || item.hiddenByStudent) continue;
    // Never silently merge a live update into a past elapsed/confirmed historical item
    if (item.status === 'plan_elapsed' || item.status === 'confirmed_happened') continue;

    // Temporal window check (within ±16 days, or active Fog/TBD!)
    const itemIso = item.dateIso || item.fogFromIso || item.dueIso;
    if (incomingDate && itemIso && item.form !== 'fog' && item.status !== 'tbd') {
      const gapDays = Math.abs(Math.round((parseIsoDate(itemIso) - incomingDate) / 86400000));
      if (gapDays > 16) continue;
    }

    const sameSubject = parsed.subject !== '其他' && item.subject === parsed.subject;
    const itemType = item.kind === 'exam' ? 'exam' : item.kind === 'task' ? 'task' : 'activity';
    const sameType = itemType === parsed.eventType || (parsed.intent !== 'create_or_update' && itemType === 'exam');

    // Avoid merging a single-subject quiz ("物理考试") into a composite exam ("月考/期中/期末")
    // or a specialized competition ("竞赛/初筛/选拔") unless both match that category!
    const itemIsComposite = /月考|期中|期末|学业水平/.test(item.title);
    const incomingIsComposite = /月考|期中|期末|学业水平/.test(parsed.title);
    const itemIsCompetition = /竞赛|初筛|选拔|奥赛/.test(item.title);
    const incomingIsCompetition = /竞赛|初筛|选拔|奥赛/.test(parsed.title);

    if (sameSubject && sameType && parsed.eventType === 'exam') {
      if (itemIsComposite !== incomingIsComposite) continue;
      if (itemIsCompetition !== incomingIsCompetition) continue;
      const score = item.lineage && item.lineage.length > 0 ? 100 : 80;
      if (score > bestScore) {
        bestScore = score;
        best = { item, matchReason: `同一科目（${parsed.subject}）+ 同一类型（考试）+ 时间窗口重合` };
      }
      continue;
    }

    // Shared meaningful keyword (e.g. "体检", "实验报告", "第三章")
    const normTitle = normalizeNoticeText(item.title);
    const normIncoming = normalizeNoticeText(parsed.title);
    const keywords = ['体检', '实验报告', '第三章', '运动会', '彩排', '社团报名', '作文', '练习册'];
    for (const kw of keywords) {
      if (normTitle.includes(kw) && normIncoming.includes(kw)) {
        // Don't merge a homework task ("第三章练习") into an exam ("物理考试")!
        if (itemType !== parsed.eventType && parsed.intent === 'create_or_update') continue;
        const score = 90;
        if (score > bestScore) {
          bestScore = score;
          best = { item, matchReason: `核心关键词「${kw}」与科目、类型重合` };
        }
      }
    }
  }
  return best;
}

/**
 * Split a batch quick-input sentence (e.g. "周三物理考试，周四交实验报告") into multiple messages (§8.8 #5).
 */
export function splitQuickBatchText(raw, referenceIso) {
  const chunks = String(raw || '')
    .split(/[。；;\n]+|(?=[，,]\s*(?:下周|本周|这周|周[一二三四五六日天]|明天|后天|大后天|\d{1,2}月))/)
    .map((s) => s.replace(/^[，,\s]+/, '').trim())
    .filter((s) => s.length >= 3);

  return chunks.map((chunk) => ({
    id: createId('msg'),
    sender: '我自己（快速输入）',
    senderChannel: 'student_self',
    originChannel: 'student_self',
    directness: 'original',
    originalSentIso: referenceIso,
    text: chunk,
  }));
}

/**
 * Apply one incoming message into a cloned item list + provenance audit record.
 * Supports: duplicate skipping, near-duplicate warning, lineage stacking,
 * cancel/restore, outdated-forward guard, rumor annotation, undated screenshot Fog, unparsed preservation.
 */
export function convergeMessage(msg, state, { nowIso, batchId }) {
  const fp = messageFingerprint(msg);

  // 1. Exact duplicate check (FNV dual hash, §8.4)
  if (state.seenFingerprints.includes(fp)) {
    return {
      outcome: 'duplicate_skipped',
      summary: '与已导入消息完全相同（FNV 双哈希一致），已自动跳过，未生成重复事项。',
      fingerprint: fp,
      targetItemId: null,
      created: false,
    };
  }

  const parsed = parseIncomingMessage(msg);
  if (!parsed || !parsed.parsed) {
    return {
      outcome: 'unparsed_saved',
      summary: parsed ? parsed.reason : '消息为空，未生成事项。',
      fingerprint: fp,
      unparsedRecord: {
        id: createId('raw'),
        batchId,
        sender: msg.sender || '未知来源',
        originalSentIso: msg.originalSentIso || null,
        text: msg.text,
        reason: parsed ? parsed.reason : '无法识别',
      },
      created: false,
    };
  }

  const match = findMergeTarget(parsed, state.items, msg.originalSentIso || nowIso);
  const targetSubject = match ? match.item.subject : parsed.subject;
  const targetKind = match ? match.item.kind : (parsed.eventType === 'exam' ? 'exam' : parsed.eventType === 'task' ? 'task' : 'event');
  const provenance = evaluateProvenance(msg, targetSubject, targetKind);

  // Build new lineage layer
  const buildLayer = (statusFlag, verdictReason, restoredFrom = null) => ({
    id: createId('lyr'),
    batchId,
    fingerprint: fp,
    sender: msg.sender || provenance.originLabel,
    originalAuthor: msg.originalAuthor || provenance.detectedForwardOrigin || msg.sender || provenance.originLabel,
    sourceLabel: `${provenance.originLabel} · ${provenance.directLabel}`,
    originChannel: provenance.originChannel,
    directness: provenance.directness,
    scopeMatch: provenance.scopeMatch,
    scopeNote: provenance.scopeNote,
    effectiveScore: provenance.effectiveScore,
    originalSentIso: msg.originalSentIso || null,
    importedAtIso: nowIso,
    rawText: msg.text,
    derivation: parsed.temporal.derivation || '',
    proposedDateIso: parsed.temporal.dateIso,
    proposedDateEndIso: parsed.temporal.dateEndIso,
    proposedStartHour: parsed.temporal.startHour,
    proposedEndHour: parsed.temporal.endHour,
    proposedPrecision: parsed.temporal.precision,
    intent: parsed.intent,
    layerStatus: statusFlag, // 'active' | 'superseded' | 'rumor' | 'conflict' | 'outdated'
    verdictReason,
    restoredFrom,
  });

  if (match) {
    const item = match.item;
    const activeLayer = (item.lineage || []).find((l) => l.layerStatus === 'active');
    const verdict = provenance.canSupersede(activeLayer);

    // Handle RESTORE ("考试照常" -> recovers last valid non-cancelled time!)
    if (parsed.intent === 'restore' && (verdict.action === 'supersede' || verdict.action === 'confirm_supersede')) {
      const lastValid = (item.lineage || []).find(
        (l) => (l.layerStatus === 'superseded' || l.layerStatus === 'active')
          && l.proposedDateIso
          && l.intent !== 'cancel'
          && l.intent !== 'postpone_tbd',
      );
      for (const l of item.lineage) {
        if (l.layerStatus === 'active') l.layerStatus = 'superseded';
      }
      const newLayer = buildLayer('active', `恢复原安排 · ${verdict.reason}`, lastValid ? lastValid.proposedDateIso : null);
      if (lastValid) {
        newLayer.proposedDateIso = lastValid.proposedDateIso;
        newLayer.proposedStartHour = lastValid.proposedStartHour;
        newLayer.proposedEndHour = lastValid.proposedEndHour;
        item.dateIso = lastValid.proposedDateIso;
        item.startHour = lastValid.proposedStartHour;
        item.endHour = lastValid.proposedEndHour;
        item.form = item.startHour != null ? 'occupation' : 'day_event';
        item.status = 'planned';
      }
      item.lineage.unshift(newLayer);
      return {
        outcome: 'restored',
        summary: `已恢复「${item.title}」至最近有效时间（${item.dateIso || '待定'}），取消层划线保留。`,
        fingerprint: fp,
        targetItemId: item.id,
        verdict,
        layer: newLayer,
      };
    }

    if (verdict.action === 'advisory_rumor' || verdict.action === 'outdated_forward' || verdict.action === 'conflict_needs_review') {
      const flag = verdict.action === 'advisory_rumor' ? 'rumor' : verdict.action === 'outdated_forward' ? 'outdated' : 'conflict';
      const newLayer = buildLayer(flag, verdict.reason);
      item.lineage = item.lineage || [];
      item.lineage.unshift(newLayer);
      return {
        outcome: verdict.action,
        summary: verdict.reason,
        fingerprint: fp,
        targetItemId: item.id,
        verdict,
        layer: newLayer,
        needsUserChoice: flag === 'rumor' || flag === 'conflict',
      };
    }

    // Supersede (or confirm_supersede — applied cleanly in preview with confirmation flag)
    for (const l of item.lineage || []) {
      if (l.layerStatus === 'active') l.layerStatus = 'superseded';
    }
    const newLayer = buildLayer('active', `${match.matchReason}；${verdict.reason}`);
    item.lineage = item.lineage || [];
    item.lineage.unshift(newLayer);

    if (parsed.intent === 'cancel') {
      item.status = item.kind === 'task' ? 'cancelled_by_source' : 'cancelled';
    } else if (parsed.intent === 'postpone_tbd' || parsed.temporal.isTbd) {
      item.status = 'tbd';
      item.form = 'fog';
      item.fogFromIso = item.dateIso || nowIso.slice(0, 10);
      item.fogToIso = toIsoDate(addDays(parseIsoDate(item.fogFromIso), 10));
      item.dateIso = null;
      item.startHour = null;
      item.endHour = null;
    } else {
      if (parsed.temporal.dateIso) {
        item.dateIso = parsed.temporal.dateIso;
        item.fogFromIso = parsed.temporal.dateIso;
        item.fogToIso = parsed.temporal.dateEndIso || parsed.temporal.dateIso;
      }
      if (parsed.temporal.startHour != null) {
        item.startHour = parsed.temporal.startHour;
        item.endHour = parsed.temporal.endHour ?? (parsed.temporal.startHour + (parsed.temporal.durationMinutes || 45) / 60);
        item.form = item.kind === 'task' ? 'task_channel' : 'occupation';
      } else if (parsed.temporal.precision === 'day') {
        item.startHour = null;
        item.endHour = null;
        item.form = item.kind === 'task' ? 'task_channel' : 'day_fog';
      }
      if (parsed.intent === 'reschedule') item.status = 'rescheduled';
    }

    return {
      outcome: verdict.action === 'confirm_supersede' ? 'merged_needs_confirm' : 'merged_updated',
      summary: `已归流至「${item.title}」：${verdict.reason}`,
      fingerprint: fp,
      targetItemId: item.id,
      verdict,
      layer: newLayer,
    };
  }

  // Create brand-new event/task item!
  const isUndated = parsed.temporal.needsAnchorDate || parsed.temporal.precision === 'range' || parsed.temporal.precision === 'none';
  const nowDay = parseIsoDate(nowIso.slice(0, 10));
  const defaultFogFrom = parsed.temporal.dateIso || toIsoDate(nowDay);
  const defaultFogTo = parsed.temporal.dateEndIso || toIsoDate(addDays(parseIsoDate(defaultFogFrom), 7));

  const newLayer = buildLayer('active', `${provenance.originLabel} · ${provenance.directLabel} · ${provenance.scopeNote}`);

  const newItem = {
    id: createId(parsed.eventType === 'exam' ? 'ex' : parsed.eventType === 'task' ? 'tk' : 'ev'),
    batchId,
    kind: parsed.eventType === 'exam' ? 'exam' : parsed.eventType === 'task' ? 'task' : 'event',
    subject: parsed.subject,
    title: parsed.title,
    epistemicKind: provenance.originChannel === 'student_self' ? 'personal_record' : 'plan',
    status: parsed.eventType === 'task'
      ? 'not_started'
      : (isUndated ? 'tbd' : (provenance.directness === 'rumor' ? 'rumor' : 'planned')),
    form: isUndated
      ? 'fog'
      : (parsed.eventType === 'task' ? 'task_channel' : (parsed.temporal.startHour != null ? 'occupation' : 'day_fog')),
    dateIso: isUndated ? null : parsed.temporal.dateIso,
    startHour: parsed.temporal.startHour,
    endHour: parsed.temporal.endHour,
    dueIso: parsed.eventType === 'task' && !isUndated ? parsed.temporal.dateIso : null,
    dueHour: parsed.eventType === 'task' ? parsed.temporal.startHour : null,
    dueLabel: parsed.eventType === 'task'
      ? (isUndated ? '截止待定（缺少原发日期）' : (parsed.temporal.startHour != null ? `${parsed.temporal.dateIso.slice(5)} ${String(Math.floor(parsed.temporal.startHour)).padStart(2, '0')}:00 截止` : `${parsed.temporal.dateIso.slice(5)} 当天前`))
      : null,
    channelStartIso: parsed.eventType === 'task' ? nowIso.slice(0, 10) : null,
    fogFromIso: isUndated ? defaultFogFrom : null,
    fogToIso: isUndated ? defaultFogTo : null,
    durationMinutes: parsed.temporal.durationMinutes || (parsed.eventType === 'exam' ? 90 : 40),
    isMandatoryOccupation: parsed.eventType === 'exam' || parsed.eventType === 'activity',
    needsAnchorDateQuestion: parsed.temporal.needsAnchorDate,
    rawRelativeHint: parsed.temporal.needsAnchorDate ? msg.text : null,
    loggedMinutes: 0,
    notes: '',
    sourceSummary: `${provenance.originLabel} · ${provenance.directLabel}`,
    lineage: [newLayer],
    flyInAt: Date.now(),
  };

  state.items.push(newItem);

  return {
    outcome: parsed.temporal.needsAnchorDate ? 'created_fog_needs_date' : 'created',
    summary: parsed.temporal.needsAnchorDate
      ? `「${newItem.title}」缺少原发日期，先以雾的形式落在卷上，等待你点选发送时间。`
      : `已生成「${newItem.title}」（${parsed.temporal.derivation || '已放入卷上'}）。`,
    fingerprint: fp,
    targetItemId: newItem.id,
    item: newItem,
    layer: newLayer,
    created: true,
  };
}
