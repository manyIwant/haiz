// HAIZ Campus Toybox — authoritative Character Asset Registry (v1.0.0).
// Every character can be instantiated independently of the claw machine (e.g. in the Toybox
// gallery, a student's personal room, or the 3D campus) or exported to standard GLB/glTF.
import * as THREE from 'three';
import { CHARACTER_IDS, qualifiedId } from '../../shared/character-ids.js';
import * as lanren from './characters/lanren.js';
import * as wuwu from './characters/wuwu.js';
import * as fantuan from './characters/fantuan.js';
import * as zaozao from './characters/zaozao.js';
import * as chaochao from './characters/chaochao.js';
import * as changchang from './characters/changchang.js';

export const ASSET_SPEC = Object.freeze({
  registryVersion: '1.0.0',
  coordinateSystem: 'right-handed Y-up, +Z front, origin at centre of resting base (y = 0)',
  units: 'meters (1 unit = 1 m; tabletop plush scale ~0.14–0.18 m tall)',
  formats: ['procedural-js', 'glb'],
});

const MODULES = { lanren, wuwu, fantuan, zaozao, chaochao, changchang };

/**
 * Full character catalogue. Stable IDs match `shared/character-ids.js`.
 * Theme variants (`variants`) demonstrate extensible Campus Toybox appearances without
 * duplicating geometry.
 */
export const TOY_REGISTRY = Object.freeze([
  {
    id: 'lanren',
    qualifiedId: qualifiedId('lanren'),
    version: '1.0.0',
    name: '仁仁',
    enName: 'Lanren',
    title: '榄仁树精灵 · HAIZ 吉祥物',
    motif: '校园榄仁树 (Terminalia catappa)',
    badgeColor: '#5c9358',
    accentColor: '#d4603a',
    materialSummary: '压制羊毛毡 · 漆木枝干 · 手工锁边缝线 · 琉璃珠眼',
    personality: '好奇、认真、有点爱凑热闹；风一吹，头顶那片提前变红的叶子就会晃个不停。',
    story: '住在海南中学主干道最老的一棵榄仁树第二层枝桠上。每到旱季树叶转红，仁仁会悄悄把落叶夹进同学忘在石凳上的笔记本里当书签。',
    signatureLabel: '抖落雨滴',
    accessibleHint: '绿色杏仁果身体、头顶两层轮生榄仁叶（其中一片是红色）',
    modelPath: 'assets/models/lanren.glb',
    meta: lanren.meta,
    variants: {
      classic: { label: '经典原色', tint: null },
      autumn: { label: '旱季红叶', tint: { leaf: '#d4603a' } },
    },
  },
  {
    id: 'wuwu',
    qualifiedId: qualifiedId('wuwu'),
    version: '1.0.0',
    name: '午午',
    enName: 'Wuwu',
    title: '午后暖阳抱枕精',
    motif: '海南下午三点的阳光',
    badgeColor: '#e89b3c',
    accentColor: '#d45a3d',
    materialSummary: '短绒长毛绒 · 金盏花色毛毡光晕 · 编织草帽',
    personality: '慵懒、温和、慢半拍；呼吸很深很慢，一有空就伸大懒腰。',
    story: '诞生在教学楼走廊最暖和的那块水磨石光斑里。午休铃响前十分钟最容易遇见它，戴着歪歪的小草帽晒太阳，谁靠近都会觉得像刚晒过的棉被一样暖。',
    signatureLabel: '午后伸懒腰',
    accessibleHint: '圆滚滚的暖黄色小太阳抱枕、周围一圈花瓣光芒、戴着歪歪的小草帽',
    modelPath: 'assets/models/wuwu.glb',
    meta: wuwu.meta,
    variants: {
      classic: { label: '经典原色', tint: null },
      sunset: { label: '椰林晚霞', tint: { ray: '#e06d53' } },
    },
  },
  {
    id: 'fantuan',
    qualifiedId: qualifiedId('fantuan'),
    version: '1.0.0',
    name: '饭团',
    enName: 'Fantuan',
    title: '校猫三花小胖',
    motif: '校园常驻三花猫',
    badgeColor: '#c9753d',
    accentColor: '#c44536',
    materialSummary: '奶白/橘/炭黑拼色短绒 · 绯红毛毡项圈 · 磨砂黄铜铃铛',
    personality: '淡定、傲娇、自带校霸气场；尾巴慢悠悠扫来扫去，右耳有温柔的绝育小缺口。',
    story: '据说是全校最准时的生物——每到下课前三分钟就蹲在食堂台阶的树荫下。虽然嘴上从不讨食，但如果你把小鱼干放在旁边，它会赏脸发出很响的呼噜声。',
    signatureLabel: '端庄理毛',
    accessibleHint: '揣手趴坐的三花胖猫、颈间系着红绳与黄铜小铃铛、长尾巴卷在身侧',
    modelPath: 'assets/models/fantuan.glb',
    meta: fantuan.meta,
    variants: {
      classic: { label: '经典三花', tint: null },
      bellBlue: { label: '海风项圈', tint: { collar: '#3b7380' } },
    },
  },
  {
    id: 'zaozao',
    qualifiedId: qualifiedId('zaozao'),
    version: '1.0.0',
    name: '早早',
    enName: 'Zaozao',
    title: '背大书包的早读小生',
    motif: '海中校园学生与帆布书包',
    badgeColor: '#2d556b',
    accentColor: '#c94c38',
    materialSummary: '细织棉帆布制服与书包 · 黄铜圆框眼镜 · 漆木笔记本',
    personality: '元气、守时、有点过度准备；书包比身子还宽，总忍不住推一下眼镜。',
    story: '每天早上六点半准时出现在校门口。没人知道它那只巨大的墨绿色帆布书包里到底装了多少本错题集、铅笔盒和给同学带的薄荷糖。',
    signatureLabel: '认真推眼镜',
    accessibleHint: '穿海军领校服、戴黄铜圆框眼镜、背着一只超大墨绿帆布书包的小学生',
    modelPath: 'assets/models/zaozao.glb',
    meta: zaozao.meta,
    variants: {
      classic: { label: '经典校服', tint: null },
      summer: { label: '夏日白帆', tint: { bag: '#4a7c85' } },
    },
  },
  {
    id: 'chaochao',
    qualifiedId: qualifiedId('chaochao'),
    version: '1.0.0',
    name: '潮潮',
    enName: 'Chaochao',
    title: '潮汐海玻璃水母',
    motif: '海南海洋、潮汐与海玻璃',
    badgeColor: '#4da3a0',
    accentColor: '#f2c8b0',
    materialSummary: '磨砂海玻璃树脂伞盖 · 柔绒触手裙摆 · 陶瓷小海螺',
    personality: '轻盈、爱发呆、自带潮汐节律；走路像在水里漂浮，头顶顶着一枚捡来的小海螺。',
    story: '退潮时从海口假日海滩飘进校园水池的小水母。它能听见很远很远地方的海浪声，如果把耳朵凑近它头顶的小海螺，据说还能听见放暑假的预告。',
    signatureLabel: '潮汐浮游',
    accessibleHint: '半透明磨砂青色水母伞盖、头顶一枚粉色小海螺、六条飘逸触手裙摆',
    modelPath: 'assets/models/chaochao.glb',
    meta: chaochao.meta,
    variants: {
      classic: { label: '浅海海玻璃', tint: null },
      twilight: { label: '晚潮微光', tint: { bell: '#7d8cc4' } },
    },
  },
  {
    id: 'changchang',
    qualifiedId: qualifiedId('changchang'),
    version: '1.0.0',
    name: '长长',
    enName: 'Changchang',
    title: '海南长臂猿小玩偶',
    motif: '海南热带雨林旗舰物种 · 海南黑冠长臂猿',
    badgeColor: '#524e5e',
    accentColor: '#e45c4b',
    materialSummary: '深炭灰长毛绒 · 奶油毛毡面罩 · 手工珊瑚红扶桑花',
    personality: '爱玩、爱荡秋千、热情拥抱派；一双比身体还长的柔软长手臂随时准备向你挥手。',
    story: '从霸王岭热带雨林来校园做客的珍稀小朋友。它最喜欢挂在榄仁树枝和抓娃娃机的横梁上，耳后别着一朵在海南随处可见的珊瑚红扶桑花。',
    signatureLabel: '雨林长臂挥手',
    accessibleHint: '炭灰色长毛绒小猿、奶油色圆脸、耳后别着红扶桑花、一双超长手臂',
    modelPath: 'assets/models/changchang.glb',
    meta: changchang.meta,
    variants: {
      classic: { label: '雨林经典', tint: null },
      golden: { label: '晨雾金花', tint: { hibiscus: '#f2b84b' } },
    },
  },
]);

