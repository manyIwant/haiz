// Builds lanren/canopy/demo/works.json: DEVELOPMENT SAMPLES for chapter 03.
//
// Every item is invented for development and marked `demo: true`; the authors are
// placeholders (演示作者 · 甲 …), not students. Images are renders of HAIZ's own digital
// tree (scripts/lanren/canopy-demo-media.cjs), the sound is synthesised by that script,
// and all texts were written for this preview. Nothing here may be shown as real
// student work, and the production canopy does not load this file (see source.js).
//
// Leaf addresses are handed out by the same allocation a server would use when a work is
// first made public (address.js allocate): in publication order, a relay next to its
// source when both are on the same limb.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSlots, allocate, format, fingerprint, ASSET } from '../../lanren/canopy/address.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const buf = fs.readFileSync(path.join(root, 'lanren/assets/rosettes.bin'));
const ros = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
const table = buildSlots(ros);

const A = (k, role = '主创') => ({ name: `演示作者 · ${k}`, role, demo: true });
const IMG = 'lanren/canopy/demo/media/';

// in the order they were "published"
const WORKS = [
  {
    id: 'demo-light-corridor', kind: 'work', direction: 'photo', twig: 'photo-series',
    title: '长廊的十二种光', summary: '同一条长廊，从早读到晚自习，每隔一节课拍一张。',
    published: '2026-10-12',
    contributors: [A('甲')],
    media: [
      { type: 'image', src: IMG + 'corridor-1.jpg', width: 1600, height: 1067, alt: '逆光的榄仁树新叶，叶脉清晰', caption: '第 2 节课后（演示占位：本站数字榄仁树的渲染）' },
      { type: 'image', src: IMG + 'corridor-2.jpg', width: 1600, height: 1067, alt: '树冠下的阴影与远处的亮天空', caption: '午休（演示占位：本站数字榄仁树的渲染）' },
      { type: 'image', src: IMG + 'corridor-3.jpg', width: 1067, height: 1600, alt: '仰望枝干，光从叶隙落下', caption: '第 7 节课前（演示占位：本站数字榄仁树的渲染）' }
    ],
    statement: '我原本想拍十二张一模一样的照片，结果光每一次都不同。最后只留下了三张：不是最好看的，是最不像的。',
    license: { relay: true, derive: '署名、注明原作即可回应或改编', note: '回应作品请保留原作链接' },
    picks: [{ issue: 1, title: '第 1 期 · 光从哪里来', note: '三张照片之间的空白和照片本身一样重要。' }],
    recommendations: [{ by: '演示同学 · 庚', reason: '第三张竖着拍的那张，我在那条长廊走了两年都没注意到。', at: '2026-10-20' }]
  },
  {
    id: 'demo-0207', kind: 'work', direction: 'photo',
    title: '午后两点零七分', summary: '一张照片，拍下了树叶最透明的那一分钟。',
    published: '2026-10-30',
    contributors: [A('乙')],
    media: [{ type: 'image', src: IMG + 'afternoon.jpg', width: 1600, height: 1067, alt: '阳光穿透一片新叶，叶缘发亮', caption: '14:07（演示占位：本站数字榄仁树的渲染）' }],
    statement: '我等了一个星期的晴天。',
    license: { relay: false, derive: '暂不接受改编', note: '' }
  },
  {
    id: 'demo-leaf-gap', kind: 'work', direction: 'words', twig: 'words-poem',
    title: '叶隙', summary: '一首回应《长廊的十二种光》的短诗。',
    published: '2026-10-22',
    contributors: [A('丙')],
    media: [{ type: 'text', body: '光不是从天上来的，\n是从叶子和叶子之间\n那一点点没有说完的地方。\n\n我在第七节课前抬头，\n看见一整个夏天\n在一片叶子背面\n慢慢地亮起来。\n\n——它没有告诉我答案，\n只是让我看见\n答案也会透光。' }],
    statement: '读完《长廊的十二种光》之后写的。照片里第三张竖着的那张，我一直觉得它像一个问句。',
    relations: [{ type: 'responds-to', work: 'demo-light-corridor', note: '经原作者授权的诗歌回应' }],
    license: { relay: true, derive: '可配乐、可朗读，请署名', note: '' },
    recommendations: [{ by: '演示同学 · 辛', reason: '“答案也会透光”这一句，我抄在了笔记本第一页。', at: '2026-10-26' }]
  },
  {
    id: 'demo-low-voice', kind: 'work', direction: 'sound', twig: 'sound-music',
    title: '叶间低音', summary: '把《叶隙》读出来，再给它一段很慢的配乐。两个人一起完成。',
    published: '2026-11-02',
    contributors: [A('丁', '作曲'), A('丙', '朗读与原诗')],
    media: [{ type: 'audio', src: IMG + 'low-voice.wav', duration: 14, caption: '演示用合成音频：一段由本站脚本生成的缓慢和声（无人声）' }],
    statement: '我们在琴房录了四次，最后用的是第一次。中间那个停顿是因为窗外有人经过。',
    relations: [{ type: 'derived-from', work: 'demo-leaf-gap', note: '原诗作者参与，共同完成' }],
    license: { relay: true, derive: '可用于影像配乐，请署名两位作者', note: '' },
    picks: [{ issue: 2, title: '第 2 期 · 接力', note: '一张照片长成一首诗，又长成一段声音。' }]
  },
  {
    id: 'demo-tenth-window', kind: 'work', direction: 'words', twig: 'words-prose',
    title: '第七节课的窗', summary: '一篇散文：关于一扇总是开着一半的窗。',
    published: '2026-10-28',
    contributors: [A('戊')],
    media: [{ type: 'text', body: '教室最后一排靠窗的位置，窗户总是开着一半。\n\n不是谁故意的。那扇窗的滑轨有一处凹痕，推到一半就卡住，再用力就会发出一种很难听的声音。于是大家都默认了这一半：冬天关不严，夏天开不全，风从那一道缝里进来，翻动最后一排的卷子。\n\n我坐在那里一整个学期。一开始我讨厌它，后来我发现，那一半的窗户正好框住了楼下榄仁树的一根枝条。春天它是空的，四月底忽然冒出一层红褐色的芽，五月就变成很亮的绿，亮到上课时会不小心看出神。\n\n有一次数学老师走到我旁边，顺着我的目光往外看了一会儿，什么也没说，回到讲台继续讲题。那天下课，我在草稿纸背面画了那根枝条。画得很差，但我留着。\n\n后来学校来人修好了滑轨。窗户可以完全打开，也可以完全关上了。我反而有点想念那一半。\n\n我想，大概很多东西都是这样：卡住的时候，才让人停下来看一会儿。' }],
    statement: '写给那扇窗，也写给每个坐在最后一排的人。',
    license: { relay: true, derive: '可朗读、可改编为短片，请署名', note: '' },
    recommendations: [{ by: '演示同学 · 壬', reason: '读到“我反而有点想念那一半”的时候，想起了我们班的饮水机。', at: '2026-11-03' }]
  },
  {
    id: 'demo-break-ten', kind: 'work', direction: 'sound', twig: 'sound-field',
    title: '课间十分钟', summary: '环境录音的构想与试录说明（演示中没有真实录音）。',
    published: '2026-11-05',
    contributors: [A('己')],
    media: [{ type: 'text', body: '计划：在同一个位置（榄仁树下的长椅）录下一个课间的完整十分钟——下课铃、脚步、远处的球声、风吹过叶子的声音，然后上课铃。\n\n演示说明：这里本应是一段真实的环境录音。为了不在开发预览中伪造校园声音，本条只保留文字说明。' }],
    statement: '想知道一棵树每天听到的是什么。',
    license: { relay: true, derive: '可作为影像的环境声', note: '' }
  },
  {
    id: 'demo-veins', kind: 'work', direction: 'image', twig: 'image-drawing',
    title: '逆光叶脉', summary: '对着窗户临摹一片新叶的叶脉。',
    published: '2026-10-18',
    contributors: [A('庚')],
    media: [{ type: 'image', src: IMG + 'veins.jpg', width: 1200, height: 1600, alt: '一片叶子的叶脉细节', caption: '演示占位图：本站叶片纹理的局部，不是手绘作品' }],
    statement: '叶脉不是对称的。画到第三遍才发现。',
    license: { relay: true, derive: '可作为设计素材，请署名', note: '' },
    picks: [{ issue: 1, title: '第 1 期 · 光从哪里来', note: '' }]
  },
  {
    id: 'demo-wayfinding', kind: 'project', direction: 'image', twig: 'image-type',
    title: '给校园写一套导视字', summary: '共创项目：为校园里的指示牌设计一套更好读的字和图标。正在找会画图标、会做调研的同学。',
    published: '2026-11-01',
    contributors: [A('辛', '发起'), A('壬', '调研')],
    project: { stage: '第 1 阶段 · 调研现有指示牌', seeking: ['图标设计', '实地拍摄', '可读性测试'], until: '2026-12-20', note: '这是演示项目，不代表学校委托或真实的导视更新计划。' },
    media: [{ type: 'text', body: '第一阶段我们先记录：现在的指示牌在哪里、写了什么、哪里容易看错。\n\n第二阶段做两到三套字形与图标草案，在同学中做可读性测试。\n\n第三阶段整理成一份提案。是否采用由学校决定，我们不假设任何结果。' }],
    license: { relay: true, derive: '项目内贡献按贡献记录署名', note: '' }
  },
  {
    id: 'demo-tree-year', kind: 'project', direction: 'photo', twig: 'photo-series',
    title: '一棵树的一年', summary: '共创项目：每月同一天、同一机位拍下榄仁树，接力十二个月。',
    published: '2026-10-25',
    contributors: [A('甲', '发起')],
    project: { stage: '第 2 个月', seeking: ['每月一位拍摄者'], until: '2027-09-30', note: '演示项目。' },
    media: [{ type: 'text', body: '机位：一号教学楼二楼走廊东端，第三根柱子旁。\n时间：每月 7 日下午第一节课后。\n\n接力规则：上一位拍完，把机位照片和参数交给下一位。完成后合成一组十二张的作品。' }],
    relations: [{ type: 'responds-to', work: 'demo-light-corridor', note: '同一位作者的延续' }],
    license: { relay: true, derive: '项目成员共同署名', note: '' }
  },
  {
    id: 'demo-one-day', kind: 'work', direction: 'code', twig: 'code-interactive',
    title: '数字榄仁树的一天', summary: '用代码把一天的日照角度变成叶片的颜色。',
    published: '2026-10-08',
    contributors: [A('癸')],
    media: [
      { type: 'image', src: IMG + 'one-day.jpg', width: 1600, height: 900, alt: '数字榄仁树在傍晚的光里', caption: '演示占位图：本站数字榄仁树的渲染' },
      { type: 'text', body: '每隔一小时计算一次海口的太阳高度角，映射到叶片的色温。代码与说明在作品页附件中（演示中未附）。' }
    ],
    statement: '我想让一棵假的树，至少在光线上说真话。',
    license: { relay: true, derive: '代码可复用，请署名', note: '' },
    recommendations: [{ by: '演示同学 · 甲', reason: '“至少在光线上说真话”，好喜欢。', at: '2026-10-15' }]
  },
  {
    id: 'demo-margin', kind: 'work', direction: 'words', twig: 'words-poem',
    title: '页边', summary: '写在物理练习册页边的三行。',
    published: '2026-11-06',
    contributors: [A('乙')],
    media: [{ type: 'text', body: '受力分析画到一半，\n窗外一片叶子落下来——\n它没有画出任何一个力。' }],
    license: { relay: true, derive: '可转载，请署名', note: '' }
  }
];

