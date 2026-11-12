// 语文 · 英语 · 历史 · 思想政治
import { C, TAU, clamp, lerp, group, at, rot, box, cyl, ball, cone, rod, wire, strip, dash, glow, note, card, plot, flat, glass, sheet, disposeTree, THREE } from '../ink.js';

const fresh = (k, holder) => { disposeTree(holder); holder.clear(); };

// ================================================================ 语文
const POEMS = [
  { name: '登鹳雀楼', by: '王之涣', lines: ['白日依山尽', '黄河入海流', '欲穷千里目', '更上一层楼'], old: ['仄仄平平仄', '平平仄仄平', '仄平平仄仄', '仄仄仄平平'], mod: ['平仄平平仄', '平平仄仄平', '仄平平仄仄', '仄仄平平平'], ru: '白日入欲目一' },
  { name: '绝句', by: '杜甫', lines: ['迟日江山丽', '春风花草香', '泥融飞燕子', '沙暖睡鸳鸯'], old: ['平仄平平仄', '平平平仄平', '平平平仄仄', '平仄仄平平'], mod: ['平仄平平仄', '平平平仄平', '平平平仄仄', '平仄仄平平'], ru: '日' },
  { name: '静夜思', by: '李白', lines: ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'], old: ['平平平仄平', '平仄仄仄平', '仄平仄平仄', '平平平仄平'], mod: ['平平平仄平', '平仄仄仄平', '仄平仄平仄', '平平平仄平'], ru: '月' },
];
const meter = {
  id: 'chn-meter', subject: 'chn', title: '近体诗的平仄', en: 'Tonal patterns in regulated verse',
  lede: ['古人把字音分成“平”和“仄”两类。写近体诗，一句之内平仄要交替，一联之内要相对，两联之间要相粘。', '这里把平声画成矮砖、仄声画成高砖。合律的诗，砖块高低错落有致；不合律的地方，一眼就看得出来。'],
  formula: '一三五不论，二四六分明', formulaNote: '五言诗看每句的第 2、4 字：本句相反，对句相反（对），邻联相同（粘）',
  terms: [['平仄', '平声为“平”，上、去、入三声为“仄”。'], ['入声', '古代短促的声调，普通话里已消失。'], ['对与粘', '一联内平仄相反叫对，两联间相同叫粘。']],
  predict: { q: '“白日依山尽”的“白”，按古诗格律算平声还是仄声？', options: ['平声，普通话读第二声', '仄声，它是入声字', '平仄都可以'], answer: 1, why: '“白”在古代是入声字，属于仄声。入声在普通话里分别变成了四个声调，所以用今天的读音去套格律，常常会“出错”。切到“普通话”看看第四句变成了什么。' },
  challenge: '三首诗里有一首是不守格律的“古绝”。找出它，并说出哪里失对、哪里失粘。',
  fig: '五言绝句：矮砖为平，高砖为仄，红点为入声字', hint: '换一首诗；再切换古音和普通话。',
  teach: {
    where: '统编版高中语文 · 古诗词单元与“古诗词诵读”栏目（诗歌格律常识）；初中古诗词教学拓展。',
    ask: ['按普通话读，《登鹳雀楼》末句变成“仄仄平平平”，这犯了什么毛病？', '《静夜思》不合律却千古传诵，这说明格律和好诗之间是什么关系？'],
    simplify: '平仄依平水韵标注，只检查每句第 2、4 字的对、粘以及“三平尾”；未处理拗救、孤平等更细的规则，个别多音字（如“望”）取常见读法。',
  },
  controls: [
    { id: 'poem', type: 'choice', label: '', options: POEMS.map((q) => `《${q.name}》`), value: 0, wide: true },
    { id: 'mode', type: 'choice', label: '读音', options: ['古音（平水韵）', '普通话'], value: 0, wide: true },
  ],
  build(k) {
    const p = k.p, holder = new THREE.Group(), X0 = -3.9, Z0 = -3.8, DX = 1.22, DZ = 1.3;
    const info = at(card('\n\n', { w: 4.5, size: 0.3, align: 'left' }), 2.3, 0, 3.0);
    k.root.add(holder, info);
    let last = '', res = {};
    const draw = () => {
      fresh(k, holder);
      const q = POEMS[p.poem], pat = p.mode ? q.mod : q.old;
      q.lines.forEach((line, r) => {
        [...line].forEach((ch, c) => {
          const ze = pat[r][c] === '仄', h = ze ? 0.58 : 0.18, x = X0 + c * DX, z = Z0 + r * DZ;
          holder.add(at(box(1.04, h, 0.95, ze ? '#ffe2ad' : C.paper), x, 0, z), at(note(ch, { size: 0.58, lay: 'flat', bold: true }), x, h + 0.02, z));
          if (!p.mode && q.ru.includes(ch)) holder.add(at(flat(new THREE.SphereGeometry(0.09, 12, 8), C.red), x + 0.4, h + 0.1, z - 0.34));
        });
        holder.add(at(note(pat[r], { size: 0.3, lay: 'flat' }), X0 + 5 * DX + 0.75, 0.03, Z0 + r * DZ));
      });
      const two = (r) => pat[r][1] + pat[r][3], opp = (a, b) => a[0] !== b[0] && a[1] !== b[1];
      const d1 = opp(two(0), two(1)), n = two(1) === two(2), d2 = opp(two(2), two(3)), tri = pat.some((s) => s.endsWith('平平平'));
      [[d1, '对', 0], [n, '粘', 1], [d2, '对', 2]].forEach(([ok, w, r]) => holder.add(at(note(`${w}：${ok ? '合' : `失${w}`}`, { size: 0.3, lay: 'flat', color: ok ? '#1f7a4d' : '#b7442f' }), X0 + 5 * DX + 0.75, 0.03, Z0 + (r + 0.5) * DZ)));
      const ok = d1 && n && d2 && !tri;
      res = { ok, d1, n, d2, tri, q };
      info.set(`《${q.name}》${q.by}\n${ok ? '合律：一首标准的五言绝句' : '不合律'}${tri ? '（三平尾）' : ''}\n${ok ? '砖块高低，上下两句正好相反' : [!d1 && '首联失对', !n && '失粘', !d2 && '尾联失对'].filter(Boolean).join('、') || '句尾连着三个平声'}`);
    };
    return {
      update() { const key = `${p.poem}|${p.mode}`; if (key !== last) { last = key; draw(); } },
      margin: () => [p.mode ? '按普通话四声' : '按平水韵', '一二声 → 平', '三四声 → 仄', p.mode ? '入声已经消失' : `入声字：${res.q?.ru.split('').join(' ')}`, '偶数句押平声韵', res.ok ? '粘对俱合' : '看右侧红字'],
    };
  },
};

const FORMS = [
  { name: '甲', p1: '所有金属都导电', p2: '铜是金属', c: '所以，铜导电', S: '铜', M: '金属', P: '导电的物体', valid: true, why: '小圈在中圈里，中圈在大圈里',
    cfg: [{ P: [0, 0, 2.5], M: [0.3, 0, 1.65], S: [0.6, 0, 0.8], ok: true }] },
  { name: '乙', p1: '鸟都会下蛋', p2: '鳄鱼会下蛋', c: '所以，鳄鱼是鸟', S: '鳄鱼', M: '会下蛋的动物', P: '鸟', valid: false, why: '中项“会下蛋的”两次都只说到一部分',
    cfg: [{ M: [0, 0, 2.5], P: [-1.1, 0, 1.0], S: [1.2, 0, 0.7], ok: false }, { M: [0, 0, 2.5], P: [-0.3, 0, 1.5], S: [-0.5, 0, 0.6], ok: true }, { M: [0, 0, 2.5], P: [-0.5, 0, 1.1], S: [0.7, 0, 0.8], ok: false }] },
  { name: '丙', p1: '哺乳动物都不是冷血动物', p2: '鲸是哺乳动物', c: '所以，鲸不是冷血动物', S: '鲸', M: '哺乳动物', P: '冷血动物', valid: true, why: '小圈被中圈包住，中圈与大圈完全分开',
    cfg: [{ M: [-1.4, 0, 1.55], S: [-1.4, 0, 0.75], P: [1.8, 0, 1.3], ok: true }] },
  { name: '丁', p1: '学生都要学习', p2: '老师不是学生', c: '所以，老师不用学习', S: '老师', M: '学生', P: '要学习的人', valid: false, why: '“要学习的人”在前提里只说到一部分，结论却说到了全部',
    cfg: [{ P: [0, 0, 2.4], M: [-1.0, 0, 0.9], S: [1.1, 0, 0.75], ok: false }, { P: [-1.0, 0, 1.7], M: [-1.2, 0, 0.9], S: [2.3, 0, 0.8], ok: true }, { P: [-0.6, 0, 1.8], M: [-1.0, 0, 0.85], S: [1.5, 0, 0.9], ok: false }] },
];
const syllogism = {
  id: 'chn-syllogism', subject: 'chn', title: '三段论：推理有效吗', en: 'Testing a syllogism',
  lede: ['从两个前提推出一个结论，叫三段论。前提都是真的，结论就一定可靠吗？不一定，还要看推理的形式对不对。', '把每个概念画成一个圈：先按两个前提把圈摆好，再看结论。只要能摆出一种“前提都对、结论却错”的画法，这个推理就是无效的。'],
  formula: '大前提 + 小前提 ⟹ 结论', formulaNote: '有效推理：只要前提为真，结论必然为真（不存在反例）',
  terms: [['中项', '在两个前提里都出现、结论里不出现的概念。'], ['周延', '一个判断是否断定了某概念的全部对象。'], ['反例', '前提成立而结论不成立的情形。']],
  predict: { q: '“鸟都会下蛋；鳄鱼会下蛋；所以鳄鱼是鸟。”这个推理错在哪里？', options: ['前提是假的', '前提都对，但推理形式无效', '结论恰好是假的，换个例子就对了'], answer: 1, why: '两个前提都是真的。问题在于“会下蛋的动物”这个中项，两次都只涉及它的一部分：鸟是一部分，鳄鱼是另一部分，两部分完全可以不相干。这叫“中项不周延”。' },
  challenge: '照论式丁的样子，自己编一个听上去很有道理、其实无效的推理。',
  fig: '三个概念的外延关系（欧拉图）', hint: '换论式；再点“换一种画法”找反例。',
  teach: {
    where: '统编版高中语文 选择性必修上册 · 第四单元“逻辑的力量”：发现潜藏的逻辑谬误、运用有效的推理形式。',
    ask: ['论式乙的结论换成“所以，鳄鱼不是鸟”，推理就有效了吗？', '“我不是告诉过你吗？所有好学生都按时交作业，你没按时交……”后面能必然推出什么？'],
    simplify: '每个概念的外延用一个圆表示，只列举有代表性的几种位置关系；严格的有效性判定需要考察全部可能情形（三段论规则或文恩图）。',
  },
  controls: [
    { id: 'form', type: 'choice', label: '论式', options: FORMS.map((f) => f.name), value: 0 },
    { id: 'next', type: 'button', label: '换一种画法' },
  ],
  build(k) {
    const p = k.p, Z = -1.3, COL = { P: C.violet, M: C.amber, S: C.teal }, H = { P: 0.2, M: 0.3, S: 0.4 };
    const disc = {}, tag = {};
    for (const n of ['P', 'M', 'S']) {
      disc[n] = group(glass(new THREE.CylinderGeometry(1, 1, H[n], 56, 1, true).translate(0, H[n] / 2, 0)), at(flat(new THREE.CircleGeometry(1, 56).rotateX(-Math.PI / 2), COL[n], { opacity: 0.22 }), 0, H[n], 0));
      disc[n].userData.t = [0, 0, 1]; disc[n].position.z = Z;
      tag[n] = note('—', { size: 0.3, w: 3.0, bold: true });
      k.root.add(disc[n], tag[n]);
    }
    const info = at(card('\n\n', { w: 5.6, size: 0.3, align: 'left' }), 0.6, 0, 3.0);
    const verdict = at(note('有效', { size: 0.6, bold: true, w: 3.2 }), 3.2, 3.4, -3.2);
    k.root.add(info, verdict);
    let ci = 0, last = -1;
    const apply = () => {
      const f = FORMS[p.form], c = f.cfg[ci % f.cfg.length];
      for (const n of ['P', 'M', 'S']) { disc[n].userData.t = c[n]; tag[n].set(f[n]); }
      info.set(`${f.p1}；\n${f.p2}；\n${f.c}。`);
      verdict.set(f.valid ? '有效' : c.ok ? '这样画，结论碰巧成立' : '反例！'); verdict.material.color.set(f.valid ? '#1f7a4d' : c.ok ? C.ink : '#b7442f');
    };
    return {
      press() { ci++; apply(); },
      update(dt) {
        if (p.form !== last) { last = p.form; ci = 0; apply(); }
        for (const n of ['P', 'M', 'S']) {
          const d = disc[n], [x, z, r] = d.userData.t, a = 1 - Math.exp(-dt * 6);
          d.position.x = lerp(d.position.x, x - 0.6, a); d.position.z = lerp(d.position.z, Z + z, a);
          const s = lerp(d.scale.x, r, a); d.scale.set(s, 1, s);
          const off = n === 'P' ? [-0.72, -0.72] : n === 'M' ? [0.72, -0.72] : [0, 0.15];
          tag[n].position.set(d.position.x + off[0] * s, H[n] + 0.6, d.position.z + off[1] * s);
        }
      },
      margin() {
        const f = FORMS[p.form], c = f.cfg[ci % f.cfg.length];
        return [`论式${f.name}`, `大项：${f.P}`, `中项：${f.M}`, `小项：${f.S}`, f.valid ? '只有一类画法' : `画法 ${ci % f.cfg.length + 1} / ${f.cfg.length}`, f.valid ? '结论必然成立' : c.ok ? '还不能说明问题' : '前提真而结论假', f.valid ? '' : '→ 推理无效'].filter(Boolean);
      },
    };
  },
};

// ================================================================ 英语
const TENSE = [
  [['一般过去时', 'did', 'She wrote a letter yesterday.'], ['过去进行时', 'was / were doing', 'She was writing when I called.'], ['过去完成时', 'had done', 'She had written it before I called.'], ['过去完成进行时', 'had been doing', 'She had been writing for an hour when I called.']],
  [['一般现在时', 'do / does', 'She writes letters every week.'], ['现在进行时', 'am / is / are doing', 'She is writing a letter now.'], ['现在完成时', 'have / has done', 'She has written the letter.'], ['现在完成进行时', 'have / has been doing', 'She has been writing for two hours.']],
  [['一般将来时', 'will do', 'She will write a letter tomorrow.'], ['将来进行时', 'will be doing', 'She will be writing at 8 tomorrow.'], ['将来完成时', 'will have done', 'She will have written it by Friday.'], ['将来完成进行时', 'will have been doing', 'By noon she will have been writing for 3 hours.']],
];
const tense = {
  id: 'eng-tense', subject: 'eng', title: '时态时间轴', en: 'Tenses on a timeline',
  lede: ['英语的谓语动词同时回答两个问题：事情发生在什么时间（过去、现在、将来），以及我们怎么看它（一个点、正在进行、已经完成、持续到某刻）。', '把“说话的此刻”“参照时间”和“动作本身”摆到一条时间轴上，十二种时态就是它们的十二种摆法。'],
  formula: 'tense = time × aspect', formulaNote: '时（过去 / 现在 / 将来）× 体（一般 / 进行 / 完成 / 完成进行）',
  terms: [['now', '说话的时刻，时间轴的原点。'], ['参照时间', '说话人站在哪个时刻去看这个动作。'], ['完成体', '动作在参照时间之前，但与它有关联。']],
  predict: { q: '“I have lost my key.” 和 “I lost my key.” 最主要的区别是？', options: ['前者发生得更早', '前者强调对现在的影响：钥匙现在还没找到', '没有区别，可以随意互换'], answer: 1, why: '现在完成时把过去的动作和“现在”连在一起：丢了，而且现在仍受影响。一般过去时只是陈述过去某时发生的事，钥匙后来找没找到并不清楚。' },
  challenge: '用同一个动词 read，照着时间轴口头造出十二个句子。',
  fig: '时间轴：紫色是动作，铜色小旗是参照时间', hint: '先选“时”，再选“体”。',
  teach: {
    where: '高中英语（人教版 / 外研版）语法专题：动词的时态；必修各册语法板块。',
    ask: ['“She was writing when I called.” 里哪个动作是背景，哪个动作是打断背景的点？', '一般现在时为什么画成一串点，而不是“now”上的一个点？'],
    simplify: '按“说话时间—参照时间—事件时间”的关系作示意，时间长短不按比例；每种时态只给了最典型的一种用法。',
  },
  controls: [
    { id: 'time', type: 'choice', label: '时', options: ['过去', '现在', '将来'], value: 1 },
    { id: 'asp', type: 'choice', label: '体', options: ['一般', '进行', '完成', '完成进行'], value: 2, wide: true },
  ],
  build(k) {
    const p = k.p, Y = 1.5, Z = -1.4, holder = new THREE.Group();
    k.root.add(rod([-4.5, Y, Z], [4.5, Y, Z], 0.05), rod([-4.2, 0, Z], [-4.2, Y, Z], 0.06), rod([4.2, 0, Z], [4.2, Y, Z], 0.06), rot(at(cone(0.16, 0.4), 4.5, Y, Z), 0, 0, -Math.PI / 2));
    k.root.add(rod([0, 0, Z], [0, Y + 1.5, Z], 0.05, C.ink), at(card('now', { size: 0.34, lay: 'up' }), 0, Y + 1.5, Z), at(note('过去 past', { size: 0.3, lay: 'flat' }), -3.2, 0.03, Z + 0.9), at(note('将来 future', { size: 0.3, lay: 'flat' }), 3.2, 0.03, Z + 0.9));
    const sent = at(card('\n', { w: 8.2, size: 0.34 }), 0, 0, 2.9);
    const name = at(note('', { size: 0.5, bold: true, w: 5 }), 0, 4.4, -3.4);
    k.root.add(holder, sent, name);
    let last = '', pulse = [];
    const draw = () => {
      fresh(k, holder); pulse = [];
      const r = [-2.3, 0, 2.3][p.time], [zh, form, ex] = TENSE[p.time][p.asp];
      const ev = (x0, x1) => { const m = at(flat(new THREE.BoxGeometry(Math.max(0.01, x1 - x0), 0.34, 0.34), C.violet, { opacity: 0.85 }), (x0 + x1) / 2, Y, Z); const g = at(glow(C.violet, 1.6 + (x1 - x0), 0.4), (x0 + x1) / 2, Y, Z); holder.add(m, g); pulse.push(g); };
      const dot = (x) => { const b = at(flat(new THREE.SphereGeometry(0.22, 20, 14), C.violet), x, Y, Z), g = at(glow(C.violet, 1.5, 0.5), x, Y, Z); holder.add(b, g); pulse.push(g); };
      if (r !== 0 || p.asp >= 1) holder.add(rod([r, Y, Z], [r, Y + 0.95, Z], 0.035, C.copper), at(flat(new THREE.ConeGeometry(0.2, 0.42, 3).rotateZ(-Math.PI / 2), C.copper), r + 0.24, Y + 0.8, Z), at(note(p.time === 1 ? '' : '参照时间', { size: 0.26, color: C.copper }), r, Y + 1.25, Z));
      if (p.asp === 0) { if (p.time === 1) [-2.4, -1.2, 0, 1.2, 2.4].forEach(dot); else dot(r); }
      else if (p.asp === 1) ev(r - 0.9, r + 0.9);
      else if (p.asp === 2) { dot(r - 1.4); holder.add(strip(12, { w: 0.05, color: C.violet, pts: Array.from({ length: 12 }, (_, i) => [r - 1.4 + 1.4 * i / 11, Y + Math.sin(i / 11 * Math.PI) * 0.7, Z]) })); }
      else ev(r - 1.9, r);
      sent.set(`${ex}\n${form}`); name.set(zh);
    };
    return {
      update(dt, t) { const key = `${p.time}|${p.asp}`; if (key !== last) { last = key; draw(); } pulse.forEach((g) => { g.material.opacity = 0.35 + Math.sin(t * 3) * 0.12; }); },
      margin: () => [TENSE[p.time][p.asp][0], `结构：${TENSE[p.time][p.asp][1]}`, ['参照：过去某时', '参照：现在', '参照：将来某时'][p.time], ['动作 = 一个点', '动作正在进行', '动作在此之前', '持续到此刻'][p.asp], p.asp === 2 ? '弧线 = 与参照时间的关联' : p.asp === 0 && p.time === 1 ? '一串点 = 经常发生' : ''].filter(Boolean),
    };
  },
};

const ROLE = { S: ['主语', '#cfe6ff'], V: ['谓语', '#ffd9c7'], O: ['宾语', '#d6f0dc'], IO: ['间接宾语', '#ffeab8'], DO: ['直接宾语', '#d6f0dc'], P: ['表语', '#e3dbff'], C: ['宾语补足语', '#e3dbff'], A: ['状语', '#ece8dc'] };
const PATS = [
  { name: 'S + V', act: [['S', 'The sun'], ['V', 'rises']], adv: 'in the east', pas: null, why: '不及物动词没有宾语，无法变被动' },
  { name: 'S + V + P', act: [['S', 'The soup'], ['V', 'tastes'], ['P', 'delicious']], adv: 'today', pas: null, why: '系动词连接主语和表语，没有被动语态' },
  { name: 'S + V + O', act: [['S', 'Tom'], ['V', 'reads'], ['O', 'books']], adv: 'every day', pas: [['S', 'Books'], ['V', 'are read'], ['A', 'by Tom']] },
  { name: 'S + V + IO + DO', act: [['S', 'She'], ['V', 'gave'], ['IO', 'me'], ['DO', 'a book']], adv: 'yesterday', pas: [['S', 'I'], ['V', 'was given'], ['DO', 'a book']] },
  { name: 'S + V + O + C', act: [['S', 'We'], ['V', 'found'], ['O', 'the room'], ['C', 'empty']], adv: 'this morning', pas: [['S', 'The room'], ['V', 'was found'], ['C', 'empty']] },
];
const sentence = {
  id: 'eng-sentence', subject: 'eng', title: '五种基本句型', en: 'Five basic sentence patterns',
  lede: ['再长的英语句子，剥掉修饰成分，主干都逃不出五种样子。区别只在谓语动词后面跟什么：什么都不跟、跟表语、跟一个宾语、跟两个宾语，还是跟宾语加补足语。', '把每个成分做成一块积木。读长难句时，先把这几块找出来。'],
  formula: 'S + V (+ O / P / C)', formulaNote: '主语 + 谓语动词，再由动词的类型决定后面的成分',
  terms: [['表语', '跟在系动词后，说明主语“是什么、怎么样”。'], ['双宾语', '间接宾语（人）+ 直接宾语（物）。'], ['宾语补足语', '补充说明宾语的状态或身份。']],
  predict: { q: '“The soup tastes delicious.” 里的 delicious 是什么成分？', options: ['宾语', '表语', '状语'], answer: 1, why: 'taste 在这里是系动词，不表示“品尝”的动作，而是把主语 soup 和它的性质连起来。delicious 说明汤“怎么样”，是表语，所以用形容词而不是副词 deliciously。' },
  challenge: '把 “They made him captain.” 拆成积木，它属于哪一种？再把它变成被动。',
  fig: '句子成分积木（颜色表示成分）', hint: '换句型；再试试加状语、变被动。',
  teach: {
    where: '高中英语（人教版必修第一册语法：句子成分与基本句型；外研版同类板块）。',
    ask: ['“She made me a cake.” 和 “She made me happy.” 结构相同吗？各属哪种句型？', '变被动时，是哪块积木被搬到了句首？双宾语句可以有几种被动形式？'],
    simplify: '只列举五种基本句型（未单列 There be 句型），每种给一个例句；双宾语句的被动只演示了以间接宾语作主语的一种。',
  },
  controls: [
    { id: 'pat', type: 'choice', label: '', options: PATS.map((q) => q.name), value: 2, wide: true },
    { id: 'adv', type: 'toggle', label: '加状语', value: false },
    { id: 'pas', type: 'toggle', label: '变被动', value: false },
  ],
  build(k) {
    const p = k.p, holder = new THREE.Group(), Z = -0.9;
    const info = at(card('\n', { w: 6.4, size: 0.32 }), 0, 0, 2.9);
    const name = at(note('', { size: 0.5, bold: true, w: 6 }), 0, 3.6, -3.4);
    k.root.add(holder, info, name);
    let last = '';
    const draw = () => {
      fresh(k, holder);
      const q = PATS[p.pat], pas = p.pas && q.pas, parts = (pas ? q.pas : q.act).slice();
      if (p.adv) parts.push(['A', q.adv]);
      const cards = parts.map(([r, w]) => card(w, { size: 0.5, bg: ROLE[r][1], bold: true }));
      const gap = 0.3, total = cards.reduce((a, c) => a + c.w, 0) + gap * (cards.length - 1), sc = Math.min(1, 9.0 / total);
      let x = -total * sc / 2;
      cards.forEach((c, i) => {
        const w = c.w * sc, r = parts[i][0];
        c.scale.setScalar(sc);
        holder.add(at(box(w, 0.4, 1.3, ROLE[r][1]), x + w / 2, 0, Z), at(c, x + w / 2, 0.4, Z + 0.35), at(note(ROLE[r][0], { size: 0.3, lay: 'flat' }), x + w / 2, 0.03, Z + 1.15), at(note(r === 'A' ? 'A' : r, { size: 0.3, lay: 'flat', italic: true, color: C.copper }), x + w / 2, 0.03, Z + 1.6));
        x += w + gap * sc;
      });
      name.set(pas ? `${q.name}（被动）` : q.name);
      info.set(p.pas && !q.pas ? `这个句型不能变被动\n${q.why}` : `${parts.map((x2) => x2[1]).join(' ')}.\n${parts.map((x2) => ROLE[x2[0]][0]).join(' + ')}`);
    };
    return {
      update() { const key = `${p.pat}|${p.adv}|${p.pas}`; if (key !== last) { last = key; draw(); } },
      margin() {
        const q = PATS[p.pat];
        return [q.name, ['不及物动词', '系动词', '及物动词', '双宾动词', '宾补动词'][p.pat], ['rise, happen, arrive', 'be, taste, look, become', 'read, like, finish', 'give, tell, send, show', 'find, make, call, keep'][p.pat], p.adv ? '状语可有可无' : '主干不含状语', p.pas ? (q.pas ? '宾语 → 新主语' : '没有宾语，没有被动') : ''].filter(Boolean);
      },
    };
  },
};

// ================================================================ 历史
const TEXTS = ['学而不厌诲人不倦', '人而无信不知其可', '己所不欲勿施于人'];
const printing = {
  id: 'his-type', subject: 'his', title: '活字印刷', en: 'Movable type',
  lede: ['北宋庆历年间，平民毕昇用胶泥刻字，一字一印，烧硬后排进铁框，就能印书。印完拆版，字模还能再用。这件事被沈括记在《梦溪笔谈》里。', '和整块雕刻的雕版相比，活字省的不是印一页的工夫，而是换一页时不必重新刻一整块版。'],
  formula: '字模：反字　→　印张：正字', formulaNote: '字模上的字左右相反，印到纸上才是正的；排版的行序也要反过来',
  terms: [['雕版印刷', '把整页内容反刻在一块木板上。'], ['活字', '一个字一个印，可以拆开重排。'], ['《梦溪笔谈》', '北宋沈括著，记载了毕昇的发明。']],
  predict: { q: '字模上刻的字是什么样子的？', options: ['和书上一样的正字', '左右相反的反字', '上下颠倒的字'], answer: 1, why: '印刷相当于盖印章：纸覆上去再揭开，左右就对调了。所以字模必须刻成反字，竖排的行序在版上也是从左往右排，印出来才是从右往左读。' },
  challenge: '三句话各印一次，雕版和活字一共各要刻多少个字？为什么差得不算太多？',
  fig: '排好的字模（左）与印出的纸张（右）', hint: '换一句话，按“印一张”。',
  teach: {
    where: '统编版历史 中外历史纲要（上）· 辽宋夏金元的文化：宋代科技（活字印刷术）；选择性必修 3 · 文化的传承与保护。',
    ask: ['只印一种书、印很多份，雕版和活字哪个更合算？印很多种书、每种印得少呢？', '活字印刷发明后，雕版在中国仍长期是主流，可能有哪些原因？（提示：汉字的数量）'],
    simplify: '用 8 个字的版面示意排版、刷墨、覆纸的过程；“刻字数”只统计本页演示的三句话，真实印书需要数以万计的字模，常用字要备多个。',
  },
  controls: [
    { id: 'text', type: 'choice', label: '', options: TEXTS.map((s) => `${s.slice(0, 4)}…`), value: 0, wide: true },
    { id: 'mode', type: 'choice', label: '版式', options: ['活字', '雕版'], value: 0 },
    { id: 'go', type: 'button', label: '印一张' },
  ],
  build(k) {
    const p = k.p, FX = -2.0, Z = -0.6, DX = 1.12, DZ = 1.08, holder = new THREE.Group();
    k.root.add(at(box(2.9, 0.16, 4.9, C.shade), FX, 0, Z), holder);
    const paper = box(2.5, 0.04, 4.5), printed = at(sheet(2.3, 4.3, () => {}, { lay: 'flat' }), 0, 0.05, 0);
    paper.add(printed); printed.visible = false;
    const pile = at(box(2.6, 0.2, 4.6), 2.9, 0, Z);
    const info = at(card('\n', { w: 3.6, size: 0.31, align: 'left' }), 2.9, 0, 3.0);
    k.root.add(paper, pile, info);
    const stock = {}, plates = new Set(); let carved = 0, n = 0, t = -1, last = '';
    const layout = (i) => [i < 4 ? 0 : 1, i % 4]; // 版上：第一行在左（印出来在右）
    const draw = () => {
      fresh(k, holder);
      const s = TEXTS[p.text], need = {};
      [...s].forEach((ch) => { need[ch] = (need[ch] || 0) + 1; });
      for (const ch in need) if ((stock[ch] || 0) < need[ch]) { carved += need[ch] - (stock[ch] || 0); stock[ch] = need[ch]; }
      plates.add(p.text);
      if (p.mode) holder.add(at(box(2.5, 0.5, 4.5, C.wood), FX, 0.16, Z));
      [...s].forEach((ch, i) => {
        const [c, r] = layout(i), x = FX + (c - 0.5) * DX, z = Z + (r - 1.5) * DZ;
        if (!p.mode) holder.add(at(box(0.98, 0.5, 0.98, '#ecdcc0'), x, 0.16, z));
        const lab = at(note(ch, { size: 0.66, lay: 'flat', bold: true }), x, 0.68, z); lab.scale.x = -1;
        holder.add(lab);
      });
      printed.redraw((x, S, w, h) => {
        x.fillStyle = '#1e2b36'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `600 ${S * 0.66}px "Songti SC","Noto Serif CJK SC",serif`;
        [...s].forEach((ch, i) => { const [c, r] = layout(i); x.fillText(ch, (w / 2 + (0.5 - c) * DX) * S, (h / 2 + (r - 1.5) * DZ) * S); });
      });
      printed.visible = false; t = -1;
    };
    return {
      press() { if (t < 0 || t > 2.4) t = 0; },
      update(dt) {
        const key = `${p.text}|${p.mode}`; if (key !== last) { last = key; draw(); }
        if (t >= 0 && t <= 2.4) { t += dt; if (t > 1.3 && !printed.visible) { printed.visible = true; n++; } }
        const a = t < 0 ? 1 : clamp(t / 2.4), over = clamp(1 - Math.abs(a - 0.5) * 2.6 + 0.3), x = lerp(2.9, FX, over), down = clamp(1 - Math.abs(a - 0.5) * 8);
        paper.position.set(x, lerp(lerp(0.22, 2.6, Math.sin(clamp(a) * Math.PI)), 0.7, down), Z);
        info.set(`已印 ${n} 张\n${p.mode ? '整块木板，一页一版' : '八个字模，可拆可排'}`);
      },
      margin: () => ['累计要刻的字：', `雕版 ${plates.size * 8} 个`, `（${plates.size} 块版）`, `活字 ${carved} 个`, '（旧字模直接再用）', '版上是反字', '行序也是反的'],
    };
  },
};

const DYN = [['夏', -2070, -1600], ['商', -1600, -1046], ['西周', -1046, -771], ['春秋战国', -770, -221], ['秦', -221, -207], ['汉', -202, 220], ['三国两晋南北朝', 220, 589], ['隋', 581, 618], ['唐', 618, 907], ['五代十国', 907, 960], ['宋', 960, 1279], ['元', 1271, 1368], ['明', 1368, 1644], ['清', 1644, 1912]];
const WORLD = [[-776, '第一届古代奥运会'], [-509, '罗马共和国建立'], [-221, '（秦统一六国）'], [476, '西罗马帝国灭亡'], [1215, '英国《大宪章》'], [1492, '哥伦布到达美洲'], [1689, '英国《权利法案》'], [1776, '美国《独立宣言》'], [1789, '法国大革命'], [1868, '日本明治维新']];
const yr = (y) => (y < 0 ? `公元前 ${-Math.round(y)} 年` : `公元 ${Math.round(y)} 年`);
const timeline = {
  id: 'his-timeline', subject: 'his', title: '中国古代朝代时间尺', en: 'A timeline of dynasties',
  lede: ['背朝代歌很容易，可是每个朝代到底有多长？把四千年按真实比例摊开在一把尺子上，每个朝代是一块长短不一的积木。', '你会发现，统一六国的秦只是一条细缝，而“三国两晋南北朝”的分裂比整个唐朝还长。时间的长短，本身就是历史。'],
  formula: '公元纪年：没有公元 0 年', formulaNote: '跨公元前后计算间隔：年数相加再减 1（如前 202 年到 220 年共 421 年）',
  terms: [['公元前', '以公元元年为界向前倒数。'], ['世纪', '每一百年；公元 618 年属于 7 世纪。'], ['国祚', '一个王朝存续的时间。']],
  predict: { q: '秦朝从统一六国到灭亡，一共存在了多少年？', options: ['约 15 年', '约 150 年', '约 400 年'], answer: 0, why: '公元前 221 年统一，公元前 207 年灭亡，只有 15 年左右。它在尺子上细得几乎看不见，但郡县制、统一文字和度量衡，影响了此后两千多年。' },
  challenge: '找出尺子上最长的三块积木。再找找：哥伦布到达美洲时，中国是哪个朝代？',
  fig: '按年数比例排列的朝代（前 2070 年—1912 年）', hint: '拖动年份，看指针落在哪一块上。',
  teach: {
    where: '统编版历史 中外历史纲要（上）· 中国古代史各单元的时序梳理；课标“时空观念”核心素养。',
    ask: ['汉、唐、明、清四个朝代各约多少年？它们之间隔着哪些分裂时期？', '公元前 221 年到公元 1912 年，帝制一共延续了多少年？计算时要注意什么？'],
    simplify: '夏、商、西周早期的年代采用“夏商周断代工程”的参考数值；并立政权（辽、西夏、金等）与新莽、武周未单列，朝代交替处有重叠的按前后衔接处理。世界大事只选了少数几件作参照。',
  },
  controls: [
    { id: 'y', label: '年份', min: -2070, max: 1912, step: 1, value: 618, fmt: yr },
    { id: 'a0', type: 'button', label: '秦统一' }, { id: 'a1', type: 'button', label: '唐建立' }, { id: 'a2', type: 'button', label: '郑和下西洋' }, { id: 'a3', type: 'button', label: '辛亥革命' },
  ],
  build(k) {
    const p = k.p, Z = -1.4, X = (y) => -4.6 + (y + 2100) / 4050 * 9.2;
    k.root.add(at(box(9.5, 0.12, 1.5, C.shade), 0, 0, Z));
    DYN.forEach(([nm, a], i) => {
      const b = i + 1 < DYN.length ? DYN[i + 1][1] : DYN[i][2], w = Math.max(0.03, X(b) - X(a) - 0.02), h = 0.5 + (i % 2) * 0.35;
      k.root.add(at(box(w, h, 1.2, ['#ffe6ad', '#cfe6ff', '#d6f0dc', '#e3dbff', '#ffd9c7'][i % 5]), (X(a) + X(b)) / 2, 0.12, Z));
      const short = w < 0.5, up = short ? (nm === '五代十国' ? 1.75 : 1.2) : nm.length > 4 ? 0.7 : 0.55, lab = note(nm.length > 4 ? '魏晋\n南北朝' : nm, { size: 0.26, bold: !short });
      k.root.add(at(lab, (X(a) + X(b)) / 2, 0.12 + h + up, Z));
      if (short) k.root.add(wire([(X(a) + X(b)) / 2, 0.12 + h, Z], [(X(a) + X(b)) / 2, 0.12 + h + up - 0.22, Z], 0.012));
    });
    [-2000, -1000, 0, 1000].forEach((y) => k.root.add(wire([X(y === 0 ? 1 : y), 0.03, Z + 0.8], [X(y === 0 ? 1 : y), 0.03, Z + 1.2]), at(note(y === 0 ? '公元元年' : y < 0 ? `前${-y}` : `${y}`, { size: 0.26, lay: 'flat' }), X(y), 0.03, Z + 1.5)));
    WORLD.forEach(([y]) => k.root.add(at(flat(new THREE.SphereGeometry(0.07, 10, 8), C.copper), X(y), 0.1, Z + 2.2)));
    k.root.add(at(note('世界', { size: 0.26, lay: 'flat', color: C.copper }), -4.3, 0.03, Z + 2.6));
    const pin = group(rod([0, 0, 0], [0, 2.6, 0], 0.03, C.red), at(glow(C.red, 1.4, 0.5), 0, 2.6, 0), at(flat(new THREE.SphereGeometry(0.12, 14, 10), C.red), 0, 2.6, 0));
    const info = at(card('\n\n', { w: 5.2, size: 0.3, align: 'left' }), 0.8, 0, 3.1);
    k.root.add(pin, info);
    const st = {};
    return {
      press(id) { k.set('y', [-221, 618, 1405, 1911][+id[1]]); },
      update() {
        pin.position.set(X(p.y), 0, Z + 0.7);
        let d = DYN[0]; DYN.forEach((q) => { if (p.y >= q[1]) d = q; });
        const len = d[2] - d[1] - (d[1] < 0 && d[2] > 0 ? 1 : 0);
        let w = null; WORLD.forEach((q) => { if (q[0] <= p.y) w = q; });
        Object.assign(st, { d, len, w });
        info.set(`${yr(p.y)}　${d[0]}\n${d[0]}：${yr(d[1]).replace(' 年', '')}—${yr(d[2]).replace('公元 ', '').replace('公元前 ', '前 ')}，约 ${len} 年\n世界：${w ? `${w[1]}（${w[0] < 0 ? '前' : ''}${Math.abs(w[0])}）` : '两河、埃及文明'}`);
      },
      margin: () => [yr(p.y), `${p.y < 0 ? `公元前 ${Math.ceil(-p.y / 100)}` : `公元 ${Math.floor((p.y - 1) / 100) + 1}`} 世纪`, `距今约 ${new Date().getFullYear() - p.y - (p.y < 0 ? 1 : 0)} 年`, `所在：${st.d?.[0]}`, `存续约 ${st.len} 年`, '铜色点 = 世界大事'],
    };
  },
};

// ================================================================ 思想政治
const market = {
  id: 'pol-market', subject: 'pol', title: '供求与价格', en: 'Supply, demand and price',
  lede: ['价格太高，买的人少、卖的人多，货堆在摊上；价格太低，人人想买，却没那么多货。两股力量拉扯，把价格推向一个买卖双方都接受的水平。', '市场就是这样通过价格的涨落，告诉人们该多生产什么、少生产什么。但它不是万能的。'],
  formula: '供不应求 → 价格上涨；供过于求 → 价格下跌', formulaNote: '需求曲线向右下倾斜，供给曲线向右上倾斜，交点为均衡价格',
  terms: [['均衡价格', '需求量与供给量相等时的价格。'], ['市场调节', '通过价格、供求、竞争配置资源。'], ['宏观调控', '政府对经济运行的调节，弥补市场失灵。']],
  predict: { q: '某种水果大丰收，其他条件不变，它的价格会怎样？', options: ['上涨', '下跌', '不变'], answer: 1, why: '丰收使供给增加，供给曲线向右移动。在原来的价格下供过于求，卖不掉的压力让价格下跌，直到买的人多起来，重新达到平衡。“谷贱伤农”说的就是这种情况。' },
  challenge: '设一个低于均衡价格的最高限价。摊上会出现什么现象？谁受益，谁受损？',
  fig: '市场摊位（箱子 = 供给量，小人 = 需求量）与供求曲线', hint: '移动需求和供给；再试试限价。',
  teach: {
    where: '统编版思想政治 必修 2《经济与社会》· 我国的社会主义市场经济体制：使市场在资源配置中起决定性作用、更好发挥政府作用。',
    ask: ['需求增加和供给减少都会使价格上涨，它们对成交量的影响一样吗？', '市场调节有自发性、盲目性、滞后性。“去年价高，今年大家都种”会带来什么后果？'],
    simplify: '供求曲线取直线，单位为示意；只讨论单一商品的局部均衡，不涉及替代品、预期和调整过程中的时间滞后。',
  },
  controls: [
    { id: 'd', label: '需求变化', min: -30, max: 30, step: 1, value: 0 },
    { id: 's', label: '供给变化', min: -30, max: 30, step: 1, value: 0 },
    { id: 'pol', type: 'choice', label: '政府', options: ['不干预', '最高限价 4 元', '最低限价 7 元'], value: 0, wide: true },
  ],
  build(k) {
    const p = k.p, Z = -0.4;
    const g = at(plot({ w: 4.3, h: 3.4, xr: [0, 100], yr: [0, 10], xl: '数量', yl: '价格 / 元' }), 2.3, 0, -2.5);
    k.root.add(g, at(box(4.2, 0.9, 1.4, C.wood), -2.3, 0, Z - 1.2), at(box(4.6, 0.1, 1.8, C.shade), -2.3, 2.5, Z - 1.2), rod([-4.4, 0, Z - 0.4], [-4.4, 2.5, Z - 0.4], 0.06), rod([-0.2, 0, Z - 0.4], [-0.2, 2.5, Z - 0.4], 0.06), rod([-4.4, 0, Z - 2], [-4.4, 2.5, Z - 2], 0.06), rod([-0.2, 0, Z - 2], [-0.2, 2.5, Z - 2], 0.06));
    const crates = Array.from({ length: 10 }, (_, i) => at(box(0.7, 0.5, 0.6, '#ffd9a8'), -3.9 + (i % 5) * 0.8, 0.9 + Math.floor(i / 5) * 0.5, Z - 1.2));
    const people = Array.from({ length: 10 }, (_, i) => at(group(cone(0.24, 0.75, '#cfe6ff'), at(ball(0.17, '#ffe7cf'), 0, 0.9, 0)), -4.0 + (i % 5) * 0.85, 0, Z + 0.7 + Math.floor(i / 5) * 0.85));
    const tagC = at(card('5.45 元', { size: 0.4, bold: true, w: 2 }), -2.3, 0.9, Z - 0.45);
    const info = at(card('\n\n', { w: 4.2, size: 0.3, align: 'left' }), 2.4, 0, 2.9);
    k.root.add(...crates, ...people, tagC, info);
    let last = ''; const st = {};
    return {
      update() {
        const key = `${p.d}|${p.s}|${p.pol}`; if (key === last) return; last = key;
        const qd = (P) => 100 + p.d - 10 * P, qs = (P) => 12 * P - 20 + p.s, pe = (120 + p.d - p.s) / 22, qe = qd(pe);
        let P = pe; if (p.pol === 1 && pe > 4) P = 4; if (p.pol === 2 && pe < 7) P = 7;
        const D = Math.max(0, qd(P)), S = Math.max(0, qs(P)), Q = Math.min(D, S);
        g.clear().fn((q) => (100 + p.d - q) / 10, C.blue, 0.045).fn((q) => (q + 20 - p.s) / 12, C.flame, 0.045).text(8, 9.3, '需求', '#3b6fe0').text(78, 9.3, '供给', '#d1552e');
        if (P !== pe) g.curve([[0, P], [100, P]], C.ink, 0.03, true);
        g.dot(qe, pe, C.amber, 0.09).done();
        crates.forEach((c, i) => { c.visible = i < Math.round(S / 10); }); people.forEach((c, i) => { c.visible = i < Math.round(D / 10); });
        tagC.set(`${P.toFixed(2)} 元`);
        Object.assign(st, { pe, qe, P, D, S, Q });
        info.set(`价格 ${P.toFixed(2)} 元　成交 ${Q.toFixed(0)}\n想买 ${D.toFixed(0)}　想卖 ${S.toFixed(0)}\n${Math.abs(D - S) < 1 ? '供求平衡' : D > S ? `短缺 ${(D - S).toFixed(0)}：有人买不到` : `过剩 ${(S - D).toFixed(0)}：有货卖不掉`}`);
      },
      margin: () => [`均衡价格 ${st.pe?.toFixed(2)} 元`, `均衡数量 ${st.qe?.toFixed(0)}`, p.d > 0 ? '需求增加：曲线右移' : p.d < 0 ? '需求减少：曲线左移' : '需求不变', p.s > 0 ? '供给增加：曲线右移' : p.s < 0 ? '供给减少：曲线左移' : '供给不变', p.pol ? (st.P !== st.pe ? '限价起了作用' : '限价没有约束力') : '价格自由浮动'],
    };
  },
};

const lorenz = {
  id: 'pol-lorenz', subject: 'pol', title: '收入分配与基尼系数', en: 'Income distribution and the Gini coefficient',
  lede: ['把所有家庭按收入从低到高排队，平均分成五组，看每组拿走了全部收入的百分之几。五摞硬币一样高，是绝对平均；最后一摞高耸入云，就是差距悬殊。', '初次分配由市场决定，再分配通过税收、社会保障和转移支付来调节。动一动，看差距怎么变。'],
  formula: '基尼系数 = A / (A + B)', formulaNote: 'A：对角线与洛伦兹曲线之间的面积；0 表示绝对平均，1 表示绝对不平均',
  terms: [['初次分配', '按劳动、资本等要素的贡献取得收入。'], ['再分配', '通过税收、社保、转移支付调节收入。'], ['洛伦兹曲线', '累计人口比例对应的累计收入比例。']],
  predict: { q: '基尼系数越接近 0，说明收入分配怎样？', options: ['越平均', '差距越大', '收入水平越高'], answer: 0, why: '基尼系数衡量的是“分得均不均”，不是“分得多不多”。洛伦兹曲线越贴近对角线，面积 A 越小，系数越接近 0，分配越平均。国际上通常把 0.4 看作差距较大的警戒线。' },
  challenge: '把初次分配差距调到最大，需要多大的再分配力度，才能把基尼系数压到 0.4 以下？',
  fig: '五等份收入组（硬币摞）与洛伦兹曲线', hint: '先拉大差距，再加大再分配力度。',
  teach: {
    where: '统编版思想政治 必修 2《经济与社会》· 我国的个人收入分配与社会保障：完善个人收入分配、再分配更加注重公平。',
    ask: ['再分配让最高收入组的份额下降了，这会不会影响“效率”？怎样兼顾效率与公平？', '除了税收和转移支付，“第三次分配”指的是什么？'],
    simplify: '五组收入份额由一个幂函数生成，再分配按“各组份额向平均值靠拢”的线性方式模拟；数据纯属示意，不代表任何国家或年份的真实统计，五组数据算出的基尼系数也会略低于按个体计算的值。',
  },
  controls: [
    { id: 'g', label: '初次分配差距', min: 0, max: 1, step: 0.02, value: 0.6 },
    { id: 't', label: '再分配力度', min: 0, max: 0.6, step: 0.02, value: 0.1 },
  ],
  build(k) {
    const p = k.p, Z = -0.6, X0 = -4.0, DX = 1.05;
    k.root.add(at(box(5.6, 0.14, 1.5, C.shade), X0 + 2 * DX, 0, Z));
    const stacks = Array.from({ length: 5 }, (_, i) => ({ c: at(cyl(0.42, 1, '#ffd76a'), X0 + i * DX, 0.14, Z), ghost: at(glass(new THREE.CylinderGeometry(0.44, 0.44, 1, 28, 1, true).translate(0, 0.5, 0)), X0 + i * DX, 0.14, Z), n: at(note('20%', { size: 0.3, w: 1.1, bold: true }), X0 + i * DX, 1, Z) }));
    ['最低 20%', '较低', '中间', '较高', '最高 20%'].forEach((s, i) => k.root.add(at(note(s, { size: 0.25, lay: 'flat' }), X0 + i * DX, 0.03, Z + 1.15)));
    const g = at(plot({ w: 4.2, h: 3.5, xr: [0, 100], yr: [0, 100], xl: '人口累计 %', yl: '收入累计 %' }), 2.4, 0, -2.6);
    const info = at(card('\n\n', { w: 4.3, size: 0.3, align: 'left' }), 2.4, 0, 2.9);
    k.root.add(...stacks.flatMap((s) => [s.c, s.ghost, s.n]), g, info);
    const gini = (sh) => { let L = 0, a = 0; sh.forEach((s) => { a += (L + L + s) * 0.2; L += s; }); return 1 - a; };
    const lz = (sh) => { let L = 0; return [[0, 0], ...sh.map((s, i) => [(i + 1) * 20, (L += s) * 100])]; };
    let last = ''; const st = {};
    return {
      update() {
        const key = `${p.g}|${p.t}`; if (key === last) return; last = key;
        const raw = [0, 1, 2, 3, 4].map((i) => Math.pow((i + 0.5) / 5, p.g * 3.2)), sum = raw.reduce((a, b) => a + b, 0), pre = raw.map((v) => v / sum), post = pre.map((v) => v * (1 - p.t) + 0.2 * p.t);
        stacks.forEach((s, i) => { s.c.scale.y = Math.max(0.02, post[i] * 7); s.ghost.scale.y = Math.max(0.02, pre[i] * 7); s.ghost.visible = p.t > 0; s.n.position.y = 0.14 + Math.max(post[i], p.t > 0 ? pre[i] : 0) * 7 + 0.4; s.n.set(`${(post[i] * 100).toFixed(0)}%`); });
        g.clear().curve([[0, 0], [100, 100]], 'rgba(30,43,54,.45)', 0.025, true).curve(lz(pre), '#b9b4a6', 0.035).curve(lz(post), C.flame, 0.05).text(8, 90, '对角线 = 绝对平均').done();
        Object.assign(st, { g0: gini(pre), g1: gini(post), ratio: post[4] / post[0] });
        info.set(`基尼系数 ${st.g1.toFixed(2)}${st.g1 >= 0.4 ? '（差距较大）' : ''}\n再分配前 ${st.g0.toFixed(2)}\n最高组是最低组的 ${st.ratio.toFixed(1)} 倍`);
      },
      margin: () => [`初次分配后 ${st.g0?.toFixed(2)}`, `再分配后 ${st.g1?.toFixed(2)}`, `下降了 ${((st.g0 - st.g1) || 0).toFixed(2)}`, '玻璃筒 = 再分配前', '黄色 = 再分配后', '高收入组：缴税多', '低收入组：得到转移'],
    };
  },
};

export default [meter, syllogism, tense, sentence, printing, timeline, market, lorenz];
