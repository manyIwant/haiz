/*
 * HAIZ Design Laboratory · 共用样本数据
 *
 * 三套方案读同一份数据，保证比较公平。
 * ─ SAMPLE（示例）：课表、任务、收件、专注记录、账号、设备、作品全部是虚构的开发样本，
 *   不对应任何真实学生、班级或群聊。界面上一律标注「示例」。
 * ─ HISTORY：摘自仓库 lanren/roots/history.js 的已核校史条目（标题、年份、可信度原样保留）。
 * ─ PLACES：摘自 data/buildings.json（项目既有近似平面，方向与精度未独立复核）。
 * ─ WEATHER：示例天气，不是实时数据。
 */
(function () {
  const now = new Date();
  // 示例课表沿用 HAIZ Pocket 的 starterCourses()（app/lib/domain/pocket_models.dart）
  const COURSES = [
    [1, 480, 525, '语文'], [1, 535, 580, '数学'], [1, 600, 645, '英语'], [1, 840, 885, '历史'],
    [2, 480, 525, '数学'], [2, 535, 580, '物理'], [2, 600, 645, '英语'], [2, 840, 885, '地理'],
    [3, 480, 525, '英语'], [3, 535, 580, '化学'], [3, 600, 645, '数学'], [3, 840, 885, '物理'], [3, 895, 940, '体育'],
    [4, 480, 525, '物理'], [4, 535, 580, '语文'], [4, 600, 645, '生物'], [4, 840, 885, '数学'],
    [5, 480, 525, '数学'], [5, 535, 580, '生物'], [5, 600, 645, '语文'], [5, 840, 885, '班会'],
  ].map((c, i) => ({ id: 'c' + i, day: c[0], start: c[1], end: c[2], name: c[3], room: '示例教室 ' + (201 + (i % 4)), example: true }));

  const iso = (d, h = 21, m = 0) => { const x = new Date(now); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x.toISOString(); };

  const TASKS = [
    { id: 't1', title: '整理今天的数学课堂笔记', subject: '数学', due: iso(0, 22), done: false, example: true, source: '' },
    { id: 't2', title: '英语 Unit 4 单词复习', subject: '英语', due: iso(1, 7, 30), done: false, example: true, source: '' },
    { id: 't3', title: '物理实验报告：单摆测 g', subject: '物理', due: iso(2, 18), done: false, example: true, source: '示例班级群（虚构）' },
    { id: 't4', title: '读《乡土中国》第三章', subject: '语文', due: iso(4, 21), done: false, example: true, source: '' },
    { id: 't5', title: '回顾化学滴定误差分析', subject: '化学', due: iso(-1, 21), done: true, example: true, source: '' },
  ];

  const INBOX = [
    { id: 'i1', text: '【示例】明天下午第一节课前交物理实验报告，单摆那一次的数据要附原始记录。', from: '示例班级群（虚构）', guess: { title: '交物理实验报告（单摆）', subject: '物理', due: iso(1, 14) } },
    { id: 'i2', text: '【示例】周五班会前每人准备一句对「百年榄仁树」的观察。', from: '示例班委（虚构）', guess: { title: '准备一句对榄仁树的观察', subject: '班会', due: iso(4, 14) } },
  ];

  const FOCUS = [
    { at: iso(0, 7, 10), min: 25, label: '英语' },
    { at: iso(0, 12, 40), min: 25, label: '数学' },
    { at: iso(-1, 20, 0), min: 50, label: '物理' },
    { at: iso(-2, 19, 30), min: 25, label: '语文' },
    { at: iso(-3, 21, 0), min: 40, label: '数学' },
  ];

  const ACCOUNT = {
    name: '示例同学', handle: 'sample_01', example: true,
    joined: '2026-09-01',
    devices: [
      { id: 'd1', name: '这台设备', kind: 'phone', last: '现在', current: true },
      { id: 'd2', name: '一台 Windows 电脑（示例）', kind: 'desktop', last: '3 天前', current: false },
      { id: 'd3', name: '一台 iPad（示例）', kind: 'tablet', last: '17 天前', current: false },
    ],
    leaves: 2,
  };

  // 校史：摘自 lanren/roots/history.js（grade: record=多来源记载, single=单一来源, gap=留白）
  const HISTORY = [
    { id: '1923', year: 1923, label: '1923', title: '私立琼海中学', lead: '十三位教育界人士在府城筹办一所新学校，九月开学。', grade: 'record' },
    { id: '1924', year: 1924, label: '1924', title: '迁到府城西门外', lead: '第二年，学校搬到府城西门外大路街一带——今天府城校区所在的街道。', grade: 'single' },
    { id: '1938', year: 1938, label: '1938—1946', title: '战火里的停办与复校', lead: '日军占领琼崖，本部停办；1946 年回迁复校。', grade: 'single' },
    { id: '1950', year: 1950, label: '1950—1953', title: '公办，定名「广东海南中学」', lead: '海南解放后学校改为公办；1953 年定名「广东海南中学」。', grade: 'record' },
    { id: '1959', year: 1959, label: '1959', title: '广东省首批重点中学', lead: '学校被确定为广东省首批重点中学之一。', grade: 'single' },
    { id: 'gap', year: 1970, label: '1959—1988', title: '这一段，暂时空着', lead: '没有找到可核实的史料，所以留白，不填。', grade: 'gap' },
    { id: '1988', year: 1988, label: '1988', title: '海南建省，「海南中学」', lead: '海南建省，学校更名为「海南中学」。', grade: 'record' },
    { id: '2015', year: 2015, label: '2015', title: '一池两馆三园', lead: '校园景观改造，形成砚池、校史馆、国粹馆与三处园林的格局。', grade: 'record' },
    { id: '2023', year: 2023, label: '2023', title: '一百年', lead: '建校一百周年。', grade: 'record' },
  ];

  // HAIZ 已有的作品与工具（真实存在的页面；路径相对仓库根目录）
  const WORKS = [
    { id: 'tree', img: 'docs/lanren/rings/sunset-20191120.jpg', name: '榄仁树 · 六幕', verb: '走进', kind: 'world', href: 'index.html', line: '一棵树，六幕连续的数字校园。' },
    { id: 'rings', img: 'docs/lanren/rings/typhoon-20140718.jpg', name: '年轮', verb: '回到', kind: 'time', href: 'index.html#rings', line: '1940 年至今三万多个真实日子的天气，画成年轮。' },
    { id: 'roots', img: 'docs/lanren/v4/before-after.jpg', name: '根脉', verb: '沿着', kind: 'time', href: 'index.html#roots', line: '沿树干向上，走过有出处的校史。' },
    { id: 'canopy', img: 'docs/lanren/canopy/04-overview.jpg', name: '青春 · 生长', verb: '找到', kind: 'make', href: 'index.html#leaves', line: '作品是树冠里的一片新叶。' },
    { id: 'map', img: 'docs/lanren/unfold/stages.jpg', name: '校园地图', verb: '展开', kind: 'space', href: 'index.html#map', line: '水面显出的总平面，整座校园从轮廓里升起。' },
    { id: 'ruhua', img: 'docs/ruhua/03-canvas.jpg', name: '入画', verb: '画下', kind: 'make', href: 'ruhua.html', line: '画下这棵树，然后走进这幅画。' },
    { id: 'free', img: 'docs/free/flight-over-campus.jpg', name: '自由共游', verb: '骑着', kind: 'space', href: 'ruhua-free.html', line: '走路、骑车、滑行、飞。' },
    { id: 'lab', img: 'docs/lab/phy-pendulum.jpg', name: 'HAIZ 实验册', verb: '翻开', kind: 'learn', href: 'lab/', line: '实验装置从纸上立起来，翻页时回到纸面。' },
    { id: 'darkroom', name: '共感暗房', verb: '显影', kind: 'make', href: 'darkroom.html', line: '用光唤醒照片，把笔触译成音乐。' },
    { id: 'windowsill', img: 'windowsill/scene-preview.jpg', name: '课间窗台', verb: '推开', kind: 'make', href: 'windowsill/', line: '留一扇窗，给课间。' },
    { id: 'pocket', name: 'HAIZ Pocket', verb: '打开', kind: 'learn', href: 'pocket/', line: '课表、任务、收件、专注。' },
    { id: 'journal', name: '校园杂志', verb: '读', kind: 'read', href: 'journal.html', line: '校史、新闻档案与校园生活。' },
  ];

  // 实验册样板页：单摆测重力加速度（文字为本实验室改写，物理关系真实）
  const LAB = {
    title: '用单摆测量重力加速度',
    subject: '物理 · 必修一 · 示例页',
    steps: [
      '把细线一端固定在铁架台上，另一端系上小钢球，让它自然下垂。',
      '用米尺量出悬点到球心的距离，这就是摆长 L。',
      '把球拉开一个小角度（不超过 5°）后放手，让它在竖直平面内摆动。',
      '从球经过最低点时开始计时，数 n 次全振动，记下总时间 t。',
      '周期 T = t / n。由 T = 2π√(L/g) 得 g = 4π²L / T²。',
      '换几个摆长重复测量，比较结果，分析误差从哪里来。',
    ],
    principle: '小角度时，单摆的回复力近似与位移成正比，运动接近简谐振动，周期只与摆长和重力加速度有关，与摆球质量无关。',
    sources: ['人教版高中物理选择性必修一「用单摆测量重力加速度」实验（课程标准中的学生必做实验）', 'HAIZ 实验册 lab/ 现有单摆页（docs/lab-book-gen2-20261112.md）'],
  };

  const WEATHER = { label: '多云', temp: 24, wind: '东北风 2 级', example: true };

  window.HAIZ_SAMPLE = { now, COURSES, TASKS, INBOX, FOCUS, ACCOUNT, HISTORY, WORKS, LAB, WEATHER };

  // 常用工具
  window.HZ = {
    mm: (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'),
    wd: (d) => '一二三四五六日'[(d + 6) % 7],
    today: () => { const d = now.getDay(); return d === 0 || d === 6 ? 3 : d; }, // 周末演示时按周三展示
    minuteNow: () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); },
    dueText(isoStr) {
      const d = new Date(isoStr), t = new Date(); t.setHours(0, 0, 0, 0);
      const dd = new Date(d); dd.setHours(0, 0, 0, 0);
      const diff = Math.round((dd - t) / 864e5);
      const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      if (diff < 0) return '已过期 ' + (-diff) + ' 天';
      return (['今天', '明天', '后天'][diff] || diff + ' 天后') + ' ' + hm;
    },
    reduced: () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduce',
    root: '../../../', // 仓库根目录，相对每个方案页面（experiments/design-laboratory/<方案>/）
  };
})();
