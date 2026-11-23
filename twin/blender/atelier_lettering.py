"""Photo-contoured intaglio inscriptions. Coordinates in each source are image pixels."""
import json
import math
import tempfile
from pathlib import Path

import bpy
from mathutils import Vector
from scipy.ndimage import gaussian_filter
from atelier_materials import rgb_image,apply_maps
import numpy as np
from shapely import constrained_delaunay_triangles, make_valid, segmentize
from shapely.geometry import Polygon, box
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
import kit

DATA=Path(__file__).resolve().parents[1]/'evidence/calibration'
TRACES=json.loads((DATA/'stone_lettering.json').read_text())['panels']
POND_BASIS='Weathered pond stele. Visible red brush outlines, narrow vertical dedication and two seals from campus_yanchi.jpg. Relief, depth and obscured strokes estimated.'
MINERAL='inscription.mineral'
SCARLET='inscription.vermilion'
RED_EDGE='inscription.vermilion.edge'
STONE_EDGE='inscription.mineral.edge'
GRANITE='inscription.plaque.granite'
CHALK='inscription.mineral.dense'
CINNABAR='inscription.vermilion.dense'


def pigments():
    for key,col,r in [(GRANITE,(.285,.285,.247),.48),(CHALK,(.79,.756,.659),.86),(CINNABAR,(.735,.132,.068),.75),(MINERAL,(.58,.557,.468),.88),(STONE_EDGE,(.528,.49,.387),.91),
                      (SCARLET,(.574,.104,.048),.73),(RED_EDGE,(.449,.101,.063),.86)]:
        kit.MATERIALS[key]=(col,r,0,{})


def granite_maps():
    mat=kit.get_material(GRANITE)
    if any(n.type=='TEX_IMAGE' for n in mat.node_tree.nodes):return
    rng=np.random.default_rng(2012)
    grid=rng.normal(size=(512,512))
    grain=(grid*.034+gaussian_filter(grid,2,mode='wrap')*.24+gaussian_filter(grid,14,mode='wrap')*1.4)
    quartz=np.maximum(grid-1.03,0)*.062
    rgb=np.array([.255,.253,.216])+grain[:,:,None]*np.array([.36,.37,.34])+quartz[:,:,None]*.55
    relief=.00010*gaussian_filter(grid,.78,mode='wrap');dx,dy=np.gradient(relief)
    n=np.stack([-dy*500,dx*500,np.ones_like(dx)],axis=-1);n/=np.linalg.norm(n,axis=-1,keepdims=True)
    orm=np.stack([np.ones_like(grid),np.clip(.49+.48*grain,.27,.73),np.zeros_like(grid)],axis=-1)
    with tempfile.TemporaryDirectory() as tmp:
        td=Path(tmp); maps=(rgb_image(td,'plaque.grain',rgb),rgb_image(td,'plaque.grain-normal',n*.5+.5,True),rgb_image(td,'plaque.grain-orm',orm,True))
        apply_maps(mat,maps,1.03)


def trace(name,transform,key='outlines_px'):
    shapes=[]
    for group in TRACES[name][key]:
        rings=[[transform(*pt) for pt in ring] for ring in group]
        p=make_valid(Polygon(rings[0],rings[1:]))
        shapes.extend(kit.iter_polys(p))
    return unary_union(shapes)


def face(g,shape,mat,point,toward,uv=None):
    for poly in kit.iter_polys(shape):
        if poly.area<1e-11:continue
        for tri in constrained_delaunay_triangles(poly).geoms:
            coords=list(orient(tri,sign=toward).exterior.coords)[:3]
            g.poly(mat,[point(*p) for p in coords],None if uv is None else [uv(*p) for p in coords])


def groove_walls(g,paint,mat,mouth,back):
    for poly in kit.iter_polys(paint):
        p=orient(poly,sign=1)
        for ring in [p.exterior,*p.interiors]:
            for a,b in zip(ring.coords,list(ring.coords)[1:]):
                g.quad(mat,mouth(*a),mouth(*b),back(*b),back(*a))


def plinth_panels(coll,spec):
    pigments()
    granite_maps()
    camera=json.loads((DATA/'jiaoxuelou-1600.report.json').read_text())['camera']
    basis=camera['basis'];eye=Vector((camera['x'],camera['y'],camera['z']))
    right,up,forward=[Vector(basis[k]) for k in ('right','up','forward')]
    u0,v0=camera['principal_point'];f=camera['f_px']
    y=spec['plinth'][3]+.023
    def plane(u,v):
        ray=forward+right*((u-u0)/f)+up*((v0-v)/f)
        q=eye+ray*((y-eye.y)/ray.y)
        return (q.x,q.z)
    g=kit.Geo()
    for key,name,depth in [('panel','taihu',.0047),('panel2','donor',.0024)]:
        x0,x1,z0,z1=spec[key]
        block=box(x0,z0,x1,z1)
        paint=trace(name,plane).intersection(block)
        dense=trace(name,plane,'dense_px').intersection(paint)
        mouth=lambda x,z:(x,y,z)
        back=lambda x,z:(x,y-depth,z)
        face(g,block.difference(paint),GRANITE,mouth,-1)
        face(g,paint.difference(dense),MINERAL,back,-1)
        face(g,dense,CHALK,back,-1)
        # Both panels face twin north. Wall orientation reverses at letter counters.
        groove_walls(g,paint,STONE_EDGE,back,mouth)
    ob=g.to_object('site.taihu.inscription',coll)
    ob['haiz_tag']='photo-derived/estimated'
    ob['haiz_basis']='Visible light calligraphy, signature and end-panel donation marks on jiaoxuelou-1600, back-projected onto the north face using the calibrated camera. Depth and weathering estimated; small text not transcribed.'
    return ob


