# HAIZ · 入画 — the walker, rebuilt (Blender, headless):  python3 scripts/ruhua/build_student.py
#
# The V2 figure (lanren/assets/toon/student.glb, generator not in the repository) was a few boxes on
# an 18-bone rig with three keyed clips. This one is a continuous body with a teenager's proportions
# (about seven heads, 1.68 m), the same school look (white short-sleeved shirt, navy trousers, white
# shoes, the orange backpack), an A-pose rig whose legs hang straight (so the runtime's leg IK can work
# from the bind pose), and no clips at all: lanren/ruhua/walker.js walks it procedurally.
#
#   body      a skeleton graph with per-joint radii (Skin modifier) smoothed by subdivision
#   head      its own shape (cranium, jaw, chin), ears; hair as a cap with fringe locks
#   colour    COLOR_0: rgb, and the material kind in alpha (1 cloth, 0.75 skin, 0.5 hair, 0.25 eyes),
#             as the V2 figure's shader reads it
#   weights   computed here from distances to the bone segments (two bones per vertex, sided limbs)
# Output: lanren/assets/ruhua/student.glb (~60 KB)
import bpy, bmesh, math, os
from mathutils import Vector

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../lanren/assets/ruhua/student.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)

SHIRT, TRIM, TROUSERS, BELT, SHOE, SOLE = (0.93, 0.93, 0.9), (0.2, 0.3, 0.5), (0.09, 0.12, 0.2), (0.05, 0.05, 0.06), (0.92, 0.92, 0.9), (0.55, 0.55, 0.56)
SKIN, HAIR, EYE, PACK, STRAP = (0.86, 0.66, 0.52), (0.07, 0.055, 0.05), (0.08, 0.06, 0.05), (0.78, 0.3, 0.1), (0.25, 0.22, 0.2)
K_CLOTH, K_SKIN, K_HAIR, K_EYE = 1.0, 0.75, 0.5, 0.25

# ---------------------------------------------------------------- joints (Blender: z up, facing −y; +x is the walker's left)
J = {
    'pelvis': (0, 0.0, 0.94), 'waist': (0, 0.005, 1.06), 'chest': (0, 0.0, 1.24), 'shoulders': (0, 0.01, 1.40), 'neck': (0, 0.012, 1.47),
}
for s, x in (('L', 1), ('R', -1)):
    J['hip' + s] = (0.092 * x, 0.0, 0.89); J['knee' + s] = (0.098 * x, -0.012, 0.485); J['ankle' + s] = (0.102 * x, 0.012, 0.085)
    J['heel' + s] = (0.102 * x, 0.045, 0.045); J['toe' + s] = (0.104 * x, -0.15, 0.035)
    J['sho' + s] = (0.185 * x, 0.012, 1.395); J['elbow' + s] = (0.245 * x, 0.02, 1.115); J['wrist' + s] = (0.282 * x, 0.0, 0.875); J['hand' + s] = (0.298 * x, -0.005, 0.79)

