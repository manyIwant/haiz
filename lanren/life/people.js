// HAIZ · 校园里的人 — a few people who live here (fictional; see docs/life-20261117.md).
//
// They are not modelled on any real student, teacher or worker of 海南中学, and the map shows only them,
// the cat and the player — never anyone's real whereabouts. Each has a day: a boarding school's rhythm
// (早读, 课间, 课间操, 午休, 晚自习), their own places and habits, and the weather's say in it. A day is a
// list of blocks — be at a place by a time, leave it at a time — and the walks between them are found on
// the campus's paths when they are needed. Everything is seeded by the date, so today's afternoon is the
// same for every visitor, and tomorrow's is a little different.

// class periods (Haikou wall clock, hours)
export const PERIODS = [[8.0, 8.667], [8.833, 9.5], [10.0, 10.667], [10.833, 11.5], [11.667, 12.25], [14.5, 15.167], [15.333, 16.0], [16.167, 16.833]];
export const EXERCISE = [9.55, 9.9];          // 课间操, on the field (weekdays, dry)
export const EVENING = [[19.0, 20.333], [20.5, 22.0]];

/**
 * figure:  palette and accessories for the 3D body; gait: parameters for lanren/life/gait.js
 * speed:   walking speed (m/s); run: running speed
 * plan(day): the blocks of one day. day = { dow (0 Sun … 6 Sat), rain (bool), wet, rng(), hourNow }
 */
