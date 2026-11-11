// Chapter 02 · 根脉 — the school's history, climbed along the tree.
//
// Pure data (Node-testable, also read by scripts/lanren/build-home.mjs for the
// static reading list). Every node names its sources and says how sure we are.
//
// Grades (shown with every node):
//   record    史料 · 多个公开来源一致
//   single    史料 · 只见单一来源，待核
//   official  史料 · 学校官网原文（单一但为学校自述）
//   inferred  照片 · 年代由画面内容推断
//   site      本站资料 · 原始出处待补
//   gap       留白 · 没有找到可核实的资料
//   memory    个人记忆 · 必须有作者、日期与本人授权（目前没有任何一条）
//
// The light on the bark is the film's own language: it is not a growth ring and
// not evidence. The reading sheet shows each photograph flat, uncropped, with
// its credit, and keeps the facts apart from the shot.
//
// Verification note (2026-11-07): the development session could not open the
// cited web pages directly (network policy). Facts were cross-checked against
// search-engine extracts of those pages and against the project's own archive
// (data/news.json, data/alumni.json, campus data). `checked` records this.

export const GRADES = {
  record: { label: '史料', note: '多个公开来源一致' },
  single: { label: '史料', note: '单一来源，待核' },
  official: { label: '史料', note: '学校官网原文' },
  inferred: { label: '照片', note: '年代由画面推断' },
  site: { label: '本站资料', note: '原始出处待补' },
  gap: { label: '留白', note: '没有找到可核实的资料' },
  memory: { label: '个人记忆', note: '作者授权' }
};

export const SOURCES = {
  hnrb2023: { name: '《海南日报》2023-10-30「一所中学的一个世纪 百年海中恰芳华」', url: 'https://news.hndaily.cn/html/2023-10/30/content_58477_16668430.htm', local: 'news.html', checked: '本站新闻档案收录（n3）' },
  gov2023: { name: '海南省人民政府网 2023-11-01「赓续百年荣光 顺潮奋楫远航——写在海南中学建校100周年之际」', url: 'https://www.hainan.gov.cn/hainan/5309/202311/506488b9d6b84f5a8e1b965f26dcfeb2.shtml', local: 'news.html', checked: '本站新闻档案收录（n2）' },
  wiki: { name: '维基百科「海南中学」条目', url: 'https://zh.wikipedia.org/zh-hans/%E6%B5%B7%E5%8D%97%E4%B8%AD%E5%AD%A6', checked: '2026-11-07 检索摘要；原页面未能在开发环境中直接打开' },
  baike: { name: '百度百科「海南中学」条目', url: 'https://baike.baidu.com/item/%E6%B5%B7%E5%8D%97%E4%B8%AD%E5%AD%A6/3750084', checked: '2026-11-07 检索摘要；原页面未能在开发环境中直接打开' },
  official: { name: '海南中学官网《学校简介》', url: 'https://www.haizhong.edu.cn/haizhong/xxgk/xxjj/index.html', local: 'alumni.html', checked: '本站校友页依据此文整理' },
  official90: { name: '海南中学官网「【90周年校庆专题】海南中学九十年 一路风雨铸辉煌」', url: 'https://www.haizhong.edu.cn/haizhong/2022-12/12/article_2022121216285035663.html', checked: '2026-11-07 检索结果中出现；原文未打开' },
  people2013: { name: '人民网 2013-11-01「海南中学建校90周年 获赞海南基础教育的一面旗帜」', url: 'http://edu.people.com.cn/n/2013/1101/c1053-23406661.html', checked: '2026-11-07 检索结果' },
  people2022: { name: '人民网·海南频道 2022-11-01「海南中学启动建校100周年纪念活动」', url: 'http://hi.people.com.cn/n2/2022/1101/c231207-40177898.html', checked: '2026-11-07 检索结果' },
  campus: { name: '本站校园空间资料（assets/walk/campus.json、data/buildings.json）', local: 'about.html#campusAtlas', checked: '原始出处未在数据中注明' },
  about: { name: '本站「学校与空间」页的时间线（原仓库依据学校简介、海南日报及政府网整理）', local: 'about.html', checked: '原始出处未逐条注明' }
};

