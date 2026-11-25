// NIANLUN 004 · HAIZ authentic archives, campus anchors, bell schedules, lab catalog & demo student data.
//
// Clear provenance boundaries:
//   1. ENTRIES: Authentic HAIZ campus history & dated news (copied from PR #114 + data/news.json n10).
//   2. BELL_SCHEDULES.summer: Authentic Hainan Middle School 2025-2026 Semester 2 summer bell schedule
//      verbatim from data/news.json (id: n10, 2026-04-07).
//   3. BUILDINGS: Real Fucheng Campus building IDs & names from data/buildings.json.
//   4. LAB_LINKS: Real HAIZ interactive lab book experiment IDs from lab/js/catalog.js & curriculum.js.
//   5. createDemoStudentData(): Clearly marked (`example: true`) student timetable, homework,
//      personal schedule, exam grades, mistakes & growth notes centered on 2026 Autumn Term.

export const TODAY_ISO = '2026-11-25'; // 2026-11-25 (Wed) — aligned with HAIZ 2026 Autumn Term

export const GRADES = {
  record: '史料 · 多个公开来源一致',
  single: '史料 · 单一来源，待核',
  official: '史料 · 学校官网原文',
  inferred: '照片 · 年代由画面推断',
  site: '本站资料 · 原始出处待补',
  news: '新闻报道 · 见原文链接',
  campus: '校园公开信息 · 源自 HAIZ 档案',
  demo: '演示数据 · 可随时编辑或清空'
};

// Mineral pigment palette harmonizing with warm paper (#efe8da) & wood grain
export const SUBJECTS = {
  chn:  { id: 'chn',  name: '语文', short: '语', color: '#a84332', soft: 'rgba(168,67,50,0.14)', full: 150 },
  math: { id: 'math', name: '数学', short: '数', color: '#b55628', soft: 'rgba(181,86,40,0.14)', full: 150 },
  eng:  { id: 'eng',  name: '英语', short: '英', color: '#2f5d7c', soft: 'rgba(47,93,124,0.14)', full: 150 },
  phy:  { id: 'phy',  name: '物理', short: '物', color: '#39557a', soft: 'rgba(57,85,122,0.14)', full: 100 },
  chem: { id: 'chem', name: '化学', short: '化', color: '#2c6e63', soft: 'rgba(44,110,99,0.14)', full: 100 },
  bio:  { id: 'bio',  name: '生物', short: '生', color: '#47724a', soft: 'rgba(71,114,74,0.14)', full: 100 },
  geo:  { id: 'geo',  name: '地理', short: '地', color: '#3e6d82', soft: 'rgba(62,109,130,0.14)', full: 100 },
  his:  { id: 'his',  name: '历史', short: '史', color: '#7d5b34', soft: 'rgba(125,91,52,0.14)', full: 100 },
  pol:  { id: 'pol',  name: '政治', short: '政', color: '#9c4530', soft: 'rgba(156,69,48,0.14)', full: 100 },
  pe:   { id: 'pe',   name: '体育', short: '体', color: '#5b7644', soft: 'rgba(91,118,68,0.14)', full: 100 },
  it:   { id: 'it',   name: '信息', short: '信', color: '#6b6040', soft: 'rgba(107,96,64,0.14)', full: 100 },
  self: { id: 'self', name: '自习', short: '习', color: '#645c52', soft: 'rgba(100,92,82,0.12)', full: 100 }
};

export const SUBJECT_LIST = Object.values(SUBJECTS);
export const subjectByName = (name) => SUBJECT_LIST.find((s) => s.name === name || s.id === name || s.short === name) || SUBJECTS.self;

// Real HAIZ Fucheng Campus building anchors (synced with data/buildings.json)
const HAIZ_BASE = (typeof location !== 'undefined' && location.pathname.includes('/experiments/nianlun-004/'))
  ? '../../'
  : 'https://haiz.space/';

export const BUILDINGS = {
  yihao:      { id: 'yihao',      name: '一号教学楼', category: '教学楼', mapUrl: `${HAIZ_BASE}campus-3d.html?focus=yihao` },
  erhao:      { id: 'erhao',      name: '二号教学楼', category: '教学楼', mapUrl: `${HAIZ_BASE}campus-3d.html?focus=erhao` },
  sanhao:     { id: 'sanhao',     name: '三号教学楼', category: '教学楼', mapUrl: `${HAIZ_BASE}campus-3d.html?focus=sanhao` },
  sihao:      { id: 'sihao',      name: '四号教学楼', category: '教学楼', mapUrl: `${HAIZ_BASE}campus-3d.html?focus=sihao` },
  keji:       { id: 'keji',       name: '科技楼',     category: '科教楼', mapUrl: `${HAIZ_BASE}campus-3d.html?focus=keji` },
  kexue:      { id: 'kexue',      name: '科学馆实验大楼', category: '科教楼', mapUrl: `${HAIZ_BASE}campus-3d.html?focus=kexue` },
  chem:       { id: 'chem',       name: '化学实验楼', category: '实验楼', mapUrl: `${HAIZ_BASE}campus-3d.html?focus=chem` },
  library:    { id: 'library',    name: '图书馆',     category: '图书/科教', mapUrl: `${HAIZ_BASE}campus-3d.html?focus=library` },
  yundong:    { id: 'yundong',    name: '操场',       category: '运动场', mapUrl: `${HAIZ_BASE}campus-3d.html?focus=yundong` },
  yishu:      { id: 'yishu',      name: '艺术教育活动中心', category: '艺术中心', mapUrl: `${HAIZ_BASE}campus-3d.html?focus=yishu` },
  lanshu:     { id: 'lanshu',     name: '百年榄仁树', category: '历史名木', mapUrl: `${HAIZ_BASE}campus-3d.html?focus=lanshu` },
  fengqitang: { id: 'fengqitang', name: '凤栖堂',     category: '园林',   mapUrl: `${HAIZ_BASE}campus-3d.html?focus=fengqitang` },
  canteen1:   { id: 'canteen1',   name: '第一食堂',   category: '食堂',   mapUrl: `${HAIZ_BASE}campus-3d.html?focus=canteen1` }
};

