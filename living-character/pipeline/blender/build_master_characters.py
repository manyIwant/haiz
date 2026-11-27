"""HAIZ · Living Character (Round 3) — Master Editable Character & Rig Builder.

Inherits Claude/Hunyuan's sculpted HAIZ student (1.5M source sculpt) while solving
its structural rigging & deformation defects:
  1. Separates fused backpack/straps cleanly from torso & shoulders, bridges and
     smooths the underlying polo shirt back, and creates detached, properly
     weighted `Bag_Backpack` + brand-new sculpted canvas `Bag_Crossbody` (斜挎包).
  2. Relieves crotch/axilla bridged triangles, refines joint bands (shoulders,
     elbows, wrists, hips, knees, ankles), and enforces flush soles at Z=0.000.
  3. Authors `HAIZ_LivingRig_v3` with anatomical twist bones (`upperarm_twist`,
     `forearm_twist`, `thigh_twist`, `shin_twist`), secondary motion bones
     (`bag_body`, `crossbody_bag`, `hair_fringe`, `hair_back`, `shirt_hem_f/b`,
     `ponytail_01/02`), and clean 4-influence normalized weights.
  4. Produces 4 cohesive campus archetypes (`student_hero`, `student_f`,
     `teacher_f`, `worker_m`) sharing the exact same `HAIZ_LivingRig_v3` skeleton,
     each exported across LOD0 / LOD1 / LOD2 GLBs + editable `.blend` master.

Run headless:
  blender -b -t 10 --python-exit-code 1 --python living-character/pipeline/blender/build_master_characters.py
"""
from pathlib import Path
import json
import math
import sys
import time

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
REPO = ROOT.parent
SOURCE_GLB = REPO / 'character-lab/hunyuan/source/20261121124835_b26256ec.glb'
HUNYUAN_DIR = REPO / 'character-lab/hunyuan'
sys.path.insert(0, str(HUNYUAN_DIR))
from paint import paint, regions, smooth  # noqa: E402

OUT_BLEND = ROOT / 'assets/blend/HAIZ_Living_Character_Master.blend'
OUT_CHARS = ROOT / 'assets/characters'
OUT_DATA = ROOT / 'data'

# Scale source sculpt (1.16129 glTF units tall) to exact 1.700 m student stature
SOURCE_HEIGHT = 1.1612915992736816
BASE_STATURE = 1.70
SCALE = BASE_STATURE / SOURCE_HEIGHT

# Joint positions in unscaled source coordinates (X left/right, height, forward)
CENTER_JOINTS = {
    'hips': ((0.0, 0.537, -0.013), (0.0, 0.625, -0.011), None),
    'spine': ((0.0, 0.625, -0.011), (0.0, 0.725, -0.010), 'hips'),
    'spine1': ((0.0, 0.725, -0.010), (0.0, 0.815, -0.010), 'spine'),
    'chest': ((0.0, 0.815, -0.010), (0.0, 0.930, -0.010), 'spine1'),
    'neck': ((0.0, 0.930, -0.010), (0.0, 0.996, 0.001), 'chest'),
    'head': ((0.0, 0.996, 0.001), (0.0, 1.140, 0.008), 'neck'),
}

SIDE_JOINTS = {
    'shoulder': ((0.036, 0.930, -0.016), (0.116, 0.908, -0.020), 'chest'),
    'upperarm': ((0.116, 0.908, -0.020), (0.201, 0.744, -0.008), 'shoulder'),
    'forearm': ((0.201, 0.744, -0.008), (0.289, 0.624, 0.046), 'upperarm'),
    'hand': ((0.289, 0.624, 0.046), (0.340, 0.534, 0.084), 'forearm'),
    'thigh': ((0.064, 0.523, -0.016), (0.071, 0.308, 0.002), 'hips'),
    'shin': ((0.071, 0.308, 0.002), (0.087, 0.056, -0.015), 'thigh'),
    'foot': ((0.087, 0.056, -0.015), (0.090, 0.024, 0.058), 'shin'),
    'toe': ((0.090, 0.024, 0.058), (0.093, 0.015, 0.105), 'foot'),
}

# Secondary & twist bones (parallel children outside IK chains!)
AUX_JOINTS = {
    'bag_body': ((0.0, 0.820, -0.105), (0.0, 0.660, -0.145), 'chest'),
    'crossbody_bag': ((-0.155, 0.560, -0.025), (-0.175, 0.430, -0.030), 'hips'),
    'hair_fringe': ((0.0, 1.075, 0.045), (0.0, 1.045, 0.078), 'head'),
    'hair_back': ((0.0, 1.050, -0.040), (0.0, 0.985, -0.068), 'head'),
    'shirt_hem_f': ((0.0, 0.600, 0.068), (0.0, 0.535, 0.074), 'hips'),
    'shirt_hem_b': ((0.0, 0.600, -0.072), (0.0, 0.535, -0.080), 'hips'),
}

