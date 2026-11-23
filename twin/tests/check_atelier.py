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
# Compare independently read roof corners with the decoded geometry in the photo crop.
ref=json.loads((ROOT/'evidence/calibration/yihao_oblique_study.json').read_text())
eye=Vector(ref['eye']);forward=Vector(ref['forward']);up=Vector(ref['up'])
def oblique_pixel(xyz):
    q=Vector(xyz)-eye
    return Vector((ref['cx']+ref['focal_px']*q.dot(forward.cross(up))/q.dot(forward),
                   ref['cy']-ref['focal_px']*q.dot(up)/q.dot(forward)))
roof=bpy.data.objects['yihao.roof_central']
verts=[roof.matrix_world@v.co for v in roof.data.vertices]
for sample in ref['roof_check']['samples']:
    target=Vector(sample['observed_px']);approx=Vector(sample['reference_vertex'])
    actual=min(verts,key=lambda v:(v-approx).length_squared)
    assert (actual-approx).length<0.025
    before=(oblique_pixel(sample['previous_xyz'])-target).length
    after=(oblique_pixel(actual)-target).length
    assert after<10 and after<before
    print('Oblique roof',sample['part'],round(before,2),'->',round(after,2),'px')
arts=bpy.data.objects['arts']
assert (arts.matrix_world.translation-Vector((25.6,-170.3,0.15))).length<0.02
raw=(assets/'arts.glb').read_bytes()
doc=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
root=next(n for n in doc['nodes'] if n.get('name')=='arts')
assert root['extras']['photoPlanting']['palms']==5
assert root['extras']['photoPlanting']['shrubs']==48
assert len(doc['images'])>=16
# Reloaded roof geometry, including the inside return at every change of direction.
trace=json.loads((ROOT/'evidence/calibration/arts_roofs.json').read_text())
deps=bpy.context.evaluated_depsgraph_get()
for spec in trace['wings']:
    name='arts.building.roof_'+spec['id']
    ob=bpy.data.objects[name]
    assert len(ob.data.polygons)>500
    for a,b in zip(spec['ridge_px'],spec['ridge_px'][1:]):
        h=spec['eave']
        x=((a[0]+b[0])/2-159)/4.536-.335*h
        y=-150+(286-(a[1]+b[1])/2)/4.536+.53*h
        hit,where,_,_,obj,_=bpy.context.scene.ray_cast(deps,Vector((x,y,30)),Vector((0,0,-1)))
        assert hit and obj.name==name and abs(where.z-h-spec['rise'])<.22,(name,obj,where)
    for material in ob.data.materials:
        if material.name.startswith('arts.ceramic.'):
            r,g,b,_=material.diffuse_color
            assert r>4*g and g>b
porch=trace['entrance']
hit,where,_,_,obj,_=bpy.context.scene.ray_cast(deps,
    Vector((porch['center_x'],porch['front_y']+6.45,22)),Vector((0,0,-1)))
assert hit and obj.name=='arts.building.portico_tiles' and 7.8<where.z<9.8,(obj,where)

pond=next(w for w in json.loads((ROOT/'data/campus.json').read_text())['water'] if w['name']=='砚池')
boundary=[Vector(p) for p in pond['poly']]
palms=[o for o in bpy.context.scene.objects if o.get('botanicalPalm')]
assert len(palms)==5
for palm in palms:
    pt=palm.matrix_world.translation
    crossings=sum((a.y>pt.y)!=(b.y>pt.y) and pt.x<(b.x-a.x)*(pt.y-a.y)/(b.y-a.y)+a.x
                  for a,b in zip(boundary,boundary[1:]))
    assert crossings%2==0,pt
print('Arts Center: four red roof chains, portico, crest elevations and five dry-land palm roots verified.')

# All probes run on the decoded GLB in the shared campus, including adjoining buildings.
def top_at(x,y):
    hit,point,_,_,obj,_=bpy.context.scene.ray_cast(deps,Vector((x,y,4.2)),Vector((0,0,-1)),distance=6)
    assert hit,(x,y)
    return obj.name,point.z