// Real HAIZ Lab Book interactive experiments (synced with lab/js/catalog.js & curriculum.js)
export const LAB_EXPERIMENTS = {
  'phy-induction':  { id: 'phy-induction',  subject: 'phy',  title: '法拉第电磁感应探究', grade: '高二', url: `${HAIZ_BASE}lab/index.html#phy-induction` },
  'phy-pendulum':   { id: 'phy-pendulum',   subject: 'phy',  title: '单摆测量重力加速度', grade: '高二', url: `${HAIZ_BASE}lab/index.html#phy-pendulum` },
  'phy-emf':        { id: 'phy-emf',        subject: 'phy',  title: '电源电动势与内阻测量', grade: '高二上', url: `${HAIZ_BASE}lab/index.html#phy-emf` },
  'phy-young':      { id: 'phy-young',      subject: 'phy',  title: '双缝干涉测光波波长', grade: '高二', url: `${HAIZ_BASE}lab/index.html#phy-young` },
  'chem-titration': { id: 'chem-titration', subject: 'chem', title: '强酸强碱中和滴定', grade: '高二上', url: `${HAIZ_BASE}lab/index.html#chem-titration` },
  'chem-rate':      { id: 'chem-rate',      subject: 'chem', title: '化学反应速率与平衡', grade: '高二上', url: `${HAIZ_BASE}lab/index.html#chem-rate` },
  'bio-population': { id: 'bio-population', subject: 'bio',  title: '种群增长曲线模型', grade: '高二', url: `${HAIZ_BASE}lab/index.html#bio-population` },
  'bio-enzyme':     { id: 'bio-enzyme',     subject: 'bio',  title: '酶活性与温度 pH 关系', grade: '高一上', url: `${HAIZ_BASE}lab/index.html#bio-enzyme` },
  'math-conic':     { id: 'math-conic',     subject: 'math', title: '圆锥曲线几何轨迹', grade: '高二上', url: `${HAIZ_BASE}lab/index.html#math-conic` },
  'math-derivative':{ id: 'math-derivative',subject: 'math', title: '导数与切线动态探究', grade: '高二下', url: `${HAIZ_BASE}lab/index.html#math-derivative` },
  'chn-syllogism':  { id: 'chn-syllogism',  subject: 'chn',  title: '逻辑三段论与思辨写作', grade: '高二上', url: `${HAIZ_BASE}lab/index.html#chn-syllogism` },
  'eng-tense':      { id: 'eng-tense',      subject: 'eng',  title: '英语时态时间轴模型', grade: '高一', url: `${HAIZ_BASE}lab/index.html#eng-tense` }
};

// Real Hainan Middle School bell schedule from data/news.json (id: n10, 2026-04-07)
export const BELL_SCHEDULES = {
  summer: {
    id: 'summer',
    label: '夏季作息（海中 2026-04-07 实录）',
    source: '海南中学 2025-2026 学年第二学期夏季作息时间表（data/news.json n10）',
    note: '周一 7:20 升旗仪式；适用于高一、高二年级，高三按教学需要微调。',
    slots: [
      { id: 'wake',    label: '起床',     start: 380,  end: 400,  kind: 'life' },
      { id: 'morn_ex', label: '早操',     start: 400,  end: 420,  kind: 'life' },
      { id: 'bfast',   label: '早餐',     start: 420,  end: 445,  kind: 'life' },
      { id: 'read',    label: '早读',     start: 445,  end: 475,  kind: 'class', period: 0 },
      { id: 'p1',      label: '第一节',   start: 480,  end: 520,  kind: 'class', period: 1 },
      { id: 'p2',      label: '第二节',   start: 530,  end: 570,  kind: 'class', period: 2 },
      { id: 'p3',      label: '第三节',   start: 580,  end: 620,  kind: 'class', period: 3 },
      { id: 'break',   label: '课间操',   start: 620,  end: 640,  kind: 'life' },
      { id: 'p4',      label: '第四节',   start: 640,  end: 680,  kind: 'class', period: 4 },
      { id: 'p5',      label: '第五节',   start: 690,  end: 730,  kind: 'class', period: 5 },
      { id: 'lunch',   label: '午餐',     start: 735,  end: 785,  kind: 'life' },
      { id: 'nap',     label: '午休',     start: 790,  end: 860,  kind: 'rest' },
      { id: 'p6',      label: '第六节',   start: 885,  end: 925,  kind: 'class', period: 6 },
      { id: 'p7',      label: '第七节',   start: 935,  end: 975,  kind: 'class', period: 7 },
      { id: 'eye',     label: '眼保健操', start: 975,  end: 990,  kind: 'life' },
      { id: 'p8',      label: '第八节',   start: 990,  end: 1030, kind: 'class', period: 8 },
      { id: 'sport',   label: '文体活动', start: 1030, end: 1070, kind: 'free' },
      { id: 'dinner',  label: '晚餐',     start: 1075, end: 1125, kind: 'life' },
      { id: 'eve1',    label: '晚修一',   start: 1170, end: 1260, kind: 'study', period: 9 },
      { id: 'eve2',    label: '晚修二',   start: 1270, end: 1340, kind: 'study', period: 10 },
      { id: 'sleep',   label: '熄灯休息', start: 1370, end: 1380, kind: 'rest' }
    ]
  },
  winter: {
    id: 'winter',
    label: '冬季作息（参考排布）',
    source: '依据夏季作息推演的秋冬微调参考（非校方正式发文，可在设置中自由编辑）',
    note: '冬季下午上课提前 15 分钟，文体与晚修相应提前。',
    slots: [
      { id: 'wake',    label: '起床',     start: 390,  end: 410,  kind: 'life' },
      { id: 'morn_ex', label: '早操',     start: 410,  end: 430,  kind: 'life' },
      { id: 'bfast',   label: '早餐',     start: 430,  end: 455,  kind: 'life' },
      { id: 'read',    label: '早读',     start: 455,  end: 480,  kind: 'class', period: 0 },
      { id: 'p1',      label: '第一节',   start: 485,  end: 525,  kind: 'class', period: 1 },
      { id: 'p2',      label: '第二节',   start: 535,  end: 575,  kind: 'class', period: 2 },
      { id: 'p3',      label: '第三节',   start: 585,  end: 625,  kind: 'class', period: 3 },
      { id: 'break',   label: '课间操',   start: 625,  end: 645,  kind: 'life' },
      { id: 'p4',      label: '第四节',   start: 645,  end: 685,  kind: 'class', period: 4 },
      { id: 'p5',      label: '第五节',   start: 695,  end: 735,  kind: 'class', period: 5 },
      { id: 'lunch',   label: '午餐',     start: 740,  end: 790,  kind: 'life' },
      { id: 'nap',     label: '午休',     start: 795,  end: 850,  kind: 'rest' },
      { id: 'p6',      label: '第六节',   start: 870,  end: 910,  kind: 'class', period: 6 },
      { id: 'p7',      label: '第七节',   start: 920,  end: 960,  kind: 'class', period: 7 },
      { id: 'eye',     label: '眼保健操', start: 960,  end: 975,  kind: 'life' },
      { id: 'p8',      label: '第八节',   start: 975,  end: 1015, kind: 'class', period: 8 },
      { id: 'sport',   label: '文体活动', start: 1015, end: 1055, kind: 'free' },
      { id: 'dinner',  label: '晚餐',     start: 1060, end: 1110, kind: 'life' },
      { id: 'eve1',    label: '晚修一',   start: 1155, end: 1245, kind: 'study', period: 9 },
      { id: 'eve2',    label: '晚修二',   start: 1255, end: 1325, kind: 'study', period: 10 },
      { id: 'sleep',   label: '熄灯休息', start: 1365, end: 1375, kind: 'rest' }
    ]
  }
};

