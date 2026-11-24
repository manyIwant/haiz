/**
 * HAIZ Human Verification — Modular Plushie Catalog
 * Extensible registry designed for future seasonal & campus-event editions.
 */

export const PLUSH_CATALOG = [
  {
    id: 'sunshine-duck',
    nameZh: '椰阳小黄鸭',
    nameEn: 'Sunshine Duck',
    series: 'haiz-classic',
    accentHex: '#F6C63B',
    secondaryHex: '#E8743B',
    descriptionZh: '戴着迷你草编遮阳帽的奶油绒毛小黄鸭',
    defaultSlot: { x: -0.42, y: -0.90, z: 0.28, rotY: 0.14, tiltZ: 0.03, scale: 1.04 }
  },
  {
    id: 'lanren-spirit',
    nameZh: '榄仁小芽',
    nameEn: 'Lanren Leaf Spirit',
    series: 'haiz-campus',
    accentHex: '#4E8F5B',
    secondaryHex: '#C97B3A',
    descriptionZh: '头戴榄仁叶贝雷帽、挂着橡果铃铛的校园小精灵',
    defaultSlot: { x: -1.16, y: -0.94, z: 0.06, rotY: 0.34, tiltZ: -0.06, scale: 0.96 }
  },
  {
    id: 'campus-cat',
    nameZh: '校园橘猫',
    nameEn: 'Campus Ginger Cat',
    series: 'haiz-campus',
    accentHex: '#E5974E',
    secondaryHex: '#F7EFE4',
    descriptionZh: '系着陶土色小铃铛项圈的蓬松橘白校猫',
    defaultSlot: { x: 0.56, y: -0.92, z: 0.22, rotY: -0.22, tiltZ: -0.04, scale: 1.0 }
  },
  {
    id: 'schoolbag-bear',
    nameZh: '书包小棕熊',
    nameEn: 'Schoolbag Bear',
    series: 'haiz-campus',
    accentHex: '#9C6F52',
    secondaryHex: '#7CC0E8',
    descriptionZh: '穿着天蓝领口针织背心、背着赭橙色小书包的小棕熊',
    defaultSlot: { x: 1.34, y: -0.88, z: -0.18, rotY: -0.36, tiltZ: 0.05, scale: 1.0 }
  },
  {
    id: 'ocean-whale',
    nameZh: '潮汐小鲸',
    nameEn: 'Tide Whale',
    series: 'hainan-coast',
    accentHex: '#639CC2',
    secondaryHex: '#EFE8DB',
    descriptionZh: '灯芯绒奶白肚皮、头顶珍珠水滴的南海小蓝鲸',
    defaultSlot: { x: 0.06, y: -0.96, z: -0.34, rotY: 0.08, tiltZ: 0.04, scale: 0.98 }
  },
  {
    id: 'hainan-fawn',
    nameZh: '坡鹿小团',
    nameEn: 'Hainan Fawn',
    series: 'hainan-nature',
    accentHex: '#C58A60',
    secondaryHex: '#B85042',
    descriptionZh: '围着织纹小围巾、点缀奶白梅花斑的海南小坡鹿',
    defaultSlot: { x: 1.68, y: -0.96, z: 0.30, rotY: -0.44, tiltZ: -0.05, scale: 0.94 }
  }
];

const _customPlushRegistry = new Map();

/**
 * Register a seasonal or campus-event plushie module at runtime.
 */
export function registerPlush(descriptor, builderFn) {
  if (!descriptor || !descriptor.id || typeof builderFn !== 'function') {
    throw new Error('registerPlush requires { id, nameZh, ... } and a builderFn(THREE, materialLib).');
  }
  _customPlushRegistry.set(descriptor.id, { descriptor, builderFn });
}

export function getRegisteredCustomPlushies() {
  return _customPlushRegistry;
}

export function getPlushById(id) {
  if (_customPlushRegistry.has(id)) {
    return _customPlushRegistry.get(id).descriptor;
  }
  return PLUSH_CATALOG.find((p) => p.id === id) || null;
}