def skin_body():
    names = list(J.keys())
    idx = {n: i for i, n in enumerate(names)}
    edges = [('pelvis', 'waist'), ('waist', 'chest'), ('chest', 'shoulders'), ('shoulders', 'neck')]
    for s in 'LR':
        edges += [('pelvis', 'hip' + s), ('hip' + s, 'knee' + s), ('knee' + s, 'ankle' + s), ('ankle' + s, 'toe' + s), ('ankle' + s, 'heel' + s),
                  ('shoulders', 'sho' + s), ('sho' + s, 'elbow' + s), ('elbow' + s, 'wrist' + s), ('wrist' + s, 'hand' + s)]
    me = bpy.data.meshes.new('body')
    me.from_pydata([J[n] for n in names], [(idx[a], idx[b]) for a, b in edges], [])
    ob = bpy.data.objects.new('body', me)
    bpy.context.collection.objects.link(ob)
    mod = ob.modifiers.new('skin', 'SKIN')
    mod.branch_smoothing = 0.6
    R = {'pelvis': (0.135, 0.1), 'waist': (0.118, 0.088), 'chest': (0.142, 0.098), 'shoulders': (0.15, 0.085), 'neck': (0.046, 0.046)}
    for s in 'LR':
        R.update({'hip' + s: (0.088, 0.09), 'knee' + s: (0.058, 0.062), 'ankle' + s: (0.04, 0.045), 'toe' + s: (0.045, 0.03), 'heel' + s: (0.042, 0.035),
                  'sho' + s: (0.058, 0.058), 'elbow' + s: (0.042, 0.042), 'wrist' + s: (0.03, 0.026), 'hand' + s: (0.034, 0.016)})
    sv = me.skin_vertices[0].data
    for n, i in idx.items():
        sv[i].radius = R[n]
    sv[idx['pelvis']].use_root = True
    sub = ob.modifiers.new('sub', 'SUBSURF'); sub.levels = 2; sub.render_levels = 2
    dg = bpy.context.evaluated_depsgraph_get()
    m2 = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    return m2

def colour_body(v):
    x, y, z = v
    ax = abs(x)
    arm = ax > 0.17 and z > 0.7
    if arm:
        return (SHIRT, K_CLOTH) if z > 1.235 else ((TRIM, K_CLOTH) if z > 1.215 else (SKIN, K_SKIN))
    if z > 1.445:
        return (SKIN, K_SKIN)
    if z > 1.415 and y < 0.0:
        return (TRIM, K_CLOTH)                     # the collar
    if z > 0.975:
        return (SHIRT, K_CLOTH)
    if z > 0.94:
        return (BELT, K_CLOTH)
    if z > 0.105:
        return (TROUSERS, K_CLOTH)
    return (SOLE if z < 0.03 else SHOE, K_CLOTH)

parts = []   # (bmesh, tag)

def add_mesh(me, colour_fn, tag):
    bm = bmesh.new(); bm.from_mesh(me)
    parts.append((bm, colour_fn, tag))

add_mesh(skin_body(), colour_body, 'body')

def uv_sphere(c, r, seg=24, rings=16):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    for v in bm.verts:
        v.co = Vector((c[0] + v.co.x * r[0], c[1] + v.co.y * r[1], c[2] + v.co.z * r[2]))
    return bm

# ---- the head: a cranium with a narrower jaw and a soft chin; ears
HC = (0.0, 0.004, 1.585)
bm = uv_sphere(HC, (0.098, 0.108, 0.118), 28, 18)
for v in bm.verts:
    rel = v.co - Vector(HC)
    lower = max(0.0, -rel.z / 0.118)
    v.co.x = HC[0] + rel.x * (1.0 - 0.28 * lower ** 1.5)        # the jaw narrows
    v.co.y = HC[1] + rel.y * (1.0 - 0.12 * lower) - 0.012 * lower ** 2 * (1 if rel.y < 0 else 0)
    if rel.y < 0 and rel.z < -0.06:
        v.co.y -= 0.01 * (1 - abs(rel.x) / 0.06) if abs(rel.x) < 0.06 else 0   # the chin
parts.append((bm, lambda v: (SKIN, K_SKIN), 'head'))
for s in (1, -1):
    parts.append((uv_sphere((0.098 * s, 0.012, 1.58), (0.014, 0.022, 0.03), 10, 8), lambda v: (SKIN, K_SKIN), 'head'))
# eyes and brows
for s in (1, -1):
    parts.append((uv_sphere((0.036 * s, -0.098, 1.592), (0.014, 0.006, 0.019), 12, 8), lambda v: (EYE, K_EYE), 'head'))
    b = uv_sphere((0.038 * s, -0.099, 1.624), (0.021, 0.006, 0.0045), 8, 6)
    parts.append((b, lambda v: (HAIR, K_HAIR), 'head'))
