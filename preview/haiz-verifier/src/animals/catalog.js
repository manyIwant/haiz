// HAIZ 动物验证码 · 六款动物玩偶目录与协议映射
// 保留 haiz-campus-toybox-original 协议层的稳定 characterId，客户端映射到六款高辨识度动物玩偶。
// 同时兼容直接使用动物 id（duck / panda / fox / frog / pig / elephant）。

export const ANIMALS = Object.freeze([
  {
    id: 'duck',
    protocolId: 'wuwu',
    name: '黄鸭子',
    emoji: '🐤',
    textColor: '#b97700',
    chipColor: '#ffd230',
    modelFile: 'duck.glb',
    visualHeight: 1.0,
    grabHeightRatio: 0.72,
    grabRadius: 0.28,
  },
  {
    id: 'panda',
    protocolId: 'changchang',
    name: '黑白熊猫',
    emoji: '🐼',
    textColor: '#252a28',
    chipColor: '#2c3033',
    modelFile: 'panda.glb',
    visualHeight: 1.02,
    grabHeightRatio: 0.74,
    grabRadius: 0.28,
  },
  {
    id: 'fox',
    protocolId: 'fantuan',
    name: '橙色狐狸',
    emoji: '🦊',
    textColor: '#d05315',
    chipColor: '#ef6e24',
    modelFile: 'fox.glb',
    visualHeight: 1.06,
    grabHeightRatio: 0.68,
    grabRadius: 0.28,
  },
  {
    id: 'frog',
    protocolId: 'lanren',
    name: '绿色青蛙',
    emoji: '🐸',
    textColor: '#277e3a',
    chipColor: '#58bf50',
    modelFile: 'frog.glb',
    visualHeight: 0.98,
    grabHeightRatio: 0.72,
    grabRadius: 0.28,
  },
  {
    id: 'pig',
    protocolId: 'zaozao',
    name: '粉色小猪',
    emoji: '🐷',
    textColor: '#cc4574',
    chipColor: '#ff96b3',
    modelFile: 'pig.glb',
    visualHeight: 1.0,
    grabHeightRatio: 0.73,
    grabRadius: 0.28,
  },
  {
    id: 'elephant',
    protocolId: 'chaochao',
    name: '浅蓝色大象',
    emoji: '🐘',
    textColor: '#2575ae',
    chipColor: '#74c0e8',
    modelFile: 'elephant.glb',
    visualHeight: 1.02,
    grabHeightRatio: 0.73,
    grabRadius: 0.29,
  },
]);

const BY_ID = new Map();
for (const a of ANIMALS) {
  BY_ID.set(a.id, a);
  BY_ID.set(a.protocolId, a);
}

/** 将协议 characterId（或动物 id）解析为动物元数据。 */
export function resolveAnimal(id) {
  return BY_ID.get(id) || ANIMALS[0];
}
