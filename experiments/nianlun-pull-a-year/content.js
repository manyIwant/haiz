// 抽出一年 · what the rings remember besides weather.
//
// Every entry below is copied from HAIZ's own archive, not written for this experiment:
//   history  lanren/roots/history.js (第二幕「根脉」), with its grades and sources
//   news     data/news.json — only items marked demo:false (real, dated reports)
// `when` says how precisely the date is known, and the interface says it too:
//   'day'    a dated event: a knot in the wood on that day
//   'about'  「前后」: a knot, but the caption says the date is approximate
//   'month'  only the month is known: a dark streak through that month
//   'year'   only the year is known: written on the scroll's title slip, never on a day

export const GRADES = {
  record: '史料 · 多个公开来源一致',
  single: '史料 · 单一来源，待核',
  official: '史料 · 学校官网原文',
  inferred: '照片 · 年代由画面推断',
  site: '本站资料 · 原始出处待补',
  news: '新闻报道 · 见原文链接'
};

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
    grade: 'news', sources: [{ name: '海南中学' }], photo: P.gaokao25 }
];

export const entriesOfYear = (y) => ENTRIES.filter((e) => e.y === y);
