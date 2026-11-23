"""Carve the forecourt's Taihu stone from its outlines on calibrated photographs.

Usage: python twin/tools/taihu_carve.py twin/evidence/calibration/taihu-silhouettes.json [--res 0.035] [--check out_dir]

Each view in the silhouette file has an image outline of the stone (pixels), optional openings
(background seen through the stone) and pockets (dark holes), and the calibration report of its
camera (calib_lines.py "lines" or calib.py "level").  The stone is the intersection of the
viewing cones of the outlines (signed distances in metres), limited in depth by an inflation of the
outline about the middle of the plinth bed, rounded, split into rounded masses by crevices along
the cells of a seeded Voronoi partition, given lumps, creases and pits (seeded noise), and drilled at the photographed pockets along the first view's rays.

field() returns a signed-distance grid (negative inside) in twin coordinates; nature.mesh_field()
turns it into the mesh in the Blender build.  --check reprojects the carved stone into every view
and prints the overlap with the traced outline (intersection over union).
"""
import argparse, json, math, sys
from pathlib import Path
import numpy as np
from scipy.ndimage import distance_transform_edt, map_coordinates, gaussian_filter, zoom

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parents[1]
sys.path.insert(0, str(TOOLS))


class LinesCam:
    def __init__(self, rep):
        from calib_lines import Model
        c = rep['camera']
        self.m = Model({'principal_point': c['principal_point'], 'structure_params': {}, 'features': []})
        self.q = np.array([c['x'], c['y'], c['z'], math.radians(c['yaw_deg']), math.radians(c['pitch_deg']),
                           math.radians(c['roll_deg']), c['f_px'], c['k1']])
        self.C, self.f = self.q[:3], c['f_px']

    def project(self, P):
        return self.m.project(self.q, P)

    def ray(self, uv):
        return self.m.ray(self.q, np.asarray(uv, float))


class LevelCam:
    def __init__(self, rep):
        import calib
        self._proj = calib.project
        c = rep['camera']
        self.p = [c['x'], c['y'], c['z'], c['f_px'], math.radians(c['yaw_deg']), math.radians(c['roll_deg'])]
        self.pp, self.C, self.f = c['principal_point'], np.array([c['x'], c['y'], c['z']]), c['f_px']

    def project(self, P):
        return self._proj(self.p, np.atleast_2d(P), self.pp)[0]


def camera(view):
    rep = json.loads((ROOT / view['camera_report']).read_text())
    return LinesCam(rep) if view['kind'] == 'lines' else LevelCam(rep)


def signed_px(view):
    """signed distance to the outline in pixels (positive outside), on the image grid"""
    import cv2
    W, H = view['image_size']
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.round(np.array(view['outline']) * 8).astype(np.int32)], 1, shift=3)
    for o in view.get('openings', []):
        cv2.fillPoly(m, [np.round(np.array(o['outline']) * 8).astype(np.int32)], 0, shift=3)
    inside = m.astype(bool)
    return distance_transform_edt(~inside) - distance_transform_edt(inside)


def fbm(shape, rng, base, octaves=4, stretch=(1.0, 1.0, 1.0)):
    out = np.zeros(shape, np.float32)
    amp = 1.0
    for o in range(octaves):
        n = [max(2, int(math.ceil(base[i] * 2 ** o / stretch[i]))) + 1 for i in range(3)]
        small = rng.standard_normal(n).astype(np.float32)
        z = zoom(small, [shape[i] / n[i] for i in range(3)], order=3)
        out += amp * z[:shape[0], :shape[1], :shape[2]]
        amp *= 0.5
    return out / 1.9