// Authentic HAIZ history & news archive (preserved verbatim from PR #114 + news.json n10)
const S = {
  hnrb2023: { name: '《海南日报》2023-10-30', url: 'https://news.hndaily.cn/html/2023-10/30/content_58477_16668430.htm' },
  gov2023: { name: '海南省人民政府网 2023-11-01', url: 'https://www.hainan.gov.cn/hainan/5309/202311/506488b9d6b84f5a8e1b965f26dcfeb2.shtml' },
  wiki: { name: '维基百科「海南中学」', url: 'https://zh.wikipedia.org/zh-hans/%E6%B5%B7%E5%8D%97%E4%B8%AD%E5%AD%A6' },
  baike: { name: '百度百科「海南中学」', url: 'https://baike.baidu.com/item/%E6%B5%B7%E5%8D%97%E4%B8%AD%E5%AD%A6/3750084' },
  official: { name: '海南中学官网《学校简介》', url: 'https://www.haizhong.edu.cn/haizhong/xxgk/xxjj/index.html' },
  people2013: { name: '人民网 2013-11-01', url: 'http://edu.people.com.cn/n/2013/1101/c1053-23406661.html' },
  people2022: { name: '人民网·海南频道 2022-11-01', url: 'http://hi.people.com.cn/n2/2022/1101/c231207-40177898.html' },
  campus: { name: 'HAIZ 校园空间资料（原始出处待补）' }
};

const P = {
  gateOld: { src: 'photos/gate-old.jpg', alt: '黑白老照片：题有「广东海南中学」的三拱门楼前，学生列队走出校门', credit: '画面右下角有「海南中学」水印；拍摄者与授权待确认' },
  gateNow: { src: 'photos/gate-now.jpg', alt: '府城校区校门：三拱牌楼，门楣题「海南中学」', credit: 'HAIZ 既有照片；拍摄者与授权待确认' },
  yanchi: { src: 'photos/yanchi.jpg', alt: '砚池：刻有红字「砚池」的题石与水池', credit: '画面署名「区大伟 摄」；授权待确认' },
  tree: { src: 'photos/lanshu.jpg', alt: '一号教学楼前的大叶榄仁树', credit: '画面署名「区大伟 摄」；授权待确认' },
  centennial: { src: 'photos/xiaoqing.jpg', alt: '百年校庆现场', credit: '新闻配图，版权归原作者' },
  openday23: { src: 'photos/openday-2023.jpg', alt: '2023 年中考招生开放日', credit: '海南中学官网配图' },
  openday22: { src: 'photos/openday-2022.jpg', alt: '2022 年府城校区中招开放日', credit: '海南中学官网配图' },
  class22: { src: 'photos/classroom-2022.jpg', alt: '同课异构教研活动的课堂', credit: '海南中学官网配图' },
  gaokao25: { src: 'photos/gaokao-2025.jpg', alt: '2025 年高考喜报', credit: '海南中学发布的图片' }
};