/** Photographs used by the chapter. `credit` repeats what is visible in the image; nothing is assumed about permission. */
export const PHOTOS = {
  gateOld: {
    src: 'assets/images/campus/old_photo.jpg', w: 1440, h: 1080,
    alt: '黑白老照片：题有「广东海南中学」的三拱门楼前，系红领巾的学生列队走出校门，前方一人举旗',
    credit: '画面右下角有「海南中学」水印；拍摄者、原始出处与转载授权待确认。'
  },
  gateNow: {
    src: 'assets/images/campus/campus_fucheng_gate.jpg', w: 493, h: 260,
    alt: '府城校区校门：三拱牌楼，绿色琉璃瓦，门楣题「海南中学」，两侧石狮',
    credit: '本项目既有照片；拍摄年份、拍摄者与转载授权待确认。'
  },
  yanchi: {
    src: 'assets/images/campus/campus_yanchi.jpg', w: 1400, h: 1120,
    // the light on the tree uses the picture inside its black mount and white keyline (the 区大伟 seal is kept);
    // the reading sheet always shows the whole original
    light: 'assets/images/campus/campus_yanchi-light.jpg',
    alt: '砚池：刻有红字「砚池」的题石，水池、热带植物与教学楼',
    credit: '画面署名「区大伟 摄」；拍摄年份与转载授权待确认。'
  },
  tree: {
    src: 'assets/images/web/lanshu-1600.jpg', w: 1600, h: 1280, light: 'assets/images/web/lanshu-crop-1600.jpg',
    alt: '一号教学楼前的大叶榄仁树：长长的横枝伸向太湖石，树下是台阶与斑驳树影',
    credit: '画面署名「区大伟 摄」；拍摄年份与转载授权待确认。'
  }
};

/**
 * Nodes, climbed in order. `at` places each one on the tree:
 *   part   foot | trunk | limb | fork | branch | crown | tip
 *   eye / target are art-directed for the locked V4 tree (seed 2611, three.js
 *   frame); the module re-finds the bark under `target` at load time.
 * `light` is what the bark shows: { photo } | { type: [big, small] } | { void: true }.
 */
