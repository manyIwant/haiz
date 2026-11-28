/**
 * 演示数据 · Demo data.
 *
 * Every course, task, notice, club activity, note, number and person below is INVENTED for this
 * prototype and is shown with a 「演示」 marker in the UI. Real things are only: the campus and its
 * buildings (assets/walk/campus.json of the HAIZ repository, after 海南中学官网), the photographs
 * (credited where shown), and the 年轮 weather archive (ERA5 reanalysis).
 */

export type Period = { n: number; start: string; end: string };
export const PERIODS: Period[] = [
  { n: 1, start: "07:40", end: "08:20" },
  { n: 2, start: "08:30", end: "09:10" },
  { n: 3, start: "09:40", end: "10:20" },
  { n: 4, start: "10:30", end: "11:10" },
  { n: 5, start: "11:20", end: "12:00" },
  { n: 6, start: "14:30", end: "15:10" },
  { n: 7, start: "15:20", end: "16:00" },
  { n: 8, start: "16:10", end: "16:50" },
];

export type Course = { subject: string; room: string; building: string; teacher: string; topic?: string };
const C = (subject: string, room: string, building: string, teacher: string, topic?: string): Course => ({ subject, room, building, teacher, topic });
const PHY = C("物理", "302", "一号教学楼", "陈老师", "电磁感应 · 楞次定律");
const PHYLAB = C("物理实验", "物理实验室 2", "科学馆实验大楼", "陈老师", "探究感应电流的方向");
const MATH = C("数学", "302", "一号教学楼", "王老师", "导数的几何意义");
const CHN = C("语文", "302", "一号教学楼", "符老师", "《赤壁赋》");
const ENG = C("英语", "302", "一号教学楼", "李老师", "Unit 4 · Reading");
const CHEM = C("化学", "化学实验室 1", "化学实验楼", "吴老师", "原电池");
const BIO = C("生物", "302", "一号教学楼", "林老师", "基因的表达");
const HIS = C("历史", "302", "一号教学楼", "云老师", "近代中国的社会变迁");
const PE = C("体育", "田径场", "操场", "邢老师", "800 米测试准备");
const ART = C("美术", "美术教室", "艺术教育活动中心", "黄老师", "速写 · 校园一角");
const READ = C("阅读", "阅览室", "图书馆", "符老师", "整本书阅读");
const IT = C("信息技术", "机房 3", "科技楼", "郑老师", "算法与程序");
const CLASS = C("班会", "302", "一号教学楼", "王老师", "期中复盘");

/** Monday … Friday, eight periods each */
export let WEEK: Course[][] = [
  [CHN, MATH, PHY, ENG, BIO, PE, HIS, CLASS],
  [MATH, ENG, CHEM, PHY, CHN, IT, BIO, READ],
  [ENG, PHY, MATH, CHN, HIS, PHYLAB, PHYLAB, ART],
  [CHN, CHEM, MATH, ENG, PHY, BIO, PE, HIS],
  [MATH, CHN, ENG, PHY, CHEM, READ, IT, CLASS],
];
export const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export type Task = { id: string; title: string; subject: string; due: string; note: string; done: boolean; urgent?: boolean; mine?: boolean };
export let TASKS: Task[] = [
  { id: "t1", title: "物理实验报告《感应电流的方向》", subject: "物理", due: "今天 22:00", urgent: true, note: "附数据表与误差分析；实验课上记录的电流计偏转方向要画进示意图。", done: false },
  { id: "t2", title: "数学 · 导数练习 P56 第 1–12 题", subject: "数学", due: "今天 18:00", note: "第 9–12 题选做两道，写出完整过程。", done: false },
  { id: "t3", title: "背诵英语 Unit 4 第 3、4 段", subject: "英语", due: "明天 07:40", note: "明早课前抽查。", done: false },
  { id: "t4", title: "天文社 · 双子座流星雨观测申请表", subject: "社团", due: "周四", note: "交给社长，注明是否需要望远镜。", done: false },
  { id: "t5", title: "整理《赤壁赋》重点字词", subject: "语文", due: "周五", note: "", done: true },
];

