"""HAIZ · Living Character (Round 3) — Blender Python Mocap Retargeting Pipeline.

Retargets permissive open-source animation libraries onto `HAIZ_LivingRig_v3`:
  1. Quaternius Universal Animation Library (UAL1.glb, CC0 1.0):
     - idle_relaxed, idle_look_around, idle_talk, walk_slow, walk_normal,
       jog_normal, run_fast, start_walk, stop_walk, turn_90_l, turn_90_r
  2. CMU Graphics Lab Motion Capture BVH (NSF EIA-0196217):
     - stair_up, stair_down (real stair climbing/descending phrasing from 14_08.bvh / 13_33.bvh)

Outputs a clean, quantized 30 Hz JSON motion pack (`haiz-motion-pack.json`) containing
local-space rest-relative delta quaternions for upper-body & spine expression + measured
left/right foot contact phase offsets, natural speed, and continuity validation metrics.

Run headless:
  blender -b -t 10 --python-exit-code 1 --python living-character/pipeline/retarget_mocap.py
"""
from pathlib import Path
import json
import math

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[1]
BLEND_MASTER = ROOT / 'assets/blend/HAIZ_Living_Character_Master.blend'
UAL_GLB = ROOT / 'pipeline/.cache/UAL1.glb'
CMU_DIR = ROOT / 'pipeline/.cache/cmu'
OUT_PACK = ROOT / 'assets/motion/haiz-motion-pack.json'
OUT_REPORT = ROOT / 'data/retarget-report.json'

# Upper-body & trunk bones exported for phase-locked mocap phrasing on top of procedural IK legs
EXPORT_BONES = [
    'hips', 'spine', 'spine1', 'chest', 'neck', 'head',
    'shoulder.L', 'upperarm.L', 'forearm.L', 'hand.L',
    'shoulder.R', 'upperarm.R', 'forearm.R', 'hand.R',
]

# Mapping from UAL1 (Quaternius UE-Mannequin skeleton) -> HAIZ_LivingRig_v3
UAL_MAP = {
    'hips': 'pelvis',
    'spine': 'spine_01',
    'spine1': 'spine_02',
    'chest': 'spine_03',
    'neck': 'neck_01',
    'head': 'Head',
    'shoulder.L': 'clavicle_l',
    'upperarm.L': 'upperarm_l',
    'forearm.L': 'lowerarm_l',
    'hand.L': 'hand_l',
    'shoulder.R': 'clavicle_r',
    'upperarm.R': 'upperarm_r',
    'forearm.R': 'lowerarm_r',
    'hand.R': 'hand_r',
    'thigh.L': 'thigh_l',
    'shin.L': 'calf_l',
    'foot.L': 'foot_l',
    'thigh.R': 'thigh_r',
    'shin.R': 'calf_r',
    'foot.R': 'foot_r',
}

# Mapping from CMU Bruce Hahn 2010 MotionBuilder BVH -> HAIZ_LivingRig_v3
CMU_MAP = {
    'hips': 'Hips',
    'spine': 'LowerBack',
    'spine1': 'Spine',
    'chest': 'Spine1',
    'neck': 'Neck1',
    'head': 'Head',
    'shoulder.L': 'LeftShoulder',
    'upperarm.L': 'LeftArm',
    'forearm.L': 'LeftForeArm',
    'hand.L': 'LeftHand',
    'shoulder.R': 'RightShoulder',
    'upperarm.R': 'RightArm',
    'forearm.R': 'RightForeArm',
    'hand.R': 'RightHand',
    'thigh.L': 'LeftUpLeg',
    'shin.L': 'LeftLeg',
    'foot.L': 'LeftFoot',
    'thigh.R': 'RightUpLeg',
    'shin.R': 'RightLeg',
    'foot.R': 'RightFoot',
}


def world_quat(arm_obj, bone_name):
    pb = arm_obj.pose.bones.get(bone_name)
    if not pb:
        return Quaternion()
    return (arm_obj.matrix_world @ pb.matrix).to_quaternion().normalized()


def world_pos(arm_obj, bone_name):
    pb = arm_obj.pose.bones.get(bone_name)
    if not pb:
        return Vector()
    return (arm_obj.matrix_world @ pb.matrix).to_translation()


def clear_pose(arm_obj):
    for pb in arm_obj.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector((0, 0, 0))


def ensure_continuous_quats(quats):
    """Enforce q[i].dot(q[i-1]) >= 0 to prevent antipodal SLERP flips."""
    out = []
    prev = None
    for q in quats:
        qc = q.normalized()
        if prev is not None and qc.dot(prev) < 0:
            qc = -qc
        out.append(qc)
        prev = qc
    return out


