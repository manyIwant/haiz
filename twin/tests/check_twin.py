"""Light self-check of the twin: data, credibility tags, calibrations, exported GLBs and coordinates.

Usage (repository root):  python twin/tests/check_twin.py [--carve]

Runs in a few seconds with numpy only (no Blender, no network).  --carve also re-carves the Taihu
stone and checks its outline against the photographs (about 20 s, needs scipy, scikit-image, opencv).
Exit status 1 if any check fails.  It is a guard against broken exports and coordinate slips,
not a measure of how realistic the model looks.
"""
import argparse, json, math, struct, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TWIN = ROOT / 'twin'
TAGS = {'surveyed', 'public-map', 'documented', 'photo-derived', 'estimated', 'invented'}
FAIL = []


def check(ok, what):
    print(('ok    ' if ok else 'FAIL  ') + what)
    if not ok:
        FAIL.append(what)


def tag_ok(t):
    return isinstance(t, str) and t and all(p in TAGS for p in t.split('/'))


def walk_tags(o, path=''):
    """yield (path, tag) for every 'tag'-like key in a data file"""
    if isinstance(o, dict):
        for k, v in o.items():
            if (k == 'tag' or k.endswith('_tag')) and isinstance(v, str):
                yield path + '.' + k, v
            else:
                yield from walk_tags(v, path + '.' + k)
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from walk_tags(v, f'{path}[{i}]')


def glb(path):
    b = path.read_bytes()
    magic, ver, length = struct.unpack('<4sII', b[:12])
    clen, ctype = struct.unpack('<I4s', b[12:20])
    return magic, ver, length, len(b), ctype, json.loads(b[20:20 + clen])


def _local(n):
    import numpy as np
    if 'matrix' in n:
        return np.array(n['matrix'], float).reshape(4, 4).T
    M = np.eye(4)
    x, y, z, w = n.get('rotation', [0, 0, 0, 1])
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M[:3, :3] = R * np.array(n.get('scale', [1, 1, 1]))
    M[:3, 3] = n.get('translation', [0, 0, 0])
    return M


