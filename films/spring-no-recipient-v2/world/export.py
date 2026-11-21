"""Export assets/world.blend -> assets/world.glb (geometry, two UV sets, material names only).

Textures and lightmaps are attached in Three.js by material / object name, so no images are
embedded. glTF is Y-up: Blender (x, y, z) becomes (x, z, -y).
"""
import pathlib
import bpy
ROOT = pathlib.Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT / "assets" / "world.blend"))
for o in list(bpy.data.objects):
    if o.type != "MESH":
        bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT / "assets" / "world.glb"), export_format="GLB",
                          export_texcoords=True, export_normals=True, export_materials="EXPORT",
                          export_image_format="NONE", export_yup=True, export_apply=False)
print("exported")
