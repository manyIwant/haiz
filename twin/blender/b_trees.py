"""Trees of the forecourt and the axis: the centenary Terminalia (百年榄仁树) on its boulder, royal
palms along the axis road, the Norfolk Island pine by the plaza and the large broadleaf crowns
mapped on the Esri layer / aerial photograph.  Data and evidence: twin/data/trees.json.
"""
from __future__ import annotations
import json, math
from pathlib import Path
import numpy as np
from mathutils import Matrix
from kit import Geo
import nature

TWIN = Path(__file__).resolve().parents[1]
T = json.loads((TWIN / 'data/trees.json').read_text())

TERMINALIA_LEAVES = [('leaf.terminalia', 0.84), ('leaf.terminalia.young', 0.10), ('leaf.terminalia.old', 0.06)]


def circle(cx, cy, r, n=24):
    return [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def lanren():
    L = T['lanren']
    env = nature.Envelope(L['envelope']['poly'], L['envelope']['z_bottom'], L['envelope']['z_top_centre'],
                          L['envelope']['z_top_edge'], centre=L['envelope'].get('centre'))
    tree = nature.BroadleafTree(L['limbs'], env, seed=1923, habit='tiered', leaf_mats=TERMINALIA_LEAVES,
                                bark='bark.terminalia', spacing=1.05, twig_spacing=0.32, rosette_step=0.2,
                                leaf_len=0.27, leaf_w=0.15, n_leaves=6, min_spawn_z=3.0).grow()
    tx, ty = L['trunk_xy']
    wood, leaves = tree.geo(flare=nature.buttress(L['ground_z'], amount=0.6, height=0.9, seed=3))
    parts = {'lanren.wood': (wood, L['tag'], L['basis'], 60.0), 'lanren.leaves': (leaves, L['tag'], 'procedural leaf rosettes (seeded) inside the mapped crown; habit from lanshu-1600', None)}
    for i, b in enumerate(L['boulders']):
        g = nature.boulder(b['seed'], tuple(b['size']), lean=tuple(b.get('lean', (0, 0))))
        M = Matrix.Translation((b['xy'][0], b['xy'][1], b['z'] - 0.03)) @ Matrix.Rotation(math.radians(b.get('rot_deg', 0)), 4, 'Z')
        parts[f'lanren.boulder.{i}'] = (g.transformed(M), b['tag'], b['basis'], 50.0)
    return parts, tree.stats()


def generic(spec):
    """Rounded broadleaf with five or six primary limbs radiating from the top of the trunk."""
    rng = np.random.default_rng(spec['seed'])
    x, y = spec['trunk_xy']; z0 = spec['ground_z']
    R, H, th = spec['crown_r'], spec['height'], spec['trunk_h']
    r0 = 0.12 + 0.028 * R
    limbs = [{'id': 'trunk', 'pts': [[x, y, z0 - 0.2, r0 * 1.15], [x, y, z0 + th * 0.5, r0], [x + 0.1, y + 0.05, z0 + th, r0 * 0.9]]}]
    n = 5 + int(R > 6)
    for i in range(n):
        az = 2 * math.pi * i / n + rng.uniform(-0.3, 0.3)
        reach = R * rng.uniform(0.45, 0.7)
        rise = (H - th) * rng.uniform(0.35, 0.6)
        p0 = np.array([x + 0.1, y + 0.05, z0 + th])
        pts = [list(p0) + [r0 * 0.6]]
        for t in (0.35, 0.7, 1.0):
            q = p0 + np.array([math.cos(az) * reach * t, math.sin(az) * reach * t, rise * (t ** 0.8)])
            pts.append(list(q) + [r0 * 0.6 * (1 - 0.75 * t) + 0.02])
        limbs.append({'id': f'p{i}', 'pts': pts})
    env = nature.Envelope(circle(x, y, R), z0 + th, z0 + H, z0 + H - 0.45 * R)
    tree = nature.BroadleafTree(limbs, env, seed=spec['seed'], habit='rounded', leaf_mats=[('leaf.generic', 0.85), ('leaf.terminalia.young', 0.15)],
                                bark='bark.generic', spacing=0.9, twig_spacing=0.3, rosette_step=0.18, leaf_len=0.17, leaf_w=0.08,
                                n_leaves=8, min_spawn_z=z0 + th * 0.9).grow()
    wood, leaves = tree.geo(flare=nature.buttress(z0, amount=0.3, height=0.6, seed=spec['seed']))
    return wood, leaves, tree.stats()


def build(coll):
    stats = {}
    objs = {}
    parts, st = lanren()
    stats['lanren'] = st
    objs.update(parts)
    for spec in T['broadleaf']:
        wood, leaves, st = generic(spec)
        objs[f"{spec['id']}.wood"] = (wood, spec['tag'], spec['basis'], 60.0)
        objs[f"{spec['id']}.leaves"] = (leaves, spec['tag'], 'procedural crown (seeded)', None)
        stats[spec['id']] = st
    k = 0
    for grp in T['palms']['groups']:
        g = Geo()
        rng = np.random.default_rng(len(grp['id']) * 7)
        for x in grp['xs']:
            for i in range(grp['n']):
                y = grp['y0'] + grp['dy'] * i
                h = rng.uniform(*grp['height'])
                pg = nature.royal_palm(x, y, grp['ground_z'], height=h, seed=100 + k, lean=(rng.normal(0, 0.004), rng.normal(0, 0.004)))
                g.merge(pg)
                k += 1
        objs[f"palms.{grp['id']}"] = (g, grp['tag'], grp['basis'], 40.0)
    stats['palms'] = k
    for a in T['araucaria']:
        g = nature.araucaria(a['xy'][0], a['xy'][1], a['ground_z'], height=a['height'], seed=a['seed'])
        objs[f"araucaria.{a['id']}"] = (g, a['tag'], a['basis'], None)
    nf = 0
    for name, (g, tag, basis, smooth) in objs.items():
        if not g.faces:
            continue
        ob = g.to_object('trees.' + name, coll, smooth_angle=smooth)
        ob['haiz_tag'] = tag
        ob['haiz_basis'] = basis
        nf += len(g.faces)
    stats['faces'] = nf
    return stats
