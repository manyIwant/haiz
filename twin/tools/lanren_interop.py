"""Coordinate interface between the twin and the 入画 scene (lanren/).

The 入画 scene does not use geography.  It lays the hand-drawn campus plan (assets/walk/campus.json,
plan pixels x 0.167 m, -Z towards the North Gate) under the V4 tree, with the 百年榄仁树 at world
(0, 0) and the ground plane at y = -0.85 (lanren/map/geo.js).  Buildings come from a GLB whose
'SITE_<id>' roots sit at the plan rectangles' centres (lanren/map/campus-v3.js).

This tool fits the twin frame to that plan on landmarks both sides identify, and writes
twin/data/interop/lanren.json:
  - 'similarity'  twin (x, y) -> plan campus metres (x, z): rotation, scale, translation, fitted by
                  weighted least squares, with every landmark's residual
  - 'pinned'      rigid (scale 1, the fitted rotation) with the translation chosen so the twin's
                  Terminalia trunk lands exactly on the plan's lanshu, i.e. at 入画 world (0, 0): what
                  a scene that keeps the V4 tree and wants the twin at true size should use
  - 'world'       twin (x, y, z) -> 入画 world (X, Y, Z) as a 4x4 matrix (three.js, Y up), pinned and
                  rigid, with the twin's road level on the 入画 ground plane
  - 'buildings'   twin building -> 入画 building id, with how sure the match is
Usage:  python twin/tools/lanren_interop.py [--out twin/data/interop/lanren.json]
"""
import argparse, json, math
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
TWIN = ROOT / 'twin'
PLAN = ROOT / 'assets/walk/campus.json'


def plan_rect(campus, ids):
    """union bbox of plan rectangles, in plan campus metres (x, z), and its size"""
    tf = campus['meta']['transform']
    xs, zs = [], []
    for b in campus['buildings']:
        if b['id'] in ids:
            r = b['rect']
            for px in (r[0], r[2]):
                xs.append((px - tf['originPx'][0]) * tf['scale'])
            for py in (r[1], r[3]):
                zs.append(-(py - tf['originPx'][1]) * tf['scale'])
    if not xs:
        raise KeyError(ids)
    return ((min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2), (max(xs) - min(xs), max(zs) - min(zs))


def bbox_centre(polys):
    xs = [p[0] for q in polys for p in q]; ys = [p[1] for q in polys for p in q]
    return ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2), (max(xs) - min(xs), max(ys) - min(ys))


def twin_landmarks():
    C = json.loads((TWIN / 'data/campus.json').read_text())
    S = json.loads((TWIN / 'data/site.json').read_text())
    T = json.loads((TWIN / 'data/trees.json').read_text())
    G = json.loads((TWIN / 'data/gate.json').read_text())
    fp = {b['id'][:4]: b['poly'] for b in C['buildings']}
    lu = {l['class'] + (l.get('name') or ''): l['poly'] for l in C['land_use']}
    px0, py0, px1, py1 = S['taihu']['plinth']
    t = T['lanren']['trunk_xy']
    L = [  # id, plan ids, twin centre and size, sigma (m), what the twin side is
        ('lanshu', ['lanshu'], (tuple(t), None), 3, 'trunk of the centenary Terminalia (twin: calibrated lanshu-1600 camera)'),
        ('hujulongpan', ['hujulongpan'], (((px0 + px1) / 2, (py0 + py1) / 2), (px1 - px0, py1 - py0)), 3, 'Taihu stone plinth (twin site.json)'),
        ('beimen', ['beimen'], ((0.0, G['centre_y']), None), 3, 'North Gate centre (twin gate.json)'),
        ('yihao', ['yihao'], bbox_centre([fp['a627']]), 4, '1号教学楼, OSM footprint'),
        ('erhao', ['erhao'], bbox_centre([fp['3968']]), 5, '2号教学楼, OSM footprint'),
        ('kexue+chem', ['kexue', 'chem'], bbox_centre([fp['8b86']]), 6, '科学馆, OSM footprint (the plan splits it into two labs)'),
        ('sanhao+sihao', ['sanhao', 'sihao', 'corr_big', 'corr_34'], bbox_centre([fp['2988']]), 6, '第3教学楼, OSM footprint (one polygon over blocks 3, 4 and their links)'),
        ('dorm_f', ['dorm_f'], bbox_centre([fp['1883']]), 6, 'red-roofed courtyard block, ODbL footprint (identification as in PR #87 control points)'),
        ('yishu', ['yishu'], bbox_centre([fp['d9c7'], fp['95ad']]), 8, 'paired red-roofed courtyard complex, two footprints (identification as in PR #87)'),
        ('yanchi', ['yanchi'], bbox_centre([C['water'][0]['poly']]), 5, '砚池 water outline (twin campus.json)'),
        ('yundong', ['yundong'], bbox_centre([lu['recreation'] if 'recreation' in lu else lu['track']]), 8, 'running track, OSM'),
    ]
    tr = [l for l in C['land_use'] if l['class'] == 'track']
    if tr:
        L[-1] = ('yundong', ['yundong'], bbox_centre([tr[0]['poly']]), 8, 'running track, OSM')
    return L