export type Notice = { id: string; title: string; from: string; time: string; body: string; unread: boolean; tag: string; img?: string; credit?: string };
export const NOTICES: Notice[] = [
  { id: "n1", title: "关于高二年级期中考试安排的通知", from: "教务处", time: "今天 08:12", tag: "考试", unread: true,
    body: "高二年级期中考试安排在下周三至周五进行。请各班于本周五前完成考场座位表核对，考试期间晚自习调整为自主复习。具体考场与时间以班级群发布为准。" },
  { id: "n2", title: "第十三届艺术节节目征集", from: "团委 · 学生会", time: "昨天 17:40", tag: "活动", unread: true, img: "img/news/news-yishujie.jpg", credit: "图：海南中学官网",
    body: "艺术节节目征集开始，声乐、器乐、舞蹈、戏剧与原创作品均可报名。初审在艺术教育活动中心进行，报名表请交至各班文艺委员。" },
  { id: "n3", title: "图书馆期中周延长开放至 21:30", from: "图书馆", time: "周二", tag: "服务", unread: false,
    body: "期中考试周期间，图书馆二楼阅览室开放时间延长至 21:30。请保持安静，离开时带走个人物品。" },
  { id: "n4", title: "校运会项目报名与检录须知", from: "体育组", time: "周一", tag: "体育", unread: false, img: "img/news/news-yundonghui.jpg", credit: "图：海南中学官网",
    body: "校运会将于下月举行。每人限报两项个人项目和一项集体项目；检录处设在田径场东侧，请提前 20 分钟检录。" },
];

export type Club = { id: string; name: string; meta: string; next: string; img?: string; credit?: string; members: number };
export const CLUBS: Club[] = [
  { id: "c1", name: "古筝社", meta: "艺术教育活动中心 · 每周三", next: "周三 16:10 合奏排练", img: "img/news/news-guzheng.jpg", credit: "图：海南中学官网", members: 32 },
  { id: "c2", name: "足球队", meta: "田径场 · 每周二、四", next: "周四 17:00 对抗训练", img: "img/campus/scenery_01.jpg", credit: "图：海南中学官网", members: 26 },
  { id: "c3", name: "天文社", meta: "科技楼天台 · 不定期", next: "12月13日 双子座流星雨观测", members: 41 },
  { id: "c4", name: "模拟联合国", meta: "图书馆报告厅 · 每周五", next: "周五 16:10 议题研讨", members: 37 },
];

export type Note = { id: string; subject: string; title: string; excerpt: string; when: string; pages: number };
export let NOTES: Note[] = [
  { id: "m1", subject: "物理", title: "楞次定律的三种表述", excerpt: "感应电流的磁场总要阻碍引起感应电流的磁通量的变化——“来拒去留”“增反减同”……", when: "今天", pages: 3 },
  { id: "m2", subject: "数学", title: "导数与切线：一道题的四种解法", excerpt: "从定义出发 → 求导公式 → 几何意义 → 数形结合，比较每一步的计算量。", when: "昨天", pages: 2 },
  { id: "m3", subject: "语文", title: "《赤壁赋》中的变与不变", excerpt: "“自其变者而观之，则天地曾不能以一瞬；自其不变者而观之，则物与我皆无尽也。”", when: "周二", pages: 4 },
  { id: "m4", subject: "英语", title: "Unit 4 词块整理", excerpt: "be absorbed in · take ... into account · on the verge of · in terms of", when: "周一", pages: 1 },
];

export type Event = { id: string; day: number; time: string; title: string; place: string; kind: "exam" | "club" | "school" | "me" };
/** day = offset in days from today */
export let EVENTS: Event[] = [
  { id: "e1", day: 0, time: "19:30", title: "晚自习 · 物理答疑", place: "一号教学楼 302", kind: "school" },
  { id: "e2", day: 1, time: "16:10", title: "古筝社合奏排练", place: "艺术教育活动中心", kind: "club" },
  { id: "e3", day: 2, time: "全天", title: "图书馆延长开放至 21:30", place: "图书馆", kind: "school" },
  { id: "e4", day: 4, time: "08:00", title: "期中考试 · 语文", place: "按考场安排", kind: "exam" },
  { id: "e5", day: 5, time: "08:00", title: "期中考试 · 数学", place: "按考场安排", kind: "exam" },
  { id: "e6", day: 15, time: "20:00", title: "双子座流星雨观测", place: "科技楼天台", kind: "club" },
];

