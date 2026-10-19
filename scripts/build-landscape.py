"""Original, reproducible Blender rock assets for the campus pond.

Run: blender -b -t 4 --python scripts/build-landscape.py
The bundled campus_yanchi.jpg informs the layered silhouette; these are authored
meshes, not scans or extracted game assets. All baked channels remain light-free
except the separately packed ambient-occlusion channel.
"""
from pathlib import Path
import json
import math
import hashlib
import bpy
import bmesh
import numpy as np
from mathutils import Vector, noise

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/walk/models"
WORK = ROOT / "build/landscape"
OUT.mkdir(parents=True, exist_ok=True)
WORK.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 16
scene.cycles.use_denoising = False
scene.render.bake.margin = 12
scene.render.bake.use_clear = True
scene.view_settings.view_transform = "Standard"


def node(tree, kind, **props):
    result = tree.nodes.new(kind)
    for key, value in props.items():
        setattr(result, key, value)
    return result


material = bpy.data.materials.new("Layered limestone · original Blender bake")
material.use_nodes = True
tree = material.node_tree
tree.nodes.clear()
output = node(tree, "ShaderNodeOutputMaterial")
shader = node(tree, "ShaderNodeBsdfPrincipled")
tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
coords = node(tree, "ShaderNodeTexCoord")
coarse = node(tree, "ShaderNodeTexNoise")
coarse.inputs["Scale"].default_value = 3.8
coarse.inputs["Detail"].default_value = 6
coarse.inputs["Roughness"].default_value = .76
fine = node(tree, "ShaderNodeTexNoise")
fine.inputs["Scale"].default_value = 86
fine.inputs["Detail"].default_value = 3
for texture in [coarse, fine]:
    tree.links.new(coords.outputs["Object"], texture.inputs["Vector"])
ramp = node(tree, "ShaderNodeValToRGB")
ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1])
for i, (at, color) in enumerate([
    (.18, (.035, .043, .031, 1)), (.37, (.095, .106, .072, 1)),
    (.53, (.24, .245, .18, 1)), (.69, (.39, .375, .29, 1)),
    (.85, (.54, .52, .43, 1)),
]):
    entry = ramp.color_ramp.elements[0] if i == 0 else ramp.color_ramp.elements.new(at)
    entry.position, entry.color = at, color
tree.links.new(coarse.outputs["Fac"], ramp.inputs["Fac"])
tree.links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
rough = node(tree, "ShaderNodeMapRange")
rough.inputs["To Min"].default_value = .66
rough.inputs["To Max"].default_value = .96
tree.links.new(fine.outputs["Fac"], rough.inputs["Value"])
tree.links.new(rough.outputs["Result"], shader.inputs["Roughness"])
bump = node(tree, "ShaderNodeBump")
bump.inputs["Strength"].default_value = .7
bump.inputs["Distance"].default_value = .055
tree.links.new(fine.outputs["Fac"], bump.inputs["Height"])
tree.links.new(bump.outputs["Normal"], shader.inputs["Normal"])

rocks = []
for seed in range(3):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=80, ring_count=40, radius=1)
    rock = bpy.context.object
    rock.name = f"Limestone_{seed}"
    for vertex in rock.data.vertices:
        p = vertex.co.copy()
        offset = Vector((seed * 13.8, seed * 9.1, seed * 6.3))
        n = noise.fractal(p * 2.1 + offset, 1.0, 2.0, 4)
        detail = noise.noise_vector(p * 11 + offset)
        # Recessed strata and eroded rims survive as real geometry at grazing angles.
        phase = p.z * 25 + noise.noise(p * 3 + offset) * 1.7
        shelf = math.sin(phase) * .065 + math.sin(phase * 2.1) * .025
        radius = 1 + n * .21 + shelf
        vertex.co = ((p.x * radius + detail.x * .025) * (1.55 + seed * .10),
                     (p.y * radius + detail.y * .025) * (1.15 - seed * .05),
                     p.z * (.58 + seed * .08) + n * .13 + detail.z * .018)
    # Preserve three continuous spherical UV charts. Smart-projecting fractured
    # triangles wastes the atlas in hundreds of tiny islands and blurs close-ups.
    for loop in rock.data.uv_layers.active.data:
        loop.uv.x = .012 + seed / 3 + loop.uv.x * .309
        loop.uv.y = .02 + loop.uv.y * .96
    rock.location.x = seed * 4.5
    rock.data.materials.append(material)
    modifier = rock.modifiers.new("Preserve eroded silhouette", "DECIMATE")
    modifier.ratio = .29
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    for face in rock.data.polygons:
        face.use_smooth = True
    rocks.append(rock)

