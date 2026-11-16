"""Shared helpers for the HAIZ stylized (toon) asset builds (Blender 5.x / PyPI bpy).

Geometry is built procedurally with bmesh so every asset is reproducible from
these scripts; nothing is sculpted by hand and nothing is downloaded.
Coordinates: Blender Z-up metres. The glTF exporter writes (X, Z, -Y), so a
figure facing Blender -Y faces three.js +Z.
"""
import math
import os
import random

import bpy  # noqa: I001  bpy must load before bmesh / mathutils
import bmesh
from mathutils import Vector, Matrix

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'lanren', 'assets', 'toon')
BUILD = os.path.join(ROOT, 'build', 'toon')
os.makedirs(OUT, exist_ok=True)
os.makedirs(BUILD, exist_ok=True)


def reset(fps=30):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = fps
    return sc


KIND = {'cloth': 1.0, 'skin': 0.75, 'hair': 0.5, 'unlit': 0.25}


def material(name, rgb, rough=0.85, metal=0.0, kind='cloth'):
    """A plain principled material; three.js replaces it with the toon shader by name.
    With Builder.build(bake=True) its colour and kind go into COLOR_0 instead (one draw call)."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m['srgb'] = list(rgb) if not isinstance(rgb, str) else [int(rgb[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    m['kind'] = KIND[kind]
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (*srgb_to_linear(rgb), 1.0)
        bsdf.inputs['Roughness'].default_value = rough
        bsdf.inputs['Metallic'].default_value = metal
    m.diffuse_color = (*srgb_to_linear(rgb), 1.0)
    return m


def srgb_to_linear(rgb):
    if isinstance(rgb, str):
        rgb = tuple(int(rgb[i:i + 2], 16) / 255 for i in (1, 3, 5))
    return tuple((c / 12.92) if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb)


class Builder:
    """Accumulates one mesh: verts, faces, per-face material slot, per-vertex bone weights
    and an optional per-vertex colour and custom normal."""

    def __init__(self, name):
        self.name = name
        self.verts, self.faces, self.fmat = [], [], []
        self.weights, self.colors, self.normals, self.uvs = [], [], [], []
        self.mats = []

    def slot(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def add(self, verts, faces, mat, weights=None, color=(1, 1, 1, 1), normals=None, uvs=None):
        base = len(self.verts)
        s = self.slot(mat)
        self.verts.extend(Vector(v) for v in verts)
        for i, v in enumerate(verts):
            self.weights.append(weights[i] if isinstance(weights, list) else (weights or {}))
            self.colors.append(color[i] if isinstance(color, list) else color)
            self.normals.append(normals[i] if normals else None)
        for f in faces:
            self.faces.append(tuple(base + i for i in f))
            self.fmat.append(s)
            if uvs is not None:
                self.uvs.append(tuple(uvs[i] for i in f))
            else:
                self.uvs.append(tuple((0.5, 0.5) for _ in f))
        return base

    def add_bm(self, bm, mat, weights=None, color=(1, 1, 1, 1), xform=None, normal_fn=None, uv_fn=None):
        bm.verts.ensure_lookup_table()
        if xform is not None:
            for v in bm.verts:
                v.co = xform @ v.co
        verts = [v.co.copy() for v in bm.verts]
        faces = [[v.index for v in f.verts] for f in bm.faces]
        w = [weights(v) for v in verts] if callable(weights) else weights
        c = [color(v) for v in verts] if callable(color) else color
        n = [normal_fn(v) for v in verts] if normal_fn else None
        uv = [uv_fn(v) for v in verts] if uv_fn else None
        bm.free()
        return self.add(verts, faces, mat, w, c, n, uv)

    def build(self, smooth=True, color_name='Col', bake=None):
        """bake: a material that replaces all slots; each face's own colour and kind go to COLOR_0."""
        me = bpy.data.meshes.new(self.name)
        me.from_pydata([tuple(v) for v in self.verts], [], self.faces)
        for m in ([bake] if bake else self.mats):
            me.materials.append(m)
        for poly, s in zip(me.polygons, self.fmat):
            poly.material_index = 0 if bake else s
            poly.use_smooth = smooth
        # colours per corner (exported as COLOR_0)
        ca = me.color_attributes.new(name=color_name, type='BYTE_COLOR', domain='CORNER')
        uvl = me.uv_layers.new(name='UVMap')
        for poly, fuv, s in zip(me.polygons, self.uvs, self.fmat):
            m = self.mats[s]
            for k, li in enumerate(poly.loop_indices):
                vi = me.loops[li].vertex_index
                if bake:
                    ca.data[li].color = (*srgb_to_linear(m['srgb']), m['kind'])
                else:
                    ca.data[li].color = self.colors[vi]
                uvl.data[li].uv = fuv[k]
        me.color_attributes.active_color = ca
        if any(n is not None for n in self.normals):
            loops = []
            for li in range(len(me.loops)):
                vi = me.loops[li].vertex_index
                n = self.normals[vi]
                loops.append(tuple(n) if n is not None else (0, 0, 0))
            me.normals_split_custom_set(loops)
        me.validate(clean_customdata=False)
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        groups = {}
        for vi, w in enumerate(self.weights):
            for bone, val in w.items():
                if val <= 0:
                    continue
                g = groups.get(bone) or ob.vertex_groups.new(name=bone)
                groups[bone] = g
                g.add([vi], val, 'REPLACE')
        return ob


