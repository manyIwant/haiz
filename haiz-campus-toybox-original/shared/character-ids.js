// Stable character identifiers. NEVER rename or reuse an id — add new ones at the end.
export const CHARACTER_IDS = Object.freeze(['lanren', 'wuwu', 'fantuan', 'zaozao', 'chaochao', 'changchang']);
export const CHARACTER_NAMES = Object.freeze({
  lanren: '仁仁',
  wuwu: '午午',
  fantuan: '饭团',
  zaozao: '早早',
  chaochao: '潮潮',
  changchang: '长长',
});
export const qualifiedId = (id) => `haiz.toy.${id}`;