export const ENTRIES = [
  { y: 1923, m: 9, when: 'month', kind: 'history', title: '私立琼海中学开学',
    text: '1923 年 8 月，冯官尧、王国宪、韩卓秦、钟衍林等 13 名教育界人士决定在海府地区筹备创校，定名「私立琼海中学」；同年 9 月正式开学，借府城苏泉书院为临时校址，钟衍林任首任校长。',
    grade: 'record', sources: [S.hnrb2023, S.wiki, S.official] },
  { y: 1924, when: 'year', kind: 'history', title: '迁到府城西门外',
    text: '学校迁至府城西门外大路街，以五贤祠为课室，并在西门外另建校舍。与今天校园的关系，尚未找到更直接的史料。',
    grade: 'single', sources: [S.baike] },
  { y: 1938, when: 'year', kind: 'history', title: '设立香港分校',
    text: '广州沦陷后，校董会设立「琼海中学香港分校」。',
    grade: 'single', sources: [S.wiki] },
  { y: 1939, m: 2, when: 'month', kind: 'history', title: '本部停办',
    text: '1939 年 2 月日军占领琼崖，学校本部停办。',
    grade: 'single', sources: [S.wiki] },
  { y: 1941, m: 12, when: 'month', kind: 'history', title: '香港分校停办',
    text: '1941 年底太平洋战争爆发、香港沦陷，香港分校被迫停办，师生辗转各地。',
    grade: 'single', sources: [S.wiki] },
  { y: 1946, when: 'year', kind: 'history', title: '回迁复校',
    text: '1946 年，学校回迁复校。',
    grade: 'single', sources: [S.wiki] },
  { y: 1950, when: 'year', kind: 'history', title: '改为公办',
    text: '海南解放，学校由军管会接管，由私立改为公办；琼南中学、匹瑾女子中学、建华中学先后并入。',
    grade: 'record', sources: [S.wiki, S.baike] },
  { y: 1953, when: 'year', kind: 'history', title: '定名「广东海南中学」',
    text: '广东省教育厅将学校定名为「广东海南中学」。这个校名一直用到 1988 年——门楼上题着它的那张老照片没有日期，只能推断摄于这三十多年之间。',
    grade: 'record', sources: [S.wiki, S.baike], photo: P.gateOld },
  { y: 1959, when: 'year', kind: 'history', title: '广东省首批重点中学',
    text: '广东海南中学被确定为广东省首批重点中学之一。',
    grade: 'single', sources: [S.baike] },
  { y: 1988, m: 4, d: 26, when: 'day', kind: 'history', title: '海南建省，「海南中学」',
    text: '海南省委、省政府挂牌成立，学校随之由「广东海南中学」更名为「海南省海南中学」，简称「海南中学」，沿用至今。',
    grade: 'record', sources: [S.wiki, S.baike], photo: P.gateNow },
  { y: 2013, m: 11, d: 1, when: 'about', kind: 'history', title: '九十年',
    text: '学校举行建校 90 周年活动，人民网等媒体作了报道。同一年，校园开始了第一次景观改造。',
    grade: 'record', sources: [S.people2013, S.campus] },
  { y: 2015, when: 'year', kind: 'history', title: '一池两馆三园',
    text: '景观改造形成砚池、设在一号教学楼一层的校史馆与国粹馆，以及学园、行园、思园。一号教学楼，正是那棵榄仁树所在的地方。',
    grade: 'site', sources: [S.campus], photo: P.yanchi },
  { y: 2022, m: 3, d: 8, when: 'day', kind: 'news', title: '「双减」背景下的同课异构教研',
    text: '同一节课，不同老师各自设计、互相观摩，让课堂更高效。',
    grade: 'news', sources: [{ name: '海南中学官网' }], photo: P.class22 },
  { y: 2022, m: 9, d: 17, when: 'day', kind: 'news', title: '府城校区中招开放日',
    text: '「青春年少与老牌名校的相遇」——府城校区举行 2022 年中招开放日活动。',
    grade: 'news', sources: [{ name: '海南中学官网' }], photo: P.openday22 },
  { y: 2022, m: 11, d: 1, when: 'day', kind: 'history', title: '百年纪念活动启动',
    text: '学校启动建校 100 周年纪念活动。',
    grade: 'record', sources: [S.people2022] },
  { y: 2023, m: 7, d: 4, when: 'day', kind: 'news', title: '「选择海中，成就梦想」',
    text: '海南中学举办 2023 年中考招生开放日活动。',
    grade: 'news', sources: [{ name: '海南中学官网' }], photo: P.openday23 },
  { y: 2023, m: 10, d: 30, when: 'day', kind: 'news', title: '「树木是有记忆的」',
    text: '《海南日报》以府城校区里的一棵百年榄仁树开篇：「树木是有记忆的，它的故事记录在年轮里。」HAIZ 的数字树就是照着那棵树创作的——树龄未经年轮测定。',
    grade: 'news', sources: [S.hnrb2023], photo: P.tree },
  { y: 2023, m: 11, d: 1, when: 'day', kind: 'history', title: '一百年',
    text: '海南中学迎来百年华诞。海南省人民政府网刊文「赓续百年荣光 顺潮奋楫远航」。',
    grade: 'record', sources: [S.gov2023, S.hnrb2023], photo: P.centennial },
  { y: 2025, m: 6, d: 26, when: 'day', kind: 'news', title: '2025 年高考喜报',
    text: '学校发布 2025 年高考喜报「虎踞龙盘 捷报频传」。',
    grade: 'news', sources: [{ name: '海南中学' }], photo: P.gaokao25 },
  { y: 2026, m: 4, d: 7, when: 'day', kind: 'news', title: '启用夏季作息时间表',
    text: '海南中学 2025-2026 学年第二学期夏季作息时间表自 4 月 7 日起执行：早读 7:25，上午五节 8:00–12:10，下午三节 14:45–17:10，晚修 19:30–22:20。本实验「竹简课表带」直接沿用此作息基准。',
    grade: 'campus', sources: [{ name: 'HAIZ data/news.json (n10)' }] }
];

export const entriesOfYear = (y) => ENTRIES.filter((e) => e.y === y);

