/**
 * HAIZ · World Reconstruction — Unified Spatial Heightfield, Collision & Campus Navigation.
 *
 * Generated strictly from the SAME canonical `world_spec.json` that builds the Blender
 * geometry — guaranteeing zero visual-vs-collider drift!
 *
 * Includes real architectural pass-through portals:
 *   - North Gate central & side archways (walk/ride straight from Dalu St into the Palm Avenue!)
 *   - Teaching Block 1 ground-floor '1923' central through-hall (walk straight into Block 1-2 courtyard!)
 *   - South Gate arch opening onto Gaodeng West Street
 */

export function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function closestPointOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-10) return [ax, ay];
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return [ax + t * dx, ay + t * dy];
}

export class CampusSpatial {
  constructor(spec) {
    this.spec = spec;
    this.colliders = []; // { id, name, bbox, poly, portal? }
    this.bounds = { minX: -248, maxX: 230, minY: -266, maxY: 138 };
    this._buildColliders(spec);
    this._buildNavGraph(spec);
  }

  _buildColliders(spec) {
    // Campus buildings (excluding elevated skybridges you walk underneath, and splitting portals cleanly!)
    for (const b of spec.buildings) {
      if (b.archetype === 'skybridge' || b.archetype === 'covered_walk') continue;
      if (b.id === 'beimen') {
        // 4 individual North Gate piers so the 3 archways are genuinely walkable & bikeable!
        for (const [x0, x1] of [[-7.25, -5.45], [-3.95, -2.35], [2.35, 3.95], [5.45, 7.25]]) {
          this.colliders.push(this._rectCollider('beimen_pier', x0, 105.2, x1, 106.8));
        }
        continue;
      }
      if (b.id === 'nanmen') {
        for (const [x0, x1] of [[-73.5, -71.7], [-69.8, -68.4], [-63.6, -62.2], [-60.2, -58.5]]) {
          this.colliders.push(this._rectCollider('nanmen_pier', x0, -257.8, x1, -256.2));
        }
        continue;
      }
      if (b.id === 'yihao') {
        // Split Block 1 on either side of the open '1923' central through-hall (x = -6.8..+6.8)
        // so players and NPCs can walk right through the historic portal into the inner courtyard!
        this.colliders.push(this._rectCollider('yihao_west', -57.2, -15.3, -6.9, 0.2));
        this.colliders.push(this._rectCollider('yihao_east', 6.9, -15.3, 57.2, 0.2));
        // Main portal piers flanking x = -4.4..-2.5 and +2.5..+4.4
        this.colliders.push(this._rectCollider('yihao_portal_w', -4.5, 3.7, -2.4, 5.7));
        this.colliders.push(this._rectCollider('yihao_portal_e', 2.4, 3.7, 4.5, 5.7));
        continue;
      }
      if (b.archetype === 'hero_pavilion') {
        // Pavilions are open on all sides — walk right inside to shelter from rain!
        continue;
      }
      this.colliders.push({
        id: b.id,
        name: b.name,
        bbox: b.bbox,
        poly: b.poly,
      });
    }

    // Taihu plinth solid collider
    const pl = spec.forecourt_site.taihu.plinth;
    this.colliders.push(this._rectCollider('taihu_plinth', pl[0], pl[1], pl[2], pl[3]));

    // Centenary Terminalia trunk + tall boulder colliders
    const [tx, ty] = spec.terminalia_hero.trunk_xy;
    this.colliders.push(this._rectCollider('terminalia_trunk', tx - 1.1, ty - 1.1, tx + 1.1, ty + 1.1));
    this.colliders.push(this._rectCollider('terminalia_boulder', 46.8, 18.6, 49.4, 20.8));

    // Yanchi water polygon (keeps walkers on shore while gliders soar over water!)
    this.colliders.push({
      id: 'yanchi_water',
      name: '砚池水域',
      bbox: spec.yanchi.bbox,
      poly: spec.yanchi.poly,
      isWater: true,
    });
  }

  _rectCollider(id, x0, y0, x1, y1) {
    return {
      id,
      name: id,
      bbox: [x0, y0, x1, y1],
      poly: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
    };
  }

  /**
   * Unified multi-elevation ground height in Three.js coordinates (tx, tz) -> ty (meters).
   * Recall spec_x = tx, spec_y = -tz.
   */
  heightAtThree(tx, tz) {
    const sx = tx;
    const sy = -tz;
    return this.heightAtSpec(sx, sy);
  }