# ---- hair: a cap over the cranium, the nape covered, the fringe in locks
bm = uv_sphere((0, 0.012, 1.6), (0.108, 0.118, 0.124), 28, 18)
kill = [v for v in bm.verts if (v.co.z < 1.585 and v.co.y < -0.02) or v.co.z < 1.5 or (v.co.z < 1.56 and abs(v.co.x) > 0.06 and v.co.y < 0.03)]
bmesh.ops.delete(bm, geom=kill, context='VERTS')
parts.append((bm, lambda v: (HAIR, K_HAIR), 'head'))
import random
random.seed(1117)
for i in range(11):
    a = -0.95 + i * 0.19
    base = Vector((math.sin(a) * 0.1, -math.cos(a) * 0.1 + 0.01, 1.655 - abs(a) * 0.02))
    tip = base + Vector((math.sin(a) * 0.02 + (random.random() - 0.5) * 0.015, -0.03, -0.075 - random.random() * 0.02))
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.026, radius2=0.002, depth=1.0)
    d = tip - base
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    for v in bm.verts:
        co = Vector((v.co.x, v.co.y * 0.55, (v.co.z + 0.5) * d.length))
        v.co = base + q @ co
    parts.append((bm, lambda v: (HAIR, K_HAIR), 'head'))
# ---- the backpack, with its straps
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0)
for v in bm.verts:
    v.co = Vector((v.co.x * 0.27, 0.205 + v.co.y * 0.12, 1.19 + v.co.z * 0.34))
bmesh.ops.bevel(bm, geom=bm.edges[:], offset=0.035, segments=3, affect='EDGES')
parts.append((bm, lambda v: (PACK, K_CLOTH), 'pack'))
for s in (1, -1):
    bm = bmesh.new()
    pts = [(0.075 * s, 0.15, 1.36), (0.085 * s, 0.03, 1.415), (0.095 * s, -0.085, 1.37), (0.105 * s, -0.1, 1.2), (0.1 * s, -0.07, 1.06), (0.095 * s, 0.12, 1.04)]
    prev = None
    for k in range(len(pts) - 1):
        a, b = Vector(pts[k]), Vector(pts[k + 1])
        c = bmesh.ops.create_cube(bm, size=1.0)
        d = b - a
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        for v in c['verts']:
            v.co = (a + b) / 2 + q @ Vector((v.co.x * 0.045, v.co.y * 0.012, v.co.z * d.length * 1.05))
    parts.append((bm, lambda v: (STRAP, K_CLOTH), 'pack'))

# ---------------------------------------------------------------- one mesh, coloured
bm_all = bmesh.new()
tags = []
for bm, fn, tag in parts:
    me = bpy.data.meshes.new('tmp'); bm.to_mesh(me); bm.free()
    off = len(bm_all.verts)
    bm_all.from_mesh(me)
    bm_all.verts.ensure_lookup_table()
    tags += [(tag, fn)] * (len(bm_all.verts) - off)
    bpy.data.meshes.remove(me)
me = bpy.data.meshes.new('StudentBody')
bm_all.to_mesh(me); bm_all.free()
col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
for i, v in enumerate(me.vertices):
    rgb, kind = tags[i][1](tuple(v.co))
    col.data[i].color = (rgb[0], rgb[1], rgb[2], kind)
me.color_attributes.active_color = col
for p in me.polygons:
    p.use_smooth = True
body = bpy.data.objects.new('StudentBody', me)
bpy.context.collection.objects.link(body)

# ---------------------------------------------------------------- the rig (A-pose; legs straight down)
arm = bpy.data.armatures.new('Rig')
rig = bpy.data.objects.new('Student', arm)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
B = {}
def bone(name, head, tail, parent=None):
    b = arm.edit_bones.new(name); b.head = head; b.tail = tail; b.roll = 0
    if parent: b.parent = B[parent]
    B[name] = b
