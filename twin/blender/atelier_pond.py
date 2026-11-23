"""砚池. A planted limestone bank and crescent spillway within the mapped water footprint."""
import io
import math
from pathlib import Path
import random
import tempfile

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from PIL import Image
from scipy.spatial import Delaunay
import shapely
from shapely.geometry import Polygon, Point, box
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

import atelier_court
from atelier_materials import rgb_image, apply_maps, build_maps
import b_campus
import kit

TWIN=Path(__file__).resolve().parents[1]
LEVEL=-.25
C=(42.0,-120.8)
RAD=2.88
TOP=.33
TAU=math.tau
WATER='pond.water.olive'
FALL='pond.water.veil'
WET='pond.basalt.wet'
RIM='pond.coping.sandstone'
SOIL='pond.bank.soil'
FOAM='pond.water.aerated'
PAVING='pond.promenade.brick'
UP=(0,0,1)


def material_setup():
    for name,col,r,m in [
        (WATER,(.181,.242,.149),.14,0),(FALL,(.32,.40,.34),.13,.05),
        (WET,(.247,.235,.185),.57,0),(RIM,(.60,.544,.455),.72,0),
        (SOIL,(.277,.241,.158),.97,0),(FOAM,(.64,.69,.61),.34,0),
        (PAVING,(.566,.426,.332),.8,0),('pond.path.band',(.425,.407,.35),.8,0),
        ('pond.stem',(.328,.379,.178),.74,0),('pond.lily',(.277,.391,.164),.52,0),
        ('pond.bark',(.352,.327,.261),.94,0),
    ]:
        kit.MATERIALS[name]=(col,r,m,{})
    for i,col in enumerate([(.146,.256,.112),(.23,.347,.13),(.315,.435,.176),(.397,.475,.19),(.40,.36,.18)]):
        kit.MATERIALS['pond.leaf.'+str(i)]=(col,.56,0,{})
    with tempfile.TemporaryDirectory() as tmp:
        td=Path(tmp)
        # A seamless capillary normal independent of sun direction. Longer gravity
        # waves and the expanding crests at the weir are carried by the mesh.
        v,u=np.indices((512,512))/512*TAU
        height=.0019*np.sin(13*u+7*v+.9*np.sin(2*v))+.0013*np.sin(4*u-21*v+1.8*np.sin(u+v))+.00064*np.sin(28*u-9*v+.7*np.sin(4*u))
        dx=(np.roll(height,-1,1)-np.roll(height,1,1))*512/(2*2.8)
        dy=(np.roll(height,-1,0)-np.roll(height,1,0))*512/(2*2.8)
        n=np.stack([-dx,dy,np.ones_like(dx)],axis=-1);n/=np.linalg.norm(n,axis=-1,keepdims=True)
        factor=1+.052*np.sin(u+v+.6*np.sin(2*u))+.021*np.cos(2*v-u)
        rough=.108+.044*(1+np.cos(3*u-v))*.5
        maps=(rgb_image(td,'pond.water.tint',factor[:,:,None]*np.array([.236,.261,.15])),
              rgb_image(td,'pond.water.capillary',n*.5+.5,True),
              rgb_image(td,'pond.water.orm',np.stack([np.ones_like(u),rough,np.zeros_like(u)],axis=-1),True))
        water=kit.get_material(WATER);apply_maps(water,maps,2.8)
        for node in water.node_tree.nodes:
            if node.type=='NORMAL_MAP': node.inputs['Strength'].default_value=.55
        water.node_tree.nodes['Principled BSDF'].inputs['IOR'].default_value=1.333
        fall=kit.get_material(FALL).node_tree.nodes['Principled BSDF']
        fall.inputs['IOR'].default_value=1.333
        fall.inputs['Transmission Weight'].default_value=.28
        fall.inputs['Alpha'].default_value=.43
        # Flow UVs wrap around the lip, with V measured downward. Broken rivulets
        # use full PBR maps so the highlights follow a new light or viewing angle.
        warp=26*u+.75*np.sin(2*v+3*u)+.42*np.sin(v-6*u)
        channels=np.exp(-3*(1-np.cos(warp+.73*np.sin(11*u))))
        run=.5+.5*np.sin(9*u-2*v+1.1*np.sin(7*u+v))
        streak=channels*(.19+.81*run)
        film_h=.0014*np.sin(warp)+.0011*np.sin(52*u+1.15*np.sin(2*v-3*u))+.0006*np.sin(72*u+3*v)
        dx=(np.roll(film_h,-1,1)-np.roll(film_h,1,1))*512/(2*2.1)
        dy=(np.roll(film_h,-1,0)-np.roll(film_h,1,0))*512/(2*1.1)
        normals=np.stack([-dx,dy,np.ones_like(dx)],axis=-1)
        normals/=np.linalg.norm(normals,axis=-1,keepdims=True)
        tint=np.array([.207,.221,.175])+streak[:,:,None]*np.array([.28,.31,.29])
        orm=np.stack([np.ones_like(u),.12+.14*(1-run),np.zeros_like(u)],axis=-1)
        maps=(rgb_image(td,'pond.fall.tint',tint),rgb_image(td,'pond.fall.film',normals*.5+.5,True),
              rgb_image(td,'pond.fall.orm',orm,True))
        mat=kit.get_material(FALL);apply_maps(mat,maps,1)
        next(n for n in mat.node_tree.nodes if n.type=='NORMAL_MAP').inputs['Strength'].default_value=1.1
        fall.inputs['Alpha'].default_value=.70
        # Damp masonry below the sheet stays darker than the nearly horizontal cap.
        algae=.5+.5*np.sin(9*u+.48*np.cos(v+2*u))
        wet_tint=np.array([.133,.124,.098])+(algae*run)[:,:,None]*np.array([.103,.108,.062])
        wet_maps=(rgb_image(td,'pond.weir.minerals',wet_tint),maps[1],maps[2])
        apply_maps(kit.get_material(WET),wet_maps,1.6)
        for key,col,rep,grid in [(PAVING,(.56,.432,.348),2.32,(9,17)),(RIM,(.57,.527,.443),2.75,(3,5))]:
            apply_maps(kit.get_material(key),build_maps(td,key,'paving',col,rep,grid),rep)


