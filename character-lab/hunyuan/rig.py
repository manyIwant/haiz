"""Source-specific skeleton, continuous skin weighting and portable preview clips."""
from math import cos, pi, sin, sqrt

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

from paint import regions, smooth

SCALE = 1.70 / 1.1612915992736816

# Positions are authored against the source glTF in X, height, forward order.
CENTER = {
    'hips': ((0, .537, -.013), (0, .624, -.011), None),
    'spine': ((0, .628, -.011), (0, .779, -.010), 'hips'),
    'chest': ((0, .783, -.010), (0, .928, -.011), 'spine'),
    'neck': ((0, .932, -.010), (0, .998, .001), 'chest'),
    'head': ((0, .995, .001), (0, 1.14, .008), 'neck'),
    'bag': ((0, .880, -.104), (0, .653, -.142), 'chest'),
}
SIDE = {
    'shoulder': ((.037, .932, -.018), (.117, .908, -.021), 'chest'),
    'upperarm': ((.117, .908, -.021), (.201, .744, -.008), 'shoulder'),
    'forearm': ((.201, .744, -.008), (.289, .624, .046), 'upperarm'),
    'hand': ((.289, .624, .046), (.340, .534, .084), 'forearm'),
    'thigh': ((.064, .523, -.016), (.071, .308, .002), 'hips'),
    'shin': ((.071, .308, .002), (.087, .056, -.015), 'thigh'),
    'foot': ((.087, .056, -.015), (.091, .026, .055), 'shin'),
    'toe': ((.091, .026, .055), (.094, .018, .101), 'foot'),
}
JOINTS = CENTER.copy()
for side, sign in [('L', 1), ('R', -1)]:
    for name, (head, tail, parent) in SIDE.items():
        parent = f'{parent}.{side}' if parent in SIDE else parent
        JOINTS[f'{name}.{side}'] = (
            (sign * head[0], *head[1:]), (sign * tail[0], *tail[1:]), parent
        )


def point(p):
    return Vector((p[0], -p[2], p[1])) * SCALE


def source_points(mesh):
    coordinates = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
    mesh.vertices.foreach_get('co', coordinates)
    p = coordinates.reshape(-1, 3)
    return np.stack([p[:, 0], p[:, 2], -p[:, 1]], axis=1) / SCALE


def armature():
    data = bpy.data.armatures.new('HAIZ student skeleton')
    obj = bpy.data.objects.new('Student rig', data)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.show_in_front = True
    data.display_type = 'STICK'
    bpy.ops.object.mode_set(mode='EDIT')
    for name, (head, tail, parent) in JOINTS.items():
        bone = data.edit_bones.new(name)
        bone.head, bone.tail = point(head), point(tail)
        if parent:
            bone.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    return obj


def bind(obj, rig, source):
    x, h, f = source.T
    xx = np.abs(x)
    _, _, _, _, _, _, bag, straps, _, shoes = regions(source)
    names = list(JOINTS)
    W = np.zeros((len(source), len(names)), dtype=np.float32)

    def weight(name, values):
        W[:, names.index(name)] = values

    arm_width = np.interp(h, [.53, .65, .74, .84, .91, .989], [.129, .121, .119, .122, .099, .113])
    arm = smooth(arm_width-.021, arm_width+.051, xx) * smooth(.433, .489, h) * (1-smooth(.920, .984, h))
    bag_attachment = smooth(.009, .067, -f) * (1-smooth(.097, .143, xx)) * smooth(.59,.73,h)
    arm *= 1 - .90*bag_attachment
    leg = (1-smooth(.466, .557, h)) * (1-arm)
    bag_shell = bag * (1-.94*straps) * .97
    torso = np.clip(1-arm-leg, 0, 1) * (1-bag_shell)
    head = smooth(.936, 1.018, h)
    neck = smooth(.899, .956, h)
    chest = smooth(.672, .854, h)
    spine = smooth(.532, .718, h)
    weight('head', torso * head)
    weight('neck', torso * neck * (1-head))
    weight('chest', torso * chest * (1-neck) * (1-head))
    weight('spine', torso * spine * (1-chest) * (1-neck) * (1-head))
    weight('hips', torso * (1-spine) * (1-chest) * (1-neck) * (1-head))
    weight('bag', bag_shell * np.clip(1-arm-leg, 0, 1))

    for side, sign in [('L', 1), ('R', -1)]:
        s = arm * (np.sign(x) == sign)
        shoulder = smooth(.117, .176, xx)
        along_elbow = .63*(xx-.201) - .74*(h-.744) + .23*(f+.008)
        elbow = smooth(-.047, .052, along_elbow)
        along_wrist = .52*(xx-.289) - .80*(h-.624) + .26*(f-.046)
        wrist = smooth(-.031, .035, along_wrist)
        weight(f'shoulder.{side}', s * (1-shoulder))
        weight(f'upperarm.{side}', s * shoulder * (1-elbow))
        weight(f'forearm.{side}', s * elbow * (1-wrist))
        weight(f'hand.{side}', s * wrist)
        inner = np.interp(h, [.38,.435,.468,.511], [.004,.007,.019,.033])
        s = leg * smooth(-inner, inner, sign*x)
        knee = 1-smooth(.267, .348, h)
        ankle = np.maximum(1-smooth(.030, .084, h), shoes*.995)
        toe = smooth(.041, .071, f) * (1-smooth(.018, .047, h))
        weight(f'thigh.{side}', s * (1-knee))
        weight(f'shin.{side}', s * knee * (1-ankle))
        weight(f'foot.{side}', s * ankle * (1-toe))
        weight(f'toe.{side}', s * ankle * toe)

    # Smooth attachment-band weights over mesh neighbors before limiting influences.
    edges = np.empty(len(obj.data.edges)*2, dtype=np.int32)
    obj.data.edges.foreach_get('vertices', edges)
    a, b = edges.reshape(-1, 2).T
    degree = np.bincount(edges, minlength=len(source))[:, None]
    strength = .34 * smooth(.65,.73,h) * (1-smooth(.911,.98,h)) * (1-smooth(.225,.260,xx))
    for _ in range(2):
        adjacent = np.zeros_like(W)
        np.add.at(adjacent, a, W[b])
        np.add.at(adjacent, b, W[a])
        W += strength[:, None] * (adjacent/np.maximum(degree, 1) - W)
    best = np.argpartition(W, -4, axis=1)[:, -4:]
    weights = np.take_along_axis(W, best, axis=1)
    weights /= weights.sum(axis=1, keepdims=True)
    groups = [obj.vertex_groups.new(name=name) for name in names]
    for idx, (indices, values) in enumerate(zip(best, weights)):
        for index, value in zip(indices, values):
            if value > .00001:
                groups[index].add([idx], float(value), 'REPLACE')
    obj.parent = rig
    modifier = obj.modifiers.new('Student deformation', 'ARMATURE')
    modifier.object = rig


