// HAIZ 实验册 · 目录
import phy from './exp/phy.js';
import phy2 from './exp/phy2.js';
import chem from './exp/chem.js';
import bio from './exp/bio.js';
import geo from './exp/geo.js';
import math from './exp/math.js';
import more from './exp/more.js';
import hum from './exp/hum.js';
import base from './exp/base.js';
import { COURSE, STAGES, KINDS } from './curriculum.js';

export { STAGES, KINDS };
export const SUBJECTS = {
  phy: { name: '物理', short: '物', en: 'Physics', color: '#7a5cff' },
  chem: { name: '化学', short: '化', en: 'Chemistry', color: '#19c2b0' },
  bio: { name: '生物', short: '生', en: 'Biology', color: '#2fb46a' },
  geo: { name: '地理', short: '地', en: 'Geography', color: '#3a9cff' },
  math: { name: '数学', short: '数', en: 'Mathematics', color: '#ff6a3d' },
  it: { name: '信息技术', short: '信', en: 'Computing', color: '#ffb52e' },
  tech: { name: '通用技术', short: '技', en: 'Design & Technology', color: '#b4653a' },
  chn: { name: '语文', short: '语', en: 'Chinese', color: '#c2453a' },
  eng: { name: '英语', short: '英', en: 'English', color: '#3b6fe0' },
  his: { name: '历史', short: '史', en: 'History', color: '#8a6a3c' },
  pol: { name: '思想政治', short: '政', en: 'Politics & Economics', color: '#d1552e' },
};

const all = [phy, phy2, chem, bio, geo, math, more, hum, base];
// 按学科排好，同一学科内按教学顺序（order 小的在前；未标注的保持原有先后）
const order = Object.keys(SUBJECTS);
export const EXPERIMENTS = all.flat()
  .map((e, i) => ({ e, i }))
  .sort((a, b) => order.indexOf(a.e.subject) - order.indexOf(b.e.subject) || (COURSE[a.e.id]?.order ?? 50) - (COURSE[b.e.id]?.order ?? 50) || a.i - b.i)
  .map((x) => x.e);
const count = {};
EXPERIMENTS.forEach((e, i) => {
  count[e.subject] = (count[e.subject] || 0) + 1; e.no = count[e.subject];
  e.pageNo = i * 2 + 2;
  const c = COURSE[e.id] || {};
  const st = STAGES[c.stage] || STAGES.tz, k = KINDS[c.kind] || KINDS.model;
  e.course = { stage: c.stage || 'tz', kind: c.kind || 'model', ...c, stageLabel: st.label, stageShort: st.short, kindLabel: k.label };
});
