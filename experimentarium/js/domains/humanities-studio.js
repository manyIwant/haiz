// HAIZ · EXPERIMENTARIUM — 历史、语文、英语与思想政治探究包（8 项完整 L3/L4 实验）
import {
  C, TAU, clamp, lerp, group, at, rot, box, cyl, ball, cone, rod, wire, strip,
  flat, glass, sheet, note, card, plot, freshGroup, THREE,
} from '../core/ink.js';
import {
  solveMovableTypeEconomics,
  checkSyllogismValidity,
  solveMarketEquilibrium,
  solveLorenzGini,
} from '../core/science-models.js';

// ================================================================
// 1. 语文 · L3 近体诗的平仄、入声字与粘对检测 (chn-meter)
// ================================================================
const METER_POEMS = [
  {
    name: '登鹳雀楼', by: '王之涣 · 五言绝句', len: 5,
    lines: ['白日依山尽', '黄河入海流', '欲穷千里目', '更上一层楼'],
    old: ['仄仄平平仄', '平平仄仄平', '仄平平仄仄', '仄仄仄平平'],
    mod: ['平仄平平仄', '平平仄仄平', '仄平平仄仄', '仄仄平平平'],
    ru: '白日入欲目一',
  },
  {
    name: '绝句', by: '杜甫 · 五言绝句', len: 5,
    lines: ['迟日江山丽', '春风花草香', '泥融飞燕子', '沙暖睡鸳鸯'],
    old: ['平仄平平仄', '平平平仄平', '平平平仄仄', '平仄仄平平'],
    mod: ['平仄平平仄', '平平平仄平', '平平平仄仄', '平仄仄平平'],
    ru: '日',
  },
  {
    name: '静夜思', by: '李白 · 五言古绝', len: 5,
    lines: ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'],
    old: ['平平平仄平', '平仄仄仄平', '仄平仄平仄', '平平平仄平'],
    mod: ['平平平仄平', '平仄仄仄平', '仄平仄平仄', '平平平仄平'],
    ru: '月',
  },
  {
    name: '送元二使安西', by: '王维 · 七言绝句', len: 7,
    lines: ['渭城朝雨浥轻尘', '客舍青青柳色新', '劝君更尽一杯酒', '西出阳关无故人'],
    old: ['仄平平仄仄平平', '仄仄平平仄仄平', '仄平仄仄仄平仄', '平仄平平平仄平'],
    mod: ['仄平平仄仄平平', '仄仄平平仄仄平', '仄平仄仄平平仄', '平平平平平仄平'],
    ru: '浥客色一出',
  },
];

// 内置常用《平水韵》与普通话入声对照表（覆盖诗例及常见古诗用字，未收录字标“待查”）
const PING_SET = new Set(
  '依山黄河海流穷千层楼迟江春风花草香泥融飞燕鸳鸯床前明光疑霜头思故乡城朝轻尘青新君杯西阳关无居秋暝空山雨天气晚来松月照泉石清喧归竹莲动下渔舟随芳歇孙留南东长中天云烟水边声行歌吟看听知深浅轻重红绿蓝黄青山林泉溪云风花雪月春夏天地东西南北人君臣父子心意身名功利诗书礼乐琴棋画酒茶衣裳舟车马剑弓戈刀城关楼台亭阁宫殿门窗帘幕灯烛影梦魂情愁思泪笑语声名高低远近新旧多少长短大小轻重圆方曲直平正斜横斜疏密深浅高低上下左右前后内外中间初终始终平沙落雁飞鸟鸣蝉啼猿啸江海湖泊洲渚波浪潮汐涛涛'.split('')
    .filter((c) => !'尽入海里欲目更上日丽草燕子是地望故渭雨浥舍柳色劝尽酒故人晚照石竹动下渔莲舟芳歇留'.includes(c))
);
const ZE_NON_RU = new Set(
  '尽海里更上丽草燕子是地望故渭雨舍柳劝酒晚照动下在有见去到过走跑跳笑泪梦醒醉问对答唱咏叹怨恨爱怕愁怒喜乐美丑好坏大小老少新旧早晚昼夜春秋冬夏上下左右前后内外远近高低深浅长短厚薄轻重冷暖寒暑晴阴风霜雨露雾电雷云雾岛岸岭峰峦涧谷崖壑寺庙殿阁塔院桥路巷市井村野宅邸庭院树叶花朵草木枝干根茎果实种子'.split('')
);
const RU_CHARS = new Set(
  '白日入欲目一月竹雪国色出客石叶十百千八七六木屋玉铁血绝别节接折设说发法达踏杀活角觉学乐落作泊莫各恶阁药约弱若雀略脚爵着昨托拓郭廓博搏薄索诺错直值职织识食力立历积迹夕席习集急及级吸极北黑墨默得德特克刻则测侧物弗拂佛不忽突骨滑屈曲局足促速俗属沐独读毒熟叔淑筑烛逐菊育域欲浴绿录陆哭谷浥昔惜息悉熄膝室实湿失适释室壁碧璧笔必毕闭'.split('')
);
// 普通话里读阴平/阳平（今平）的古入声字
const RU_MOD_PING = new Set(
  '白一竹国出石十八七节接折说发达成杀活觉学博薄伯直职识食集急及极得德弗佛忽突屈局足俗独读毒熟烛逐菊席习绝别黑屋哭昔惜息熄实湿失室壁碧'.split('')
);
// 精确补正平声常用字（防止上表过滤误删）
const PING_EXTRA = '山依黄河流穷千层楼迟江春风花香泥融飞鸳鸯床前明光疑霜头思乡城朝轻尘青新君杯西阳关无看归渔舟孙留南东云烟声行歌吟听知深林溪天人君心名诗书琴棋画茶衣车马弓刀台亭门窗灯影情愁沙鸣啼猿波涛湖洲'.split('');
PING_EXTRA.forEach((c) => PING_SET.add(c));
const ZE_EXTRA = '尽海里更上丽草燕子是地望故渭雨舍柳劝酒尽坐里半万汉未在有见去到望梦醉问唱叹恨爱笑泪路水寺半夜到船远径斜处有爱'.split('');
ZE_EXTRA.forEach((c) => ZE_NON_RU.add(c));

function lookupTone(ch) {
  if (RU_CHARS.has(ch)) {
    return { old: '仄', isRu: true, mod: RU_MOD_PING.has(ch) ? '平' : '仄', known: true };
  }
  if (ZE_NON_RU.has(ch)) return { old: '仄', isRu: false, mod: '仄', known: true };
  if (PING_SET.has(ch)) return { old: '平', isRu: false, mod: '平', known: true };
  return { old: '平', isRu: false, mod: '平', known: false };
}

function analyzeRegulatedLines(lines, pats) {
  const n = lines[0]?.length || 5;
  const keyIdx = n === 7 ? [1, 3, 5] : [1, 3];
  const opp = (a, b) => keyIdx.every((i) => a[i] !== b[i]);
  const same = (a, b) => keyIdx.every((i) => a[i] === b[i]);
  const tiOk = pats.map((s) => (n === 7 ? s[1] !== s[3] && s[3] !== s[5] : s[1] !== s[3]));
  const triLines = pats.map((s) => s.endsWith('平平平'));
  const guPingLines = pats.map((s) => {
    if (!s.endsWith('仄平')) return false;
    const body = s.slice(0, -1);
    const pCount = [...body].filter((c) => c === '平').length;
    return pCount <= 1;
  });
  const dui = [];
  for (let i = 0; i + 1 < pats.length; i += 2) dui.push(opp(pats[i], pats[i + 1]));
  const nian = [];
  for (let i = 1; i + 1 < pats.length; i += 2) nian.push(same(pats[i], pats[i + 1]));
  return { n, tiOk, triLines, guPingLines, dui, nian };
}