def emit(g,name,coll,basis,tag='photo-derived/estimated',smooth=None):
    ob=g.to_object('yanchi.'+name,coll,smooth_angle=smooth)
    ob['haiz_tag']=tag;ob['haiz_basis']=basis
    return ob


def outline():
    return Polygon(next(i['poly'] for i in b_campus.C['water'] if i['name']=='砚池'))


def shaped_banks(p):
    # The map records the overall pool. Sculpt the shelves and two walking
    # landings inwards, keeping the inherited terrain cut filled at its corners.
    shore=Polygon([(34,-132),(39.3,-130.2),(40.4,-128.7),(41.2,-127.65),
                   (41.5,-126.6),(41.1,-125.4),(42.0,-123.85),(41.3,-122.55),
                   (41.2,-120.5),(40.7,-118.8),(40.0,-117.8),(40.45,-116.55),
                   (39.7,-115.5),(38.8,-114.9),(38.7,-113.1),(37.6,-111.7),(34,-111.2)])
    shore=shore.buffer(.42,join_style='round').buffer(-.42,join_style='round')
    north=unary_union([Point(49.7,-109.4).buffer(3.02),box(46.68,-109.4,52.72,-107)])
    steps=box(61.65,-125.7,65,-117.6)
    return shore,north,steps,p.buffer(-.30).buffer(.30).difference(unary_union([shore,north,steps]))


def wall_faces(g,mat,geom,base,top):
    for poly in kit.iter_polys(geom):
        ring=list(orient(poly,sign=1).exterior.coords)
        for a,b in zip(ring,ring[1:]):
            g.polyn(mat,[(*a,base),(*b,base),(*b,top),(*a,top)],(b[1]-a[1],a[0]-b[0],0))