export const PEOPLE = [
  {
    id: 'lin', name: '林知夏', role: '高二（3）班', kind: 'student',
    about: '喜欢植物。课间常到榄仁树下站一会儿，午饭后去植物园画速写，傍晚绕砚池走一圈。',
    figure: { model: 'student-f', style: 'ponytail', bag: '#6f8f63', acc: ['sketchbook'] },
    gait: { basic: { tempo: 1.04, stride: 0.95, armSwing: 0.8, stepHeight: 1.1, looseness: 1.1 }, seed: 11 },
    speed: 1.3, run: 3.0, umbrella: true, rainHabit: 'watch',
    plan(d) {
      const B = [];
      const weekday = d.dow >= 1 && d.dow <= 5;
      if (!weekday && d.dow === 0) return away(B, 'dorm_f', 18.6, d);         // home on Sunday until the evening
      B.push({ at: 0, until: weekday ? 6.55 : 7.7, place: 'dorm_f', act: 'sleep' });
      B.push({ at: weekday ? 6.75 : 8.0, until: weekday ? 7.2 : 8.5, place: 'canteen3', act: 'eat' });
      if (weekday) {
        B.push({ at: 7.4, until: 9.5, place: 'yihao', door: 0, act: 'class', breaks: d.rain ? null : ['tree_e', 'tree_n'] });
        if (!d.rain) B.push({ at: EXERCISE[0], until: EXERCISE[1], place: 'field:2:3', act: 'exercise' });
        B.push({ at: 10.0, until: 12.25, place: 'yihao', door: 0, act: 'class', breaks: d.rain ? null : ['tree_e', 'tree_w'] });
        B.push({ at: 12.4, until: 12.75, place: 'canteen3', act: 'eat' });
        B.push(d.rain ? { at: 12.85, until: 13.2, place: 'corr_w12', act: 'watch' } : { at: 12.9, until: 13.3, place: d.rng() < 0.6 ? 'garden_a' : 'garden_b', act: 'sketch' });
        B.push({ at: 13.4, until: 14.2, place: 'dorm_f', act: 'rest' });
        B.push({ at: 14.4, until: 16.833, place: 'yihao', door: 0, act: 'class', breaks: d.rain ? null : ['tree_s'] });
        B.push(d.rain ? { at: 16.9, until: 17.5, place: 'eave_yihao_n', act: 'watch' } : { at: 16.95, until: 17.45, place: d.rng() < 0.5 ? 'tree_w' : 'tree_s', act: 'sketch' });
        B.push({ at: 17.75, until: 18.2, place: 'canteen3', act: 'eat' });
        if (!d.rain) B.push({ at: 18.4, until: 18.6, place: d.rng() < 0.5 ? 'pond_n' : 'pond_w', act: 'stand' });
        B.push({ at: 18.9, until: 22.0, place: 'yihao', door: 0, act: 'study' });
      } else {
        B.push({ at: 9.0, until: 11.4, place: 'library', act: 'read' });
        if (!d.rain) B.push({ at: 11.6, until: 12.1, place: 'garden_b', act: 'sketch' });
        B.push({ at: 12.3, until: 12.8, place: 'canteen3', act: 'eat' });
        B.push({ at: 13.0, until: 15.0, place: 'dorm_f', act: 'rest' });
        B.push(d.rain ? { at: 15.3, until: 16.2, place: 'yanlin_ting', act: 'watch' } : { at: 15.3, until: 16.6, place: 'tree_w', act: 'sketch' });
        B.push({ at: 17.6, until: 18.2, place: 'canteen3', act: 'eat' });
        if (!d.rain) B.push({ at: 18.4, until: 18.8, place: 'pond_n', act: 'stand' });
      }
      B.push({ at: 22.15, until: 24, place: 'dorm_f', act: 'sleep' });
      return B;
    },
    lines: {
      near: ['（看了你一眼，又低头看叶子）', '这棵树的叶子，十一月会红一些。', '嗯？……你也在画画吗。', '叶子背面的颜色更好看。'],
      rain: ['下雨了，这边不淋。', '雨声挺好听的。'],
      night: ['晚自习要开始了。'],
    },
  },
  {
    id: 'chen', name: '陈屿', role: '高一（7）班', kind: 'student',
    about: '篮球队的。总是踩着铃声跑进教室；午饭后、放学后都在篮球场。下雨不打伞，用手挡着头跑。',
    figure: { model: 'student-m', style: 'buzz', bag: '#2f3f6a', skin: '#cfa385', acc: [] },
    gait: { preset: 'athletic', basic: { tempo: 1.08, armSwing: 1.2, hipSway: 0.9, looseness: 1.15 }, seed: 23 },
    speed: 1.55, run: 3.6, umbrella: false, rainHabit: 'dash',
    plan(d) {
      const B = [];
      const weekday = d.dow >= 1 && d.dow <= 5;
      if (d.dow === 0) return away(B, 'dorm_m', 18.7, d);
      B.push({ at: 0, until: weekday ? 6.95 : 9.0, place: 'dorm_m', act: 'sleep' });
      B.push({ at: weekday ? 7.05 : 9.15, until: weekday ? 7.3 : 9.5, place: 'canteen1', act: 'eat', run: true });
      if (weekday) {
        B.push({ at: 7.45, until: 9.5, place: 'erhao', door: 0, act: 'class', run: true, breaks: d.rain ? null : ['lane_mid'] });
        if (!d.rain) B.push({ at: EXERCISE[0], until: EXERCISE[1], place: 'field:5:1', act: 'exercise', run: true });
        B.push({ at: 10.0, until: 12.25, place: 'erhao', door: 0, act: 'class', run: true });
        B.push({ at: 12.3, until: 12.55, place: 'canteen1', act: 'eat', run: true });
        if (!d.rain) B.push({ at: 12.7, until: 13.15, place: 'court_a', act: 'play', run: true });
        B.push({ at: 13.3, until: 14.25, place: 'dorm_m', act: 'rest', run: d.rain });
        B.push({ at: 14.45, until: 16.833, place: 'erhao', door: 0, act: 'class', run: true });
        if (!d.rain) B.push({ at: 16.95, until: 18.0, place: d.rng() < 0.7 ? 'court_a' : 'court_b', act: 'play', run: true });
        else B.push({ at: 16.95, until: 17.4, place: 'eave_erhao_n', act: 'watch' });
        B.push({ at: 18.15, until: 18.6, place: 'canteen1', act: 'eat', run: true });
        B.push({ at: 18.95, until: 22.0, place: 'erhao', door: 0, act: 'study', run: true });
      } else {
        if (!d.rain) B.push({ at: 9.8, until: 11.6, place: 'court_a', act: 'play', run: true });
        B.push({ at: 11.8, until: 12.3, place: 'canteen1', act: 'eat' });
        B.push({ at: 12.5, until: 15.5, place: 'dorm_m', act: 'rest' });
        if (!d.rain) B.push({ at: 15.8, until: 16.6, place: 'track_s', act: 'laps', run: true });
        if (!d.rain) B.push({ at: 16.7, until: 17.8, place: 'court_b', act: 'play', run: true });
        B.push({ at: 18.0, until: 18.5, place: 'canteen1', act: 'eat' });
      }
      B.push({ at: 22.1, until: 24, place: 'dorm_m', act: 'sleep', run: true });
      return B;
    },
    lines: {
      near: ['让一让——', '篮球场那边有人吗？', '（喘着气）还好赶上了。', '要迟到了要迟到了。'],
      rain: ['这雨说下就下。', '没带伞，跑过去就行。'],
      night: ['晚自习前还能投几个。'],
    },
  },
  {
    id: 'fu', name: '符老师', role: '物理教师', kind: 'teacher',
    about: '办公室在科学馆。上课前抱着教案从科学馆走到一号楼、二号楼；下班从北门回家，周二周四留下来看晚自习。',
    figure: { model: 'teacher-f', style: 'bob', trousers: '#4a4a4f', glasses: true, acc: ['folder'], noBag: true },
    gait: { basic: { tempo: 0.94, stride: 0.98, armSwing: 0.7, lean: 1, looseness: 0.9 }, seed: 37 },
    speed: 1.2, run: 2.2, umbrella: true, rainHabit: 'inside',
    plan(d) {
      const B = [];
      const weekday = d.dow >= 1 && d.dow <= 5;
      if (!weekday) return [{ at: 0, until: 24, place: 'beimen_out', act: 'away' }];
      const duty = d.dow === 2 || d.dow === 4;
      B.push({ at: 0, until: 7.35, place: 'beimen_out', act: 'away' });
      // she teaches three periods a day, in 一号楼 and 二号楼; between them, the office in 科学馆
      const teach = d.rng() < 0.5 ? [[1, 'yihao', 0], [3, 'erhao', 0], [5, 'yihao', 0]] : [[0, 'erhao', 0], [2, 'yihao', 0], [6, 'erhao', 1]];
      const busy = teach.map(([pi, bld, door]) => ({ at: PERIODS[pi][0] - 0.03, until: PERIODS[pi][1] + 0.02, place: bld, door, act: 'teach' }));
      busy.push({ at: 12.35, until: 12.85, place: 'canteen1', act: 'eat' });
      busy.sort((x, y) => x.at - y.at);
      let t = 7.55;
      for (const blk of busy) {
        if (blk.at - t > 0.25) B.push({ at: t, until: blk.at - 0.1, place: 'kexue', act: 'work' });
        B.push(blk);
        t = blk.until + 0.08;
      }
      const end = duty ? 18.0 : 17.8;
      if (end - t > 0.2) B.push({ at: t, until: end, place: 'kexue', act: 'work' });
      if (duty) {
        B.push({ at: 18.15, until: 18.7, place: 'canteen1', act: 'eat' });
        B.push({ at: 18.9, until: 21.0, place: 'erhao', door: 0, act: 'duty' });
        B.push({ at: 21.2, until: 24, place: 'beimen_out', act: 'away' });
      } else B.push({ at: 18.0, until: 24, place: 'beimen_out', act: 'away' });
      return B;
    },
    lines: {
      near: ['同学，跑慢点。', '这节是物理课吧？', '（推了推眼镜）作业交了吗。', '下午见。'],
      rain: ['雨大，别在外面待太久。'],
      night: ['早点回宿舍。'],
    },
  },
  {
    id: 'wang', name: '王一苇', role: '高三（1）班', kind: 'student',
    about: '图书馆三楼靠窗的位置几乎是他的。走路也在看书；午休、放学后都在图书馆，周六一整天。',
    figure: { model: 'student-m', style: 'part', bag: '#5c4a3b', glasses: true, acc: ['book'] },
    gait: { basic: { tempo: 0.92, stride: 0.95, armSwing: 0.5, lean: 4, looseness: 0.85 }, seed: 41 },
    speed: 1.15, run: 2.6, umbrella: true, rainHabit: 'inside', reads: true,
    plan(d) {
      const B = [];
      const weekday = d.dow >= 1 && d.dow <= 5;
      if (d.dow === 0) return away(B, 'dorm_m', 18.4, d);
      B.push({ at: 0, until: weekday ? 6.6 : 7.4, place: 'dorm_m', act: 'sleep' });
      B.push({ at: weekday ? 6.75 : 7.55, until: weekday ? 7.05 : 7.9, place: 'canteen1', act: 'eat' });
      if (weekday) {
        B.push({ at: 7.3, until: 12.25, place: 'yihao', door: 3, act: 'class', breaks: d.rain ? null : ['library_steps'] });
        B.push({ at: 12.4, until: 12.6, place: 'canteen1', act: 'eat' });
        B.push({ at: 12.75, until: 14.2, place: 'library', act: 'read' });
        B.push({ at: 14.4, until: 16.833, place: 'yihao', door: 3, act: 'class' });
        B.push({ at: 16.95, until: 17.9, place: 'library', act: 'read' });
        B.push({ at: 18.05, until: 18.4, place: 'canteen1', act: 'eat' });
        B.push({ at: 18.85, until: 22.0, place: 'yihao', door: 3, act: 'study' });
      } else {
        B.push({ at: 8.1, until: 11.8, place: 'library', act: 'read' });
        B.push({ at: 11.95, until: 12.3, place: 'canteen1', act: 'eat' });
        B.push({ at: 12.5, until: 17.4, place: 'library', act: 'read' });
        if (!d.rain) B.push({ at: 17.55, until: 17.75, place: 'tree_n', act: 'stand' });
        B.push({ at: 17.9, until: 18.3, place: 'canteen1', act: 'eat' });
        B.push({ at: 18.5, until: 21.6, place: 'library', act: 'read' });
      }
      B.push({ at: 22.1, until: 24, place: 'dorm_m', act: 'sleep' });
      return B;
    },
    lines: {
      near: ['……（没抬头）', '图书馆三楼还有位置。', '抱歉，没看路。'],
      rain: ['（把书往怀里收了收）'],
      night: ['（合上书）'],
    },
  },
  {
    id: 'wu', name: '吴伯', role: '校工', kind: 'worker',
    about: '每天清晨扫榄仁树下和北门路上的落叶，上午去植物园，下午给花坛浇水。下雨时在衍林亭里坐着等雨停。',
    figure: { model: 'worker-m', style: 'grey', trousers: '#3d3b36', skin: '#c9a084', acc: ['broom'], noBag: true },
    gait: { preset: 'tired', basic: { tempo: 0.85, lean: 1.5, armSwing: 0.6, looseness: 1.2 }, seed: 53 },
    speed: 0.95, run: 1.6, umbrella: true, rainHabit: 'shelter',
    plan(d) {
      const B = [];
      if (d.dow === 0) return [{ at: 0, until: 24, place: 'beimen_out', act: 'away' }];
      B.push({ at: 0, until: 6.2, place: 'beimen_out', act: 'away' });
      if (d.rain) {
        B.push({ at: 6.5, until: 11.5, place: 'yanlin_ting', act: 'watch' });
      } else {
        B.push({ at: 6.45, until: 7.6, place: 'sweep:tree', act: 'sweep' });
        B.push({ at: 7.7, until: 8.4, place: 'sweep:gate', act: 'sweep' });
        B.push({ at: 8.6, until: 9.8, place: 'keji', act: 'rest' });
        if (d.dow !== 6) {
          B.push({ at: 10.1, until: 11.5, place: d.rng() < 0.5 ? 'garden_a' : 'garden_pond', act: 'tend' });
        }
      }
      B.push({ at: 11.75, until: 12.3, place: 'canteen1', act: 'eat' });
      B.push({ at: 12.45, until: 14.6, place: 'keji', act: 'rest' });
      if (d.dow === 6) { B.push({ at: 14.8, until: 24, place: 'beimen_out', act: 'away' }); return B; }
      if (d.rain) B.push({ at: 14.8, until: 17.2, place: 'yanlin_ting', act: 'watch' });
      else {
        B.push({ at: 14.9, until: 15.9, place: 'water:library', act: 'water' });
        B.push({ at: 16.0, until: 17.1, place: 'water:fengqi', act: 'water' });
      }
      B.push({ at: 17.4, until: 24, place: 'beimen_out', act: 'away' });
      return B;
    },
    lines: {
      near: ['落叶扫不完的。', '这棵老树，比我来得早多了。', '（点点头，接着扫）'],
      rain: ['雨后路滑，慢点走。', '等雨停。'],
      night: [],
    },
  },
];

