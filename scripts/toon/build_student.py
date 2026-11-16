"""HAIZ · 漫步者 — the third-person student for the stylized campus walk.

An original figure in the HAIZ uniform colours (a white school shirt with a green
collar, dark green trousers, white trainers on clay soles) with a clay-orange
backpack: warm against the green lawns, the way a single saturated garment reads
against a painted landscape. Anime proportions (about 6.5 heads), a soft skull,
a few clumps of blue-black hair, simple eyes. No existing game or film character
is copied; the design is built from primitives here.

Rig: 20 bones (root, hips, spine, chest, neck, head, arms, legs). Every bone's
local X axis is the figure's own left (+X), so +X rotation tips upright bones
forward and swings hanging limbs backwards; the script checks this numerically.
Clips (in place, 30 fps): Idle, Walk (1.45 m/s), Run (4.3 m/s), Jump.

Run: python3 scripts/toon/build_student.py      (PyPI bpy 5.x, or blender -b --python)
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import bpy  # noqa: E402,I001
from mathutils import Vector  # noqa: E402
from common import (OUT, BUILD, reset, material, Builder, tube, ico, uvsphere, rounded_box,  # noqa: E402
                    cone, trs, export_glb)

reset(30)

# ------------------------------------------------------------------ palette (sRGB)
M = {
    'Skin': material('Skin', '#f2c6a3', 0.7, kind='skin'),
    'Hair': material('Hair', '#2a2a35', 0.5, kind='hair'),
    'Shirt': material('Shirt', '#f5f3ec', 0.9),
    'Collar': material('Collar', '#2f6b52', 0.8),
    'Trousers': material('Trousers', '#2b4a3e', 0.85),
    'Shoes': material('Shoes', '#f1ede3', 0.6),
    'Sole': material('Sole', '#b8643a', 0.8),
    'Pack': material('Pack', '#de7a3b', 0.8),
    'PackDark': material('PackDark', '#a8482c', 0.8),
    'Strap': material('Strap', '#3a3934', 0.8),
    'Eye': material('Eye', '#2a1f1c', 0.3, kind='unlit'),
    'EyeHi': material('EyeHi', '#ffffff', 0.3, kind='unlit'),
    'Mouth': material('Mouth', '#b4564e', 0.6),
}

# ------------------------------------------------------------------ skeleton
BONES = {
    # name: (head, tail, parent, roll-target Z axis)
    'root': ((0, 0, 0), (0, 0, 0.12), None, (0, -1, 0)),
    'hips': ((0, 0, 0.92), (0, 0, 1.02), 'root', (0, -1, 0)),
    'spine': ((0, 0, 1.02), (0, 0, 1.18), 'hips', (0, -1, 0)),
    'chest': ((0, 0, 1.18), (0, 0, 1.38), 'spine', (0, -1, 0)),
    'neck': ((0, 0, 1.38), (0, 0, 1.46), 'chest', (0, -1, 0)),
    'head': ((0, 0, 1.46), (0, 0, 1.72), 'neck', (0, -1, 0)),
}
for s, k in (('L', 1), ('R', -1)):
    BONES.update({
        f'upperarm.{s}': ((0.175 * k, 0, 1.355), (0.205 * k, 0.01, 1.10), 'chest', (0, 1, 0)),
        f'forearm.{s}': ((0.205 * k, 0.01, 1.10), (0.215 * k, -0.005, 0.865), f'upperarm.{s}', (0, 1, 0)),
        f'hand.{s}': ((0.215 * k, -0.005, 0.865), (0.218 * k, -0.01, 0.78), f'forearm.{s}', (0, 1, 0)),
        f'thigh.{s}': ((0.088 * k, 0, 0.93), (0.092 * k, 0, 0.51), 'hips', (0, 1, 0)),
        f'shin.{s}': ((0.092 * k, 0, 0.51), (0.094 * k, 0.02, 0.10), f'thigh.{s}', (0, 1, 0)),
        f'foot.{s}': ((0.094 * k, 0.02, 0.10), (0.094 * k, -0.12, 0.03), f'shin.{s}', (0, 0.42, -0.9)),
    })


def make_armature():
    data = bpy.data.armatures.new('StudentRig')
    ob = bpy.data.objects.new('Student', data)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for name, (h, t, parent, zt) in BONES.items():
        b = data.edit_bones.new(name)
        b.head, b.tail = Vector(h), Vector(t)
        b.align_roll(Vector(zt))
        if parent:
            b.parent = eb[parent]
        b.use_connect = False
        b.use_deform = name != 'root'
        eb[name] = b
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in ob.pose.bones:
        pb.rotation_mode = 'XYZ'
    return ob


# ------------------------------------------------------------------ body
def lerp(a, b, t):
    return Vector(a).lerp(Vector(b), t)


def zweights(z, stops):
    """stops: [(z, bone)] ascending: linear blend between neighbouring bone centres."""
    if z <= stops[0][0]:
        return {stops[0][1]: 1.0}
    for (z0, b0), (z1, b1) in zip(stops, stops[1:]):
        if z <= z1:
            t = (z - z0) / (z1 - z0)
            return {b0: 1 - t, b1: t} if b0 != b1 else {b0: 1.0}
    return {stops[-1][1]: 1.0}


TORSO = [(0.95, 'hips'), (1.10, 'spine'), (1.28, 'chest'), (1.43, 'neck')]

b = Builder('StudentBody')

# shirt: worn loose over the trousers, broad at the shoulders
shirt = [(0.83, 0.174, 0.122), (0.90, 0.170, 0.117), (0.98, 0.160, 0.107), (1.06, 0.153, 0.101), (1.14, 0.160, 0.104),
         (1.24, 0.172, 0.112), (1.32, 0.180, 0.112), (1.37, 0.168, 0.105), (1.41, 0.108, 0.080), (1.435, 0.062, 0.056)]
tube(b, [((0, 0.004, z), (rx, ry), zweights(z, TORSO)) for z, rx, ry in shirt], 16, M['Shirt'])
# collar band and placket
tube(b, [((0, 0.002, 1.402), (0.090, 0.074), zweights(1.402, TORSO)), ((0, 0.004, 1.448), (0.064, 0.058), zweights(1.448, TORSO))],
     16, M['Collar'], cap0=False, cap1=False)
b.add_bm(rounded_box((0.016, 0.006, 0.20), 0.003, 1), M['Collar'], weights=lambda v: zweights(v.z, TORSO),
         xform=trs((0, -0.113, 1.27)))
# neck
tube(b, [((0, 0.006, z), (0.041, 0.039), zweights(z, [(1.40, 'neck'), (1.50, 'head')])) for z in (1.38, 1.44, 1.51)], 10, M['Skin'])
# trousers: seat and two legs
tube(b, [((0, 0.004, z), (rx, ry), {'hips': 1.0}) for z, rx, ry in ((0.79, 0.138, 0.093), (0.86, 0.148, 0.099), (0.95, 0.140, 0.094))],
     14, M['Trousers'])

for s, k in (('L', 1), ('R', -1)):
    th, sh, ft = f'thigh.{s}', f'shin.{s}', f'foot.{s}'
    # leg, hip to hem, one tube so the knee bends without a seam
    hip, knee, ankle = BONES[th][0], BONES[sh][0], BONES[ft][0]
    legs = [(0.92, 0.066, {'hips': 0.6, th: 0.4}), (0.86, 0.074, {'hips': 0.25, th: 0.75}), (0.78, 0.073, {th: 1}),
            (0.64, 0.066, {th: 1}), (0.555, 0.061, {th: 0.75, sh: 0.25}), (0.475, 0.059, {th: 0.25, sh: 0.75}),
            (0.34, 0.055, {sh: 1}), (0.20, 0.051, {sh: 1}), (0.115, 0.054, {sh: 1})]
    rings = []
    for z, r, w in legs:
        p = lerp(hip, knee, (hip[2] - z) / (hip[2] - knee[2])) if z > knee[2] else lerp(knee, ankle, (knee[2] - z) / (knee[2] - ankle[2]))
        rings.append(((p.x, p.y, z), (r, r * 0.95), w))
    tube(b, rings, 12, M['Trousers'])
    # trainers
    b.add_bm(rounded_box((0.096, 0.235, 0.082), 0.03, 2), M['Shoes'], weights={ft: 1.0}, xform=trs((0.094 * k, -0.036, 0.055)))
    b.add_bm(rounded_box((0.104, 0.248, 0.026), 0.01, 1), M['Sole'], weights={ft: 1.0}, xform=trs((0.094 * k, -0.036, 0.013)))
    # sleeve, trim, arm, hand
    ua, fa, hd = f'upperarm.{s}', f'forearm.{s}', f'hand.{s}'
    sh0, el, wr = BONES[ua][0], BONES[fa][0], BONES[hd][0]
    sleeve = [((0.150 * k, 0.0, 1.372), (0.068, 0.062), {'chest': 0.5, ua: 0.5}),
              ((0.180 * k, 0.002, 1.322), (0.066, 0.061), {'chest': 0.2, ua: 0.8}),
              ((0.195 * k, 0.005, 1.218), (0.059, 0.056), {ua: 1})]
    tube(b, sleeve, 12, M['Shirt'], cap1=False)
    tube(b, [((0.1955 * k, 0.005, 1.222), (0.061, 0.058), {ua: 1}), ((0.197 * k, 0.006, 1.206), (0.061, 0.058), {ua: 1})], 12,
         M['Collar'], cap0=False, cap1=False)
    arm = []
    for t, r in ((0.12, 0.041), (0.5, 0.038), (0.86, 0.036)):
        arm.append((lerp(sh0, el, t), r, {ua: 1.0} if t < 0.8 else {ua: 0.75, fa: 0.25}))
    for t, r in ((0.12, 0.035), (0.5, 0.032), (0.97, 0.028)):
        arm.append((lerp(el, wr, t), r, {fa: 0.75, ua: 0.25} if t < 0.2 else {fa: 1.0}))
    tube(b, [(tuple(p), (r, r * 0.92), w) for p, r, w in arm], 10, M['Skin'])
    b.add_bm(ico(2), M['Skin'], weights={hd: 1.0}, xform=trs((0.219 * k, -0.008, 0.822), (0, 0, 0), (0.028, 0.038, 0.052)))
    b.add_bm(ico(1), M['Skin'], weights={hd: 1.0}, xform=trs((0.212 * k, -0.034, 0.842), (0.5, 0, 0), (0.013, 0.013, 0.026)))
    # backpack straps: over the shoulder, down the chest, back under the arm
    path = [(0.085, 0.13, 1.315), (0.095, 0.05, 1.398), (0.105, -0.06, 1.386), (0.118, -0.114, 1.30), (0.124, -0.108, 1.17),
            (0.125, -0.02, 1.075), (0.11, 0.12, 1.06)]
    tube(b, [((x * k, y, z), (0.021, 0.0065), zweights(z, TORSO)) for x, y, z in path], 6, M['Strap'])

# head: a soft skull with a narrow chin
def skull_xform(bm):
    for v in bm.verts:
        n = v.co.copy()
        if n.z < -0.25:
            t = (-n.z - 0.25) / 0.75
            v.co.x *= 1 - 0.38 * t
            v.co.y = v.co.y * (1 - 0.15 * t) - 0.06 * t
    return bm


C = Vector((0, 0, 1.575))
b.add_bm(skull_xform(uvsphere(18, 14)), M['Skin'], weights={'head': 1.0}, xform=trs(C, (0, 0, 0), (0.115, 0.112, 0.125)))
for k in (1, -1):
    b.add_bm(ico(1), M['Skin'], weights={'head': 1.0}, xform=trs((0.112 * k, 0.006, 1.565), (0, 0, 0), (0.016, 0.026, 0.032)))
    # eyes: tall ovals with a catch light; brows
    b.add_bm(ico(2), M['Eye'], weights={'head': 1.0}, xform=trs((0.042 * k, -0.1045, 1.563), (0.12, 0, 0.32 * k), (0.0165, 0.0065, 0.025)))
    b.add_bm(ico(1), M['EyeHi'], weights={'head': 1.0}, xform=trs((0.037 * k, -0.1105, 1.573), (0, 0, 0), (0.0055, 0.003, 0.0065)))
    b.add_bm(rounded_box((0.032, 0.006, 0.0065), 0.002, 1), M['Hair'], weights={'head': 1.0},
             xform=trs((0.044 * k, -0.107, 1.603), (0, 0, -0.12 * k)))
b.add_bm(rounded_box((0.017, 0.004, 0.0035), 0.0015, 1), M['Mouth'], weights={'head': 1.0}, xform=trs((0, -0.1125, 1.508)))


# hair: a cap that leaves the face open, then clumps
def hair_cap():
    bm = uvsphere(20, 14)
    kill = [v for v in bm.verts if (v.co.y < -0.22 and v.co.z < 0.3) or v.co.z < -0.6 or (abs(v.co.x) > 0.55 and v.co.z < -0.05 and v.co.y < 0.25)]
    import bmesh
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    return bm


b.add_bm(hair_cap(), M['Hair'], weights={'head': 1.0}, xform=trs((0, 0.012, 1.593), (0, 0, 0), (0.129, 0.129, 0.136)))


def spike(base, tip, r, flat=0.55, segs=7):
    base, tip = Vector(base), Vector(tip)
    d = tip - base
    bm = cone(r, 0.002, d.length, segs)
    # flatten across the clump, then point it from base to tip
    import bmesh
    bmesh.ops.scale(bm, vec=Vector((1, flat, 1)), verts=bm.verts)
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    for v in bm.verts:
        v.co = q @ v.co + (base + tip) / 2
    return bm


for i, x in enumerate((-0.088, -0.054, -0.018, 0.02, 0.056, 0.088)):
    tipx = x * 1.15 + (0.012 if i % 2 else -0.008)
    b.add_bm(spike((x, -0.098, 1.672), (tipx, -0.126, 1.603 + 0.008 * (i % 3) - (0.012 if abs(x) > 0.07 else 0)), 0.034),
             M['Hair'], weights={'head': 1.0})
for k in (1, -1):
    b.add_bm(spike((0.112 * k, -0.035, 1.63), (0.122 * k, -0.06, 1.505), 0.032), M['Hair'], weights={'head': 1.0})
    b.add_bm(spike((0.118 * k, 0.03, 1.62), (0.13 * k, 0.05, 1.50), 0.034), M['Hair'], weights={'head': 1.0})
for a in (-0.9, -0.45, 0.0, 0.45, 0.9):
    bx, by = math.sin(a) * 0.105, math.cos(a) * 0.105 + 0.012
    b.add_bm(spike((bx, by, 1.585), (bx * 1.12, by + 0.035, 1.475), 0.038), M['Hair'], weights={'head': 1.0})
b.add_bm(spike((0.0, 0.0, 1.715), (0.03, 0.05, 1.765), 0.016, 0.8, 5), M['Hair'], weights={'head': 1.0})
b.add_bm(spike((0.02, 0.06, 1.71), (0.04, 0.13, 1.66), 0.04, 0.5), M['Hair'], weights={'head': 1.0})
b.add_bm(spike((-0.03, 0.05, 1.715), (-0.05, 0.125, 1.67), 0.04, 0.5), M['Hair'], weights={'head': 1.0})

# backpack
b.add_bm(rounded_box((0.25, 0.115, 0.30), 0.04, 3), M['Pack'], weights={'chest': 0.7, 'spine': 0.3}, xform=trs((0, 0.168, 1.185)))
b.add_bm(rounded_box((0.18, 0.04, 0.12), 0.018, 2), M['PackDark'], weights={'chest': 0.4, 'spine': 0.6}, xform=trs((0, 0.235, 1.10)))
b.add_bm(rounded_box((0.07, 0.03, 0.02), 0.008, 1), M['Strap'], weights={'chest': 1.0}, xform=trs((0, 0.17, 1.345)))

rig = make_armature()
STUDENT = material('Student', '#ffffff', 0.8)
body = b.build(smooth=True, bake=STUDENT)
body.parent = rig
mod = body.modifiers.new('Armature', 'ARMATURE')
mod.object = rig

# ------------------------------------------------------------------ check the axis convention numerically
def tail_world(name):
    bpy.context.view_layer.update()
    return rig.matrix_world @ rig.pose.bones[name].tail


rig.pose.bones['thigh.L'].rotation_euler.x = 0.5
back = tail_world('thigh.L').y
rig.pose.bones['thigh.L'].rotation_euler.x = 0.0
rig.pose.bones['spine'].rotation_euler.x = 0.4
fwd = tail_world('spine').y
rig.pose.bones['spine'].rotation_euler.x = 0.0
assert back > 0.1 and fwd < -0.03, ('bone axes are not as documented', back, fwd)


# ------------------------------------------------------------------ clips
def pos(t):
    return max(0.0, t)


def pose_walk(ph, run=False):
    s, c = math.sin(ph), math.cos(ph)
    out = {}
    for side, o in (('L', 0.0), ('R', math.pi)):
        p = ph + o
        sp, cp = math.sin(p), math.cos(p)
        if run:
            thigh = -0.78 * sp - 0.22
            knee = 0.28 + 1.65 * pos(math.cos(p + 0.55)) ** 1.15
            foot = -0.25 * sp + 0.35 * pos(-math.cos(p + 0.9))
            arm = 0.72 * sp
            fore = -1.35 - 0.22 * pos(-sp)
            spread = -0.06
        else:
            thigh = -0.44 * sp - 0.02
            knee = 0.10 + 0.85 * pos(math.cos(p + 0.35)) ** 1.5 + 0.12 * pos(sp) ** 4
            foot = -0.18 * sp + 0.30 * pos(-math.cos(p + 0.7)) - 0.08
            arm = 0.36 * sp
            fore = -0.26 - 0.24 * pos(-sp)
            spread = -0.07
        k = 1 if side == 'L' else -1
        out[f'thigh.{side}'] = (thigh, 0, 0)
        out[f'shin.{side}'] = (knee, 0, 0)
        out[f'foot.{side}'] = (foot, 0, 0)
        out[f'upperarm.{side}'] = (arm, 0, spread * k)
        out[f'forearm.{side}'] = (fore, 0, 0)
        out[f'hand.{side}'] = (0.1, 0, 0)
    if run:
        out['hips'] = (0.0, 0.16 * s, 0.03 * math.sin(2 * ph))
        out['spine'] = (0.20, -0.12 * s, 0)
        out['chest'] = (0.06, -0.14 * s, 0)
        out['neck'] = (-0.10, 0.08 * s, 0)
        out['head'] = (-0.12, 0.06 * s, 0)
        out['_hips_loc'] = (0, 0.045 * math.cos(2 * ph) - 0.03, 0)
    else:
        out['hips'] = (0.0, 0.10 * s, 0.035 * math.sin(2 * ph))
        out['spine'] = (0.05, -0.07 * s, 0)
        out['chest'] = (0.02, -0.08 * s, 0)
        out['neck'] = (-0.03, 0.05 * s, 0)
        out['head'] = (-0.02, 0.04 * s, 0)
        out['_hips_loc'] = (0, 0.022 * math.cos(2 * ph) - 0.012, 0)
    return out


def pose_idle(ph):
    s = math.sin(ph)
    out = {
        'hips': (0, 0.03 * math.sin(ph + 0.6), 0.02 * s), 'spine': (0.015 * math.sin(2 * ph), 0, -0.01 * s),
        'chest': (0.025 * math.sin(2 * ph), 0, -0.01 * s), 'neck': (0.0, 0.05 * math.sin(ph + 1.0), 0),
        'head': (0.02 * math.sin(2 * ph + 0.4), 0.07 * math.sin(ph + 1.2), 0.02 * s),
        '_hips_loc': (0.008 * s, -0.004 * (1 - math.cos(2 * ph)) * 0.5, 0),
    }
    for side, k in (('L', 1), ('R', -1)):
        out[f'upperarm.{side}'] = (0.03 * math.sin(2 * ph + k), 0, -0.07 * k)
        out[f'forearm.{side}'] = (-0.16 - 0.03 * math.sin(2 * ph), 0, 0)
        out[f'hand.{side}'] = (0.12, 0, 0)
        out[f'thigh.{side}'] = (-0.02 * k * s, 0, 0)
        out[f'shin.{side}'] = (0.04 + 0.03 * k * s, 0, 0)
        out[f'foot.{side}'] = (-0.02, 0, 0)
    return out


def pose_jump(ph):
    w = 0.05 * math.sin(ph)
    return {
        'hips': (0, 0, 0), 'spine': (0.12, 0, 0), 'chest': (0.02, 0, 0), 'neck': (-0.08, 0, 0), 'head': (-0.06, 0, 0),
        'thigh.L': (-1.05 + w, 0, 0), 'shin.L': (1.45 - w, 0, 0), 'foot.L': (0.25, 0, 0),
        'thigh.R': (-0.15 - w, 0, 0), 'shin.R': (0.95 + w, 0, 0), 'foot.R': (0.45, 0, 0),
        'upperarm.L': (0.55 + w, 0, -0.55), 'forearm.L': (-0.7, 0, 0), 'hand.L': (0.1, 0, 0),
        'upperarm.R': (-0.75 - w, 0, 0.5), 'forearm.R': (-0.9, 0, 0), 'hand.R': (0.1, 0, 0),
        '_hips_loc': (0, 0, 0),
    }


CLIPS = [('Idle', 90, pose_idle), ('Walk', 30, lambda p: pose_walk(p, False)), ('Run', 20, lambda p: pose_walk(p, True)),
         ('Jump', 24, pose_jump)]

rig.animation_data_create()
for name, frames, fn in CLIPS:
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data.action = act
    for f in range(frames + 1):
        ph = 2 * math.pi * f / frames
        pose = fn(ph)
        for pb in rig.pose.bones:
            pb.rotation_euler = pose.get(pb.name, (0, 0, 0))
            pb.keyframe_insert('rotation_euler', frame=f)
        hb = rig.pose.bones['hips']
        hb.location = pose.get('_hips_loc', (0, 0, 0))
        hb.keyframe_insert('location', frame=f)
    tr = rig.animation_data.nla_tracks.new()
    tr.name = name
    tr.strips.new(name, 0, act)
    tr.mute = True
rig.animation_data.action = None
for pb in rig.pose.bones:
    pb.rotation_euler = (0, 0, 0)
    pb.location = (0, 0, 0)

tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
print(f'student: {len(body.data.vertices)} verts, {tris} tris, {len(rig.pose.bones)} bones')
raw = os.path.join(BUILD, 'student-raw.glb')
export_glb(raw, [rig, body], animations=True)
print('wrote', raw)