def hardscape(coll,p,bank,north,steps,wet):
    g=kit.Geo()
    kit.area(g,SOIL,p,LEVEL-.72);wall_faces(g,WET,p,LEVEL-.73,.15)
    kit.area(g,SOIL,p.intersection(bank),.17)
    wall_faces(g,WET,p.intersection(bank),LEVEL-.20,.17)
    # Masonry and brick retain the other shores; no line of repeated boulders.
    coping=wet.boundary.buffer(.135).difference(bank.buffer(.38)).difference(steps.buffer(.08))
    kit.area(g,RIM,coping,.145);wall_faces(g,WET,coping,LEVEL-.16,.14)
    margin=p.buffer(1.15).difference(p.buffer(-.06)).difference(bank).difference(steps)
    kit.area(g,PAVING,margin,.174)
    kit.area(g,'pond.path.band',p.buffer(.97).difference(p.buffer(.87)).difference(bank),.178)
    landing=north.intersection(p.buffer(1.15));kit.area(g,PAVING,landing,.175)
    wall_faces(g,WET,landing,LEVEL-.16,.17)
    band=north.buffer(-.23).difference(north.buffer(-.33)).intersection(p)
    kit.area(g,'pond.path.band',band,.178)
    for i in range(4):
        x=61.65+i*.43
        g.box(RIM,(x,-125.7,LEVEL-.20),(x+.435,-117.6,LEVEL+.11+i*.141))
    emit(g,'basin_and_walks',coll,'OSM outer pool. Photo shows paved low banks, a curved landing and shallow approach steps. Position, dimensions and jointing inferred.')


def wave(x,y):
    d=np.hypot(x-C[0],y-C[1]);k=d-RAD
    wind=(.006+.0024*np.sin(.61*x+.24*y))*np.sin(5*x+2.7*y+1.8*np.sin(.38*y)+.48*np.cos(.71*x))
    wind+=.0021*np.cos(4.1*x+4.5*y+1.9*np.sin(.49*x+.24*y))+.0011*np.sin(2.6*x-5.4*y)
    rings=.023*np.sin(k*12+.54*np.sin(y*3))*np.exp(-np.maximum(k,0)/2.25)
    return LEVEL+wind+rings


def surface(coll,poly):
    points=[]
    for ring in [poly.exterior,*poly.interiors]:
        for a,b in zip(ring.coords,list(ring.coords)[1:]):
            count=max(1,math.ceil(math.dist(a,b)/.13))
            for j in range(count): points.append(np.array(a)+(np.array(b)-a)*j/count)
    x0,y0,x1,y1=poly.bounds
    xx,yy=np.meshgrid(np.arange(x0+.07,x1,.145),np.arange(y0+.07,y1,.145))
    rng=np.random.default_rng(129)
    xx+=rng.uniform(-.018,.018,xx.shape); yy+=rng.uniform(-.018,.018,yy.shape)
    inside=shapely.contains_xy(poly.buffer(-.055),xx,yy)
    points=np.unique(np.round(np.vstack((points,np.column_stack((xx[inside],yy[inside])))),6),axis=0)
    tri=Delaunay(points).simplices
    centers=points[tri].mean(axis=1);tri=tri[shapely.contains_xy(poly,centers[:,0],centers[:,1])]
    g=kit.Geo()
    z=wave(points[:,0],points[:,1])
    g.add_indexed(WATER,np.column_stack((points,z)),tri)
    emit(g,'water',coll,'Mapped outline clipped to the planted bank and landings. Wind chop and radial wave train are illustrative.',smooth=60)