bpy.ops.object.select_all(action="DESELECT")
for rock in rocks:
    rock.select_set(True)
bpy.context.view_layer.objects.active = rocks[0]
bpy.ops.object.join()
atlas = bpy.context.object
atlas.name = "Limestone atlas"
texture_target = node(tree, "ShaderNodeTexImage")
emission = node(tree, "ShaderNodeEmission")


def bake(label, kind, socket=None):
    print("BAKE", label, flush=True)
    image = bpy.data.images.new(label, 1024, 1024, alpha=False)
    image.colorspace_settings.name = "sRGB" if label == "limestone-color" else "Non-Color"
    texture_target.image = image
    tree.nodes.active = texture_target
    if socket:
        tree.links.new(socket, emission.inputs["Color"])
        tree.links.new(emission.outputs[0], output.inputs["Surface"])
    else:
        tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    bpy.ops.object.bake(type=kind)
    image.filepath_raw = str(WORK / (label + ".png"))
    image.file_format = "PNG"
    image.save()
    return image


color = bake("limestone-color", "EMIT", ramp.outputs["Color"])
roughness = bake("limestone-roughness", "EMIT", rough.outputs["Result"])
normal = bake("limestone-normal", "NORMAL")
ao = bake("limestone-occlusion", "AO")
orm = bpy.data.images.new("limestone-orm", 1024, 1024, alpha=False)
orm.colorspace_settings.name = "Non-Color"
pixels = np.ones(1024 * 1024 * 4, dtype=np.float32)
scratch = np.empty_like(pixels)
ao.pixels.foreach_get(scratch)
pixels[0::4] = scratch[0::4]
roughness.pixels.foreach_get(scratch)
pixels[1::4] = scratch[0::4]
pixels[2::4] = 0
orm.pixels.foreach_set(pixels)
orm.filepath_raw = str(WORK / "limestone-orm.png")
orm.file_format = "PNG"
orm.save()