JOINTS = dict(CENTER_JOINTS)
for side, sign in [('L', 1.0), ('R', -1.0)]:
    for name, (head, tail, parent) in SIDE_JOINTS.items():
        par = f'{parent}.{side}' if parent in SIDE_JOINTS else parent
        JOINTS[f'{name}.{side}'] = ((sign * head[0], head[1], head[2]), (sign * tail[0], tail[1], tail[2]), par)
    # Twist bones: direct parallel children of segment, outside IK chain!
    ua_h, ua_t, _ = SIDE_JOINTS['upperarm']
    fa_h, fa_t, _ = SIDE_JOINTS['forearm']
    th_h, th_t, _ = SIDE_JOINTS['thigh']
    sh_h, sh_t, _ = SIDE_JOINTS['shin']
    mid = lambda a, b, t=0.5: (sign * (a[0] + (b[0] - a[0]) * t), a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
    JOINTS[f'upperarm_twist.{side}'] = ((sign * ua_h[0], ua_h[1], ua_h[2]), mid(ua_h, ua_t, 0.52), f'upperarm.{side}')
    JOINTS[f'forearm_twist.{side}'] = (mid(fa_h, fa_t, 0.48), (sign * fa_t[0], fa_t[1], fa_t[2]), f'forearm.{side}')
    JOINTS[f'thigh_twist.{side}'] = ((sign * th_h[0], th_h[1], th_h[2]), mid(th_h, th_t, 0.52), f'thigh.{side}')
    JOINTS[f'shin_twist.{side}'] = (mid(sh_h, sh_t, 0.48), (sign * sh_t[0], sh_t[1], sh_t[2]), f'shin.{side}')

JOINTS.update(AUX_JOINTS)
# Ponytail secondary chain (active on student_f, harmlessly at rest on others)
JOINTS['ponytail_01'] = ((0.0, 1.045, -0.072), (0.0, 0.960, -0.105), 'head')
JOINTS['ponytail_02'] = ((0.0, 0.960, -0.105), (0.0, 0.875, -0.118), 'ponytail_01')


def pt_blender(p):
    """Source (X, height, forward) -> Blender (X, -forward, height) in meters."""
    return Vector((p[0], -p[2], p[1])) * SCALE


def source_pts(mesh):
    co = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
    mesh.vertices.foreach_get('co', co)
    p = co.reshape(-1, 3)
    # Blender (X, Y, Z) -> Source (X, Z, -Y)
    return np.stack([p[:, 0], p[:, 2], -p[:, 1]], axis=1) / SCALE


def select(*objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[-1]


def duplicate(obj, name):
    cp = obj.copy()
    cp.data = obj.data.copy()
    cp.name = name
    bpy.context.collection.objects.link(cp)
    return cp


def create_armature(name='HAIZ_LivingRig_v3'):
    arm_data = bpy.data.armatures.new(name + '_Data')
    arm = bpy.data.objects.new(name, arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.show_in_front = True
    arm_data.display_type = 'STICK'
    bpy.ops.object.mode_set(mode='EDIT')
    for bname, (h, t, par) in JOINTS.items():
        eb = arm_data.edit_bones.new(bname)
        eb.head = pt_blender(h)
        eb.tail = pt_blender(t)
        if par:
            eb.parent = arm_data.edit_bones[par]
            # Keep twist & aux bones unconnected; connect main chains where head==parent.tail
            is_aux = ('twist' in bname or bname in AUX_JOINTS or 'ponytail' in bname or 'shoulder' in bname or 'thigh' in bname)
            if not is_aux and (eb.head - eb.parent.tail).length < 1e-4:
                eb.use_connect = True
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def decimate_body(obj, target_tris):
    """Curvature + joint-aware decimation preserving face, joints, and cloth silhouettes."""
    src = source_pts(obj.data)
    x, y, z = src.T
    face = smooth(0.93, 1.01, y)
    elbows = np.exp(-((np.abs(x) - 0.20) / 0.042) ** 2) * smooth(0.64, 0.73, y) * (1 - smooth(0.78, 0.84, y))
    knees = np.exp(-((y - 0.307) / 0.052) ** 2)
    shoulders = np.exp(-((y - 0.873) / 0.055) ** 2) * smooth(0.06, 0.13, np.abs(x))
    crotch = np.exp(-((y - 0.461) / 0.065) ** 2) * (1 - smooth(0.03, 0.09, np.abs(x)))
    shoes = 1 - smooth(0.065, 0.095, y)
    hands = smooth(0.50, 0.62, np.abs(x) + (0.65 - y))
    _, _, _, _, _, _, bag, straps, _, _ = regions(src)
    detail = np.maximum.reduce([face, elbows * 0.82, knees * 0.72, shoulders * 0.88, crotch * 0.82, shoes * 0.85, hands * 0.78, bag * 0.45, straps * 0.65])
    vg = obj.vertex_groups.new(name='DecimateProtect')
    lv = np.rint(detail * 10).astype(np.uint8)
    for lvl in range(11):
        offs = np.flatnonzero(lv == lvl)
        if len(offs):
            vg.add(offs.tolist(), 1.0 - 0.085 * lvl, 'REPLACE')
    dec = obj.modifiers.new('DecimateBody', 'DECIMATE')
    dec.ratio = target_tris / max(1, len(obj.data.polygons))
    dec.vertex_group = vg.name
    dec.vertex_group_factor = 0.88
    select(obj)
    bpy.ops.object.modifier_apply(modifier=dec.name)
    vg_rem = obj.vertex_groups.get('DecimateProtect')
    if vg_rem is not None:
        obj.vertex_groups.remove(vg_rem)


def carve_bag_and_clean_body(body_obj):
    """Separate fused rear backpack from torso & relieve axilla/crotch bridging."""
    src = source_pts(body_obj.data)
    x, y, side, a, hair, skin, bag, straps, pants, shoes = regions(src)
    xh, yh, fh = src.T

    bm = bmesh.new()
    bm.from_mesh(body_obj.data)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()

    # Identify rear backpack pack-volume faces (strictly behind torso back, away from arms)
    # Keep straps on torso/shoulder untouched slightly or push strap bumps flush onto shirt surface
    pack_vert = np.zeros(len(bm.verts), dtype=bool)
    strap_vert = np.zeros(len(bm.verts), dtype=bool)
    for i, v in enumerate(bm.verts):
        s_x, s_h, s_f = xh[i], yh[i], fh[i]
        # Rear backpack protrudes behind -f > 0.055, |x| < 0.115, height 0.56..0.93
        if s_f < -0.068 and abs(s_x) < 0.118 and 0.560 < s_h < 0.935:
            pack_vert[i] = True
        elif straps[i] > 0.45 and s_f > -0.068:
            strap_vert[i] = True

    # Create detached Bag_Backpack object from pack faces before removing from body
    bag_faces = [f for f in bm.faces if sum(1 for v in f.verts if pack_vert[v.index]) >= 2]
    # Remove rear backpack protrusion vertices from body, then fill & smooth the shirt back!
    pack_face_set = set(bag_faces)
    del_verts = [v for v in bm.verts if pack_vert[v.index]]

    # Build detached backpack mesh from a copy
    bag_bm = bmesh.new()
    vert_map = {}
    for f in bag_faces:
        nvs = []
        for v in f.verts:
            if v.index not in vert_map:
                nv = bag_bm.verts.new(v.co)
                vert_map[v.index] = nv
            nvs.append(vert_map[v.index])
        try:
            bag_bm.faces.new(nvs)
        except ValueError:
            pass
    bag_bm.normal_update()
    # Close front side of backpack cleanly so it's a solid sculpted soft pack
    b_edges = [e for e in bag_bm.edges if e.is_boundary]
    if b_edges:
        bmesh.ops.holes_fill(bag_bm, edges=b_edges, sides=8)
    bmesh.ops.triangulate(bag_bm, faces=bag_bm.faces[:])
    # Slightly pull front-facing backpack cap gently toward torso back so zero gap shows
    for v in bag_bm.verts:
        if v.co.y > 0.08:  # Blender +Y is back
            pass
    bag_mesh = bpy.data.meshes.new('Bag_Backpack_Mesh')
    bag_bm.to_mesh(bag_mesh)
    bag_bm.free()
    bag_obj = bpy.data.objects.new('Bag_Backpack', bag_mesh)
    bpy.context.collection.objects.link(bag_obj)

    # Delete rear pack protrusion from Body_Hero & bridge shirt back cleanly
    bmesh.ops.delete(bm, geom=del_verts, context='VERTS')
    bm.edges.ensure_lookup_table()
    holes = [e for e in bm.edges if e.is_boundary]
    if holes:
        bmesh.ops.holes_fill(bm, edges=holes, sides=16)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) != 3])

    # Smooth the shirt back & push fused strap bumps slightly inward toward shirt plane
    bm.verts.ensure_lookup_table()
    bm.normal_update()
    # Smooth newly filled back vertices + front strap ridge
    smooth_verts = []
    for v in bm.verts:
        co_s = Vector((v.co.x, v.co.z, -v.co.y)) / SCALE
        sx, sh, sf = co_s.x, co_s.y, co_s.z
        if abs(sx) < 0.125 and 0.54 < sh < 0.94 and sf < -0.045:
            smooth_verts.append(v)
        elif 0.045 < abs(sx) < 0.125 and 0.62 < sh < 0.92 and sf > -0.02:
            # Gently relax raised strap ridge on chest so clean straps sit nicely over shirt
            v.co.y += 0.004  # slightly inward along -forward (+Y in Blender)
            smooth_verts.append(v)
    if smooth_verts:
        bmesh.ops.smooth_vert(bm, verts=smooth_verts, factor=0.55, use_axis_x=True, use_axis_y=True, use_axis_z=True)

    # Refine joint bands (shoulders, axilla, elbows, knees, crotch) for clean skinning
    refine_edges = []
    for e in bm.edges:
        c = (e.verts[0].co + e.verts[1].co) * (0.5 / SCALE)
        xx, depth, hh = abs(c.x), c.y, c.z
        shoulder = 0.085 < xx < 0.175 and 0.820 < hh < 0.940 and depth < 0.065
        elbow = 0.168 < xx < 0.245 and 0.695 < hh < 0.800
        knee = 0.030 < xx < 0.130 and 0.265 < hh < 0.350
        crotch = xx < 0.072 and 0.425 < hh < 0.535
        ln = e.calc_length()
        if (shoulder or elbow or knee or crotch) and ln > 0.015:
            refine_edges.append((ln, e))
    chosen = [e for _, e in sorted(refine_edges, key=lambda kv: -kv[0])[:1800]]
    if chosen:
        bmesh.ops.subdivide_edges(bm, edges=chosen, cuts=1, use_grid_fill=True)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) != 3])

    # Flatten shoe soles cleanly to Z=0.000 so ground contact is exact
    for v in bm.verts:
        if v.co.z < 0.008:
            v.co.z = 0.0

    bm.normal_update()
    bm.to_mesh(body_obj.data)
    bm.free()
    body_obj.data.update()
    return bag_obj