def spillway(coll,rng):
    g=kit.Geo()
    angles=np.linspace(-1.84,1.79,118)
    def pt(a,r,z):return (C[0]+r*math.cos(a),C[1]+r*math.sin(a),z)
    rim=[pt(a,RAD,TOP) for a in angles]
    plan=Polygon([q[:2] for q in rim]+[(C[0]-2.45,C[1]+2.47),(C[0]-2.65,C[1]-2.52)])
    # The upper pool backs into the rock shelf; there is only one exposed falling edge.
    kit.area(g,WATER,plan.buffer(-.014),TOP+.017)
    wall_faces(g,WET,plan,LEVEL-.13,TOP)
    for a,b in zip(angles,angles[1:]):
        g.polyn(WET,[pt(a,RAD-.105,TOP+.012),pt(b,RAD-.105,TOP+.012),
                     pt(b,RAD+.044,TOP+.012),pt(a,RAD+.044,TOP+.012)],UP)
    emit(g,'spillway',coll,'wenhua_yanchi shows a low raised pool joined to the rockery and a dark curved overflow. Radius, position and drop inferred.')
    g=kit.Geo()
    # A connected translucent sheet hugs the dark lip and separates as it falls.
    # Correlated thickness variation avoids the picket-like edges of separate strips.
    strips=346
    old=None
    for j in range(strips+1):
        a=-1.84+3.63*j/strips
        film=.005*math.sin(23*a)+.0031*math.sin(111*a+.6*math.sin(a*13))
        row=[]
        for t in (0,.09,.25,.52,.78,1):
            r=RAD+.033+.105*math.sqrt(t)+film*(.4+t)+.008*t*math.sin(17*a+7*t)
            z=TOP+.019-(TOP-LEVEL+.011)*t
            row.append(pt(a,r,z))
        if old:
            for i in range(len(row)-1):
                u0=(a+1.84-3.63/strips)*RAD/2.1; u1=(a+1.84)*RAD/2.1
                v0=(old[i][2]-LEVEL)/1.1;v1=(old[i+1][2]-LEVEL)/1.1
                g.poly(FALL,[row[i],old[i],old[i+1],row[i+1]],[(u1,v0),(u0,v0),(u0,v1),(u1,v1)])
        old=row
    for _ in range(210):
        a=rng.uniform(-1.82,1.77);t=rng.uniform(.35,1.01);length=rng.uniform(.016,.084);w=rng.uniform(.001,.0038)
        r=RAD+.048+.123*math.sqrt(t)
        z=TOP-(TOP-LEVEL)*t
        g.polyn(FOAM,[pt(a-w,r,z+length*.5),pt(a,r+.003,z+length),pt(a+w,r,z+length*.36),
                      pt(a+.0007,r+.006,z)],(math.cos(a),math.sin(a),0))
    for _ in range(530):
        a=rng.uniform(-1.84,1.79);r=RAD+.165+abs(rng.gauss(0,.082))
        x,y,_=pt(a,r,0);z=float(wave(x,y))+.012
        length=rng.uniform(.011,.055);w=length*rng.uniform(.20,.60)
        g.polyn(FOAM,[(x+length*math.sin(a),y-length*math.cos(a),z),(x+w*math.cos(a),y+w*math.sin(a),z+.003),
                       (x-length*math.sin(a),y+length*math.cos(a),z),(x-w*math.cos(a),y-w*math.sin(a),z)],UP)
    emit(g,'fall_and_contact',coll,'Discontinuous sheets turning over the weir and aeration at the foot. Flow state inferred.')
    return plan


def weathered_materials(original):
    # Keep the original baked normals/roughness. Darker damp beds and warm dry
    # fracture surfaces modify only the albedo, independent of camera and sun.
    variants=[]
    with tempfile.TemporaryDirectory() as tmp:
        for label,mult in [('wet',(.41,.375,.29)),('shaded',(.53,.494,.374)),('cap',(.73,.68,.52)),('marker',(.83,.78,.63))]:
            mat=original.copy();mat.name='pond.limestone.'+label
            node=next(n for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and 'limestone-color' in n.image.name)
            rgb=np.asarray(Image.open(io.BytesIO(node.image.packed_file.data)).convert('RGB'))/255
            rgb=np.clip((rgb-.37)*1.18+.37,0,1)*np.array(mult)
            node.image=rgb_image(Path(tmp),mat.name+'.albedo',rgb)
            variants.append(mat)
    return variants


