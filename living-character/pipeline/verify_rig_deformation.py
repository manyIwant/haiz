"""Automated Blender Rig, Weight & Multi-Pose Deformation Audit for HAIZ Living Character R3.

Loads `HAIZ_Living_Character_Master.blend` (or `student_hero_lod0.glb`), tests 7 poses
(`idle`, `walk_contact`, `run_stride`, `squat`, `arm_raise_90`, `turn_90`, `stair_step_up`),
computes edge-stretch P95/P99 across shoulders/elbows/knees/crotch, checks sole height and
weight normalization, and renders an orthographic multi-pose visual review sheet!
"""
from pathlib import Path
import json
import math

import bpy
import numpy as np
from mathutils import Euler, Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[1]
BLEND_PATH = ROOT / 'assets/blend/HAIZ_Living_Character_Master.blend'
OUT_JSON = ROOT / 'data/rig-audit.json'
OUT_RENDER = ROOT / 'renders/rig_pose_sheet.jpg'


def edge_lengths(mesh, depsgraph, obj):
    eval_obj = obj.evaluated_get(depsgraph)
    emesh = eval_obj.to_mesh()
    co = np.empty(len(emesh.vertices) * 3, dtype=np.float32)
    emesh.vertices.foreach_get('co', co)
    V = co.reshape(-1, 3)
    edges = np.empty(len(emesh.edges) * 2, dtype=np.int32)
    emesh.edges.foreach_get('vertices', edges)
    e = edges.reshape(-1, 2)
    ln = np.linalg.norm(V[e[:, 0]] - V[e[:, 1]], axis=1)
    eval_obj.to_mesh_clear()
    return V, e, ln


def set_bone_euler(rig, name, deg_xyz):
    pb = rig.pose.bones.get(name)
    if not pb:
        return
    pb.rotation_mode = 'XYZ'
    pb.rotation_euler = Euler([math.radians(a) for a in deg_xyz], 'XYZ')


def apply_pose(rig, pose_name):
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector((0, 0, 0))
    if pose_name == 'idle':
        set_bone_euler(rig, 'upperarm.L', (3, 18, 0))
        set_bone_euler(rig, 'upperarm.R', (3, -18, 0))
        set_bone_euler(rig, 'forearm.L', (-12, 0, 0))
        set_bone_euler(rig, 'forearm.R', (-12, 0, 0))
    elif pose_name == 'walk_contact':
        set_bone_euler(rig, 'hips', (0, 0, 6))
        set_bone_euler(rig, 'chest', (0, 0, -9))
        set_bone_euler(rig, 'thigh.L', (-24, 0, 0))
        set_bone_euler(rig, 'shin.L', (8, 0, 0))
        set_bone_euler(rig, 'thigh.R', (18, 0, 0))
        set_bone_euler(rig, 'shin.R', (22, 0, 0))
        set_bone_euler(rig, 'upperarm.L', (18, 16, 0))
        set_bone_euler(rig, 'forearm.L', (-24, 0, 0))
        set_bone_euler(rig, 'upperarm.R', (-20, -16, 0))
        set_bone_euler(rig, 'forearm.R', (-32, 0, 0))
    elif pose_name == 'run_stride':
        set_bone_euler(rig, 'spine', (-10, 0, 0))
        set_bone_euler(rig, 'chest', (-6, 0, -14))
        set_bone_euler(rig, 'thigh.L', (-48, 0, 0))
        set_bone_euler(rig, 'shin.L', (42, 0, 0))
        set_bone_euler(rig, 'thigh.R', (34, 0, 0))
        set_bone_euler(rig, 'shin.R', (68, 0, 0))
        set_bone_euler(rig, 'upperarm.L', (42, 16, 0))
        set_bone_euler(rig, 'forearm.L', (-85, 0, 0))
        set_bone_euler(rig, 'upperarm.R', (-48, -16, 0))
        set_bone_euler(rig, 'forearm.R', (-95, 0, 0))
    elif pose_name == 'squat':
        rig.pose.bones['hips'].location = Vector((0, 0, -0.32))
        set_bone_euler(rig, 'spine', (-22, 0, 0))
        set_bone_euler(rig, 'thigh.L', (-78, 8, 0))
        set_bone_euler(rig, 'shin.L', (88, 0, 0))
        set_bone_euler(rig, 'thigh.R', (-78, -8, 0))
        set_bone_euler(rig, 'shin.R', (88, 0, 0))
    elif pose_name == 'arm_raise_90':
        set_bone_euler(rig, 'shoulder.L', (0, -12, 0))
        set_bone_euler(rig, 'upperarm.L', (-75, -20, 0))
        set_bone_euler(rig, 'forearm.L', (-65, 0, 0))
        set_bone_euler(rig, 'shoulder.R', (0, 12, 0))
        set_bone_euler(rig, 'upperarm.R', (-75, 20, 0))
        set_bone_euler(rig, 'forearm.R', (-65, 0, 0))
    elif pose_name == 'stair_step_up':
        set_bone_euler(rig, 'spine', (-12, 0, 0))
        set_bone_euler(rig, 'thigh.L', (-58, 0, 0))
        set_bone_euler(rig, 'shin.L', (64, 0, 0))
        set_bone_euler(rig, 'thigh.R', (12, 0, 0))
        set_bone_euler(rig, 'shin.R', (16, 0, 0))
    elif pose_name == 'turn_90':
        set_bone_euler(rig, 'head', (0, 0, 38))
        set_bone_euler(rig, 'neck', (0, 0, 18))
        set_bone_euler(rig, 'chest', (0, 0, 22))
        set_bone_euler(rig, 'hips', (0, 0, 8))