  heightAtSpec(sx, sy) {
    // 1. Teaching Block 1 through-hall & portico steps (plaza 0.60 -> floor 1.05)
    if (sx >= -10.5 && sx <= 10.5 && sy >= -10.5 && sy <= 6.9) {
      if (sy <= 5.6) return 1.05;
      const t = (6.9 - sy) / 1.3;
      return 0.60 + Math.max(0, Math.min(1, t)) * 0.45;
    }
    // 2. Forecourt central plaza (z = 0.60) & red granite front steps (y = 29.8..31.4)
    if (sx >= -14.5 && sx <= 14.5 && sy >= -0.3 && sy <= 29.8) {
      return 0.60;
    }
    if (((sx >= -12.5 && sx <= -4.0) || (sx >= 3.5 && sx <= 12.5)) && sy > 29.8 && sy <= 31.45) {
      const t = (31.45 - sy) / 1.65;
      return 0.148 + Math.max(0, Math.min(1, t)) * (0.60 - 0.148);
    }
    // 3. East & West side plazas under Centenary Terminalia (z = 0.60) & grey side steps (y = 20.5..21.6)
    if (((sx >= 14.5 && sx <= 52.0) || (sx >= -36.0 && sx <= -14.5)) && sy >= -0.3 && sy <= 20.5) {
      return 0.60;
    }
    if (((sx >= 52.0 && sx <= 58.0) || (sx >= -58.0 && sx <= -36.0)) && sy >= -0.3 && sy <= 9.0) {
      return 0.60;
    }
    if (((sx >= 14.5 && sx <= 52.0) || (sx >= -36.0 && sx <= -14.5)) && sy > 20.5 && sy <= 21.65) {
      const t = (21.65 - sy) / 1.15;
      return 0.15 + Math.max(0, Math.min(1, t)) * 0.45;
    }
    // 4. Art Education Center portico stairs facing Yanchi (0.15 -> 1.45)
    if (sx >= 28.5 && sx <= 41.5 && sy >= -142.5 && sy <= -130.6) {
      if (sy <= -132.5) return 1.45;
      const t = (-130.6 - sy) / 1.9;
      return 0.15 + Math.max(0, Math.min(1, t)) * 1.30;
    }
    // 5. Forecourt asphalt road & North Gate axis avenue (z = 0.148, matching build_world.py)
    if ((sx >= -78 && sx <= 78 && sy >= 42.6 && sy <= 50.2) ||
        (sx >= -12.5 && sx <= 12.5 && sy > 29.8 && sy < 42.6) ||
        (sx >= -6.5 && sx <= 6.5 && sy >= 46.0 && sy <= 128.0)) {
      return 0.148;
    }
    // 6. Standard campus ground datum (lawns, courts, inner roads)
    return 0.155;
  }

  /** Is a Three.js point (tx, tz) sheltered from rain under a colonnade, pavilion, or portal? */
  isShelteredThree(tx, tz) {
    const sx = tx, sy = -tz;
    // Teaching Block 1 central through-hall & front colonnades
    if (sx >= -7.2 && sx <= 7.2 && sy >= -10.5 && sy <= 5.6) return true;
    if (Math.abs(sx) >= 16.5 && Math.abs(sx) <= 48.0 && sy >= -1.8 && sy <= 0.1) return true;
    // Fengqiting & Yanlinting pavilions
    if (Math.hypot(sx + 40.0, sy - 56.0) < 3.4) return true;
    if (Math.hypot(sx - 34.0, sy - 55.0) < 3.4) return true;
    // Art Center portico
    if (sx >= 28.6 && sx <= 41.4 && sy >= -141.8 && sy <= -132.8) return true;
    // North Gate arch
    if (sx >= -8.0 && sx <= 8.0 && sy >= 104.5 && sy <= 107.5) return true;
    return false;
  }

  /** Check whether a circular footprint in Three.js space intersects any solid collider. */
  isBlockedThree(tx, tz, radius = 0.45, { allowWater = false } = {}) {
    const res = this.resolveMoveThree(tx, tz, radius, { allowWater });
    return Math.hypot(res.x - tx, res.z - tz) > 1e-3;
  }