def flute_marker(mesh):
    # Resample the existing carved solid before weathering so the letter bottoms,
    # cheeks and stone face move as a unit. The original inset type remains editable.
    bm=bmesh.new();bm.from_mesh(mesh)
    bmesh.ops.triangulate(bm,faces=list(bm.faces))
    for _ in range(5):
        edges=[e for e in bm.edges if e.calc_length()>.195]
        if not edges: break
        bmesh.ops.subdivide_edges(bm,edges=edges,cuts=1,use_grid_fill=True)
        bmesh.ops.triangulate(bm,faces=[f for f in bm.faces if len(f.verts)>3])
    for v in bm.verts:
        x,y,z=v.co
        front=max(0,min(1,(-y+.15)/.38))
        groove=math.exp(-((x+.68+.064*math.sin(1.8*z))/.11)**2)
        shelf=math.exp(-((z-1.92+.12*x)/.095)**2)*max(0,min(1,x+.8))
        v.co.y+=front*(.16*groove+.13*shelf+.083*math.sin(3.1*x+1.1*z)+.023*math.cos(7*x-3*z))
        v.co.x+=.043*math.sin(z*3.6+x)+.038*z
        v.co.z+=.027*math.sin(x*5.5+z*.75)*min(z,1)
    bm.normal_update();bm.to_mesh(mesh);bm.free();mesh.update()


def limestone(coll,rng):
    path=TWIN.parent/'assets/walk/models/campus-limestone.glb'
    prev=set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    objects=set(bpy.context.scene.objects)-prev
    source={o.name:o for o in objects}
    stones=[source['Limestone_%d_high'%i].data for i in range(3)]
    mats=weathered_materials(stones[0].materials[0])
    flute_marker(source['PondStele'].data)
    def place(name,mesh,xyz,scale,angles,basis,tone):
        ob=bpy.data.objects.new('yanchi.'+name,mesh);coll.objects.link(ob)
        ob.location=xyz;ob.scale=scale;ob.rotation_euler=angles
        ob.material_slots[0].link='OBJECT';ob.material_slots[0].material=mats[tone]
        ob['haiz_tag']='photo-derived/estimated';ob['haiz_basis']=basis
        return ob
    place('inscribed_stone',source['PondStele'].data,(39.65,-126.85,.115),(.85,1.35,.80),
          (.025,-.055,math.radians(65)),'Photo-informed original HAIZ carved stone with inset vermilion type. Location and calligraphy approximate.',3)
    # The larger slabs form a battered stack along the back of the weir. Individual
    # strata overhang earlier ones, leaving shadow joints and pockets for understory.
    stacks=[(40.25,-124.65,3,1.07),(40.95,-123.45,4,1.16),(40.35,-122.12,5,1.16),
            (39.50,-121.05,4,1.02),(40.04,-119.55,4,.94),(40.46,-118.27,3,.89),
            (39.48,-116.95,2,.87),(39.90,-125.85,2,.72),(40.94,-127.37,1,.81)]
    k=0
    for x,y,count,size in stacks:
        for j in range(count):
            scale=size*(1-.115*j)
            place('shelf.%02d'%k,stones[k%3],(x+.18*math.sin(j*3+k),y+.14*math.sin(k),.01+j*.36),
                  (scale*rng.uniform(.76,1.03),scale*rng.uniform(.76,1.02),rng.uniform(.39,.51)),
                  (rng.uniform(-.10,.10),rng.uniform(-.08,.08),rng.uniform(-1.53,1.21)),
                  'Original high-detail baked limestone variants in interlocking beds. Layering visible, individual stones inferred.',0 if j==0 else (2 if j==count-1 else 1)); k+=1
    for j,(x,y,s) in enumerate([(42.0,-126.9,.48),(42.64,-124.6,.40),(41.28,-117.3,.43),(42.7,-123.99,.39),(40.7,-115.1,.57),(42.8,-127.9,.28)]):
        place('shoal.%02d'%j,stones[j%3],(x,y,LEVEL+.085),(s,s*.85,s*.65),(.04,.07,j*1.37),'Partly submerged stones visible at the planted bank; positions inferred.',0)
    for o in objects:bpy.data.objects.remove(o,do_unlink=True)