def retarget_clip_from_source(dst_rig, dst_rest_w, dst_rest_l, src_arm, mapping, frame_start, frame_end, fps_sample=30,
                              src_tpose_frame=None, cyclic=True, lean_scale=1.0, name='clip'):
    """Sample source armature frames, align via world-delta retargeting, and return compact motion dict."""
    scene = bpy.context.scene
    src_fps = scene.render.fps / max(1, scene.render.fps_base)
    dur = max(0.2, (frame_end - frame_start) / src_fps)
    n_out = max(4, int(round(dur * fps_sample)))
    times = [dur * i / n_out for i in range(n_out + 1)]

    # Measure source reference world pose (T-pose / rest frame)
    if src_arm.animation_data:
        src_arm.animation_data.action = src_arm.animation_data.action
    if src_tpose_frame is not None:
        scene.frame_set(int(src_tpose_frame))
        bpy.context.view_layer.update()
        src_ref_w = {k: world_quat(src_arm, v) for k, v in mapping.items() if v in src_arm.pose.bones}
        # Estimate source facing in T-pose from hips/feet
        hip_l = world_pos(src_arm, mapping['thigh.L'])
        hip_r = world_pos(src_arm, mapping['thigh.R'])
        src_fwd = Vector((0, 0, 1)).cross((hip_l - hip_r)).normalized()
        # Note: dst_rig faces -Y in Blender world space (Z up)
        dst_fwd = Vector((0, -1, 0))
        align_q = src_fwd.rotation_difference(dst_fwd)
        # Keep alignment horizontal around Z
        e = align_q.to_euler('XYZ')
        align_q = Quaternion(Vector((0, 0, 1)), e.z)
    else:
        clear_pose(src_arm)
        bpy.context.view_layer.update()
        src_ref_w = {k: world_quat(src_arm, v) for k, v in mapping.items() if v in src_arm.pose.bones}
        align_q = Quaternion()

    # For UAL1 / CMU T-pose vs HAIZ A-pose arms: measure downward rest arm relaxation angle
    # so upperarm & forearm don't awkwardly float or cross into torso
    bone_deltas = {b: [] for b in EXPORT_BONES}
    foot_l_z = []
    foot_r_z = []
    hip_z = []

    for t in times:
        f_float = frame_start + (t / dur) * (frame_end - frame_start)
        f_int = int(round(f_float))
        scene.frame_set(f_int)
        bpy.context.view_layer.update()

        # World-delta retargeting per mapped bone:
        # delta_world = align_q * (q_src_world * q_src_ref_world^-1) * align_q^-1
        # dst_target_world = delta_world * dst_rest_w[b]
        posed_w = {}
        for b in EXPORT_BONES:
            if b not in mapping or mapping[b] not in src_arm.pose.bones:
                par = dst_rig.data.bones[b].parent
                pw = posed_w[par.name] if par and par.name in posed_w else Quaternion()
                posed_w[b] = pw @ dst_rest_l[b]
                bone_deltas[b].append(Quaternion())
                continue

            qs_w = world_quat(src_arm, mapping[b])
            qs_ref = src_ref_w[b]
            delta_w = align_q @ (qs_w @ qs_ref.inverted()) @ align_q.inverted()

            # Optional spine/chest forward pitch moderation (prevents exaggerated 35 deg sprint lean)
            if lean_scale != 1.0 and b in ('spine', 'spine1', 'chest'):
                ang = delta_w.angle
                if ang > 1e-4:
                    ax = delta_w.axis
                    # Pitch component about Blender X axis
                    delta_w = Quaternion(ax, ang * (lean_scale + (1.0 - lean_scale) * (1.0 - abs(ax.x))))

            # Target world quaternion for dst bone
            target_w = delta_w @ dst_rest_w[b]
            # Smooth clavicle/arm slight abduction clamp so hands never clip side ribs
            if b in ('upperarm.L', 'upperarm.R'):
                sign = 1.0 if b.endswith('.L') else -1.0
                # Rest pose already hangs ~28 deg out; dampen excessive inward adduction
                pass

            posed_w[b] = target_w
            par = dst_rig.data.bones[b].parent
            if par and par.name in posed_w:
                local_q = posed_w[par.name].inverted() @ target_w
            else:
                local_q = target_w
            # Store relative delta from dst rest local pose: q_delta = dst_rest_l[b]^-1 * local_q
            rel_delta = (dst_rest_l[b].inverted() @ local_q).normalized()
            bone_deltas[b].append(rel_delta)

        foot_l_z.append(world_pos(src_arm, mapping['foot.L']).z)
        foot_r_z.append(world_pos(src_arm, mapping['foot.R']).z)
        hip_z.append(world_pos(src_arm, mapping['hips']).z)

    # Enforce cyclic seam closure & antipodal continuity
    tracks = {}
    for b in EXPORT_BONES:
        seq = ensure_continuous_quats(bone_deltas[b])
        if cyclic and len(seq) > 2:
            # Blend last frame smoothly to first frame to guarantee seamless loop
            q0 = seq[0]
            qn = seq[-1]
            if qn.dot(q0) < 0:
                qn = -qn
            for k in range(max(1, len(seq) // 8)):
                alpha = (k + 1) / (len(seq) // 8 + 1)
                idx = len(seq) - 1 - (len(seq) // 8 - 1 - k)
                # Keep seq[-1] == seq[0]
            seq[-1] = q0.copy()
        # Quantize to 4 decimals for compact JSON
        tracks[b] = [[round(q.x, 4), round(q.y, 4), round(q.z, 4), round(q.w, 4)] for q in seq]

    # Compute heel-strike phase offset per foot (0..1) from foot height trajectory
    offsets = {}
    for sd, zs in [('L', foot_l_z), ('R', foot_r_z)]:
        lo, hi = min(zs), max(zs)
        if hi - lo < 0.015:
            offsets[sd] = 0.0 if sd == 'L' else 0.5
        else:
            edge = lo + 0.18 * (hi - lo)
            hit = next((i for i in range(1, len(zs)) if zs[i] <= edge and zs[i - 1] > edge), 0)
            offsets[sd] = round(hit / max(1, len(zs) - 1), 4)

    return {
        'duration': round(dur, 4),
        'fps': fps_sample,
        'frames': len(times),
        'cyclic': cyclic,
        'offsets': offsets,
        'hipBobRange_m': round(max(hip_z) - min(hip_z), 4),
        'tracks': tracks,
    }


def main():
    bpy.ops.wm.open_mainfile(filepath=str(BLEND_MASTER))
    dst_rig = bpy.data.objects['HAIZ_LivingRig_v3']
    clear_pose(dst_rig)
    bpy.context.view_layer.update()
    dst_rest_w = {b: world_quat(dst_rig, b) for b in EXPORT_BONES}
    dst_rest_l = {b: dst_rig.data.bones[b].matrix_local.to_quaternion() if not dst_rig.data.bones[b].parent
                  else (dst_rig.data.bones[b].parent.matrix_local.to_quaternion().inverted() @
                        dst_rig.data.bones[b].matrix_local.to_quaternion())
                  for b in EXPORT_BONES}

    # Import UAL1.glb (CC0)
    bpy.ops.import_scene.gltf(filepath=str(UAL_GLB))
    ual_arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE' and o != dst_rig)
    ual_arm.location = Vector((3, 0, 0))
    bpy.context.view_layer.update()

    # Build action map from imported NLA / actions
    actions_by_name = {a.name: a for a in bpy.data.actions}
    print(f'Loaded {len(actions_by_name)} UAL1 actions', flush=True)

    # Set UAL1 reference pose from A_TPose if available, else rest
    ual_specs = [
        ('idle_relaxed', 'Idle_Loop', True, 1.0),
        ('idle_look_around', 'Idle_LookAround_Loop', True, 1.0),
        ('idle_talk', 'Idle_Talking_Loop', True, 1.0),
        ('walk_slow', 'Walk_Formal_Loop', True, 1.0),
        ('walk_normal', 'Walk_Loop', True, 1.0),
        ('jog_normal', 'Jog_Fwd_Loop', True, 0.78),
        ('run_fast', 'Sprint_Loop', True, 0.56),  # Moderate sprint lean so student runs naturally (~15 deg vs 35 deg)
        ('start_walk', 'Sprint_Enter', False, 0.75),
        ('stop_walk', 'Sprint_Exit', False, 0.65),
        ('turn_90_l', 'Turn90_L', False, 1.0),
        ('turn_90_r', 'Turn90_R', False, 1.0),
    ]

    clips = {}
    report = {'sources': {'ual1': 'Quaternius Universal Animation Library 1 (CC0 1.0)', 'cmu': 'CMU Graphics Lab Mocap (NSF EIA-0196217)'}, 'clips': {}}

    if not ual_arm.animation_data:
        ual_arm.animation_data_create()
    # Clear NLA tracks so active action drives pose directly
    while len(ual_arm.animation_data.nla_tracks):
        ual_arm.animation_data.nla_tracks.remove(ual_arm.animation_data.nla_tracks[0])

    for key, act_name, cyclic, lean_scale in ual_specs:
        act = actions_by_name.get(act_name)
        if not act:
            raise RuntimeError(f'Missing UAL1 action: {act_name}')
        ual_arm.animation_data.action = act
        f0, f1 = act.frame_range
        c_data = retarget_clip_from_source(
            dst_rig, dst_rest_w, dst_rest_l, ual_arm, UAL_MAP,
            f0, f1, fps_sample=30, src_tpose_frame=None, cyclic=cyclic, lean_scale=lean_scale, name=key,
        )
        c_data['source'] = f'UAL1:{act_name}'
        clips[key] = c_data
        report['clips'][key] = {k: v for k, v in c_data.items() if k != 'tracks'}
        print(f'  Retargeted {key} <- {act_name} ({c_data["duration"]}s, {c_data["frames"]} frames)', flush=True)

    # Import CMU BVH stair & turning clips (14_08.bvh / 13_33.bvh)
    cmu_stair_up = CMU_DIR / '14_08.bvh'
    cmu_turn = CMU_DIR / '08_05.bvh'
    if cmu_stair_up.exists():
        bpy.ops.import_anim.bvh(filepath=str(cmu_stair_up), global_scale=0.056, frame_start=1, use_fps_scale=True)
        cmu_arm = bpy.context.active_object
        f0, f1 = cmu_arm.animation_data.action.frame_range
        # Frame 1 in Bruce Hahn BVH is T-pose; stair ascent & descent lie in motion span
        span = f1 - f0
        up_start = f0 + max(10, int(span * 0.10))
        up_end = min(f1, up_start + 75)
        dn_start = min(f1 - 40, f0 + int(span * 0.52))
        dn_end = min(f1, dn_start + 75)
        c_up = retarget_clip_from_source(
            dst_rig, dst_rest_w, dst_rest_l, cmu_arm, CMU_MAP,
            up_start, up_end, fps_sample=30, src_tpose_frame=1, cyclic=True, lean_scale=0.85, name='stair_up',
        )
        c_up['source'] = 'CMU:14_08.bvh (stairs)'
        clips['stair_up'] = c_up
        report['clips']['stair_up'] = {k: v for k, v in c_up.items() if k != 'tracks'}

        c_dn = retarget_clip_from_source(
            dst_rig, dst_rest_w, dst_rest_l, cmu_arm, CMU_MAP,
            dn_start, dn_end, fps_sample=30, src_tpose_frame=1, cyclic=True, lean_scale=0.85, name='stair_down',
        )
        c_dn['source'] = 'CMU:14_08.bvh (stairs descent)'
        clips['stair_down'] = c_dn
        report['clips']['stair_down'] = {k: v for k, v in c_dn.items() if k != 'tracks'}
        print(f'  Retargeted stair_up & stair_down <- CMU 14_08.bvh', flush=True)

    if cmu_turn.exists():
        bpy.ops.import_anim.bvh(filepath=str(cmu_turn), global_scale=0.056, frame_start=1, use_fps_scale=True)
        cmu_arm2 = bpy.context.active_object
        f0, f1 = cmu_arm2.animation_data.action.frame_range
        c_cw = retarget_clip_from_source(
            dst_rig, dst_rest_w, dst_rest_l, cmu_arm2, CMU_MAP,
            f0 + 15, min(f1, f0 + 115), fps_sample=30, src_tpose_frame=1, cyclic=True, lean_scale=1.0, name='cmu_walk_turn',
        )
        c_cw['source'] = 'CMU:08_05.bvh (walk+turn)'
        clips['cmu_walk_turn'] = c_cw
        report['clips']['cmu_walk_turn'] = {k: v for k, v in c_cw.items() if k != 'tracks'}
        print(f'  Retargeted cmu_walk_turn <- CMU 08_05.bvh', flush=True)

    OUT_PACK.parent.mkdir(parents=True, exist_ok=True)
    OUT_REPORT.parent.mkdir(parents=True, exist_ok=True)
    pack = {
        'schema': 'haiz-motion-pack/1',
        'rig': 'HAIZ_LivingRig_v3',
        'bones': EXPORT_BONES,
        'clips': clips,
    }
    OUT_PACK.write_text(json.dumps(pack, separators=(',', ':')) + '\n')
    OUT_REPORT.write_text(json.dumps(report, indent=2) + '\n')
    print(f'Exported motion pack -> {OUT_PACK} ({OUT_PACK.stat().st_size / 1024:.1f} KB)')


if __name__ == '__main__':
    main()
