"""Build the editable asset, baked atlases and three skinned GLBs from the supplied mesh."""
from pathlib import Path
import json
import sys
import time

import bmesh
import bpy
import numpy as np
from mathutils import Matrix
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from audit import SOURCE
from paint import paint, regions, smooth
from rig import SCALE, animate, armature, bind, source_points

TEXTURES = ROOT / 'textures'
MODELS = ROOT / 'models'


def select(*objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[-1]


def duplicate(obj, name):
    copy = obj.copy()
    copy.data = obj.data.copy()
    copy.name = name
    bpy.context.collection.objects.link(copy)
    return copy


def collapse(obj, triangles, source=False):
    x, y, z = source_points(obj.data).T
    face = smooth(.93, 1.01, y)
    elbows = np.exp(-((np.abs(x) - .20) / .038)**2) * smooth(.64,.73,y) * (1-smooth(.78,.83,y))
    knees = np.exp(-((y - .307) / .047)**2)
    shoulders = np.exp(-((y-.873)/.051)**2) * smooth(.063,.11,np.abs(x))
    crotch = np.exp(-((y-.461)/.061)**2) * (1-smooth(.033,.080,np.abs(x)))
    shoes = 1 - smooth(.065,.09,y)
    _, _, _, _, _, _, bag, straps, _, _ = regions(source_points(obj.data))
    detail = np.maximum.reduce([face, elbows*.78, knees*.63, shoulders*.83, crotch*.70, shoes*.83, bag*.50, straps*.77])
    group = obj.vertex_groups.new(name='Collapse priority')
    levels = np.rint(detail * 10).astype(np.uint8)
    for level in range(11):
        offsets = np.flatnonzero(levels == level)
        if len(offsets):
            # Decimate excludes zero-weight vertices entirely. Keep every vertex
            # eligible, but give the features a higher collapse cost.
            group.add(offsets.tolist(), 1 - .083 * level, 'REPLACE')
    decimate = obj.modifiers.new('Curvature and joint-aware simplification', 'DECIMATE')
    decimate.ratio = triangles / len(obj.data.polygons)
    decimate.vertex_group = group.name
    decimate.vertex_group_factor = .90 if source else .72
    select(obj)
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    priority = obj.vertex_groups.get('Collapse priority')
    if priority:
        obj.vertex_groups.remove(priority)
    print(obj.name, len(obj.data.vertices), len(obj.data.polygons), flush=True)


def refine_joint_bands(obj, reference):
    """Add deformation samples in long triangles crossing the traced joint bands."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    candidates = []
    for edge in bm.edges:
        center = (edge.verts[0].co + edge.verts[1].co) * (.5 / SCALE)
        x, depth, height = abs(center.x), center.y, center.z
        shoulder = .086 < x < .168 and .826 < height < .936 and depth < .056
        elbow = .171 < x < .239 and .700 < height < .795
        knee = .032 < x < .125 and .272 < height < .345
        crotch = x < .066 and .432 < height < .531
        length = edge.calc_length()
        if (shoulder or elbow or knee or crotch) and length > .018:
            candidates.append((length, edge))
    chosen = [edge for _, edge in sorted(candidates, key=lambda pair: -pair[0])[:2000]]
    if not chosen:
        bm.free()
        return 0
    result = bmesh.ops.subdivide_edges(bm, edges=chosen, cuts=1, use_grid_fill=True)
    new_vertices = [element for element in result['geom_inner'] if isinstance(element, bmesh.types.BMVert)]
    bmesh.ops.triangulate(bm, faces=[face for face in bm.faces if len(face.verts) != 3])
    bm.normal_update()
    projection = BVHTree.FromObject(reference, bpy.context.evaluated_depsgraph_get())
    for vertex in new_vertices:
        hit, normal, _, distance = projection.find_nearest(vertex.co, .006)
        if hit is not None and normal.dot(vertex.normal) > .70:
            vertex.co = hit
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    if obj.data.validate():
        raise ValueError('Joint band refinement produced invalid geometry')
    print('Joint band edge splits:', len(chosen), 'Triangles:', len(obj.data.polygons), flush=True)
    return len(chosen)


def unwrap(obj):
    select(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.12, margin_method='FRACTION', island_margin=.006, area_weight=.35)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.data.uv_layers.active.name = 'Uniform atlas'


def paint_attributes(obj):
    rgb, rough = paint(source_points(obj.data))
    for name, colors in [('Dye', rgb), ('Roughness', np.repeat(rough[:, None], 3, axis=1))]:
        attr = obj.data.color_attributes.new(name=name, type='FLOAT_COLOR', domain='POINT')
        rgba = np.ones((len(colors), 4), dtype=np.float32)
        rgba[:, :3] = colors
        attr.data.foreach_set('color', rgba.ravel())


def image(name, size, color=False):
    img = bpy.data.images.new(name, width=size, height=size, alpha=False, float_buffer=False)
    img.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
    return img


def bake_pass(lo, hi, kind, img, attribute=None):
    material = lo.data.materials[0]
    tree = material.node_tree
    output = tree.nodes.get('Material Output')
    principled = tree.nodes.get('Principled BSDF')
    tree.links.new(principled.outputs['BSDF'], output.inputs['Surface'])
    target = tree.nodes.get('Bake target') or tree.nodes.new('ShaderNodeTexImage')
    target.name = 'Bake target'
    target.image = img
    tree.nodes.active = target
    if attribute:
        rgba = tree.nodes.get('Bake input') or tree.nodes.new('ShaderNodeVertexColor')
        rgba.name = 'Bake input'
        rgba.layer_name = attribute
        emission = tree.nodes.get('Bake emission') or tree.nodes.new('ShaderNodeEmission')
        emission.name = 'Bake emission'
        tree.links.new(rgba.outputs['Color'], emission.inputs['Color'])
        tree.links.new(emission.outputs[0], output.inputs['Surface'])
    select(*(obj for obj in (hi, lo) if obj is not None))
    options = {'type': kind, 'margin': 7, 'margin_type': 'EXTEND', 'use_clear': True}
    if hi:
        options.update(use_selected_to_active=True, max_ray_distance=.021, cage_extrusion=.005)
    else:
        options.update(use_selected_to_active=False)
    start = time.monotonic()
    bpy.ops.object.bake(**options)
    print('Bake', img.name, round(time.monotonic()-start, 2), 's', flush=True)
    tree.links.new(principled.outputs['BSDF'], output.inputs['Surface'])


def save(img, name, jpg=False):
    img.filepath_raw = str(TEXTURES / name)
    img.file_format = 'JPEG' if jpg else 'PNG'
    img.save(quality=92)
    path = img.filepath_raw
    saved = bpy.data.images.load(path, check_existing=False)
    saved.colorspace_settings.name = img.colorspace_settings.name
    saved.pack()
    return saved


def packed_material(name, base, normal, orm):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (.52,.55,.55,1)
    material.use_nodes = True
    material.use_backface_culling = True
    tree = material.node_tree
    bsdf = tree.nodes.get('Principled BSDF')
    bsdf.inputs['Metallic'].default_value = 1
    bsdf.inputs['Roughness'].default_value = 1
    bsdf.inputs['IOR'].default_value = 1.46
    a, n, orm_map = [tree.nodes.new('ShaderNodeTexImage') for _ in range(3)]
    for node, img, location in zip([a,n,orm_map], [base,normal,orm], [(-690,350),(-690,30),(-690,-290)]):
        node.image = img
        node.label = img.name
        node.location = location
    tree.links.new(a.outputs['Color'], bsdf.inputs['Base Color'])
    normal_map = tree.nodes.new('ShaderNodeNormalMap')
    normal_map.location = (-335,30)
    normal_map.inputs['Strength'].default_value = .82
    tree.links.new(n.outputs['Color'], normal_map.inputs['Color'])
    tree.links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])
    separate = tree.nodes.new('ShaderNodeSeparateColor')
    separate.location = (-330,-290)
    tree.links.new(orm_map.outputs['Color'], separate.inputs['Color'])
    tree.links.new(separate.outputs['Green'], bsdf.inputs['Roughness'])
    tree.links.new(separate.outputs['Blue'], bsdf.inputs['Metallic'])
    gltf = bpy.data.node_groups.get('glTF Material Output')
    if gltf is None:
        gltf = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
        gltf.interface.new_socket(name='Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    output = tree.nodes.new('ShaderNodeGroup')
    output.node_tree = gltf
    output.location = (-80,-300)
    tree.links.new(separate.outputs['Red'], output.inputs['Occlusion'])
    return material


def atlas(obj, reference, size, label):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 12
    scene.cycles.device = 'CPU'
    if not scene.world:
        world = scene.world = bpy.data.worlds.new('Asset studio')
        world.use_nodes = True
        world.node_tree.nodes.get('Background').inputs['Color'].default_value = (.42,.48,.55,1)
        world.node_tree.nodes.get('Background').inputs['Strength'].default_value = .5
    material = bpy.data.materials.new('Baking only')
    material.use_nodes = True
    obj.data.materials.append(material)
    paint_attributes(obj)
    base = image('Base color bake', size, color=True)
    roughness = image('Roughness bake', size)
    normal = image('Source normal bake', size)
    occlusion = image('Occlusion bake', size)
    bake_pass(obj, None, 'EMIT', base, 'Dye')
    bake_pass(obj, None, 'EMIT', roughness, 'Roughness')
    reference.hide_render = False
    bake_pass(obj, reference, 'NORMAL', normal)
    reference.hide_render = True
    scene.cycles.use_adaptive_sampling = True
    bake_pass(obj, None, 'AO', occlusion)
    orm = image('Occlusion roughness metallic bake', size)
    pixels = np.empty(size*size*4, dtype=np.float32)
    combined = np.ones((size*size, 4), dtype=np.float32)
    occlusion.pixels.foreach_get(pixels)
    combined[:, 0] = .34 + .66*pixels[::4]
    roughness.pixels.foreach_get(pixels)
    combined[:, 1] = pixels[::4]
    combined[:, 2] = 0
    orm.pixels.foreach_set(combined.ravel())
    textures = (
        save(base, f'uniform-base-{label}.jpg', jpg=True),
        save(normal, f'uniform-normal-{label}.png'),
        save(orm, f'uniform-orm-{label}.png'),
    )
    obj.data.materials.clear()
    for attr in list(obj.data.color_attributes):
        obj.data.color_attributes.remove(attr)
    bpy.data.materials.remove(material)
    for img in (base, roughness, normal, occlusion, orm):
        bpy.data.images.remove(img)
    return packed_material('Student uniform · '+label, *textures)


def recover_atlas(label):
    names = (f'uniform-base-{label}.jpg', f'uniform-normal-{label}.png', f'uniform-orm-{label}.png')
    maps = [bpy.data.images.load(str(TEXTURES / name)) for name in names]
    for index, img in enumerate(maps):
        img.colorspace_settings.name = 'sRGB' if index == 0 else 'Non-Color'
        img.pack()
    return packed_material('Student uniform · '+label, *maps)


def export_glb(obj, rig, tier):
    select(obj, rig)
    obj.hide_set(False)
    for track in rig.animation_data.nla_tracks:
        track.mute = False
    bpy.ops.export_scene.gltf(filepath=str(MODELS / f'student-{tier}.glb'), export_format='GLB',
                              use_selection=True, export_animations=True, export_animation_mode='NLA_TRACKS',
                              export_image_format='AUTO', export_tangents=False, export_meshopt_compression_enable=True,
                              export_extras=False, export_all_influences=False, export_def_bones=True,
                              export_rest_position_armature=True)
    for track in rig.animation_data.nla_tracks:
        track.mute = True


def main():
    options = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    size = 1024 if '--draft' in options else 2048
    for folder in (TEXTURES, MODELS):
        folder.mkdir(exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    reference = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
    reference.name = 'SOURCE · Tencent Hunyuan · 1.5M'
    select(reference)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    reference.data.transform(Matrix.Scale(SCALE, 4))
    bpy.ops.object.shade_smooth()

    near = duplicate(reference, 'LOD0 · near')
    collapse(near, 62200, source=True)
    refined_edges = refine_joint_bands(near, reference)
    mid = duplicate(near, 'LOD1 · medium')
    collapse(mid, 22100)
    far = duplicate(mid, 'LOD2 · far')
    collapse(far, 7200)
    lods = [(near, 'near', '2k', size), (mid, 'mid', '1k', size//2), (far, 'far', '512', size//4)]

    for obj, _, _, _ in lods:
        obj.hide_render = True
    for obj, _, label, resolution in lods:
        obj.hide_render = False
        unwrap(obj)
        obj.data.materials.append(recover_atlas(label) if '--reuse-bakes' in options else atlas(obj, reference, resolution, label))
        # Keep the other tiers out of AO rays while baking the next mesh.
        obj.hide_render = True

    rig = armature()
    animate(rig)
    first_collection = reference.users_collection[0]
    source_collection = bpy.data.collections.new('Source sculpt · full resolution')
    bpy.context.scene.collection.children.link(source_collection)
    first_collection.objects.unlink(reference)
    source_collection.objects.link(reference)
    source_collection.hide_render = True
    reference.hide_set(True)

    report = {'refinedJointEdges': refined_edges}
    for obj, tier, _, _ in lods:
        bind(obj, rig, source_points(obj.data))
        export_glb(obj, rig, tier)
        report[tier] = {'triangles': len(obj.data.polygons), 'vertices_before_uv_splits': len(obj.data.vertices),
                        'bytes': (MODELS / f'student-{tier}.glb').stat().st_size}
        obj.hide_render = tier != 'near'
        obj.hide_set(tier != 'near')
    select(near)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'haiz-student.blend'), compress=True)
    (ROOT / 'evidence' / 'production.json').write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    main()
