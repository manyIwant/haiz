/**
 * HAIZ Campus Toybox V2 — Canonical Character Asset Registry
 */

export const CHARACTER_REGISTRY = Object.freeze([
  {
    id: 'lanren-spirit',
    nameZh: '榄仁小芽',
    nameEn: 'Lanren Sprout',
    roleZh: 'HAIZ 核心吉祥物 · 植物精灵',
    personality: 'curious',
    personalityZh: '好奇爱探头',
    accentHex: '#4E8958',
    secondaryHex: '#C97B3A',
    storyZh: '诞生于府城校区榄仁树荫下的软绒小精灵，头顶双层秋绿榄仁叶贝雷帽，总爱歪着头观察路过的同学。',
    welcomeLineZh: '树荫下的风刚好，欢迎来到 HAIZ。',
    celebrationStyle: 'leaf-wiggle',
    scaleSpec: { height: 0.96, origin: 'bottom-center', upAxis: '+Y', forwardAxis: '+Z' }
  },
  {
    id: 'sunshine-duck',
    nameZh: '椰阳小黄鸭',
    nameEn: 'Cocosun Duck',
    roleZh: '海南阳光系 · 活泼收藏玩偶',
    personality: 'lively',
    personalityZh: '活泼爱扑腾',
    accentHex: '#F0BD3C',
    secondaryHex: '#E57444',
    storyZh: '戴着迷你草编遮阳帽的小黄鸭，蓬松奶油黄短绒里藏着海口午后的阳光，开心时会扑腾两只圆滚滚的小翅膀。',
    welcomeLineZh: '阳光满格，欢迎来到 HAIZ。',
    celebrationStyle: 'wing-hop',
    scaleSpec: { height: 0.92, origin: 'bottom-center', upAxis: '+Y', forwardAxis: '+Z' }
  },
  {
    id: 'campus-cat',
    nameZh: '校园橘猫',
    nameEn: 'Campus Marmalade',
    roleZh: '校园日常系 · 慵懒校猫',
    personality: 'cozy',
    personalityZh: '慵懒慢眨眼',
    accentHex: '#DD8B45',
    secondaryHex: '#3D6B53',
    storyZh: '常在教学楼台阶打盹的橘白胖猫，脖子上系着墨绿绒带与黄铜小铃铛，尾巴总是慢悠悠地画着弧线。',
    welcomeLineZh: '喵，午休刚醒，欢迎来到 HAIZ。',
    celebrationStyle: 'purr-stretch',
    scaleSpec: { height: 0.93, origin: 'bottom-center', upAxis: '+Y', forwardAxis: '+Z' }
  },
  {
    id: 'schoolbag-bear',
    nameZh: '书包小棕熊',
    nameEn: 'Satchel Bear',
    roleZh: '校园学生系 · 温柔伙伴',
    personality: 'gentle',
    personalityZh: '温柔有礼貌',
    accentHex: '#936549',
    secondaryHex: '#6EB4DC',
    storyZh: '穿着天蓝灯芯绒背心与白衬衫领口、背着赭橙色小书包的温柔棕熊，总把笔记本和校卡收得整整齐齐。',
    welcomeLineZh: '书包背好啦，欢迎来到 HAIZ。',
    celebrationStyle: 'polite-wave',
    scaleSpec: { height: 0.96, origin: 'bottom-center', upAxis: '+Y', forwardAxis: '+Z' }
  },
  {
    id: 'ocean-whale',
    nameZh: '潮汐小鲸',
    nameEn: 'Tide Whale',
    roleZh: '海南海洋系 · 梦幻海风角色',
    personality: 'dreamy',
    personalityZh: '轻盈爱摆尾',
    accentHex: '#558EB5',
    secondaryHex: '#EFE6D5',
    storyZh: '来自琼州海峡微风里的蓝灰绒毛小鲸，奶白灯芯绒肚皮软乎乎的，头顶常年顶着一颗温润的珍珠水滴。',
    welcomeLineZh: '海风吹过来啦，欢迎来到 HAIZ。',
    celebrationStyle: 'flipper-dance',
    scaleSpec: { height: 0.86, origin: 'bottom-center', upAxis: '+Y', forwardAxis: '+Z' }
  },
  {
    id: 'hainan-fawn',
    nameZh: '坡鹿小团',
    nameEn: 'Hainan Fawn',
    roleZh: '海南自然系 · 灵动坡鹿',
    personality: 'shy',
    personalityZh: '灵动爱动耳',
    accentHex: '#BF8157',
    secondaryHex: '#B64E3E',
    storyZh: '以海南坡鹿为灵感的可爱小团子，后背点缀奶白梅花斑，围着一条赤陶与靛蓝织纹小围巾，耳朵会随着声音轻轻抖动。',
    welcomeLineZh: '找到你啦，欢迎来到 HAIZ。',
    celebrationStyle: 'ear-hop',
    scaleSpec: { height: 0.95, origin: 'bottom-center', upAxis: '+Y', forwardAxis: '+Z' }
  }
]);

const _customCharacters = new Map();

export function registerCharacter(descriptor, builderFn) {
  if (!descriptor || !descriptor.id || typeof builderFn !== 'function') {
    throw new Error('registerCharacter requires descriptor { id, nameZh, ... } and builderFn.');
  }
  _customCharacters.set(descriptor.id, { descriptor, builderFn });
}

export function getAllCharacters() {
  const custom = Array.from(_customCharacters.values()).map((v) => v.descriptor);
  return [...CHARACTER_REGISTRY, ...custom];
}

export function getCharacterMeta(id) {
  if (_customCharacters.has(id)) return _customCharacters.get(id).descriptor;
  return CHARACTER_REGISTRY.find((c) => c.id === id) || null;
}

export function getCustomCharacterBuilder(id) {
  const entry = _customCharacters.get(id);
  return entry ? entry.builderFn : null;
}