def main():
    bpy.ops.wm.open_mainfile(filepath=str(BLEND_PATH))
    rig = bpy.data.objects['HAIZ_LivingRig_v3']
    body = bpy.data.objects['Body_Hero']
    bag_pack = bpy.data.objects['Bag_Backpack']
    bag_cross = bpy.data.objects['Bag_Crossbody']
    for o in (body, bag_pack, bag_cross):
        o.hide_render = False
        o.hide_set(False)
    bag_cross.hide_render = True

    # Check weight normalization & hand isolation
    max_err = 0.0
    hand_tip_min = 1.0
    hand_idx = {vg.name: vg.index for vg in body.vertex_groups}
    for v in body.data.vertices:
        s = sum(g.weight for g in v.groups)
        max_err = max(max_err, abs(s - 1.0))
        if abs(v.co.x) > 0.45 and v.co.z < 0.85:
            hw = sum(g.weight for g in v.groups if g.group in (hand_idx.get('hand.L', -1), hand_idx.get('hand.R', -1)))
            hand_tip_min = min(hand_tip_min, hw)

    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    apply_pose(rig, 'rest')
    bpy.context.view_layer.update()
    V0, E0, L0 = edge_lengths(body.data, dg, body)
    L0 = np.maximum(L0, 1e-5)

    # Region masks for edges
    ec = 0.5 * (V0[E0[:, 0]] + V0[E0[:, 1]])
    ex = np.abs(ec[:, 0])
    ez = ec[:, 2]
    bands = {
        'whole': np.ones(len(L0), dtype=bool),
        'shoulders': (ex > 0.12) & (ex < 0.28) & (ez > 1.18) & (ez < 1.42),
        'elbows': (ex > 0.24) & (ex < 0.36) & (ez > 0.98) & (ez < 1.22),
        'knees': (ez > 0.38) & (ez < 0.54),
        'crotch': (ex < 0.12) & (ez > 0.62) & (ez < 0.82),
    }

    poses_report = {}
    for pname in ('idle', 'walk_contact', 'run_stride', 'squat', 'arm_raise_90', 'stair_step_up', 'turn_90'):
        apply_pose(rig, pname)
        bpy.context.view_layer.update()
        V1, _, L1 = edge_lengths(body.data, dg, body)
        ratio = L1 / L0
        poses_report[pname] = {
            'soleMinimumY_m': round(float(V1[:, 2].min()), 5),
            'edgeStretch': {
                bk: {
                    'p95': round(float(np.percentile(ratio[mask], 95)), 3) if mask.any() else 1.0,
                    'p99': round(float(np.percentile(ratio[mask], 99)), 3) if mask.any() else 1.0,
                    'max': round(float(ratio[mask].max()), 3) if mask.any() else 1.0,
                }
                for bk, mask in bands.items()
            },
        }

    # Render a clean 4-pose visual inspection sheet (Workbench / EEVEE fast render)
    OUT_RENDER.parent.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 600
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 90
    if not scene.world:
        scene.world = bpy.data.worlds.new('AuditWorld')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.72, 0.76, 0.74, 1.0)

    # Light
    ld = bpy.data.lights.new('Sun', 'SUN')
    ld.energy = 2.6
    lo = bpy.data.objects.new('Sun', ld)
    lo.rotation_euler = Euler((math.radians(48), 0, math.radians(-35)), 'XYZ')
    scene.collection.objects.link(lo)

    # Camera looking at pose line-up
    cam_d = bpy.data.cameras.new('AuditCam')
    cam_o = bpy.data.objects.new('AuditCam', cam_d)
    scene.collection.objects.link(cam_o)
    scene.camera = cam_o
    cam_d.lens = 45

    # Render 4 key poses side by side into temp images and composite via numpy? Better: duplicate evaluated poses across X!
    poses_to_show = [('idle', -1.2), ('walk_contact', -0.4), ('run_stride', 0.4), ('arm_raise_90', 1.2)]
    bag_cross.hide_render = False
    for pname, xoff in poses_to_show:
        apply_pose(rig, pname)
        bpy.context.view_layer.update()
        for src_ob in (body, bag_pack if pname != 'walk_contact' else bag_cross):
            ev = src_ob.evaluated_get(dg)
            me = bpy.data.meshes.new_from_object(ev)
            cp = bpy.data.objects.new(f'Preview_{pname}_{src_ob.name}', me)
            cp.location = Vector((xoff, 0, 0))
            cp.rotation_euler = Euler((0, 0, math.radians(-22 if pname != 'idle' else 0)), 'XYZ')
            scene.collection.objects.link(cp)

    body.hide_render = True
    bag_pack.hide_render = True
    bag_cross.hide_render = True
    cam_o.location = Vector((0.0, -3.55, 0.92))
    cam_o.rotation_euler = Euler((math.radians(88), 0, 0), 'XYZ')
    scene.render.filepath = str(OUT_RENDER)
    bpy.ops.render.render(write_still=True)

    audit = {
        'rig': 'HAIZ_LivingRig_v3',
        'bones': len(rig.data.bones),
        'bodyTriangles': len(body.data.polygons),
        'backpackTriangles': len(bag_pack.data.polygons),
        'crossbodyTriangles': len(bag_cross.data.polygons),
        'normalizedWeightsMaxError': round(max_err, 6),
        'handTipMinWeight': round(hand_tip_min, 4),
        'poses': poses_report,
    }
    OUT_JSON.write_text(json.dumps(audit, indent=2) + '\n')
    print('Rig audit complete ->', OUT_JSON)


if __name__ == '__main__':
    main()
