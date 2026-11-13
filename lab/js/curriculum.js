// HAIZ 实验册 · 课程定位
// 每一页在高中课程里的位置：学段（必修 / 选择性必修 / 拓展）、建议年级、活动性质、教材位置。
//
// 核对状态（如实标注，不凭记忆冒充已核对）：
//   src 有值  → 已检索到对应的教材章节或课标条目，链接附后（检索日期 2026-11-12）。
//   src 为空  → 章节位置按人教版 / 统编版（2019 年起使用）的通行编排填写，尚未对照原书逐条核对；
//               界面上会显示“待核对”，且不会标成“课标学生必做实验”。
// 本次制作环境无法打开教育部与出版社网站的课程标准原文，只能使用检索摘要；
// 需要核对的清单见 docs/lab-book-gen2-20261112.md。
export const STAGES = {
  bx: { label: '必修', short: '必修' },
  xb: { label: '选择性必修', short: '选必' },
  tz: { label: '拓展活动', short: '拓展' },
};
export const KINDS = {
  must: { label: '课标学生必做实验' },
  lab: { label: '教材实验' },
  demo: { label: '演示与探究' },
  model: { label: '模型与模拟' },
  inquiry: { label: '证据与论证' },
};

const S21 = 'https://zy.21cnjy.com/';
export const COURSE = {
  // ---- 物理
  'phy-forces': { stage: 'bx', grade: '高一上', kind: 'must', order: 10, book: '人教版物理 必修第一册 第三章 相互作用——力 · 4 力的合成和分解（实验：探究两个互成角度的力的合成规律）', basis: '课标必修 1 学生实验“探究两个互成角度的力的合成规律”；教材章节见人教版（2019）必修第一册 3.4', src: ['https://enjoyphysics.cn/Article2648', `${S21}17878225`] },
  'phy-hooke': { stage: 'bx', grade: '高一上', kind: 'lab', order: 12 },
  'phy-newton2': { stage: 'bx', grade: '高一上', kind: 'lab', order: 14 },
  'phy-projectile': { stage: 'bx', grade: '高一下', kind: 'lab', order: 20 },
  'phy-emf': { stage: 'bx', grade: '高二上', kind: 'lab', order: 30 },
  'phy-pendulum': { stage: 'xb', grade: '高二', kind: 'lab', order: 40, book: '人教版物理 选择性必修第一册 第二章 机械振动 · 5 实验：用单摆测量重力加速度', basis: '教材章节“2.5 实验：用单摆测量重力加速度”', src: [`${S21}22501975`, `${S21}22682869`] },
  'phy-young': { stage: 'xb', grade: '高二', kind: 'lab', order: 42 },
  'phy-refract': { stage: 'xb', grade: '高二', kind: 'lab', order: 44 },
  'phy-induction': { stage: 'xb', grade: '高二', kind: 'lab', order: 46 },
  'phy-boyle': { stage: 'xb', grade: '高二下', kind: 'lab', order: 48 },
  // ---- 化学
  'chem-molarity': { stage: 'bx', grade: '高一上', kind: 'must', order: 10, book: '人教版化学 必修第一册 第二章 海水中的重要元素——钠和氯 · 第三节 物质的量（实验活动：配制一定物质的量浓度的溶液）', basis: '课标（2017 年版）“学生必做实验”列有“配制一定物质的量浓度的溶液”（据检索摘要，原文未能打开）', src: ['https://bksy.ecnu.edu.cn/_upload/article/files/51/eb/3c1adf774e569c6143b4e852b26a/70bc6036-a93c-40e8-a4e3-af165ea53534.pdf', 'https://zhuanlan.zhihu.com/p/646733914'] },
  'chem-flame': { stage: 'bx', grade: '高一上', kind: 'demo', order: 14 },
  'chem-cell': { stage: 'bx', grade: '高一下', kind: 'demo', order: 20 },
  'chem-rate': { stage: 'xb', grade: '高二上', kind: 'lab', order: 30 },
  'chem-equilibrium': { stage: 'xb', grade: '高二上', kind: 'demo', order: 32 },
  'chem-titration': { stage: 'xb', grade: '高二上', kind: 'lab', order: 34, book: '人教版化学 选择性必修 1 化学反应原理 第三章 水溶液中的离子反应与平衡 · 实验活动：强酸与强碱的中和滴定' },
  'chem-electrolysis': { stage: 'xb', grade: '高二上', kind: 'demo', order: 36 },
  // ---- 生物
  'bio-plasmolysis': { stage: 'bx', grade: '高一上', kind: 'lab', order: 10 },
  'bio-enzyme': { stage: 'bx', grade: '高一上', kind: 'lab', order: 12 },
  'bio-photosynthesis': { stage: 'bx', grade: '高一上', kind: 'lab', order: 14 },
  'bio-mendel': { stage: 'bx', grade: '高一下', kind: 'lab', order: 20 },
  'bio-dna': { stage: 'bx', grade: '高一下', kind: 'lab', order: 22 },
  'bio-population': { stage: 'xb', grade: '高二', kind: 'lab', order: 30 },
  // ---- 地理
  'geo-breeze': { stage: 'bx', grade: '高一上', kind: 'demo', order: 10 },
  'geo-contour': { stage: 'bx', grade: '高一上', kind: 'model', order: 12 },
  'geo-moon': { stage: 'tz', grade: '高一上', kind: 'model', order: 14 },
  'geo-seasons': { stage: 'xb', grade: '高二上', kind: 'model', order: 30 },
  // ---- 数学
  'math-function': { stage: 'bx', grade: '高一上', kind: 'model', order: 8, book: '人教 A 版数学 必修第一册 第三章 函数的概念与性质 · 3.2 函数的基本性质（单调性与最大（小）值、奇偶性）' },
  'math-sine': { stage: 'bx', grade: '高一上', kind: 'model', order: 10 },
  'math-cube': { stage: 'bx', grade: '高一下', kind: 'model', order: 20 },
  'math-conic': { stage: 'xb', grade: '高二上', kind: 'model', order: 30 },
  'math-derivative': { stage: 'xb', grade: '高二下', kind: 'model', order: 32 },
  'math-galton': { stage: 'xb', grade: '高二下', kind: 'model', order: 34 },
  // ---- 信息技术、通用技术
  'it-binary': { stage: 'bx', grade: '高一', kind: 'model', order: 10 },
  'it-sort': { stage: 'bx', grade: '高一', kind: 'model', order: 12 },
  'tech-beam': { stage: 'bx', grade: '高一 / 高二', kind: 'demo', order: 10 },
  'tech-control': { stage: 'bx', grade: '高一 / 高二', kind: 'model', order: 12 },
  // ---- 语文、英语、历史、思想政治
  'chn-meter': { stage: 'tz', grade: '高一', kind: 'inquiry', order: 10 },
  'chn-syllogism': { stage: 'xb', grade: '高二上', kind: 'inquiry', order: 30 },
  'eng-sentence': { stage: 'bx', grade: '高一上', kind: 'model', order: 10 },
  'eng-tense': { stage: 'bx', grade: '高一', kind: 'model', order: 12 },
  'his-timeline': { stage: 'bx', grade: '高一上', kind: 'inquiry', order: 10 },
  'his-type': { stage: 'bx', grade: '高一上', kind: 'inquiry', order: 12, book: '统编版历史 中外历史纲要（上）· 辽宋夏金元的文化（宋代科技：活字印刷术）；史料：沈括《梦溪笔谈》卷十八“活板”' },
  'pol-market': { stage: 'bx', grade: '高一下', kind: 'model', order: 10 },
  'pol-lorenz': { stage: 'bx', grade: '高一下', kind: 'model', order: 12 },
};