/** routes some activities walk while they last (sweeping, watering): world points in the walk's frame */
export const ROUTES = {
  'sweep:tree': [[-9.5, -9.5], [9.5, -9.5], [10.5, 9.5], [-9.5, 10.2], [-9.5, -9.5]],
  'sweep:gate': [[-35.6, -70], [-35.6, -40], [-35.6, -20], [-35.6, -40], [-35.6, -70]],
  'water:library': [[38.6, -12], [38.6, 20], [38.6, 38], [38.6, 20], [38.6, -12]],
  'water:fengqi': [[-90, -22], [-58, -22], [-58, -50], [-90, -50], [-90, -22]],
};

/** a spot on the field for 课间操: a grid by class (rows of the field are 3 m apart) */
export function fieldSpot(key) {
  const [, col, row] = key.split(':').map(Number);
  return { x: -201 + (col - 4) * 6, z: -58.8 + (row - 2) * 4, yaw: Math.PI, label: '操场 · 课间操' };
}

// ---- helpers for the plans
function away(B, dorm, back, d) {
  B.push({ at: 0, until: back - 0.4, place: 'beimen_out', act: 'away' });
  B.push({ at: back, until: 18.9, place: 'canteen1', act: 'eat' });
  B.push({ at: 19.0, until: 22.0, place: 'yihao', door: 1, act: 'study' });
  B.push({ at: 22.15, until: 24, place: dorm, act: 'sleep' });
  void d;
  return B;
}
export const ACT_LABEL = {
  sleep: '在宿舍', rest: '午休', eat: '吃饭', class: '上课', study: '晚自习', teach: '上课', duty: '看晚自习', work: '在办公室', read: '看书',
  sketch: '画速写', stand: '站着', watch: '看雨', exercise: '课间操', play: '打球', laps: '跑步', sweep: '扫落叶', water: '浇花', tend: '侍弄花草', away: '不在学校', break: '课间',
};