const COUPLET_PRESETS = [
  { name: '标准五律一联', lines: ['明月松间照', '清泉石上流'] },
  { name: '犯孤平示例', lines: ['客中看雪归', '江上听风眠'] },
  { name: '三平尾示例', lines: ['白日依山尽', '更上一层楼'] },
  { name: '标准七言联', lines: ['渭城朝雨浥轻尘', '客舍青青柳色新'] },
  { name: '失对失粘四句', lines: ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡'] },
];

export const meter = {
  id: 'chn-meter',
  subject: 'chn',
  title: '近体诗的平仄、入声字与粘对检测',
  en: 'Tonal prosody and regulated verse analyzer',
  lede: [
    '近体诗把字音归为“平”（阴平、阳平）与“仄”（上、去、入）两类，讲求本句替、联内对、邻联粘，并严忌“孤平”与“三平尾”。',
    '古入声字在普通话中已分别派入平上去三声。切换“古音（平水韵）”与“普通话”，观察《登鹳雀楼》《送元二使安西》如何因“白、一、出”等入声字改读而破坏格律！',
  ],
  formula: '一三五不论，二四六分明（孤平与三平尾除外）',
  formulaNote: '五言看第 2、4 字，七言看第 2、4、6 字：本句交替（替），同联相反（对），邻联相同（粘）',
  terms: [
    ['入声字', '中古汉语带塞音韵尾（-p/-t/-k）的短促仄声字（如白/日/出/一/竹/雪/国）；普通话已消失，部分归入一二声'],
    ['孤平', '平声韵脚句中除韵字外只剩一个孤零零的平声字（如五言“仄平仄仄平”、七言“仄仄仄平仄仄平”），须第三/五字拗救'],
    ['粘与对', '同一联上下句二四六字平仄相反为“对”；下一联首句与上一联尾句二四六字相同为“粘”'],
  ],
  predict: {
    q: '“西出阳关无故人”里的“出”字在现代普通话读第一声（阴平），按唐诗《平水韵》格律它算平声还是仄声？',
    options: ['算平声，与普通话第一声一致', '算仄声，它是中古入声字（质韵）', '平仄两可，诗人随意决定'],
    answer: 1,
    why: '“出”在中古属入声质韵，是标准的仄声，正好使“西出阳关无故人”第 2、4、6 字构成“仄—平—仄”，与上句“劝君更尽一杯酒”（平—仄—平）严密相对；按普通话读“出”作平，反而变成“尾联失对”与五平连字！',
  },
  challenge: '对比四首诗找出不守近体律的一首“古绝”；再在实验台输入或选择“犯孤平示例”，亲手把首字或第三字改调救平！',
  fig: '五言/七言绝句立体平仄砖阵（矮砖=平，高砖=仄，红点=古入声字）',
  hint: '切换四首唐诗并对比古音与普通话；打开实验台自由输入联句或点击单字砖块排查孤平、失替、失对与失粘。',
  teach: {
    where: '统编版高中语文 · 古诗词诵读与“古诗词单元”格律常识（《登鹳雀楼》《绝句》《静夜思》《送元二使安西》）',
    ask: [
      '为什么说“一三五不论”在五言“平平仄仄平”的第一字上行不通？',
      '李白《静夜思》多处失对失粘却千古传诵，说明格律规则与诗歌艺术表现之间是什么关系？',
    ],
    simplify: '依王力《汉语诗律学》通行《平水韵》规则，内置常用诗韵字表（未收录多音或生僻字在工作台诚实标注“待查”并支持手动点选调类）。',
  },
  controls: [
    { id: 'poem', type: 'choice', label: '诗作', options: METER_POEMS.map((q) => `《${q.name}》`), value: 0, wide: true },
    { id: 'mode', type: 'choice', label: '读音体系', options: ['古音（平水韵）', '现代普通话'], value: 0, wide: true },
  ],
  inquiry: {
    note: '依据《平水韵》与现代普通话读音对照记录，梳理入声字演变与近体诗格律约束：',
    steps: [
      { key: 'evidence', label: '入声字取证', prompt: '记录你在《登鹳雀楼》或《送元二使安西》中检出的古入声字及其普通话调类变化：', hints: ['“白、一、出”在平水韵中属入声仄，普通话转为阴/阳平', '“日、入、欲、目、浥、客、色”在普通话仍读去声（仄）'] },
      { key: 'analysis', label: '失替·失对·失粘·孤平诊断', prompt: '对照工作台联句测试，说明《静夜思》和“犯孤平示例”分别违反了哪条格律：', hints: ['《静夜思》二三句二四字分别为“仄仄”与“平平”属失粘，三四句属失对', '五言“仄平仄仄平”除韵脚外仅一平声，犯孤平'] },
      { key: 'reflection', label: '规律与创造性反思', prompt: '结合唐代声律实践，讨论为何唐人既严格遵守粘对，又存在“拗救”与不拘格律的古风：', hints: ['声律服务于吟诵节奏感与对仗平衡', '古体诗（如古绝）不受近体律限制，以自然气象取胜'] },
    ],
  },

  build(k) {
    const p = k.p;
    const holder = new THREE.Group();
    const info = at(card('\n\n', { w: 4.8, size: 0.27, align: 'left' }), 2.2, 0, 3.05);
    k.root.add(holder, info);
    let last = '';
    let st = {};

    const draw = () => {
      freshGroup(holder);
      const q = METER_POEMS[p.poem ?? 0];
      const pat = p.mode ? q.mod : q.old;
      const is7 = q.len === 7;
      const DX = is7 ? 0.94 : 1.18;
      const DZ = 1.26;
      const X0 = is7 ? -4.15 : -3.85;
      const Z0 = -3.75;
      const bw = is7 ? 0.82 : 1.0;

      q.lines.forEach((line, r) => {
        [...line].forEach((ch, c) => {
          const ze = pat[r][c] === '仄';
          const flipped = p.mode === 1 && q.old[r][c] !== q.mod[r][c];
          const h = ze ? 0.6 : 0.19;
          const x = X0 + c * DX;
          const z = Z0 + r * DZ;
          const col = flipped ? '#f9c2b8' : ze ? '#ffe2ad' : C.paper;
          holder.add(
            at(box(bw, h, 0.9, col), x, 0, z),
            at(note(ch, { size: is7 ? 0.48 : 0.56, lay: 'flat', bold: true, color: flipped ? '#a2291c' : C.ink }), x, h + 0.02, z),
          );
          if (q.ru.includes(ch)) {
            holder.add(at(flat(new THREE.SphereGeometry(0.085, 12, 8), p.mode ? C.copper : C.red), x + bw * 0.36, h + 0.09, z - 0.32));
          }
        });
        holder.add(at(note(pat[r], { size: is7 ? 0.24 : 0.28, lay: 'flat', w: 2.3 }), X0 + q.len * DX + 0.82, 0.03, Z0 + r * DZ));
      });

      const diag = analyzeRegulatedLines(q.lines, pat);
      const checks = [
        [diag.dui[0], '对', 0],
        [diag.nian[0], '粘', 1],
        [diag.dui[1], '对', 2],
      ];
      checks.forEach(([ok, w, r]) => {
        holder.add(at(
          note(`${w}：${ok ? '合' : `失${w}`}`, { size: 0.28, lay: 'flat', color: ok ? '#1f7a4d' : '#b7442f' }),
          X0 + q.len * DX + 0.82, 0.03, Z0 + (r + 0.5) * DZ,
        ));
      });

      const errs = [];
      if (!diag.dui[0]) errs.push('首联失对');
      if (!diag.nian[0]) errs.push('失粘');
      if (!diag.dui[1]) errs.push('尾联失对');
      if (diag.tiOk.some((v) => !v)) errs.push('本句失替');
      if (diag.triLines.some(Boolean)) errs.push('三平尾');
      if (diag.guPingLines.some(Boolean)) errs.push('犯孤平');
      const ok = errs.length === 0;
      st = { ok, errs, q, diag };
      info.set(`《${q.name}》${q.by}\n${ok ? '合律：标准近体格律' : `格律警报：${errs.join('、')}`}\n${p.mode ? '普通话模式下红色砖块为入声改读字' : `古入声字：${q.ru.split('').join(' ')}`}`);
    };

    return {
      update() {
        const key = `${p.poem}|${p.mode}`;
        if (key !== last) { last = key; draw(); }
      },
      margin() {
        const q = st.q || METER_POEMS[0];
        return [
          p.mode ? '现代普通话（四声）' : '中古平水韵（含入声）',
          `${q.len} 言绝句 · 红点=入声字`,
          `入声字：${q.ru.split('').join(' ')}`,
          st.ok ? '替·对·粘·无孤平俱合' : `违律：${st.errs?.join(' / ')}`,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 诗律与入声字交互诊断台（支持五/七言联句输入与单字点选校音）');
    const row = document.createElement('div');
    row.className = 'wb-btn-row';
    row.innerHTML = COUPLET_PRESETS.map((pr, i) => `<button type="button" class="wb-btn" data-pr="${i}">${pr.name}</button>`).join('')
      + `<button type="button" class="wb-btn primary" data-sync="1">按普通话/平水韵重算</button>`;
    sec1.append(row);

    const ta = document.createElement('textarea');
    ta.className = 'wb-input';
    ta.rows = 3;
    ta.style.cssText = 'width:100%;font-size:15px;line-height:1.6;font-family:"Songti SC",serif;';
    ta.value = COUPLET_PRESETS[0].lines.join('\n');
    sec1.append(ta);

    const tilesBox = document.createElement('div');
    tilesBox.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:10px;';
    const diagBox = document.createElement('div');
    diagBox.className = 'wb-metrics';
    const noteEl = document.createElement('p');
    noteEl.className = 'wb-muted';
    sec1.append(tilesBox, diagBox, noteEl);

    const manualOverrides = new Map(); // "r:c" -> '平' | '仄'

    const parseLines = () => ta.value
      .split(/[\n\r，。；、？！\s]+/)
      .map((s) => s.replace(/[^\u4e00-\u9fff]/g, ''))
      .filter(Boolean)
      .slice(0, 4);

    const refresh = () => {
      const lines = parseLines();
      const useMod = sp.params.mode === 1;
      tilesBox.innerHTML = '';
      const pats = [];
      const ruList = [];
      const unknownList = [];

      lines.forEach((line, r) => {
        const lineRow = document.createElement('div');
        lineRow.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;';
        let pat = '';
        [...line].forEach((ch, c) => {
          const info = lookupTone(ch);
          const ovKey = `${r}:${c}`;
          const tone = manualOverrides.get(ovKey) ?? (useMod ? info.mod : info.old);
          pat += tone;
          if (info.isRu) ruList.push(`${ch}(${info.mod === '平' ? '今转平' : '今仍仄'})`);
          if (!info.known && !manualOverrides.has(ovKey)) unknownList.push(ch);

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'wb-btn';
          btn.style.cssText = `padding:5px 9px;border-radius:6px;font-family:"Songti SC",serif;font-size:15px;background:${tone === '平' ? '#fcf9f1' : '#ffe2ad'};border-color:${info.isRu ? '#c2453a' : '#1e2b36'};`;
          btn.title = `点击切换平/仄 · ${info.known ? (info.isRu ? '中古入声字' : '平水韵常用字') : '未收录字，默认按平，可点击手动校准'}`;
          btn.innerHTML = `<strong>${ch}</strong> <small style="font-size:11px;opacity:.8">${tone}${info.isRu ? '·入' : !info.known ? '·待查' : ''}</small>`;
          btn.addEventListener('click', () => {
            manualOverrides.set(ovKey, tone === '平' ? '仄' : '平');
            refresh();
          });
          lineRow.append(btn);
        });
        pats.push(pat);
        const tag = document.createElement('span');
        tag.style.cssText = 'font-size:12px;color:#51606b;margin-left:6px;font-family:monospace;';
        tag.textContent = pat;
        lineRow.append(tag);
        tilesBox.append(lineRow);
      });

      const validLen = lines.length >= 2 && lines.every((l) => l.length === 5 || l.length === 7) && new Set(lines.map((l) => l.length)).size === 1;
      if (!validLen) {
        diagBox.innerHTML = `<div class="wb-m"><span>输入提示</span><b>请输入 2 句或 4 句等长五言/七言诗句（每句 5 字或 7 字）</b></div>`;
        noteEl.textContent = '可点击上方预设快速填入，或直接编辑文本框后点击任一汉字砖块手动修正多音字/生僻字平仄。';
        return;
      }

      const d = analyzeRegulatedLines(lines, pats);
      const tiErrs = d.tiOk.map((ok, i) => (ok ? null : `第${i + 1}句`)).filter(Boolean);
      const duiErrs = d.dui.map((ok, i) => (ok ? null : `第${i + 1}联`)).filter(Boolean);
      const nianErrs = d.nian.map((ok, i) => (ok ? null : `第${i * 2 + 2}-${i * 2 + 3}句`)).filter(Boolean);
      const guErrs = d.guPingLines.map((bad, i) => (bad ? `第${i + 1}句` : null)).filter(Boolean);
      const triErrs = d.triLines.map((bad, i) => (bad ? `第${i + 1}句` : null)).filter(Boolean);

      diagBox.innerHTML = [
        ['读音标准', useMod ? '现代普通话（四声）' : '中古《平水韵》（含入声）'],
        ['本句交替（失替）', tiErrs.length ? `⚠ ${tiErrs.join('、')}失替` : '✓ 句内二四(六)交替合律'],
        ['联内对仗平仄（失对）', duiErrs.length ? `⚠ ${duiErrs.join('、')}失对` : '✓ 联内相对合律'],
        ['邻联相粘（失粘）', d.nian.length ? (nianErrs.length ? `⚠ ${nianErrs.join('、')}失粘` : '✓ 邻联相粘合律') : '（四句全诗时检验）'],
        ['孤平 / 三平尾忌讳', [...guErrs.map((x) => `${x}犯孤平`), ...triErrs.map((x) => `${x}三平尾`)].join('；') || '✓ 无孤平、无三平尾'],
        ['检出古入声字', ruList.length ? [...new Set(ruList)].join('、') : '未检出常见入声字'],
      ].map(([k, v]) => `<div class="wb-m"><span>${k}</span><b>${v}</b></div>`).join('');

      noteEl.textContent = unknownList.length
        ? `注：字表未收录字符 [${[...new Set(unknownList)].join('、')}] 暂按“平”标示（待查），请点击对应汉字砖块校对或查阅权威《平水韵》辞书。`
        : '提示：点选任一单字砖块可切换其平/仄（例如检验首字或第三字“拗救”能否消除孤平）。';
    };

    row.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.pr !== undefined) {
        manualOverrides.clear();
        ta.value = COUPLET_PRESETS[+btn.dataset.pr].lines.join('\n');
      } else if (btn.dataset.sync) {
        wb.setParam('mode', sp.params.mode === 1 ? 0 : 1);
      }
      refresh();
    });
    ta.addEventListener('input', () => { manualOverrides.clear(); refresh(); });

    let lastKey = '';
    refresh();
    return {
      update() {
        const key = `${sp.params.poem}|${sp.params.mode}`;
        if (key !== lastKey) { lastKey = key; refresh(); }
      },
    };
  },
};

// ================================================================
// 2. 语文 · L3 三段论、周延性与欧拉反例构造台 (chn-syllogism)
// ================================================================
const PROP_LABEL = {
  A: 'A 全称肯定（所有 X 都是 Y）',
  E: 'E 全称否定（所有 X 都不是 Y）',
  I: 'I 特称肯定（有些 X 是 Y）',
  O: 'O 特称否定（有些 X 不是 Y）',
};
const PROP_SHORT = ['A', 'E', 'I', 'O'];

function formatPropText(type, subj, pred) {
  if (type === 'A') return `所有${subj}都是${pred}`;
  if (type === 'E') return `所有${subj}都不是${pred}`;
  if (type === 'I') return `有些${subj}是${pred}`;
  return `有些${subj}不是${pred}`;
}

function figureTerms(fig) {
  if (fig === 1) return { maj: ['M', 'P'], min: ['S', 'M'] };
  if (fig === 2) return { maj: ['P', 'M'], min: ['S', 'M'] };
  if (fig === 3) return { maj: ['M', 'P'], min: ['M', 'S'] };
  return { maj: ['P', 'M'], min: ['M', 'S'] };
}

function getConcreteCounterexample(errors, fig) {
  const errStr = errors.join('；');
  if (errStr.includes('中项不周延')) {
    return {
      S: '鳄鱼', M: '会下蛋的动物', P: '鸟',
      why: '“会下蛋的动物”在两前提中均作肯定命题谓项或特称主项而未周延，S 与 P 可各自占据 M 的互不相交部分！',
      euler: { M: [0, 0, 2.45], P: [-1.05, 0, 0.95], S: [1.1, 0, 0.72] },
    };
  }
  if (errStr.includes('大项不当周延')) {
    return {
      S: '老师', M: '学生', P: '要学习的人',
      why: '大项“要学习的人”在大前提“所有学生都要学习”中未周延，在否定结论“老师不是要学习的人”中却变得周延，S 可完全落入 P 内（M 外）！',
      euler: { P: [0, 0, 2.4], M: [-1.05, 0, 0.85], S: [1.0, 0, 0.75] },
    };
  }
  if (errStr.includes('小项不当周延')) {
    return {
      S: '会飞的动物', M: '鸟', P: '长羽毛的动物',
      why: '小项“会飞的动物”在小前提未周延，结论却断定其全部（如把蝙蝠也包进来了）！',
      euler: { S: [-0.2, 0, 2.1], M: [-0.7, 0, 0.85], P: [-0.7, 0, 1.25] },
    };
  }
  if (errStr.includes('两否定前提')) {
    return {
      S: '鲸', M: '鱼', P: '哺乳动物',
      why: '两个否定前提只排除 M 与 S、P 的交集，根本无法约束 S 与 P 是否重合！',
      euler: { M: [-1.7, 0, 1.0], S: [1.2, 0, 0.72], P: [1.2, 0, 1.35] },
    };
  }
  return {
    S: 'S（小项）', M: 'M（中项）', P: 'P（大项）',
    why: errStr || '存在“前提全真而结论为假”的集合分配方案。',
    euler: { M: [0, 0, 2.2], P: [-0.9, 0, 1.0], S: [0.95, 0, 0.75] },
  };
}

function getValidEuler(majorType, minorType, conclType, fig) {
  if (conclType === 'A') return { P: [0, 0, 2.45], M: [0.28, 0, 1.6], S: [0.55, 0, 0.78] };
  if (conclType === 'E') {
    if (fig === 1 || fig === 3) return { M: [-1.35, 0, 1.5], S: [-1.35, 0, 0.72], P: [1.65, 0, 1.25] };
    return { P: [-1.4, 0, 1.35], S: [1.4, 0, 0.72], M: [1.4, 0, 1.45] };
  }
  if (conclType === 'I') return { M: [0, 0, 1.55], S: [0.85, 0, 1.05], P: [-0.45, 0, 1.65] };
  return { P: [-1.0, 0, 1.3], M: [-0.95, 0, 0.72], S: [1.2, 0, 1.25] };
}

export const syllogism = {
  id: 'chn-syllogism',
  subject: 'chn',
  title: '三段论、周延性与欧拉反例构造台',
  en: 'Syllogism validity & Euler counterexamples',
  lede: [
    '亚里士多德三段论共有 4 个格、256 种可能组合（4×4×4×4），其中真正有效的推理形式仅有二十余种。前提为真不保证结论必然为真，一切取决于形式规则是否严密。',
    '在立体欧拉圆盘与实验台自由拼搭 A/E/I/O 与第 1–4 格，利用逻辑内核实时检测“中项不周延”“大项不当周延”，并亲手拖动圆圈造出反例！',
  ],
  formula: '前提全真且无反例 ⇔ 推理形式有效（Valid）',
  formulaNote: 'A(全称肯定：主周谓不)、E(全称否定：主谓全周)、I(特称肯定：主谓全不)、O(特称否定：主不谓周)',
  terms: [
    ['中项（M）', '连接大前提与小前提的桥梁概念；在两前提中至少必须周延一次，否则犯“中项不周延谬误”'],
    ['周延性', '判断中若断定了某概念的全部外延，则称该词项周延（全称主项周延，否定谓项周延）'],
    ['欧拉反例', '满足两前提全部集合约束、却令结论落空的一组圆圈几何排布'],
  ],
  predict: {
    q: '“所有鸟都会下蛋；所有鳄鱼都会下蛋；所以所有鳄鱼都是鸟。”（第2格 AAA）为何无效？',
    options: ['前提中有假命题', '犯了“中项不周延”谬误', '犯了“大项不当周延”谬误'],
    answer: 1,
    why: '第 2 格中项 M（会下蛋的动物）均居肯定命题（A）的谓项位置，两次都未周延！鸟只是其中一部分，鳄鱼只是另一部分，两者可完全不相交。',
  },
  challenge: '先后摆出第 1 格 AAA（有效）、第 2 格 AAA（中项不周延）和第 1 格 AEE（大项不当周延），观察实验台如何瞬间给出反例！',
  fig: 'S / M / P 叠层半透明欧拉外延圆盘',
  hint: '切换格（1–4）与大前提/小前提/结论（A/E/I/O）；展开实验台可拖放三枚欧拉圆圈亲手验证反例。',
  teach: {
    where: '统编版高中语文 选择性必修上册 · 第四单元《逻辑的力量》：发现潜藏的逻辑谬误 / 运用有效的推理形式',
    ask: [
      '把“所有鸟都会下蛋；所有鳄鱼都会下蛋”的结论改为“所以有些鳄鱼是鸟”或“所以鳄鱼不是鸟”，有效吗？',
      '请用第 1 格 AEE（大项不当周延）的结构，造一个日常辩论中常见的“偷换范围”错句。',
    ],
    simplify: '采用传统亚里士多德词项逻辑（预设全称概念外延非空），由 science-models.js#checkSyllogismValidity 进行 256 式严格判定。',
  },
  controls: [
    { id: 'figure', type: 'choice', label: '格 (Figure)', options: ['第1格 M-P/S-M', '第2格 P-M/S-M', '第3格 M-P/M-S', '第4格 P-M/M-S'], value: 0, wide: true },
    { id: 'major', type: 'choice', label: '大前提', options: PROP_SHORT, value: 0 },
    { id: 'minor', type: 'choice', label: '小前提', options: PROP_SHORT, value: 0 },
    { id: 'concl', type: 'choice', label: '结论', options: PROP_SHORT, value: 0 },
    { id: 'pMid', type: 'button', label: 'AAA-2 中项不周延' },
    { id: 'pMaj', type: 'button', label: 'AEE-1 大项不当周延' },
  ],
  inquiry: {
    note: '用三段论形式规则与欧拉图反例构造，检验自然语言论证的严谨性：',
    steps: [
      { key: 'evidence', label: '格与周延性核查', prompt: '写出你测试的某条无效论式（如 AAA-2 或 AEE-1），并列出大、中、小项在三句中的周延状态：', hints: ['A 命题主项周延、谓项不周延', 'E 命题主谓项均周延；I 均不周延；O 仅谓项周延'] },
      { key: 'analysis', label: '欧拉反例构造', prompt: '描述你是如何在欧拉图中摆放 S、M、P 三个圆圈，使两个前提都成立但结论被推翻的：', hints: ['中项不周延时，可把 S 与 P 画在 M 内互不相交的两侧', '大项不当周延（AEE-1）时，可把 S 放进 P 内但完全置于 M 外'] },
      { key: 'reflection', label: '自然语言谬误辨析', prompt: '仿照上述无效论式，自编一个看似合理实则无效的生活推论并指出其逻辑病灶：', hints: ['区分“前提真假”与“推理形式是否有效”'] },
    ],
  },

  build(k) {
    const p = k.p;
    const Z = -1.25;
    const COL = { P: C.violet, M: C.amber, S: C.teal };
    const H = { P: 0.2, M: 0.34, S: 0.48 };
    const disc = {};
    const tag = {};
    for (const n of ['P', 'M', 'S']) {
      disc[n] = group(
        glass(new THREE.CylinderGeometry(1, 1, H[n], 56, 1, true).translate(0, H[n] / 2, 0)),
        at(flat(new THREE.CircleGeometry(1, 56).rotateX(-Math.PI / 2), COL[n], { opacity: 0.22 }), 0, H[n], 0),
      );
      disc[n].userData.t = [0, 0, 1];
      disc[n].position.z = Z;
      tag[n] = note(n, { size: 0.28, w: 3.2, bold: true });
      k.root.add(disc[n], tag[n]);
    }
    const info = at(card('\n\n', { w: 5.8, size: 0.27, align: 'left' }), 0.2, 0, 3.0);
    const verdict = at(note('有效', { size: 0.46, bold: true, w: 3.6 }), 3.0, 3.3, -3.2);
    k.root.add(info, verdict);

    let last = '';
    let st = {};

    const apply = () => {
      const fig = (p.figure ?? 0) + 1;
      const majT = PROP_SHORT[p.major ?? 0];
      const minT = PROP_SHORT[p.minor ?? 0];
      const conT = PROP_SHORT[p.concl ?? 0];
      const res = checkSyllogismValidity(majT, minT, conT, fig);
      const terms = figureTerms(fig);
      let nouns = { S: 'S(小项)', M: 'M(中项)', P: 'P(大项)' };
      let cfg;
      if (res.valid) {
        cfg = getValidEuler(majT, minT, conT, fig);
        if (majT === 'A' && minT === 'A' && conT === 'A' && fig === 1) nouns = { S: '铜(S)', M: '金属(M)', P: '导电体(P)' };
        else if (majT === 'E' && minT === 'A' && conT === 'E' && fig === 1) nouns = { S: '鲸(S)', M: '哺乳动物(M)', P: '冷血动物(P)' };
      } else {
        const ce = getConcreteCounterexample(res.errors, fig);
        nouns = { S: `${ce.S}(S)`, M: `${ce.M}(M)`, P: `${ce.P}(P)` };
        cfg = ce.euler;
      }
      for (const n of ['P', 'M', 'S']) {
        disc[n].userData.t = cfg[n];
        tag[n].set(nouns[n]);
      }
      const l1 = formatPropText(majT, nouns[terms.maj[0]], nouns[terms.maj[1]]);
      const l2 = formatPropText(minT, nouns[terms.min[0]], nouns[terms.min[1]]);
      const l3 = formatPropText(conT, nouns.S, nouns.P);
      info.set(`第 ${fig} 格 · ${majT}${minT}${conT}\n大前提：${l1}\n小前提：${l2}\n结  论：${l3}`);
      verdict.set(res.valid ? '有效推理 ✓' : `反例！\n${res.errors[0].slice(0, 12)}`);
      verdict.material.color.set(res.valid ? '#1f7a4d' : '#b7442f');
      st = { fig, majT, minT, conT, res };
    };

    return {
      press(id) {
        if (id === 'pMid') {
          k.set('figure', 1); k.set('major', 0); k.set('minor', 0); k.set('concl', 0);
          apply();
        } else if (id === 'pMaj') {
          k.set('figure', 0); k.set('major', 0); k.set('minor', 1); k.set('concl', 1);
          apply();
        }
      },
      change() { apply(); },
      update(dt) {
        const key = `${p.figure}|${p.major}|${p.minor}|${p.concl}`;
        if (key !== last) { last = key; apply(); }
        for (const n of ['P', 'M', 'S']) {
          const d = disc[n];
          const [x, z, r] = d.userData.t;
          const a = 1 - Math.exp(-dt * 7);
          d.position.x = lerp(d.position.x, x - 0.5, a);
          d.position.z = lerp(d.position.z, Z + z, a);
          const s = lerp(d.scale.x, r, a);
          d.scale.set(s, 1, s);
          const off = n === 'P' ? [-0.68, -0.68] : n === 'M' ? [0.68, -0.68] : [0, 0.16];
          tag[n].position.set(d.position.x + off[0] * s, H[n] + 0.55, d.position.z + off[1] * s);
        }
      },
      margin() {
        const fig = st.fig || 1;
        const mood = `${st.majT || 'A'}${st.minT || 'A'}${st.concl || 'A'}-${fig}`;
        return [
          `论式：${mood}`,
          st.res?.valid ? '形式有效（无反例）' : '形式无效（存在反例）',
          ...(st.res?.errors?.length ? st.res.errors.slice(0, 2) : ['中项至少周延一次', '大小项均无不当周延']),
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 256 式格与周延性核查台（点选任意第 1–4 格与 A/E/I/O 组合）');
    const controlsDiv = document.createElement('div');
    controlsDiv.innerHTML = `
      <div class="wb-btn-row" data-grp="figure">
        ${[1, 2, 3, 4].map((f, i) => `<button type="button" class="wb-btn" data-v="${i}">第 ${f} 格</button>`).join('')}
      </div>
      <div class="wb-btn-row">
        <span class="wb-muted" style="min-width:56px">大前提</span>
        ${PROP_SHORT.map((t, i) => `<button type="button" class="wb-btn" data-grp="major" data-v="${i}">${t}</button>`).join('')}
        <span class="wb-muted" style="min-width:56px;margin-left:10px">小前提</span>
        ${PROP_SHORT.map((t, i) => `<button type="button" class="wb-btn" data-grp="minor" data-v="${i}">${t}</button>`).join('')}
        <span class="wb-muted" style="min-width:44px;margin-left:10px">结论</span>
        ${PROP_SHORT.map((t, i) => `<button type="button" class="wb-btn" data-grp="concl" data-v="${i}">${t}</button>`).join('')}
      </div>`;
    const verdictBox = document.createElement('div');
    verdictBox.className = 'wb-stat';
    const distTable = document.createElement('div');
    distTable.className = 'wb-metrics';
    sec1.append(controlsDiv, verdictBox, distTable);

    const sec2 = wb.section('2 · 欧拉集合反例交互构造画布（拖动 S / M / P 圆圈尝试构造“两前提真、结论假”）');
    const circles = {
      P: { x: 170, y: 120, r: 62, col: '#7a5cff', label: 'P' },
      M: { x: 265, y: 120, r: 74, col: '#ffb52e', label: 'M' },
      S: { x: 360, y: 120, r: 52, col: '#19c2b0', label: 'S' },
    };
    const evalCirclePair = (type, A, B) => {
      const d = Math.hypot(A.x - B.x, A.y - B.y);
      if (type === 'A') return d + A.r <= B.r + 3;
      if (type === 'E') return d >= A.r + B.r - 3;
      if (type === 'I') return d < A.r + B.r - 3;
      return d + A.r > B.r + 3;
    };

    const eulerCv = wb.canvas(sec2, 520, 230, (x, W, H) => {
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      for (const k of ['M', 'P', 'S']) {
        const c = circles[k];
        x.save();
        x.beginPath(); x.arc(c.x, c.y, c.r, 0, TAU);
        x.fillStyle = `${c.col}28`; x.fill();
        x.strokeStyle = c.col; x.lineWidth = 2.4; x.stroke();
        x.fillStyle = '#1e2b36'; x.font = 'bold 14px Georgia,serif'; x.textAlign = 'center';
        x.fillText(c.label, c.x, c.y + 4);
        x.restore();
      }
      const fig = (sp.params.figure ?? 0) + 1;
      const majT = PROP_SHORT[sp.params.major ?? 0];
      const minT = PROP_SHORT[sp.params.minor ?? 0];
      const conT = PROP_SHORT[sp.params.concl ?? 0];
      const tm = figureTerms(fig);
      const ok1 = evalCirclePair(majT, circles[tm.maj[0]], circles[tm.maj[1]]);
      const ok2 = evalCirclePair(minT, circles[tm.min[0]], circles[tm.min[1]]);
      const okC = evalCirclePair(conT, circles.S, circles.P);
      const isCounter = ok1 && ok2 && !okC;
      x.fillStyle = isCounter ? '#b7442f' : '#1e2b36';
      x.font = 'bold 13px "Noto Serif SC",serif'; x.textAlign = 'left';
      x.fillText(`大前提 ${ok1 ? '✓真' : '✗假'}   小前提 ${ok2 ? '✓真' : '✗假'}   结论 ${okC ? '✓真' : '✗假'}`, 14, 22);
      if (isCounter) x.fillText('🎯 成功构造出几何反例：前提皆真而结论为假！', 14, H - 14);
    });

    const presetBtnRow = document.createElement('div');
    presetBtnRow.className = 'wb-btn-row';
    presetBtnRow.style.marginTop = '8px';
    presetBtnRow.innerHTML = `<button type="button" class="wb-btn primary" data-snap="counter">一键摆出当前反例布局</button>
      <button type="button" class="wb-btn" data-snap="reset">重置三圆间距</button>`;
    sec2.append(presetBtnRow);

    let dragKey = null;
    eulerCv.cv.addEventListener('pointerdown', (e) => {
      const pt = eulerCv.toLocal(e);
      for (const k of ['S', 'P', 'M']) {
        const c = circles[k];
        if (Math.hypot(pt.x - c.x, pt.y - c.y) <= c.r) { dragKey = k; break; }
      }
    });
    const onMove = (e) => {
      if (!dragKey) return;
      const pt = eulerCv.toLocal(e);
      circles[dragKey].x = clamp(pt.x, 55, 465);
      circles[dragKey].y = clamp(pt.y, 55, 185);
      eulerCv.redraw();
    };
    const onUp = () => { dragKey = null; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    wb.onCleanup(() => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    });

    const refresh = () => {
      const fig = (sp.params.figure ?? 0) + 1;
      const majT = PROP_SHORT[sp.params.major ?? 0];
      const minT = PROP_SHORT[sp.params.minor ?? 0];
      const conT = PROP_SHORT[sp.params.concl ?? 0];

      controlsDiv.querySelectorAll('[data-grp="figure"] button').forEach((b) => b.classList.toggle('primary', +b.dataset.v === fig - 1));
      ['major', 'minor', 'concl'].forEach((g) => {
        controlsDiv.querySelectorAll(`button[data-grp="${g}"]`).forEach((b) => b.classList.toggle('primary', +b.dataset.v === (sp.params[g] ?? 0)));
      });

      const res = checkSyllogismValidity(majT, minT, conT, fig);
      const tm = figureTerms(fig);
      const isSubjDist = (t) => t === 'A' || t === 'E';
      const isPredDist = (t) => t === 'E' || t === 'O';

      if (res.valid) {
        verdictBox.innerHTML = `<b>判定结果：有效三段论（${majT}${minT}${conT}-${fig}）</b><br>中项至少周延一次，大小项在结论中的周延性未超出前提范围，不存在任何欧拉反例。`;
      } else {
        const ce = getConcreteCounterexample(res.errors, fig);
        verdictBox.innerHTML = `<b style="color:#b7442f">判定结果：无效推理（${majT}${minT}${conT}-${fig}）</b><br>违背规则：<b>${res.errors.join('；')}</b><br>具体反例：${formatPropText(majT, ce.S === ce[tm.maj[0]] ? ce.S : ce[tm.maj[0]], ce[tm.maj[1]])}；${formatPropText(minT, ce[tm.min[0]], ce[tm.min[1]])}；结论“${formatPropText(conT, ce.S, ce.P)}”却为假！（${ce.why}）`;
      }

      distTable.innerHTML = [
        ['大前提', `${PROP_LABEL[majT].slice(0, 6)} (${tm.maj[0]}–${tm.maj[1]})`, `${tm.maj[0]}:${isSubjDist(majT) ? '周延' : '不周延'} · ${tm.maj[1]}:${isPredDist(majT) ? '周延' : '不周延'}`],
        ['小前提', `${PROP_LABEL[minT].slice(0, 6)} (${tm.min[0]}–${tm.min[1]})`, `${tm.min[0]}:${isSubjDist(minT) ? '周延' : '不周延'} · ${tm.min[1]}:${isPredDist(minT) ? '周延' : '不周延'}`],
        ['结  论', `${PROP_LABEL[conT].slice(0, 6)} (S–P)`, `S:${isSubjDist(conT) ? '周延' : '不周延'} · P:${isPredDist(conT) ? '周延' : '不周延'}`],
      ].map(([k, a, b]) => `<div class="wb-m"><span>${k} · ${a}</span><b>${b}</b></div>`).join('');

      eulerCv.redraw();
    };

    controlsDiv.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.closest('[data-grp="figure"]')) wb.setParam('figure', +btn.dataset.v);
      else if (btn.dataset.grp) wb.setParam(btn.dataset.grp, +btn.dataset.v);
      refresh();
    });
    presetBtnRow.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.snap === 'counter') {
        const fig = (sp.params.figure ?? 0) + 1;
        const majT = PROP_SHORT[sp.params.major ?? 0];
        const minT = PROP_SHORT[sp.params.minor ?? 0];
        const conT = PROP_SHORT[sp.params.concl ?? 0];
        const res = checkSyllogismValidity(majT, minT, conT, fig);
        const cfg = res.valid ? getValidEuler(majT, minT, conT, fig) : getConcreteCounterexample(res.errors, fig).euler;
        for (const k of ['P', 'M', 'S']) {
          circles[k].x = 260 + cfg[k][0] * 60;
          circles[k].y = 122 + cfg[k][1] * 40;
          circles[k].r = cfg[k][2] * 38;
        }
      } else {
        circles.P.x = 170; circles.P.y = 120; circles.P.r = 62;
        circles.M.x = 265; circles.M.y = 120; circles.M.r = 74;
        circles.S.x = 360; circles.S.y = 120; circles.S.r = 52;
      }
      eulerCv.redraw();
    });

    let lastKey = '';
    refresh();
    return {
      update() {
        const key = `${sp.params.figure}|${sp.params.major}|${sp.params.minor}|${sp.params.concl}`;
        if (key !== lastKey) { lastKey = key; refresh(); }
      },
    };
  },
};