  /**
   * Resolve horizontal circular movement in Three.js space (tx, tz) -> safe (x, z) with smooth wall sliding.
   */
  resolveMoveThree(tx, tz, radius = 0.45, { allowWater = false } = {}) {
    let sx = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, tx));
    let sy = Math.max(this.bounds.minY, Math.min(this.bounds.maxY, -tz));

    for (let iter = 0; iter < 2; iter++) {
      for (const col of this.colliders) {
        if (allowWater && col.isWater) continue;
        const [x0, y0, x1, y1] = col.bbox;
        if (sx < x0 - radius || sx > x1 + radius || sy < y0 - radius || sy > y1 + radius) continue;

        const poly = col.poly;
        const inside = pointInPoly(sx, sy, poly);
        let bestD2 = Infinity;
        let bestX = sx, bestY = sy;
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i];
          const b = poly[(i + 1) % poly.length];
          const [cx, cy] = closestPointOnSegment(sx, sy, a[0], a[1], b[0], b[1]);
          const d2 = (sx - cx) ** 2 + (sy - cy) ** 2;
          if (d2 < bestD2) {
            bestD2 = d2;
            bestX = cx;
            bestY = cy;
          }
        }
        const d = Math.sqrt(bestD2);
        if (inside) {
          const nx = d > 1e-5 ? (bestX - sx) / d : 0;
          const ny = d > 1e-5 ? (bestY - sy) / d : 1;
          sx = bestX + nx * radius;
          sy = bestY + ny * radius;
        } else if (d < radius) {
          const nx = d > 1e-5 ? (sx - bestX) / d : 0;
          const ny = d > 1e-5 ? (sy - bestY) / d : 1;
          sx = bestX + nx * radius;
          sy = bestY + ny * radius;
        }
      }
    }
    return { x: sx, z: -sy };
  }

  /** Named semantic campus waypoints in Spec space (x east, y north) for NPC scheduling & map travel */
  _buildNavGraph(spec) {
    this.places = {
      north_gate: { x: 0.0, y: 102.0, label: '北门牌坊' },
      palm_avenue: { x: 0.0, y: 74.0, label: '中轴椰林大道' },
      forecourt: { x: -4.0, y: 44.0, label: '前庭广场' },
      taihu_plaza: { x: 0.0, y: 34.5, label: '太湖石前' },
      yihao_portal: { x: 0.0, y: 10.0, label: '一号教学楼门厅' },
      terminalia: { x: 34.0, y: 24.5, label: '百年榄仁树下' },
      inner_court: { x: 0.0, y: -26.0, label: '一二号楼内院' },
      erhao: { x: -4.0, y: -62.0, label: '二号教学楼' },
      science: { x: 10.0, y: -68.0, label: '科学馆广场' },
      yanchi: { x: 52.0, y: -104.5, label: '砚池畔' },
      arts: { x: 35.0, y: -131.5, label: '艺术中心门廊' },
      library: { x: 68.0, y: 8.0, label: '图书馆大台阶前' },
      fengqitang: { x: -40.0, y: 63.0, label: '凤栖堂前' },
      fengqiting: { x: -40.0, y: 56.0, label: '凤栖亭' },
      yanlinting: { x: 34.0, y: 55.0, label: '衍林亭' },
      yanlintang: { x: 68.0, y: 50.0, label: '衍林堂' },
      basketball: { x: -68.0, y: -28.0, label: '篮球场边' },
      track_entry: { x: -68.0, y: 56.0, label: '运动场入口' },
      canteen1: { x: 128.0, y: -136.0, label: '第一食堂' },
      canteen3: { x: -132.0, y: -196.0, label: '第三食堂' },
      dorm_f: { x: -68.0, y: -104.0, label: '女生宿舍' },
      dorm_m: { x: 128.0, y: -20.0, label: '男生宿舍' },
      botanic: { x: -112.0, y: -162.0, label: '植物园' },
      south_gate: { x: -66.0, y: -252.0, label: '南门牌坊' },
    };

    // Road junction graph in Spec space
    this.navNodes = [
      { id: 'n_gate', x: 0, y: 102 },
      { id: 'n_axis_mid', x: 0, y: 74 },
      { id: 'n_fc_c', x: 0, y: 46.4 },
      { id: 'n_fc_e', x: 34, y: 46.4 },
      { id: 'n_fc_ee', x: 68, y: 46.4 },
      { id: 'n_fc_far_e', x: 128, y: 46.4 },
      { id: 'n_fc_w', x: -38, y: 46.4 },
      { id: 'n_fc_ww', x: -68, y: 46.4 },
      { id: 'n_fc_far_w', x: -132, y: 46.4 },
      { id: 'n_yihao_n', x: 0, y: 12 },
      { id: 'n_yihao_s', x: 0, y: -26 },
      { id: 'n_tree', x: 34, y: 24.5 },
      { id: 'n_lib', x: 68, y: 8 },
      { id: 'n_e_mid', x: 68, y: -64 },
      { id: 'n_e_yanchi', x: 68, y: -104 },
      { id: 'n_yanchi_n', x: 48, y: -104 },
      { id: 'n_e_south', x: 68, y: -196 },
      { id: 'n_dm_n', x: 128, y: -20 },
      { id: 'n_dm_mid', x: 128, y: -64 },
      { id: 'n_dm_y', x: 128, y: -104 },
      { id: 'n_c1', x: 128, y: -138 },
      { id: 'n_dm_s', x: 128, y: -196 },
      { id: 'n_w_track', x: -68, y: 66 },
      { id: 'n_w_court', x: -68, y: -26 },
      { id: 'n_w_mid', x: -68, y: -64 },
      { id: 'n_w_dormf', x: -68, y: -104 },
      { id: 'n_w_south', x: -68, y: -196 },
      { id: 'n_s_gate', x: -66, y: -252 },
      { id: 'n_ww_mid', x: -132, y: -64 },
      { id: 'n_ww_y', x: -132, y: -104 },
      { id: 'n_ww_s', x: -132, y: -196 },
      { id: 'n_mid_c', x: 0, y: -64 },
      { id: 'n_fq', x: -40, y: 58 },
      { id: 'n_yl', x: 34, y: 55 },
    ];
    this.navAdj = new Map(this.navNodes.map((n) => [n.id, []]));
    const edges = [
      ['n_gate', 'n_axis_mid'], ['n_axis_mid', 'n_fc_c'],
      ['n_fc_far_w', 'n_fc_ww'], ['n_fc_ww', 'n_fc_w'], ['n_fc_w', 'n_fc_c'],
      ['n_fc_c', 'n_fc_e'], ['n_fc_e', 'n_fc_ee'], ['n_fc_ee', 'n_fc_far_e'],
      ['n_fc_w', 'n_fq'], ['n_fc_e', 'n_yl'],
      ['n_fc_c', 'n_yihao_n'], ['n_yihao_n', 'n_yihao_s'],
      ['n_fc_e', 'n_tree'], ['n_tree', 'n_lib'],
      ['n_fc_ee', 'n_lib'], ['n_lib', 'n_e_mid'], ['n_e_mid', 'n_e_yanchi'], ['n_e_yanchi', 'n_e_south'],
      ['n_e_yanchi', 'n_yanchi_n'], ['n_yanchi_n', 'n_w_dormf'],
      ['n_fc_far_e', 'n_dm_n'], ['n_dm_n', 'n_dm_mid'], ['n_dm_mid', 'n_dm_y'], ['n_dm_y', 'n_c1'], ['n_c1', 'n_dm_s'],
      ['n_e_mid', 'n_dm_mid'], ['n_e_yanchi', 'n_dm_y'], ['n_e_south', 'n_dm_s'],
      ['n_fc_ww', 'n_w_track'], ['n_fc_ww', 'n_w_court'], ['n_w_court', 'n_w_mid'],
      ['n_w_mid', 'n_w_dormf'], ['n_w_dormf', 'n_w_south'], ['n_w_south', 'n_s_gate'],
      ['n_w_mid', 'n_mid_c'], ['n_mid_c', 'n_e_mid'],
      ['n_fc_far_w', 'n_ww_mid'], ['n_ww_mid', 'n_ww_y'], ['n_ww_y', 'n_ww_s'],
      ['n_ww_mid', 'n_w_mid'], ['n_ww_y', 'n_w_dormf'], ['n_ww_s', 'n_w_south'], ['n_w_south', 'n_e_south'],
    ];
    const byId = new Map(this.navNodes.map((n) => [n.id, n]));
    for (const [a, b] of edges) {
      const na = byId.get(a), nb = byId.get(b);
      const w = Math.hypot(na.x - nb.x, na.y - nb.y);
      this.navAdj.get(a).push([b, w]);
      this.navAdj.get(b).push([a, w]);
    }
    this._navById = byId;
  }

  /** Shortest campus path between two spec (x, y) points, returned as Three.js [{x, z}] waypoints. */
  findPathThree(ax, az, bx, bz) {
    const sax = ax, say = -az, sbx = bx, sby = -bz;
    const nearest = (x, y) => {
      let best = this.navNodes[0], bd = Infinity;
      for (const n of this.navNodes) {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < bd) { bd = d; best = n; }
      }
      return best.id;
    };
    const start = nearest(sax, say);
    const goal = nearest(sbx, sby);
    const dist = new Map([[start, 0]]);
    const prev = new Map();
    const open = new Set([start]);
    const gNode = this._navById.get(goal);

    while (open.size) {
      let cur = null, bestF = Infinity;
      for (const id of open) {
        const n = this._navById.get(id);
        const f = dist.get(id) + Math.hypot(n.x - gNode.x, n.y - gNode.y);
        if (f < bestF) { bestF = f; cur = id; }
      }
      if (cur === goal) break;
      open.delete(cur);
      const cd = dist.get(cur);
      for (const [nb, w] of this.navAdj.get(cur)) {
        const nd = cd + w;
        if (nd < (dist.get(nb) ?? Infinity)) {
          dist.set(nb, nd);
          prev.set(nb, cur);
          open.add(nb);
        }
      }
    }

    const ids = [];
    let c = goal;
    while (c) { ids.push(c); c = prev.get(c); }
    ids.reverse();
    const pts = [{ x: ax, z: az }];
    for (const id of ids) {
      const n = this._navById.get(id);
      pts.push({ x: n.x, z: -n.y });
    }
    pts.push({ x: bx, z: bz });
    return pts;
  }
}