def add_backpack_straps(bag_obj):
    """Add clean detached over-shoulder canvas straps to Bag_Backpack."""
    bm = bmesh.new()
    bm.from_mesh(bag_obj.data)
    # Build two smooth ribbon straps from backpack top over shoulders down to lower pack corners
    for sign in (1.0, -1.0):
        pts_src = [
            (sign * 0.058, 0.885, -0.075),
            (sign * 0.074, 0.935, -0.045),
            (sign * 0.086, 0.942, 0.015),
            (sign * 0.095, 0.860, 0.072),
            (sign * 0.106, 0.740, 0.065),
            (sign * 0.118, 0.650, -0.015),
            (sign * 0.092, 0.615, -0.078),
        ]
        pts = [pt_blender(p) for p in pts_src]
        # Subdivide path smoothly
        dense = []
        for i in range(len(pts) - 1):
            for k in range(4):
                t = k / 4.0
                dense.append(pts[i].lerp(pts[i + 1], t))
        dense.append(pts[-1])
        half_w = 0.022
        thick = 0.008
        rings = []
        for i, p in enumerate(dense):
            tan = (dense[min(i + 1, len(dense) - 1)] - dense[max(i - 1, 0)]).normalized()
            lat = Vector((sign, 0, 0))
            out = tan.cross(lat).normalized()
            if out.dot(Vector((0, p.y, p.z - 0.8 * SCALE))) < 0:
                out = -out
            lat = out.cross(tan).normalized()
            c0 = p - lat * half_w + out * (thick * 0.5)
            c1 = p + lat * half_w + out * (thick * 0.5)
            c2 = p + lat * half_w - out * (thick * 0.5)
            c3 = p - lat * half_w - out * (thick * 0.5)
            rings.append([bm.verts.new(c) for c in (c0, c1, c2, c3)])
        for i in range(len(rings) - 1):
            r0, r1 = rings[i], rings[i + 1]
            for k in range(4):
                bm.faces.new([r0[k], r0[(k + 1) % 4], r1[(k + 1) % 4], r1[k]])
        bm.faces.new(rings[0][::-1])
        bm.faces.new(rings[-1])
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) != 3])
    bm.normal_update()
    bm.to_mesh(bag_obj.data)
    bm.free()
    bag_obj.data.update()