// ================================================================
// 3. 英语 · L3 时态体貌与 Reichenbach 三时间轴 (eng-tense)
// ================================================================
const TENSE_MATRIX = [
  [
    { zh: '一般过去时', form: 'did', rel: 'E, R < S', ex: 'She wrote a letter yesterday.', sem: '参照时间 R 在过去某刻，动作 E 作为独立完整事实发生于 R。' },
    { zh: '过去进行时', form: 'was / were doing', rel: 'R < S, E ⊇ R', ex: 'She was writing when I called.', sem: '在过去参照时刻 R（when I called），动作 E 正在持续展开中。' },
    { zh: '过去完成时', form: 'had done', rel: 'E < R < S', ex: 'She had written it before I called.', sem: '“过去的过去”：动作 E 在过去参照时刻 R 之前就已完成。' },
    { zh: '过去完成进行时', form: 'had been doing', rel: 'E → R < S', ex: 'She had been writing for an hour when I called.', sem: '动作从更早的过去一路持续到过去参照时刻 R（强调持续时长）。' },
  ],
  [
    { zh: '一般现在时', form: 'do / does', rel: 'E, R, S（或泛时点）', ex: 'She writes letters every week.', sem: '立足说话时刻 S=R，常表反复习惯、客观真理或当前常态。' },
    { zh: '现在进行时', form: 'am / is / are doing', rel: 'R = S, E ⊇ R', ex: 'She is writing a letter now.', sem: '此刻 R=S 恰好落在动作 E 正在进行的区间内部。' },
    { zh: '现在完成时', form: 'have / has done', rel: 'E < R = S', ex: 'She has written the letter.', sem: '动作发生在说话前（E < S），但立足点 R 留在现在，强调当前结果或影响。' },
    { zh: '现在完成进行时', form: 'have / has been doing', rel: 'E → R = S', ex: 'She has been writing for two hours.', sem: '动作在过去某刻开始并一直延续至说话时刻 R=S（通常仍在继续）。' },
  ],
  [
    { zh: '一般将来时', form: 'will do', rel: 'S < R, E', ex: 'She will write a letter tomorrow.', sem: '参照时间 R 与动作 E 都在说话时刻 S 之后。' },
    { zh: '将来进行时', form: 'will be doing', rel: 'S < R, E ⊇ R', ex: 'She will be writing at 8 tomorrow.', sem: '在将来某个特定时刻 R（at 8 tomorrow），动作 E 将正处于进行态。' },
    { zh: '将来完成时', form: 'will have done', rel: 'S < E < R（或 E 先于 R）', ex: 'She will have written it by Friday.', sem: '站在将来参照界限 R（by Friday）回看，动作 E 到那时已经结束。' },
    { zh: '将来完成进行时', form: 'will have been doing', rel: 'S < E → R', ex: 'By noon she will have been writing for 3 hours.', sem: '到将来参照点 R 为止，动作 E 将已连续进行了一段时长。' },
  ],
];

const ASPECT_PAIRS = [
  {
    name: '现在完成时 vs 一般过去时',
    a: 'I have lost my key.（E < R = S）',
    b: 'I lost my key yesterday.（E, R < S）',
    diff: '两句动作“丢钥匙”都在说话前发生（E < S），但前者参照点 R 停在“现在 S”——暗示现在还没找到；后者 R 移到“昨天”，仅叙述过去事件本身，现在找没找到无涉。',
  },
  {
    name: '现在完成时 vs 现在完成进行时',
    a: 'She has written three letters.（侧重完成结果）',
    b: 'She has been writing for two hours.（侧重持续过程）',
    diff: '两者均为过去延及现在，但完成体把事件视作已封闭的量化成果（3封信）；完成进行体把视角留在未封口的持续活动与耗时上。',
  },
  {
    name: '一般过去时 vs 过去进行时',
    a: 'When I arrived, she left.（先后发生）',
    b: 'When I arrived, she was leaving.（背景重叠）',
    diff: '一般过去时表示到达时她才离开；过去进行时让 E 跨过 R（我到达时她正准备动身/刚在离开途中）。',
  },
];

export const tense = {
  id: 'eng-tense',
  subject: 'eng',
  title: '英语时态体貌与 Reichenbach 三时间轴',
  en: 'English tenses & Reichenbach timeline',
  lede: [
    'Hans Reichenbach (1947) 用三个时间坐标点彻底理清英语十二种核心时态：说话时刻 S（Speech）、参照时刻 R（Reference）与事件时刻 E（Event）。',
    'Time（过去/现在/将来）决定 R 相对 S 的位置，Aspect（一般/进行/完成/完成进行）决定 E 相对 R 的形态与区间覆盖！',
  ],
  formula: 'Tense = Time(S vs R) × Aspect(R vs E)',
  formulaNote: 'S 为说话此刻原点，铜色旗帜为参照点 R，紫色光带/球为事件 E',
  terms: [
    ['S (Speech Time)', '说话人开口说出句子的当下时刻（时间轴原点 now）'],
    ['R (Reference Time)', '说话人选择用来观察事件的“立足点/参照时刻”'],
    ['E (Event Time)', '动作或状态实际发生的时间点或时间区间'],
  ],
  predict: {
    q: '“I have lost my key.” 与 “I lost my key.” 都指过去丢了钥匙，Reichenbach 模型如何解释两者的核心差异？',
    options: [
      '前者的事件时间 E 更早',
      '前者的参照时间 R 停在“说话此刻 S”（E < R = S），强调对现在的影响；后者 R 已退回过去',
      '两者完全同义，仅书面与口语之别',
    ],
    answer: 1,
    why: '现在完成时的精髓在于 R = S：虽然丢钥匙（E）在过去，但说话人站在“现在（R=S）”看结果——钥匙现在仍不知去向；一般过去时把 R 也搬回过去，只讲往事。',
  },
  challenge: '在实验台拖动 R 旗帜与 E 事件条，依次拼出“过去的过去（had done）”和“站到将来回看的完成时（will have done）”。',
  fig: 'Reichenbach 三点立体时间轴（墨柱=S，铜旗=R，紫带=E）',
  hint: '切换“时”与“体”观察 S/R/E 三点相对移动；打开实验台直接拖动 R 与 E 匹配 12 种时态并做体貌辨析。',
  teach: {
    where: '人教版 / 外研版高中英语语法专题：动词的时态与体貌（必修与选择性必修各册语法模块）',
    ask: [
      '为什么说一般现在时常用来表达客观真理或习惯（画成多点序列），而非仅仅一个“now”瞬时点？',
      '“By 2030, they will have built the bridge.” 中，2030 年对应 S、R、E 中的哪一个？',
    ],
    simplify: '按 Reichenbach (1947) 标准 12 种主动态核心时态绘制相对拓扑关系，时间轴长度作教学比例示意。',
  },
  controls: [
    { id: 'time', type: 'choice', label: '时 (R vs S)', options: ['过去 (R < S)', '现在 (R = S)', '将来 (S < R)'], value: 1, wide: true },
    { id: 'asp', type: 'choice', label: '体 (E vs R)', options: ['一般', '进行', '完成', '完成进行'], value: 2, wide: true },
  ],
  inquiry: {
    note: '使用 Reichenbach (S, R, E) 三坐标分析英语谓语动词的时空视角：',
    steps: [
      { key: 'evidence', label: 'S / R / E 位置对照', prompt: '任选过去完成时、现在完成时与将来完成时，分别写出三者 S、R、E 的先后顺序：', hints: ['过去完成时 E < R < S', '现在完成时 E < R = S', '将来完成时 S < E < R（或 E 在 R 之前）'] },
      { key: 'analysis', label: '体貌差异辨析', prompt: '对比“She has written 3 letters.”与“She has been writing for 2 hours.”在时间区间 E 上的区别：', hints: ['完成体聚焦封闭结果', '完成进行体突出持续到参照点的过程'] },
      { key: 'reflection', label: '真实语境造句检验', prompt: '选定一个常见动词（如 read / live），构造一对时态对比句并解释参照点 R 的作用：', hints: ['借助时间状语如 yesterday / by Friday / since 2020 定位 R'] },
    ],
  },

  build(k) {
    const p = k.p;
    const Y = 1.48;
    const Z = -1.35;
    const holder = new THREE.Group();
    k.root.add(
      rod([-4.4, Y, Z], [4.4, Y, Z], 0.05),
      rod([-4.15, 0, Z], [-4.15, Y, Z], 0.06),
      rod([4.15, 0, Z], [4.15, Y, Z], 0.06),
      rot(at(cone(0.16, 0.4), 4.4, Y, Z), 0, 0, -Math.PI / 2),
      rod([0, 0, Z], [0, Y + 1.65, Z], 0.05, C.ink),
      at(card('S · now', { size: 0.3, lay: 'up' }), 0, Y + 1.68, Z),
      at(note('过去 Past', { size: 0.28, lay: 'flat' }), -3.1, 0.03, Z + 0.9),
      at(note('将来 Future', { size: 0.28, lay: 'flat' }), 3.1, 0.03, Z + 0.9),
    );
    const sent = at(card('\n\n', { w: 8.2, size: 0.29 }), 0, 0, 2.95);
    const title = at(note('', { size: 0.44, bold: true, w: 6.2 }), 0, 4.3, -3.2);
    k.root.add(holder, sent, title);

    let last = '';
    let pulse = [];

    const draw = () => {
      freshGroup(holder);
      pulse = [];
      const tIdx = p.time ?? 1;
      const aIdx = p.asp ?? 2;
      const r = [-2.35, 0, 2.35][tIdx];
      const item = TENSE_MATRIX[tIdx][aIdx];

      const addSpan = (x0, x1) => {
        const m = at(flat(new THREE.BoxGeometry(Math.max(0.08, x1 - x0), 0.3, 0.3), C.violet, { opacity: 0.85 }), (x0 + x1) / 2, Y, Z);
        const g = at(flat(new THREE.BoxGeometry(Math.max(0.2, x1 - x0 + 0.2), 0.44, 0.44), C.violet, { opacity: 0.22 }), (x0 + x1) / 2, Y, Z);
        holder.add(m, g, at(note('E', { size: 0.26, color: C.violet, bold: true }), (x0 + x1) / 2, Y - 0.52, Z));
        pulse.push(g);
      };
      const addDot = (x, lbl = true) => {
        const b = at(flat(new THREE.SphereGeometry(0.2, 18, 14), C.violet), x, Y, Z);
        const g = at(flat(new THREE.SphereGeometry(0.32, 16, 12), C.violet, { opacity: 0.24 }), x, Y, Z);
        holder.add(b, g);
        if (lbl) holder.add(at(note('E', { size: 0.26, color: C.violet, bold: true }), x, Y - 0.52, Z));
        pulse.push(g);
      };

      // R 铜色参照旗
      holder.add(
        rod([r, Y, Z], [r, Y + 0.96, Z], 0.036, C.copper),
        at(flat(new THREE.ConeGeometry(0.18, 0.4, 3).rotateZ(-Math.PI / 2), C.copper), r + 0.22, Y + 0.82, Z),
        at(note('R', { size: 0.28, color: C.copper, bold: true }), r + 0.26, Y + 1.24, Z),
      );

      if (aIdx === 0) {
        if (tIdx === 1) { [-2.3, -1.15, 0, 1.15, 2.3].forEach((x, idx) => addDot(x, idx === 2)); }
        else addDot(r);
      } else if (aIdx === 1) {
        addSpan(r - 0.92, r + 0.92);
      } else if (aIdx === 2) {
        addDot(r - 1.42);
        holder.add(strip(14, {
          w: 0.05, color: C.violet,
          pts: Array.from({ length: 14 }, (_, i) => [r - 1.42 + (1.42 * i) / 13, Y + Math.sin((i / 13) * Math.PI) * 0.72, Z]),
        }));
      } else {
        addSpan(r - 1.85, r);
      }

      title.set(`${item.zh} · ${item.rel}`);
      sent.set(`${item.ex}\n结构：${item.form}`);
    };

    return {
      update(dt, t) {
        const key = `${p.time}|${p.asp}`;
        if (key !== last) { last = key; draw(); }
        pulse.forEach((g) => { g.material.opacity = 0.16 + Math.sin(t * 3.2) * 0.08; });
      },
      margin() {
        const item = TENSE_MATRIX[p.time ?? 1][p.asp ?? 2];
        return [item.zh, `结构：${item.form}`, `Reichenbach：${item.rel}`, item.sem.slice(0, 22)];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 可拖拽 Reichenbach 三点时间轴（拖动铜色参照点 R 与紫色事件 E）');
    let rx = 0; // -1..1 (S=0)
    let ex = -0.35; // -1..1
    let eDur = 0.05; // 0..0.45

    const syncFromParams = () => {
      const t = sp.params.time ?? 1;
      const a = sp.params.asp ?? 2;
      rx = [-0.6, 0, 0.6][t];
      if (a === 0) { ex = rx; eDur = 0.03; }
      else if (a === 1) { ex = rx; eDur = 0.25; }
      else if (a === 2) { ex = rx - 0.35; eDur = 0.03; }
      else { ex = rx - 0.22; eDur = 0.22; }
    };
    syncFromParams();

    const tlCv = wb.canvas(sec1, 520, 200, (x, W, H) => {
      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      const midX = W / 2, axY = 104, spanW = 195;
      const toPx = (v) => midX + v * spanW;

      x.strokeStyle = '#1e2b36'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(28, axY); x.lineTo(W - 28, axY); x.stroke();
      x.fillStyle = '#1e2b36'; x.beginPath(); x.moveTo(W - 22, axY); x.lineTo(W - 34, axY - 6); x.lineTo(W - 34, axY + 6); x.closePath(); x.fill();

      // S 原点
      x.strokeStyle = '#1e2b36'; x.setLineDash([4, 3]);
      x.beginPath(); x.moveTo(midX, 34); x.lineTo(midX, axY + 48); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#1e2b36'; x.font = 'bold 12px Georgia,serif'; x.textAlign = 'center';
      x.fillText('S (Speech · now)', midX, 24);
      x.fillStyle = '#51606b'; x.font = '11px "Noto Serif SC",serif';
      x.fillText('← 过去 Past', 95, H - 14);
      x.fillText('将来 Future →', W - 95, H - 14);

      // E 事件条或点
      const ePx = toPx(ex);
      const eHalf = eDur * spanW;
      if (eDur > 0.1) {
        x.fillStyle = 'rgba(122,92,255,0.28)'; x.strokeStyle = '#7a5cff'; x.lineWidth = 2.4;
        x.beginPath(); x.roundRect(ePx - eHalf, axY - 14, eHalf * 2, 28, 10); x.fill(); x.stroke();
        x.fillStyle = '#7a5cff'; x.font = 'bold 12px Georgia,serif';
        x.fillText('E (持续区间)', ePx, axY + 34);
      } else {
        x.fillStyle = '#7a5cff'; x.beginPath(); x.arc(ePx, axY, 10, 0, TAU); x.fill();
        x.font = 'bold 12px Georgia,serif'; x.fillText('E (事件点)', ePx, axY + 34);
        if (ex < rx - 0.12) {
          x.strokeStyle = '#7a5cff'; x.lineWidth = 2;
          x.beginPath(); x.moveTo(ePx, axY - 8); x.quadraticCurveTo((ePx + toPx(rx)) / 2, axY - 42, toPx(rx), axY - 8); x.stroke();
        }
      }

      // R 旗帜
      const rPx = toPx(rx);
      x.strokeStyle = '#b4653a'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(rPx, axY); x.lineTo(rPx, axY - 46); x.stroke();
      x.fillStyle = '#b4653a';
      x.beginPath(); x.moveTo(rPx, axY - 46); x.lineTo(rPx + 20, axY - 38); x.lineTo(rPx, axY - 30); x.closePath(); x.fill();
      x.font = 'bold 12px Georgia,serif'; x.fillText('R (参照)', rPx, axY - 54);

      const item = TENSE_MATRIX[sp.params.time ?? 1][sp.params.asp ?? 2];
      x.fillStyle = '#1e2b36'; x.font = 'bold 13px "Noto Serif SC",serif'; x.textAlign = 'left';
      x.fillText(`当前匹配：${item.zh} (${item.rel})`, 18, 24);
    });

    const matrixGrid = document.createElement('div');
    matrixGrid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px;';
    TENSE_MATRIX.forEach((row, t) => row.forEach((cell, a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'wb-btn';
      b.style.cssText = 'padding:6px 8px;border-radius:6px;font-size:12px;text-align:left;';
      b.dataset.t = String(t); b.dataset.a = String(a);
      b.innerHTML = `<b>${cell.zh}</b><br><small style="opacity:.8">${cell.form}</small>`;
      matrixGrid.append(b);
    }));
    const durRow = document.createElement('div');
    durRow.className = 'wb-btn-row';
    durRow.style.marginTop = '8px';
    durRow.innerHTML = `<button type="button" class="wb-btn" data-dur="point">事件形态：瞬时/完成点</button>
      <button type="button" class="wb-btn" data-dur="span">事件形态：持续进行区间</button>`;
    sec1.append(durRow, matrixGrid);

    const sec2 = wb.section('2 · 体貌语义对比分析器（点击经典易混时态组对比辨析）');
    const pairBtns = document.createElement('div');
    pairBtns.className = 'wb-btn-row';
    pairBtns.innerHTML = ASPECT_PAIRS.map((pr, i) => `<button type="button" class="wb-btn${i === 0 ? ' primary' : ''}" data-pair="${i}">${pr.name}</button>`).join('');
    const pairCard = document.createElement('div');
    pairCard.className = 'wb-stat';
    sec2.append(pairBtns, pairCard);

    let pairIdx = 0;
    let dragging = null;

    const inferTenseFromDrag = () => {
      const t = rx < -0.18 ? 0 : rx > 0.18 ? 2 : 1;
      const isSpan = eDur > 0.12;
      let a = 0;
      if (isSpan) a = ex < rx - 0.1 ? 3 : 1;
      else a = ex < rx - 0.14 ? 2 : 0;
      wb.setParam('time', t);
      wb.setParam('asp', a);
    };

    const refresh = () => {
      tlCv.redraw();
      matrixGrid.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('primary', +b.dataset.t === (sp.params.time ?? 1) && +b.dataset.a === (sp.params.asp ?? 2));
      });
      const pr = ASPECT_PAIRS[pairIdx];
      const cur = TENSE_MATRIX[sp.params.time ?? 1][sp.params.asp ?? 2];
      pairCard.innerHTML = `<b>A 句：</b>${pr.a}<br><b>B 句：</b>${pr.b}<br><b>语义差别：</b>${pr.diff}<hr style="border:none;border-top:1px solid #d9cfb8;margin:8px 0"><b>当前时态解析（${cur.zh}）：</b>${cur.ex} —— ${cur.sem}`;
    };

    tlCv.cv.addEventListener('pointerdown', (e) => {
      const pt = tlCv.toLocal(e);
      const rPx = 260 + rx * 195, ePx = 260 + ex * 195;
      if (Math.abs(pt.x - rPx) < 24 && pt.y < 110) dragging = 'R';
      else if (Math.abs(pt.x - ePx) < 36) dragging = 'E';
    });
    const onMove = (e) => {
      if (!dragging) return;
      const pt = tlCv.toLocal(e);
      const v = clamp((pt.x - 260) / 195, -0.9, 0.9);
      if (dragging === 'R') { rx = Math.abs(v) < 0.1 ? 0 : v; }
      else { ex = v; }
      inferTenseFromDrag();
      refresh();
    };
    const onUp = () => { dragging = null; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    wb.onCleanup(() => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    });

    durRow.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      eDur = btn.dataset.dur === 'span' ? 0.24 : 0.03;
      inferTenseFromDrag();
      refresh();
    });
    matrixGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      wb.setParam('time', +btn.dataset.t);
      wb.setParam('asp', +btn.dataset.a);
      syncFromParams();
      refresh();
    });
    pairBtns.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      pairIdx = +btn.dataset.pair;
      pairBtns.querySelectorAll('button').forEach((b, i) => b.classList.toggle('primary', i === pairIdx));
      refresh();
    });

    let lastKey = '';
    refresh();
    return {
      update() {
        const key = `${sp.params.time}|${sp.params.asp}`;
        if (key !== lastKey) {
          lastKey = key;
          if (!dragging) syncFromParams();
          refresh();
        }
      },
    };
  },
};

