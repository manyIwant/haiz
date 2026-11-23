"""Line-based camera calibration for photographs taken from an unknown, tilted viewpoint.

Usage: python twin/tools/calib_lines.py twin/evidence/calibration/lanshu-1600.json [--out report.json]

calib.py fits a level camera on point correspondences.  Photographs such as lanshu-1600 (taken
from low down, pitched up and rolled, with most of the facade hidden by foliage) need straight
edges instead of points.  The measurement file lists edge segments read on the photograph with
sub-pixel edge fitting; each one is tied to a model line:

  vline  a vertical line at known plan position (x may depend on a structure parameter)
  xline  a line parallel to the facade (twin x) at known y and a height z (number or parameter);
         only the segment's midpoint is used, because the local slope of a short window edge
         on this photograph is noisier than its position
  vdir   a vertical line at unknown position (constrains the camera orientation only)
  xdir   a line parallel to twin x at unknown position (orientation only)

Camera: pinhole with radial distortion k1, principal point fixed at the centre of the picture
area; free position, yaw (azimuth of the view direction, from +x towards +y), pitch (up
positive), roll and focal length.  Structure parameters (window width, heights of window heads
and transoms, ...) are fitted together with the camera; heights need one anchor (fixed z).  "fixed"
holds camera values kept constant (e.g. {"k1": 0} when the lines cannot separate distortion).
The report gives the solution, formal standard deviations, per-feature residuals, a profile
of the cost against a fixed focal length, and alternative solutions with features left out,
so that the real uncertainty can be judged.
"""
import argparse, json, math
import numpy as np
from scipy.optimize import least_squares

CAM = ['x', 'y', 'z', 'yaw', 'pitch', 'roll', 'f', 'k1']


def basis(yaw, pitch, roll):
    cy, sy, cp, sp, cr, sr = math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch), math.cos(roll), math.sin(roll)
    F = np.array([cp * cy, cp * sy, sp])
    R = np.array([sy, -cy, 0.0])
    U = np.cross(R, F)
    return cr * R + sr * U, -sr * R + cr * U, F


class Model:
    def __init__(self, spec, drop=()):
        self.spec = spec
        self.pp = np.array(spec['principal_point'], float)
        self.sp = list(spec['structure_params'])
        self.anchor = {k: v['value'] for k, v in spec.get('anchors', {}).items()}
        self.feats = [f for f in spec['features'] if f['type'] not in drop and f.get('group') not in drop and f['id'] not in drop]
        self.names = CAM + self.sp

    def val(self, v, q):
        """number | parameter name | [base, param, k] -> base + k * param"""
        if isinstance(v, (int, float)):
            return float(v)
        if isinstance(v, str):
            return self.anchor[v] if v in self.anchor else q[self.names.index(v)]
        base, par, k = v
        return base + k * self.val(par, q)

    def project(self, q, P):
        R, U, F = basis(q[3], q[4], q[5])
        v = np.atleast_2d(P) - q[0:3]
        zc = v @ F
        x = (v @ R) / zc; y = -(v @ U) / zc
        d = 1 + q[7] * (x * x + y * y)
        return np.stack([self.pp[0] + q[6] * x * d, self.pp[1] + q[6] * y * d], -1)

    def ray(self, q, uv):
        R, U, F = basis(q[3], q[4], q[5])
        xd = (uv[0] - self.pp[0]) / q[6]; yd = (uv[1] - self.pp[1]) / q[6]
        x, y = xd, yd
        for _ in range(12):
            d = 1 + q[7] * (x * x + y * y); x, y = xd / d, yd / d
        v = F + x * R - y * U
        return v / np.linalg.norm(v)

    def feature_res(self, q, f):
        px = np.array(f['px'], float)
        w = f.get('weight', 1.0)
        if f['type'] in ('vline', 'xline'):
            if f['type'] == 'vline':
                X, Y = self.val(f['x'], q), self.val(f['y'], q)
                z0, z1 = f.get('z_range', [1.0, 5.0])
                a3, b3 = (X, Y, z0), (X, Y, z1)
                pts = px
            else:
                Y, Z = self.val(f['y'], q), self.val(f['z'], q)
                x0, x1 = f['x_range']
                a3, b3 = (x0, Y, Z), (x1, Y, Z)
                pts = px.mean(0, keepdims=True)
            a, b = self.project(q, np.array([a3, b3]))
            t = (b - a) / np.linalg.norm(b - a)
            return w * ((pts - a) @ np.array([-t[1], t[0]]))
        D = np.array([0, 0, 1.0]) if f['type'] == 'vdir' else np.array([1.0, 0, 0])
        m = px.mean(0)
        P = q[0:3] + 15.0 * self.ray(q, m)
        a, b = self.project(q, np.array([P - 0.5 * D, P + 0.5 * D]))
        t = (b - a) / np.linalg.norm(b - a)
        return w * ((px - m) @ np.array([-t[1], t[0]]))

    def residuals(self, q):
        return np.concatenate([self.feature_res(q, f) for f in self.feats])


