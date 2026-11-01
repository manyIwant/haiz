import { SUBJECTS, today } from './model.js';
import { cleanAssignment } from '../../public/haiz/world/homework-core.js';

const names = SUBJECTS.join('|');
const marker = new RegExp(`【\\s*(${names})\\s*】|(${names})(?:作业)?\\s*[:：]`, 'g');
const bareSubject = new RegExp(`^(${names})(?:作业)?(?=\\s|$)`);
const DAY = 86400000;

function validDate(value) {
  try {
    cleanAssignment({ subject: '其他', content: '日期校验', studyDate: value });
    return typeof value === 'string';
  } catch { return false; }
}

function shiftDate(value, days) {
  return new Date(Date.parse(`${value}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

function dateSuggestion(content, base) {
  const candidates = [];
  const warnings = [];
  const tokens = /\d{4}-\d{2}-\d{2}|今天|明天|后天|(?:本|这|下)?(?:周|星期|礼拜)[一二三四五六日天1-7]/g;
  for (const match of content.matchAll(tokens)) {
    const token = match[0];
    let suggested;
    if (/^\d/.test(token)) {
      if (!validDate(token)) {
        warnings.push(`「${token}」不是有效日期，请手动选择。`);
        continue;
      }
      suggested = token;
    } else if (['今天', '明天', '后天'].includes(token)) {
      suggested = shiftDate(base, { 今天: 0, 明天: 1, 后天: 2 }[token]);
    } else {
      const last = token.slice(-1);
      const target = '一二三四五六日'.indexOf(last) + 1 || (last === '天' ? 7 : Number(last));
      const weekday = new Date(`${base}T00:00:00Z`).getUTCDay() || 7;
      let offset = target - weekday;
      if (token.startsWith('下')) offset += 7;
      else if (!/^[本这]/.test(token) && offset < 0) offset += 7;
      suggested = shiftDate(base, offset);
    }
    if (validDate(suggested)) candidates.push(suggested);
    else warnings.push('推算日期超出支持范围，请手动选择。');
  }
  const dates = [...new Set(candidates)];
  if (!dates.length) warnings.push(`未确定日期，暂按 ${base}，请确认。`);
  else if (dates.length > 1) warnings.push(`发现多个日期（${dates.join('、')}），暂按首个 ${dates[0]}，请确认。`);
  else warnings.push(`日期建议为 ${dates[0]}；可能是截止日期而非学习日期，请确认。`);
  return { studyDate: dates[0] ?? base, warnings };
}

function captureId(content, date, index) {
  // Stable preview IDs: identical input produces identical suggestions, with no AI or network.
  let hash = 2166136261;
  for (const character of `${date}\0${index}\0${content}`) {
    hash = Math.imul(hash ^ character.codePointAt(0), 16777619) >>> 0;
  }
  return `capture-${hash.toString(36)}-${index}`;
}

export function parseCapture(text, date = today()) {
  if (typeof text !== 'string') throw new Error('请粘贴文字内容。');
  if (!validDate(date)) throw new Error('请选择有效的整理日期。');
  const items = [];
  let currentSubject = null;
  for (const line of text.split(/[\r\n;；]+/)) {
    const starts = [...line.matchAll(marker)].map(match => match.index);
    const boundaries = [...new Set([0, ...starts, line.length])];
    for (let index = 0; index < boundaries.length - 1; index++) {
      const content = line.slice(boundaries[index], boundaries[index + 1]).trim();
      if (!content) continue;
      const marked = [...content.matchAll(marker)][0];
      const explicit = marked?.index === 0 ? marked : content.match(bareSubject);
      const mentioned = [...new Set(content.match(new RegExp(names, 'g')) || [])];
      const subject = explicit ? explicit[1] || explicit[2] : mentioned.length === 1 ? mentioned[0] : currentSubject || '其他';
      if (explicit) currentSubject = subject;
      // Standalone subject headings carry context; the heading is metadata, not a blank assignment.
      if (explicit && !content.slice(explicit[0].length).trim()) continue;
      const suggested = dateSuggestion(content, date);
      const warnings = [...suggested.warnings];
      if (!explicit) warnings.unshift(mentioned.length === 1
        ? `从正文推测学科「${subject}」，请确认。`
        : mentioned.length > 1 ? '正文包含多个学科，请拆分或确认学科。'
        : currentSubject ? `沿用前文学科「${subject}」，请确认。`
        : '未识别学科，暂归「其他」，请确认。');
      if (content.length > 400) warnings.push('此条超过公示的 400 字上限；原文已完整保留，请手动拆分。');
      items.push({
        id: captureId(content, date, items.length), subject, content, studyDate: suggested.studyDate,
        due: '', materials: '', warnings,
      });
    }
  }
  return { items, warnings: [...new Set(items.flatMap(item => item.warnings))] };
}