def marker_mesh(rock):
    pigments()
    # Original HAIZ stele profile, with an asymmetric edge bevel. A new front
    # surface allows the grooves and the neighbouring stone to share a boundary.
    outline=Polygon([(-1.03,0),(1.02,0),(1.10,1.18),(.96,1.48),(1.14,2.13),
                     (.98,3.52),(.63,3.76),(-.28,3.86),(-.97,3.55),(-1.17,2.74),
                     (-1.08,1.54),(-1.22,.84)])
    front=outline.buffer(-.055,join_style='mitre')
    # The close photograph is oblique. Height and foreshortening are estimated;
    # preserve the placement of signature/seals relative to the large strokes.
    def on_stone(u,v):
        return ((u-302)*.00875+.00023*(v-400),3.57-(v-188)*.00598)
    paint=trace('pond',on_stone).intersection(front)
    dense=trace('pond',on_stone,'dense_px').intersection(paint)
    def surface(x,z):
        cleft=math.exp(-((x+.69+.064*math.sin(1.8*z))/.105)**2)
        ledge=math.exp(-((z-1.94+.09*x)/.086)**2)*max(0,min(1,x+.71))
        return -.40+.143*cleft+.11*ledge+.069*math.sin(3.1*x+1.1*z)+.013*math.cos(7*x-3*z)
    def contour(x,z,d=0):
        return (x+.038*z+.035*math.sin(z*3.6+x),surface(x,z)+d,z+.022*math.sin(x*5.5+z*.75)*min(z,1))
    def uv(x,z):return (.02+(x+1.3)/2.6*.29,.03+z/4*.94)
    def back(x,z):return contour(x,z,.014)
    g=kit.Geo()
    # Clip to a small metric grid before triangulation. At the letter outline
    # both surfaces follow the same varying rock depth, including the crevice.
    # Narrow clipped strokes must not be masked by interpolation across a curved
    # patch: use the same coarse partition for pigment, stone and groove margins.
    for x in np.arange(-1.30,1.22,.112):
        for z in np.arange(-.012,3.95,.112):
            tile=box(x,z,x+.112,z+.112).intersection(front)
            if tile.is_empty:continue
            face(g,tile.difference(paint),rock.name,contour,1,uv)
            ink=tile.intersection(paint)
            if not ink.is_empty:
                rich=tile.intersection(dense)
                face(g,ink.difference(rich),SCARLET,back,1)
                face(g,rich,CINNABAR,back,1)
    groove_walls(g,segmentize(paint,.048),RED_EDGE,contour,back)
    # Follow the same arclength on corresponding edges, subdividing the bevel
    # so that it follows the weathering on the face.
    outer=list(orient(outline,sign=1).exterior.coords)
    inner=list(orient(front,sign=1).exterior.coords)[:-1]
    start=min(range(len(inner)),key=lambda i:math.dist(inner[i],outer[0]))
    inner=inner[start:]+inner[:start];inner.append(inner[0])
    for i,(a,b) in enumerate(zip(outer,outer[1:])):
        c,d=inner[i:i+2]
        count=math.ceil(math.dist(a,b)/.075)
        for j in range(count):
            t0=j/count;t1=(j+1)/count
            def lerp(p,q,t):return (p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1]))
            pa,pb=lerp(a,b,t0),lerp(a,b,t1)
            pc,pd=lerp(c,d,t0),lerp(c,d,t1)
            p0,p1=contour(*pc),contour(*pd)
            q0,q1=contour(*pa,.095),contour(*pb,.095)
            r0=(q0[0],.36,q0[2]);r1=(q1[0],.36,q1[2])
            g.quad(rock.name,p0,q0,q1,p1,[uv(*pc),uv(*pa),uv(*pb),uv(*pd)])
            g.quad(rock.name,q0,r0,r1,q1,[uv(*pa),uv(pa[0]+.25,pa[1]),uv(pb[0]+.25,pb[1]),uv(*pb)])
    face(g,outline,rock.name,lambda x,z:(contour(x,z)[0],.36,contour(x,z)[2]),-1,uv)
    return g.to_mesh('Carved brushwork and weathered stone')
