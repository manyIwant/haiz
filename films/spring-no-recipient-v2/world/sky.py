"""Render the Cycles sky of each lighting state to an equirectangular HDR panorama, so the
Three.js background and reflections use exactly the sky that lit the bakes.

    /home/user/bpyenv/bin/python world/sky.py dusk,morning,dawn,night  -> assets/sky_<state>.hdr
Image centre = east, right = south (matches three.js equirect mapping).
"""
import math, pathlib, sys
import bpy
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "world"))
import lighting
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 16
sc.render.resolution_x, sc.render.resolution_y = 2048, 1024
sc.view_settings.view_transform = "Standard"
cd = bpy.data.cameras.new("pano"); cd.type = "PANO"; cd.panorama_type = "EQUIRECTANGULAR"
cam = bpy.data.objects.new("pano", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.rotation_euler = (math.pi / 2, 0, -math.pi / 2)   # look +X (east), up +Z
sc.render.image_settings.file_format = "HDR"
for st in sys.argv[1].split(","):
    lighting.setup_blender(st, bpy)
    sc.render.filepath = str(ROOT / "assets" / f"sky_{st}.hdr")
    bpy.ops.render.render(write_still=True)
    print("sky", st)
lighting.export_json(ROOT / "assets" / "lighting.json")