export const TOY_BY_ID = Object.freeze(Object.fromEntries(TOY_REGISTRY.map((t) => [t.id, t])));

/** Apply an optional theme tint to a built toy root without duplicating geometry. */
function applyVariant(root, entry, variantKey) {
  const v = entry.variants?.[variantKey];
  if (!v?.tint) return;
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const matName = obj.material.name || '';
    for (const [token, hex] of Object.entries(v.tint)) {
      if (matName.includes(token)) {
        obj.material = obj.material.clone();
        obj.material.color = new THREE.Color(hex);
      }
    }
  });
}

/**
 * Instantiate a standalone character with its rig, behaviour runtime and disposal helper.
 * @param {string} id Character ID from `CHARACTER_IDS`
 * @param {{ variant?: string, reducedMotion?: boolean, seed?: number }} [opts]
 */
export function createToy(id, opts = {}) {
  const mod = MODULES[id];
  const entry = TOY_BY_ID[id];
  if (!mod || !entry) throw new Error(`Unknown toy id: ${id}`);
  const rig = mod.build();
  if (opts.variant && opts.variant !== 'classic') applyVariant(rig.root, entry, opts.variant);
  rig.root.userData.toyId = id;
  rig.root.userData.qualifiedId = entry.qualifiedId;
  rig.root.userData.version = entry.version;
  const behavior = new mod.Behavior(rig, { reducedMotion: opts.reducedMotion, seed: opts.seed });

  return {
    id,
    qualifiedId: entry.qualifiedId,
    entry,
    rig,
    root: rig.root,
    behavior,
    dispose() {
      const geos = new Set(), mats = new Set();
      rig.root.traverse((o) => {
        if (o.geometry) geos.add(o.geometry);
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => mats.add(m));
          else mats.add(o.material);
        }
      });
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

export { CHARACTER_IDS };