def frame_for(t):
    t = Vector(t).normalized()
    ref = Vector((1, 0, 0)) if abs(t.x) < 0.9 else Vector((0, 1, 0))
    u = (ref - t * ref.dot(t)).normalized()
    v = t.cross(u)
    return u, v


def tube(b, rings, sides, mat, cap0=True, cap1=True, color=(1, 1, 1, 1)):
    """rings: [(centre, (rx, ry), weights)], each ring an ellipse across the path."""
    verts, faces, ws = [], [], []
    n = len(rings)
    for i, (c, (rx, ry), w) in enumerate(rings):
        c = Vector(c)
        a = Vector(rings[max(0, i - 1)][0])
        z = Vector(rings[min(n - 1, i + 1)][0])
        u, v = frame_for(z - a)
        for k in range(sides):
            t = 2 * math.pi * k / sides
            verts.append(c + u * (math.cos(t) * rx) + v * (math.sin(t) * ry))
            ws.append(w)
    for i in range(n - 1):
        for k in range(sides):
            a, bb = i * sides + k, i * sides + (k + 1) % sides
            faces.append((a, bb, bb + sides, a + sides))
    if cap0:
        verts.append(Vector(rings[0][0]))
        ws.append(rings[0][2])
        ci = len(verts) - 1
        for k in range(sides):
            faces.append(((k + 1) % sides, k, ci))
    if cap1:
        verts.append(Vector(rings[-1][0]))
        ws.append(rings[-1][2])
        ci = len(verts) - 1
        o = (n - 1) * sides
        for k in range(sides):
            faces.append((o + k, o + (k + 1) % sides, ci))
    return b.add(verts, faces, mat, ws, color)


def ico(subdiv=2, radius=1.0):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    return bm


def uvsphere(u=16, v=10, radius=1.0):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=radius)
    return bm


def rounded_box(size, bevel=0.02, segments=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    bmesh.ops.bevel(bm, geom=list(bm.edges) + list(bm.verts), offset=bevel, segments=segments, affect='EDGES', profile=0.5)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    return bm


def cone(r0, r1, depth, segs=8):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r0, radius2=r1, depth=depth)
    return bm


def trs(loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    from mathutils import Euler
    return Matrix.Translation(Vector(loc)) @ Euler(rot, 'XYZ').to_matrix().to_4x4() @ Matrix.Diagonal((*scale, 1.0))


def export_glb(path, objects, animations=False):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_yup=True,
        export_apply=False, export_normals=True, export_texcoords=True,
        export_vertex_color='ACTIVE', export_all_vertex_colors=False,
        export_animations=animations, export_animation_mode='ACTIONS' if animations else 'ACTIONS',
        export_skins=True, export_morph=False, export_materials='EXPORT',
        export_image_format='NONE', export_extras=False, export_cameras=False, export_lights=False,
    )


def rng(seed):
    return random.Random(seed)
