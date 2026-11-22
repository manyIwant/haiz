"""Fit a photo's camera on 'fit' correspondences and report residuals on every point.

Usage: python twin/tools/calib.py twin/evidence/calibration/hero-2560.json [--out report.json]

Camera: pinhole with the principal point fixed (from the file), free position, focal length,
yaw and roll (pitch 0: the reference photographs are level or keystone-corrected).  Residuals of
'check' points are model-vs-photo errors; for each check point the report also gives the depth
change along the line of sight that would cancel its vertical residual, which shows how well the
photograph constrains that point at all.
"""
import argparse, json, math
import numpy as np
from scipy.optimize import least_squares


def rot(yaw, roll):
    # camera looks along -y (towards campus south) at yaw = 0; image x to the right = world -x
    cy, sy = math.cos(yaw), math.sin(yaw)
    fwd = np.array([-sy, -cy, 0.0]); right = np.array([-cy, sy, 0.0]); up = np.array([0.0, 0.0, 1.0])
    cr, sr = math.cos(roll), math.sin(roll)
    return fwd, right * cr + up * sr, up * cr - right * sr


def project(p, P, pp):
    x, y, z, f, yaw, roll = p
    fwd, right, up = rot(yaw, roll)
    d = np.asarray(P, float) - np.array([x, y, z])
    depth = d @ fwd
    return np.stack([pp[0] + f * (d @ right) / depth, pp[1] - f * (d @ up) / depth], -1), depth


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('calib')
    ap.add_argument('--out')
    ap.add_argument('--pp', nargs=2, type=float, default=[1280, 1075])
    ap.add_argument('--init', nargs=6, type=float, default=[0.0, 120.0, 1.5, 2000.0, 0.0, 0.0])
    a = ap.parse_args()
    C = json.load(open(a.calib))
    pts = C['points']
    fit = [q for q in pts if q['role'] == 'fit']
    W = np.array([q['world'] for q in fit]); U = np.array([q['px'] for q in fit], float)

    def res(p):
        uv, _ = project(p, W, a.pp)
        return (uv - U).ravel()
    sol = least_squares(res, a.init, x_scale=[1, 10, 0.5, 200, 0.05, 0.01])
    p = sol.x
    out = {'image': C['image'], 'camera': dict(x=p[0], y=p[1], z=p[2], f_px=p[3], yaw_deg=math.degrees(p[4]), roll_deg=math.degrees(p[5]),
                                               principal_point=a.pp), 'fit_rms_px': float(np.sqrt(np.mean(sol.fun ** 2))), 'points': []}
    fwd, right, up = rot(p[4], p[5])
    for q in pts:
        uv, depth = project(p, np.array([q['world']]), a.pp)
        du, dv = (uv[0] - np.array(q['px'])).tolist()
        # depth change that would cancel the vertical residual (points below the horizon only)
        h = (np.array(q['world']) - p[:3]) @ up
        v_meas = q['px'][1]
        dd = None
        if abs(v_meas - a.pp[1]) > 0.5:
            depth_meas = -p[3] * h / (v_meas - a.pp[1]) if h != 0 else None
            dd = None if depth_meas is None or depth_meas <= 0 else float(depth_meas - depth[0])
        out['points'].append(dict(id=q['id'], role=q['role'], du_px=round(du, 1), dv_px=round(dv, 1),
                                  depth_m=round(float(depth[0]), 1),
                                  metres_per_px=round(float(depth[0] / p[3]), 4),
                                  depth_change_to_match_m=None if dd is None else round(dd, 1)))
    print(json.dumps(out, ensure_ascii=False, indent=1))
    if a.out:
        json.dump(out, open(a.out, 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
