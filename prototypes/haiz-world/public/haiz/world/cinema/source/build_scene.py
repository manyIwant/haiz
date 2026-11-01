"""Original HAIZ concept study room, metres. Blender 4.3.2.
blender -b -t 3 --python source/build_scene.py -- --quality preview
No downloaded textures/models. Deterministic seed; editable .blend retained.
"""
import bpy, math, random, os, sys, argparse
from mathutils import Vector
p=argparse.ArgumentParser(); p.add_argument('--quality',default='master',choices=['preview','master']); p.add_argument('--render',default=''); a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..')); random.seed(31)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for block in bpy.data.materials: bpy.data.materials.remove(block)
scene=bpy.context.scene
scene.render.engine='CYCLES' if os.environ.get('HAIZ_CYCLES') else 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x=1080;scene.render.resolution_y=1920;scene.render.resolution_percentage=33 if a.quality=='preview' else 100
scene.render.fps=30;scene.frame_start=1;scene.frame_end=108
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.world.color=(.16,.2,.22)
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.3
scene.render.image_settings.color_mode='RGB'
if scene.render.engine=='CYCLES':
 scene.cycles.samples=24 if a.quality=='master' else 8;scene.cycles.use_denoising=True
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.44,.58,.67,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45

def mat(name,color,rough=.6,noise=0,scale=9,wood=False,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 n=m.node_tree.nodes;l=m.node_tree.links;s=n.get('Principled BSDF');s.inputs['Base Color'].default_value=(*color,1);s.inputs['Roughness'].default_value=rough;s.inputs['Metallic'].default_value=metal
 if noise:
  tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=scale;tex.inputs['Detail'].default_value=3
  coord=n.new('ShaderNodeTexCoord');mapping=n.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(1,1,18) if wood else (1,1,1)
  l.new(coord.outputs['Generated'],mapping.inputs[0]);l.new(mapping.outputs[0],tex.inputs['Vector'])
  ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.18;ramp.color_ramp.elements[1].position=.8
  ramp.color_ramp.elements[0].color=(*(c*.7 for c in color),1);ramp.color_ramp.elements[1].color=(*(min(c*1.18,1) for c in color),1)
  l.new(tex.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs[0],s.inputs['Base Color'])
  bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=noise;bump.inputs['Distance'].default_value=.018;l.new(tex.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs[0],s.inputs['Normal'])
 return m
plaster=mat('Warm lime plaster · fine mineral grain',(.63,.60,.50),.88,.15,65)
oak=mat('Oiled oak · directional grain',(.26,.115,.047),.42,.12,6,True)
lightoak=mat('Desk oak · end grain',(.39,.23,.108),.4,.1,7,True)
stone=mat('Limestone · cut slabs',(.39,.4,.33),.76,.12,70)
metal=mat('Patinated brass',(.3,.22,.095),.29,metal=.7)
forest=mat('Painted timber · forest',(.054,.12,.102),.5,.04,60)
paper=mat('Book pages · ivory',(.82,.77,.63),.92,.08,95)
linen=mat('Woven linen',(.47,.44,.32),.92,.2,100)
black=mat('Pencil graphite',(.025,.033,.03),.5)
green=mat('Leaves',(.12,.24,.10),.7)
white=mat('Ceramic cream',(.75,.73,.62),.23)

def box(name,loc,dim,material,bevel=.012):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=dim;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 if bevel:
  b=o.modifiers.new('Crafted edge bevel','BEVEL');b.width=bevel;b.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o

def cyl(name,loc,r,depth,material,vertices=32):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc);o=bpy.context.object;o.name=name;o.data.materials.append(material);b=o.modifiers.new('Soft machined edge','BEVEL');b.width=.006;b.segments=3;o.modifiers.new('Normals','WEIGHTED_NORMAL');return o

