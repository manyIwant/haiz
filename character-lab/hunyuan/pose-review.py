"""Inspect actual skinned vertices in Blender. Run with haiz-student.blend open."""
from pathlib import Path
from math import radians, sqrt
import json
import sys

import bpy
import numpy as np
from mathutils import Quaternion, Vector

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from rig import source_points

scene = bpy.context.scene
avatar = bpy.data.objects['LOD0 · near']
rig = bpy.data.objects['Student rig']
source = source_points(avatar.data)
n = len(source)
rig.animation_data.action = None

weights = np.array([sum(g.weight for g in v.groups) for v in avatar.data.vertices])
assert np.max(np.abs(1-weights)) < .0002
assert max(len(v.groups) for v in avatar.data.vertices) <= 4
hand_coverage = {}
for sign, side in [(1, 'L'), (-1, 'R')]:
    fingertip = np.flatnonzero((sign * source[:, 0] > .317) & (source[:, 1] < .588))
    group = avatar.vertex_groups['hand.' + side].index
    scores = [sum(g.weight for g in avatar.data.vertices[i].groups if g.group == group) for i in fingertip]
    hand_coverage[side] = {'vertices': len(scores), 'minHandWeight': min(scores)}
    assert min(scores) > .98, f'Fingertips on {side} receive unrelated limb weights: {min(scores):.3f}'

origin = np.empty(n*3, dtype=np.float32)
avatar.data.vertices.foreach_get('co', origin)
origin = origin.reshape(n, 3)
indices = np.empty(len(avatar.data.edges)*2, dtype=np.uint32)
avatar.data.edges.foreach_get('vertices', indices)
i, j = indices.reshape(-1, 2).T
length = np.linalg.norm(origin[i]-origin[j], axis=1)
edge_centers = (source[i]+source[j])*.5
edges = length > .001
regions = {
    'whole': edges,
    'shoulders': edges & (edge_centers[:,1] > .82) & (edge_centers[:,1] < .94) & (np.abs(edge_centers[:,0]) > .09),
    'elbows': edges & (edge_centers[:,1] > .69) & (edge_centers[:,1] < .79) & (np.abs(edge_centers[:,0]) > .16),
    'knees': edges & (edge_centers[:,1] > .26) & (edge_centers[:,1] < .36),
    'crotch': edges & (edge_centers[:,1] > .42) & (edge_centers[:,1] < .52) & (np.abs(edge_centers[:,0]) < .065),
}

ax = Vector((1, 0, 0))
up = Vector((0, 0, 1))
forward = Vector((0, -1, 0))


def pose_action(name, frame):
    action = bpy.data.actions[name]
    rig.animation_data.action = action
    rig.animation_data.action_slot = action.slots[0]
    scene.frame_set(frame)
    bpy.context.view_layer.update()


def rotate_world(name, axis, amount):
    bone = rig.pose.bones[name]
    result = (Quaternion(axis, amount) @ bone.matrix.to_quaternion()).to_matrix().to_4x4()
    result.translation = bone.head
    bone.matrix = result
    bpy.context.view_layer.update()


def squat():
    pose_action('Idle', 1)
    bones = rig.pose.bones
    ankle_targets = {side: bones['foot.' + side].matrix.copy() for side in ('L', 'R')}
    hips = bones['hips']
    matrix = hips.matrix.copy()
    matrix.translation += Vector((0, .045, -.185))
    hips.matrix = matrix
    bpy.context.view_layer.update()
    for side in ('L', 'R'):
        thigh, shin, foot = (bones[f'{name}.{side}'] for name in ('thigh', 'shin', 'foot'))
        h = thigh.head.copy()
        a = ankle_targets[side].translation
        d = (a-h).length
        delta = (a-h).normalized()
        L, S = thigh.length, shin.length
        near = (L*L+d*d-S*S)/(2*d)
        bend = (forward-delta*forward.dot(delta)).normalized()
        k = h + delta*near + bend*sqrt(max(0, L*L-near*near))
        for bone, direction in [(thigh, k-h), (shin, a-k)]:
            q = (bone.tail-bone.head).rotation_difference(direction)
            matrix = (q @ bone.matrix.to_quaternion()).to_matrix().to_4x4()
            matrix.translation = bone.head
            bone.matrix = matrix
            bpy.context.view_layer.update()
        foot.matrix = ankle_targets[side]
        bpy.context.view_layer.update()
    rotate_world('chest', ax, radians(-16))