// ================================================================
// 4. 英语 · L3 五种基本句型、There be 与长难句剥离台 (eng-sentence)
// ================================================================
const ROLE_META = {
  S: ['主语', '#cfe6ff'],
  V: ['谓语', '#ffd9c7'],
  O: ['宾语', '#d6f0dc'],
  IO: ['间宾', '#ffeab8'],
  DO: ['直宾', '#d6f0dc'],
  P: ['表语', '#e3dbff'],
  C: ['宾补', '#e3dbff'],
  A: ['状语', '#ece8dc'],
  TH: ['There引导', '#f2e8cf'],
};

const SENT_PATTERNS = [
  {
    name: 'S + V', act: [['S', 'The sun'], ['V', 'rises']], adv: 'in the east', pas: null, pasAlt: null,
    why: '不及物动词后没有宾语，无法转换为被动语态。',
    note: '核心主干：主语 + 不及物动词（rise / happen / arrive）',
  },
  {
    name: 'S + V + P', act: [['S', 'The soup'], ['V', 'tastes'], ['P', 'delicious']], adv: 'today', pas: null, pasAlt: null,
    why: '系动词（be/感官/变化/保持）连接主语与表语形容词，无被动语态。',
    note: '系动词分四类：状态(be)、感官(taste/look)、变化(become/turn)、保持(keep/stay)',
  },
  {
    name: 'S + V + O', act: [['S', 'Tom'], ['V', 'reads'], ['O', 'books']], adv: 'every day',
    pas: [['S', 'Books'], ['V', 'are read'], ['A', 'by Tom']], pasAlt: null,
    note: '单宾语及物动词（read / like / finish），宾语可提作被动主语。',
  },
  {
    name: 'S + V + IO + DO', act: [['S', 'She'], ['V', 'gave'], ['IO', 'me'], ['DO', 'a book']], adv: 'yesterday',
    pas: [['S', 'I'], ['V', 'was given'], ['DO', 'a book']],
    pasAlt: [['S', 'A book'], ['V', 'was given'], ['A', 'to me']],
    note: '双宾语结构（give/send/show）有两种被动路径：人作主语或物作主语（加 to/for）。',
  },
  {
    name: 'S + V + O + C', act: [['S', 'We'], ['V', 'found'], ['O', 'the room'], ['C', 'empty']], adv: 'this morning',
    pas: [['S', 'The room'], ['V', 'was found'], ['C', 'empty']], pasAlt: null,
    note: '宾补补充说明宾语状态/身份（find/make/keep/call），被动后变成主补。',
  },
  {
    name: 'There be 存现句', act: [['TH', 'There'], ['V', 'are'], ['S', 'many books'], ['A', 'on the desk']], adv: 'now', pas: null, pasAlt: null,
    why: 'There 只是形式引导词，真正主语 S 倒装在 be 之后，谓语单复数听命于后面的真主语！',
    note: '存现倒装：There + be/exist/seem + 真主语 S + 地点/时间状语',
  },
];

const LONG_SENTENCES = [
  {
    title: '定语从句 + 介词短语修饰 (S + V + O)',
    pattern: 'S + V + O',
    spans: [
      { text: 'The young researcher', role: 'core', tag: 'S' },
      { text: 'who won the national prize last year', role: 'attr', tag: '定语从句' },
      { text: 'from Beijing', role: 'prep', tag: '介短定语' },
      { text: 'has published', role: 'core', tag: 'V' },
      { text: 'a groundbreaking paper', role: 'core', tag: 'O' },
      { text: 'on quantum optics', role: 'prep', tag: '介短定语' },
      { text: 'in Nature', role: 'adv', tag: '地点状语' },
      { text: 'after three years of hard work', role: 'adv', tag: '时间状语' },
    ],
  },
  {
    title: '非谓语分词 + 宾补结构 (S + V + O + C)',
    pattern: 'S + V + O + C',
    spans: [
      { text: 'Standing near the window,', role: 'nonfin', tag: '现在分词状语' },
      { text: 'we', role: 'core', tag: 'S' },
      { text: 'found', role: 'core', tag: 'V' },
      { text: 'the old wooden house', role: 'core', tag: 'O' },
      { text: 'built in the Ming Dynasty', role: 'nonfin', tag: '过去分词定语' },
      { text: 'completely empty', role: 'core', tag: 'C' },
      { text: 'when the storm ended.', role: 'adv', tag: '时间状语从句' },
    ],
  },
  {
    title: '感官系动词主系表长句 (S + V + P)',
    pattern: 'S + V + P',
    spans: [
      { text: 'Although the road looked rough,', role: 'adv', tag: '让步状语从句' },
      { text: 'the tea', role: 'core', tag: 'S' },
      { text: 'picked before the spring rain', role: 'nonfin', tag: '分词定语' },
      { text: 'in the high mountains', role: 'prep', tag: '介短定语' },
      { text: 'tasted', role: 'core', tag: 'V(系)' },
      { text: 'remarkably sweet', role: 'core', tag: 'P' },
      { text: 'to every traveler.', role: 'prep', tag: '介短状语' },
    ],
  },
  {
    title: 'There be 存现倒装长句 (There + be + S)',
    pattern: 'There be 存现句',
    spans: [
      { text: 'In the ancient library', role: 'prep', tag: '前置地点状语' },
      { text: 'there', role: 'core', tag: '引导词' },
      { text: 'exist', role: 'core', tag: 'V(存现)' },
      { text: 'hundreds of clay blocks', role: 'core', tag: '真主语 S' },
      { text: 'carved in reverse order', role: 'nonfin', tag: '分词定语' },
      { text: 'which record Song technology.', role: 'attr', tag: '定语从句' },
    ],
  },
];

export const sentence = {
  id: 'eng-sentence',
  subject: 'eng',
  title: '五种基本句型、There be 与长难句剥离台',
  en: 'Sentence patterns, linking verbs & clause stripping',
  lede: [
    '英语长难句无论叠多少层定语从句、介词短语、分词与状语从句，把修饰层层剥离后，核心骨架总是五种基本句型（及 There be 存现倒装）。',
    '在立体舞台拼搭六类结构并切换被动双路径；打开工作台，亲手把复杂长难句一层层“剥皮”还原出最简主干！',
  ],
  formula: 'Clause = Core(S+V+…) + Modifiers(Prep / Attr / Non-finite / Adv)',
  formulaNote: '谓语动词的性质（不及物、系动词、单宾、双宾、宾补、存现）唯一决定了句型骨架',
  terms: [
    ['系动词四类', '状态（be）、感官（taste/look/sound）、变化（become/grow/turn）、保持（keep/remain）'],
    ['There be 倒装', 'There 是形式引导词，真正主语 S 位于谓语动词之后（遵循就近原则）'],
    ['长难句剥离法', '先剔除介词短语、定从、非谓语与状从，直取 S-V-(O/P/C) 主干后再回填修饰关系'],
  ],
  predict: {
    q: '“There remains a serious problem that we must solve.” 这句话的真正主语和谓语动词单复数依据是什么？',
    options: [
      'There 是主语，所以用第三人称单数 remains',
      'a serious problem 是倒装在后的真主语，决定 remains 用单数',
      'we 是真正主语',
    ],
    answer: 1,
    why: 'There be / There remain 属存现倒装句，There 仅占主语虚位，真正的语法主语是动词后面的 a serious problem（单数），定语从句 that we must solve 只是修饰它。',
  },
  challenge: '切到 S+V+IO+DO 体验双宾语的两种被动转换；再进工作台把全部四句长难句剥离到只剩主干！',
  fig: '六类英语句型立体积木（颜色区分 S / V / O / P / IO / DO / C / A）',
  hint: '切换句型、叠加状语或切换被动语态；在工作台交互剥离长难句修饰成分。',
  teach: {
    where: '人教版普通高中英语必修第一册 Welcome Unit（Sentence Structures）/ 外研版必修第一册同类句型模块',
    ask: [
      '为什么 “She made me a cake.” 与 “She made me happy.” 表面词序相同，却分属 S+V+IO+DO 与 S+V+O+C？',
      '如果把 “She gave me a book.” 变成以“物”为主语的被动，必须补上哪个介词？',
    ],
    simplify: '五种基本句型加 There be 存现句作为高中阅读教学核心框架（语言学中还可细分为 SVA / SVOA 等八类）。',
  },
  controls: [
    { id: 'pat', type: 'choice', label: '句型骨架', options: SENT_PATTERNS.map((q) => q.name), value: 2, wide: true },
    { id: 'adv', type: 'toggle', label: '叠加状语', value: false },
    { id: 'pas', type: 'toggle', label: '被动语态', value: false },
  ],
  inquiry: {
    note: '用句干积木与长难句剥离实验，归纳英语句法核心规律：',
    steps: [
      { key: 'evidence', label: '双宾 vs 宾补辨别', prompt: '比较 “She made me a cake.” 与 “She made me happy.”，说明如何检验二者区别：', hints: ['在两成分间尝试插 “to be”：me (to be) happy 成立→宾补；me (to be) a cake 不成立→双宾'] },
      { key: 'analysis', label: '长难句剥离实录', prompt: '从工作台任选一句长难句，抄下你剥离所有修饰成分后的主干，并写出所属句型：', hints: ['剥离介词短语、分词定语、定语从句与状语从句后，句子依然语法完整'] },
      { key: 'reflection', label: 'There be 与被动限制', prompt: '总结哪些句型没有被动语态，以及 There be 句型主谓一致的判断办法：', hints: ['S+V、S+V+P、There be 没有被动', 'There be 看动词后第一个名词的单复数'] },
    ],
  },

  build(k) {
    const p = k.p;
    const holder = new THREE.Group();
    const Z = -0.9;
    const info = at(card('\n\n', { w: 7.4, size: 0.28 }), 0, 0, 2.95);
    const title = at(note('', { size: 0.45, bold: true, w: 6.4 }), 0, 3.65, -3.3);
    k.root.add(holder, info, title);

    let last = '';
    const draw = () => {
      freshGroup(holder);
      const q = SENT_PATTERNS[p.pat ?? 2];
      const hasPas = !!(p.pas && q.pas);
      const parts = (hasPas ? q.pas : q.act).slice();
      if (p.adv) parts.push(['A', q.adv]);

      const cards = parts.map(([r, w]) => card(w, { size: 0.46, bg: ROLE_META[r][1], bold: true }));
      const gap = 0.28;
      const total = cards.reduce((a, c) => a + c.w, 0) + gap * (cards.length - 1);
      const sc = Math.min(1, 8.8 / total);
      let x = (-total * sc) / 2;

      const xs = [];
      cards.forEach((c, i) => {
        const w = c.w * sc;
        const r = parts[i][0];
        c.scale.setScalar(sc);
        const cx = x + w / 2;
        xs.push({ r, cx });
        holder.add(
          at(box(w, 0.38, 1.26, ROLE_META[r][1]), cx, 0, Z),
          at(c, cx, 0.38, Z + 0.34),
          at(note(ROLE_META[r][0], { size: 0.27, lay: 'flat' }), cx, 0.03, Z + 1.12),
          at(note(r, { size: 0.25, lay: 'flat', italic: true, color: C.copper }), cx, 0.03, Z + 1.54),
        );
        x += w + gap * sc;
      });

      // There be 倒装弧线连接 There -> S
      if ((p.pat ?? 2) === 5 && xs.length >= 3) {
        const x0 = xs[0].cx, x2 = xs[2].cx;
        holder.add(strip(14, {
          w: 0.045, color: C.copper,
          pts: Array.from({ length: 14 }, (_, i) => [lerp(x0, x2, i / 13), 1.45 + Math.sin((i / 13) * Math.PI) * 0.65, Z]),
        }));
      }

      title.set(hasPas ? `${q.name}（被动语态）` : q.name);
      if (p.pas && !q.pas) {
        info.set(`该句型无法转换为被动语态\n原因：${q.why}`);
      } else {
        info.set(`${parts.map((x2) => x2[1]).join(' ')}.\n成分：${parts.map((x2) => ROLE_META[x2[0]][0]).join(' + ')}`);
      }
    };

    return {
      update() {
        const key = `${p.pat}|${p.adv}|${p.pas}`;
        if (key !== last) { last = key; draw(); }
      },
      margin() {
        const q = SENT_PATTERNS[p.pat ?? 2];
        return [q.name, q.note.slice(0, 26), p.adv ? '已加状语（可剥离外围）' : '纯净主干（无状语）', p.pas ? (q.pas ? '被动：宾语升作主语' : '此句型无被动') : '主动语态'];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 长难句修饰成分剥离实验台（点击各层修饰或点“一键剥离”直取句干）');
    let sentIdx = 0;
    const hiddenRoles = new Set();
    const hiddenSpanIdxs = new Set();

    const selRow = document.createElement('div');
    selRow.className = 'wb-btn-row';
    selRow.innerHTML = LONG_SENTENCES.map((s, i) => `<button type="button" class="wb-btn${i === 0 ? ' primary' : ''}" data-si="${i}">例句 ${i + 1}：${s.pattern}</button>`).join('');

    const layerRow = document.createElement('div');
    layerRow.className = 'wb-btn-row';
    layerRow.innerHTML = `
      <button type="button" class="wb-btn" data-layer="prep">剥离介词短语</button>
      <button type="button" class="wb-btn" data-layer="attr">剥离定语从句</button>
      <button type="button" class="wb-btn" data-layer="nonfin">剥离非谓语分词</button>
      <button type="button" class="wb-btn" data-layer="adv">剥离状语/状从</button>
      <button type="button" class="wb-btn primary" data-act="strip">一键剥离至主干</button>
      <button type="button" class="wb-btn" data-act="restore">恢复全句</button>`;

    const sentenceStage = document.createElement('div');
    sentenceStage.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;padding:12px;background:#fbf6ea;border:1px solid #d9cfb8;border-radius:6px;';
    const kernelBox = document.createElement('div');
    kernelBox.className = 'wb-stat';
    kernelBox.style.marginTop = '10px';
    sec1.append(selRow, layerRow, sentenceStage, kernelBox);

    const sec2 = wb.section('2 · 系动词分类与双宾语双被动转换对照');
    const passiveCard = document.createElement('div');
    passiveCard.className = 'wb-grid';
    passiveCard.innerHTML = `
      <div class="wb-stat"><b>四类常见系动词 (S+V+P)</b><br>• 状态：be (am/is/are/was/were)<br>• 感官：look, sound, smell, taste, feel<br>• 变化：become, get, turn, grow, go<br>• 保持：keep, stay, remain, seem, appear</div>
      <div class="wb-stat"><b>双宾语 S+V+IO+DO 的两种被动</b><br>主动：She gave <b>me</b> <u>a book</u>.<br>• 间宾作主语：<b>I</b> was given <u>a book</u> (by her).<br>• 直宾作主语：<u>A book</u> was given <b>to me</b> (by her).</div>`;
    sec2.append(passiveCard);

    const refresh = () => {
      const item = LONG_SENTENCES[sentIdx];
      selRow.querySelectorAll('button').forEach((b, i) => b.classList.toggle('primary', i === sentIdx));
      layerRow.querySelectorAll('[data-layer]').forEach((b) => b.classList.toggle('primary', hiddenRoles.has(b.dataset.layer)));

      sentenceStage.innerHTML = '';
      const kept = [];
      item.spans.forEach((spn, i) => {
        const isCore = spn.role === 'core';
        const isStripped = !isCore && (hiddenRoles.has(spn.role) || hiddenSpanIdxs.has(i));
        if (!isStripped) kept.push(spn);

        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'wb-btn';
        chip.style.cssText = `border-radius:6px;padding:6px 10px;text-align:left;transition:opacity .15s;${isCore ? 'background:#cfe6ff;border-color:#1e2b36;' : isStripped ? 'opacity:0.32;text-decoration:line-through;background:#ece8dc;' : 'background:#ffeab8;'}`;
        chip.innerHTML = `<span style="font-size:14px;display:block">${spn.text}</span><small style="font-size:10.5px;color:#51606b">${spn.tag}</small>`;
        if (!isCore) {
          chip.addEventListener('click', () => {
            if (hiddenSpanIdxs.has(i)) hiddenSpanIdxs.delete(i);
            else hiddenSpanIdxs.add(i);
            refresh();
          });
        }
        sentenceStage.append(chip);
      });

      const coreOnly = item.spans.filter((s) => s.role === 'core').map((s) => s.text).join(' ');
      const curView = kept.map((s) => s.text).join(' ');
      kernelBox.innerHTML = `<b>句型归属：${item.pattern}</b>（${item.title}）<br><b>当前保留文本：</b>${curView}<br><b>核心主干：</b><span style="color:#1f4a3e;font-weight:700">${coreOnly}</span>`;
    };

    selRow.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      sentIdx = +btn.dataset.si;
      hiddenRoles.clear(); hiddenSpanIdxs.clear();
      const patMap = [2, 4, 1, 5];
      wb.setParam('pat', patMap[sentIdx] ?? 2);
      refresh();
    });
    layerRow.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      if (btn.dataset.layer) {
        const l = btn.dataset.layer;
        if (hiddenRoles.has(l)) hiddenRoles.delete(l); else hiddenRoles.add(l);
      } else if (btn.dataset.act === 'strip') {
        ['prep', 'attr', 'nonfin', 'adv'].forEach((l) => hiddenRoles.add(l));
      } else if (btn.dataset.act === 'restore') {
        hiddenRoles.clear(); hiddenSpanIdxs.clear();
      }
      refresh();
    });

    refresh();
    return { update() {} };
  },
};

