"""Export selected V3 landmarks without saving or changing the source files.

Run with Blender --background --disable-autoexec --python-exit-code 1
--python scripts/export-blender-v3.py -- --source /path/HAIZ-Campus-V3.blend
--output /path/public/haiz/world/v3/assets
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import struct
import sys
import tempfile

import bpy

SITE_ROOTS = ('SITE_yihao', 'SITE_lanshu', 'SITE_yanchi')
SEPARATE_ROOTS = (
    *(f'Limestone_{i}_high' for i in range(3)),
    *(f'Pond layered stone {i}' for i in range(7)),
    'PondStele', 'Taihu rock interpretation', 'V3 Terminalia low stone seats',
    'V3 Terminalia root garden broad leaves', 'V3 Terminalia terrace stone risers',
    'V3 Terminalia terrace with soil opening', 'V3 Terminalia three shallow approach steps',
    'V3 yihao continuous entrance forecourt', 'V3 yihao forecourt edge drainage',
    'V3 low tropical groundcover',
)
MANIFEST = Path(__file__).resolve().parents[1] / 'docs/v3/blender-assets.json'
MAX_BYTES = 25_000_000
LEAF_MIN_VERTICES = 10_000
LEAF_STEP = 3


def utc(timestamp):
    return datetime.fromtimestamp(timestamp, timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def fingerprint(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    stat = path.stat()
    return {'path': str(path), 'sha256': digest.hexdigest(), 'bytes': stat.st_size,
            'modifiedUtc': utc(stat.st_mtime)}


def anchors():
    result = []
    for obj in sorted(bpy.context.scene.objects, key=lambda obj: obj.name):
        if obj.name.startswith('SITE_'):
            x, y, z = obj.matrix_world.translation
            result.append({'name': obj.name, 'blender': [x, y, z], 'gltf': [x, z, -y]})
    if len(result) != 34:
        raise RuntimeError(f'Expected 34 source anchors, found {len(result)}')
    return result


def select_landmarks():
    roots = tuple(bpy.context.scene.objects.get(name) for name in (*SITE_ROOTS, *SEPARATE_ROOTS))
    missing = [name for name, obj in zip((*SITE_ROOTS, *SEPARATE_ROOTS), roots) if obj is None]
    if missing:
        raise RuntimeError(f'Missing required roots: {missing}')
    selected = {obj for root in roots for obj in (root, *root.children_recursive)}
    if any(obj.type not in ('MESH', 'EMPTY') or obj.hide_render for obj in selected):
        raise RuntimeError('Selected landmarks contain hidden or unsupported objects')
    bpy.ops.object.select_all(action='DESELECT')
    for obj in selected:
        obj.hide_set(False)
        obj.select_set(True)
    return tuple(sorted(selected, key=lambda obj: obj.name))


def planar_uv(obj):
    """Same physical-metre UV fallback as the source geometry.py helper."""
    uv = obj.data.uv_layers.active or obj.data.uv_layers.new(name='Physical metres')
    for polygon in obj.data.polygons:
        axis = max(range(3), key=lambda i: abs(polygon.normal[i]))
        a, b = ((1, 2), (0, 2), (0, 1))[axis]
        for index in polygon.loop_indices:
            point = obj.data.vertices[obj.data.loops[index].vertex_index].co
            uv.data[index].uv = (point[a], point[b])


def prepare(selected):
    for obj in selected:
        if obj.type != 'MESH':
            continue
        if not obj.data.uv_layers:
            planar_uv(obj)
        bpy.context.view_layer.objects.active = obj
        for modifier in tuple(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj['haiz_v3_material_color_space'] = 'linear'
    bpy.context.view_layer.update()


def resize_images(limit):
    # Blender re-encodes dirty packed images; no unpacking into the source folder.
    for image in bpy.data.images:
        width, height = image.size
        if image.type == 'IMAGE' and max(width, height) > limit:
            scale = limit / max(width, height)
            image.scale(max(1, round(width * scale)), max(1, round(height * scale)))
            image.pack()


def reduce_leaves(selected):
    """Keep every third whole leaf using the source export.py leaf-stride method."""
    replacements, changed = {}, []
    for obj in selected:
        stride = int(obj.get('v3_leaf_stride', 0))
        if obj.type != 'MESH' or not stride or len(obj.data.vertices) < LEAF_MIN_VERTICES:
            continue
        old = obj.data
        if stride not in (5, 7) or len(old.vertices) % stride:
            raise RuntimeError(f'Unsupported leaf topology: {obj.name}')
        if old.name not in replacements:
            fan = ((0, 1, 6), (1, 2, 6), (2, 3, 6), (3, 4, 6), (4, 5, 6), (5, 0, 6)) if stride == 7 else (
                (0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4))
            if len(old.polygons) != len(old.vertices) // stride * len(fan):
                raise RuntimeError(f'Unexpected leaf face count: {obj.name}')
            vertices, faces, materials = [], [], []
            for leaf in range(0, len(old.vertices) // stride, LEAF_STEP):
                offset = len(vertices)
                vertices.extend(tuple(old.vertices[leaf * stride + j].co) for j in range(stride))
                faces.extend(tuple(offset + j for j in face) for face in fan)
                materials.extend(old.polygons[leaf * len(fan) + j].material_index for j in range(len(fan)))
            mesh = bpy.data.meshes.new(old.name + ' Mobile')
            mesh.from_pydata(vertices, [], faces)
            mesh.update()
            for material in old.materials:
                mesh.materials.append(material)
            for polygon, material in zip(mesh.polygons, materials):
                polygon.material_index = material
            replacements[old.name] = mesh
        obj.data = replacements[old.name]
        planar_uv(obj)
        changed.append(obj.name)
    return {'technique': 'Source export.py leaf-stride thinning; retain every third complete leaf',
            'nodeNames': changed, 'meshCount': len(replacements)}


def glb_record(path, texture_limit, expected_names):
    blob = path.read_bytes()
    if blob[:4] != b'glTF' or struct.unpack_from('<I', blob, 4)[0] != 2:
        raise RuntimeError(f'Invalid GLB: {path}')
    json_size = struct.unpack_from('<I', blob, 12)[0]
    data = json.loads(blob[20:20 + json_size])
    if sorted(node['name'] for node in data['nodes']) != sorted(expected_names):
        raise RuntimeError('Exported node set differs from the selected source objects')
    if any('uri' in item for key in ('buffers', 'images') for item in data.get(key, [])):
        raise RuntimeError('Export unexpectedly references external resources')
    if len(blob) >= MAX_BYTES:
        print(f'V3_ASSET_BUDGET: {path.name} is {len(blob)} bytes; exceeds 25 MB target', flush=True)
    primitives = [p for mesh in data['meshes'] for p in mesh['primitives']]
    counts = {key: len(data[key]) for key in ('nodes', 'meshes', 'materials', 'images')}
    counts.update(primitives=len(primitives),
                  vertices=sum(data['accessors'][p['attributes']['POSITION']]['count'] for p in primitives),
                  triangles=sum(data['accessors'][p['indices']]['count'] // 3 for p in primitives))
    return {'file': path.name, 'bytes': len(blob), 'sha256': hashlib.sha256(blob).hexdigest(),
            'textureMaxDimension': texture_limit, 'counts': counts}


def export_file(path, limit, names):
    resize_images(limit)
    result = bpy.ops.export_scene.gltf(
        filepath=str(path), export_format='GLB', use_selection=True,
        export_yup=True, export_apply=False, export_materials='EXPORT', export_normals=True,
        export_tangents=True, export_texcoords=True, export_cameras=False, export_lights=False,
        export_extras=True, export_animations=False, export_gpu_instances=True,
        export_image_format='AUTO', export_keep_originals=False, export_unused_images=False,
        export_shared_accessors=True)
    if 'FINISHED' not in result or not path.is_file():
        raise RuntimeError(f'GLB export failed: {path}')
    return glb_record(path, limit, names)


def model_phase(selected):
    names = sorted(obj.name for obj in selected if 'roof' in obj.name.lower())
    r3 = ('V3 yihao roof central' in names and 'V3 yihao roof entrance upper' in names
          and any(name.startswith('V3 yihao white roof arris') for name in names))
    return {'actual': 'R3' if r3 else 'R2 or earlier', 'roofNodeNames': names,
            'centralWidthFraction': bpy.context.scene.get('r3_central_width_fraction'),
            'evidence': 'Actual open .blend nodes; existing source GLB files are not used'}


def publish(work, output, report):
    # Exclusive creation prevents accidental overwrites, including source exports.
    for name in ('hero.glb', 'hero-mobile.glb'):
        with (work / name).open('rb') as source, (output / name).open('xb') as destination:
            shutil.copyfileobj(source, destination)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main(source, output):
    source, output = source.resolve(strict=True), output.resolve()
    if source.suffix.lower() != '.blend':
        raise ValueError('--source must name a .blend file')
    if source.parent == output or source.parent in output.parents:
        raise ValueError('Export output must be outside the model directory')
    if any((output / name).exists() for name in ('hero.glb', 'hero-mobile.glb')):
        raise FileExistsError('Export targets already exist; refusing to overwrite GLBs')
    original = fingerprint(source)
    original_exports = [fingerprint(path) for path in (
        source.with_suffix('.glb'), source.parent / 'web/HAIZ-Campus-V3-mobile.glb') if path.is_file()]
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    original_anchors = anchors()
    selected = select_landmarks()
    names = [obj.name for obj in selected]
    phase = model_phase(selected)
    prepare(selected)
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.v3-export-', dir=output) as directory:
        work = Path(directory)
        full = export_file(work / 'hero.glb', 512, names)
        reduction = reduce_leaves(selected)
        mobile = export_file(work / 'hero-mobile.glb', 256, names)
        if original != fingerprint(source) or any(item != fingerprint(Path(item['path'])) for item in original_exports):
            raise RuntimeError('Source fingerprint changed during export')
        if original_anchors != anchors():
            raise RuntimeError('Source anchor positions changed in memory')
        report = {
            'schemaVersion': 1, 'exportedUtc': utc(datetime.now(timezone.utc).timestamp()),
            'source': {**original, 'preserved': True}, 'originalExports': original_exports,
            'blenderVersion': bpy.app.version_string, 'modelPhase': phase,
            'coordinates': 'glTF (X,Y,Z) = Blender (X,Z,-Y), metres; direct legacy alignment',
            'anchors': original_anchors,
            'selection': {'siteRoots': list(SITE_ROOTS), 'separateRoots': list(SEPARATE_ROOTS),
                          'nodeNames': names, 'objectCount': len(names),
                          'excluded': 'Global ground, roads, shared tropical vegetation and all other SITE subtrees'},
            'materials': {'colorSpace': 'linear', 'baseColorFactor': 'linear RGB',
                          'baseColorTextures': 'sRGB', 'normalAndMetallicRoughnessTextures': 'linear',
                          'runtimeNote': 'GLTFLoader already interprets material factors as linear; do not convert them from sRGB again'},
            'export': {'selectionOnly': True, 'yUp': True, 'extras': True, 'normals': True,
                       'texcoords': True, 'tangents': True, 'modifiersApplied': True,
                       'cameras': False, 'lights': False, 'animations': False},
            'assets': {'full': full, 'mobile': mobile}, 'mobileReduction': reduction,
        }
        publish(work, output, report)
    print('V3_ASSETS_EXPORTED', json.dumps({'sourceSha256': original['sha256'], 'modelPhase': phase['actual'],
          'selectedObjects': len(names), 'assets': report['assets'], 'mobileReduction': reduction}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    options = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    main(options.source, options.output)