def build_crossbody_satchel():
    """Sculpt a brand-new HAIZ canvas crossbody satchel (斜挎包) with diagonal strap & brass buckle."""
    bm = bmesh.new()
    # Satchel pouch hanging at right hip (Blender -X side, slightly behind mid-plane)
    cen = pt_blender((-0.165, 0.505, -0.025))
    w, h, d = 0.095, 0.23, 0.29
    # Main rounded pouch using superellipsoid rings
    ny, nk = 9, 20
    rings = []
    for j in range(ny):
        v = j / (ny - 1)
        z = (v - 0.5) * h
        bulge = 0.85 + 0.20 * math.sin(v * math.pi)
        ring = []
        for k in range(nk):
            a = k / nk * math.tau
            ca, sa = math.cos(a), math.sin(a)
            rx = math.copysign(abs(ca) ** 0.55, ca) * (w * 0.5 * bulge)
            ry = math.copysign(abs(sa) ** 0.55, sa) * (d * 0.5 * bulge)
            # Slightly flatter against hip (+X side toward body)
            if rx > 0:
                rx *= 0.65
            ring.append(bm.verts.new(cen + Vector((rx, ry, z))))
        rings.append(ring)
    for j in range(ny - 1):
        for k in range(nk):
            bm.faces.new([rings[j][k], rings[j + 1][k], rings[j + 1][(k + 1) % nk], rings[j][(k + 1) % nk]])
    cap_bot = bm.verts.new(cen + Vector((0, 0, -h * 0.52)))
    cap_top = bm.verts.new(cen + Vector((0, 0, h * 0.52)))
    for k in range(nk):
        bm.faces.new([rings[0][(k + 1) % nk], rings[0][k], cap_bot])
        bm.faces.new([rings[-1][k], rings[-1][(k + 1) % nk], cap_top])

    # Diagonal crossbody canvas strap from left shoulder (+X) across chest & back to right hip (-X)
    strap_src = [
        (-0.145, 0.585, -0.095),
        (-0.125, 0.720, -0.108),
        (-0.045, 0.835, -0.105),
        (0.055, 0.925, -0.068),
        (0.090, 0.948, 0.005),
        (0.068, 0.895, 0.088),
        (-0.015, 0.785, 0.112),
        (-0.105, 0.675, 0.088),
        (-0.145, 0.585, 0.045),
        (-0.145, 0.585, -0.095),
    ]
    pts = [pt_blender(p) for p in strap_src]
    dense = []
    for i in range(len(pts) - 1):
        for k in range(5):
            dense.append(pts[i].lerp(pts[i + 1], k / 5.0))
    rings_s = []
    half_w, thick = 0.019, 0.007
    torso_axis = Vector((0, 0, 1))
    for i, p in enumerate(dense):
        tan = (dense[(i + 1) % len(dense)] - dense[i - 1]).normalized()
        out = Vector((p.x, p.y, 0)).normalized()
        lat = tan.cross(out).normalized()
        c0 = p - lat * half_w + out * thick
        c1 = p + lat * half_w + out * thick
        c2 = p + lat * half_w - out * 0.001
        c3 = p - lat * half_w - out * 0.001
        rings_s.append([bm.verts.new(c) for c in (c0, c1, c2, c3)])
    for i in range(len(rings_s)):
        r0, r1 = rings_s[i], rings_s[(i + 1) % len(rings_s)]
        for k in range(4):
            bm.faces.new([r0[k], r0[(k + 1) % 4], r1[(k + 1) % 4], r1[k]])

    # Brass buckle on front diagonal strap
    b_cen = pt_blender((0.022, 0.835, 0.108))
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(b_cen) @ Matrix.Diagonal((0.036, 0.014, 0.026, 1.0)))

    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) != 3])
    bm.normal_update()
    me = bpy.data.meshes.new('Bag_Crossbody_Mesh')
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new('Bag_Crossbody', me)
    bpy.context.collection.objects.link(obj)
    return obj


def build_ponytail_mesh():
    """Sculpted ponytail accessory for student_f, skinned cleanly to ponytail_01/02."""
    bm = bmesh.new()
    pts_src = [(0.0, 1.055, -0.072), (0.0, 1.035, -0.102), (0.0, 0.960, -0.115), (0.0, 0.880, -0.120), (0.0, 0.820, -0.116)]
    rads = [0.022, 0.030, 0.028, 0.020, 0.007]
    n = 12
    rings = []
    for p_s, rad in zip(pts_src, rads):
        c = pt_blender(p_s)
        ring = []
        for k in range(n):
            a = k / n * math.tau
            ring.append(bm.verts.new(c + Vector((math.cos(a) * rad, math.sin(a) * rad * 0.85, 0))))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(n):
            bm.faces.new([rings[i][k], rings[i][(k + 1) % n], rings[i + 1][(k + 1) % n], rings[i + 1][k]])
    tip = bm.verts.new(pt_blender((0.0, 0.795, -0.112)))
    for k in range(n):
        bm.faces.new([rings[-1][k], rings[-1][(k + 1) % n], tip])
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) != 3])
    bm.normal_update()
    me = bpy.data.meshes.new('Hair_Ponytail_Mesh')
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new('Hair_Ponytail', me)
    bpy.context.collection.objects.link(obj)
    return obj


