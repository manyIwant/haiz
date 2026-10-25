#!/usr/bin/env python3
"""HAIZ Inner World: deterministic Blender 4.x hero-prop authoring scaffold.

Invoke after installing Blender:
  blender -b --python tools/innerworld/build_hero_blender.py
  blender -b --python tools/innerworld/build_hero_blender.py -- --bake-ao

Outputs to generated/innerworld-v3/ (not automatically shipped in web bundles).
The web scene currently uses the original Three.js geometry, not these GLBs.
AO is an additional authoring texture; glTF does NOT magically attach it as a
second-channel occlusion map. UV2+aoMap integration requires a separate patch.
No proprietary game geometry, sounds or textures are loaded.
"""
import bpy
import json
import math
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(os.environ.get("HAIZ_INNERWORLD_OUT", ROOT / "generated" / "innerworld-v3"))
OUT.mkdir(parents=True, exist_ok=True)
BAKE_AO = "--bake-ao" in sys.argv

def mat(name, color, roughness, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1.0)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1.0)
    p.inputs["Roughness"].default_value = roughness
    p.inputs["Metallic"].default_value = metallic
    return m

def cube(name, loc, dims, material, bevel=0, steps=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel:
        modifier = obj.modifiers.new("real edge highlight", 'BEVEL')
        modifier.width = bevel
        modifier.segments = steps
        modifier.affect = 'EDGES' if hasattr(modifier, "affect") else modifier.affect if hasattr(modifier, "affect") else None
    norm = obj.modifiers.new("weighted planar normals", 'WEIGHTED_NORMAL')
    norm.keep_sharp = True
    return obj

def cyl(name, loc, radius, depth, material, vertices=24, bottom=None):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices, radius1=bottom if bottom is not None else radius,
        radius2=radius, depth=depth, location=loc
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj

def turned(name, profile, n, material, loc):
    # Profile pairs are (radius, height), including actual inner vessel surfaces.
    verts = []
    faces = []
    for r, h in profile:
        for i in range(n):
            angle = i * math.tau / n
            verts.append((r * math.cos(angle), r * math.sin(angle), h))
    for j in range(len(profile) - 1):
        for i in range(n):
            a = j*n+i
            b = j*n+(i+1)%n
            faces.append((a, b, b+n, a+n))
    mesh = bpy.data.meshes.new(name + " mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    ob.data.materials.append(material)
    for p in mesh.polygons:
        p.use_smooth = True
    return ob

def bevel_sample(level):
    steps = (5, 3, 1)[level]
    edge = (.016, .009, .004)[level]
    return steps, edge

def build(level):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.context.scene.render.engine = 'CYCLES'
    bpy.context.scene.cycles.samples = 32
    bpy.context.scene.render.resolution_x = 512
    bpy.context.scene.render.resolution_y = 512
    wood = mat("acoustic walnut / base color", (.43, .28, .17), .73)
    edge = mat("cut timber endgrain", (.31, .22, .14), .82)
    metal = mat("aged dark graphite steel", (.20, .25, .24), .44, .35)
    enamel = mat("satin lamp enamel", (.58, .68, .62), .28, .10)
    paper = mat("natural writing stock", (.84, .80, .71), .96)
    fabric = mat("woven olive-grey upholstery", (.31, .42, .38), .97)
    brass = mat("brushed warm brass", (.62, .46, .25), .29, .76)
    ceramic = mat("porcelain / ivory glaze", (.82, .78, .70), .24, .02)
    ink = mat("ink and book cover", (.21, .28, .26), .62)
    bevels, edge_size = bevel_sample(level)
    hero = []
    hero.append(cube("desk / radiused timber top", (0, 0, .79), (1.76, .78, .071), wood, .024, bevels))
    hero.append(cube("desk / layered edge reveal", (0, 0, .745), (1.70, .73, .015), edge, edge_size, bevels))
    for x in (-.79, .79):
        for y in (-.29, .29):
            hero.append(cube("steel desk leg", (x, y, .38), (.046,.046,.73), metal, .007, bevels))
    hero.append(cube("desk structural bar", (0,-.29,.49),(1.55,.045,.09),metal,.008,bevels))
    hero.append(cube("chair / cushion body", (.18,.92,.52),(.61,.57,.072),fabric,.030,bevels))
    hero.append(cube("chair / upholstered back", (.18,1.20,.86),(.60,.07,.56),fabric,.034,bevels))
    for x in (-.095,.455):
        for y in (.69,1.14):
            hero.append(cube("chair graphite support", (x,y,.24),(.04,.04,.48),metal,.004,bevels))
    if level < 2:
        hero.append(cube("writing journal / page block",(.39,-.04,.846),(.40,.55,.024),paper,.007,bevels))
        hero.append(cube("writing journal / spine",(.18,-.04,.852),(.022,.55,.03),edge,.004,bevels))
        hero.append(cyl("ceramic lamp pivot", (-.76,-.16,1.25),.025,.07,brass,16))
        hero.append(cyl("ceramic lamp stand",(-.72,-.16,1.06),.013,.45,metal,14))
        hero.append(cyl("lamp mount base",(-.72,-.16,.835),.092,.018,metal,24))
        hero.append(turned("lamp shade / sloped reflector",[
            (.012,.0),(.05,.015),(.12,.08),(.127,.1),(.116,.101)
        ],(36,24)[level],enamel,(-.75,-.16,1.38)))
        hero.append(turned("cup / real inner and outer wall",[
            (.0,.0),(.055,.0),(.065,.012),(.068,.075),(.065,.11),
            (.058,.115),(.055,.109),(.058,.075),(.057,.015),(.0,.013)
        ],(36,24)[level],ceramic,(-.62,.16,.838)))
    if level == 0:
        hero.append(cube("pen / graphite",(.08,.24,.86),(.27,.018,.018),ink,.004,5))
        hero.append(cube("pen / brass grip",(-.047,.24,.86),(.052,.020,.020),brass,.004,4))
        hero.append(cube("notebook / fabric bookmark",(.43,.20,.86),(.04,.13,.007),fabric,.001,4))
    return hero

def ao_for_table(table):
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = table
    table.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(island_margin=.02)
    bpy.ops.object.mode_set(mode='OBJECT')
    atlas = bpy.data.images.new('HAIZ desk AO authoring atlas', width=512, height=512, alpha=False)
    node = table.active_material.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = atlas
    table.active_material.node_tree.nodes.active = node
    bpy.ops.object.bake(type='AO', margin=12, use_clear=True)
    atlas.filepath_raw = str(OUT / 'hero-desk-ao.png')
    atlas.file_format = 'PNG'
    atlas.save()
    table.active_material.node_tree.nodes.remove(node)

meta = {'author': 'HAIZ original procedural asset kit', 'unit':'meter', 'baked_AO':bool(BAKE_AO), 'levels':[]}
for level in range(3):
    objects = build(level)
    if BAKE_AO and level == 0:
        ao_for_table(objects[0])
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    path = OUT / f'hero-workstation-lod{level}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_apply=True)
    triangles = sum(len(p.vertices)-2 for ob in objects for p in ob.data.polygons)
    meta['levels'].append({'lod':level,'file':path.name,'triangles':triangles,'objects':len(objects),'bytes':path.stat().st_size})
(OUT / 'manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
print('Generated Three.js-compatible PBR GLBs. Visual review and glTFLoader integration remain required:', OUT)