// publication order (by date) decides who receives a slot first
const reserved = new Map();   // direction → Set(slot)
const leafOf = new Map();
for (const w of [...WORKS].sort((a, b) => a.published.localeCompare(b.published))) {
  const taken = reserved.get(w.direction) || new Set();
  const src = (w.relations || []).map((r) => WORKS.find((x) => x.id === r.work)).find((x) => x && x.direction === w.direction && leafOf.has(x.id));
  const slot = allocate(w.direction, taken, table, ros, { near: src ? leafOf.get(src.id) : null });
  taken.add(slot);
  reserved.set(w.direction, taken);
  w.address = format(w.direction, slot);
  leafOf.set(w.id, table.get(w.direction)[slot]);
}

const out = {
  demo: true,
  notice: '开发演示：以下作品、作者、推荐与精选均为虚构，用于检验第三幕的空间与流程；不是真实学生作品，也不代表学校认可。图片为本站数字榄仁树的渲染或纹理，音频为脚本合成。',
  asset: ASSET,
  slotFingerprint: fingerprint(table),
  works: WORKS.map((w) => ({ state: 'public', demo: true, ...w }))
};
fs.writeFileSync(path.join(root, 'lanren/canopy/demo/works.json'), JSON.stringify(out, null, 1) + '\n');
console.log('demo works', out.works.length, out.works.map((w) => w.id + '→' + w.address).join('  '));
