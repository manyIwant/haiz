"""Back-project the traced skeleton of the centenary Terminalia from lanshu-1600 into the twin frame.

Usage: python twin/tools/lanren_backproject.py twin/evidence/calibration/lanshu-1600.tree.json [--write] [--out report.json]

The trace file lists image polylines (pixel centreline + radius in metres) for the trunk, limbs and
boulders, each with the plane assumption that fixes its depth:

  {"axis": [x, y]}                      point on the ray closest to the vertical axis at x, y
  {"through": [[x, y], [x, y]]}         vertical plane through two plan points
  {"facing": [x, y]}                    vertical plane through x, y facing the camera
  {"az_deg": a, "base": {...}}          vertical plane of azimuth a (from +x towards +y) through a base,
                                        given as {"xy": [x, y]} or {"branch": id, "px": [u, v]} (a point
                                        on that branch's first plane)

"prepend" / "extend" add authored points before / after the traced ones (a junction inside the
parent limb, the part outside the frame).

The camera is the calibrated one in the report written by calib_lines.py.  With --write the trunk
position, limbs and boulders of twin/data/trees.json (key "lanren") are replaced; hidden limbs come
from "estimated_limbs" in the trace file.
"""
import argparse, json, math
from pathlib import Path
import numpy as np
from calib_lines import Model

ROOT = Path(__file__).resolve().parents[2]


class Cam:
    def __init__(self, report_path):
        rep = json.loads((ROOT / report_path).read_text())
        spec = {'principal_point': rep['camera']['principal_point'], 'structure_params': {}, 'features': []}
        self.m = Model(spec)
        c = rep['camera']
        self.q = np.array([c['x'], c['y'], c['z'], math.radians(c['yaw_deg']), math.radians(c['pitch_deg']),
                           math.radians(c['roll_deg']), c['f_px'], c['k1']])
        self.C = self.q[:3]

    def ray(self, uv):
        return self.m.ray(self.q, np.asarray(uv[:2], float))

    def project(self, P):
        return self.m.project(self.q, np.asarray(P, float))

    def scale(self, P):
        """px per metre at P (the pinhole scale, ignoring distortion)"""
        return self.q[6] / np.linalg.norm(np.asarray(P) - self.C)


def vplane(cam, uv, p0, n):
    d = cam.ray(uv)
    n3 = np.array([n[0], n[1], 0.0])
    t = ((np.array([p0[0], p0[1], 0.0]) - cam.C) @ n3) / (d @ n3)
    if t <= 0:
        raise ValueError(f'plane behind the camera for pixel {uv}')
    return cam.C + t * d


def axis_point(cam, uv, xy):
    d = cam.ray(uv)
    dh = d[:2]
    t = ((np.asarray(xy) - cam.C[:2]) @ dh) / (dh @ dh)
    return cam.C + t * d


def plane_of(cam, spec, solved):
    """returns a function pixel -> 3D point for a plane spec"""
    if 'axis' in spec:
        return lambda uv: axis_point(cam, uv, spec['axis'])
    if 'through' in spec:
        a, b = (np.array(p, float) for p in spec['through'])
        t = (b - a) / np.linalg.norm(b - a)
        return lambda uv: vplane(cam, uv, a, (-t[1], t[0]))
    if 'facing' in spec:
        p = np.array(spec['facing'], float)
        d = (p - cam.C[:2]) / np.linalg.norm(p - cam.C[:2])
        return lambda uv: vplane(cam, uv, p, d)
    if 'az_deg' in spec:
        b = spec['base']
        base = np.array(b['xy'], float) if 'xy' in b else solved[b['branch']](b['px'])[:2]
        a = math.radians(spec['az_deg'])
        return lambda uv: vplane(cam, uv, base, (-math.sin(a), math.cos(a)))
    raise ValueError(spec)