def leaf_clump(g,rng,x,y,z,s):
    for j in range(rng.randint(7,12)):
        a=j*2.4+rng.uniform(-.31,.31)
        u=Vector((math.cos(a),math.sin(a),0));v=Vector((-u.y,u.x,0))
        h=s*rng.uniform(.48,1.09); reach=s*rng.uniform(.28,.71);w=s*rng.uniform(.095,.19)
        o=Vector((x,y,z))
        base=o+u*(reach*.23)+Vector((0,0,h*.36))
        stem0=o+v*.009; stem1=base+v*.007
        g.polyn('pond.stem',[stem0,stem1,base-v*.007,o-v*.009],u)
        prev=None; mat='pond.leaf.'+str(rng.choices(range(5),weights=[3,5,4,2,.3])[0])
        for t in np.linspace(0,1,8):
            mid=base+u*(reach*t)+Vector((0,0,h*(1.09*t-.73*t*t)))
            hw=w*(math.sin(math.pi*t)**.78)*(.74+.4*t)+.0008
            row=[mid-v*hw,mid+Vector((0,0,hw*.29)),mid+v*hw]
            if prev:
                if 0<t<.88:
                    g.polyn('pond.stem',[prev[1]-v*.004,prev[1]+v*.004,row[1]+v*.003,row[1]-v*.003],UP)
                for i in (0,1):g.polyn(mat,[prev[i],prev[i+1],row[i+1],row[i]],UP)
            prev=row


def fern(g,rng,x,y,z,height):
    for j in range(8):
        a=j*2.4+rng.uniform(-.22,.22)
        u=Vector((math.cos(a),math.sin(a),0));v=Vector((-u.y,u.x,0))
        length=height*rng.uniform(.61,1.13); o=Vector((x,y,z));old=o
        for k in range(1,15):
            t=k/14
            mid=o+u*(length*t)+Vector((0,0,height*(1.67*t-1.39*t*t)))
            g.polyn('pond.stem',[old-v*.006,mid-v*.004,mid+v*.004,old+v*.006],UP)
            for side in (-1,1):
                leaf=length*(.035+.19*math.sin(math.pi*t)**.7)
                tip=mid+v*side*leaf+u*leaf*.52+Vector((0,0,.028))
                center=mid.lerp(tip,.55)
                g.polyn('pond.leaf.'+str(1+(j+k)%3),[mid,center-u*leaf*.11,tip,center+u*leaf*.11],UP)
            old=mid


def garden_walk(coll,rng):
    # The circulation in the wide image terminates at a small shore platform;
    # the flanking grass and planters connect it to the teaching courtyard.
    g=kit.Geo()
    path=unary_union([box(35.7,-105.0,63.8,-103.25),box(48.80,-109.4,50.63,-103.52)])
    kit.area(g,PAVING,path,.181)
    for x,y in [(46.64,-109.98),(52.67,-109.83)]:
        for z0,z1,r0,r1,m in [(0.17,.25,.27,.31,WET),(.25,.32,.24,.22,WET),
                                 (.32,.75,.22,.42,RIM),(.75,.81,.42,.45,RIM)]:
            g.cylinder(m,(x,y),r0,z0,z1,seg=30,r1=r1)
        g.cylinder(SOIL,(x,y),.37,.806,.815,seg=30)
        for k in range(8):
            a=k*2.4
            leaf_clump(g,rng,x+.14*math.cos(a),y+.14*math.sin(a),.814,.57)
    for x in (55.6,60.4):
        for dx in (-.61,.61):g.box(WET,(x+dx-.10,-106.16,.16),(x+dx+.10,-105.79,.56))
        for j in range(4):g.box('pond.bark',(x-.92,-106.25+j*.12,.54),(x+.92,-106.146+j*.12,.61))
    emit(g,'garden_walk',coll,'Two planted urns and a cross path on the opposite shore in wenhua_yanchi. Benches, dimensions and offsets inferred.')