def area(name,loc,target,power,color,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o
# Shell and slab joints. Ceiling is high enough for real walk-through scale.
box('Left lime wall',(-2.32,.1,1.8),(.24,15.8,3.6),plaster)
box('Ceiling', (0,.1,3.68),(4.88,15.8,.16),plaster)
for y in range(-8,8):
 for x in range(-2,2):
  box('Limestone floor joint', (x+.5,y+.5,-.045),(.992,.992,.09),stone,.005)
# Structural portals with visible depth and reveals, not flat drawn outlines.
for y in [-5.5,-2.5,.5,3.5]:
 for x in [-2.08,2.08]: box('Oak portal post',(x,y,1.8),(.18,.28,3.6),oak,.016)
 box('Oak lintel',(0,y,3.38),(4.3,.28,.23),oak,.018)
 # refined inner brass reveal
 for x in [-1.975,1.975]: box('Portal inlay',(x,y-.148,1.78),(.012,.008,3.3),metal,.001)
# Window wall: stone sill, timber mullions, upper clerestory rail.
box('Window base wall',(2.31,.0,.38),(.22,15.8,.76),plaster)
box('Window sill',(2.17,.0,.82),(.44,15.8,.09),stone,.02)
for y in [-7.7,-5.5,-3.3,-1.1,1.1,3.3,5.5,7.7]:
 box('Window upright',(2.25,y,2.06),(.12,.065,2.45),forest,.008)
for z in [.93,2.75,3.3]: box('Window crossbar',(2.25,0,z),(.12,15.6,.055),forest,.007)
# End wall is a window above a low masonry ledge.
box('Rear wall below window',(0,7.85,.45),(4.6,.2,.9),plaster)
box('Rear oak sill',(0,7.72,.96),(4.5,.36,.09),lightoak)
for x in [-2.17,-1.08,0,1.08,2.17]: box('Rear window mullion',(x,7.8,2.14),(.065,.14,2.48),forest,.007)
for z in [1,2.68,3.35]: box('Rear window frame',(0,7.8,z),(4.44,.14,.065),forest,.007)
# Exterior lawn and layered architecture/foliage create actual parallax.
box('Courtyard earth',(7,3,-.15),(12,30,.1),mat('Garden',(.16,.22,.13),.95,.25,15))
for i in range(16):
 x=random.uniform(4.1,9);y=random.uniform(-9,14);h=random.uniform(3.6,5.5)
 cyl('Garden trunk',(x,y,h*.45),.075,h*.9,oak,12)
 for j in range(3):
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=random.uniform(.7,1.35),location=(x+random.uniform(-.6,.6),y+random.uniform(-.4,.4),h+j*.25));o=bpy.context.object;o.name='Garden canopy';o.data.materials.append(green)
box('Distant courtyard wall',(10.5,4,1.1),(.2,32,2.2),plaster)
# Bookshelves built into left wall: varied book spines and page blocks.
bookmats=[mat('Cloth book '+str(i),c,.85,.08,60) for i,c in enumerate([(.13,.22,.19),(.37,.2,.12),(.42,.4,.3),(.17,.24,.29),(.65,.53,.34)])]
for cy in [-.4,3,6.3]:
 for sy in [cy-1.3,cy+1.3]:box('Shelf side',(-2.02,sy,1.6),(.38,.055,2.8),oak)
 for z in [.2,.82,1.44,2.06,2.68]:
  box('Oak shelf',(-2.02,cy,z),(.42,2.65,.045),oak,.008)
  for j in range(18):
   w=random.uniform(.055,.1);h=random.uniform(.25,.45);yy=cy-1.2+j*.13
   o=box('Book spine',(-1.93,yy,z+.025+h/2),(.24,w,h),random.choice(bookmats),.003)
   if j%3==0:box('Spine gilding',(-1.805,yy,z+h*.72),(.006,w*.8,.008),metal,.001)
# Destination table has 30mm top, frame, angled upholstered chair, objects.
box('Writing table top',(.3,6.15,.76),(2.2,1.05,.055),lightoak,.025)
for x in [-.65,1.25]:
 for y in [5.78,6.53]:box('Desk leg',(x,y,.36),(.065,.065,.72),oak)
box('Desk apron',(.3,5.8,.65),(2,.045,.13),oak)
box('Desk drawer face',(.3,5.77,.65),(.65,.025,.1),lightoak)
cyl('Drawer brass knob',(.3,5.741,.66),.016,.018,metal).rotation_euler[0]=math.pi/2
box('Linen chair seat',(.3,5.05,.47),(.56,.54,.09),linen,.055)
box('Chair back',(.3,4.82,.78),(.58,.07,.44),oak,.04)
for x in [.08,.52]:
 for y in [4.86,5.25]:box('Chair leg',(x,y,.23),(.045,.045,.46),oak)