def rock(cam, r):
    d = cam.ray(r['contact_px'])
    t = (r['ground_z'] - cam.C[2]) / d[2]
    front = cam.C + t * d
    dh = d[:2] / np.linalg.norm(d[:2])
    centre = front[:2] + r['behind'] * dh
    face = (centre - cam.C[:2]) / np.linalg.norm(centre - cam.C[:2])
    top = vplane(cam, r['top_z_px'], front[:2], face)
    k = cam.scale(np.r_[front[:2], (r['ground_z'] + top[2]) / 2])
    width = (r['width_px'][1] - r['width_px'][0]) / k
    return {'id': r['id'], 'xy': [round(float(centre[0]), 2), round(float(centre[1]), 2)], 'z': r['ground_z'],
            'size': [round(float(width), 2), r['depth'], round(float(top[2] - r['ground_z']), 2)],
            'rot_deg': r['rot_deg'], 'seed': r['seed'], 'lean': r['lean'], 'foot': r.get('foot', 1.1), 'tag': 'photo-derived',
            'distance_m': round(float(np.linalg.norm(front[:2] - cam.C[:2])), 2),
            'basis': r['basis'] + '; position from the calibrated lanshu-1600 camera (foot on z %.2f), width from the image width at that distance' % r['ground_z']}


def solve(trace):
    cam = Cam(trace['camera_report'])
    solved, limbs, rep = {}, [], []
    for b in trace['branches']:
        pts, check = [[float(c) for c in p] for p in b.get('prepend', [])], []
        for k, piece in enumerate(b['pieces']):
            f = plane_of(cam, piece['plane'], solved)
            if k == 0:
                solved[b['id']] = f
            for u, v, r in piece['px']:
                P = f((u, v))
                pts.append([float(P[0]), float(P[1]), float(P[2]), r])
                uv = cam.project(P)[0]
                check.append({'px': [u, v], 'xyz': [round(float(c), 3) for c in P], 'r_m': r,
                              'width_px': round(float(2 * r * cam.scale(P)), 1),
                              'reproj_px': round(float(np.hypot(uv[0] - u, uv[1] - v)), 3)})
        for p in b.get('extend', []):
            pts.append([float(c) for c in p])
        limbs.append({'id': b['id'], 'tag': b['tag'], 'basis': b['basis'] + ' (back-projected from lanshu-1600; see twin/evidence/calibration/lanshu-1600.tree.json)',
                      'pts': [[round(c, 3) for c in p] for p in pts]})
        rep.append({'id': b['id'], 'points': check, 'extended': b.get('extend', [])})
    for e in trace.get('estimated_limbs', []):
        limbs.append({'id': e['id'], 'tag': 'estimated', 'basis': e['basis'], 'pts': e['pts']})
    rocks = [rock(cam, r) for r in trace.get('rocks', [])]
    return cam, limbs, rocks, rep


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('trace')
    ap.add_argument('--write', action='store_true', help='update twin/data/trees.json')
    ap.add_argument('--out')
    a = ap.parse_args()
    trace = json.loads(Path(a.trace).read_text())
    cam, limbs, rocks, rep = solve(trace)
    for b in rep:
        z = [p['xyz'][2] for p in b['points']]
        print('%-24s %2d pts  z %.2f..%.2f  max reprojection %.3f px' % (b['id'], len(z), min(z), max(z), max(p['reproj_px'] for p in b['points'])))
    for r in rocks:
        print('%-24s xy %s  size %s  at %.1f m' % (r['id'], r['xy'], r['size'], r['distance_m']))
    if a.out:
        Path(a.out).write_text(json.dumps({'trace': a.trace, 'camera': [float(c) for c in cam.q], 'branches': rep, 'rocks': rocks},
                                          indent=1, ensure_ascii=False) + '\n')
    if a.write:
        path = ROOT / 'twin/data/trees.json'
        T = json.loads(path.read_text())
        L = T['lanren']
        L['trunk_xy'] = trace['trunk']['xy']
        L['ground_z'] = trace['trunk']['ground_z']
        L['limbs'] = limbs
        L['boulders'] = [{k: v for k, v in r.items() if k not in ('id', 'distance_m')} for r in rocks]
        path.write_text(json.dumps(T, indent=1, ensure_ascii=False) + '\n')
        print('wrote', path)


if __name__ == '__main__':
    main()
