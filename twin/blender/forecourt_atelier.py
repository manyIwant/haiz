"""Build the independent forecourt edition with Blender 5.x.
blender -b --python-exit-code 1 --python twin/blender/forecourt_atelier.py -- [--draft] [--blend path]
Set HAIZ_TWIN_PY to a compatible site-packages if dependencies are outside Blender.
"""
import argparse
import json
import math
import os
from pathlib import Path
import random
import sys
import tempfile

HERE = Path(__file__).resolve().parent
TWIN = HERE.parent
sys.path[:0] = [str(HERE),str(TWIN/'tools')]
if os.getenv('HAIZ_TWIN_PY'):
    sys.path.append(os.environ['HAIZ_TWIN_PY'])
import bpy
from mathutils import Matrix, Vector
import numpy as np
import build
import b_yihao
import kit
from atelier_materials import apply_maps, build_maps, lithology
from atelier_tree import tree
from atelier_erhao import build_block
from atelier_planting import hedges
from atelier_windows import dress
import taihu_relief

P = build.SITE['taihu']
OUT = TWIN/'assets/atelier'
RENDERS = TWIN/'renders/atelier'
VIEWS = {
    'avenue': ((12.3,49.8,2.15), (0.2,13.3,6.7), 35),
    'fork': ((44.4,22.5,2.25),(39.4,17.8,3.15),37),
    'crown': ((67,49,7.8),(41.5,15.8,7.4),39),
    'quadrangle': ((-13.3,-17.6,2.05),(12.2,-44,8.2),27),
    'piedmont': ((7.1,36.8,2.4), (-0.2,28.6,1.85), 36),
    'limestone': ((-3.9,32.5,2.25), (-1.75,28.85,2.14), 62),
    'reverse': ((-9.0,20.0,4.4),(-0.2,28.8,1.8),44),
    'colonnade': ((31.5,12.0,2.0),(12.4,0,6.4),29),
    'portal_detail': ((6.6,17.7,2.25),(0.0,4.0,7.4),36),
}


def move(ob, coll):
    for current in list(ob.users_collection):
        current.objects.unlink(ob)
    coll.objects.link(ob)


def tag(ob, confidence, basis):
    ob['haiz_tag'] = confidence
    ob['haiz_basis'] = basis
    return ob


def fieldstone(coll, cache=None):
    if cache and cache.exists():
        data = np.load(cache)
        pts, tri, overlap = data['pts'],data['tri'],json.loads(str(data['overlap']))
    else:
        pts,tri,overlap = taihu_relief.surface()
        if cache:
            np.savez(cache,pts=pts,tri=tri,overlap=json.dumps(overlap))
    # Shared vertices across bedding, arches and seams. Smooth normals on the continuous field.
    mesh = bpy.data.meshes.new('虎踞龍盤 · 溶蚀石灰岩')
    mesh.from_pydata(pts.tolist(),[],tri.tolist())
    mesh.update()
    mesh.polygons.foreach_set('use_smooth', np.ones(len(tri),dtype=bool))
    # Box project per triangle; grain uses metre UVs and the mineral colour field is continuous in 3D.
    axes = np.argmax(np.abs(np.cross(pts[tri[:,1]]-pts[tri[:,0]],pts[tri[:,2]]-pts[tri[:,0]])),axis=1)
    uv = np.empty((len(tri),3,2),'f')
    for axis,(h,v) in enumerate(((1,2),(0,2),(0,1))):
        uv[axes==axis] = pts[tri[axes==axis]][:,:,[h,v]]
    mesh.uv_layers.new(name='metric').data.foreach_set('uv',uv.ravel())
    rgb = lithology(pts)
    attr = mesh.color_attributes.new('Lithology','BYTE_COLOR','POINT')
    attr.data.foreach_set('color_srgb',np.column_stack([rgb,np.ones(len(rgb))]).astype('f').ravel())
    mesh.color_attributes.active_color = attr
    mesh.materials.append(kit.get_material('atelier.karst'))
    ob = bpy.data.objects.new('site.taihu.rock',mesh)
    coll.objects.link(ob)
    tag(ob,'photo-derived/estimated','Two inherited outer contours and eleven individually traced undercuts. Depths, rear morphology, mineral distribution and strata inferred.')
    return overlap


def plinth(coll):
    x0,y0,x1,y1 = P['plinth']
    top = P['plinth_top']
    g = kit.Geo()
    g.box('stone.granite.dark',(x0,y0,0),(x1,y1,top-0.10))
    # Overhanging coping, drip recess, mitred perimeter and slightly inset planting bed.
    for inset,z,thickness in ((0.005,top-0.105,0.032),(-0.015,top-0.073,0.070)):
        a,b,c,d = x0+inset,y0+inset,x1-inset,y1-inset
        width = 0.15
        for xa,ya,xb,yb in ((a,b,c,b+width),(a,d-width,c,d),(a,b+width,a+width,d-width),(c-width,b+width,c,d-width)):
            g.box('atelier.coping',(xa,ya,z),(xb,yb,z+thickness))
    g.box('ground.lawn',(x0+0.15,y0+0.15,top-0.11),(x1-0.15,y1-0.15,top-0.043))
    for key in ('panel','panel2'):
        a,b,z0,z1 = P[key]
        g.box('atelier.coping',(a,y1,z0),(b,y1+0.023,z1))
    ob = g.to_object('site.taihu.plinth',coll)
    tag(ob,'photo-derived/estimated',P['basis']+' Coping and joints interpreted from jiaoxuelou.')
    return ob


