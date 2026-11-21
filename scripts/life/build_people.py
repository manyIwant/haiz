# HAIZ · 校园里的人 — build the campus's bodies (Blender, headless; reproducible).
#
#   python3 scripts/life/build_people.py --mh <makehuman>/makehuman/data --out lanren/assets/life [--only student-m]
#
# Source: MakeHuman 1.x data (CC0, makehumancommunity/makehuman @ a8bc2d54ff0ac92e78ff71431b1023eda42bf482):
# base.obj (the hm08 base mesh, in decimetres, Y up, facing +Z), targets/macrodetails (the shape of a gender
# and an age, and muscle, weight, proportions), rigs/default.mhskel + default_weights.mhw (a 163-bone
# skeleton). Only the data is used; none of MakeHuman's code. See docs/life-20261117.md, 「人物模型」.
#
# What this makes, per figure (FIGURES below):
#   body      the base mesh shaped by MakeHuman's macro targets for that gender, age, muscle and weight, scaled
#             to a stature; East Asian proportions (MakeHuman's "asian" set)
#   skeleton  the MakeHuman skeleton collapsed into the chain the gait (lanren/life/gait.js) drives — hips,
#             spine, chest, neck, head, shoulders, arms, hands with five three-joint fingers, legs, feet, toes —
#             with every MakeHuman bone's weights merged into the bone it belongs to (face → head, deltoid →
#             upper arm…), four influences per vertex
#   clothes   cut from the body itself: a short-sleeved school shirt with a standing collar, straight trousers,
#             sneakers. Each garment is its region of the body lifted off the skin by its thickness, smoothed
#             so the anatomy underneath softens into cloth, with a real hem (a lip folding back to the body)
#             — so sleeves, cuffs and the shirt over the trousers read as cloth, not paint
#   hair      shells grown from the scalp with a hairline, volume, a fringe of tufts; styles per person
#   face      MakeHuman's eyeballs; brows, the upper lash line and the lips painted into the skin
#   colours   one vertex colour per part (linear rgb) with a material kind in alpha — 1 cloth, .75 skin,
#             .5 hair, .25 eyes — read by the cel material (lanren/ruhua-stroll/student.js)
import sys, os, json, math, argparse
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('--mh', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--only', default=None)
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
MH = args.mh

# ---------------------------------------------------------------- the people (gender 0 female … 1 male)
FIGURES = {
    'student-m': dict(gender=1.0, years=17, muscle=0.52, weight=0.45, prop=0.65, stature=1.71,
                      hair=['short', 'buzz', 'part'], bag=True, glasses=True, hair_col=(0.035, 0.028, 0.026)),
    'student-f': dict(gender=0.0, years=16, muscle=0.45, weight=0.45, prop=0.65, stature=1.60,
                      hair=['ponytail', 'bob-short'], bag=True, hair_col=(0.03, 0.022, 0.02)),
    'teacher-f': dict(gender=0.0, years=38, muscle=0.45, weight=0.52, prop=0.55, stature=1.61,
                      hair=['bob'], bag=False, glasses=True, hair_col=(0.045, 0.032, 0.028), shirt_col=(0.62, 0.72, 0.82)),
    'worker-m': dict(gender=1.0, years=62, muscle=0.45, weight=0.6, prop=0.5, stature=1.66,
                     hair=['grey'], bag=False, hair_col=(0.42, 0.40, 0.37), shirt_col=(0.30, 0.36, 0.24)),
}
SKIN = (0.76, 0.51, 0.37)
SHIRT = (0.93, 0.93, 0.90)
TROUSERS = (0.09, 0.12, 0.20)
SHOES = (0.84, 0.85, 0.87)
SOLE = (0.40, 0.40, 0.42)
BAG = (0.78, 0.30, 0.10)
STRAPS = (0.25, 0.22, 0.20)
K_CLOTH, K_SKIN, K_HAIR, K_EYE = 1.0, 0.75, 0.5, 0.25


# ---------------------------------------------------------------- MakeHuman data
def read_obj(path):
    V, F, G = [], [], []
    g = None
    with open(path) as f:
        for line in f:
            if line.startswith('v '):
                V.append([float(x) for x in line.split()[1:4]])
            elif line.startswith('g '):
                g = line.split()[1]
            elif line.startswith('f '):
                F.append([int(t.split('/')[0]) - 1 for t in line.split()[1:]])
                G.append(g)
    return np.array(V), F, G


BASE, FACES, GROUPS = read_obj(os.path.join(MH, '3dobjs/base.obj'))
_targets = {}


def target(rel):
    if rel not in _targets:
        idx, d = [], []
        with open(os.path.join(MH, 'targets', rel)) as f:
            for line in f:
                if line.startswith('#') or not line.strip():
                    continue
                p = line.split()
                idx.append(int(p[0])); d.append([float(p[1]), float(p[2]), float(p[3])])
        _targets[rel] = (np.array(idx, dtype=np.int64), np.array(d) if d else np.zeros((0, 3)))
    return _targets[rel]


def age_value(years):
    if years < 11: return (years - 1) / 10 * 0.1875
    if years < 25: return 0.1875 + (years - 11) / 14 * 0.3125
    return min(1.0, 0.5 + (years - 25) / 65 * 0.5)


def age_weights(a):
    if a < 0.5:
        young = max(0.0, (a - 0.1875) * 3.2)
        child = max(0.0, min(1.0, 5.333333 * a) - young)
        baby = max(0.0, 1 - a * 5.333333)
        return {'baby': baby, 'child': child, 'young': young, 'old': 0.0}
    old = max(0.0, a * 2 - 1)
    return {'baby': 0.0, 'child': 0.0, 'young': 1 - old, 'old': old}


def tri(v, lo, mid, hi):
    a, c = max(0.0, 1 - v * 2), max(0.0, v * 2 - 1)
    return {lo: a, mid: 1 - a - c, hi: c}


def shape(spec):
    """MakeHuman's macro modifiers, for one figure: the base mesh plus weighted targets (decimetres)."""
    V = BASE.copy()
    G = {'female': 1 - spec['gender'], 'male': spec['gender']}
    A = age_weights(age_value(spec['years']))
    M = tri(spec['muscle'], 'minmuscle', 'averagemuscle', 'maxmuscle')
    W = tri(spec['weight'], 'minweight', 'averageweight', 'maxweight')
    p = spec.get('prop', 0.5)
    P = {'idealproportions': max(0.0, p * 2 - 1), 'uncommonproportions': max(0.0, 1 - p * 2)}

    def add(rel, w):
        if w < 1e-4: return
        idx, d = target(rel)
        if len(idx): V[idx] += d * w
    for g, gw in G.items():
        for a, aw in A.items():
            add(f'macrodetails/asian-{g}-{a}.target', gw * aw)
            for m, mw in M.items():
                for wn, ww in W.items():
                    add(f'macrodetails/universal-{g}-{a}-{m}-{wn}.target', gw * aw * mw * ww)
                    for pn, pw in P.items():
                        if a != 'baby':
                            add(f'macrodetails/proportions/{g}-{a}-{m}-{wn}-{pn}.target', gw * aw * mw * ww * pw)
    return V


SKEL = json.load(open(os.path.join(MH, 'rigs/default.mhskel')))
WEIGHTS = json.load(open(os.path.join(MH, 'rigs/default_weights.mhw')))['weights']

# the MakeHuman bones merged into the gait's chain
FINGERS = {1: 'thumb', 2: 'index', 3: 'middle', 4: 'ring', 5: 'pinky'}


def merged_bone(n):
    side = n[-2:] if n.endswith(('.L', '.R')) else ''
    base = n[:-2] if side else n
    if base in ('root', 'spine05', 'pelvis'): return 'hips'
    if base in ('spine04', 'spine03'): return 'spine'
    if base in ('spine02', 'spine01', 'breast'): return 'chest'
    if base in ('neck01', 'neck02'): return 'neck'
    if base == 'clavicle': return 'shoulder' + side
    if base in ('shoulder01', 'upperarm01', 'upperarm02'): return 'upperarm' + side
    if base in ('lowerarm01', 'lowerarm02'): return 'forearm' + side
    if base == 'wrist' or base.startswith('metacarpal'): return 'hand' + side
    if base.startswith('finger'):
        f, j = base[6:].split('-')
        return f'{FINGERS[int(f)]}.0{j}' + side
    if base in ('upperleg01', 'upperleg02'): return 'thigh' + side
    if base in ('lowerleg01', 'lowerleg02'): return 'shin' + side
    if base == 'foot': return 'foot' + side
    if base.startswith('toe'): return 'toe' + side
    return 'head'                                     # neck03, head, jaw, eyes, tongue, the face's muscles


# ---------------------------------------------------------------- geometry helpers (numpy, metres, Y up, +Z front)
def normals(V, F):
    N = np.zeros_like(V)
    for f in F:
        p = V[f]
        n = np.zeros(3)
        for i in range(len(f)):
            n += np.cross(p[i], p[(i + 1) % len(f)])
        for i in f: N[i] += n
    L = np.linalg.norm(N, axis=1, keepdims=True); L[L == 0] = 1
    return N / L


def neighbours(n, F):
    nb = [set() for _ in range(n)]
    for f in F:
        for i in range(len(f)):
            a, b = f[i], f[(i + 1) % len(f)]
            nb[a].add(b); nb[b].add(a)
    return [np.array(sorted(s), dtype=np.int64) for s in nb]


def boundary_edges(F):
    cnt = {}
    for f in F:
        for i in range(len(f)):
            a, b = f[i], f[(i + 1) % len(f)]
            k = (min(a, b), max(a, b))
            cnt[k] = cnt.get(k, 0) + 1
    out = []
    for f in F:                                       # keep the face's winding for each boundary edge
        for i in range(len(f)):
            a, b = f[i], f[(i + 1) % len(f)]
            if cnt[(min(a, b), max(a, b))] == 1: out.append((a, b))
    return out


def taubin(V, nb, movable, it=8, lam=0.5, mu=-0.53):
    V = V.copy()
    idx = np.nonzero(movable)[0]
    for _ in range(it):
        for k in (lam, mu):
            avg = np.array([V[nb[i]].mean(axis=0) if len(nb[i]) else V[i] for i in idx])
            V[idx] += k * (avg - V[idx])
    return V


def tparam(p, h, t):
    d = t - h
    return float(np.dot(p - h, d) / max(np.dot(d, d), 1e-9))


# ---------------------------------------------------------------- one figure
class Part:
    """vertices, faces, colours (rgba) and weights {bone: array} of one mesh"""
    def __init__(self, name):
        self.name, self.V, self.F, self.C, self.W = name, [], [], [], []

    def add_vertex(self, p, c, w):
        self.V.append(np.asarray(p, float)); self.C.append(c); self.W.append(dict(w))
        return len(self.V) - 1


def build(name, spec):
    print('==', name)
    Vdm = shape(spec)
    V = Vdm * 0.1                                     # metres
    # the body proper (no helpers) and the eyes
    body_f = [f for f, g in zip(FACES, GROUPS) if g == 'body']
    eye_f = [f for f, g in zip(FACES, GROUPS) if g in ('helper-l-eye', 'helper-r-eye')]
    used = sorted({i for f in body_f for i in f})
    floor = V[used, 1].min()
    top = V[used, 1].max()
    s = spec['stature'] / (top - floor)
    V = (V - np.array([0, floor, 0])) * s
    cx = V[used, 0].mean(); V[:, 0] -= cx
    # joints of the MakeHuman skeleton (each the mean of a few base vertices)
    J = {k: V[np.array(v)].mean(axis=0) for k, v in SKEL['joints'].items()}
    head = lambda b: J[SKEL['bones'][b]['head']]
    tail = lambda b: J[SKEL['bones'][b]['tail']]
    # ---- the gait's skeleton: (head, tail, parent)
    B = {}
    hipL, hipR = head('upperleg01.L'), head('upperleg01.R')
    B['hips'] = ((hipL + hipR) / 2 + np.array([0, 0.04, 0]), head('spine04'), None)
    B['spine'] = (head('spine04'), head('spine02'), 'hips')
    B['chest'] = (head('spine02'), head('neck01'), 'spine')
    B['neck'] = (head('neck01'), head('head'), 'chest')
    B['head'] = (head('head'), tail('head'), 'neck')
    for sd in ('.L', '.R'):
        B['shoulder' + sd] = (head('clavicle' + sd), head('upperarm01' + sd), 'chest')
        B['upperarm' + sd] = (head('upperarm01' + sd), head('lowerarm01' + sd), 'shoulder' + sd)
        B['forearm' + sd] = (head('lowerarm01' + sd), head('wrist' + sd), 'upperarm' + sd)
        B['hand' + sd] = (head('wrist' + sd), head('finger3-1' + sd), 'forearm' + sd)
        for fi, fn in FINGERS.items():
            par = 'hand' + sd
            for j in (1, 2, 3):
                b = f'finger{fi}-{j}{sd}'
                B[f'{fn}.0{j}{sd}'] = (head(b), tail(b), par)
                par = f'{fn}.0{j}{sd}'
        B['thigh' + sd] = (head('upperleg01' + sd), head('lowerleg01' + sd), 'hips')
        B['shin' + sd] = (head('lowerleg01' + sd), head('foot' + sd), 'thigh' + sd)
        ball = tail('foot' + sd)
        B['foot' + sd] = (head('foot' + sd), ball, 'shin' + sd)
        tip = np.array([ball[0], ball[1], ball[2] + 0.06])
        B['toe' + sd] = (ball, tip, 'foot' + sd)
    # ---- merged weights, on every base vertex
    names = list(B.keys())
    bi = {n: i for i, n in enumerate(names)}
    Wm = np.zeros((len(V), len(names)))
    for mb, lst in WEIGHTS.items():
        t = bi[merged_bone(mb)]
        for v, w in lst: Wm[v, t] += w
    eye_v = sorted({i for f in eye_f for i in f})
    Wm[eye_v] = 0; Wm[eye_v, bi['head']] = 1
    # four strongest, normalised
    top4 = np.argsort(-Wm, axis=1)[:, :4]
    W4 = np.zeros_like(Wm)
    rows = np.arange(len(V))[:, None]
    W4[rows, top4] = Wm[rows, top4]
    ssum = W4.sum(axis=1, keepdims=True); ssum[ssum == 0] = 1
    W4 /= ssum

    def wdict(i):
        nz = np.nonzero(W4[i])[0]
        return {names[k]: float(W4[i, k]) for k in nz}

    # ---- regions of the body: which garment covers each vertex
    body_V_idx = np.array(used)
    N_all = np.zeros_like(V)
    N_all[used] = normals(V, body_f)[used]
    yHip = (hipL[1] + hipR[1]) / 2
    hem_y = yHip + 0.035                               # the untucked shirt's hem
    neck_base = head('neck01')[1] + 0.012
    reg = {}
    for i in used:
        p = V[i]
        w = {n: W4[i, bi[n]] for n in names}
        legs = sum(w[n + sd] for n in ('thigh', 'shin') for sd in ('.L', '.R'))
        feet = sum(w[n + sd] for n in ('foot', 'toe') for sd in ('.L', '.R'))
        armU = w['upperarm.L'] + w['upperarm.R']
        armL = sum(w[n + sd] for n in ('forearm', 'hand') for sd in ('.L', '.R')) + sum(w[k] for k in names if '.0' in k)
        torso = w['hips'] + w['spine'] + w['chest'] + w['shoulder.L'] + w['shoulder.R']
        sd = '.L' if p[0] > 0 else '.R'
        t_up = tparam(p, B['upperarm' + sd][0], B['upperarm' + sd][1])
        t_sh = tparam(p, B['shin' + sd][0], B['shin' + sd][1])
        if feet > 0.45 or (w['shin' + sd] > 0.4 and t_sh > 0.9):
            r = 'shoes'
        elif (legs > 0.45 or (torso > 0.3 and p[1] < hem_y)) and p[1] < hem_y + 0.02:
            r = 'trousers'
        elif armL > 0.5 or (armU > 0.45 and t_up > 0.5):
            r = 'skin'
        elif (torso + armU > 0.5) and p[1] < neck_base and w['head'] < 0.3:
            r = 'shirt'
        else:
            r = 'skin'
        reg[i] = r
    # faces take their vertices' majority (priority on ties)
    pri = {'shoes': 4, 'trousers': 3, 'shirt': 2, 'skin': 1}
    freg = []
    for f in body_f:
        cnt = {}
        for i in f: cnt[reg[i]] = cnt.get(reg[i], 0) + 1
        freg.append(max(cnt.items(), key=lambda kv: (kv[1], pri[kv[0]]))[0])

    out = Part('Body')
    COL = {'skin': (*SKIN, K_SKIN), 'shirt': (*spec.get('shirt_col', SHIRT), K_CLOTH), 'trousers': (*TROUSERS, K_CLOTH), 'shoes': (*SHOES, K_CLOTH)}
    THICK = {'skin': 0.0, 'shirt': 0.013, 'trousers': 0.008, 'shoes': 0.008}
    # each region gets its own copy of the vertices it uses
    for region in ('skin', 'shirt', 'trousers', 'shoes'):
        F = [f for f, r in zip(body_f, freg) if r == region]
        if not F: continue
        vs = sorted({i for f in F for i in f})
        loc = {v: k for k, v in enumerate(vs)}
        Fl = [[loc[i] for i in f] for f in F]
        P0 = V[vs].copy()
        Nl = N_all[vs]
        P = P0 + Nl * THICK[region]
        if region != 'skin':
            nb = neighbours(len(vs), Fl)
            bset = {a for e in boundary_edges(Fl) for a in e}
            movable = np.array([k not in bset for k in range(len(vs))])
            P = taubin(P, nb, movable, it=(14 if spec['gender'] < 0.5 else 10) if region == 'shirt' else 6)
            if region == 'trousers':
                pelvis = np.array([W4[i, bi['hips']] > 0.15 and V[i][1] > B['thigh.L'][0][1] - 0.16 for i in vs]) & movable
                P = taubin(P, nb, pelvis, it=24, lam=0.6, mu=-0.62)
                # the front of the pelvis under the cloth: no closer than the lower belly above it
                yh = (B['thigh.L'][0][1] + B['thigh.R'][0][1]) / 2
                band = [k for k in range(len(vs)) if yh + 0.03 < P[k][1] < yh + 0.08 and abs(P[k][0]) < 0.09 and P[k][2] > 0]
                for k in range(len(vs)):
                    x, y, z = P[k]
                    if not (abs(x) < 0.08 and yh - 0.12 < y < yh + 0.03 and z > 0): continue
                    ref = [P[j][2] for j in band if abs(P[j][0] - x) < 0.015]
                    if not ref: continue
                    zr = max(ref) - 0.004 - max(0.0, (yh + 0.03 - y)) * 0.35
                    if z > zr: P[k][2] = zr + (z - zr) * 0.15
        if region != 'skin':
            # clean hems: the open edges snap to their cut (a level line round the hips, a ring across the arm
            # or the shin), instead of following the mesh's quads
            for k in sorted(bset):
                i = vs[k]
                sd = '.L' if V[i][0] > 0 else '.R'
                if region == 'shirt' and abs(P[k][1] - hem_y) < 0.05 and W4[i, bi['upperarm' + sd]] < 0.3:
                    P[k][1] = hem_y + 0.002
                elif region == 'shirt' and W4[i, bi['upperarm' + sd]] + W4[i, bi['forearm' + sd]] > 0.3:
                    h, t = B['upperarm' + sd][0], B['upperarm' + sd][1]
                    tt = tparam(P[k], h, t)
                    if abs(tt - 0.5) < 0.2: P[k] += (t - h) * (0.5 - tt)
                elif region in ('trousers', 'shoes'):
                    h, t = B['shin' + sd][0], B['shin' + sd][1]
                    tt = tparam(P[k], h, t)
                    if abs(tt - 0.9) < 0.12: P[k] += (t - h) * (0.9 - tt)
        if region == 'shirt':
            # short sleeves flare a little toward the hem
            for k, i in enumerate(vs):
                sd = '.L' if V[i][0] > 0 else '.R'
                h, t = B['upperarm' + sd][0], B['upperarm' + sd][1]
                if W4[i, bi['upperarm' + sd]] > 0.3:
                    tt = max(0.0, tparam(V[i], h, t))
                    axis = h + (t - h) * tt
                    r = P[k] - axis; r -= (t - h) / np.linalg.norm(t - h) * np.dot(r, (t - h) / np.linalg.norm(t - h))
                    P[k] += r / max(np.linalg.norm(r), 1e-6) * 0.012 * min(1.0, tt / 0.5)
        if region == 'trousers':
            # straight legs: below the knee the cloth hangs, it does not follow the calf
            for k, i in enumerate(vs):
                sd = '.L' if V[i][0] > 0 else '.R'
                h, t = B['shin' + sd][0], B['shin' + sd][1]
                if W4[i, bi['shin' + sd]] + W4[i, bi['thigh' + sd]] < 0.3: continue
                tt = tparam(V[i], h, t)
                if tt < 0.05: continue
                d = (t - h) / np.linalg.norm(t - h)
                axis = h + (t - h) * tt
                r = P[k] - axis; r -= d * np.dot(r, d)
                rl = np.linalg.norm(r)
                want = 0.064 - 0.008 * min(1.0, tt)      # knee → hem
                if rl < want: P[k] = axis + r / max(rl, 1e-6) * want + d * np.dot(P[k] - axis, d)
        if region == 'shoes':
            for k, i in enumerate(vs):
                if P[k][1] < 0.03:
                    # the sole: flat underneath, a little proud of the upper all round
                    sd = '.L' if V[i][0] > 0 else '.R'
                    ax = B['foot' + sd][0]
                    r = P[k] - ax; r[1] = 0
                    P[k] += r / max(np.linalg.norm(r), 1e-6) * 0.004
                    if P[k][1] < 0.012: P[k][1] = 0.0
        base = len(out.V)
        for k, i in enumerate(vs):
            c = COL[region]
            if region == 'shoes' and P[k][1] < 0.028: c = (*SOLE, K_CLOTH)
            out.add_vertex(P[k], c, wdict(i))
        for f in Fl: out.F.append([base + j for j in f])
        # the hem: each open edge folds back to the skin
        if region != 'skin':
            for a, b in boundary_edges(Fl):
                ia, ib = vs[a], vs[b]
                na = out.add_vertex(V[ia] - N_all[ia] * 0.002, COL[region], wdict(ia))
                nb2 = out.add_vertex(V[ib] - N_all[ib] * 0.002, COL[region], wdict(ib))
                out.F.append([base + b, base + a, na, nb2])
    face(out, V, W4, names, bi, J, B, spec)
    eyes(out, V, eye_f, wdict)
    parts = [out]
    for style in spec['hair']:
        parts.append(hair(style, V, body_f, W4, bi, N_all, B, J, spec, wdict))
    if spec['bag']:
        parts.append(backpack(V, B, N_all, used, wdict, bi, W4))
    if spec.get('glasses'):
        parts.append(glasses(J))
    return B, names, parts


def _unused_collar(out, F, vs, Fl, P, V, N_all, wdict, B, col):
    """a standing collar on the neckline: the shirt's highest open loop, raised and turned out a little"""
    neck = B['neck'][0]
    edges = [(a, b) for a, b in boundary_edges(Fl) if P[a][1] > neck[1] - 0.06 and P[b][1] > neck[1] - 0.06 and abs(P[a][0]) < 0.11]
    if not edges: return
    up = (B['neck'][1] - B['neck'][0]); up /= np.linalg.norm(up)
    ring = {}
    for a, b in edges:
        for k in (a, b):
            if k in ring: continue
            p = P[k]
            out_dir = p - neck; out_dir -= up * np.dot(out_dir, up); out_dir /= max(np.linalg.norm(out_dir), 1e-6)
            front = max(0.0, out_dir[2])
            h = 0.026 - 0.012 * front                     # lower at the front, where it opens
            ring[k] = (out.add_vertex(p + up * h + out_dir * 0.006, col, wdict(vs[k])),
                       out.add_vertex(p + up * h + out_dir * 0.0, col, wdict(vs[k])))
    for a, b in edges:
        # the outer face, and its back (the collar is seen from inside too)
        oa = out.add_vertex(P[a], col, wdict(vs[a])); ob = out.add_vertex(P[b], col, wdict(vs[b]))
        out.F.append([ob, oa, ring[a][0], ring[b][0]])
        out.F.append([ring[b][1], ring[a][1], oa, ob][::-1])


def face(out, V, W4, names, bi, J, B, spec):
    """brows, the upper lash line and the lips, painted into the skin around MakeHuman's own landmarks"""
    eyeL, eyeR = J['eye.L____head'], J['eye.R____head']
    hc = spec['hair_col']
    mouth = (J['oris01____head'] + J['oris05____head']) / 2 if 'oris05____head' in J else J['oris01____head']
    for k, p in enumerate(out.V):
        c = out.C[k]
        if c[3] != K_SKIN or p[1] < mouth[1] - 0.05: continue
        for e in (eyeL, eyeR):
            dx = p[0] - e[0]; dy = p[1] - e[1]
            if p[2] < e[2] - 0.004: continue
            # the brow: a soft arch above the eye, a little fuller toward the nose
            inner = 1.0 if (dx * np.sign(e[0])) < 0 else 0.0
            arch = 0.0175 + 0.0035 * (1 - (dx / 0.025) ** 2)
            th = 0.0026 + 0.0012 * inner
            if abs(dx) < 0.025 and abs(dy - arch) < th:
                a = (1 - abs(dy - arch) / th) * (1 - max(0.0, abs(dx) / 0.025 - 0.6) / 0.4) * 0.7
                out.C[k] = (*(np.array(c[:3]) * (1 - a) + np.array(hc) * a), K_SKIN)
        # the lips, and the mouth behind them (dark, flat, no outline)
        dx, dy = p[0] - mouth[0], p[1] - mouth[1]
        if abs(dx) < 0.024 and abs(dy) < 0.014 and p[2] < mouth[2] - 0.009:
            out.C[k] = (0.40, 0.19, 0.17, K_EYE)
            continue
        if abs(dx) < 0.022 and abs(dy) < 0.007 and p[2] > mouth[2] - 0.012:
            a = (1 - (dx / 0.022) ** 2) * (1 - abs(dy) / 0.007)
            out.C[k] = (*(np.array(c[:3]) * (1 - 0.35 * a) + np.array((0.62, 0.30, 0.28)) * 0.35 * a), K_SKIN)


def eyes(out, V, eye_f, wdict):
    vs = sorted({i for f in eye_f for i in f})
    loc = {}
    for i in vs:
        p = V[i]
        cen = np.array([np.sign(p[0]) * abs(p[0]), p[1], p[2]])
        loc[i] = out.add_vertex(p, (0.92, 0.9, 0.87, K_EYE), {'head': 1.0})
    # iris and pupil: around each eyeball's front
    for side in (1, -1):
        ids = [i for i in vs if np.sign(V[i][0]) == side]
        c = V[ids].mean(axis=0)
        for i in ids:
            d = V[i] - c; d /= np.linalg.norm(d)
            ang = math.acos(max(-1, min(1, d[2])))
            if ang < 0.58:
                col = (0.16, 0.09, 0.06) if ang > 0.28 else (0.03, 0.02, 0.02)
                out.C[loc[i]] = (*col, K_EYE)
    for f in eye_f: out.F.append([loc[i] for i in f])


def hair(style, V, body_f, W4, bi, N_all, B, J, spec, wdict):
    """a shell over the scalp with a hairline, volume and a fringe; styles differ in thickness, line and length"""
    part = Part('Hair-' + style)
    hc = (*spec['hair_col'], K_HAIR)
    hb, ht = B['head'][:2]
    up = (ht - hb) / np.linalg.norm(ht - hb)
    c = hb + (ht - hb) * 0.45
    brow = (J['eye.L____head'][1] + J['eye.R____head'][1]) / 2 + 0.02
    ear_top = brow - 0.005
    nape = B['neck'][0][1] + (B['neck'][1][1] - B['neck'][0][1]) * 0.75
    S = dict(short=(0.042, 0.014, 0.034, 0.016, 0.030), buzz=(0.062, 0.005, 0.007, 0.005, 0.0), part=(0.046, 0.012, 0.030, 0.014, 0.024),
             ponytail=(0.048, 0.008, 0.014, 0.009, 0.026), bob=(0.048, 0.015, 0.026, 0.016, 0.024), **{'bob-short': (0.048, 0.013, 0.024, 0.014, 0.028)},
             grey=(0.072, 0.007, 0.012, 0.008, 0.0))[style]
    front_line, side_th, top_th, back_th, fringe = S

    def hairline(p):
        r = p - c
        th = math.atan2(r[0], r[2])
        fw, bw = max(0.0, math.cos(th)) ** 2, max(0.0, -math.cos(th)) ** 2
        return fw * (brow + front_line) + bw * nape + (1 - fw - bw) * ear_top
    F = []
    for f in body_f:
        if all(W4[i, bi['head']] + W4[i, bi['neck']] > 0.6 and V[i][1] > hairline(V[i]) for i in f): F.append(f)
    vs = sorted({i for f in F for i in f})
    loc = {v: k for k, v in enumerate(vs)}
    Fl = [[loc[i] for i in f] for f in F]
    P = V[vs].copy()
    for k, i in enumerate(vs):
        r = V[i] - c
        topness = max(0.0, np.dot(r / max(np.linalg.norm(r), 1e-6), up))
        back = max(0.0, -r[2] / max(np.linalg.norm(r), 1e-6))
        th = side_th + (top_th - side_th) * topness ** 1.5 + (back_th - side_th) * back * (1 - topness)
        P[k] += N_all[i] * th
    nb = neighbours(len(vs), Fl)
    bset = {a for e in boundary_edges(Fl) for a in e}
    P = taubin(P, nb, np.array([k not in bset for k in range(len(vs))]), it=10)
    base = 0
    for k, i in enumerate(vs): part.add_vertex(P[k], hc, {'head': 1.0})
    for f in Fl: part.F.append(list(f))
    # the fringe, the sides and the nape: the open edge of the shell grows down in tufts
    edges = boundary_edges(Fl)
    drop = {}
    for a, b in edges:
        for k in (a, b):
            if k in drop: continue
            p = P[k]; r = p - c
            th = math.atan2(r[0], r[2])
            fw = max(0.0, math.cos(th)); sw = abs(math.sin(th)); bw = max(0.0, -math.cos(th))
            # locks: a few soft waves of different lengths (seeded per style), not a regular saw
            ph = (sum(map(ord, style)) % 7) * 0.9
            tuft = 0.84 + 0.11 * math.sin(th * 5.0 + ph) + 0.05 * math.sin(th * 11.0 + ph * 2.3)
            d = fringe * fw * tuft
            if style.startswith('bob'):
                d = max(d, (0.10 if style == 'bob' else 0.075) * (sw + bw) * (0.85 + 0.15 * tuft))
            elif style in ('short', 'part', 'ponytail'):
                d = max(d, 0.012 * sw * tuft, 0.010 * bw)
            drop[k] = d
    # neighbouring locks hang to similar lengths: smooth along the hairline
    adj = {}
    for a, b in edges: adj.setdefault(a, []).append(b); adj.setdefault(b, []).append(a)
    for _ in range(4):
        drop = {k: 0.5 * d + 0.5 * (sum(drop[j] for j in adj[k]) / len(adj[k])) for k, d in drop.items()}
    rows = 3
    ring = {k: [k] for k in drop}
    for k, d in drop.items():
        if d < 0.002: continue
        p = P[k]; r = p - c
        out_dir = r.copy(); out_dir[1] = 0; out_dir /= max(np.linalg.norm(out_dir), 1e-6)
        for j in range(1, rows + 1):
            t = j / rows
            # hangs down, held a little off the face, tips narrowing in
            q = p + np.array([0, -d * t, 0]) + out_dir * (0.004 + (0.012 if style.startswith('bob') else 0.0) * t) * (1 - 0.3 * t)
            ring[k].append(part.add_vertex(q, hc, {'head': 1.0}))
    for a, b in edges:
        ra, rb = ring[a], ring[b]
        n = min(len(ra), len(rb))
        for j in range(n - 1):
            part.F.append([rb[j], ra[j], ra[j + 1], rb[j + 1]])
            part.F.append([rb[j + 1], ra[j + 1], ra[j], rb[j]])   # seen from inside too
        if n == 1:
            # no lock here: the shell's edge folds back onto the scalp, so the hair has no helmet rim
            ia, ib = vs[a], vs[b]
            sa = part.add_vertex(V[ia] - N_all[ia] * 0.001, hc, {'head': 1.0})
            sb = part.add_vertex(V[ib] - N_all[ib] * 0.001, hc, {'head': 1.0})
            part.F.append([b, a, sa, sb])
    if style == 'ponytail':
        ponytail(part, c, up, hc)
    return part


def glasses(J):
    """thin dark frames, in front of MakeHuman's own eyes: two rounded rims, a bridge, the arms to the ears"""
    part = Part('Glasses')
    col = (0.07, 0.065, 0.07, K_EYE)              # drawn flat, and without the hull outline (thin wire)
    eL, eR = J['eye.L____head'], J['eye.R____head']
    front = max(eL[2], eR[2]) + 0.014
    def tube(a, b, r=0.0012):
        a, b = np.asarray(a), np.asarray(b)
        d = b - a; d /= max(np.linalg.norm(d), 1e-9)
        u = np.cross(d, [0, 1, 0]) if abs(d[1]) < 0.9 else np.cross(d, [1, 0, 0]); u /= np.linalg.norm(u)
        v = np.cross(d, u)
        ra = [part.add_vertex(a + (u * math.cos(t) + v * math.sin(t)) * r, col, {'head': 1.0}) for t in np.linspace(0, math.tau, 5)[:-1]]
        rb = [part.add_vertex(b + (u * math.cos(t) + v * math.sin(t)) * r, col, {'head': 1.0}) for t in np.linspace(0, math.tau, 5)[:-1]]
        for k in range(4): part.F.append([ra[k], ra[(k + 1) % 4], rb[(k + 1) % 4], rb[k]])
    for e in (eL, eR):
        c = np.array([e[0], e[1] - 0.001, front])
        pts = [c + np.array([math.cos(t) * 0.022, math.sin(t) * 0.015, 0]) for t in np.linspace(0, math.tau, 17)]
        for a, b in zip(pts[:-1], pts[1:]): tube(a, b)
        side = math.copysign(1, e[0])
        hinge = c + np.array([side * 0.022, 0.002, 0])
        tube(hinge, hinge + np.array([side * 0.012, 0.002, -0.095]))
    tube(np.array([eL[0] - math.copysign(0.022, eL[0]), eL[1] + 0.003, front]), np.array([eR[0] - math.copysign(0.022, eR[0]), eR[1] + 0.003, front]))
    return part


def ponytail(part, c, up, hc):
    pts = [c + np.array([0, 0.035, -0.095]), c + np.array([0, -0.01, -0.13]), c + np.array([0, -0.09, -0.135]), c + np.array([0, -0.17, -0.12])]
    rad = [0.026, 0.03, 0.024, 0.01]
    n = 10
    rings = []
    for p, r in zip(pts, rad):
        ring = []
        for k in range(n):
            a = k / n * math.tau
            ring.append(part.add_vertex(p + np.array([math.cos(a) * r, 0, math.sin(a) * r * 0.8]), hc, {'head': 1.0}))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(n):
            part.F.append([rings[i][k], rings[i][(k + 1) % n], rings[i + 1][(k + 1) % n], rings[i + 1][k]])
    tip = part.add_vertex(pts[-1] + np.array([0, -0.03, 0.005]), hc, {'head': 1.0})
    for k in range(n): part.F.append([rings[-1][k], rings[-1][(k + 1) % n], tip])
    # the tie
    tie = []
    p = pts[0] + (pts[1] - pts[0]) * 0.5
    for k in range(n):
        a = k / n * math.tau
        tie.append(part.add_vertex(p + np.array([math.cos(a) * 0.031, 0, math.sin(a) * 0.026]), (0.62, 0.18, 0.16, K_CLOTH), {'head': 1.0}))
    tie2 = [part.add_vertex(part.V[i] + np.array([0, -0.012, 0]), (0.62, 0.18, 0.16, K_CLOTH), {'head': 1.0}) for i in tie]
    for k in range(n): part.F.append([tie[k], tie[(k + 1) % n], tie2[(k + 1) % n], tie2[k]])


def backpack(V, B, N_all, used, wdict, bi, W4):
    """a school backpack on the shoulder blades, and its straps over the shoulders"""
    part = Part('Bag')
    ch0, ch1 = B['chest'][:2]
    back_z = min(V[i][2] for i in used if abs(V[i][1] - (ch0[1] + 0.05)) < 0.03 and abs(V[i][0]) < 0.05)
    cen = np.array([0, ch0[1] + 0.03, back_z - 0.075])
    w, h, d, rr = 0.30, 0.40, 0.13, 0.035
    col = (*BAG, K_CLOTH)
    wts = {'chest': 1.0}
    # a rounded box: a superellipse in each slice
    rings = []
    ny, nk = 7, 20
    for j in range(ny):
        y = -h / 2 + h * j / (ny - 1)
        ring = []
        for k in range(nk):
            a = k / nk * math.tau
            ca, sa = math.cos(a), math.sin(a)
            x = math.copysign(abs(ca) ** 0.35, ca) * w / 2
            z = math.copysign(abs(sa) ** 0.35, sa) * d / 2
            shrink = 1 - 0.18 * (abs(y) / (h / 2)) ** 6
            ring.append(part.add_vertex(cen + np.array([x * shrink, y, z * shrink]), col, wts))
        rings.append(ring)
    for j in range(ny - 1):
        for k in range(nk):
            part.F.append([rings[j][k], rings[j + 1][k], rings[j + 1][(k + 1) % nk], rings[j][(k + 1) % nk]])
    for j, sgn in ((0, -1), (ny - 1, 1)):
        cap = part.add_vertex(cen + np.array([0, sgn * h / 2 * 1.0, 0]), col, wts)
        for k in range(nk):
            f = [rings[j][k], rings[j][(k + 1) % nk], cap]
            part.F.append(f[::-1] if sgn > 0 else f)
    # straps: from the top of the bag over each shoulder to the armpit and back to the bag's lower corner
    scol = (*STRAPS, K_CLOTH)
    for sd, sx in (('.L', 1), ('.R', -1)):
        sh = B['upperarm' + sd][0]
        pts = [cen + np.array([sx * 0.07, h / 2 - 0.02, d / 2 - 0.01]),
               np.array([sx * 0.085, sh[1] + 0.06, sh[2] - 0.06]),
               np.array([sx * 0.10, sh[1] + 0.065, sh[2] + 0.04]),
               np.array([sx * 0.115, sh[1] - 0.07, sh[2] + 0.085]),
               np.array([sx * 0.13, sh[1] - 0.16, sh[2] + 0.02]),
               cen + np.array([sx * 0.12, -h / 2 + 0.05, d / 2 - 0.02])]
        prev = None
        for t in np.linspace(0, len(pts) - 1, 26):
            i = min(int(t), len(pts) - 2); f = t - i
            p = pts[i] * (1 - f) + pts[i + 1] * f
            q0 = part.add_vertex(p + np.array([-0.02, 0, 0]), scol, {'chest': 0.7, 'shoulder' + sd: 0.3})
            q1 = part.add_vertex(p + np.array([0.02, 0, 0]), scol, {'chest': 0.7, 'shoulder' + sd: 0.3})
            if prev:
                part.F.append([prev[0], prev[1], q1, q0]); part.F.append([q0, q1, prev[1], prev[0]])
            prev = (q0, q1)
    return part


# ---------------------------------------------------------------- Blender: meshes, armature, export
def export(name, B, names, parts, out_path):
    import bpy
    from mathutils import Vector
    bpy.ops.wm.read_factory_settings(use_empty=True)
    to_bl = lambda p: Vector((p[0], -p[2], p[1]))     # glTF frame (Y up, +Z front) → Blender (Z up, -Y front)
    arm_data = bpy.data.armatures.new(name + '-rig')
    arm = bpy.data.objects.new(name, arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for n in names:
        h, t, par = B[n]
        b = arm_data.edit_bones.new(n)
        b.head, b.tail = to_bl(h), to_bl(t)
        if (b.tail - b.head).length < 1e-4: b.tail = b.head + Vector((0, 0, 0.02))
        eb[n] = b
    for n in names:
        par = B[n][2]
        if par: eb[n].parent = eb[par]
        eb[n].align_roll(Vector((0, -1, 0)))          # local Z toward the front (Blender −Y)
    bpy.ops.object.mode_set(mode='OBJECT')
    for part in parts:
        me = bpy.data.meshes.new(part.name)
        verts = [tuple(to_bl(p)) for p in part.V]
        me.from_pydata(verts, [], [list(f) for f in part.F])
        me.validate(clean_customdata=False)
        attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
        for i, c in enumerate(part.C): attr.data[i].color = (float(c[0]), float(c[1]), float(c[2]), float(c[3]))
        me.color_attributes.active_color = attr
        me.color_attributes.render_color_index = 0
        ob = bpy.data.objects.new(part.name, me)
        bpy.context.scene.collection.objects.link(ob)
        groups = {n: ob.vertex_groups.new(name=n) for n in names}
        for i, w in enumerate(part.W):
            for bn, wv in w.items():
                if wv > 1e-4: groups[bn].add([i], wv, 'REPLACE')
        mod = ob.modifiers.new('rig', 'ARMATURE'); mod.object = arm
        ob.parent = arm
        for poly in me.polygons: poly.use_smooth = True
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', export_skins=True, export_vertex_color='ACTIVE',
                              export_all_vertex_colors=False, export_influence_nb=4, export_animations=False,
                              export_yup=True, export_apply=False, export_materials='NONE', export_normals=True,
                              export_texcoords=False, export_morph=False)
    print('wrote', out_path, os.path.getsize(out_path) // 1024, 'KB', sum(len(p.V) for p in parts), 'verts')


os.makedirs(args.out, exist_ok=True)
for name, spec in FIGURES.items():
    if args.only and args.only != name: continue
    B, names, parts = build(name, spec)
    hip = B['hips'][0]
    print('  stature', spec['stature'], 'hips', round(float(hip[1]), 3), 'shoulder', round(float(B['upperarm.L'][0][1]), 3), 'parts', [(p.name, len(p.V), len(p.F)) for p in parts])
    export(name, B, names, parts, os.path.join(args.out, name + '.glb'))