# Open notebook: individual paper layers, central gutter and handwritten rule lines.
for x,ang in [(.12,.035),(.48,-.035)]:
 o=box('Open notebook pages',(x,6.0,.806),(.35,.45,.018),paper,.004);o.rotation_euler[1]=ang
for i in range(10):box('Notebook ruled line',(.48,5.82+i*.035,.818),(.29,.001,.001),mat('Ink '+str(i),(.23,.29,.28),.9),0)
pen=cyl('Graphite pencil',(.9,5.99,.825),.006,.26,black,8);pen.rotation_euler=(0,math.pi/2,.22)
# Drinking cup with modeled hollow lip (not a solid cylinder).
cyl('Cup body',(-.45,6.33,.87),.057,.14,white)
bpy.ops.mesh.primitive_torus_add(major_radius=.052,minor_radius=.006,major_segments=40,minor_segments=10,location=(-.45,6.33,.946));bpy.context.object.data.materials.append(white)
cyl('Tea surface',(-.45,6.33,.94),.048,.002,mat('Tea',(.12,.065,.025),.18))
bpy.ops.mesh.primitive_torus_add(major_radius=.035,minor_radius=.009,location=(-.38,6.33,.88),rotation=(math.pi/2,0,0));bpy.context.object.data.materials.append(white)
# Desk task light and warm bounce.
cyl('Lamp base',(.97,6.4,.81),.12,.025,metal)
cyl('Lamp stem',(.97,6.4,1.07),.012,.5,metal)
bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=.18,radius2=.085,depth=.15,location=(.97,6.4,1.34));bpy.context.object.name='Spun brass reading shade';bpy.context.object.data.materials.append(metal)
area('Reading lamp',(.97,6.4,1.25),(.7,6,.76),22,(1,.65,.34),.16)
# Warm ceiling fixtures and calibrated window lights.
for y in [-4,0,4]:
 cyl('Pendant cord',(0,y,3.34),.008,.5,black)
 cyl('Pendant brass shade',(0,y,3.06),.19,.065,metal)
 area('Pendant pool',(0,y,3.0),(0,y,0),60,(1,.78,.52),.35)
area('Long garden window',(4,2,3),(0,2,1),1450,(1,.87,.66),7)
area('End window softbox',(0,9,3),(.3,5.7,1),600,(.75,.86,1),4)
sun=bpy.data.lights.new('Late afternoon sun','SUN');sun.energy=2.2;sun.angle=.08;sun.color=(1,.83,.58);so=bpy.data.objects.new('Late afternoon sun',sun);scene.collection.objects.link(so);so.rotation_euler=(math.radians(38),math.radians(-30),math.radians(-62))
# A single continuous dolly, no disconnected still-image crossfade.
bpy.ops.object.camera_add();camera=bpy.context.object;camera.name='HAIZ continuous dolly';scene.camera=camera;camera.data.lens=24;camera.data.sensor_width=36;camera.data.clip_start=.08;camera.data.clip_end=120
camera.data.dof.use_dof=True;camera.data.dof.aperture_fstop=7.1
for frame in range(1,109):
 t=(frame-1)/107;ease=t*t*(3-2*t)
 y=-6.8+11.05*ease;x=-.24+.44*ease;z=1.58-.12*ease
 camera.location=(x,y,z);target=Vector((.35,6.28,1.23));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.dof.focus_distance=(target-camera.location).length
 camera.keyframe_insert(data_path='location',frame=frame);camera.keyframe_insert(data_path='rotation_euler',frame=frame);camera.data.keyframe_insert(data_path='dof.focus_distance',frame=frame)
for obj in [camera,camera.data]:
 if obj.animation_data:
  for fc in obj.animation_data.action.fcurves:
   for key in fc.keyframe_points:key.interpolation='LINEAR'
scene['source']='Original HAIZ concept space; not a reconstruction of Hainan Middle School'
scene['units']='metres';scene.unit_settings.system='METRIC'
scene.frame_set(108);scene.render.filepath=os.path.join(ROOT,'media','frame-')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'source','HAIZ-concept-study.blend'),compress=True)
if a.render:
 for f in map(int,a.render.split(',')):
  scene.frame_set(f);scene.render.filepath=os.path.join(ROOT,'media',f'key-{f:03}.png');bpy.ops.render.render(write_still=True)