// ================================================================
// 5. 历史 · L3 中国古代朝代时间尺与中外共时互证 (his-timeline)
// ================================================================
const DYN_TRACK = [
  ['夏(参考)', -2070, -1600, true],
  ['商', -1600, -1046, true],
  ['西周', -1046, -771, true],
  ['春秋战国', -770, -221, false],
  ['秦', -221, -207, false],
  ['汉', -202, 220, false],
  ['魏晋南北朝', 220, 589, false],
  ['隋', 581, 618, false],
  ['唐', 618, 907, false],
  ['五代十国', 907, 960, false],
  ['宋(与辽夏金并立)', 960, 1279, false],
  ['元', 1271, 1368, false],
  ['明', 1368, 1644, false],
  ['清', 1644, 1912, false],
];
const COEXISTING = [
  ['辽', 916, 1125],
  ['西夏', 1038, 1227],
  ['金', 1115, 1234],
];
const WORLD_TRACK = [
  [-776, '首届古代奥运会', '希腊城邦起步'],
  [-509, '罗马共和国建立', '秦汉↔罗马对照起点'],
  [-27, '罗马帝国建立（奥古斯都）', '西汉末期 · 秦汉↔罗马黄金期'],
  [476, '西罗马帝国灭亡', '中国南北朝时期'],
  [750, '阿拉伯阿拔斯王朝兴起', '唐朝天宝年间 · 百年翻译运动前夜'],
  [1215, '英国《大宪章》', '南宋嘉定年间 · 欧洲宪政前夜'],
  [1348, '意大利文艺复兴启幕', '元末明初之前夜'],
  [1492, '哥伦布大航海到达美洲', '明朝弘治五年（郑和后87年）'],
  [1689, '英国《权利法案》', '清康熙二十八年'],
  [1765, '珍妮纺纱机 · 工业革命', '清乾隆三十年 · 中西分流节点'],
  [1789, '法国大革命', '清乾隆五十四年'],
];
const CLUSTERS = [
  { name: '秦汉 ↔ 罗马', yr: -27, note: '前221秦统一、前202汉立 ↔ 前509罗马共和、前27罗马帝国，欧亚东西两大帝国盛世同期成型。' },
  { name: '唐宋 ↔ 阿拉伯/文艺复兴前夜', yr: 750, note: '618–907唐、960–1279宋 ↔ 阿拔斯阿拉伯黄金时代（750–1258）与14世纪文艺复兴前夜。' },
  { name: '明清 ↔ 大航海/工业革命', yr: 1492, note: '1368–1644明（1405郑和）、1644–1912清 ↔ 1492大航海与1765工业革命，世界整体化加速。' },
  { name: '前841 共和元年', yr: -841, note: '西周共和元年（公元前841年）是《史记》确切按年连续纪年的起点；此前夏商及西周初年属考古断代参考区间。' },
];

const fmtYear = (y) => (y < 0 ? `公元前 ${-Math.round(y)} 年` : `公元 ${Math.round(y)} 年`);
const toAxis = (y) => (y < 0 ? y + 1 : y);
const toYear = (a) => (a <= 0 ? a - 1 : a);
const yearSpanNoZero = (y1, y2) => {
  const a = Math.min(y1, y2), b = Math.max(y1, y2);
  return b - a - (a < 0 && b > 0 ? 1 : 0);
};

export const timeline = {
  id: 'his-timeline',
  subject: 'his',
  title: '中国古代朝代时间尺与中外共时互证',
  en: 'Dynasty timeline without year zero & synchrony',
  lede: [
    '把四千年按真实年数比例摊开：秦统一虽影响两千年，在时间尺上却是一条细缝；魏晋南北朝的分裂时长超过了整个唐代，两宋则与辽、西夏、金长期并立。',
    '双轨时间尺将中国朝代与罗马、阿拉伯黄金时代、大航海及工业革命精确对齐（严格遵循“无公元 0 年”），并标明公元前 841 年之前早期断代的史料不确定性。',
  ],
  formula: '跨公元前后间隔 = |Y₁| + Y₂ − 1（无公元 0 年）',
  formulaNote: '公元前 1 年的次年即为公元 1 年；公元前 841 年（共和元年）为中国确切连续年表起点',
  terms: [
    ['无公元 0 年', '历史公历由公元前 1 年直接跨入公元 1 年；计算跨元间隔必须减 1（如前 202 年至 220 年为 421 年）'],
    ['断代不确定性', '公元前 841 年前无逐年文字编年，夏、商、西周初年主要采纳“夏商周断代工程”碳十四与金文参考区间'],
    ['中外共时性', '在相同时间坐标下对照“秦汉↔罗马”“唐宋↔阿拉伯/文艺复兴前夜”“明清↔大航海/工业革命”'],
  ],
  predict: {
    q: '公元前 202 年汉朝建立到公元 220 年东汉灭亡，历时多少年？（提示：中间没有公元 0 年）',
    options: ['422 年', '421 年（202 + 220 − 1）', '420 年'],
    answer: 1,
    why: '从公元前 202 年到公元前 1 年共经过 201 年，从公元前 1 年跨到公元 1 年计 1 年，再到公元 220 年共 219 年，合计 202 + 220 − 1 = 421 年！',
  },
  challenge: '依次点击“秦汉↔罗马”“唐宋↔阿拉伯/文艺复兴前夜”“明清↔大航海/工业革命”，并在实验台用跨元计算器核验任意两年代间隔！',
  fig: '双轨同步历史时间尺（后排：中国朝代与辽夏金并立；前排：欧亚世界地标）',
  hint: '左右拖动年份滑块或红杆游标，对照中外同步历史坐标与早期断代史料注记。',
  teach: {
    where: '统编版高中历史《中外历史纲要》（上/下）中国古代史时序梳理 · 学科核心素养“时空观念”与“史料实证”',
    ask: [
      '为什么说公元前 841 年（西周共和元年）是中国史学纪年的关键分水岭？在此之前历史学家如何推算年份？',
      '1405 年郑和下西洋与 1492 年哥伦布到达美洲仅隔 87 年，从双轨时间轴上看它们各处于怎样的时代背景？',
    ],
    simplify: '夏商西周早期采“夏商周断代工程”参考年代并显式标注学术争议区间；宋代并立政权单列辽、西夏、金副轨。',
  },
  controls: [
    { id: 'y', label: '历史年份', min: toAxis(-2070), max: 1912, step: 1, value: -27, fmt: (a) => fmtYear(toYear(a)) },
    { id: 'c0', type: 'button', label: '秦汉↔罗马' },
    { id: 'c1', type: 'button', label: '唐宋↔阿拉伯' },
    { id: 'c2', type: 'button', label: '明清↔大航海' },
    { id: 'c3', type: 'button', label: '前841 共和元年' },
  ],
  inquiry: {
    note: '依托双轨比例尺与史料可信度注释，形成长时段时空观念：',
    steps: [
      { key: 'evidence', label: '纪年精度与史料分界', prompt: '记录公元前 841 年前后中国古史纪年的依据差异，并说明为何夏商年代标为“参考区间”：', hints: ['前841年《史记·十二诸侯年表》始有逐年编年', '夏商西周早期靠甲骨卜辞、金文历日与碳十四测年互证，尚存学术微调空间'] },
      { key: 'analysis', label: '中外共时对照分析', prompt: '任选“秦汉↔罗马”“唐宋↔阿拉伯”“明清↔大航海/工业革命”一组，比较两侧同世纪核心特征：', hints: ['关注政治制度、文化传播与经济技术动力的同步与分化'] },
      { key: 'reflection', label: '跨元间隔与时段尺度', prompt: '写出一个跨公元前后的真实历史时段计算式，并谈谈比例尺带给你的时间感触：', hints: ['公式：|Y1| + Y2 - 1，避免多算不存在的“公元0年”'] },
    ],
  },

  build(k) {
    const p = k.p;
    const Z = -1.65;
    const X = (y) => -4.55 + ((toAxis(y) + 2100) / 4040) * 9.1;
    k.root.add(at(box(9.4, 0.12, 1.5, C.shade), 0, 0, Z));

    DYN_TRACK.forEach(([nm, a, b, uncertain], i) => {
      const nextA = i + 1 < DYN_TRACK.length ? DYN_TRACK[i + 1][1] : b;
      const w = Math.max(0.035, X(nextA) - X(a) - 0.015);
      const h = 0.45 + (i % 2) * 0.34;
      const cx = (X(a) + X(nextA)) / 2;
      const cols = ['#ffe6ad', '#cfe6ff', '#d6f0dc', '#e3dbff', '#ffd9c7'];
      k.root.add(at(box(w, h, 1.15, uncertain ? '#ece6d8' : cols[i % 5]), cx, 0.12, Z));
      const short = w < 0.52;
      const up = short ? (nm === '五代十国' ? 1.7 : 1.15) : nm.length > 4 ? 0.72 : 0.52;
      const shortNm = nm.startsWith('宋') ? '宋' : nm === '魏晋南北朝' ? '魏晋\n南北朝' : nm;
      k.root.add(at(note(shortNm, { size: 0.24, bold: !short }), cx, 0.12 + h + up, Z));
      if (short) k.root.add(wire([cx, 0.12 + h, Z], [cx, 0.12 + h + up - 0.22, Z], 0.012));
    });

    // 辽、西夏、金并立小条带
    COEXISTING.forEach(([nm, a, b], idx) => {
      const w = Math.max(0.04, X(b) - X(a));
      const cx = (X(a) + X(b)) / 2;
      k.root.add(at(box(w, 0.14, 0.3, '#f3c6b6'), cx, 0.12, Z + 0.76 + idx * 0.18));
    });
    k.root.add(at(note('辽/夏/金并立', { size: 0.2, lay: 'flat', color: '#a23a2c' }), X(1100), 0.03, Z + 1.32));

    // 世界轨道（前排）
    k.root.add(at(box(9.4, 0.06, 0.5, '#e8e0cf'), 0, 0, Z + 2.05));
    WORLD_TRACK.forEach(([y]) => {
      k.root.add(at(flat(new THREE.SphereGeometry(0.08, 12, 8), C.copper), X(y), 0.14, Z + 2.05));
    });
    k.root.add(at(note('欧亚/世界地标', { size: 0.24, lay: 'flat', color: C.copper }), -3.85, 0.03, Z + 2.5));

    [-2000, -1000, 1, 1000].forEach((y) => {
      k.root.add(
        wire([X(y), 0.03, Z + 0.75], [X(y), 0.03, Z + 1.08]),
        at(note(y === 1 ? '公元元年(无0年)' : y < 0 ? `前${-y}` : `${y}`, { size: 0.22, lay: 'flat' }), X(y), 0.03, Z + 1.55),
      );
    });

    const pin = group(
      rod([0, 0, Z], [0, 2.55, Z + 2.05], 0.028, C.red),
      rod([0, 0, Z], [0, 2.55, Z], 0.025, C.red),
      at(flat(new THREE.SphereGeometry(0.12, 14, 10), C.red), 0, 2.6, Z + 1.0),
    );
    const info = at(card('\n\n', { w: 6.4, size: 0.26, align: 'left' }), 0.2, 0, 3.05);
    k.root.add(pin, info);

    let st = {};
    const updateAll = () => {
      const y = toYear(p.y ?? toAxis(-27));
      pin.position.set(X(y), 0, 0);
      let d = DYN_TRACK[0];
      for (const q of DYN_TRACK) if (y >= q[1]) d = q;
      const coex = COEXISTING.filter(([, a, b]) => y >= a && y <= b).map((x) => x[0]);
      const span = yearSpanNoZero(d[1], d[2]);
      let w = WORLD_TRACK[0];
      let bestDist = Infinity;
      for (const q of WORLD_TRACK) {
        const dist = Math.abs(yearSpanNoZero(q[0], y));
        if (q[0] <= y || dist < 120) {
          if (dist < bestDist) { bestDist = dist; w = q; }
        }
      }
      const uncertNote = y < -841 ? '⚠ 早于前841共和元年，采夏商周断代工程参考年代' : '✓ 属前841年之后确切文字编年时期';
      st = { y, d, coex, span, w, uncertNote };
      info.set(
        `${fmtYear(y)} · ${d[0]}${coex.length ? `（同期并立：${coex.join('、')}）` : ''} · 约${span}年\n`
        + `同期世界：${w[1]}（${fmtYear(w[0])}）— ${w[2]}\n`
        + `${uncertNote}`,
      );
    };

    let dragX0 = null, ax0 = 0;
    k.drag(pin, {
      start: (q) => { dragX0 = q.x; ax0 = p.y; },
      move: (q) => {
        if (dragX0 === null) return;
        const da = Math.round(((q.x - dragX0) / 9.1) * 4040);
        k.set('y', clamp(ax0 + da, toAxis(-2070), 1912));
        updateAll();
        k.dirty();
      },
      end: () => { dragX0 = null; },
    });

    updateAll();
    return {
      press(id) {
        const idx = +id.slice(1);
        if (CLUSTERS[idx]) { k.set('y', toAxis(CLUSTERS[idx].yr)); updateAll(); }
      },
      change() { updateAll(); },
      update() {},
      margin() {
        const y = st.y ?? toYear(p.y);
        const cen = y < 0 ? `公元前 ${Math.ceil(-y / 100)}` : `公元 ${Math.floor((y - 1) / 100) + 1}`;
        return [
          fmtYear(y),
          `${cen} 世纪（无公元0年）`,
          `中国：${st.d?.[0] || ''}`,
          st.coex?.length ? `并立：${st.coex.join('/')}` : '无并立小轨道',
          y < -841 ? '断代工程参考区间' : '确切连续编年',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 中外双轨共时性对照画布（点击或拖动指针对齐中外历史坐标）');
    const clusterRow = document.createElement('div');
    clusterRow.className = 'wb-btn-row';
    clusterRow.innerHTML = CLUSTERS.map((c, i) => `<button type="button" class="wb-btn" data-cl="${i}">${c.name}</button>`).join('');
    sec1.append(clusterRow);

    const syncCv = wb.canvas(sec1, 520, 220, (x, W, H) => {
      const padL = 24, padR = 24, pw = W - padL - padR;
      const sx = (y) => padL + ((toAxis(y) + 2100) / 4040) * pw;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      // 前841不确定性阴影区
      x.fillStyle = 'rgba(180,101,58,0.10)';
      x.fillRect(sx(-2070), 26, sx(-841) - sx(-2070), 74);
      x.fillStyle = '#a23a2c'; x.font = '10.5px "Noto Serif SC",serif';
      x.fillText('← 前841年之前：夏商周断代工程参考区间', sx(-2070) + 4, 20);

      // 中国轨道
      const cols = ['#ffe6ad', '#cfe6ff', '#d6f0dc', '#e3dbff', '#ffd9c7'];
      DYN_TRACK.forEach(([nm, a, b, unc], i) => {
        const nextA = i + 1 < DYN_TRACK.length ? DYN_TRACK[i + 1][1] : b;
        const x0 = sx(a), w = Math.max(2, sx(nextA) - x0 - 1);
        x.fillStyle = unc ? '#e9e1cf' : cols[i % 5];
        x.fillRect(x0, 32, w, 42);
        x.strokeStyle = '#1e2b36'; x.lineWidth = 0.8; x.strokeRect(x0, 32, w, 42);
        if (w > 18) {
          x.fillStyle = '#1e2b36'; x.font = '10px "Noto Serif SC",serif'; x.textAlign = 'center';
          x.fillText(nm.slice(0, 2), x0 + w / 2, 57);
        }
      });
      COEXISTING.forEach(([, a, b], idx) => {
        x.fillStyle = '#e5483f88';
        x.fillRect(sx(a), 76 + idx * 5, Math.max(2, sx(b) - sx(a)), 4);
      });

      // 世界轨道
      x.fillStyle = '#f2ede2'; x.fillRect(padL, 128, pw, 36);
      x.strokeStyle = '#b4653a'; x.strokeRect(padL, 128, pw, 36);
      WORLD_TRACK.forEach(([y, title], idx) => {
        const px = sx(y);
        x.fillStyle = '#b4653a';
        x.beginPath(); x.arc(px, 146, 4.5, 0, TAU); x.fill();
        if (idx % 2 === 0 || Math.abs(y - toYear(sp.params.y)) < 160) {
          x.fillStyle = '#51606b'; x.font = '10px "Noto Serif SC",serif'; x.textAlign = 'center';
          x.fillText(title.slice(0, 5), clamp(px, 38, W - 38), idx % 2 ? 182 : 122);
        }
      });

      // 无0年分界线
      x.strokeStyle = 'rgba(30,43,54,0.35)'; x.setLineDash([3, 3]);
      x.beginPath(); x.moveTo(sx(1), 24); x.lineTo(sx(1), H - 18); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#51606b'; x.font = '10px Georgia,serif'; x.textAlign = 'center';
      x.fillText('前1→公元1(无0年)', sx(1), H - 6);

      // 游标
      const curY = toYear(sp.params.y);
      const cx = sx(curY);
      x.strokeStyle = '#e5483f'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(cx, 20); x.lineTo(cx, H - 16); x.stroke();
    });

    const snapInfo = document.createElement('div');
    snapInfo.className = 'wb-stat';
    snapInfo.style.marginTop = '8px';
    sec1.append(snapInfo);

    const sec2 = wb.section('2 · 无“公元 0 年”跨元时间跨度计算器');
    const calcRow = document.createElement('div');
    calcRow.className = 'wb-row';
    calcRow.innerHTML = `
      <label class="wb-ctl">起始年(负为前)<input class="wb-input" type="number" id="hy1" value="-202" style="width:90px"></label>
      <label class="wb-ctl">结束年(负为前)<input class="wb-input" type="number" id="hy2" value="220" style="width:90px"></label>
      <button type="button" class="wb-btn" data-span="-221,1912">秦统一→辛亥</button>
      <button type="button" class="wb-btn" data-span="-1,1">前1年→公元1年</button>
      <span class="wb-stat" id="hSpanOut" style="flex:1"></span>`;
    sec2.append(calcRow);

    const updateSpan = () => {
      const y1 = parseInt(calcRow.querySelector('#hy1').value, 10) || 1;
      const y2 = parseInt(calcRow.querySelector('#hy2').value, 10) || 1;
      const span = yearSpanNoZero(y1, y2);
      const crosses = (y1 < 0 && y2 > 0) || (y2 < 0 && y1 > 0);
      calcRow.querySelector('#hSpanOut').innerHTML = `<b>间隔：${span} 年</b> ${crosses ? '（跨越前1→公元1，已自动减去不存在的公元0年）' : '（同侧相减）'}`;
    };

    const refresh = () => {
      syncCv.redraw();
      const y = toYear(sp.params.y);
      let d = DYN_TRACK[0];
      for (const q of DYN_TRACK) if (y >= q[1]) d = q;
      const coex = COEXISTING.filter(([, a, b]) => y >= a && y <= b).map((x) => x[0]);
      const near = WORLD_TRACK.reduce((best, q) => (Math.abs(q[0] - y) < Math.abs(best[0] - y) ? q : best), WORLD_TRACK[0]);
      const cl = CLUSTERS.find((c) => Math.abs(c.yr - y) < 180);
      snapInfo.innerHTML = `<b>${fmtYear(y)}</b> · 中国：<b>${d[0]}</b>${coex.length ? `（并立：${coex.join('、')}）` : ''}<br>最近世界坐标：<b>${near[1]}</b>（${fmtYear(near[0])}）— ${near[2]}${cl ? `<br><b>专题对照（${cl.name}）：</b>${cl.note}` : ''}`;
    };

    let dragging = false;
    const pickYear = (e) => {
      const pt = syncCv.toLocal(e);
      const ax = clamp(Math.round(((pt.x - 24) / (520 - 48)) * 4040 - 2100), toAxis(-2070), 1912);
      wb.setParam('y', ax);
      refresh();
    };
    syncCv.cv.addEventListener('pointerdown', (e) => { dragging = true; pickYear(e); });
    const onMove = (e) => { if (dragging) pickYear(e); };
    const onUp = () => { dragging = false; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    wb.onCleanup(() => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); });

    clusterRow.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      wb.setParam('y', toAxis(CLUSTERS[+btn.dataset.cl].yr));
      refresh();
    });
    calcRow.addEventListener('input', updateSpan);
    calcRow.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      const [a, b] = btn.dataset.span.split(',');
      calcRow.querySelector('#hy1').value = a;
      calcRow.querySelector('#hy2').value = b;
      updateSpan();
    });

    let lastKey = '';
    updateSpan();
    refresh();
    return {
      update() {
        const key = String(sp.params.y);
        if (key !== lastKey) { lastKey = key; refresh(); }
      },
    };
  },
};