def fit(src, dst, w):
    """weighted 2-D similarity dst = s R src + t (Umeyama)"""
    w = np.asarray(w, float) / np.sum(w)
    ms = (w[:, None] * src).sum(0); md = (w[:, None] * dst).sum(0)
    A = src - ms; B = dst - md
    H = (w[:, None] * A).T @ B
    U, S, Vt = np.linalg.svd(H)
    D = np.diag([1, np.sign(np.linalg.det(Vt.T @ U.T))])
    R = Vt.T @ D @ U.T
    s = np.trace(np.diag(S) @ D) / (w * (A ** 2).sum(1)).sum()
    t = md - s * R @ ms
    return s, R, t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=str(TWIN / 'data/interop/lanren.json'))
    a = ap.parse_args()
    plan = json.loads(PLAN.read_text())
    L = twin_landmarks()
    rows = []
    for lid, pids, (tc, tsize), sig, what in L:
        (cx, cz), psize = plan_rect(plan, pids)
        rows.append(dict(id=lid, plan_ids=pids, twin=[round(tc[0], 2), round(tc[1], 2)], plan=[round(cx, 2), round(cz, 2)],
                         twin_size=None if tsize is None else [round(v, 1) for v in tsize], plan_size=[round(v, 1) for v in psize], sigma=sig, twin_is=what))
    # fit in 'plan north-up' coordinates (x, n = -z) so both frames are right-handed with +y / +n towards the North Gate
    src = np.array([r['twin'] for r in rows], float)
    dst = np.array([[r['plan'][0], -r['plan'][1]] for r in rows], float)
    wts = np.array([1 / r['sigma'] ** 2 for r in rows])
    s, R, t = fit(src, dst, wts)
    phi = math.degrees(math.atan2(R[1, 0], R[0, 0]))
    res = dst - (s * (R @ src.T).T + t)
    for r, e in zip(rows, res):
        r['residual_m'] = [round(float(e[0]), 2), round(float(-e[1]), 2)]
        r['residual_norm_m'] = round(float(np.hypot(*e)), 2)
    rms = float(np.sqrt((res ** 2).sum(1).mean()))
    # pinned: rigid (scale 1, same R); translation so the twin trunk lands on the plan's lanshu (入画 world origin).
    # Rigid because the twin is the measured layout: a 3 % shrink would distort every mesh it carries.
    tree = next(r for r in rows if r['id'] == 'lanshu')
    tp = np.array([tree['plan'][0], -tree['plan'][1]]) - R @ np.array(tree['twin'])
    resp = dst - ((R @ src.T).T + tp)
    rmsp = float(np.sqrt((resp ** 2).sum(1).mean()))
    for r, e in zip(rows, resp):
        r['residual_pinned_m'] = round(float(np.hypot(*e)), 2)
    pivot = tree['plan']
    # world: X = x_c - pivot_x, Z = z_c - pivot_z (geo.js toWorld at the default rotation 0), Y = z_twin + GROUND_Y.
    c, sn = math.cos(math.radians(phi)), math.sin(math.radians(phi))
    # twin (x, y) -> plan north-up (x_c, n_c) = R (x, y) + tp ; z_c = -n_c ; world X = x_c - px, Z = z_c - pz
    # As a 4x4 acting on twin (x, y, z, 1) and giving world (X, Y, Z, 1):
    M = [[c, -sn, 0, tp[0] - pivot[0]],
         [0, 0, 1, -0.85],
         [-sn, -c, 0, -tp[1] - pivot[1]],
         [0, 0, 0, 1]]
    ground_y = -0.85
    out = {
        'schema': 'haiz-twin-interop-lanren/1',
        'what': 'Twin frame <-> the 入画 scene frame (lanren/map/geo.js: plan campus metres; world = plan laid under the V4 tree, '
                'tree at (0, 0), ground plane y = -0.85). Generated by twin/tools/lanren_interop.py; do not edit by hand.',
        'tag': 'public-map/estimated',
        'basis': 'similarity fitted on landmarks identified in both the twin (OSM/ODbL footprints, calibrated photographs) and the '
                 'legacy plan (assets/walk/campus.json, a KML conversion whose source is lost, PR #87). The plan is schematic: '
                 'residuals of several metres are expected and are differences of the plan, not of the twin.',
        'plan': {'file': 'assets/walk/campus.json', 'transform': plan['meta']['transform'], 'lanshu_pivot': pivot, 'ground_y': ground_y},
        'similarity': {'scale': round(s, 4), 'rotation_deg': round(phi, 2), 'translation': [round(float(t[0]), 2), round(float(-t[1]), 2)],
                       'rms_m': round(rms, 2), 'note': 'plan (x, z) = scale * rot(rotation_deg) * twin (x, y) mapped as (x, -z) + translation (x, z)'},
        'pinned': {'scale': 1.0, 'rotation_deg': round(phi, 2), 'translation': [round(float(tp[0]), 2), round(float(-tp[1]), 2)],
                   'rms_m': round(rmsp, 2), 'note': 'rigid: the fitted rotation, scale 1; the twin Terminalia trunk maps exactly onto the plan lanshu (入画 world origin)'},
        'world_matrix': {'rows': [[round(v, 6) for v in row] for row in M],
                         'note': 'row-major 4x4, twin (x, y, z, 1) -> 入画 world (X, Y, Z, 1), pinned; three.js Matrix4.set() takes these rows '
                                 'in this order. The twin GLBs are already in glTF axes (x, z, -y): for them use world_from_gltf.'},
        'world_from_gltf': None,
        'mesh_rotation_deg': round(phi, 2),
        'vertical': 'twin z = 0 (the forecourt road) on the 入画 ground plane y = -0.85; the twin tree bed is at z 0.72, so the twin '
                    'trunk foot lands at y -0.13 where the V4 tree stands at y 0',
        'landmarks': rows,
    }
    # glTF (gx, gy, gz) = (x, z, -y)  ->  twin (x, y, z) = (gx, -gz, gy)
    P = np.array([[1, 0, 0, 0], [0, 0, -1, 0], [0, 1, 0, 0], [0, 0, 0, 1]], float)
    Mg = np.array(M) @ P
    out['world_from_gltf'] = {'rows': [[round(float(v), 6) for v in row] for row in Mg],
                              'note': 'row-major 4x4 for a twin GLB root: glTF (x, y, z, 1) -> 入画 world (X, Y, Z, 1)'}
    p = Path(a.out); p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print('similarity: scale %.4f rot %.2f deg rms %.2f m; pinned rms %.2f m' % (s, phi, rms, rmsp))
    for r in rows:
        print('  %-14s twin %-18s plan %-18s res %5.1f m  pinned %5.1f m' % (r['id'], r['twin'], r['plan'], r['residual_norm_m'], r['residual_pinned_m']))


if __name__ == '__main__':
    main()
