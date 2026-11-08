// How chapters 05 and 06 meet the campus: three compositions (pure data, Node-testable).
//
// The conflict (docs/HAIZ-WORLD-STAGE1-HANDOFF.md §9.1): with the campus laid under the
// tree as the data has it, V4's 05 view out of the crown meets 一号教学楼's north front
// 27 m away, and V4's 06 eye stands inside that building's footprint. The campus is dense
// round the tree (a building stands within 40 m in every direction), so no composition
// keeps both V4 shots *and* an open horizon; each gives something up:
//
//   b  (default) the campus turned 90° about the tree's root. Both V4 cameras are kept
//      exactly; 05 looks out of the crown over the north forecourt to 北门 and 科技楼 in
//      the sunset, 06 stands in the garden lane and looks back at the tree with 一号教学楼
//      behind it. What changes: the campus's bearing in V4's world (V4 had none: its
//      suns are art-directed per shot, campus "north" is unverified), so chapter 04's plan
//      is drawn with north to the left. The tree keeps its exact place on the campus.
//   a  the campus as the data lays it (north up in 04). 05 is V4 exactly with the campus
//      still beneath the water; it rises while the body drops to the ground; 06 is a new
//      eye in the north forecourt (V4's 06 eye is inside 一号教学楼), the sun moved with it.
//   c  V4's 05 and 06 kept exactly and the campus only after the walk begins. The film
//      ends where V4's 06 eye stands: inside 一号教学楼's footprint, so the walk cannot
//      start where the film ends. Kept as a demonstration; not recommended.
//
// Choose with ?compose=a|b|c (remembered for the session). Each composition is one
// rotation constant plus a few shot facts; plan, model, labels, picking and collision all
// follow from the same frame (lanren/map/geo.js makeFrame).

const D2R = Math.PI / 180;
export const EYE_H = 1.62;            // the blocky walker's eye above its feet (m)
export const GROUND_Y = -0.85;

export const COMPOSITIONS = {
  b: {
    id: 'b', title: 'B · 校园绕树转 90°', short: '保留 V4 第五、六幕两个机位；校园在第五幕已是立体',
    rotation: 90 * D2R,
    // the campus rises while the camera comes down from the map into the crown (04 → 05)
    rise: [3.08, 3.88],
    // 06: closer to the tree than V4's eye (21 m, on the line the evening shadow takes back to it), so the
    // crown is the picture and 一号教学楼 is its ground; the sun a little further round (320°, from 302° in 05)
    // rakes the facade instead of flooding it, and lays the walker's shadow straight towards the trunk
    shot6: { eye: [-14.85, GROUND_Y + EYE_H, 14.85], look: [0.6, 7.2, -0.2], fov: 54 },
    sun6: 320
  },
  a: {
    id: 'a', title: 'A · 落地后显现', short: '保留第四幕北朝上；第五幕无校园，跃下时校园升起；第六幕改在树北前庭回望',
    rotation: 0,
    rise: [4.18, 4.46],               // buildings rise while the walker stands on the limb; the ground is campus before the landing
    shot6: { eye: [7.0, GROUND_Y + EYE_H, -34.0], look: [-1.2, 6.9, 0.2], fov: 40 },
    sun6: 150                          // 06's evening sun, turned with the new view (163° from the gaze, behind the left shoulder, as in b)
  },
  c: {
    id: 'c', title: 'C · 漫游后才出现', short: '第五、六幕完全保持 V4；校园在交出控制权后才升起（06 落点在一号教学楼内，无法连续）',
    rotation: 0,
    rise: null,                        // only once the walk begins
    shot6: null,
    sun6: null
  }
};
// the stage-1 campus simply left standing into 05 and 06 (the conflict itself; for comparison only)
COMPOSITIONS.n = {
  id: 'n', title: '基线 · 第一阶段校园原样留到 05/06', short: '不做取舍：V4 机位 + 数据原方位的立体校园（第五幕视线撞上一号教学楼，第六幕机位在楼内）',
  rotation: 0, rise: [3.08, 3.88], shot6: null, sun6: null, hidden: true
};
export const DEFAULT = 'b';

/** the composition asked for (?compose=), or the one remembered for this tab, or the default */
export function pickComposition(search = '', storage = null) {
  const q = new URLSearchParams(search).get('compose');
  let id = q && COMPOSITIONS[q] ? q : null;
  if (!id && storage) { try { const s = storage.getItem('haiz.compose'); if (COMPOSITIONS[s]) id = s; } catch { /* storage blocked */ } }
  id = id || DEFAULT;
  if (q && storage) { try { storage.setItem('haiz.compose', id); } catch { /* storage blocked */ } }
  return COMPOSITIONS[id];
}

const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
/**
 * How far the campus stands at scroll progress p, outside chapter 04's own map (0 the plan
 * waits under the water, 1 every building standing in material). Pure.
 *   pinned   the visitor unfolded the campus in 04 and left it standing
 *   walking  the first-person walk (or its map) is on: always standing
 */
export function campusAt(compose, p, { pinned = false, walking = false } = {}) {
  if (walking) return 1;
  // before 04 the six-shot film is V4's own: a campus left standing sinks on the way back to 03
  if (p < 3) return pinned ? smooth((p - 2.55) / 0.45) : 0;
  const r = compose.rise;
  if (!r) return pinned && p < 3.5 ? 1 - smooth((p - 3.05) / 0.4) : 0;
  const rose = smooth((p - r[0]) / (r[1] - r[0]));
  if (!pinned) return rose;
  // composition a keeps 05 V4's own: a standing campus goes down before 05 and comes back with the body
  if (r[0] > 4) return p < 4 ? 1 - smooth((p - 3.05) / 0.5) : rose;
  return 1;
}