def field(spec, res=0.035, seed=1923, bounds=(-4.3, 3.8, 26.3, 31.3, 0.70, 4.6), floor_z=0.70, tol_m=(0.0, 0.2),
          cell_m=1.4, crevice_w=0.06, crevice_depth=0.5, n_pits=220):
    x0, x1, y0, y1, z0, z1 = bounds
    xs = np.arange(x0, x1 + 1e-9, res); ys = np.arange(y0, y1 + 1e-9, res); zs = np.arange(z0, z1 + 1e-9, res)
    X, Y, Z = np.meshgrid(xs, ys, zs, indexing='ij')
    P = np.stack([X.ravel(), Y.ravel(), Z.ravel()], -1)
    views = spec['views']
    cams = [camera(v) for v in views]
    hull = np.full(P.shape[0], -1e9, np.float32)
    d_in0 = None
    for k, (v, cam) in enumerate(zip(views, cams)):
        sd = signed_px(v)
        uv = cam.project(P)
        s = map_coordinates(sd, [uv[:, 1], uv[:, 0]], order=1, mode='nearest')
        m_per_px = np.linalg.norm(P - cam.C, axis=1) / cam.f
        sm = (s * m_per_px - (tol_m[k] if k < len(tol_m) else 0.0)).astype(np.float32)
        hull = np.maximum(hull, sm)
        if k == 0:
            d_in0 = -sm
    dp = spec['depth_prior']
    hd = np.clip(dp['half_depth_min'] + dp['inflate'] * np.maximum(d_in0, 0.0), dp['half_depth_min'], dp['half_depth_max'])
    slab = np.abs(P[:, 1] - dp['y_centre']) - hd
    d = np.maximum(hull, slab).reshape(X.shape)
    d = gaussian_filter(d, 0.07 / res)
    rng = np.random.default_rng(seed)
    L = (x1 - x0, y1 - y0, z1 - z0)
    # lumps (pillowy masses about 1 m across), creases (ridged, slightly stretched along the strata)
    d += 0.11 * fbm(d.shape, rng, [l / 1.3 for l in L], octaves=3)
    d += 0.05 * (np.abs(fbm(d.shape, rng, [l / 0.7 for l in L], octaves=3, stretch=(1.0, 1.0, 1.6))) - 0.3)
    d += 0.022 * (np.abs(fbm(d.shape, rng, [l / 0.28 for l in L], octaves=2)) - 0.3)
    # the stone is an aggregate of rounded masses with deep crevices between them: cells of a Voronoi
    # partition seeded inside the stone, crevices along the cell boundaries down to crevice_depth
    from scipy.spatial import cKDTree
    inside = np.argwhere(d < -0.25)
    n_cells = max(8, int(len(inside) * res ** 3 / cell_m ** 3))
    seeds = inside[rng.choice(len(inside), size=n_cells, replace=False)] * res + np.array([x0, y0, z0])
    # domain warp (wavy boundaries) and strata: cells flattened along planes dipping 25 deg to the west
    warp = [0.35 * fbm(d.shape, rng, [l / 1.6 for l in L], octaves=2) for _ in range(3)]
    Q = np.stack([(X + warp[0]).ravel(), (Y + warp[1]).ravel(), (Z + warp[2]).ravel()], -1)
    a = math.radians(25.0)
    S = np.array([[math.cos(a), 0, math.sin(a)], [0, 1, 0], [-math.sin(a) * 1.7, 0, math.cos(a) * 1.7]])
    F, I = cKDTree(seeds @ S.T).query(Q @ S.T, k=2)
    g = (F[:, 1] - F[:, 0]).reshape(d.shape).astype(np.float32)
    # masses stand proud of each other by different amounts
    bulge = rng.uniform(-0.05, 0.22, n_cells).astype(np.float32)[I[:, 0]].reshape(d.shape)
    t = np.clip(g / 0.7, 0.0, 1.0)
    d = d - bulge * t * t * (3 - 2 * t)
    w = crevice_w * (1.0 + 0.6 * fbm(d.shape, rng, [l / 1.0 for l in L], octaves=2))
    d = np.maximum(d, np.minimum(w - g, d + crevice_depth))
    d += 0.035 * (np.abs(fbm(d.shape, rng, [l / 0.45 for l in L], octaves=2, stretch=(1.0, 1.0, 1.8))) - 0.3)
    d = gaussian_filter(d, 0.018 / res)
    d = np.maximum(d, hull.reshape(d.shape) - 0.03)     # keep the photographed outline
    d = np.maximum(d, floor_z - Z)

    def carve_sphere(c, r):
        i0 = np.maximum(((c - r - np.array([x0, y0, z0])) / res).astype(int) - 1, 0)
        i1 = np.minimum(((c + r - np.array([x0, y0, z0])) / res).astype(int) + 2, np.array(d.shape))
        sl = tuple(slice(a, b) for a, b in zip(i0, i1))
        q = np.stack([X[sl], Y[sl], Z[sl]], -1)
        d[sl] = np.maximum(d[sl], r - np.linalg.norm(q - c, axis=-1))

    # fine pits over the surface
    surf = np.argwhere(np.abs(d) < res * 0.6)
    surf = surf[surf[:, 2] * res + z0 > floor_z + 0.15]
    for i in rng.choice(len(surf), size=min(n_pits, len(surf)), replace=False):
        c = np.array([xs[surf[i, 0]], ys[surf[i, 1]], zs[surf[i, 2]]])
        r = rng.uniform(0.03, 0.08)
        carve_sphere(c + rng.normal(0, 0.3 * r, 3), r)
    # photographed pockets, drilled along the first view's rays from where they meet the surface
    cam = cams[0]
    for pk in views[0].get('pockets', []):
        ray = cam.ray(pk['px'])
        hit = None
        for t in np.arange(5.0, 25.0, res * 0.5):
            p = cam.C + t * ray
            idx = np.round((p - np.array([x0, y0, z0])) / res).astype(int)
            if np.all(idx >= 0) and np.all(idx < np.array(d.shape)) and d[tuple(idx)] < 0:
                hit = t
                break
        if hit is None:
            continue
        r = pk['r_px'] * hit / cam.f
        side = np.cross(ray, [0, 0, 1.0]); side /= np.linalg.norm(side)
        for t in np.arange(hit - r, hit + pk['depth'], r * 0.4):
            k = max(0.0, t - hit) / pk['depth']
            off = rng.normal(0, 0.25 * r, 2)          # irregular, meandering hole
            carve_sphere(cam.C + t * ray + off[0] * side + off[1] * np.array([0, 0, 1.0]), r * (1.0 - 0.4 * k) * rng.uniform(0.8, 1.15))
    return d.astype(np.float32), np.array([x0, y0, z0]), res