def clip_samples(rig, name, duration, speed=None, turn=0, start_stop=0):
    fps = 30
    frames = round(duration * fps)
    bone_data = rig.data.bones
    rest = {b.name: b.matrix_local.to_quaternion() for b in bone_data}
    posed = {}
    x_axis, y_axis, up = Vector((1, 0, 0)), Vector((0, -1, 0)), Vector((0, 0, 1))
    aim_up = Vector((0, -1, 0))

    def rotation(name, pitch=0., yaw=0., roll=0.):
        return Quaternion(up, yaw) @ Quaternion(y_axis, roll) @ Quaternion(x_axis, pitch) @ rest[name]

    def set_pose(name, absolute):
        bone = rig.pose.bones[name]
        parent = bone_data[name].parent
        posed[name] = absolute
        basis = rest[name].inverted() @ absolute
        if parent:
            basis = rest[name].inverted() @ rest[parent.name] @ posed[parent.name].inverted() @ absolute
        bone.rotation_quaternion = basis

    for i in range(frames + 1):
        t = i / frames
        phase = 2*pi*t
        pace = 1 if speed else 0
        if start_stop:
            pace = t*t*(3-2*t) if start_stop > 0 else (1-t)**2*(1+2*t)
        breathe = sin(phase)
        running = speed == 3.35
        roll = (.025 if running else .036) * cos(phase) * pace
        pitch = (.135 if running else .045) * pace
        twist = .097 * sin(phase) * pace
        turning = turn * t*t*(3-2*t)
        bob = ((-.034 if running else -.020) * cos(2*phase) - .021) * pace
        if turn:
            bob -= .022*sin(pi*t)**2
        pelvis = Vector((roll*.46, 0, bob + (1-pace)*.004*breathe))

        turn_q = Quaternion(up, turning)
        hip_q = rotation('hips', -pitch*.45, twist*.58 + turning, roll)
        hip_origin = point(JOINTS['hips'][0])
        legs = {}
        for s, offset in [('L', 0), ('R', .5)]:
            sign = 1 if s == 'L' else -1
            thigh, shin, foot = (n+'.'+s for n in ('thigh', 'shin', 'foot'))
            hip0 = point(JOINTS[thigh][0])
            knee0 = point(JOINTS[shin][0])
            ankle0 = point(JOINTS[foot][0])
            thigh_length = (knee0-hip0).length
            shin_length = (ankle0-knee0).length
            stride_phase = (t + offset) % 1
            duty = .33 if running else .58
            reach = (speed or 0) * duration * duty * .5 * pace
            ankle = ankle0.copy()
            grounded = stride_phase < duty or not speed
            if stride_phase < duty:
                progress = stride_phase / duty
                ankle += y_axis * (reach * (1 - 2*progress))
                foot_pitch = pace * (-.21 * max(0, 1-progress/.26)**2 + .34 * max(0,(progress-.68)/.32)**2)
                pivot = point((sign*.087,.001,.100 if foot_pitch > 0 else -.050)) - ankle0
                ankle += pivot - Quaternion(x_axis, foot_pitch) @ pivot
            else:
                progress = (stride_phase-duty)/(1-duty)
                blend = progress*progress*(3-2*progress)
                ankle += y_axis * (reach*(2*blend-1))
                ankle.z += (.21 if running else .116) * sin(pi*progress)**1.15 * pace
                foot_pitch = pace * (.34 * max(0, 1-progress/.37)**2 - .21 * max(0,(progress-.74)/.26)**2)
            if turn:
                ankle = turn_q @ ankle
                segment = np.clip(2*t-offset*1.3, 0, 1)
                ankle.z += .095 * sin(pi*segment)**2
            foot_q = turn_q @ Quaternion(x_axis, foot_pitch)
            hip_relative = hip_q @ (rest['hips'].inverted() @ (hip0-hip_origin))
            legs[s] = (hip0, knee0, ankle0, hip_relative, thigh_length, shin_length, ankle, foot_q, grounded)
        needed = 0
        for _, _, _, hip_relative, L, S, ankle, _, grounded in legs.values():
            if grounded:
                hip = hip_origin + pelvis + hip_relative
                horizontal2 = (ankle.x-hip.x)**2 + (ankle.y-hip.y)**2
                reach = sqrt(max(0, (L+S-.004)**2-horizontal2))
                needed = max(needed, hip.z-ankle.z-reach)
        pelvis.z -= min(.123, needed)
        set_pose('hips', hip_q)
        rig.pose.bones['hips'].location = rest['hips'].inverted() @ pelvis
        for n, p, y, r in [('spine', -pitch*.78, -.24*twist, -roll*.32),
                           ('chest', -pitch, -.83*twist, -roll*.54),
                           ('neck', .012*breathe, -.24*twist, 0),
                           ('head', .01*breathe, -.35*twist, 0),
                           ('bag', -pitch + .026*sin(2*phase+.55)*pace, -.76*twist, -roll*.4)]:
            set_pose(n, rotation(n, p, y+turning, r))
        for s, sign, offset in [('L', 1, 0), ('R', -1, .5)]:
            suffix = '.' + s
            shoulder, upper, forearm, hand, thigh, shin, foot, toe = (n+suffix for n in
                ('shoulder','upperarm','forearm','hand','thigh','shin','foot','toe'))
            swing = cos(phase + 2*pi*offset)
            flex = swing * (.48 if running else .29) * pace
            elbow = .09 + (.91 if running else .26) * pace
            for n, p, r in [(shoulder, -pitch*.95, -sign*.10), (upper, flex, -sign*.41),
                            (forearm, flex+elbow, -sign*.44), (hand, flex+elbow*.90, -sign*.43)]:
                # The source is in an A pose. Negative roll on the left brings the arm inward.
                set_pose(n, rotation(n, p, turning-.41*twist, r))
            hip0, knee0, ankle0, hip_relative, L, S, ankle, foot_q, _ = legs[s]
            hip = hip_origin + pelvis + hip_relative
            direction = (ankle - hip).normalized()
            distance = min((ankle - hip).length, L+S-.001)
            ankle = hip + direction * distance
            knee_along = (L*L-S*S+distance*distance)/(2*distance)
            knee_forward = (turn_q @ aim_up - direction * direction.dot(turn_q @ aim_up)).normalized()
            knee = hip + direction*knee_along + knee_forward*sqrt(max(0, L*L-knee_along*knee_along))
            set_pose(thigh, (knee0-hip0).rotation_difference(knee-hip) @ rest[thigh])
            set_pose(shin, (ankle0-knee0).rotation_difference(ankle-knee) @ rest[shin])
            set_pose(foot, foot_q @ rest[foot])
            set_pose(toe, foot_q @ rest[toe])
        for bone in rig.pose.bones:
            bone.keyframe_insert(data_path='rotation_quaternion', frame=i+1, group=bone.name)
        rig.pose.bones['hips'].keyframe_insert(data_path='location', frame=i+1, group='hips')
    action = rig.animation_data.action
    action.name = name
    rig.animation_data.action = None
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, action)
    track.mute = True


def animate(rig):
    rig.animation_data_create()
    bpy.context.scene.render.fps = 30
    for name, duration, speed, turn, transition in [
        ('Idle', 3.8, None, 0, 0), ('Walk', 1.02, 1.32, 0, 0), ('Run', .72, 3.35, 0, 0),
        ('Turn Left', .75, None, .89, 0), ('Turn Right', .75, None, -.89, 0),
        ('Walk Stop', .69, 1.32, 0, -1), ('Start Walking', .69, 1.32, 0, 1),
    ]:
        clip_samples(rig, name, duration, speed, turn, transition)
    for bone in rig.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