// Clearly labeled demonstration student data (`example: true`) for 2026 Autumn Term (高二 · 物化生)
export function createDemoStudentData() {
  const courses = [
    // Monday (weekday 1)
    { id: 'c-1-0', weekday: 1, startMinute: 445, endMinute: 475, subject: '语文', name: '语文早读（古诗文背诵）', room: '高二(6)班', buildingId: 'yihao', teacher: '林老师', labId: 'chn-syllogism', example: true },
    { id: 'c-1-1', weekday: 1, startMinute: 480, endMinute: 520, subject: '数学', name: '数学 · 圆锥曲线综合', room: '一号楼 302', buildingId: 'yihao', teacher: '陈老师', labId: 'math-conic', example: true },
    { id: 'c-1-2', weekday: 1, startMinute: 530, endMinute: 570, subject: '物理', name: '物理 · 电磁感应定律', room: '一号楼 302', buildingId: 'yihao', teacher: '周老师', labId: 'phy-induction', example: true },
    { id: 'c-1-3', weekday: 1, startMinute: 580, endMinute: 620, subject: '英语', name: '英语 · 选必二阅读', room: '一号楼 302', buildingId: 'yihao', teacher: '吴老师', labId: 'eng-tense', example: true },
    { id: 'c-1-4', weekday: 1, startMinute: 640, endMinute: 680, subject: '语文', name: '语文 · 论证思辨写作', room: '一号楼 302', buildingId: 'yihao', teacher: '林老师', labId: 'chn-syllogism', example: true },
    { id: 'c-1-5', weekday: 1, startMinute: 690, endMinute: 730, subject: '化学', name: '化学 · 酸碱中和滴定', room: '化学实验楼 201', buildingId: 'chem', teacher: '王老师', labId: 'chem-titration', example: true },
    { id: 'c-1-6', weekday: 1, startMinute: 885, endMinute: 925, subject: '生物', name: '生物 · 种群数量变化', room: '一号楼 302', buildingId: 'yihao', teacher: '符老师', labId: 'bio-population', example: true },
    { id: 'c-1-7', weekday: 1, startMinute: 935, endMinute: 975, subject: '数学', name: '数学 · 习题讲评', room: '一号楼 302', buildingId: 'yihao', teacher: '陈老师', labId: 'math-conic', example: true },
    { id: 'c-1-8', weekday: 1, startMinute: 990, endMinute: 1030, subject: '体育', name: '体育 · 田径与体能', room: '大操场', buildingId: 'yundong', teacher: '黄老师', labId: '', example: true },

    // Tuesday (weekday 2)
    { id: 'c-2-0', weekday: 2, startMinute: 445, endMinute: 475, subject: '英语', name: '英语早读（听力与词汇）', room: '高二(6)班', buildingId: 'yihao', teacher: '吴老师', labId: 'eng-tense', example: true },
    { id: 'c-2-1', weekday: 2, startMinute: 480, endMinute: 520, subject: '物理', name: '物理 · 楞次定律实验', room: '科学馆 403', buildingId: 'kexue', teacher: '周老师', labId: 'phy-induction', example: true },
    { id: 'c-2-2', weekday: 2, startMinute: 530, endMinute: 570, subject: '数学', name: '数学 · 椭圆离心率专题', room: '一号楼 302', buildingId: 'yihao', teacher: '陈老师', labId: 'math-conic', example: true },
    { id: 'c-2-3', weekday: 2, startMinute: 580, endMinute: 620, subject: '化学', name: '化学 · 溶液离子平衡', room: '一号楼 302', buildingId: 'yihao', teacher: '王老师', labId: 'chem-rate', example: true },
    { id: 'c-2-4', weekday: 2, startMinute: 640, endMinute: 680, subject: '英语', name: '英语 · 读后续写', room: '一号楼 302', buildingId: 'yihao', teacher: '吴老师', labId: 'eng-tense', example: true },
    { id: 'c-2-5', weekday: 2, startMinute: 690, endMinute: 730, subject: '语文', name: '语文 · 《乡土中国》精读', room: '一号楼 302', buildingId: 'yihao', teacher: '林老师', labId: '', example: true },
    { id: 'c-2-6', weekday: 2, startMinute: 885, endMinute: 925, subject: '生物', name: '生物 · 神经调节专题', room: '一号楼 302', buildingId: 'yihao', teacher: '符老师', labId: 'bio-enzyme', example: true },
    { id: 'c-2-7', weekday: 2, startMinute: 935, endMinute: 975, subject: '信息', name: '信息技术 · 算法与数据', room: '科技楼 305', buildingId: 'keji', teacher: '张老师', labId: '', example: true },
    { id: 'c-2-8', weekday: 2, startMinute: 990, endMinute: 1030, subject: '自习', name: '物理答疑自习', room: '一号楼 302', buildingId: 'yihao', teacher: '周老师', labId: 'phy-emf', example: true },

    // Wednesday (weekday 3 — TODAY 2026-11-25)
    { id: 'c-3-0', weekday: 3, startMinute: 445, endMinute: 475, subject: '语文', name: '语文早读（文言实词）', room: '高二(6)班', buildingId: 'yihao', teacher: '林老师', labId: '', example: true },
    { id: 'c-3-1', weekday: 3, startMinute: 480, endMinute: 520, subject: '数学', name: '数学 · 抛物线焦点弦', room: '一号楼 302', buildingId: 'yihao', teacher: '陈老师', labId: 'math-conic', example: true },
    { id: 'c-3-2', weekday: 3, startMinute: 530, endMinute: 570, subject: '英语', name: '英语 · 完形填空精讲', room: '一号楼 302', buildingId: 'yihao', teacher: '吴老师', labId: 'eng-tense', example: true },
    { id: 'c-3-3', weekday: 3, startMinute: 580, endMinute: 620, subject: '物理', name: '物理 · 单摆与简谐振动', room: '科学馆 403', buildingId: 'kexue', teacher: '周老师', labId: 'phy-pendulum', example: true },
    { id: 'c-3-4', weekday: 3, startMinute: 640, endMinute: 680, subject: '化学', name: '化学 · 盐类水解探究', room: '化学实验楼 201', buildingId: 'chem', teacher: '王老师', labId: 'chem-titration', example: true },
    { id: 'c-3-5', weekday: 3, startMinute: 690, endMinute: 730, subject: '语文', name: '语文 · 现代文主观题', room: '一号楼 302', buildingId: 'yihao', teacher: '林老师', labId: '', example: true },
    { id: 'c-3-6', weekday: 3, startMinute: 885, endMinute: 925, subject: '生物', name: '生物 · 免疫调节复习', room: '一号楼 302', buildingId: 'yihao', teacher: '符老师', labId: 'bio-population', example: true },
    { id: 'c-3-7', weekday: 3, startMinute: 935, endMinute: 975, subject: '物理', name: '物理 · 动生电动势习题', room: '一号楼 302', buildingId: 'yihao', teacher: '周老师', labId: 'phy-induction', example: true },
    { id: 'c-3-8', weekday: 3, startMinute: 990, endMinute: 1030, subject: '体育', name: '体育 · 篮球选修', room: '大操场', buildingId: 'yundong', teacher: '黄老师', labId: '', example: true },

    // Thursday (weekday 4)
    { id: 'c-4-0', weekday: 4, startMinute: 445, endMinute: 475, subject: '英语', name: '英语早读（高频词组）', room: '高二(6)班', buildingId: 'yihao', teacher: '吴老师', labId: '', example: true },
    { id: 'c-4-1', weekday: 4, startMinute: 480, endMinute: 520, subject: '语文', name: '语文 · 期中范文赏析', room: '一号楼 302', buildingId: 'yihao', teacher: '林老师', labId: '', example: true },
    { id: 'c-4-2', weekday: 4, startMinute: 530, endMinute: 570, subject: '数学', name: '数学 · 直线与圆锥曲线', room: '一号楼 302', buildingId: 'yihao', teacher: '陈老师', labId: 'math-conic', example: true },
    { id: 'c-4-3', weekday: 4, startMinute: 580, endMinute: 620, subject: '化学', name: '化学 · 沉淀溶解平衡', room: '一号楼 302', buildingId: 'yihao', teacher: '王老师', labId: 'chem-rate', example: true },
    { id: 'c-4-4', weekday: 4, startMinute: 640, endMinute: 680, subject: '物理', name: '物理 · 电磁感应双杆模型', room: '一号楼 302', buildingId: 'yihao', teacher: '周老师', labId: 'phy-induction', example: true },
    { id: 'c-4-5', weekday: 4, startMinute: 690, endMinute: 730, subject: '英语', name: '英语 · 听力模拟训练', room: '一号楼 302', buildingId: 'yihao', teacher: '吴老师', labId: '', example: true },
    { id: 'c-4-6', weekday: 4, startMinute: 885, endMinute: 925, subject: '数学', name: '数学 · 阶段限时练', room: '一号楼 302', buildingId: 'yihao', teacher: '陈老师', labId: 'math-conic', example: true },
    { id: 'c-4-7', weekday: 4, startMinute: 935, endMinute: 975, subject: '生物', name: '生物 · 生态系统能量流', room: '一号楼 302', buildingId: 'yihao', teacher: '符老师', labId: 'bio-population', example: true },

    // Friday (weekday 5)
    { id: 'c-5-0', weekday: 5, startMinute: 445, endMinute: 475, subject: '语文', name: '语文早读（名篇默写）', room: '高二(6)班', buildingId: 'yihao', teacher: '林老师', labId: '', example: true },
    { id: 'c-5-1', weekday: 5, startMinute: 480, endMinute: 520, subject: '英语', name: '英语 · 议论文写作', room: '一号楼 302', buildingId: 'yihao', teacher: '吴老师', labId: '', example: true },
    { id: 'c-5-2', weekday: 5, startMinute: 530, endMinute: 570, subject: '物理', name: '物理 · 阶段测验讲评', room: '一号楼 302', buildingId: 'yihao', teacher: '周老师', labId: 'phy-induction', example: true },
    { id: 'c-5-3', weekday: 5, startMinute: 580, endMinute: 620, subject: '数学', name: '数学 · 导数预习导入', room: '一号楼 302', buildingId: 'yihao', teacher: '陈老师', labId: 'math-derivative', example: true },
    { id: 'c-5-4', weekday: 5, startMinute: 640, endMinute: 680, subject: '化学', name: '化学 · 滴定误差分析', room: '化学实验楼 201', buildingId: 'chem', teacher: '王老师', labId: 'chem-titration', example: true },
    { id: 'c-5-5', weekday: 5, startMinute: 690, endMinute: 730, subject: '生物', name: '生物 · 实验设计专题', room: '一号楼 302', buildingId: 'yihao', teacher: '符老师', labId: 'bio-population', example: true },
    { id: 'c-5-6', weekday: 5, startMinute: 885, endMinute: 925, subject: '语文', name: '语文 · 周记与随笔交流', room: '图书馆阅览室', buildingId: 'library', teacher: '林老师', labId: '', example: true },
    { id: 'c-5-7', weekday: 5, startMinute: 935, endMinute: 975, subject: '自习', name: '班会与周总结', room: '一号楼 302', buildingId: 'yihao', teacher: '班主任', labId: '', example: true }
  ];

  const tasks = [
    { id: 'hw-1', title: '物理选必二 · 电磁感应双杆题组 (6题)', subject: '物理', dueIso: '2026-11-25', estMinutes: 45, priority: 'high', completed: false, linkedCourseId: 'c-3-7', labId: 'phy-induction', scheduledBlockId: null, source: '物理周老师课堂布置', note: '重点注意右手定则与能量守恒联立', example: true },
    { id: 'hw-2', title: '数学 · 抛物线焦点弦性质整理与练习', subject: '数学', dueIso: '2026-11-25', estMinutes: 50, priority: 'high', completed: false, linkedCourseId: 'c-3-1', labId: 'math-conic', scheduledBlockId: 'ps-1', source: '数学陈老师', note: 'P84 习题 3、5、8', example: true },
    { id: 'hw-3', title: '化学 · 中和滴定误差分析实验报告', subject: '化学', dueIso: '2026-11-26', estMinutes: 35, priority: 'normal', completed: false, linkedCourseId: 'c-3-4', labId: 'chem-titration', scheduledBlockId: null, source: '化学实验课', note: '附 HAIZ 实验册模拟数据对照', example: true },
    { id: 'hw-4', title: '英语 · Unit 5 读后续写草稿 150 词', subject: '英语', dueIso: '2026-11-27', estMinutes: 40, priority: 'normal', completed: false, linkedCourseId: 'c-3-2', labId: 'eng-tense', scheduledBlockId: null, source: '英语吴老师', note: '注意过去完成时与心理描写', example: true },
    { id: 'hw-5', title: '生物 · 种群 S 型曲线与 K 值应用题', subject: '生物', dueIso: '2026-11-24', estMinutes: 30, priority: 'normal', completed: true, linkedCourseId: 'c-1-6', labId: 'bio-population', scheduledBlockId: null, source: '生物符老师', note: '已完成订正', example: true },
    { id: 'hw-6', title: '语文 · 《过秦论》重点实词卡片', subject: '语文', dueIso: '2026-11-28', estMinutes: 25, priority: 'low', completed: false, linkedCourseId: 'c-3-0', labId: '', scheduledBlockId: null, source: '语文林老师', note: '周一早读抽背', example: true },
    { id: 'hw-7', title: '历史/阅读 · 整理百年榄仁树口述访谈提纲', subject: '语文', dueIso: '2026-11-29', estMinutes: 45, priority: 'low', completed: false, linkedCourseId: 'c-5-6', labId: '', scheduledBlockId: null, source: '校园杂志社', note: '周末在凤栖堂讨论', example: true },
    { id: 'hw-8', title: '物理 · 补齐单摆测 g 周期误差表格', subject: '物理', dueIso: '2026-11-23', estMinutes: 30, priority: 'normal', completed: true, linkedCourseId: 'c-3-3', labId: 'phy-pendulum', scheduledBlockId: null, source: '科学馆实验', note: '已提交', example: true }
  ];

  // Deliberate realistic schedule including ONE clear conflict on 2026-11-26 (16:00-17:30) with Physics Quiz!
  const personal = [
    { id: 'ps-1', dateIso: '2026-11-25', startMinute: 1170, endMinute: 1230, title: '完成数学抛物线练习', kind: 'study', linkedTaskId: 'hw-2', buildingId: 'yihao', completed: false, visibility: 'private', note: '晚修第一节专攻', example: true },
    { id: 'ps-2', dateIso: '2026-11-25', startMinute: 1035, endMinute: 1065, title: '操场慢跑 2 公里', kind: 'life', linkedTaskId: null, buildingId: 'yundong', completed: false, visibility: 'private', note: '文体活动时段放松', example: true },
    { id: 'ps-3', dateIso: '2026-11-26', startMinute: 980, endMinute: 1060, title: '科创社 · 机器人舵机调试（与物理阶段考冲突！）', kind: 'club', linkedTaskId: null, buildingId: 'keji', completed: false, visibility: 'private', note: '演示冲突：与当日 16:20–17:20 物理阶段测验重叠，可在时间带上点击一键顺延', example: true },
    { id: 'ps-4', dateIso: '2026-11-27', startMinute: 1170, endMinute: 1245, title: '整理本周理综错题本', kind: 'review', linkedTaskId: null, buildingId: 'library', completed: false, visibility: 'private', note: '晚修整理物理和化学高频错因', example: true },
    { id: 'ps-5', dateIso: '2026-11-28', startMinute: 540, endMinute: 660, title: '图书馆专题自习：圆锥曲线大题', kind: 'study', linkedTaskId: null, buildingId: 'library', completed: false, visibility: 'private', note: '周末静心突破', example: true },
    { id: 'ps-6', dateIso: '2026-11-24', startMinute: 1170, endMinute: 1230, title: '复盘期中物理第 14 题', kind: 'review', linkedTaskId: null, buildingId: 'yihao', completed: true, visibility: 'private', note: '已重做一遍', example: true }
  ];

  // 4 Exams across 2026 Autumn Term: 2 graded with full subjects + mistakes, 2 upcoming!
  const exams = [
    {
      id: 'ex-2026-09',
      title: '2026 秋季第一次月考',
      dateIso: '2026-09-25',
      startMinute: 480,
      endMinute: 1020,
      buildingId: 'yihao',
      room: '一号教学楼 302',
      status: 'graded',
      visibility: 'private',
      example: true,
      note: '高二选科后首次阶段摸底，节奏仍在适应期。',
      scores: [
        { subject: '语文', score: 114, full: 150, classAvg: 109, percentile: 74 },
        { subject: '数学', score: 112, full: 150, classAvg: 106, percentile: 71 },
        { subject: '英语', score: 124, full: 150, classAvg: 116, percentile: 79 },
        { subject: '物理', score: 71,  full: 100, classAvg: 68,  percentile: 64 },
        { subject: '化学', score: 78,  full: 100, classAvg: 73,  percentile: 75 },
        { subject: '生物', score: 80,  full: 100, classAvg: 74,  percentile: 78 }
      ],
      mistakes: [
        { id: 'm-9-1', subject: '物理', qNo: '第 13 题', lost: 8, topic: '闭合电路欧姆定律与动态电路', reason: '概念不清', note: '误把非纯电阻支路按纯电阻处理，导致功率判断反了。', labId: 'phy-emf', mastered: true, reviewIds: [] },
        { id: 'm-9-2', subject: '数学', qNo: '第 19 题(2)', lost: 7, topic: '直线与圆位置关系参数讨论', reason: '审题疏漏', note: '忽略斜率不存在情形，漏掉一条切线方程。', labId: 'math-conic', mastered: true, reviewIds: [] },
        { id: 'm-9-3', subject: '化学', qNo: '第 16 题', lost: 6, topic: '化学平衡常数 K 与转化率计算', reason: '计算失误', note: '三段式体积忘记除以 2L 容器体积。', labId: 'chem-rate', mastered: false, reviewIds: [] }
      ]
    },
    {
      id: 'ex-2026-10',
      title: '2026 高二上学期期中联考',
      dateIso: '2026-10-29',
      startMinute: 480,
      endMinute: 1020,
      buildingId: 'yihao',
      room: '一号教学楼 考场 06',
      status: 'graded',
      visibility: 'private',
      example: true,
      note: '英语和生物稳步提升，物理电磁感应综合题与数学圆锥曲线计算耗时偏多。',
      scores: [
        { subject: '语文', score: 119, full: 150, classAvg: 111, percentile: 81 },
        { subject: '数学', score: 121, full: 150, classAvg: 108, percentile: 79 },
        { subject: '英语', score: 132, full: 150, classAvg: 118, percentile: 87 },
        { subject: '物理', score: 75,  full: 100, classAvg: 71,  percentile: 68 },
        { subject: '化学', score: 83,  full: 100, classAvg: 74,  percentile: 83 },
        { subject: '生物', score: 85,  full: 100, classAvg: 76,  percentile: 86 }
      ],
      mistakes: [
        { id: 'm-10-1', subject: '物理', qNo: '第 15 题(2)', lost: 9, topic: '法拉第电磁感应与双导轨动量守恒', reason: '思路受阻', note: '未列两杆安培力冲量等大反向，强行积分导致时间耗尽。', labId: 'phy-induction', mastered: false, reviewIds: [] },
        { id: 'm-10-2', subject: '物理', qNo: '第 9 题', lost: 4, topic: '单摆周期与等效重力加速度', reason: '审题疏漏', note: '漏看摆球带电置于匀强电场中的竖直分量。', labId: 'phy-pendulum', mastered: false, reviewIds: [] },
        { id: 'm-10-3', subject: '数学', qNo: '第 21 题(2)', lost: 8, topic: '椭圆弦长与韦达定理非对称化简', reason: '计算失误', note: '通分时符号抄错一步，后半段全偏。', labId: 'math-conic', mastered: false, reviewIds: [] },
        { id: 'm-10-4', subject: '化学', qNo: '第 17 题(3)', lost: 5, topic: '酸碱中和滴定终点与指示剂误差', reason: '概念不清', note: '碱式滴定管尖嘴气泡排出导致读数偏大混淆。', labId: 'chem-titration', mastered: false, reviewIds: [] },
        { id: 'm-10-5', subject: '语文', qNo: '第 10 题', lost: 4, topic: '文言文断句与虚词语义', reason: '审题疏漏', note: '未结合上下文主语切换判断。', labId: '', mastered: true, reviewIds: [] }
      ]
    },
    {
      id: 'ex-2026-11-quiz',
      title: '物理电磁感应阶段限时测验',
      dateIso: '2026-11-26',
      startMinute: 980,
      endMinute: 1040,
      buildingId: 'kexue',
      room: '科学馆 403',
      status: 'upcoming',
      visibility: 'private',
      example: true,
      note: '周四下午第 8 节后衔接测验（16:20–17:20），考察楞次定律与动生电动势。',
      scores: [],
      mistakes: []
    },
    {
      id: 'ex-2026-12-final',
      title: '2026-2027 高二上学期期末统考',
      dateIso: '2026-12-24',
      startMinute: 480,
      endMinute: 1020,
      buildingId: 'yihao',
      room: '一号教学楼',
      status: 'upcoming',
      visibility: 'private',
      example: true,
      note: '期末综合检测，涵盖选必一/选必二全部主干章节。',
      scores: [],
      mistakes: []
    }
  ];

  // Campus notices & personal growth notes (clearly distinguished by kind & visibility)
  const campusNotes = [
    { id: 'cn-1', dateIso: '2026-11-20', kind: 'campus', visibility: 'campus', title: '秋季校园科技文化节作品征集截止', buildingId: 'keji', text: '府城校区科技楼一楼展厅接收学生互动装置与物理小制作投稿，可与 HAIZ 实验册模型联动展示。', example: true },
    { id: 'cn-2', dateIso: '2026-11-26', kind: 'campus', visibility: 'campus', title: '高二年级期中家长开放日通知', buildingId: 'yihao', text: '本周四晚 19:00 一号教学楼各班教室召开期中学习交流会，请提前整理个人学情总结。', example: true },
    { id: 'cn-3', dateIso: '2026-12-04', kind: 'campus', visibility: 'campus', title: '第 63 届秋季田径运动会开幕', buildingId: 'yundong', text: '府城校区大操场举行田径与班级接力赛，周四、周五停课比赛。', example: true },
    { id: 'gr-1', dateIso: '2026-11-02', kind: 'growth', visibility: 'private', title: '期中复盘：把「粗心」拆成可检查清单', buildingId: 'lanshu', text: '在榄仁树下翻完期中卷子，发现 17 分丢失在审题和计算。以后大题动笔前强制花 20 秒圈画条件。', example: true },
    { id: 'gr-2', dateIso: '2026-11-18', kind: 'growth', visibility: 'private', title: '科学馆独立完成单摆周期测量', buildingId: 'kexue', text: '用手机慢动作拍了 30 次全振动，测得海口当地 g = 9.78 m/s²，比书本 9.8 略小，和纬度正好对上！', example: true },
    { id: 'gr-3', dateIso: '2026-11-25', kind: 'growth', visibility: 'private', title: '第 13 周中段小记', buildingId: 'yihao', text: '今天尝试把本周作业和晚修空闲排进年轮时间带，终于看清周四下午科创社和物理测验撞车了。', example: true }
  ];

  return {
    version: 1,
    schema: 'haiz.nianlun004.v1',
    ownerMode: 'local-private',
    bellMode: 'summer',
    term: {
      name: '2026-2027 学年第一学期（秋）',
      startIso: '2026-09-01',
      endIso: '2026-12-31'
    },
    courses,
    tasks,
    personal,
    exams,
    campusNotes
  };
}