def check(spec, d, origin, res, out_dir=None):
    """reproject inside voxels into every view and compare with the traced outline"""
    import cv2
    idx = np.argwhere(d < 0)
    P = origin + idx * res
    rep = []
    for v in spec['views']:
        cam = camera(v)
        W, H = v['image_size']
        uv = cam.project(P)
        m = np.zeros((H, W), np.uint8)
        ok = (uv[:, 0] >= 0) & (uv[:, 0] < W) & (uv[:, 1] >= 0) & (uv[:, 1] < H)
        m[uv[ok, 1].astype(int), uv[ok, 0].astype(int)] = 1
        k = max(3, int(round(res * cam.f / np.linalg.norm(P.mean(0) - cam.C) * 1.5)) | 1)
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((k, k), np.uint8))
        t = np.zeros((H, W), np.uint8)
        cv2.fillPoly(t, [np.round(np.array(v['outline'])).astype(np.int32)], 1)
        inter = int((m & t).sum()); union = int((m | t).sum())
        rep.append({'view': v['id'], 'iou': round(inter / union, 3), 'model_px': int(m.sum()), 'traced_px': int(t.sum())})
        if out_dir:
            vis = np.zeros((H, W, 3), np.uint8)
            vis[..., 1] = t * 255; vis[..., 2] = m * 255
            cv2.imwrite(str(Path(out_dir) / f"carve_{v['id']}.png"), vis)
    return rep


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('spec')
    ap.add_argument('--res', type=float, default=0.035)
    ap.add_argument('--check')
    a = ap.parse_args()
    spec = json.loads(Path(a.spec).read_text())
    d, origin, res = field(spec, a.res)
    inside = d < 0
    idx = np.argwhere(inside)
    lo, hi = origin + idx.min(0) * res, origin + idx.max(0) * res
    print('stone extent x %.2f..%.2f  y %.2f..%.2f  z %.2f..%.2f  volume %.1f m3' % (lo[0], hi[0], lo[1], hi[1], lo[2], hi[2], inside.sum() * res ** 3))
    for r in check(spec, d, origin, res, a.check):
        print(r)


if __name__ == '__main__':
    main()