bone('root', (0, 0, 0), (0, 0, 0.1))
bone('hips', (0, 0, 0.94), (0, 0, 1.05), 'root')
bone('spine', (0, 0, 1.05), (0, 0, 1.22), 'hips')
bone('chest', (0, 0, 1.22), (0, 0.005, 1.42), 'spine')
bone('neck', (0, 0.01, 1.43), (0, 0.006, 1.51), 'chest')
bone('head', (0, 0.006, 1.51), (0, 0.0, 1.71), 'neck')
for s, x in (('L', 1), ('R', -1)):
    bone('shoulder.' + s, (0.03 * x, 0.01, 1.385), (0.17 * x, 0.012, 1.395), 'chest')
    bone('upperarm.' + s, J['sho' + s], J['elbow' + s], 'shoulder.' + s)
    bone('forearm.' + s, J['elbow' + s], J['wrist' + s], 'upperarm.' + s)
    bone('hand.' + s, J['wrist' + s], (J['hand' + s][0], J['hand' + s][1], 0.75), 'forearm.' + s)
    bone('thigh.' + s, J['hip' + s], J['knee' + s], 'hips')
    bone('shin.' + s, J['knee' + s], J['ankle' + s], 'thigh.' + s)
    bone('foot.' + s, J['ankle' + s], (J['ankle' + s][0], -0.1, 0.03), 'shin.' + s)
    bone('toe.' + s, (J['ankle' + s][0], -0.1, 0.03), (J['ankle' + s][0], -0.17, 0.028), 'foot.' + s)
segs = {n: (Vector(b.head), Vector(b.tail)) for n, b in B.items()}
bpy.ops.object.mode_set(mode='OBJECT')

# ---------------------------------------------------------------- weights: two nearest bones, sided limbs
def seg_dist(p, a, b):
    ab = b - a; t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (a + ab * t - p).length
groups = {n: body.vertex_groups.new(name=n) for n in segs if n != 'root'}
LIMB = ('shoulder', 'upperarm', 'forearm', 'hand', 'thigh', 'shin', 'foot', 'toe')
for i, v in enumerate(me.vertices):
    p = v.co; tag = tags[i][0]
    if tag == 'head':
        w = {'head': 1.0} if p.z > 1.5 else {'head': 0.6, 'neck': 0.4}
    elif tag == 'pack':
        w = {'chest': 1.0}
    else:
        cand = []
        for n, (a, b) in segs.items():
            if n in ('root', 'head'): continue
            if n.endswith('.L') and p.x < -0.04: continue
            if n.endswith('.R') and p.x > 0.04: continue
            # the torso does not take the arms' and legs' bones beyond their roots
            if abs(p.x) < 0.13 and p.z > 0.95 and n.split('.')[0] in ('upperarm', 'forearm', 'hand', 'thigh', 'shin', 'foot', 'toe'): continue
            if p.z > 1.0 and n.split('.')[0] in ('thigh', 'shin', 'foot', 'toe'): continue
            cand.append((seg_dist(p, a, b), n))
        cand.sort()
        (d0, n0), (d1, n1) = cand[0], cand[1]
        w0, w1 = 1.0 / max(d0, 0.004) ** 4, 1.0 / max(d1, 0.004) ** 4
        # only blend across a joint (parent ↔ child), never across the body
        related = B.get(n1) is not None and (arm.bones[n1].parent and arm.bones[n1].parent.name == n0 or arm.bones[n0].parent and arm.bones[n0].parent.name == n1 or n0.split('.')[0] in ('hips', 'spine', 'chest') and n1.split('.')[0] in ('hips', 'spine', 'chest', 'neck'))
        w = {n0: w0 / (w0 + w1), n1: w1 / (w0 + w1)} if related else {n0: 1.0}
    for n, x in w.items():
        if x > 0.01: groups[n].add([i], x, 'REPLACE')
body.parent = rig
mod = body.modifiers.new('rig', 'ARMATURE'); mod.object = rig

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_skins=True, export_animations=False, export_yup=True, export_apply=False,
                          export_vertex_color='ACTIVE', export_morph=False, use_selection=True)
print('student.glb', os.path.getsize(OUT), 'bytes,', len(me.vertices), 'vertices')