def garden_trees(g,rng):
    # Low compound crowns behind the pond soften the far path without filling the water.
    for x,y,h in [(44.45,-105.6,4.45),(56.6,-105.72,4.9),(64.9,-113.6,3.65)]:
        base=Vector((x,y,.16));fork=base+Vector((.16,-.10,h*.54))
        atelier_court.stem(g,base,fork,.117,.073)
        for i in range(8):
            a=i*2.4+rng.uniform(-.24,.24);u=Vector((math.cos(a),math.sin(a),0))
            reach=rng.uniform(.67,1.35);joint=fork+u*(reach*.45)+Vector((0,0,h*.16))
            end=joint+u*reach*.55+Vector((0,0,rng.uniform(.28,.71)))
            atelier_court.stem(g,fork,joint,.062,.033);atelier_court.stem(g,joint,end,.036,.014)
            for j in (-1,0,1):
                tip=end+Vector((.26*j*math.sin(a),-.26*j*math.cos(a),.18-.10*abs(j)))
                atelier_court.stem(g,end,tip,.019,.006)
                atelier_court.leaves(g,tip,(.67,.60,.39),301,rng)


def planting(coll,bank,rng):
    g=kit.Geo()
    # Keep the inscription face, art-center threshold and water apron clear.
    clusters=[(39.06,-127.17,.69),(39.40,-125.88,.77),(40.3,-127.68,.64),
              (38.35,-123.8,1.12),(38.7,-121.2,1.05),(38.5,-118,.95),
              (37.8,-115.3,.89),(40.2,-128.75,.54),(39.7,-117.7,.8)]
    for cx,cy,s in clusters:
        for _ in range(12):
            x=cx+rng.uniform(-.74,.74);y=cy+rng.uniform(-.72,.72)
            if bank.covers(Point(x,y)):
                leaf_clump(g,rng,x,y,.17,s*rng.uniform(.65,1.17))
    for i,(x,y,z,s) in enumerate([(40.15,-127.65,.17,1.09),(40.78,-126.23,.23,.92),(40.79,-125.65,.38,.79),
                                  (40.41,-124.16,.72,.74),(39.98,-122.3,1.26,.68),(40.34,-118.85,.87,.71),
                                  (39.4,-117.2,.65,.68),(39.5,-114.94,.18,.98),(38.16,-113.91,.16,.99)]):
        for j in range(7):
            px=x+rng.uniform(-.44,.44);py=y+rng.uniform(-.42,.42)
            (fern if j%3==0 else leaf_clump)(g,rng,px,py,z,s*rng.uniform(.72,1.18))
    for cx,cy in [(53.1,-106.96),(56.5,-106.98),(59.25,-107.08),(63.9,-114.2),(64.2,-126.6)]:
        for j in range(9):
            leaf_clump(g,rng,cx+rng.uniform(-1.1,1.1),cy+rng.uniform(-.48,.48),.16,rng.uniform(.42,.90))
    for _ in range(14):
        x=rng.uniform(42.0,45.1);y=rng.uniform(-128.8,-126.1)
        r=rng.uniform(.05,.155);a0=rng.uniform(0,TAU);z=float(wave(x,y))+.017
        for q in range(15):
            a=a0+q*6.05/15;b=a+6.05/15
            g.polyn('pond.lily',[(x,y,z-.001),(x+r*math.cos(a),y+r*.83*math.sin(a),z+.002),(x+r*math.cos(b),y+r*.83*math.sin(b),z+.002)],UP)
    emit(g,'bank_foliage',coll,'Clusters of glossy broad leaves at the marker and a few floating leaves seen in campus_yanchi and wenhua_yanchi. Species and counts illustrative.')
    g=kit.Geo();atelier_court.register()
    for i,(x,y,h) in enumerate([(39.55,-125.65,9.4),(39.34,-120.7,10.5),(38.95,-114.95,8.4),(59.4,-106.9,9.6),(65.3,-116.1,9.4),(65.85,-126.6,8.1)]):
        atelier_court.palm(g,x,y,.16,h,160+i)
    garden_trees(g,rng)
    emit(g,'coconut_bank',coll,'Tall palms beside the bank and surrounding paths in campus_yanchi and campus_yishu. Individual positions estimated.')


def build_pond(coll):
    material_setup();rng=random.Random(19231957)
    p=outline();bank,north,steps,wet=shaped_banks(p)
    hardscape(coll,p,bank,north,steps,wet)
    upper=spillway(coll,rng)
    surface(coll,wet.difference(upper))
    limestone(coll,rng);planting(coll,bank,rng);garden_walk(coll,rng)
