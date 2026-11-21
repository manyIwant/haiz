"""Inspect and render the source GLB. Run from a Blender background session."""
from pathlib import Path
import hashlib
import json
import struct
import time

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'source/20261121124835_b26256ec.glb'


def read_glb(path):
    with path.open('rb') as stream:
        assert struct.unpack('<4sII', stream.read(12)) == (b'glTF', 2, path.stat().st_size)
        size, kind = struct.unpack('<I4s', stream.read(8))
        assert kind == b'JSON'
        document = json.loads(stream.read(size))
        size, kind = struct.unpack('<I4s', stream.read(8))
        assert kind == b'BIN\0'
        binary = stream.read(size)
    return document, binary


def source_geometry():
    document, binary = read_glb(SOURCE)
    arrays = []
    for accessor, dtype, columns in zip(document['accessors'], ('<f4', '<u4'), (3, 3)):
        view = document['bufferViews'][accessor['bufferView']]
        offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        count = accessor['count'] * (3 if accessor['type'] == 'VEC3' else 1)
        arrays.append(np.frombuffer(binary, dtype=dtype, count=count, offset=offset).reshape(-1, columns))
    return document, *arrays


def audit(document, vertices, triangles):
    vertex_count = len(vertices)
    starts = triangles.ravel().astype(np.uint64)
    ends = triangles[:, [1, 2, 0]].ravel().astype(np.uint64)
    edges = np.minimum(starts, ends) * vertex_count + np.maximum(starts, ends)
    unique_edges, inverse, counts = np.unique(edges, return_inverse=True, return_counts=True)
    direction = np.bincount(inverse, weights=(starts < ends).astype(np.float64))
    edge_start, edge_end = unique_edges // vertex_count, unique_edges % vertex_count
    parents = np.arange(vertex_count)
    # Vectorized union and path compression, until all connected neighbors share a root.
    while True:
        a, b = parents[edge_start], parents[edge_end]
        different = a != b
        if not different.any():
            break
        np.minimum.at(parents, np.maximum(a[different], b[different]), np.minimum(a[different], b[different]))
        while not np.array_equal(parents[parents], parents):
            parents = parents[parents]
    roots, components = np.unique(parents[triangles[:, 0]], return_counts=True)
    t = vertices[triangles]
    cross = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
    volumes = np.bincount(parents[triangles[:, 0]], weights=np.einsum('ij,ij->i', t[:, 0], cross) / 6)
    top = np.argsort(components)[::-1]
    return dict(sha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(), bytes=SOURCE.stat().st_size,
                nodes=document['nodes'], meshes=len(document['meshes']), attributes=list(document['meshes'][0]['primitives'][0]['attributes']),
                vertices=vertex_count, triangles=len(triangles), bounds_min=vertices.min(0).tolist(), bounds_max=vertices.max(0).tolist(),
                components=[dict(root=int(roots[i]), triangles=int(components[i]), signed_volume=float(volumes[roots[i]])) for i in top],
                edges=int(len(counts)), boundary_edges=int((counts == 1).sum()), non_manifold_edges=int((counts > 2).sum()),
                reversed_neighbor_edges=int(((counts == 2) & (direction != 1)).sum()),
                exact_duplicate_positions=int(vertex_count - len(np.unique(vertices, axis=0))),
                zero_area_triangles=int((np.linalg.norm(cross, axis=1) == 0).sum()),
                duplicate_triangles=int(len(triangles) - len(np.unique(np.sort(triangles, axis=1), axis=0))),
                signed_volume=float(volumes.sum()), uv=sum(name.startswith('TEXCOORD_') for name in document['meshes'][0]['primitives'][0]['attributes']), materials=len(document.get('materials', [])),
                images=len(document.get('images', [])), skins=len(document.get('skins', [])), animations=len(document.get('animations', [])))


def render_views(obj, unit_scale=1.0):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x = 760
    scene.render.resolution_y = 920
    scene.render.resolution_percentage = 100
    shade = scene.display.shading
    shade.light = 'STUDIO'
    shade.studio_light = 'paint.sl'
    shade.color_type = 'SINGLE'
    shade.single_color = (.63, .70, .74)
    shade.show_shadows = True
    shade.show_cavity = True
    shade.cavity_type = 'BOTH'
    shade.show_object_outline = False
    shade.background_type = 'WORLD'
    scene.world = bpy.data.worlds.new('Audit background')
    scene.world.color = (.075, .092, .114)
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    scene.camera = camera
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 1.33 * unit_scale
    target = Vector((0, -.021 * unit_scale, .58 * unit_scale))
    for name, direction in [('front', (0, -3, .01)), ('side', (3, 0, .01)), ('back', (0, 3, .01)), ('three-quarter', (1.8, -3, .49))]:
        offset = Vector(direction) * unit_scale
        camera.location = target + offset
        camera.rotation_euler = (-offset).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(ROOT / 'evidence' / f'source-{name}.png')
        bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    started = time.monotonic()
    doc, vertices, triangles = source_geometry()
    report = audit(doc, vertices, triangles)
    (ROOT / 'evidence/source-audit.json').write_text(json.dumps(report, indent=2) + '\n')
    print('AUDIT', report, 'seconds', time.monotonic() - started, flush=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    obj = next(obj for obj in bpy.context.scene.objects if obj.type == 'MESH')
    obj.name = 'Hunyuan source'
    bpy.ops.object.shade_smooth()
    render_views(obj)
