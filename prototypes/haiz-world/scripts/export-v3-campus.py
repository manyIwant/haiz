"""Export remaining current Blender V3 regions, never save the source blend."""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import sys
import bpy

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('haiz_export_helpers', HERE / 'export-blender-v3.py')
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)


def select(objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)


def export(objects, destination, texture_limit=512):
    if destination.exists():
        raise FileExistsError('Refusing to overwrite existing export: ' + str(destination))
    select(objects)
    helpers.resize_images(texture_limit)
    bpy.ops.export_scene.gltf(filepath=str(destination), export_format='GLB', use_selection=True,
        export_yup=True, export_apply=False, export_materials='EXPORT', export_normals=True,
        export_tangents=True, export_texcoords=True, export_cameras=False, export_lights=False,
        export_extras=True, export_animations=False, export_gpu_instances=True,
        export_image_format='AUTO', export_keep_originals=False, export_unused_images=False,
        export_shared_accessors=True)
    data = destination.read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    gltf = json.loads(data[20:20 + length])
    return {'file': destination.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
        'nodes': len(gltf['nodes']), 'meshes': len(gltf['meshes']),
        'trianglesUnique': sum(gltf['accessors'][p['indices']]['count'] // 3 for m in gltf['meshes'] for p in m['primitives']),
        'instances': sum(gltf['accessors'][next(iter(n['extensions']['EXT_mesh_gpu_instancing']['attributes'].values()))]['count']
            for n in gltf['nodes'] if 'EXT_mesh_gpu_instancing' in n.get('extensions', {})),
        'textureMaxDimension': texture_limit}


def main(source, output):
    before = helpers.fingerprint(source)
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    anchors = helpers.anchors()
    excluded = {'SITE_yihao', 'SITE_lanshu', 'SITE_yanchi', 'SITE_hujulongpan', 'SITE_yundong'}
    roots = [o for o in bpy.context.scene.objects if o.name.startswith('SITE_') and o.name not in excluded]
    buildings = {o for r in roots for o in (r, *r.children_recursive) if o.type in ('MESH', 'EMPTY') and not o.hide_render}
    trees = {o for o in bpy.context.scene.objects if o.type == 'MESH' and o.get('v3_shared_tree') and not o.hide_render}
    tree_parent = bpy.data.objects.new('V3 shared tropical vegetation', None)
    bpy.context.scene.collection.objects.link(tree_parent)
    for tree in trees:
        matrix = tree.matrix_world.copy()
        tree.parent = tree_parent
        tree.matrix_world = matrix
    terrain_names = ['00 Site | Asphalt', 'V2 original roads union no coplanar crossings'] + [f'V2 terrain patch {i}' for i in range(4)]
    terrain = {bpy.context.scene.objects[name] for name in terrain_names if name in bpy.context.scene.objects}
    helpers.prepare(tuple(buildings | trees | terrain))
    output.mkdir(parents=True, exist_ok=True)
    report = {'source': before, 'exportedUtc': datetime.now(timezone.utc).isoformat(),
        'anchors': anchors, 'buildingIds': [r.name[5:] for r in roots], 'assets': {},
        'preservedLegacy': ['sports detailed track and courts', 'ground-floor classroom contents', 'navigation and information']}
    report['assets']['campus'] = export(buildings, output / 'campus.glb')
    report['assets']['terrain'] = export(terrain, output / 'terrain.glb')
    report['assets']['planting'] = export(trees | {tree_parent}, output / 'planting.glb')
    reduced = helpers.reduce_leaves(tuple(trees))
    report['assets']['plantingMobile'] = export(trees | {tree_parent}, output / 'planting-mobile.glb', 256)
    report['mobileReduction'] = reduced
    if before != helpers.fingerprint(source):
        raise RuntimeError('Source blend fingerprint changed')
    destination = HERE.parent / 'docs/v3/campus-assets.json'
    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print('V3_CAMPUS_EXPORTED', json.dumps(report['assets']), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    main(args.source.resolve(), args.output.resolve())