def turf(coll):
    rng = random.Random(1923)
    x0,y0,x1,y1 = P['plinth']
    verts, faces, indices = [],[],[]
    matnames = ['atelier.grass.olive','atelier.grass.fresh','atelier.grass.shade']
    for name,col in zip(matnames,[(0.39,0.44,0.18),(0.40,0.52,0.22),(0.25,0.32,0.13)]):
        kit.MATERIALS[name] = (col,0.86,0.0,{})
    for _ in range(9300):
        x,y = rng.uniform(x0+0.16,x1-0.16),rng.uniform(y0+0.16,y1-0.16)
        scale = rng.uniform(0.75,1.25)
        for _ in range(4):
            a = rng.random()*math.tau
            c,s = math.cos(a),math.sin(a)
            w,h = rng.uniform(0.005,0.011),rng.uniform(0.035,0.085)*scale
            xg,yg = x+rng.uniform(-0.03,0.03),y+rng.uniform(-0.03,0.03)
            z = P['plinth_top']-0.044
            k = len(verts)
            verts.extend([(xg-w*c,yg-w*s,z),(xg+w*c,yg+w*s,z),
                          (xg+0.48*h*s,yg-0.48*h*c,z+h)])
            faces.append((k,k+1,k+2))
            indices.append(rng.randrange(3))
    mesh = bpy.data.meshes.new('Turf tufts')
    mesh.from_pydata(verts,[],faces)
    for name in matnames:
        mesh.materials.append(kit.get_material(name))
    mesh.polygons.foreach_set('material_index',indices)
    ob = bpy.data.objects.new('site.taihu.turf',mesh)
    coll.objects.link(ob)
    tag(ob,'photo-derived/estimated','Short grass visible above the coping on both campus_taihushi and jiaoxuelou. Blade density and colour inferred.')


def school(coll):
    out = b_yihao.build(detailed_porch=True)
    dress(out,b_yihao)
    for text in out.texts:
        if text['text']=='1923':
            kit.MATERIALS['atelier.patinated.numerals'] = ((0.26,0.17,0.14),0.46,0.32,{})
            text.update(mat='atelier.patinated.numerals',size=0.95,extrude=0.025)
    pl = build.SITE['placements']['yihao']
    placement = Matrix.Translation(pl['xyz']) @ Matrix.Rotation(math.radians(pl['rot_deg']),4,'Z')
    build.instantiate('yihao',out,coll,placement)
    for ob in coll.objects:
        if ob.name == 'yihao.porch':
            ob['haiz_tag'] = 'photo-derived/estimated'
            ob['haiz_basis'] += ' Ridge length and fascia from campus_yihao and jiaoxuelou. Eave returns, soffit fixtures and tile courses interpreted.'
        if '.track' in ob.name:
            ob['haiz_basis'] += ' Sliding sashes, transoms, sill, track and interior folds interpreted from scenery_13 and campus_yihao; open states are illustrative.'


def export(coll):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in coll.all_objects:
        ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(coll.name+'.glb')),use_selection=True,export_format='GLB',
        export_extras=True,export_cameras=False,export_lights=False,export_gpu_instances=False,
        export_vertex_color='ACTIVE',export_yup=True,export_materials='EXPORT')


def camera_for(sc,key):
    existing=bpy.data.objects.get('cam.'+key)
    if existing is not None:
        return existing
    if key in build.CALIBRATED:
        return build.calibrated_camera(sc,key,build.CALIBRATED[key])
    return build.add_camera(sc,key,*VIEWS[key])


def save_master(sc,path):
    for key in ('jiaoxuelou','lanshu',*VIEWS):
        camera_for(sc,key)
    sc.camera=camera_for(sc,'jiaoxuelou')
    build.setup_render(sc,32,(1440,1152))
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active=bpy.data.objects.get('site.taihu.rock')
    for area in bpy.context.screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.color_type='MATERIAL'
    bpy.context.preferences.filepaths.save_version=0
    path.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(path.resolve()),compress=True)


def render(sc, views, samples, width, output):
    output.mkdir(parents=True,exist_ok=True)
    build.setup_render(sc,samples,(width,round(width*0.8)))
    sc.cycles.max_bounces = 5
    sc.render.image_settings.quality=93
    for key in views:
        sc.camera = camera_for(sc,key)
        sc.render.resolution_y = round(width*(0.8 if key in ('jiaoxuelou','lanshu') else 0.64))
        sc.render.filepath = str(output/(key+'.jpg'))
        bpy.ops.render.render(write_still=True)