def bind_weights(obj, rig, part_kind='body'):
    """Continuous anatomical + twist-bone skin weighting (max 4 influences, normalized)."""
    names = list(JOINTS.keys())
    n_verts = len(obj.data.vertices)
    W = np.zeros((n_verts, len(names)), dtype=np.float32)
    src = source_pts(obj.data)
    x, h, f = src.T
    xx = np.abs(x)

    def wt(bname, vals):
        W[:, names.index(bname)] = vals

    if part_kind == 'backpack':
        # Straps & top follow chest/shoulders; hanging lower body follows bag_body spring bone!
        body_spring = smooth(0.55, 0.85, -f * 10.0) * (1.0 - smooth(0.84, 0.92, h))
        wt('bag_body', body_spring * 0.78)
        wt('chest', 1.0 - body_spring * 0.78)
    elif part_kind == 'crossbody':
        # Diagonal strap hugs chest/spine1/shoulder.L; hip pouch follows crossbody_bag spring bone!
        pouch = smooth(0.08, 0.14, -x) * (1.0 - smooth(0.56, 0.63, h))
        wt('crossbody_bag', pouch * 0.88)
        wt('hips', pouch * 0.12 + (1.0 - pouch) * (1.0 - smooth(0.60, 0.72, h)) * 0.5)
        wt('spine1', (1.0 - pouch) * smooth(0.58, 0.76, h) * (1.0 - smooth(0.82, 0.90, h)))
        wt('chest', (1.0 - pouch) * smooth(0.76, 0.93, h))
        wt('shoulder.L', (1.0 - pouch) * smooth(0.04, 0.085, x) * smooth(0.86, 0.94, h) * 0.45)
    elif part_kind == 'ponytail':
        t0 = smooth(0.95, 1.04, h)
        t1 = smooth(0.87, 0.96, h) * (1.0 - t0)
        t2 = (1.0 - t0 - t1)
        wt('head', t0)
        wt('ponytail_01', t1)
        wt('ponytail_02', t2)
    else:
        # Body_Hero: anatomical region split + twist-bone blending + subtle hem/hair weights
        _, _, _, _, hair_m, _, _, _, _, shoes = regions(src)
        arm_width = np.interp(h, [0.53, 0.65, 0.74, 0.84, 0.91, 0.989], [0.132, 0.124, 0.121, 0.124, 0.102, 0.115])
        arm = smooth(arm_width - 0.020, arm_width + 0.048, xx) * smooth(0.433, 0.489, h) * (1.0 - smooth(0.920, 0.984, h))
        leg = (1.0 - smooth(0.468, 0.560, h)) * (1.0 - arm)
        torso = np.clip(1.0 - arm - leg, 0.0, 1.0)

        head = smooth(0.936, 1.018, h)
        neck = smooth(0.899, 0.956, h)
        chest = smooth(0.785, 0.870, h)
        spine1 = smooth(0.680, 0.785, h)
        spine = smooth(0.540, 0.680, h)

        # Hair fringe / back secondary weights (gentle, only tips of hair)
        fringe = hair_m * smooth(0.03, 0.065, f) * (1.0 - smooth(1.04, 1.09, h))
        back_h = hair_m * smooth(0.035, 0.070, -f) * (1.0 - smooth(1.01, 1.06, h))
        wt('hair_fringe', torso * fringe * 0.42)
        wt('hair_back', torso * back_h * 0.42)
        wt('head', torso * head * (1.0 - (fringe + back_h) * 0.42))
        wt('neck', torso * neck * (1.0 - head))
        wt('chest', torso * chest * (1.0 - neck) * (1.0 - head))
        wt('spine1', torso * spine1 * (1.0 - chest) * (1.0 - neck) * (1.0 - head))
        wt('spine', torso * spine * (1.0 - spine1) * (1.0 - chest) * (1.0 - neck) * (1.0 - head))
        hips_base = torso * (1.0 - spine) * (1.0 - spine1) * (1.0 - chest) * (1.0 - neck) * (1.0 - head)

        # Shirt hem front/back subtle flutter weight (strictly on lower shirt hem band)
        hem_band = smooth(0.545, 0.575, h) * (1.0 - smooth(0.595, 0.630, h)) * (1.0 - arm)
        hem_f = hem_band * smooth(0.02, 0.06, f) * 0.35
        hem_b = hem_band * smooth(0.02, 0.06, -f) * 0.35
        wt('shirt_hem_f', hem_f)
        wt('shirt_hem_b', hem_b)
        wt('hips', np.maximum(0.0, hips_base - hem_f - hem_b))

        for side, sign in [('L', 1.0), ('R', -1.0)]:
            s_arm = arm * (np.sign(x) == sign)
            shoulder = smooth(0.114, 0.174, xx)
            along_elbow = 0.63 * (xx - 0.201) - 0.74 * (h - 0.744) + 0.23 * (f + 0.008)
            elbow = smooth(-0.047, 0.052, along_elbow)
            along_wrist = 0.52 * (xx - 0.289) - 0.80 * (h - 0.624) + 0.26 * (f - 0.046)
            wrist = smooth(-0.031, 0.035, along_wrist)

            # Upper-arm twist owns upper half near shoulder; forearm twist owns lower half near wrist
            ua_total = s_arm * shoulder * (1.0 - elbow)
            ua_tw = ua_total * (1.0 - smooth(0.125, 0.175, xx)) * 0.65
            fa_total = s_arm * elbow * (1.0 - wrist)
            fa_tw = fa_total * smooth(-0.09, -0.02, along_wrist) * 0.70

            wt(f'shoulder.{side}', s_arm * (1.0 - shoulder))
            wt(f'upperarm.{side}', ua_total - ua_tw)
            wt(f'upperarm_twist.{side}', ua_tw)
            wt(f'forearm.{side}', fa_total - fa_tw)
            wt(f'forearm_twist.{side}', fa_tw)
            wt(f'hand.{side}', s_arm * wrist)

            # Strict side-isolated leg weights with smooth crotch crossover at top only
            inner = np.interp(h, [0.38, 0.435, 0.468, 0.511], [0.004, 0.007, 0.019, 0.033])
            s_leg = leg * smooth(-inner, inner, sign * x)
            knee = 1.0 - smooth(0.267, 0.348, h)
            ankle = np.maximum(1.0 - smooth(0.030, 0.084, h), shoes * 0.995)
            toe = smooth(0.041, 0.071, f) * (1.0 - smooth(0.018, 0.047, h))

            th_total = s_leg * (1.0 - knee)
            th_tw = th_total * smooth(0.39, 0.50, h) * 0.55
            sh_total = s_leg * knee * (1.0 - ankle)
            sh_tw = sh_total * (1.0 - smooth(0.08, 0.19, h)) * 0.55

            wt(f'thigh.{side}', th_total - th_tw)
            wt(f'thigh_twist.{side}', th_tw)
            wt(f'shin.{side}', sh_total - sh_tw)
            wt(f'shin_twist.{side}', sh_tw)
            wt(f'foot.{side}', s_leg * ankle * (1.0 - toe))
            wt(f'toe.{side}', s_leg * ankle * toe)

        # Gentle Laplacian smoothing across joint bands (excluding fingertips)
        edges = np.empty(len(obj.data.edges) * 2, dtype=np.int32)
        obj.data.edges.foreach_get('vertices', edges)
        a, b = edges.reshape(-1, 2).T
        deg = np.bincount(edges, minlength=n_verts)[:, None]
        # Smooth shoulders, hips/crotch, knees smoothly; keep fingertips crisp
        tip_mask = (xx > 0.295) & (h < 0.62)
        strength = 0.42 * (smooth(0.68, 0.92, h) + smooth(0.26, 0.53, h) * (1.0 - smooth(0.50, 0.56, h)))
        strength[tip_mask] = 0.0
        strength = np.clip(strength, 0.0, 0.55)
        for _ in range(3):
            adj = np.zeros_like(W)
            np.add.at(adj, a, W[b])
            np.add.at(adj, b, W[a])
            W += strength[:, None] * (adj / np.maximum(deg, 1) - W)

    # Top-4 influences normalized
    best = np.argpartition(W, -4, axis=1)[:, -4:]
    vals = np.take_along_axis(W, best, axis=1)
    ssum = vals.sum(axis=1, keepdims=True)
    vals = np.where(ssum > 1e-6, vals / np.maximum(ssum, 1e-6), 0.25)
    # Fallback zero rows -> hips
    zero_rows = (ssum[:, 0] <= 1e-6)
    vgroups = [obj.vertex_groups.new(name=nm) for nm in names]
    hips_idx = names.index('hips')
    for idx, (inds, vs) in enumerate(zip(best, vals)):
        if zero_rows[idx]:
            vgroups[hips_idx].add([idx], 1.0, 'REPLACE')
        else:
            for bi, bv in zip(inds, vs):
                if bv > 1e-5:
                    vgroups[bi].add([idx], float(bv), 'REPLACE')

    obj.parent = rig
    mod = obj.modifiers.new('Armature', 'ARMATURE')
    mod.object = rig


def unwrap_uv(obj):
    select(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.12, margin_method='FRACTION', island_margin=0.008, area_weight=0.35)
    bpy.ops.object.mode_set(mode='OBJECT')