def measure():
    deps = bpy.context.evaluated_depsgraph_get()
    mesh = avatar.evaluated_get(deps).data
    coords = np.empty(n*3, dtype=np.float32)
    mesh.vertices.foreach_get('co', coords)
    coords = coords.reshape(n, 3)
    ratio = np.linalg.norm(coords[i]-coords[j],axis=1)/np.maximum(length,1e-8)
    return {
        'soleMinimumY_m': round(float(coords[:,2].min()), 5),
        'edgeStretch': {k: {
            'p95': round(float(np.percentile(ratio[v],95)),3),
            'p99': round(float(np.percentile(ratio[v],99)),3),
            'max': round(float(ratio[v].max()),3),
        } for k,v in regions.items()},
    }


def studio():
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 18
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 460
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.008))
    floor = bpy.context.object
    mat = bpy.data.materials.new('Review ground')
    mat.use_nodes = True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.10,.14,.13,1)
    floor.data.materials.append(mat)

    for pos, watt, area, color in [
        ((-2,-3,3.4),340,2.8,(1,.88,.73)),
        ((2,-1.3,2.2),160,2.2,(.75,.85,1)),
        ((.1,2.2,3),240,1.8,(.90,.94,1)),
    ]:
        bpy.ops.object.light_add(type='AREA', location=pos)
        light = bpy.context.object
        light.rotation_euler = (Vector((0,0,.95))-light.location).to_track_quat('-Z','Y').to_euler()
        light.data.energy, light.data.shape, light.data.size, light.data.color = watt,'DISK',area,color
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    scene.camera = camera
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 1.98
    return camera


def render(camera, name, pos):
    frozen = {bone.name: bone.matrix_basis.copy() for bone in rig.pose.bones}
    rig.animation_data.action = None
    for bone in rig.pose.bones:
        bone.matrix_basis = frozen[bone.name]
    bpy.context.view_layer.update()
    camera.location = pos
    camera.rotation_euler = (Vector((0,0,.85))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath = str(ROOT / 'evidence' / f'pose-{name}.png')
    bpy.ops.render.render(write_still=True)


if '--weights-only' not in sys.argv:
    camera = studio()
    results = {'normalizedWeightsMaxError': float(np.max(np.abs(1-weights))), 'fingertips': hand_coverage, 'poses': {}}
    for key, action, frame, at in [
        ('idle', 'Idle', 17, (2.1,-4,1.57)),
        ('arm-elbow', 'Idle', 1, (2.6,-3,1.62)),
        ('head-turn', 'Idle', 1, (-2.4,-4,1.62)),
        ('squat', 'Idle', 1, (2,-3.7,1.40)),
        ('walk', 'Walk', 8, (3.5,-2,1.47)),
        ('run', 'Run', 9, (3.7,-1.7,1.47)),
        ('turn', 'Turn Left', 12, (3.2,-2,1.48)),
    ]:
        pose_action(action, frame)
        if key == 'arm-elbow':
            rotate_world('upperarm.L', ax, radians(-72))
            rotate_world('forearm.L', ax, radians(-49))
        elif key == 'head-turn':
            rotate_world('neck', up, radians(18))
            rotate_world('head', up, radians(30))
        elif key == 'squat':
            squat()
        results['poses'][key] = measure()
        print(key, results['poses'][key], flush=True)
        render(camera, key, at)
    (ROOT / 'evidence/pose-results.json').write_text(json.dumps(results, indent=2) + '\n')