# Standard glTF PBR material: no runtime dependency on Blender's node renderer.
baked = bpy.data.materials.new("Limestone PBR · 1k atlas")
baked.use_nodes = True
bt = baked.node_tree
bsdf = bt.nodes.get("Principled BSDF")
for label, image in [("Base Color", color), ("Normal", normal), ("ORM", orm)]:
    tex = node(bt, "ShaderNodeTexImage", image=image, label=label)
    if label == "Base Color":
        bt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    elif label == "Normal":
        nm = node(bt, "ShaderNodeNormalMap")
        bt.links.new(tex.outputs["Color"], nm.inputs["Color"])
        bt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    else:
        sep = node(bt, "ShaderNodeSeparateColor")
        bt.links.new(tex.outputs["Color"], sep.inputs["Color"])
        bt.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
        bt.links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])
        # Recognized by Blender's official glTF exporter.
        settings = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
        settings.interface.new_socket(name="Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
        group = node(bt, "ShaderNodeGroup", node_tree=settings)
        bt.links.new(sep.outputs["Red"], group.inputs["Occlusion"])
atlas.data.materials.clear()
atlas.data.materials.append(baked)
for polygon in atlas.data.polygons:
    polygon.material_index = 0
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.separate(type="LOOSE")
bpy.ops.object.mode_set(mode="OBJECT")
parts = sorted([o for o in scene.objects if o.type == "MESH"],
               key=lambda o: sum(v.co.x for v in o.data.vertices) / len(o.data.vertices))
manifest = {"generator": "Blender " + bpy.app.version_string,
            "source": "scripts/build-landscape.py", "license": "CC0-1.0",
            "reference": "assets/images/campus/campus_yanchi.jpg",
            "provenance": "Original procedural sculpture and Cycles PBR bakes; not photogrammetry.",
            "textureSize": 1024, "variants": []}
for i, rock in enumerate(parts):
    rock.name = f"Limestone_{i}_high"
    for v in rock.data.vertices:
        v.co.x -= i * 4.5
    rock.location = (0, 0, 0)
    low = rock.copy()
    low.data = rock.data.copy()
    scene.collection.objects.link(low)
    low.name = f"Limestone_{i}_low"
    bpy.context.view_layer.objects.active = low
    mod = low.modifiers.new("Mobile silhouette", "DECIMATE")
    mod.ratio = .16
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for obj in [rock, low]:
        obj["landscapeAsset"] = "original-layered-limestone"
        manifest["variants"].append({"name": obj.name,
                                    "triangles": sum(len(p.vertices) - 2 for p in obj.data.polygons)})

# The reference's upright pond-name stone is a distinctive silhouette. Its
# inscription is cut into the mesh, with red material on the recessed faces.
profile = [(-1.03, 0), (1.02, 0), (1.10, 1.18), (.96, 1.48),
           (1.14, 2.13), (.98, 3.52), (.63, 3.76), (-.28, 3.86),
           (-.97, 3.55), (-1.17, 2.74), (-1.08, 1.54), (-1.22, .84)]
n = len(profile)
verts = [(x, y, z) for y in [-.38, .38] for x, z in profile]
faces = [tuple(range(n-1, -1, -1)), tuple(range(n, n*2))]
faces += [(i, (i+1) % n, (i+1) % n+n, i+n) for i in range(n)]
mesh = bpy.data.meshes.new("Weathered pond name stone")
mesh.from_pydata(verts, [], faces)
bm = bmesh.new()
bm.from_mesh(mesh)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(mesh)
bm.free()
stele = bpy.data.objects.new("PondStele", mesh)
scene.collection.objects.link(stele)
stele.data.materials.append(baked)
bpy.ops.object.select_all(action="DESELECT")
stele.select_set(True)
bpy.context.view_layer.objects.active = stele
bevel = stele.modifiers.new("Weathered edges", "BEVEL")
bevel.width, bevel.segments = .075, 3
bpy.ops.object.modifier_apply(modifier=bevel.name)
uvs = stele.data.uv_layers.new(name="UVMap")
for face in stele.data.polygons:
    for loop_id in face.loop_indices:
        co = stele.data.vertices[stele.data.loops[loop_id].vertex_index].co
        uvs.data[loop_id].uv = (.02+(co.x+1.3)/2.6*.29, .03+co.z/4*.94)
red = bpy.data.materials.new("Recessed vermilion inscription")
red.use_nodes = True
red.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (.29, .012, .006, 1)
red.node_tree.nodes.get("Principled BSDF").inputs["Roughness"].default_value = .8
stele.data.materials.append(red)
font_path = Path("/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc")
if not font_path.is_file():
    raise RuntimeError("Install the OFL-licensed Noto Serif CJK font to regenerate the inscription")
font = bpy.data.fonts.load(str(font_path))
for char, height in [("砚", 2.50), ("池", 1.24)]:
    curve = bpy.data.curves.new("Engrave " + char, "FONT")
    curve.body, curve.font = char, font
    curve.size, curve.extrude, curve.resolution_u = 2.3, .12, 5
    curve.align_x, curve.align_y = "CENTER", "CENTER"
    cutter = bpy.data.objects.new("Inscription cutter", curve)
    scene.collection.objects.link(cutter)
    cutter.location = (0, -.33, height)
    cutter.rotation_euler.x = math.pi/2
    curve.materials.append(baked)
    curve.materials.append(red)
    for character in curve.body_format:
        character.material_index = 1
    bpy.ops.object.select_all(action="DESELECT")
    cutter.select_set(True)
    bpy.context.view_layer.objects.active = cutter
    bpy.ops.object.convert(target="MESH")
    cutter = bpy.context.object
    bpy.context.view_layer.objects.active = stele
    modifier = stele.modifiers.new("Carved " + char, "BOOLEAN")
    modifier.operation, modifier.solver, modifier.object = "DIFFERENCE", "EXACT", cutter
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
stele["landscapeAsset"] = "photo-informed-pond-inscription"
manifest["inscription"] = {"text": "砚池", "font": "Noto Serif CJK (SIL OFL 1.1)",
                           "method": "Boolean-cut mesh; typographic interpretation, not traced calligraphy"}
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(WORK / "haiz-limestone.blend"))
target = OUT / "campus-limestone.glb"
bpy.ops.export_scene.gltf(filepath=str(target), export_format="GLB",
                          export_yup=True, export_extras=True, export_cameras=False,
                          export_lights=False, export_animations=False)
manifest["bytes"] = target.stat().st_size
manifest["sha256"] = hashlib.sha256(target.read_bytes()).hexdigest()
(OUT / "campus-limestone.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(manifest, ensure_ascii=False), flush=True)