def main(args):
    sc = build.reset_scene()
    OUT.mkdir(parents=True,exist_ok=True)
    # Preserve the phase-two pavement triangulation, levels, stair runs and vector lettering.
    bpy.ops.import_scene.gltf(filepath=str(TWIN/'assets/phase1/site.glb'))
    stone = build.collection('landmark')
    site = build.collection('forecourt')
    for ob in list(sc.objects):
        if ob.name in ('site.taihu.rock','site.taihu.plinth','site.forecourt.hedges'):
            bpy.data.objects.remove(ob,do_unlink=True)
        elif ob.name=='site.taihu.inscription':
            move(ob,stone)
            # Shallow, mineral-coloured engraved lettering appearance; underlying outline retained.
            for slot in ob.material_slots:
                slot.material = kit.get_material('atelier.lettering',{'atelier.lettering':((0.64,0.60,0.51),0.75,0,{})})
        else:
            move(ob,site)
    overlap = fieldstone(stone,args.cache)
    kit.MATERIALS['atelier.coping'] = ((0.28,0.29,0.25),0.41,0,{})
    plinth(stone)
    turf(stone)
    hedges(site,build.SITE)
    yihao = build.collection('yihao')
    school(yihao)
    erhao = build.collection('erhao')
    build_block(erhao)
    for key,tint in (('sea',(0.67,0.77,0.76)),('sky',(0.75,0.82,0.84)),('shadow',(0.57,0.68,0.68))):
        glass = kit.get_material('atelier.glass.'+key)
        bs = glass.node_tree.nodes.get('Principled BSDF')
        bs.inputs['Base Color'].default_value = (*kit.srgb_to_lin(tint),1)
        bs.inputs['Metallic'].default_value = 0.04
        bs.inputs['Roughness'].default_value = 0.115
        bs.inputs['Transmission Weight'].default_value = 0.72
        bs.inputs['IOR'].default_value = 1.48
    with tempfile.TemporaryDirectory() as scratch:
        directory = Path(scratch)
        terminalia = build.collection('terminalia')
        tree(terminalia,directory)
        maps = build_maps(directory,'karst','limestone',(0.86,0.86,0.84),1.38)
        apply_maps(kit.get_material('atelier.karst'),maps,1.38,vertex=True)
        for material,kind,col,repeat,grid in (
            ('stone.granite.dark','slab',(0.255,0.264,0.231),4.8,(6,8)),
            ('atelier.erhao.ceramic','slab',(0.69,0.675,0.64),4.8,(40,72)),
            ('atelier.court.paving','paving',(0.53,0.52,0.47),4.8,(6,8)),
            ('paving.asphalt','road',(0.34,0.321,0.288),3.8,None),
            ('paving.granite.light','paving',(0.70,0.68,0.63),4.8,(8,8)),
            ('paving.granite.dark','paving',(0.36,0.355,0.32),4.8,(8,8)),
            ('stone.granite.red','slab',(0.49,0.292,0.234),3.6,(4,7)),
        ):
            apply_maps(kit.get_material(material),build_maps(directory,material,kind,col,repeat,grid),repeat)
    # The inherited trees and gate remain independent baseline parts. Include them for
    # cast shadows, reverse views and the editable assembly, without re-exporting them.
    for part in ('trees','gate'):
        existing = set(sc.objects)
        bpy.ops.import_scene.gltf(filepath=str(TWIN/'assets/phase1'/(part+'.glb')))
        context = build.collection('phase2.'+part)
        for ob in set(sc.objects)-existing:
            if ob.name in ('trees.lanren.wood','trees.lanren.leaves'):
                bpy.data.objects.remove(ob,do_unlink=True)
            elif ob.name.startswith('trees.lanren.boulder.'):
                bpy.data.objects.remove(ob,do_unlink=True)
            else:
                move(ob,context)
    if not args.draft:
        for coll in (stone,yihao,site,erhao,terminalia):
            export(coll)
        manifest = {'baseline':'49ed015be7b155186aea06abdbb00e6d22965aaa',
                    'frame':'metres, twin (x,y,z) -> glTF (x,z,-y)',
                    'parts':{c.name:{'file':c.name+'.glb','objects':len(c.all_objects)} for c in (stone,yihao,site,erhao,terminalia)},
                    'silhouette_overlap':overlap}
        (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    build.sun_and_sky(sc,args.when,strength=3.1)
    if args.blend:
        save_master(sc,args.blend)
    render(sc,args.views,args.samples,args.width,args.renders)


if __name__=='__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--draft',action='store_true', help='Only render, leave checked-in GLBs alone')
    parser.add_argument('--cache',type=Path, help='Optional local NPZ of this sculpt; omit after changing relief data')
    parser.add_argument('--blend',type=Path)
    parser.add_argument('--views',nargs='*',default=['jiaoxuelou','piedmont','limestone','reverse','colonnade','portal_detail','quadrangle','avenue','lanshu','fork','crown'])
    parser.add_argument('--width',type=int,default=1440)
    parser.add_argument('--samples',type=int,default=32)
    parser.add_argument('--when',default='2026-06-21T16:30')
    parser.add_argument('--renders',type=Path,default=RENDERS)
    main(parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []))