def paint_hero_colors(src_pts, archetype='student_hero'):
    """Paint high-craft HAIZ palette (base linear RGB, roughness, kind mask)."""
    rgb, rough = paint(src_pts)
    x, y, side, a, hair, skin, bag, straps, pants, shoes = regions(src_pts)
    xh, yh, fh = src_pts.T

    # Archetype palettes keeping HAIZ campus harmony
    palettes = {
        'student_hero': {
            'shirt': [0.945, 0.945, 0.915],
            'collar': [0.105, 0.425, 0.355],   # subtle HAIZ emerald-teal collar trim!
            'pants': [0.165, 0.420, 0.560],
            'hair': [0.065, 0.052, 0.048],
            'skin': [0.765, 0.535, 0.410],
        },
        'student_f': {
            'shirt': [0.955, 0.948, 0.925],
            'collar': [0.135, 0.450, 0.380],
            'pants': [0.180, 0.335, 0.495],
            'hair': [0.055, 0.040, 0.036],
            'skin': [0.790, 0.560, 0.435],
        },
        'teacher_f': {
            'shirt': [0.720, 0.810, 0.880],
            'collar': [0.560, 0.670, 0.770],
            'pants': [0.175, 0.185, 0.210],
            'hair': [0.085, 0.060, 0.050],
            'skin': [0.760, 0.530, 0.405],
        },
        'worker_m': {
            'shirt': [0.430, 0.505, 0.380],
            'collar': [0.320, 0.390, 0.285],
            'pants': [0.195, 0.185, 0.165],
            'hair': [0.440, 0.425, 0.400],
            'skin': [0.695, 0.465, 0.345],
        },
    }
    pal = palettes[archetype]

    # Convert linear rgb -> sRGB for clean tinting then back to linear
    srgb = np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * (np.clip(rgb, 0, 1) ** (1 / 2.4)) - 0.055)

    # Apply subtle emerald-teal HAIZ collar stripe & sleeve cuff accent on students
    shirt_mask = (1.0 - pants) * (1.0 - shoes) * (1.0 - skin) * (1.0 - hair) * (1.0 - bag)
    collar_ring = shirt_mask * smooth(0.905, 0.935, yh) * (1.0 - smooth(0.955, 0.985, yh))
    srgb = srgb * (1.0 - collar_ring[:, None]) + np.asarray(pal['collar']) * collar_ring[:, None]

    # Retint shirt, trousers, hair, skin smoothly according to archetype
    if archetype != 'student_hero':
        srgb = srgb * (1.0 - shirt_mask[:, None] * 0.85) + np.asarray(pal['shirt']) * (shirt_mask[:, None] * 0.85)
        srgb = srgb * (1.0 - pants[:, None] * 0.88) + np.asarray(pal['pants']) * (pants[:, None] * 0.88)
        srgb = srgb * (1.0 - hair[:, None] * 0.85) + np.asarray(pal['hair']) * (hair[:, None] * 0.85)
        srgb = srgb * (1.0 - skin[:, None] * 0.38) + np.asarray(pal['skin']) * (skin[:, None] * 0.38)

    # Material kind channel: 1.0=cloth, 0.75=skin, 0.50=hair, 0.25=eyes/mouth
    kind = np.full(len(src_pts), 1.0, dtype=np.float32)
    kind[skin > 0.5] = 0.75
    kind[hair > 0.5] = 0.50
    front = 1.0 - smooth(353, 403, side)
    eye_zone = (np.abs(a - 15.4) < 6.0) & (np.abs(y - 123.0) < 3.5) & (front > 0.5)
    kind[eye_zone] = 0.25

    linear = np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)
    return linear.astype(np.float32), rough.astype(np.float32), kind