def solve(model, init, fixed=None, starts=None, f_scale=0.7):
    fixed = dict(fixed or {})
    names = model.names
    if 'tower_y' in names and not any(f.get('group') == 'tower' for f in model.feats):
        fixed[names.index('tower_y')] = init[names.index('tower_y')]
    free = [i for i in range(len(names)) if i not in fixed]
    best = None
    for s in (starts or [init]):
        q0 = np.array(s, float)
        for i, v in fixed.items():
            q0[i] = v

        def full(qf, q0=q0):
            q = q0.copy(); q[free] = qf
            return q
        r = least_squares(lambda qf: model.residuals(full(qf)), q0[free], loss='soft_l1', f_scale=f_scale, max_nfev=4000)
        if best is None or r.cost < best[0].cost:
            best = (r, full)
    r, full = best
    q = full(r.x)
    rr = model.residuals(q)
    dof = max(1, len(rr) - len(free))
    cov = np.linalg.pinv(r.jac.T @ r.jac) * (rr ** 2).sum() / dof
    sd = np.zeros(len(names)); sd[free] = np.sqrt(np.abs(np.diag(cov)))
    return q, sd, rr, r.cost


def starts_for(spec):
    s0 = spec['init']
    out = []
    for dx, dy, f in spec.get('init_spread', [[0, 0, 1.0]]):
        q = [s0[n] for n in CAM] + [spec['structure_params'][k]['init'] for k in spec['structure_params']]
        q[0] += dx; q[1] += dy; q[6] *= f
        q[3], q[4], q[5] = math.radians(q[3]), math.radians(q[4]), math.radians(q[5])
        out.append(q)
    return out


def summary(model, q, sd):
    out = {}
    for n, v, s in zip(model.names, q, sd):
        if n in ('yaw', 'pitch', 'roll'):
            v, s = math.degrees(v), math.degrees(s)
        out[n] = {'value': round(float(v), 4), 'sd': round(float(s), 4)}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('calib')
    ap.add_argument('--out')
    a = ap.parse_args()
    spec = json.load(open(a.calib))
    model = Model(spec)
    starts = starts_for(spec)
    fixed = {model.names.index(k): float(v) for k, v in spec.get('fixed', {}).items()}
    q, sd, rr, cost = solve(model, starts[0], fixed=fixed, starts=starts)
    R, U, F = basis(q[3], q[4], q[5])
    rep = {
        'image': spec['image'], 'image_size': spec['image_size'],
        'camera_model': spec['camera_model'],
        'camera': {'x': float(q[0]), 'y': float(q[1]), 'z': float(q[2]), 'f_px': float(q[6]), 'k1': float(q[7]),
                   'yaw_deg': math.degrees(q[3]), 'pitch_deg': math.degrees(q[4]), 'roll_deg': math.degrees(q[5]),
                   'principal_point': spec['principal_point'],
                   'basis': {'right': R.tolist(), 'up': U.tolist(), 'forward': F.tolist()},
                   'convention': 'yaw = azimuth of the view direction from +x towards +y; pitch up positive; basis vectors in the twin frame'},
        'solution': summary(model, q, sd),
        'anchors': spec.get('anchors', {}),
        'fit_rms_px': float(np.sqrt(np.mean(rr ** 2))), 'fit_max_px': float(np.abs(rr).max()), 'n_residuals': int(len(rr)),
        'features': [],
    }
    for f in model.feats:
        r = model.feature_res(q, f)
        rep['features'].append({'id': f['id'], 'type': f['type'], 'residual_px': [round(float(x), 2) for x in r]})
    # focal-length profile: the photograph alone separates focal length and distance only weakly
    prof = []
    fi = model.names.index('f')
    for fv in spec.get('profile_f', []):
        qq, _, r2, c2 = solve(model, q, fixed={**fixed, fi: float(fv)}, starts=[q.copy()])
        prof.append({'f_px': fv, 'cost': round(float(c2), 3), 'rms_px': round(float(np.sqrt(np.mean(r2 ** 2))), 3),
                     'camera_xyz': [round(float(v), 2) for v in qq[:3]], 'pitch_deg': round(math.degrees(qq[4]), 2)})
    rep['profile_f'] = prof
    alts = []
    for drop in spec.get('alternatives', []):
        m2 = Model(spec, drop=tuple(drop))
        q2, sd2, r2, c2 = solve(m2, q, fixed=fixed, starts=[q.copy()] + starts[:2])
        alts.append({'left_out': drop, 'camera_xyz': [round(float(v), 2) for v in q2[:3]], 'f_px': round(float(q2[6]), 1),
                     'pitch_deg': round(math.degrees(q2[4]), 2), 'roll_deg': round(math.degrees(q2[5]), 2),
                     'rms_px': round(float(np.sqrt(np.mean(r2 ** 2))), 3)})
    rep['alternatives'] = alts
    txt = json.dumps(rep, indent=1, ensure_ascii=False)
    if a.out:
        open(a.out, 'w').write(txt + '\n')
    s = rep['solution']
    print('camera (%.2f, %.2f, %.2f) +/- (%.2f, %.2f, %.2f)  f %.0f +/- %.0f  yaw %.2f pitch %.2f roll %.2f  k1 %.3f  rms %.3f px' % (
        s['x']['value'], s['y']['value'], s['z']['value'], s['x']['sd'], s['y']['sd'], s['z']['sd'], s['f']['value'], s['f']['sd'],
        s['yaw']['value'], s['pitch']['value'], s['roll']['value'], s['k1']['value'], rep['fit_rms_px']))
    for p in prof:
        print('  profile f %5.0f cost %.2f cam %s' % (p['f_px'], p['cost'], p['camera_xyz']))
    for al in alts:
        print('  without %s: cam %s f %.0f' % (al['left_out'], al['camera_xyz'], al['f_px']))


if __name__ == '__main__':
    main()
