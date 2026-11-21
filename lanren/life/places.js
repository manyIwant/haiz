// HAIZ · 校园里的地方 — where people go: doors, spots to linger, shelters from the rain (pure data + helpers).
//
// World metres in the walk's frame (lanren/map/geo.js, rotation 0: the 百年榄仁树 at the origin, the
// North Gate toward -Z). Buildings come from assets/walk/campus.json; their interiors are not modelled
// (DESIGN.md), so a person "inside" stands at a door on the map and is not drawn in 3D. Door positions
// are an interpretation: the side of each building that faces the nearest surveyed path, never a
// courtyard closed in by other wings (tests/life/life.cjs checks every one is reachable from the tree).

export const PLACES = {
  yihao: { name: '一号教学楼', short: '一号楼', doors: [[-34.9, 3.2], [-34.9, 39.9], [-93.6, 24.5], [23.8, 24.5]] },
  erhao: { name: '二号教学楼', short: '二号楼', doors: [[-35.7, 58.7], [-35.7, 83.3]] },
  kexue: { name: '科学馆实验大楼', short: '科学馆', doors: [[-32.6, 94.9]] },
  sanhao: { name: '三号教学楼', short: '三号楼', doors: [[-63.6, 137.9]] },
  sihao: { name: '四号教学楼', short: '四号楼', doors: [[-63.7, 169.1]] },
  library: { name: '图书馆', short: '图书馆', doors: [[60, -25.4]] },
  canteen1: { name: '第一食堂', short: '一食堂', doors: [[125.7, 80.5], [152.9, 88.7]] },
  canteen3: { name: '第三食堂', short: '三食堂', doors: [[-186.1, 142.9]] },
  dorm_m: { name: '男生宿舍', short: '男生宿舍', doors: [[89.3, 38.1]] },
  dorm_f: { name: '女生宿舍', short: '女生宿舍', doors: [[-113.3, 115.2]] },
  keji: { name: '科技楼', short: '科技楼', doors: [[2.7, -57.5]] },
  yishu: { name: '艺术教育活动中心', short: '艺术中心', doors: [[-57.4, 181.2]] },
};

/** places to be outdoors: [x, z, facing yaw (three.js) or null, label] */
export const SPOTS = {
  // around the 百年榄仁树 (its islet is walkable ground): looking up into the crown
  tree_n: [-1.5, -8.2, 0.1, '榄仁树下'], tree_w: [-8.0, 2.0, 1.45, '榄仁树下'], tree_e: [7.6, -3.5, -1.2, '榄仁树下'], tree_s: [2.5, 8.0, 3.0, '榄仁树下'],
  pond_n: [9.5, 131.4, Math.PI, '砚池边'], pond_w: [-3.6, 140.5, Math.PI / 2, '砚池边'],
  garden_a: [-148, 176, -0.6, '植物园'], garden_b: [-165, 196, 0.9, '植物园'], garden_pond: [-172.7, 172.6, 0, '植物园水景'],
  fengqi_ting: [-74.3, -38.0, null, '凤栖亭'], yanlin_ting: [-11.1, -35.9, null, '衍林亭'],
  fengqi_lawn: [-58, -44, -2.2, '凤栖堂'], yanlin_lawn: [0, -46, 2.4, '衍林堂'],
  corr_w12: [-60.2, 47.8, 1.57, '一二号楼西连廊'],
  // under the eaves (the walls' foot, where the roof and the floors above keep the rain off)
  eave_yihao_n: [-12, 9.9, 3.14, '一号楼檐下'], eave_yihao_s: [-20, 39.6, 0, '一号楼檐下'], eave_erhao_n: [-50, 58.9, 3.14, '二号楼檐下'],
  eave_library: [48, -11.0, 3.14, '图书馆檐下'], eave_canteen1: [125.6, 84, 1.57, '一食堂檐下'], eave_kexue: [-48, 95.2, 3.14, '科学馆檐下'],
  court_a: [-128, 44, null, '篮球场'], court_b: [-146, 64, null, '篮球场'], court_edge: [-112.5, 54, -1.57, '篮球场边'],
  track_n: [-201, -100, null, '操场'], track_s: [-201, -17.5, null, '操场'], track_e: [-118.5, -58.8, null, '操场'], track_w: [-284, -58.8, null, '操场'],
  track_stand: [-160, -14.5, 3.14, '操场边'],
  beimen_in: [-35.6, -70.5, 3.14, '北门'], beimen_out: [-36.1, -90.5, 3.14, '北门外'],
  library_steps: [60, -29.5, 3.14, '图书馆门前'],
  canteen_lane: [95, 82, 1.57, '一食堂前'],
  lane_mid: [60, 66, null, '图书馆南侧'],
};

/** covered places (shelters from rain), with the place a person waits under */
export const SHELTERS = ['corr_w12', 'fengqi_ting', 'yanlin_ting', 'eave_yihao_n', 'eave_yihao_s', 'eave_erhao_n', 'eave_library', 'eave_canteen1', 'eave_kexue'];

/** where a person stands to be "at" a place: a door (inside) or a spot (outdoors) */
export function placePoint(key, i = 0) {
  if (PLACES[key]) { const d = PLACES[key].doors; const p = d[((i % d.length) + d.length) % d.length]; return { x: p[0], z: p[1], inside: true, place: key, label: PLACES[key].name }; }
  const s = SPOTS[key];
  if (!s) throw new Error('unknown place ' + key);
  return { x: s[0], z: s[1], yaw: s[2], inside: false, place: key, label: s[3] };
}

/** the door of a building nearest to (x, z) */
export function nearestDoor(key, x, z) {
  const d = PLACES[key].doors;
  let bi = 0, bd = Infinity;
  d.forEach((p, i) => { const dd = Math.hypot(p[0] - x, p[1] - z); if (dd < bd) { bd = dd; bi = i; } });
  return bi;
}

/** the label for a place key (building or spot) */
export const labelOf = (key) => PLACES[key]?.name || SPOTS[key]?.[3] || key;
