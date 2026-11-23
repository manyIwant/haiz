"""Decode the atelier GLBs with Blender and verify evidence, placement and materials.
Run with blender -b --python-exit-code 1 --python twin/tests/check_atelier.py.
"""
from pathlib import Path
import json
import math
import struct
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
assets = ROOT/'assets/atelier'
manifest = json.loads((assets/'manifest.json').read_text())
site = json.loads((ROOT/'data/site.json').read_text())
P = site['taihu']
bpy.ops.wm.read_factory_settings(use_empty=True)


def bounds(ob):
    pts = [ob.matrix_world @ Vector(p) for p in ob.bound_box]
    return [[fn(v[i] for v in pts) for i in range(3)] for fn in (min,max)]


for name, entry in manifest['parts'].items():
    path = assets/entry['file']
    raw = path.read_bytes()
    assert struct.unpack_from('<4sII',raw) == (b'glTF',2,len(raw)),path
    j = json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
    assert all('bufferView' in image for image in j.get('images',[])),path
    for node in j['nodes']:
        if 'mesh' in node:
            tags = node.get('extras',{})
            assert tags.get('haiz_basis') and tags.get('haiz_tag'),node['name']
    assert bpy.ops.import_scene.gltf(filepath=str(path)) == {'FINISHED'},path
    print(name, len(j['nodes']), 'nodes;', len(j['meshes']), 'meshes decoded;', len(j.get('images',[])), 'packed images')
all_meshes = [o for o in bpy.context.scene.objects if o.type=='MESH']
assert all(len(o.data.polygons) and all(math.isfinite(n) for p in o.bound_box for n in p) for o in all_meshes)
stone = bpy.data.objects['site.taihu.rock']
base = bpy.data.objects['site.taihu.plinth']
lo,hi = bounds(stone)
a,b,c,d = P['plinth']
assert a-0.55 < lo[0] < a+0.65 and c-0.65 < hi[0] < c+0.55
assert b < lo[1] < hi[1] < d and 0.64<lo[2]<0.78 and 3.2<hi[2]<4.5
blo,bhi = bounds(base)
assert max(abs(x-y) for x,y in zip([blo[0],blo[1],bhi[0],bhi[1]],[a,b,c,d])) < 0.04
assert bpy.data.objects.get('site.taihu.inscription') and bpy.data.objects.get('site.taihu.turf')
def has_mineral_color(ob):
    # glTF multiplies the PBR base colour by COLOR_0. A white first layer and a
    # coloured COLOR_1 can appear valid on a Blender import and white in WebGL.
    layer=ob.data.color_attributes[0]
    samples=[layer.data[i].color[:3] for i in range(0,len(layer.data),max(1,len(layer.data)//240))]
    return min(min(c) for c in samples)<0.25 and max(max(c)-min(c) for c in samples)>0.035
assert has_mineral_color(stone)
assert (bpy.data.objects['yihao'].matrix_world.translation - Vector(site['placements']['yihao']['xyz'])).length < 0.01
assert any('track' in ob.name for ob in all_meshes)
assert all(item['iou']>0.80 for item in manifest['silhouette_overlap'])
print('Decoded in Blender metres; stone:',lo,hi,'plinth:',blo,bhi,'silhouettes:',manifest['silhouette_overlap'])
erhao = bpy.data.objects['erhao']
assert abs(erhao.matrix_world.translation.z-site['placements']['yihao']['xyz'][2]) < 0.01
roof_min, roof_max = bounds(bpy.data.objects['erhao.roof'])
assert -44.0 < roof_min[0] < -42.0 and 50 < roof_max[0] < 51
assert -58 < roof_min[1] < -56 and -44 < roof_max[1] < -43
assert bpy.data.objects['erhao.rear_gallery']['haiz_tag']=='invented'
print('Block 2 mapped footprint in twin metres:',roof_min,roof_max)
L = json.loads((ROOT/'data/trees.json').read_text())['lanren']
trunk = bpy.data.objects['lanren.scaffold']
support = bpy.data.objects['lanren.supportstone.0']
tlo,thi = bounds(trunk)
sx,sy = L['boulders'][0]['xy']
rlo,rhi = bounds(support)
assert has_mineral_color(support)
assert rlo[0]<sx<rhi[0] and rlo[1]<sy<rhi[1]
assert abs(rhi[2]-(L['boulders'][0]['z']+L['boulders'][0]['size'][2]))<0.04
from mathutils.bvhtree import BVHTree
graph=bpy.context.evaluated_depsgraph_get()
# Both meshes are authored in twin world space (identity transform).
assert all((ob.matrix_world.translation.length<0.0001) for ob in (trunk,support))
wood=BVHTree.FromObject(trunk,graph)
contact=min(wood.find_nearest(v.co)[3] for v in support.data.vertices if v.co.z>rhi[2]-0.25)
assert contact<0.08, f'low limb misses its support by {contact:.3f} m'
assert bpy.data.objects['lanren.terminalia.leaves'].data.uv_layers
print(f'Tall support to low branch mesh distance {contact:.4f} m; foliage and root bed decoded.')

# Decode the teaching blocks in the shared frame and test interfaces after export.
from mathutils.bvhtree import BVHTree
spec=json.loads((ROOT/'data/buildings/yihao.json').read_text())
for key in ('science','south_classrooms'):
    assert bpy.data.objects.get(key)
    name='mapped_roof' if key=='science' else 'mapped_plates'
    roof=bpy.data.objects[key+'.'+name]
    low,high=bounds(roof)
    record='w1165596687@1' if key=='science' else 'w1165596688@1'
    mapped=next(b['poly'] for b in json.loads((ROOT/'data/campus.json').read_text())['buildings'] if b['record']==record)
    assert all(abs(actual-fn(p[axis] for p in mapped))<0.7
               for fn,corner in ((min,low),(max,high)) for axis,actual in enumerate(corner[:2]))
    print(key,'mapped XY bounds and roof verified',low,high)
for suffix,cx in zip(('w','e'),spec['links']['x_centres']):
    wing=bpy.data.objects['yihao.wing_'+suffix+'_rear']
    surface=BVHTree.FromObject(wing,graph)
    # Probe from the court into the wing. A hit at y=-10.6 would close off a bridge.
    for z in (1.4,5.4,8.79,12.18,15.57):
        hit=surface.ray_cast(Vector((cx,-12,z)),Vector((0,1,0)),5)
        assert hit[0] is not None and hit[0].y>-8.3, (wing.name,z,hit)
hall=bpy.data.objects['yihao.hall_finishes']
assert hall['haiz_tag']=='photo-derived/estimated'
for name in ('erhao.undercroft','erhao.courtyard_garden','science.shaded_landings',
             'south_classrooms.gallery_edges','yanchi.water'):
    assert bpy.data.objects[name].data.polygons
print('Two bridge alignments checked on five levels each; court and southern teaching assets decoded.')
# This slender return used to show the dark interior box of a perpendicular window.
hit,point,normal,index,obj,_=bpy.context.scene.ray_cast(graph,Vector((-36.12,-129.23,5.80)),Vector((1,0,0)),distance=0.80)
assert hit and obj.name=='south_classrooms.rooms', (point,obj)
assert obj.data.materials[obj.data.polygons[index].material_index].name.startswith('atelier.south.terracotta')
assert bpy.data.objects['south_classrooms.court_bridges']['haiz_tag']=='public-map/invented'
print('Southern return is clear of protruding window backs; both open links are present.')