basin,upper_z=top_at(42.8,-120.8)
open_water,lower_z=top_at(50.75,-119.6)
assert basin=='yanchi.spillway' and open_water=='yanchi.water',(basin,open_water)
assert .54<upper_z-lower_z<.68,(upper_z,lower_z)
for y in (-119,-122.9):
    steps=[top_at(61.86+i*.43,y) for i in range(4)]
    assert all(name=='yanchi.basin_and_walks' for name,z in steps),steps
    assert all(.134<hi[1]-lo[1]<.148 for lo,hi in zip(steps,steps[1:])),steps
stele=bpy.data.objects['yanchi.inscribed_stone']
lo,hi=bounds(stele)
assert 2.96<hi[2]-lo[2]<3.30 and lo[0]>38 and hi[0]<42
assert any('vermilion' in mat.name.lower() for mat in stele.data.materials)
water=bpy.data.objects['yanchi.water']
z=[v.co.z for v in water.data.vertices]
assert max(z)-min(z)>.039 and len(z)>15000
assert all(bpy.data.objects.get('yanchi.'+s) for s in ['fall_and_contact','shelf.00','garden_walk','coconut_bank','bank_foliage'])
print('Pond replacement verified: real water relief, carved marker, four bank steps and %.2f m spill.'%(upper_z-lower_z))


# Compare actual stroke hits to photographed positive and negative space.
# Sampling includes the counters and small signature marks on all three panels.
contours=json.loads((ROOT/'evidence/calibration/stone_lettering.json').read_text())['panels']
camera=json.loads((ROOT/'evidence/calibration/jiaoxuelou-1600.report.json').read_text())['camera']
eye=Vector((camera['x'],camera['y'],camera['z']))
right,up,forward=[Vector(camera['basis'][k]) for k in ('right','up','forward')]
cx,cy=camera['principal_point']
plaque=bpy.data.objects['site.taihu.inscription']
def contains(ring,u,v):
    return sum((a[1]>v)!=(b[1]>v) and u<(b[0]-a[0])*(v-a[1])/(b[1]-a[1])+a[0]
               for a,b in zip(ring,ring[1:]+ring[:1]))%2==1
for key,rect,stride in [('taihu',(394,924,620,969),2),('donor',(969,982,1050,1005),1),('pond',(235,185,380,633),4)]:
    shapes=[(min(p[0] for p in q[0]),max(p[0] for p in q[0]),min(p[1] for p in q[0]),max(p[1] for p in q[0]),q)
            for q in contours[key]['outlines_px']]
    union=matched=0
    for v in range(rect[1],rect[3],stride):
        for u in range(rect[0],rect[2],stride):
            px=u+.31;py=v+.47
            inside=any(contains(q[0],px,py) and not any(contains(h,px,py) for h in q[1:])
                       for l,r,t,b,q in shapes if l<=px<=r and t<=py<=b)
            if key=='pond':
                x=(px-302)*.00875+.00023*(py-400);z=3.57-(py-188)*.00598
                origin=Vector((x+.038*z+.035*math.sin(3.6*z+x),-1.5,z+.022*math.sin(5.5*x+.75*z)*min(z,1)))
                ob=stele; direction=Vector((0,1,0));pigment='inscription.vermilion'
            else:
                ob=plaque;origin=eye
                direction=forward+right*((px-cx)/camera['f_px'])+up*((cy-py)/camera['f_px'])
                pigment='inscription.mineral'
            hit,point,_,idx=ob.ray_cast(origin,direction.normalized())
            painted=hit and ob.data.materials[ob.data.polygons[idx].material_index].name.startswith(pigment)
            matched+=bool(inside and painted);union+=bool(inside or painted)
    score=matched/union
    print(key,'stroke-mask agreement on reloaded mesh:',round(score,3))
    assert score>.89,(key,score)