export let STUDENT = { name: "林知夏", cls: "高二（3）班", no: "2024-0317" };
export let TEACHER = { name: "王老师", subject: "数学", classes: ["高二（3）班", "高二（5）班"] };

/** a week of focus minutes and finished tasks (demo) */
export let GROWTH = {
  focus: [52, 75, 40, 95, 68, 120, 30],
  tasks: [3, 4, 2, 5, 3, 2, 1],
  reading: [20, 0, 35, 15, 40, 60, 25],
  streak: 9,
};

export type Lab = { id: string; title: string; subject: string; desc: string; kind: "pendulum" | "field" | "lens" };
export const LABS: Lab[] = [
  { id: "l1", title: "单摆的周期", subject: "物理", desc: "拖动摆长，观察周期与 √L 的关系。", kind: "pendulum" },
  { id: "l2", title: "条形磁铁与线圈", subject: "物理", desc: "推拉磁铁，看感应电流方向如何翻转。", kind: "field" },
  { id: "l3", title: "凸透镜成像", subject: "物理", desc: "移动物距，像在焦点两侧由实变虚。", kind: "lens" },
];

/** buildings that carry photographs (credits: 海南中学官网, via the HAIZ repository) */
export const PHOTOS: Record<string, string> = {
  北门: "img/campus/campus_fucheng_gate.jpg",
  科技楼: "img/campus/campus_keji.jpg",
  海南中学校友会: "img/campus/campus_xiaoyouhui.jpg",
  一号教学楼: "img/campus/campus_yihao.jpg",
  二号教学楼: "img/campus/campus_erhao.jpg",
  科学馆实验大楼: "img/campus/campus_kexue.jpg",
  三号教学楼: "img/campus/campus_sanhao_sihao.jpg",
  四号教学楼: "img/campus/campus_sanhao_sihao.jpg",
  图书馆: "img/campus/campus_library.jpg",
  第一食堂: "img/campus/campus_canteen1.jpg",
  女生宿舍: "img/campus/campus_dorm_f.jpg",
  男生宿舍: "img/campus/campus_dorm_m.jpg",
  艺术教育活动中心: "img/campus/campus_yishu.jpg",
  南门: "img/campus/campus_nanmen.jpg",
  百年榄仁树: "img/web/lanshu-1600.jpg",
  砚池: "img/campus/campus_yanchi.jpg",
  太湖石: "img/campus/campus_taihushi.jpg",
  操场: "img/campus/campus_playground.jpg",
  凤栖堂: "img/campus/campus_fengqitang.jpg",
  衍林堂: "img/campus/campus_yanlintang.jpg",
};

/* ---------------- HAIZ Native 001 · per-identity data ----------------
 * The bindings above are live: when a campus identity is restored, its own profile, schedule,
 * tasks, notes, events and growth record replace them, and the app re-renders from scratch. The
 * built-in values stay available as the sample a new identity may start from. */
export const SAMPLE = { WEEK, TASKS, NOTES, EVENTS, STUDENT, TEACHER, GROWTH };
export type Growth = { focus: number[]; tasks: number[]; reading: number[]; streak: number };
export type IdentityData = {
  profile: { name: string; cls: string; no: string; school: string };
  week: Course[][]; tasks: Task[]; notes: Note[]; events: Event[]; growth: Growth;
  teacher?: { name: string; subject: string; classes: string[] };
};
export function applyIdentityData(d: IdentityData) {
  STUDENT = { name: d.profile.name, cls: d.profile.cls, no: d.profile.no };
  TEACHER = d.teacher ?? { ...SAMPLE.TEACHER };
  WEEK = d.week; TASKS = d.tasks; NOTES = d.notes; EVENTS = d.events; GROWTH = d.growth;
}
