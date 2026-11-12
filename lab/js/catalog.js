// HAIZ 实验册 · 目录
import phy from './exp/phy.js';
import phy2 from './exp/phy2.js';
import chem from './exp/chem.js';
import bio from './exp/bio.js';
import geo from './exp/geo.js';
import math from './exp/math.js';
import more from './exp/more.js';
import hum from './exp/hum.js';

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

const all = [phy, phy2, chem, bio, geo, math, more, hum];
export const EXPERIMENTS = all.flat();
const count = {};
for (const e of EXPERIMENTS) { count[e.subject] = (count[e.subject] || 0) + 1; e.no = count[e.subject]; }