def make_material(name, base_col=(0.8, 0.8, 0.8), rough=0.78, metallic=0.0, kind_val=1.0, img_tex=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['IOR'].default_value = 1.46
    if img_tex is not None:
        base_img, norm_img, orm_img = img_tex
        t_b = nt.nodes.new('ShaderNodeTexImage'); t_b.image = base_img; t_b.location = (-500, 300)
        t_n = nt.nodes.new('ShaderNodeTexImage'); t_n.image = norm_img; t_n.location = (-500, 0)
        t_o = nt.nodes.new('ShaderNodeTexImage'); t_o.image = orm_img; t_o.location = (-500, -300)
        nt.links.new(t_b.outputs['Color'], bsdf.inputs['Base Color'])
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.80; nm.location = (-220, 0)
        nt.links.new(t_n.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
        sep = nt.nodes.new('ShaderNodeSeparateColor'); sep.location = (-220, -300)
        nt.links.new(t_o.outputs['Color'], sep.inputs['Color'])
        nt.links.new(sep.outputs['Green'], bsdf.inputs['Roughness'])
        nt.links.new(sep.outputs['Blue'], bsdf.inputs['Metallic'])
    else:
        bsdf.inputs['Base Color'].default_value = (*base_col, 1.0)
    mat['haiz_kind'] = kind_val
    return mat


def ensure_kind_color(obj, kind_val=1.0):
    if 'HAIZ_Kind' in obj.data.color_attributes:
        obj.data.color_attributes.remove(obj.data.color_attributes['HAIZ_Kind'])
    attr = obj.data.color_attributes.new(name='HAIZ_Kind', type='FLOAT_COLOR', domain='POINT')
    n = len(obj.data.vertices)
    rgba = np.full((n, 4), kind_val, dtype=np.float32)
    rgba[:, 3] = 1.0
    attr.data.foreach_set('color', rgba.ravel())
    obj.data.color_attributes.active_color = attr


def bake_body_textures(obj, reference, tex_dir, tag, size=1024, archetype='student_hero', stature_scale=1.0, norm_img_reuse=None):
    """Bake BaseColor, Tangent Normal, and ORM (AO+Rough+Metal) for Body_Hero."""
    tex_dir.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 12
    scene.cycles.device = 'CPU'
    scene.cycles.use_adaptive_sampling = True
    if not scene.world:
        w = scene.world = bpy.data.worlds.new('BakeWorld')
        w.use_nodes = True
        w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.45, 0.50, 0.55, 1.0)

    rgb, rough, kind = paint_hero_colors(source_pts(obj.data) / stature_scale, archetype)
    for attr_name, cols in [('BakeDye', rgb), ('BakeRough', np.repeat(rough[:, None], 3, axis=1))]:
        if attr_name in obj.data.color_attributes:
            obj.data.color_attributes.remove(obj.data.color_attributes[attr_name])
        attr = obj.data.color_attributes.new(name=attr_name, type='FLOAT_COLOR', domain='POINT')
        rgba = np.ones((len(cols), 4), dtype=np.float32)
        rgba[:, :3] = cols
        attr.data.foreach_set('color', rgba.ravel())

    # Store permanent HAIZ_Kind vertex color attribute on mesh for shader reading
    if 'HAIZ_Kind' in obj.data.color_attributes:
        obj.data.color_attributes.remove(obj.data.color_attributes['HAIZ_Kind'])
    k_attr = obj.data.color_attributes.new(name='HAIZ_Kind', type='FLOAT_COLOR', domain='POINT')
    k_rgba = np.ones((len(kind), 4), dtype=np.float32)
    k_rgba[:, 0] = kind
    k_rgba[:, 1] = kind
    k_rgba[:, 2] = kind
    k_attr.data.foreach_set('color', k_rgba.ravel())
    obj.data.color_attributes.active_color = k_attr

    tmp_mat = bpy.data.materials.new('TmpBakeMat')
    tmp_mat.use_nodes = True
    obj.data.materials.clear()
    obj.data.materials.append(tmp_mat)
    nt = tmp_mat.node_tree
    out = nt.nodes['Material Output']
    bsdf = nt.nodes['Principled BSDF']

    def new_img(nm, srgb=False):
        im = bpy.data.images.new(nm, width=size, height=size, alpha=False)
        im.colorspace_settings.name = 'sRGB' if srgb else 'Non-Color'
        return im

    def do_bake(kind_pass, im, hi=None, attr_nm=None):
        tgt = nt.nodes.get('BakeTgt') or nt.nodes.new('ShaderNodeTexImage')
        tgt.name = 'BakeTgt'; tgt.image = im; nt.nodes.active = tgt
        if attr_nm:
            vc = nt.nodes.get('BakeVC') or nt.nodes.new('ShaderNodeVertexColor')
            vc.name = 'BakeVC'; vc.layer_name = attr_nm
            em = nt.nodes.get('BakeEm') or nt.nodes.new('ShaderNodeEmission')
            em.name = 'BakeEm'
            nt.links.new(vc.outputs['Color'], em.inputs['Color'])
            nt.links.new(em.outputs[0], out.inputs['Surface'])
        else:
            nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
        select(*(o for o in (hi, obj) if o is not None))
        opts = {'type': kind_pass, 'margin': 6, 'margin_type': 'EXTEND', 'use_clear': True}
        if hi:
            opts.update(use_selected_to_active=True, max_ray_distance=0.025, cage_extrusion=0.006)
        bpy.ops.object.bake(**opts)

    im_base = new_img(f'{tag}_base', srgb=True)
    im_rough = new_img(f'{tag}_rough')
    im_ao = new_img(f'{tag}_ao')

    obj.hide_render = False
    do_bake('EMIT', im_base, attr_nm='BakeDye')
    do_bake('EMIT', im_rough, attr_nm='BakeRough')
    if norm_img_reuse is None and reference is not None:
        im_norm = new_img(f'{tag}_norm')
        was_hidden = reference.hide_get()
        ref_cols = [c for c in bpy.data.collections if reference.name in c.objects]
        prev_col_hr = [c.hide_render for c in ref_cols]
        for c in ref_cols:
            c.hide_render = False
        reference.hide_set(False)
        reference.hide_render = False
        do_bake('NORMAL', im_norm, hi=reference)
        reference.hide_render = True
        reference.hide_set(was_hidden)
        for c, hr in zip(ref_cols, prev_col_hr):
            c.hide_render = hr
    else:
        im_norm = None
    do_bake('AO', im_ao)

    # Combine ORM
    im_orm = new_img(f'{tag}_orm')
    px = np.empty(size * size * 4, dtype=np.float32)
    comb = np.ones((size * size, 4), dtype=np.float32)
    im_ao.pixels.foreach_get(px)
    comb[:, 0] = 0.36 + 0.64 * px[::4]
    im_rough.pixels.foreach_get(px)
    comb[:, 1] = px[::4]
    comb[:, 2] = 0.0
    im_orm.pixels.foreach_set(comb.ravel())

    def save_pack(im, fname, fmt='PNG'):
        p = str(tex_dir / fname)
        im.filepath_raw = p
        im.file_format = fmt
        im.save(quality=90)
        loaded = bpy.data.images.load(p, check_existing=False)
        loaded.colorspace_settings.name = im.colorspace_settings.name
        loaded.pack()
        return loaded

    tex_b = save_pack(im_base, f'{tag}-base.jpg', 'JPEG')
    tex_n = save_pack(im_norm, f'{tag}-normal.png', 'PNG') if im_norm is not None else norm_img_reuse
    tex_o = save_pack(im_orm, f'{tag}-orm.png', 'PNG')

    obj.data.materials.clear()
    for an in ('BakeDye', 'BakeRough'):
        if an in obj.data.color_attributes:
            obj.data.color_attributes.remove(obj.data.color_attributes[an])
    bpy.data.materials.remove(tmp_mat)
    for im in (im_base, im_rough, im_ao, im_orm):
        bpy.data.images.remove(im)
    if im_norm is not None:
        bpy.data.images.remove(im_norm)

    return make_material(f'HAIZ_{tag}_Mat', img_tex=(tex_b, tex_n, tex_o), kind_val=1.0), tex_n


def apply_archetype_silhouette(body_obj, archetype):
    """Apply tasteful proportional morphs on Body_Hero for female / teacher / elder archetypes."""
    if archetype == 'student_hero':
        return 1.0
    if archetype == 'student_f':
        # 1.61 m refined student proportions: slightly narrower shoulders, gentle waist
        stature_scale = 1.61 / 1.70
        for v in body_obj.data.vertices:
            z = v.co.z
            # Narrow shoulder & ribcage width slightly above hips
            if 0.85 < z < 1.46:
                v.co.x *= 0.90
            v.co *= stature_scale
        return stature_scale
    if archetype == 'teacher_f':
        stature_scale = 1.62 / 1.70
        for v in body_obj.data.vertices:
            z = v.co.z
            if 0.85 < z < 1.46:
                v.co.x *= 0.92
            v.co *= stature_scale
        return stature_scale
    if archetype == 'worker_m':
        stature_scale = 1.66 / 1.70
        for v in body_obj.data.vertices:
            z = v.co.z
            if 0.85 < z < 1.25:
                v.co.y -= 0.015  # subtle mature posture fullness
            v.co *= stature_scale
        return stature_scale
    return 1.0


def build_all():
    t0 = time.monotonic()
    for d in (OUT_BLEND.parent, OUT_CHARS, OUT_DATA):
        d.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB))
    ref = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
    ref.name = 'Source_Hunyuan_1.5M'
    select(ref)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    ref.data.transform(Matrix.Scale(SCALE, 4))
    bpy.ops.object.shade_smooth()

    # Build clean LOD0 master body & detached backpack
    body_lod0 = duplicate(ref, 'Body_Hero')
    decimate_body(body_lod0, 36000)
    bag_pack = carve_bag_and_clean_body(body_lod0)
    add_backpack_straps(bag_pack)
    bag_cross = build_crossbody_satchel()

    # Smooth & UV unwrap all modular meshes
    for ob in (body_lod0, bag_pack, bag_cross):
        select(ob)
        bpy.ops.object.shade_smooth()
        unwrap_uv(ob)

    # Materials for modular bags + HAIZ_Kind vertex color
    mat_pack = make_material('HAIZ_Backpack_Mat', base_col=(0.46, 0.16, 0.065), rough=0.82, kind_val=1.0)
    mat_cross = make_material('HAIZ_Crossbody_Mat', base_col=(0.30, 0.34, 0.22), rough=0.85, kind_val=1.0)
    bag_pack.data.materials.append(mat_pack)
    bag_cross.data.materials.append(mat_cross)
    ensure_kind_color(bag_pack, 1.0)
    ensure_kind_color(bag_cross, 1.0)

    # Build master rig
    rig = create_armature('HAIZ_LivingRig_v3')
    bind_weights(body_lod0, rig, 'body')
    bind_weights(bag_pack, rig, 'backpack')
    bind_weights(bag_cross, rig, 'crossbody')

    # Move 1.5M reference into archive collection
    src_col = bpy.data.collections.new('Reference_Source_1.5M')
    bpy.context.scene.collection.children.link(src_col)
    ref.users_collection[0].objects.unlink(ref)
    src_col.objects.link(ref)
    src_col.hide_render = True
    ref.hide_set(True)

    tex_root = OUT_CHARS / 'textures'
    # Bake Hero textures across 3 LOD sizes & export archetypes
    archetypes = ['student_hero', 'student_f', 'teacher_f', 'worker_m']
    lod_specs = [('lod0', 1.0, 2048), ('lod1', 0.42, 1024), ('lod2', 0.17, 512)]

    report = {'archetypes': {}, 'bones': len(rig.data.bones)}
    hero_mat_lod0, hero_norm_2k = bake_body_textures(body_lod0, ref, tex_root, 'student_hero_2k', 2048, 'student_hero', 1.0)
    body_lod0.data.materials.append(hero_mat_lod0)

    # Save editable master .blend before archetype batch cloning
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND), compress=True)
    print(f'Saved master .blend -> {OUT_BLEND} ({OUT_BLEND.stat().st_size / 1e6:.2f} MB)', flush=True)

    # Export all 4 archetypes × 3 LODs
    for arch in archetypes:
        arch_dir = OUT_CHARS / arch
        arch_dir.mkdir(parents=True, exist_ok=True)
        report['archetypes'][arch] = {}

        w_body = duplicate(body_lod0, f'{arch}_Body')
        w_pack = duplicate(bag_pack, f'{arch}_Backpack')
        w_cross = duplicate(bag_cross, f'{arch}_Crossbody')
        w_rig = rig.copy()
        w_rig.data = rig.data.copy()
        w_rig.name = f'{arch}_Rig'
        bpy.context.collection.objects.link(w_rig)

        stature_scale = apply_archetype_silhouette(w_body, arch)
        if stature_scale != 1.0:
            for ob in (w_pack, w_cross):
                ob.data.transform(Matrix.Scale(stature_scale, 4))
            select(w_rig)
            bpy.ops.object.mode_set(mode='EDIT')
            for eb in w_rig.data.edit_bones:
                eb.head *= stature_scale
                eb.tail *= stature_scale
            bpy.ops.object.mode_set(mode='OBJECT')

        parts = [w_body]
        if arch in ('student_hero', 'student_f'):
            parts.extend([w_pack, w_cross])
        if arch == 'student_f':
            w_pony = build_ponytail_mesh()
            w_pony.data.transform(Matrix.Scale(stature_scale, 4))
            mat_pony = make_material('HAIZ_Ponytail_Mat', base_col=(0.055, 0.040, 0.036), rough=0.58, kind_val=0.50)
            w_pony.data.materials.append(mat_pony)
            ensure_kind_color(w_pony, 0.50)
            unwrap_uv(w_pony)
            bind_weights(w_pony, w_rig, 'ponytail')
            parts.append(w_pony)

        for ob in parts:
            ob.parent = w_rig
            for m in ob.modifiers:
                if m.type == 'ARMATURE':
                    m.object = w_rig

        if arch in ('teacher_f', 'worker_m'):
            bpy.data.objects.remove(w_pack, do_unlink=True)
            bpy.data.objects.remove(w_cross, do_unlink=True)

        for lod_name, ratio, tex_sz in lod_specs:
            lod_parts = []
            for p_idx, p_obj in enumerate(parts):
                lp = duplicate(p_obj, f'{p_obj.name}_{lod_name}')
                if ratio < 0.99:
                    dec = lp.modifiers.new('LODDec', 'DECIMATE')
                    dec.ratio = ratio
                    select(lp)
                    bpy.ops.object.modifier_apply(modifier=dec.name)
                if p_idx == 0:
                    if arch == 'student_hero' and lod_name == 'lod0':
                        lp.data.materials.clear()
                        lp.data.materials.append(hero_mat_lod0)
                    else:
                        mat_lod, _ = bake_body_textures(
                            lp, ref if stature_scale == 1.0 else None,
                            tex_root, f'{arch}_{lod_name}', tex_sz, arch,
                            stature_scale=stature_scale,
                            norm_img_reuse=hero_norm_2k if stature_scale != 1.0 else None,
                        )
                        lp.data.materials.clear()
                        lp.data.materials.append(mat_lod)
                lod_parts.append(lp)

            select(*lod_parts, w_rig)
            out_glb = arch_dir / f'{arch}_{lod_name}.glb'
            bpy.ops.export_scene.gltf(
                filepath=str(out_glb),
                export_format='GLB',
                use_selection=True,
                export_animations=False,
                export_image_format='WEBP',
                export_image_quality=88,
                export_tangents=False,
                export_meshopt_compression_enable=True,
                export_vertex_color='NAME',
                export_vertex_color_name='HAIZ_Kind',
                export_all_influences=False,
                export_def_bones=True,
                export_rest_position_armature=True,
            )
            tris = sum(len(o.data.polygons) for o in lod_parts)
            report['archetypes'][arch][lod_name] = {
                'glb': str(out_glb.relative_to(REPO)),
                'triangles': tris,
                'bytes': out_glb.stat().st_size,
            }
            for lp in lod_parts:
                bpy.data.objects.remove(lp, do_unlink=True)

        for p_obj in parts:
            bpy.data.objects.remove(p_obj, do_unlink=True)
        bpy.data.objects.remove(w_rig, do_unlink=True)

    (OUT_DATA / 'character-build-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f'Completed all 4 archetypes × 3 LODs in {time.monotonic() - t0:.1f}s', flush=True)


if __name__ == '__main__':
    build_all()