export const NODES = [
  {
    id: '1923', year: '1923', title: '私立琼海中学',
    lead: '十三位教育界人士在府城筹办一所新学校，九月开学。',
    body: [
      '1923 年 8 月，冯官尧、王国宪、韩卓秦、钟衍林等 13 名教育界知名人士决定在海府地区筹备创校，定名「私立琼海中学」；同年 9 月正式开学。',
      '开学之初，学校借府城苏泉书院为临时校址，钟衍林任首任校长。'
    ],
    grade: 'record', sources: ['hnrb2023', 'wiki', 'official'],
    light: { type: ['1923', '私立琼海中学'] },
    at: { part: 'foot', eye: [1.25, 0.62, 3.5], target: [0.46, 0.78, 1.3], fov: 46 },
    links: [{ href: 'news.html', label: '新闻档案：《海南日报》百年报道' }]
  },
  {
    id: '1924', year: '1924', title: '迁到府城西门外',
    lead: '第二年，学校搬到府城西门外大路街一带——今天府城校区所在的街道。',
    body: [
      '据百度百科与本站「学校与空间」页的整理，1924 年学校迁至府城西门外大路街，以五贤祠为课室，并在西门外另建校舍。',
      '今天的府城校区位于海口市琼山区大路街。1924 年的具体校址与今天校园的关系，本站尚未找到更直接的史料。'
    ],
    grade: 'single', sources: ['baike', 'about'],
    light: { type: ['1924', '府城西门外'] },
    at: { part: 'trunk', eye: [2.35, 1.22, 2.6], target: [0.86, 1.42, 0.92], fov: 44 }
  },
  {
    id: '1938', year: '1938—1946', title: '战火里的停办与复校',
    lead: '日军占领琼崖，本部停办；香港分校也在 1941 年停办。1946 年回迁复校。',
    body: [
      '1938 年广州沦陷后，校董会设立「琼海中学香港分校」。1939 年 2 月日军占领琼崖，本部停办。',
      '1941 年底太平洋战争爆发、香港沦陷，香港分校被迫停办，师生辗转各地。1946 年，学校回迁复校。',
      '画面左边，那根长枝向水面低垂、又重新抬起——这是镜头的比喻，不是史料。'
    ],
    grade: 'single', sources: ['wiki'],
    light: { type: ['1939—1946', '停办'] },
    at: { part: 'limb', eye: [-1.55, 1.72, 2.95], target: [-0.38, 2.0, 0.88], look: [-0.05, 2.3, 0.35], fov: 50, frame: 0.4 }
  },
  {
    id: '1950', year: '1950—1953', title: '公办，定名「广东海南中学」',
    lead: '海南解放后学校改为公办，三所学校先后并入；1953 年定名「广东海南中学」。',
    body: [
      '1950 年海南解放，学校由军管会接管，由私立改为公办；琼南中学、匹瑾女子中学、建华中学先后并入。',
      '其后学校曾隶属海南师范学院、海南师范专科学校，作为附属中学。1953 年，广东省教育厅将学校定名为「广东海南中学」。'
    ],
    grade: 'record', sources: ['wiki', 'baike'],
    light: { type: ['1953', '广东海南中学'] },
    at: { part: 'fork', eye: [0.95, 2.62, 3.45], target: [0.32, 3.05, 0.86], fov: 46 }
  },
  {
    id: '1959', year: '1959', title: '广东省首批重点中学',
    lead: '学校被确定为广东省首批重点中学之一。',
    body: ['1959 年，广东海南中学被确定为广东省首批重点中学之一。'],
    grade: 'single', sources: ['baike'],
    light: { type: ['1959', '首批重点中学'] },
    at: { part: 'branch', eye: [0.7, 3.85, 3.7], target: [1.95, 4.15, 1.72], fov: 44, size: 0.5 }
  },
  {
    id: 'gate-old', year: '1953—1988 间', title: '门楼上的「广东海南中学」',
    lead: '一张没有日期的老照片。只能从门楼上的校名推断，它大概率摄于 1953—1988 年间。',
    body: [
      '门楼题「广东海南中学」——这一校名在 1953 年至 1988 年间使用，所以照片大概率摄于这三十多年之间；具体年份不详。',
      '画面里，系红领巾的学生跟着一面旗走出校门。人物身份、活动内容都无从考证，本站不做推测。'
    ],
    grade: 'inferred', sources: [],
    light: { photo: 'gateOld' },
    at: { part: 'branch', eye: [3.62, 3.86, 3.55], target: [3.75, 5.15, 2.93], fov: 46, size: 0.56 },
    photo: 'gateOld'
  },
  {
    id: 'gap', year: '1959—1988', title: '这一段，暂时空着',
    lead: '近三十年的校史，本站还没有找到能核实的资料。',
    body: [
      '公开资料提到学校在这段时间里还经历过停办与复办，但本站没有查到可靠的起止年份，因此不写。镜头从枝上往下看：树下的地面上，只落着一个空的光框。',
      '如果你有带日期与出处的资料、旧照片，或愿意署名分享的回忆，欢迎通过「关于本站」联系我们。这段树干会等它们。'
    ],
    grade: 'gap', sources: [],
    light: { void: true },
    at: { part: 'branch', eye: [3.6, 5.05, 4.85], target: [2.2, 0.3, 3.2], fov: 50, frame: 0.5, reach: 10 },
    links: [{ href: 'contact.html', label: '提供资料：关于本站' }]
  },
  {
    id: '1988', year: '1988', title: '海南建省，「海南中学」',
    lead: '1988 年 4 月海南建省，「广东海南中学」更名为「海南省海南中学」，简称海南中学。',
    body: [
      '1988 年 4 月 26 日海南省委、省政府挂牌成立，学校随之由「广东海南中学」更名为「海南省海南中学」，简称「海南中学」，沿用至今；并被确定为直属海南省教育厅领导的省重点中学。',
      '今天府城校区的门楼上写着「海南中学」。它与老照片里那座门楼是否为同一座、是否经过重建，本站没有核实。'
    ],
    grade: 'record', sources: ['wiki', 'baike'],
    light: { photo: 'gateNow' },
    at: { part: 'branch', eye: [5.25, 4.6, 3.25], target: [5.1, 5.9, 2.58], fov: 46, glow: 1.3 },
    photo: 'gateNow',
    links: [{ href: 'architecture.html', label: '建筑观察手册' }]
  },
  {
    id: '2013', year: '2013', title: '九十年',
    lead: '建校 90 周年。同一年，校园开始了第一次景观改造。',
    body: [
      '2013 年 11 月 1 日前后，学校举行建校 90 周年活动，人民网等媒体作了报道。',
      '本站校园资料记载，2013、2015、2018 年学校先后进行了三次校园景观改造。衍林堂为纪念创办人钟衍林而建，堂前立有「春风化雨」铜像（铜像落成年份本站尚未核实）。'
    ],
    grade: 'record', sources: ['people2013', 'official90', 'campus'],
    light: { type: ['2013', '九十年'] },
    at: { part: 'branch', eye: [6.08, 4.98, 2.6], target: [5.69, 6.17, 2.31], fov: 46, size: 0.46 }
  },
  {
    id: '2015', year: '2015', title: '一池两馆三园',
    lead: '景观改造形成砚池、校史馆、国粹馆与学园、行园、思园。',
    body: [
      '2015 年的校园景观改造形成「一池两馆三园」的格局：砚池；设在一号教学楼一层的校史馆与国粹馆；学园、行园、思园。',
      '一号教学楼正是这棵榄仁树所在的地方。'
    ],
    grade: 'site', sources: ['campus'],
    light: { photo: 'yanchi' },
    at: { part: 'branch', eye: [7.4, 6.35, 4.35], target: [8.0, 6.12, 1.8], look: [7.95, 5.95, 2.1], fov: 46, glow: 2.3 },
    photo: 'yanchi',
    links: [{ href: 'about.html#campusAtlas', label: '校园手图：砚池' }, { href: 'architecture.html', label: '建筑观察手册' }]
  },
  {
    id: '2023', year: '2023', title: '一百年',
    lead: '百年校庆前夕，《海南日报》以校园里的一棵百年榄仁树为报道开篇。',
    body: [
      '2022 年 11 月 1 日，学校启动建校 100 周年纪念活动；2023 年 11 月 1 日，海南中学迎来百年华诞。',
      '2023 年 10 月 30 日的《海南日报》以府城校区里的一棵百年榄仁树开篇：「树木是有记忆的，它的故事记录在年轮里。」HAIZ 的这棵数字树，就是照着一号教学楼前那棵榄仁树创作的概念模型——树龄未经年轮测定。'
    ],
    grade: 'record', sources: ['hnrb2023', 'gov2023', 'people2022'],
    light: { photo: 'tree' },
    at: { part: 'crown', eye: [8.5, 6.55, 4.95], target: [9.3, 6.02, 2.58], look: [9.25, 5.85, 2.75], fov: 46, glow: 1.7 },
    photo: 'tree',
    links: [{ href: 'news.html', label: '新闻档案：百年报道两篇' }]
  },
  {
    id: 'people', year: '从这里出发', title: '星布四海的人',
    lead: '校友的故事没有统一的年份，所以不挂在某一节树干上。',
    body: [
      '学校官网《学校简介》写到的校友，有开国少将马白山，运动员韦海英、王崇升，教育家何勇、吴坚，企业家戴珊，参与执导杭州亚运会闭幕式的艺术家黄春瀚彬，科研工作者谢周清、黄明欣、张继焦等。',
      '本站只摘录官网原文的姓名与身份，不推断他们在校的年份，也不代拟引语。'
    ],
    grade: 'official', sources: ['official'],
    light: null,
    at: { part: 'crown', eye: [9.7, 7.0, 5.8], look: [40, 7.6, 22], fov: 48 },
    links: [{ href: 'alumni.html', label: '校友：公开资料中的海中人' }]
  },
  {
    id: 'today', year: '今天', title: '新叶',
    lead: '树干上是走过的路；枝梢上，是正在长出来的新叶。',
    body: [
      '从这里开始，是校园里正在发生的事——第三幕「青春 · 生长」。',
      '个人记忆：目前还没有经本人授权的投稿，所以这棵树上没有一条。将来加入的每一条，都会写明作者、日期和授权，并与校史分开标注。'
    ],
    grade: 'memory', sources: [],
    light: null,
    at: { part: 'tip', eye: [10.45, 7.08, 5.5], target: [11.0, 6.4, 3.85], fov: 40 },
    links: [{ href: 'contact.html', label: '分享一段记忆：关于本站' }]
  }
];

/** The static (non-film) reading list and the year finder both use these short labels. */
export const shortYear = (n) => (n.id === 'people' ? '校友' : n.id === 'gap' ? '⋯' : n.id === 'gate-old' ? '老照片' : n.year.split('—')[0]);