// ================================================================
// 6. 历史 · L4 毕昇胶泥活字与雕版印刷技术经济临界点 (his-movable-type)
//    保留原版实现，仅将 proof 静止 y 高度从 0.88 提升至 1.12，避免切入字块
// ================================================================
const CHARS = ['庆', '历', '中', '有', '布', '衣', '毕', '昇', '又', '为', '活', '板'];

export const movableType = {
  id: 'his-movable-type',
  subject: 'his',
  title: '毕昇胶泥活字与雕版印刷的技术经济临界点',
  en: 'Bi Sheng clay movable type vs. woodblock printing economics',
  lede: [
    '沈括《梦溪笔谈》载：“庆历中有布衣毕昇，又为活板……若止印三二本，未为简易；若印数十百千本，则极为神速。”一句传世史料背后，藏着可被量化的工时模型与文化制度约束。',
    '拖动活字印块嵌入松脂铁范，翻转字模体会“反文阳文”镜像刻制原理，再用经济曲面测算“字海复用率”如何决定活字在汉文语境下的沉浮。',
  ],
  formula: 'T_活字 = N_异字 · t_刻 + M_卷 · L_字 · t_排 + M · N_印 · t_刷',
  formulaNote: '当印数 N_印 或丛书部数增多、常用字复用率上升时，T_活字 将跌破整版雕印成本 T_雕版（参考《梦溪笔谈·卷十八》）',
  terms: [
    ['反文阳文', '印模必须按左右镜像反刻凸起字面，蘸墨覆纸揭起后才得正面正向文字'],
    ['字频分布（Zipf）', '汉字数万但常用核心字约两三千；多卷本类书/丛书复用率高时活字省工最显著'],
    ['制度与经济张力', '相比拼音字母仅需二三十个字模，汉字活字初期备字盘庞大，令零星小批量印刷仍偏好雕版'],
  ],
  predict: {
    q: '沈括在《梦溪笔谈》明确指出“若止印三二本，未为简易；若印数十百千本，则极为神速”。从工时成本角度看原因是什么？',
    options: [
      '三二本时胶泥字块容易碎裂',
      '少量印数下，事前储备整套单字库、拣字与排版固定工时反而大于直接在一块整木板上刻完这几页',
      '泥活字墨汁需要印上百次才均匀',
    ],
    answer: 1,
    why: '雕版的固定刻版投入只和当期书页字数成正比；活字却需庞大的单字备字基建与反复检字排版时间，只有跨多书复印或大印量摊薄前，均摊工时才低于雕版！',
  },
  challenge: '调出“印 1 种书、印数 5 本”验证雕版更省时；随后增至“印 6 部文集、各 300 本”定位活字反超的临界印量！',
  fig: '铁范松脂底板、胶泥反文活字与对比整版雕版',
  hint: '拖滑块翻折对照“反文印模”与“正文字样”；打开工作台亲手把活字排入铁范并绘制二维技术经济临界边界。',
  teach: {
    where: '统编版高中历史《中外历史纲要（上）》辽宋夏金多民族政权的并立与元朝统一 · 宋元科技成就',
    ask: [
      '从一手史料互证视角看，除了沈括这位北宋士大夫的笔记外，还有哪些考古实物与元代王祯《造活字印书法》可作旁证？',
      '为什么欧洲古登堡 26 个拉丁字母金属活字一经发明便迅速取代抄写与雕版，而东亚在宋元明清仍长时间保持雕版为主、活字为辅的并存格局？',
    ],
    simplify: '技术经济工时模型以单字雕刻/排版/刷印参考分钟数作定量趋势演推（属历史比较推理模型，非实际工匠考勤日志）。',
    safety: '历史人文推演遵守一手史料与二手解释区分规范，严禁捏造未文献确认的具体工价数值。',
  },
  controls: [
    { id: 'books', label: '连续印制书目数 M', min: 1, max: 12, step: 1, value: 4, unit: '部' },
    { id: 'copies', label: '每部印数 N', min: 5, max: 500, step: 5, value: 120, unit: '本' },
    { id: 'overlap', label: '跨书字种复用率', min: 0.2, max: 0.9, step: 0.05, value: 0.65, unit: '' },
    { id: 'mirror', label: '观察字模正反', type: 'choice', options: ['反文阳文字模（待印）', '覆纸揭印成品（正文）'], value: 0 },
    { id: 'bStamp', label: '压印试样', type: 'button', action: 'stamp', text: '刷墨覆纸盖印' },
  ],
  inquiry: {
    note: '依据《梦溪笔谈》史料原句与成本定量模型，梳理技术条件如何制约历史选择：',
    steps: [
      { key: 'source', label: '一手史料定位', prompt: '记录沈括笔记对印量阈值的核心表述及其史料可信前提：', hints: ['《梦溪笔谈》属北宋同时代亲见亲闻之私家笔记', '“止印三二本，未为简易；数十百千本，极为神速”揭示了规模经济意识'] },
      { key: 'threshold', label: '临界点验证', prompt: '记下你在参数台测得的“活字反超雕版”最小书目数与印数组合：', hints: ['单书小印量(≤20本)下雕版仍占优势', '多部复用(≥3部且字频重叠>0.6)后胶泥活字工时骤降'] },
      { key: 'synthesis', label: '中西历史路径比较', prompt: '综合汉字字符集规模与技术经济因素，解释宋元后雕版为何长存：', hints: ['字母文字字符集 < 100 易一次铸齐', '汉字常用字数以千计且木版可随时小量重印补版'] },
    ],
  },

  build(k) {
    const p = k.p;
    // 铁范与松脂蜡底盘
    const plate = group(
      at(box(3.8, 0.16, 2.7, '#343b42', { kind: 'metal' }), 0, 0.08, -0.35),
      at(box(3.5, 0.06, 2.4, '#8b5a2b', { kind: 'wood' }), 0, 0.18, -0.35),
    );
    k.root.add(plate);

    // 12 枚胶泥活字块阵列 + 可覆压印纸张
    const blocks = [];
    for (let i = 0; i < CHARS.length; i++) {
      const r = Math.floor(i / 4), c = i % 4;
      const g = group(at(box(0.56, 0.32, 0.56, '#766f66', { kind: 'ceramic' }), 0, 0, 0));
      const glyph = sheet(0.48, 0.48, () => {}, { lay: 'flat' });
      glyph.position.y = 0.17;
      g.userData.glyph = glyph; g.userData.ch = CHARS[i];
      g.add(glyph);
      g.position.set(-1.08 + c * 0.72, 0.36, -1.0 + r * 0.68);
      blocks.push(g);
      k.root.add(g);
    }

    const proof = sheet(3.1, 2.1, () => {}, { lay: 'flat' });
    proof.position.set(0, 1.12, -0.35);
    k.root.add(proof, at(note('反文阳文字模 ↔ 正文覆印纸', { size: 0.22, w: 3.1 }), 0, 1.55, -1.6));

    let stampAnim = 0;
    const drawAll = () => {
      const flipped = p.mirror === 0;
      for (const b of blocks) {
        b.userData.glyph.redraw((x, s, w, h) => {
          x.fillStyle = '#5f5951'; x.fillRect(0, 0, w * s, h * s);
          x.save();
          x.translate((w * s) / 2, (h * s) / 2);
          if (flipped) x.scale(-1, 1); // 活字模为左右镜像反刻
          x.fillStyle = '#e7dfd0'; x.font = `bold ${s * 0.34}px "Songti SC","Noto Serif CJK SC",serif`;
          x.textAlign = 'center'; x.textBaseline = 'middle';
          x.fillText(b.userData.ch, 0, 0);
          x.restore();
        });
      }
      const eco = solveMovableTypeEconomics(p.books ?? 4, p.copies ?? 120, 800, p.overlap ?? 0.65);
      proof.redraw((x, s, w, h) => {
        x.fillStyle = '#fbf6ea'; x.fillRect(0, 0, w * s, h * s);
        x.strokeStyle = C.ink; x.lineWidth = s * 0.025; x.strokeRect(0.06 * s, 0.06 * s, (w - 0.12) * s, (h - 0.12) * s);
        x.fillStyle = '#1e2b36'; x.font = `600 ${s * 0.20}px "Songti SC",serif`; x.textBaseline = 'top';
        x.fillText('庆历中有布衣毕昇', 0.22 * s, 0.22 * s);
        x.fillText('又为活板 · 试印张', 0.22 * s, 0.56 * s);
        x.fillStyle = eco.movableFaster ? '#1f4a3e' : '#a23a2c';
        x.font = `${s * 0.14}px "Songti SC",serif`;
        x.fillText(`雕版 ${Math.round(eco.woodTime)} 分 vs 活字 ${Math.round(eco.movableTime)} 分`, 0.22 * s, 1.15 * s);
        x.fillText(eco.movableFaster ? '结论：活字已更神速！' : '结论：雕版尚更省工', 0.22 * s, 1.50 * s);
      });
    };

    k.drag(proof, {
      start: () => { stampAnim = 1.0; k.dirty(); },
      move: () => {},
      end: () => {},
    });

    drawAll();
    return {
      press(id) {
        if (id === 'stamp' || id === 'bStamp') { stampAnim = 1.0; k.set('mirror', 1); drawAll(); k.dirty(); }
      },
      change() { drawAll(); k.dirty(); },
      update(dt) {
        if (stampAnim > 0) {
          stampAnim = Math.max(0, stampAnim - dt * 1.4);
          proof.position.y = 1.12 + Math.abs(Math.sin(stampAnim * Math.PI)) * 0.65;
          k.dirty();
        } else {
          proof.position.y = p.mirror === 1 ? 1.12 : 1.32;
        }
      },
      margin() {
        const eco = solveMovableTypeEconomics(p.books ?? 4, p.copies ?? 120, 800, p.overlap ?? 0.65);
        return [
          `书目 ${p.books} 部 × ${p.copies} 本`,
          `需刻活字数 ≈ ${eco.totalUniqueCarved}`,
          `雕版总工时 ${Math.round(eco.woodTime)} min`,
          `活字总工时 ${Math.round(eco.movableTime)} min`,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 《梦溪笔谈》印量临界边界与技术经济对比曲面');
    const ecoCv = wb.canvas(sec1, 520, 230, (x, W, H) => {
      const p = sp.params, books = p.books ?? 4, overlap = p.overlap ?? 0.65, curCopies = p.copies ?? 120;
      const pad = { l: 56, r: 22, t: 22, b: 36 }, pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const maxT = Math.max(2500, books * 450);
      const sx = (c) => pad.l + (c / 500) * pw;
      const sy = (t) => pad.t + ph - Math.min(1, t / maxT) * ph;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();
      x.fillStyle = '#51606b'; x.font = '11px Georgia,serif'; x.textAlign = 'center';
      for (let c = 0; c <= 500; c += 100) x.fillText(`${c}本`, sx(c), H - 17);
      x.fillText(`各部书印数 N（当前 ${books} 部书 · 复用率 ${(overlap * 100).toFixed(0)}%）`, pad.l + pw / 2, H - 5);

      for (const isMov of [false, true]) {
        x.strokeStyle = isMov ? '#1f4a3e' : '#b4653a';
        x.lineWidth = 2.2;
        x.beginPath();
        for (let i = 0; i <= 100; i++) {
          const cp = (i / 100) * 500;
          const e = solveMovableTypeEconomics(books, cp, 800, overlap);
          const tv = isMov ? e.movableTime : e.woodTime;
          if (i === 0) x.moveTo(sx(cp), sy(tv)); else x.lineTo(sx(cp), sy(tv));
        }
        x.stroke();
      }
      x.fillStyle = '#b4653a'; x.textAlign = 'left'; x.fillText('整版雕印 (T_雕版)', pad.l + 10, pad.t + 14);
      x.fillStyle = '#1f4a3e'; x.fillText('毕昇活字 (T_活字)', pad.l + 150, pad.t + 14);

      const cur = solveMovableTypeEconomics(books, curCopies, 800, overlap);
      x.strokeStyle = 'rgba(30,43,54,0.35)'; x.setLineDash([4, 3]);
      x.beginPath(); x.moveTo(sx(curCopies), pad.t); x.lineTo(sx(curCopies), pad.t + ph); x.stroke(); x.setLineDash([]);
      x.fillStyle = cur.movableFaster ? '#1f4a3e' : '#a23a2c';
      x.fillText(cur.movableFaster ? '此处活字胜出' : '此处雕版尚优', clamp(sx(curCopies) + 6, pad.l + 8, W - 110), pad.t + 32);
    });

    const sec2 = wb.section('2 · 铁范捡字排版与“反文镜像”体验格');
    let chosen = '庆历中有布衣毕昇'.split('');
    let showMirrored = true;
    const tray = document.createElement('div');
    tray.className = 'wb-btn-row';
    tray.innerHTML = `<button type="button" class="wb-btn primary" data-flip="1">切换：反文阳模 / 正文印页</button>`
      + CHARS.map((ch) => `<button type="button" class="wb-btn" data-ch="${ch}">+「${ch}」</button>`).join('');
    sec2.append(tray);
    const preview = document.createElement('div');
    preview.style.cssText = 'padding:14px;border:1px solid #d9cfb8;background:#fbf6ea;border-radius:6px;font-family:"Songti SC",serif;font-size:24px;letter-spacing:8px;text-align:center;';
    sec2.append(preview);

    const refresh = () => {
      ecoCv.redraw();
      preview.textContent = chosen.join(' ');
      preview.style.transform = showMirrored ? 'scaleX(-1)' : 'none';
      preview.style.color = showMirrored ? '#6b645c' : '#1e2b36';
      preview.title = showMirrored ? '活字块正面为左右反刻，须覆纸揭印方得正文' : '揭印后的正版书页视觉';
    };

    tray.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      if (btn.dataset.flip) showMirrored = !showMirrored;
      else if (btn.dataset.ch) { chosen = [...chosen.slice(-7), btn.dataset.ch]; }
      refresh();
    });

    let lastKey = '';
    refresh();
    return {
      update() {
        const key = `${sp.params.books}|${sp.params.copies}|${sp.params.overlap}`;
        if (key !== lastKey) { lastKey = key; refresh(); }
      },
    };
  },
};

// ================================================================
// 7. 思想政治 · L3 供求关系、均衡价格与政府限价沙盘 (pol-market)
// ================================================================
function computeSurplus(dDemand, dSupply, P, Q) {
  // Q_d(P) = 100 + dDemand - 10P => P_d(q) = (100 + dDemand - q) / 10
  // Q_s(P) = 12P - 20 + dSupply  => P_s(q) = (q + 20 - dSupply) / 12
  if (Q <= 0) return { cs: 0, ps: 0 };
  const pd0 = (100 + dDemand) / 10;
  const pdQ = (100 + dDemand - Q) / 10;
  const cs = Math.max(0, 0.5 * ((pd0 - P) + (pdQ - P)) * Q);

  // Supply curve starts at P_s(0) = max(0, (20 - dSupply)/12); if dSupply > 20, qs(0) = dSupply - 20
  const qFreeS = Math.max(0, dSupply - 20);
  const psAtQ = Math.max(0, (Q + 20 - dSupply) / 12);
  let ps = 0;
  if (Q <= qFreeS) {
    ps = P * Q;
  } else {
    const q1 = qFreeS;
    const q2 = Q - q1;
    const pStart = q1 > 0 ? 0 : Math.max(0, (20 - dSupply) / 12);
    ps = P * q1 + 0.5 * ((P - pStart) + (P - psAtQ)) * q2;
  }
  return { cs: Math.max(0, cs), ps: Math.max(0, ps) };
}

export const market = {
  id: 'pol-market',
  subject: 'pol',
  title: '供求关系、均衡价格与政府限价沙盘',
  en: 'Supply, demand, equilibrium & price controls',
  lede: [
    '价格太高，货堆在摊上卖不掉；价格太低，排队抢购却缺货。买卖双方自发讨价还价把价格推向均衡点 (Qe, Pe)，使市场出清且总福利最大化。',
    '一旦政府出台“最高限价（低于均衡）”或“最低保护价（高于均衡）”，市场就会产生短缺或过剩，并在供求图上切出一块“无谓损失三角形”。',
  ],
  formula: 'Q_d(P) = 100 + ΔD − 10P · Q_s(P) = 12P − 20 + ΔS',
  formulaNote: '教学示意线性局部均衡模型；短缺 = max(0, D−S)，过剩 = max(0, S−D)，总福利 = 消费者剩余 + 生产者剩余',
  terms: [
    ['均衡价格', '需求量恰好等于供给量（D = S）时的市场出清价格'],
    ['最高限价', '政府规定不得高于某上限的价格（有效限价低于 Pe），常导致供不应求的“短缺”'],
    ['无谓损失 (DWL)', '限价抑制有效交易量（Q < Qe）后，买卖双方白白损失掉的潜在总剩余面积'],
  ],
  predict: {
    q: '在均衡价格 5.45 元的某农产品市场，若政府强行规定“最高限价 4 元”，市场上会出现什么现象？',
    options: [
      '货堆在摊位卖不出去（过剩）',
      '想买的人多于商家愿供给的量（短缺），且成交量萎缩带来无谓损失',
      '成交量变大，所有人受益',
    ],
    answer: 1,
    why: '最高限价 4 元低于均衡价 5.45 元，买方需求上升而卖方供给下降，造成 D > S 的短缺；实际成交量受制于较低的供给量 S，产生无谓损失三角形。',
  },
  challenge: '分别测试“需求右移 +30”“供给左移 -20”，再打开实验台施加“最高限价 4 元”与“最低保护价 7 元”，对比无谓损失 DWL 的面积变化！',
  fig: '左：市场摊位（木箱=供给 S，人偶=需求 D） · 右：动态供求曲线与限价线',
  hint: '拖动需求与供给滑块或切换限价政策；在实验台精细调节限价线并定量测算 CS、PS 与 DWL。',
  teach: {
    where: '统编版思想政治 必修 2《经济与社会》· 第一单元：我国的社会主义市场经济体制（市场配置资源与更好发挥政府作用）',
    ask: [
      '“需求增加”和“供给减少”都会推高均衡价格 Pe，但二者对均衡成交量 Qe 的影响方向一样吗？',
      '既然最高限价会带来短缺和黑市风险，为什么战时或救灾期间仍有时采用限价＋定量配给？最低保护价（如粮食最低收购价）又需要配合什么政策？',
    ],
    simplify: '采用静态单商品线性供求模型作教学示意，未计入黑市溢价、库存补贴及跨期蛛网滞后；实验台显式标注教学假设边界。',
  },
  controls: [
    { id: 'd', label: '需求整体平移 ΔD', min: -30, max: 30, step: 1, value: 0 },
    { id: 's', label: '供给整体平移 ΔS', min: -30, max: 30, step: 1, value: 0 },
    { id: 'pol', type: 'choice', label: '价格政策', options: ['不干预', '最高限价 4 元', '最低保护价 7 元'], value: 0, wide: true },
  ],
  record: {
    note: '采集不同供求冲击与限价情景下的均衡价格、成交量、短缺/过剩量及无谓损失，导出对比。',
    pending: '调节滑块或在实验台点击“记录本组均衡数据”记入表格。',
    columns: [
      { key: 'policyName', label: '政策模式' },
      { key: 'pe', label: '均衡价 Pe', unit: '元', digits: 2 },
      { key: 'P', label: '实际价 P', unit: '元', digits: 2 },
      { key: 'Q', label: '成交量 Q', digits: 1 },
      { key: 'gap', label: '失衡(短缺+/过剩-)', digits: 1 },
      { key: 'dwl', label: '无谓损失 DWL', digits: 2, stat: true },
    ],
    sample: (inst, p) => {
      const cap = p.capPrice ?? 4, flr = p.floorPrice ?? 7;
      const eq = solveMarketEquilibrium(p.d ?? 0, p.s ?? 0, p.pol ?? 0, cap, flr);
      return {
        _kind: 'model',
        policyName: ['自由均衡', `最高限价(${cap}元)`, `最低保护价(${flr}元)`][p.pol ?? 0],
        pe: eq.pe, P: eq.P, Q: eq.Q, gap: eq.shortage - eq.surplus, dwl: eq.dwl,
      };
    },
    summary: (rows) => [
      ['记录组数', `${rows.length} 组`],
      ['最大无谓损失', `${Math.max(...rows.map((r) => Number(r.dwl) || 0)).toFixed(2)}`],
    ],
    errors: [
      '混淆“价格引起的需求量沿线变动”与“非价格因素（收入/偏好/成本）引起的整条曲线平移”。',
    ],
  },

  build(k) {
    const p = k.p;
    const Z = -0.4;
    const g = at(plot({ w: 4.35, h: 3.4, xr: [0, 110], yr: [0, 10], xl: '数量 Q', yl: '价格 P (元)' }), 2.25, 0, -2.5);
    k.root.add(
      g,
      at(box(4.2, 0.9, 1.4, C.wood), -2.3, 0, Z - 1.2),
      at(box(4.6, 0.1, 1.8, C.shade), -2.3, 2.5, Z - 1.2),
      rod([-4.4, 0, Z - 0.4], [-4.4, 2.5, Z - 0.4], 0.06),
      rod([-0.2, 0, Z - 0.4], [-0.2, 2.5, Z - 0.4], 0.06),
      rod([-4.4, 0, Z - 2], [-4.4, 2.5, Z - 2], 0.06),
      rod([-0.2, 0, Z - 2], [-0.2, 2.5, Z - 2], 0.06),
    );
    const crates = Array.from({ length: 10 }, (_, i) => at(box(0.7, 0.5, 0.6, '#ffd9a8'), -3.9 + (i % 5) * 0.8, 0.9 + Math.floor(i / 5) * 0.5, Z - 1.2));
    const people = Array.from({ length: 10 }, (_, i) => at(group(cone(0.24, 0.75, '#cfe6ff'), at(ball(0.17, '#ffe7cf'), 0, 0.9, 0)), -4.0 + (i % 5) * 0.85, 0, Z + 0.7 + Math.floor(i / 5) * 0.85));
    const tagC = at(card('5.45 元', { size: 0.38, bold: true, w: 2.1 }), -2.3, 0.9, Z - 0.45);
    const info = at(card('\n\n', { w: 4.5, size: 0.27, align: 'left' }), 2.3, 0, 2.95);
    k.root.add(...crates, ...people, tagC, info);

    let last = '';
    let st = {};
    const updateAll = () => {
      const dD = p.d ?? 0, dS = p.s ?? 0, pol = p.pol ?? 0;
      const cap = p.capPrice ?? 4, flr = p.floorPrice ?? 7;
      const eq = solveMarketEquilibrium(dD, dS, pol, cap, flr);
      g.clear()
        .fn((q) => (100 + dD - q) / 10, C.blue, 0.045)
        .fn((q) => (q + 20 - dS) / 12, C.flame, 0.045)
        .text(8, 9.2, '需求 D', '#3b6fe0')
        .text(78, 9.2, '供给 S', '#d1552e');
      if (eq.P !== eq.pe) g.curve([[0, eq.P], [110, eq.P]], C.ink, 0.032, true);
      g.dot(eq.qe, eq.pe, C.amber, 0.09).done();

      crates.forEach((c, i) => { c.visible = i < Math.round(eq.S / 10); });
      people.forEach((c, i) => { c.visible = i < Math.round(eq.D / 10); });
      tagC.set(`${eq.P.toFixed(2)} 元`);
      st = eq;
      const status = eq.shortage > 0.5 ? `短缺 ${eq.shortage.toFixed(1)} · 无谓损失 ${eq.dwl.toFixed(1)}`
        : eq.surplus > 0.5 ? `过剩 ${eq.surplus.toFixed(1)} · 无谓损失 ${eq.dwl.toFixed(1)}` : '供求均衡出清';
      info.set(`价格 ${eq.P.toFixed(2)} 元 · 成交 ${eq.Q.toFixed(1)}\n想买 ${eq.D.toFixed(1)} · 想卖 ${eq.S.toFixed(1)}\n${status}`);
    };

    return {
      change() { updateAll(); },
      update() {
        const key = `${p.d}|${p.s}|${p.pol}|${p.capPrice}|${p.floorPrice}`;
        if (key !== last) { last = key; updateAll(); }
      },
      margin() {
        return [
          `均衡 Pe=${st.pe?.toFixed(2)}元 · Qe=${st.qe?.toFixed(1)}`,
          `实价 P=${st.P?.toFixed(2)}元 · 成交 Q=${st.Q?.toFixed(1)}`,
          st.shortage > 0.5 ? `短缺 ${st.shortage.toFixed(1)}` : st.surplus > 0.5 ? `过剩 ${st.surplus.toFixed(1)}` : '市场出清无积压',
          `无谓损失 DWL = ${(st.dwl || 0).toFixed(2)}`,
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 供求均衡、消费者/生产者剩余与无谓损失三角形定量分析台');
    const ctlRow = document.createElement('div');
    ctlRow.className = 'wb-row';
    ctlRow.innerHTML = `
      <label class="wb-ctl">最高限价<input type="range" id="wbCap" min="1.5" max="8.0" step="0.2" value="${sp.params.capPrice ?? 4}"><b id="wbCapV">${(sp.params.capPrice ?? 4).toFixed(1)}元</b></label>
      <label class="wb-ctl">最低保护价<input type="range" id="wbFlr" min="3.0" max="9.5" step="0.2" value="${sp.params.floorPrice ?? 7}"><b id="wbFlrV">${(sp.params.floorPrice ?? 7).toFixed(1)}元</b></label>
      <button type="button" class="wb-btn" data-pol="0">自由均衡</button>
      <button type="button" class="wb-btn" data-pol="1">启用最高限价</button>
      <button type="button" class="wb-btn" data-pol="2">启用最低保护价</button>
      <button type="button" class="wb-btn primary" data-rec="1">记录本组均衡数据</button>`;
    sec1.append(ctlRow);

    const sdCv = wb.canvas(sec1, 520, 260, (x, W, H) => {
      const p = sp.params;
      const dD = p.d ?? 0, dS = p.s ?? 0, pol = p.pol ?? 0;
      const cap = p.capPrice ?? 4, flr = p.floorPrice ?? 7;
      const eq = solveMarketEquilibrium(dD, dS, pol, cap, flr);

      const pad = { l: 48, r: 22, t: 22, b: 36 };
      const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
      const sx = (q) => pad.l + (clamp(q, 0, 120) / 120) * pw;
      const sy = (pr) => pad.t + ph - (clamp(pr, 0, 10.5) / 10.5) * ph;
      const pd = (q) => (100 + dD - q) / 10;
      const ps = (q) => (q + 20 - dS) / 12;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(30,43,54,0.1)'; x.lineWidth = 1;
      for (let q = 20; q <= 100; q += 20) { x.beginPath(); x.moveTo(sx(q), pad.t); x.lineTo(sx(q), pad.t + ph); x.stroke(); }
      for (let pr = 2; pr <= 10; pr += 2) { x.beginPath(); x.moveTo(pad.l, sy(pr)); x.lineTo(pad.l + pw, sy(pr)); x.stroke(); }

      // 消费者剩余 CS 阴影 (0..Q 之间在 P 之上、D 之下的多边形)
      if (eq.Q > 0) {
        x.fillStyle = 'rgba(59,111,224,0.18)';
        x.beginPath();
        x.moveTo(sx(0), sy(eq.P));
        x.lineTo(sx(0), sy(clamp(pd(0), 0, 10.5)));
        x.lineTo(sx(eq.Q), sy(clamp(pd(eq.Q), 0, 10.5)));
        x.lineTo(sx(eq.Q), sy(eq.P));
        x.closePath(); x.fill();

        // 生产者剩余 PS 阴影 (0..Q 之间在 S 之上、P 之下的多边形)
        const qFree = clamp(dS - 20, 0, eq.Q);
        x.fillStyle = 'rgba(47,180,106,0.20)';
        x.beginPath();
        x.moveTo(sx(0), sy(eq.P));
        x.lineTo(sx(0), sy(Math.max(0, ps(0))));
        if (qFree > 0) x.lineTo(sx(qFree), sy(0));
        x.lineTo(sx(eq.Q), sy(Math.max(0, ps(eq.Q))));
        x.lineTo(sx(eq.Q), sy(eq.P));
        x.closePath(); x.fill();
      }

      // 无谓损失三角形 DWL
      if (eq.dwl > 0.01 && eq.Q < eq.qe) {
        x.fillStyle = 'rgba(229,72,63,0.34)';
        x.beginPath();
        x.moveTo(sx(eq.Q), sy(pd(eq.Q)));
        x.lineTo(sx(eq.Q), sy(Math.max(0, ps(eq.Q))));
        x.lineTo(sx(eq.qe), sy(eq.pe));
        x.closePath(); x.fill();
        x.fillStyle = '#a2291c'; x.font = 'bold 11px "Noto Serif SC",serif';
        x.fillText('DWL', (sx(eq.Q) + sx(eq.qe)) / 2 - 12, sy(eq.pe) + 4);
      }

      // 坐标轴与供求直线
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.6;
      x.beginPath(); x.moveTo(pad.l, pad.t); x.lineTo(pad.l, pad.t + ph); x.lineTo(pad.l + pw, pad.t + ph); x.stroke();
      x.strokeStyle = '#3b6fe0'; x.lineWidth = 2.4;
      x.beginPath(); x.moveTo(sx(0), sy(pd(0))); x.lineTo(sx(100 + dD), sy(0)); x.stroke();
      x.strokeStyle = '#d1552e'; x.lineWidth = 2.4;
      const qS0 = Math.max(0, dS - 20);
      x.beginPath(); x.moveTo(sx(qS0), sy(Math.max(0, ps(qS0)))); x.lineTo(sx(120), sy(ps(120))); x.stroke();

      // 限价线与短缺/过剩标识
      if (pol !== 0) {
        const targetP = pol === 1 ? cap : flr;
        x.strokeStyle = '#1e2b36'; x.lineWidth = 1.6; x.setLineDash([6, 4]);
        x.beginPath(); x.moveTo(pad.l, sy(targetP)); x.lineTo(pad.l + pw, sy(targetP)); x.stroke(); x.setLineDash([]);
        x.fillStyle = '#1e2b36'; x.font = 'bold 11px "Noto Serif SC",serif'; x.textAlign = 'left';
        x.fillText(`${pol === 1 ? '最高限价' : '最低保护价'} ${targetP.toFixed(1)} 元`, pad.l + 8, sy(targetP) - 6);
        if (eq.shortage > 0.5 || eq.surplus > 0.5) {
          x.strokeStyle = '#e5483f'; x.lineWidth = 2.5;
          x.beginPath(); x.moveTo(sx(eq.S), sy(eq.P)); x.lineTo(sx(eq.D), sy(eq.P)); x.stroke();
          x.fillStyle = '#a2291c'; x.textAlign = 'center';
          x.fillText(eq.shortage > 0.5 ? `短缺 ${eq.shortage.toFixed(1)}` : `过剩 ${eq.surplus.toFixed(1)}`, (sx(eq.S) + sx(eq.D)) / 2, sy(eq.P) + 14);
        }
      }

      // 均衡点
      x.fillStyle = '#ffb52e'; x.strokeStyle = '#1e2b36'; x.lineWidth = 1.5;
      x.beginPath(); x.arc(sx(eq.qe), sy(eq.pe), 5.5, 0, TAU); x.fill(); x.stroke();

      x.fillStyle = '#51606b'; x.font = '11px Georgia,serif'; x.textAlign = 'center';
      for (let q = 0; q <= 120; q += 20) x.fillText(String(q), sx(q), H - 18);
      x.fillText('数量 Q（教学示意单位）', pad.l + pw / 2, H - 4);
      x.textAlign = 'right';
      for (let pr = 0; pr <= 10; pr += 2) x.fillText(String(pr), pad.l - 6, sy(pr) + 4);
      x.textAlign = 'left';
      x.fillStyle = '#3b6fe0'; x.fillText('蓝区 = 消费者剩余 CS', pad.l + 10, pad.t + 12);
      x.fillStyle = '#1f4a3e'; x.fillText('绿区 = 生产者剩余 PS', pad.l + 150, pad.t + 12);
      x.fillStyle = '#a2291c'; x.fillText('红三角 = 无谓损失 DWL', pad.l + 290, pad.t + 12);
    });

    const metricsEl = document.createElement('div');
    metricsEl.className = 'wb-metrics';
    const disclaimer = document.createElement('p');
    disclaimer.className = 'wb-muted';
    disclaimer.textContent = '教学示意声明：静态线性供求局部均衡模型，未计入黑市、预期与跨期动态蛛网滞后；金额与数量仅作机制演推。';
    sec1.append(metricsEl, disclaimer);

    const refresh = () => {
      const p = sp.params;
      const cap = p.capPrice ?? 4, flr = p.floorPrice ?? 7;
      const eq = solveMarketEquilibrium(p.d ?? 0, p.s ?? 0, p.pol ?? 0, cap, flr);
      const sur = computeSurplus(p.d ?? 0, p.s ?? 0, eq.P, eq.Q);
      const ed = eq.qe > 0 ? Math.abs((-10 * eq.pe) / eq.qe) : 0;
      const es = eq.qe > 0 ? Math.abs((12 * eq.pe) / eq.qe) : 0;

      ctlRow.querySelectorAll('[data-pol]').forEach((b) => b.classList.toggle('primary', +b.dataset.pol === (p.pol ?? 0)));
      ctlRow.querySelector('#wbCapV').textContent = `${cap.toFixed(1)}元`;
      ctlRow.querySelector('#wbFlrV').textContent = `${flr.toFixed(1)}元`;
      sdCv.redraw();

      metricsEl.innerHTML = [
        ['自由均衡 (Pe, Qe)', `${eq.pe.toFixed(2)} 元 · ${eq.qe.toFixed(1)}`],
        ['当前成交 (P, Q)', `${eq.P.toFixed(2)} 元 · ${eq.Q.toFixed(1)}`],
        ['短缺 / 过剩', eq.shortage > 0.5 ? `短缺 ${eq.shortage.toFixed(1)}` : eq.surplus > 0.5 ? `过剩 ${eq.surplus.toFixed(1)}` : '0（出清）'],
        ['消费者剩余 CS', sur.cs.toFixed(2)],
        ['生产者剩余 PS', sur.ps.toFixed(2)],
        ['无谓损失 DWL', `${eq.dwl.toFixed(2)}（弹性 |εd|=${ed.toFixed(2)}, εs=${es.toFixed(2)}）`],
      ].map(([k, v]) => `<div class="wb-m"><span>${k}</span><b>${v}</b></div>`).join('');
    };

    ctlRow.querySelector('#wbCap').addEventListener('input', (e) => {
      wb.setParam('capPrice', +e.target.value);
      refresh();
    });
    ctlRow.querySelector('#wbFlr').addEventListener('input', (e) => {
      wb.setParam('floorPrice', +e.target.value);
      refresh();
    });
    ctlRow.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      if (btn.dataset.pol !== undefined) { wb.setParam('pol', +btn.dataset.pol); refresh(); }
      else if (btn.dataset.rec) {
        const row = market.record.sample(sp.inst, sp.params);
        if (row) wb.record(row);
      }
    });

    let lastKey = '';
    refresh();
    return {
      update() {
        const key = `${sp.params.d}|${sp.params.s}|${sp.params.pol}|${sp.params.capPrice}|${sp.params.floorPrice}`;
        if (key !== lastKey) { lastKey = key; refresh(); }
      },
    };
  },
};

// ================================================================
// 8. 思想政治 · L3 收入分配、洛伦兹曲线与基尼系数探究 (pol-lorenz)
// ================================================================
export const lorenz = {
  id: 'pol-lorenz',
  subject: 'pol',
  title: '收入分配、洛伦兹曲线与基尼系数探究',
  en: 'Income distribution, Lorenz curve & Gini index',
  lede: [
    '把全体家庭按收入由低到高均分五等份：五摞金币等高是绝对平均；若最高 20% 拿走半数以上收入，洛伦兹曲线便会深深向下弯曲。',
    '市场初次分配体现效率与要素回报，政府通过税收、社保与转移支付进行的再分配则把曲线向上“拉直”，直接压低基尼系数 G = A / (A + B)。',
  ],
  formula: 'G = A / (A + B) = 1 − Σ_{i=1..5} 0.2(L_{i−1} + L_i)',
  formulaNote: 'A 为绝对平均对角线与洛伦兹曲线所夹面积；G=0 绝对平均，G=1 绝对不均，0.40 常作收入差距警戒线',
  terms: [
    ['初次分配', '在物质生产部门内，按劳动、资本、技术、管理等要素贡献进行的市场分配'],
    ['再分配', '政府通过个人所得税、社会保障与转移支付对收入格局的逆向调节'],
    ['基尼系数警戒线', '国际通常以 0.40 作为收入差距较大的警戒参照；我国国家统计局公开基尼系数近年在 0.46–0.47 区间（真实家户抽样统计）'],
  ],
  predict: {
    q: '在洛伦兹曲线图中，如果再分配税收与转移支付使低收入组占比提高、高收入组占比下降，面积 A 与基尼系数 G 会如何变化？',
    options: [
      '曲线远离对角线，A 变大，G 升高',
      '曲线向 45° 对角线贴近，A 变小，G 降低（分配更趋均衡）',
      'A 面积不变，只反映人均收入涨跌',
    ],
    answer: 1,
    why: '基尼系数衡量的是“相对分配均等度”。再分配把高收入部分向低收入转移后，累计收入百分比曲线向上贴近绝对平均线，阴影面积 A 缩小，G = A/(A+B) 下降。',
  },
  challenge: '把初次分配差距调到 0.90，试测需要多大的再分配力度，才能将五等份基尼系数从高位压低至 0.40 警戒线以下！',
  fig: '左：五等份收入金币柱（虚玻罩=初次分配，实柱=再分配后） · 右：洛伦兹曲线',
  hint: '先拉大初次分配差距，再调节再分配力度；打开工作台定量对比 A/B 面积与 0.40 警戒线。',
  teach: {
    where: '统编版思想政治 必修 2《经济与社会》· 第二单元：我国的个人收入分配与社会保障',
    ask: [
      '再分配力度过低会导致两极分化，但如果过度拉平（接近 G=0），可能对初次分配的劳动积极性与创新激励产生什么影响？',
      '为什么说除了初次分配和再分配，慈善公益等“第三次分配”也是共同富裕制度体系的补充？',
    ],
    simplify: '采用五等份幂律模拟收入分配与线性向均值回归的再分配调节（注：五等份梯形积分略低估按连续个体计算的真实基尼值）。',
  },
  controls: [
    { id: 'g', label: '初次分配市场差距', min: 0, max: 1, step: 0.02, value: 0.62 },
    { id: 't', label: '再分配调节力度', min: 0, max: 0.65, step: 0.02, value: 0.12 },
  ],
  record: {
    note: '记录不同市场分化度与税收转移力度组合下的初次基尼 G₀、再分配后 G₁ 及高低收入倍数。',
    pending: '调节滑块或在实验台点击“记录本组分配数据”归档。',
    columns: [
      { key: 'gParam', label: '分化参数 g', digits: 2 },
      { key: 'tParam', label: '再分配力度 t', digits: 2 },
      { key: 'g0', label: '初次基尼 G₀', digits: 3 },
      { key: 'g1', label: '再分配基尼 G₁', digits: 3, stat: true },
      { key: 'ratio', label: '最高/最低倍数', digits: 2 },
    ],
    sample: (inst, p) => {
      const res = solveLorenzGini(p.g ?? 0.62, p.t ?? 0.12);
      return {
        _kind: 'model',
        gParam: p.g ?? 0.62, tParam: p.t ?? 0.12,
        g0: res.giniPre, g1: res.giniPost, ratio: res.topToBottomRatio,
      };
    },
    summary: (rows) => [
      ['已采集方案数', `${rows.length} 组`],
      ['再分配后达标(<0.4)组数', `${rows.filter((r) => Number(r.g1) < 0.4).length} 组`],
    ],
    errors: [
      '将基尼系数（相对公平度）误解为社会总财富或人均收入绝对水平。',
    ],
  },

  build(k) {
    const p = k.p;
    const Z = -0.6, X0 = -4.0, DX = 1.04;
    k.root.add(at(box(5.5, 0.14, 1.5, C.shade), X0 + 2 * DX, 0, Z));
    const stacks = Array.from({ length: 5 }, (_, i) => ({
      c: at(cyl(0.4, 1, '#ffd76a'), X0 + i * DX, 0.14, Z),
      ghost: at(glass(new THREE.CylinderGeometry(0.43, 0.43, 1, 28, 1, true).translate(0, 0.5, 0)), X0 + i * DX, 0.14, Z),
      n: at(note('20%', { size: 0.28, w: 1.15, bold: true }), X0 + i * DX, 1, Z),
    }));
    ['最低20%', '较低', '中间', '较高', '最高20%'].forEach((s, i) => {
      k.root.add(at(note(s, { size: 0.24, lay: 'flat' }), X0 + i * DX, 0.03, Z + 1.15));
    });
    const gPlot = at(plot({ w: 4.25, h: 3.45, xr: [0, 100], yr: [0, 100], xl: '人口累计 %', yl: '收入累计 %' }), 2.35, 0, -2.55);
    const info = at(card('\n\n', { w: 4.5, size: 0.28, align: 'left' }), 2.35, 0, 2.95);
    k.root.add(...stacks.flatMap((s) => [s.c, s.ghost, s.n]), gPlot, info);

    const toPts = (sh) => {
      let acc = 0;
      return [[0, 0], ...sh.map((s, i) => [(i + 1) * 20, (acc += s) * 100])];
    };

    let last = '';
    let st = {};
    const updateAll = () => {
      const res = solveLorenzGini(p.g ?? 0.62, p.t ?? 0.12);
      stacks.forEach((s, i) => {
        s.c.scale.y = Math.max(0.03, res.post[i] * 7.2);
        s.ghost.scale.y = Math.max(0.03, res.pre[i] * 7.2);
        s.ghost.visible = (p.t ?? 0) > 0.005;
        s.n.position.y = 0.14 + Math.max(res.post[i], (p.t ?? 0) > 0 ? res.pre[i] : 0) * 7.2 + 0.38;
        s.n.set(`${(res.post[i] * 100).toFixed(0)}%`);
      });
      gPlot.clear()
        .curve([[0, 0], [100, 100]], 'rgba(30,43,54,.45)', 0.025, true)
        .curve(toPts(res.pre), '#b9b4a6', 0.035)
        .curve(toPts(res.post), res.giniPost >= 0.4 ? C.flame : C.green, 0.05)
        .text(8, 90, '45° 绝对平均线')
        .done();
      st = res;
      info.set(
        `再分配后基尼 G₁ = ${res.giniPost.toFixed(3)} ${res.giniPost >= 0.4 ? '（⚠ ≥0.4 警戒）' : '（✓ <0.4）'}\n`
        + `初次分配基尼 G₀ = ${res.giniPre.toFixed(3)}\n`
        + `最高20% / 最低20% ≈ ${res.topToBottomRatio.toFixed(1)} 倍`,
      );
    };

    return {
      change() { updateAll(); },
      update() {
        const key = `${p.g}|${p.t}`;
        if (key !== last) { last = key; updateAll(); }
      },
      margin() {
        return [
          `初次分配 G₀ = ${(st.giniPre ?? 0).toFixed(3)}`,
          `再分配后 G₁ = ${(st.giniPost ?? 0).toFixed(3)}`,
          `净降幅 ΔG = ${((st.giniPre ?? 0) - (st.giniPost ?? 0)).toFixed(3)}`,
          (st.giniPost ?? 0) >= 0.4 ? '高于 0.40 警戒线' : '低于 0.40 警戒线',
        ];
      },
    };
  },

  buildWorkbench(wb, sp) {
    const sec1 = wb.section('1 · 洛伦兹曲线与基尼面积 G = A / (A + B) 交互对比画布');
    const presetRow = document.createElement('div');
    presetRow.className = 'wb-btn-row';
    presetRow.innerHTML = `
      <button type="button" class="wb-btn" data-g="0.25" data-t="0.15">较均等分配</button>
      <button type="button" class="wb-btn" data-g="0.88" data-t="0.04">高市场分化 + 弱调节</button>
      <button type="button" class="wb-btn" data-g="0.88" data-t="0.42">高市场分化 + 强转移支付</button>
      <button type="button" class="wb-btn primary" data-rec="1">记录本组分配数据</button>`;
    sec1.append(presetRow);

    const lzCv = wb.canvas(sec1, 520, 265, (x, W, H) => {
      const res = solveLorenzGini(sp.params.g ?? 0.62, sp.params.t ?? 0.12);
      const pad = { l: 48, r: 220, t: 22, b: 36 };
      const size = Math.min(W - pad.l - pad.r, H - pad.t - pad.b);
      const sx = (pct) => pad.l + (pct / 100) * size;
      const sy = (pct) => pad.t + size - (pct / 100) * size;

      x.fillStyle = '#fffdf7'; x.fillRect(0, 0, W, H);

      const ptsPre = [[0, 0]];
      const ptsPost = [[0, 0]];
      let a0 = 0, a1 = 0;
      for (let i = 0; i < 5; i++) {
        a0 += res.pre[i] * 100;
        a1 += res.post[i] * 100;
        ptsPre.push([(i + 1) * 20, a0]);
        ptsPost.push([(i + 1) * 20, a1]);
      }

      // 区域 B（洛伦兹曲线下方）
      x.fillStyle = 'rgba(31,74,62,0.14)';
      x.beginPath();
      x.moveTo(sx(0), sy(0));
      ptsPost.forEach(([px, py]) => x.lineTo(sx(px), sy(py)));
      x.lineTo(sx(100), sy(0));
      x.closePath(); x.fill();

      // 区域 A（对角线与再分配后曲线之间）
      x.fillStyle = 'rgba(229,72,63,0.18)';
      x.beginPath();
      x.moveTo(sx(0), sy(0));
      x.lineTo(sx(100), sy(100));
      for (let i = ptsPost.length - 1; i >= 0; i--) x.lineTo(sx(ptsPost[i][0]), sy(ptsPost[i][1]));
      x.closePath(); x.fill();

      // 网格与方框
      x.strokeStyle = 'rgba(30,43,54,0.12)'; x.lineWidth = 1;
      for (let k = 20; k <= 80; k += 20) {
        x.beginPath(); x.moveTo(sx(k), sy(0)); x.lineTo(sx(k), sy(100)); x.stroke();
        x.beginPath(); x.moveTo(sx(0), sy(k)); x.lineTo(sx(100), sy(k)); x.stroke();
      }
      x.strokeStyle = '#1e2b36'; x.lineWidth = 1.6;
      x.strokeRect(sx(0), sy(100), size, size);

      // 45° 对角线
      x.strokeStyle = '#51606b'; x.setLineDash([5, 4]);
      x.beginPath(); x.moveTo(sx(0), sy(0)); x.lineTo(sx(100), sy(100)); x.stroke(); x.setLineDash([]);

      // 初次分配虚线曲线
      x.strokeStyle = '#9aa0a6'; x.lineWidth = 2; x.setLineDash([4, 3]);
      x.beginPath(); ptsPre.forEach(([px, py], i) => (i ? x.lineTo(sx(px), sy(py)) : x.moveTo(sx(px), sy(py)))); x.stroke();
      x.setLineDash([]);

      // 再分配后曲线
      x.strokeStyle = res.giniPost >= 0.4 ? '#d1552e' : '#1f4a3e';
      x.lineWidth = 2.6;
      x.beginPath(); ptsPost.forEach(([px, py], i) => (i ? x.lineTo(sx(px), sy(py)) : x.moveTo(sx(px), sy(py)))); x.stroke();
      ptsPost.slice(1).forEach(([px, py]) => {
        x.fillStyle = '#fffdf7'; x.strokeStyle = '#1e2b36'; x.lineWidth = 1.4;
        x.beginPath(); x.arc(sx(px), sy(py), 3.6, 0, TAU); x.fill(); x.stroke();
      });

      x.fillStyle = '#a2291c'; x.font = 'bold 12px Georgia,serif'; x.textAlign = 'center';
      x.fillText('A', sx(56), sy(36));
      x.fillStyle = '#1f4a3e';
      x.fillText('B', sx(78), sy(14));

      x.fillStyle = '#51606b'; x.font = '10.5px Georgia,serif';
      for (let k = 0; k <= 100; k += 20) {
        x.textAlign = 'center'; x.fillText(`${k}%`, sx(k), sy(0) + 15);
        x.textAlign = 'right'; x.fillText(`${k}%`, sx(0) - 6, sy(k) + 4);
      }
      x.textAlign = 'center'; x.fillText('累计人口百分比', sx(50), H - 5);

      // 右侧 0.4 警戒线与统计局参考区间仪表条
      const gx = pad.l + size + 36, gw = W - gx - 18;
      x.fillStyle = '#1e2b36'; x.font = 'bold 12px "Noto Serif SC",serif'; x.textAlign = 'left';
      x.fillText('基尼系数标尺 (0 ~ 1)', gx, 32);

      const barY = 58, barH = 18;
      x.fillStyle = '#ece6d8'; x.fillRect(gx, barY, gw, barH);
      x.fillStyle = 'rgba(229,72,63,0.18)'; x.fillRect(gx + gw * 0.4, barY, gw * 0.6, barH);
      // 国家统计局公开参考带 0.46-0.47
      x.fillStyle = 'rgba(59,111,224,0.38)'; x.fillRect(gx + gw * 0.46, barY - 3, Math.max(3, gw * 0.02), barH + 6);
      // 0.40 警戒线
      x.strokeStyle = '#e5483f'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(gx + gw * 0.4, barY - 6); x.lineTo(gx + gw * 0.4, barY + barH + 6); x.stroke();
      // G0 与 G1 标记
      x.fillStyle = '#7f868d'; x.beginPath(); x.arc(gx + gw * res.giniPre, barY + barH / 2, 5, 0, TAU); x.fill();
      x.fillStyle = res.giniPost >= 0.4 ? '#d1552e' : '#1f4a3e';
      x.beginPath(); x.arc(gx + gw * res.giniPost, barY + barH / 2, 6.5, 0, TAU); x.fill();

      x.fillStyle = '#a2291c'; x.font = '11px "Noto Serif SC",serif';
      x.fillText('0.40 国际警戒线', gx + gw * 0.34, barY + 34);
      x.fillStyle = '#3b6fe0';
      x.fillText('蓝带：公开统计参考区间(0.46–0.47)', gx, barY + 52);
      x.fillStyle = '#1e2b36';
      x.fillText(`灰点 初次 G₀ = ${res.giniPre.toFixed(3)}`, gx, barY + 84);
      x.fillStyle = res.giniPost >= 0.4 ? '#d1552e' : '#1f4a3e';
      x.font = 'bold 12px "Noto Serif SC",serif';
      x.fillText(`彩点 再分配 G₁ = ${res.giniPost.toFixed(3)}`, gx, barY + 104);
      x.fillStyle = '#51606b'; x.font = '11px "Noto Serif SC",serif';
      x.fillText(`高低组倍数：${res.topToBottomRatio.toFixed(2)} ×`, gx, barY + 126);
    });

    const quintileGrid = document.createElement('div');
    quintileGrid.className = 'wb-metrics';
    const methodNote = document.createElement('p');
    methodNote.className = 'wb-muted';
    methodNote.textContent = '方法说明：本模型基于五等份收入分组与梯形面积积分（连续微观抽样所得基尼系数通常会略高于五等份分组值）；蓝色对照带引自国家统计局公开居民收入基尼系数参考区间，仅作量级锚定。';
    sec1.append(quintileGrid, methodNote);

    const refresh = () => {
      lzCv.redraw();
      const res = solveLorenzGini(sp.params.g ?? 0.62, sp.params.t ?? 0.12);
      const labels = ['最低 20%', '次低 20%', '中间 20%', '次高 20%', '最高 20%'];
      quintileGrid.innerHTML = labels.map((lb, i) => {
        const diff = (res.post[i] - res.pre[i]) * 100;
        const sign = diff > 0.05 ? `+${diff.toFixed(1)}%` : diff < -0.05 ? `${diff.toFixed(1)}%` : '0.0%';
        return `<div class="wb-m"><span>${lb}（初次 ${(res.pre[i] * 100).toFixed(1)}%）</span><b>${(res.post[i] * 100).toFixed(1)}% (${sign})</b></div>`;
      }).join('')
        + `<div class="wb-m"><span>0.40 警戒评估</span><b>${res.giniPost >= 0.4 ? '⚠ 高于 0.40（需加强再分配）' : '✓ 已降至 0.40 以下'}</b></div>`;
    };

    presetRow.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      if (btn.dataset.g !== undefined) {
        wb.setParam('g', +btn.dataset.g);
        wb.setParam('t', +btn.dataset.t);
        refresh();
      } else if (btn.dataset.rec) {
        const row = lorenz.record.sample(sp.inst, sp.params);
        if (row) wb.record(row);
      }
    });

    let lastKey = '';
    refresh();
    return {
      update() {
        const key = `${sp.params.g}|${sp.params.t}`;
        if (key !== lastKey) { lastKey = key; refresh(); }
      },
    };
  },
};

export default [meter, syllogism, tense, sentence, timeline, movableType, market, lorenz];