def node_bounds(J):
    """world bounds (glTF frame) of every mesh node: POSITION accessor min/max through the node hierarchy;
    GPU-instanced nodes are listed with their tags but without bounds.  n['_holder'] is the node's own extras;
    for a GPU-instanced node, which Blender's exporter makes without extras, it is the extras of the nearest
    tagged ancestor (the 'windows' empty), the rule the viewer uses when an object is picked"""
    import numpy as np
    parent = {c: i for i, n in enumerate(J['nodes']) for c in n.get('children', [])}

    def world(i):
        M = _local(J['nodes'][i])
        while i in parent:
            i = parent[i]
            M = _local(J['nodes'][i]) @ M
        return M
    def holder(i):
        while True:
            ex = J['nodes'][i].get('extras', {})
            if ex.get('haiz_tag') or i not in parent:
                return ex
            i = parent[i]
    out = {}
    for i, n in enumerate(J['nodes']):
        if 'mesh' not in n:
            continue
        if 'EXT_mesh_gpu_instancing' in n.get('extensions', {}):
            n['_holder'] = holder(i)
            out[n['name']] = (None, None, n)
            continue
        n['_holder'] = n.get('extras', {})
        lo, hi = np.full(3, np.inf), np.full(3, -np.inf)
        for p in J['meshes'][n['mesh']]['primitives']:
            a = J['accessors'][p['attributes']['POSITION']]
            lo = np.minimum(lo, a['min']); hi = np.maximum(hi, a['max'])
        C = np.array([[x, y, z, 1.0] for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])]) @ world(i).T
        out[n['name']] = ([float(v) for v in C[:, :3].min(0)], [float(v) for v in C[:, :3].max(0)], n)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--carve', action='store_true')
    a = ap.parse_args()

    # data files and tags
    data = {}
    for p in sorted((TWIN / 'data').rglob('*.json')):
        try:
            data[p.name] = json.loads(p.read_text())
            check(True, f'{p.relative_to(ROOT)} parses')
        except Exception as e:
            check(False, f'{p.relative_to(ROOT)} parses ({e})')
    bad = [(f, path, t) for f, d in data.items() for path, t in walk_tags(d) if not tag_ok(t)]
    check(not bad, 'credibility tags use the vocabulary %s%s' % (sorted(TAGS), '' if not bad else ': ' + repr(bad[:5])))
    fr = data['frame.json']
    check(abs(fr['rotation']['theta_deg'] - 41.0) < 1e-6 and fr['origin']['wgs84'] == [19.99847892, 110.34254843],
          'frame.json origin and rotation as documented in twin/README.md')

    # the centenary Terminalia: trunk in its bed, limbs above ground, boulders where the calibration put them
    from shapely.geometry import Point, Polygon
    L = data['trees.json']['lanren']
    def find(o):
        if isinstance(o, dict):
            if o.get('id') == 'lanren_bed':
                return o
            for v in o.values():
                r = find(v)
                if r:
                    return r
        if isinstance(o, list):
            for v in o:
                r = find(v)
                if r:
                    return r
    bed = find(data['site.json'])['geom']['poly']
    check(Polygon(bed).contains(Point(*L['trunk_xy'])), 'lanren trunk %s inside its planting bed' % (L['trunk_xy'],))
    low = [(l['id'], p) for l in L['limbs'] for p in l['pts'] if p[2] < L['ground_z'] - 0.3]
    check(not low, 'lanren limbs stay above ground%s' % ('' if not low else ': ' + repr(low[:3])))
    env = Polygon(L['envelope']['poly'])
    out = [l['id'] for l in L['limbs'] if not env.contains(Point(*l['pts'][-1][:2]))]
    check(not out, 'lanren limb tips inside the mapped crown%s' % ('' if not out else ': ' + repr(out)))

    # calibrations
    limits = {'lanshu-1600': 1.0, 'jiaoxuelou-1600': 2.0, 'hero-2560': 7.0}   # hero-2560: point fit on a 120 m view (calib.py)
    for name, lim in limits.items():
        r = json.loads((TWIN / f'evidence/calibration/{name}.report.json').read_text())
        rms = r.get('fit_rms_px')
        check(rms is not None and rms <= lim, f'{name} calibration fit rms {rms:.2f} px <= {lim}')
        c = r['camera']
        check(-150 < c['x'] < 150 and -150 < c['y'] < 200 and 0.3 < c['z'] < 4.0, f'{name} camera position inside the campus at eye height ({c["x"]:.1f}, {c["y"]:.1f}, {c["z"]:.2f})')

    # exported GLBs
    man = json.loads((TWIN / 'assets/phase1/manifest.json').read_text())
    expect = {  # loose bounds in the glTF frame (x, z, -y): catches a lost frame transform or a moved part
        'yihao': ((-70, -2, -20), (70, 45, 60)), 'site': ((-120, -1, -170), (120, 12, 60)), 'trees': ((-90, -1, -100), (90, 30, 40)),
        'gate': ((-60, -1, -135), (60, 20, 5)), 'campus': ((-400, -5, -400), (400, 80, 400)),
    }
    for part, info in man['parts'].items():
        p = TWIN / 'assets/phase1' / info['file']
        if not p.exists():
            check(False, f'{p.relative_to(ROOT)} exists'); continue
        magic, ver, length, size, ctype, J = glb(p)
        check(magic == b'glTF' and ver == 2 and length == size and ctype == b'JSON', f'{info["file"]}: valid GLB 2.0 container ({size / 1e6:.2f} MB)')
        check(abs(size / 1e6 - info['mb']) < 0.02, f'{info["file"]}: size matches manifest.json ({info["mb"]} MB)')
        nb = node_bounds(J)
        check(len(nb) > 0, f'{info["file"]}: {len(nb)} mesh objects')
        empty = [k for k, (lo, hi, n) in nb.items() if lo is not None and sum(h - l > 1e-3 for l, h in zip(lo, hi)) < 2]
        check(not empty, f'{info["file"]}: no empty meshes{"" if not empty else ": " + repr(empty[:5])}')
        untagged = [k for k, (lo, hi, n) in nb.items() if not tag_ok(n['_holder'].get('haiz_tag')) or not n['_holder'].get('haiz_basis')]
        check(not untagged, f'{info["file"]}: every object has haiz_tag and haiz_basis (instanced windows: on their parent){"" if not untagged else ": " + repr(untagged[:5])}')
        core = [b for k, b in nb.items() if 'ground.context' not in k and b[0] is not None]   # the context ground runs out to 1.5 km
        lo = [min(b[0][i] for b in core) for i in range(3)]; hi = [max(b[1][i] for b in core) for i in range(3)]
        e = expect.get(part)
        if e:
            inside = all(e[0][i] <= lo[i] and hi[i] <= e[1][i] for i in range(3))
            check(inside, f'{info["file"]}: bounds {[round(v, 1) for v in lo]}..{[round(v, 1) for v in hi]} inside the expected box')
    # coordinate anchors: objects that photographs or maps pin down
    J = glb(TWIN / 'assets/phase1/trees.glb')[5]
    nb = node_bounds(J)
    lo, hi, _ = nb['trees.lanren.wood']
    tx, ty = L['trunk_xy']
    check(lo[0] < tx < hi[0] and lo[2] < -ty < hi[2] and abs(lo[1] - (L['ground_z'] - 0.6)) < 0.7,
          'trees.glb: the Terminalia wood spans its trunk position (glTF x %.1f, z %.1f)' % (tx, -ty))
    J = glb(TWIN / 'assets/phase1/site.glb')[5]
    nb = node_bounds(J)
    x0, y0, x1, y1 = data['site.json']['taihu']['plinth']
    lo, hi, _ = nb['site.taihu.plinth']
    check(abs(lo[0] - x0) < 0.05 and abs(hi[0] - x1) < 0.05 and abs(-hi[2] - y0) < 0.25 and abs(-lo[2] - y1) < 0.25,
          'site.glb: Taihu plinth at x %.1f..%.1f, y %.1f..%.1f' % (x0, x1, y0, y1))
    lo, hi, _ = nb['site.taihu.rock']
    check(x0 - 0.5 < lo[0] and hi[0] < x1 + 0.5 and y0 < -hi[2] and -lo[2] < y1, 'site.glb: Taihu stone stands on its plinth')

    if a.carve:
        sys.path.insert(0, str(TWIN / 'tools'))
        import taihu_carve
        spec = json.loads((TWIN / 'evidence/calibration/taihu-silhouettes.json').read_text())
        d, origin, res = taihu_carve.field(spec)
        for r in taihu_carve.check(spec, d, origin, res):
            check(r['iou'] >= 0.8, f'Taihu stone outline on {r["view"]}: overlap {r["iou"]} >= 0.8')

    print('\n%d check(s) failed' % len(FAIL) if FAIL else '\nall checks passed')
    sys.exit(1 if FAIL else 0)


if __name__ == '__main__':
    main()
