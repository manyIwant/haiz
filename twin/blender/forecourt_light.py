"""Two low-sun material studies using the saved atelier blend and the same geometry.
blender -b twin/scratch/HAIZ-Forecourt.blend --python twin/blender/forecourt_light.py
"""
import math
import sys
from pathlib import Path

import bpy
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import build

requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
sc=bpy.context.scene
for ob in list(sc.objects):
    if ob.type=='LIGHT' and ob.data.type=='SUN':
        bpy.data.objects.remove(ob,do_unlink=True)
build.sun_and_sky(sc,'2026-10-10T17:08',strength=3.8)
sun=next(ob.data for ob in sc.objects if ob.type=='LIGHT' and ob.data.type=='SUN')
sun.color=(1.0,0.80,0.60)
sun.angle=math.radians(1.1)
sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value=0.17
build.setup_render(sc,40,(1600,1000))
sc.cycles.max_bounces=5
sc.render.image_settings.quality=94
out=HERE.parent/'renders/atelier'
for name,eye,look,lens in [
    ('stone_evening',(-5.4,40.9,1.42),(-0.1,28.5,2.04),44),
    ('tree_evening',(50.6,25.7,1.53),(42.0,17.2,3.18),29),
]:
    if requested and name not in requested:
        continue
    sc.camera=build.add_camera(sc,name,eye,look,lens)
    sc.render.filepath=str(out/(name+'.jpg'))
    bpy.ops.render.render(write_still=True)

# Same architecture under lower summer sun, when light reaches the north-facing court.
for ob in list(sc.objects):
    if ob.type=='LIGHT' and ob.data.type=='SUN':
        bpy.data.objects.remove(ob,do_unlink=True)
build.sun_and_sky(sc,'2026-06-18T07:12',strength=3.55)
sun=next(ob.data for ob in sc.objects if ob.type=='LIGHT' and ob.data.type=='SUN')
sun.color=(1.0,0.85,0.68)
sun.angle=math.radians(1.0)
sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value=0.21
for name,eye,look,lens in [
    ('court_morning',(-8,-23,2.15),(-19.5,-42,6.15),27),
    ('arts_morning',(40,-105,8.5),(20.8,-130,3.7),37),
    ('south_morning',(-59,-133,2.65),(-35,-143,5.7),27),
]:
    if requested and name not in requested:
        continue
    sc.camera=build.add_camera(sc,name,eye,look,lens)
    sc.render.filepath=str(out/(name+'.jpg'))
    bpy.ops.render.render(write_still=True)

# The late-afternoon master puts the west bank in the arts centre's shadow.
# Compare the same surfaces in tropical morning sun from across the water.
if not requested or 'pond_daylight' in requested:
    for ob in list(sc.objects):
        if ob.type=='LIGHT' and ob.data.type=='SUN':
            bpy.data.objects.remove(ob,do_unlink=True)
    build.sun_and_sky(sc,'2026-05-22T09:45',strength=3.6)
    sun=next(ob.data for ob in sc.objects if ob.type=='LIGHT' and ob.data.type=='SUN')
    sun.color=(1,.947,.844)
    sun.angle=math.radians(.86)
    sc.camera=build.add_camera(sc,'pond_daylight',(53.8,-130.45,1.86),(41.65,-121.95,1.25),34)
    sc.render.filepath=str(out/'pond_daylight.jpg')
    bpy.ops.render.render(write_still=True)
