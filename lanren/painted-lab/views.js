// The lab's test shots. DESIGN.md asks visual work to be judged on fresh screenshots of Fengqitang,
// the library and a teaching block; the lab adds the tree (the project's anchor) and a high
// three-quarter view where spatial depth — near, middle and far planes — is the subject.
// Positions are campus metres in the shared frame (lanren/map/geo.js, ground at y = −0.85); each
// view is relative to the feature it studies, so it follows the data if the data moves.
const EYE = 1.65;

export const VIEWS = [
  { id: 'lanshu', label: '榄仁树', note: '近景树冠与一号教学楼：交界色带、树荫里的冷色、立面的笔触',
    at: 'lanshu', pos: [22, 3.0, -26], look: [-6, 6.8, 6] },
  { id: 'yihao', label: '教学楼', note: '一号教学楼立面：窗洞深度、楼层节奏、墙脚的反光与遮蔽',
    at: 'yihao', pos: [20, EYE + 0.4, -30], look: [-2, 7, 2] },
  { id: 'library', label: '图书馆', note: '图书馆南面的大台阶与弧形玻璃：大面墙的笔触尺度、玻璃与天空、树的剪影',
    at: 'library', pos: [-12, 3.0, -64.5], look: [0, 8.8, -9.5] },
  { id: 'fengqi', label: '凤栖亭', note: '凤栖亭与远处的教学楼：屋顶剪影、草地的近中远、亭下的阴影',
    at: 'fengqitang_ting', pos: [12.3, 2.05, -16], look: [0.3, 4.35, 0] },
  { id: 'aerial', label: '鸟瞰', note: '高处的三分之四视角：近、中、远三个空间层次与空气透视',
    at: 'lanshu', pos: [70, 48, -95], look: [-20, 0, 40] },
];

/** resolve a view to world positions using the campus features */
export function resolveView(v, geo) {
  const f = geo.features.find((x) => x.id === v.at) || { cx: 0, cz: 0 };
  const g = geo.frame.ground;
  return {
    pos: [f.cx + v.pos[0], g + v.pos[1], f.cz + v.pos[2]],
    target: [f.cx + v.look[0], g + v.look[1], f.cz + v.look[2]],
  };
}
