"""Mapped comb-shaped classroom group in the southern teaching precinct."""
import json
import math
import random
from pathlib import Path
from mathutils import Matrix
from shapely.geometry import LineString, Polygon
from shapely.geometry.polygon import orient
import arch
import build
import kit
import b_yihao
from atelier_science import deck
from atelier_court import METAL, palm, leaves

WALL='atelier.erhao.ceramic'
EDGE='atelier.science.coping'
ROSE='atelier.south.terracotta'


BRIDGE_SPANS=((-145.96,-124.58),(-175.97,-156.97))


def split_spine(ring):
    """Split long surveyed outline edges at each courtyard without moving the outer face."""
    for a,b in zip(ring,ring[1:]+ring[:1]):
        ts=[0,1]
        if min(a[0],b[0])>-30 and abs(a[1]-b[1])>4:
            for span in BRIDGE_SPANS:
                for y in span:
                    t=(y-a[1])/(b[1]-a[1])
                    if 0.0001<t<0.9999:
                        ts.append(t)
        ts.sort()
        points=[(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t) for t in ts]
        yield from zip(points,points[1:])


def bridges(o,poly,levels):
    g=o.geo('court_bridges','public-map/invented','Narrow connecting spine in OSM w1165596688@1. Open galleries span the court in campus_sanhao_sihao; placement here, railings and intermediate supports are an interpretation.')
    for ya,yb in BRIDGE_SPANS:
        def ends(y):
            # At the inner courts the eastmost mapped strip is the spine.
            cut=poly.intersection(LineString([(-29.85,y),(-20,y)]))
            return cut.bounds[0],cut.bounds[2]
        la,ra=ends(ya)
        lb,rb=ends(yb)
        quad=[(la,ya),(ra,ya),(rb,yb),(lb,yb)]
        for z in levels[1:-1]:
            deck(g,quad,z,'interior.floor',0.235)
            for a,b in ((quad[0],quad[3]),(quad[1],quad[2])):
                dx,dy=b[0]-a[0],b[1]-a[1]
                g.polyn(ROSE,[(*a,z-0.21),(*b,z-0.21),(*b,z+0.46),(*a,z+0.46)],
                        (-1 if a==quad[0] else 1,0,0))
                arch.railing(g,[(*a,z+0.44),(*b,z+0.44)],h=0.60,post=1.48,rail=0.043,bars=0.145,mat=METAL)
        for t in (0.015,0.50,0.985):
            y=ya+t*(yb-ya)
            for x in (la+(lb-la)*t+0.18,ra+(rb-ra)*t-0.18):
                g.box(EDGE,(x-0.12,y-0.18,0),(x+0.12,y+0.18,levels[-1]-0.19))


def build_block(coll):
    data=json.loads((Path(__file__).resolve().parents[1]/'data/campus.json').read_text())
    shape=next(b['poly'][:-1] for b in data['buildings'] if b['record']=='w1165596688@1')
    poly=orient(Polygon(shape),sign=1)
    ring=list(poly.exterior.coords)[:-1]
    o=b_yihao.Out()
    kit.MATERIALS[ROSE]=((0.66,0.48,0.423),0.85,0,{})
    shell=o.geo('mapped_plates','public-map/estimated','Published OSM w1165596688@1 includes three offset bars, projecting returns and one longitudinal spine. Five occupied levels estimated from the local building catalogue. Numbering within this compound is unresolved.')
    courts=o.geo('gallery_edges','estimated','campus_sanhao_sihao shows open rectangular gallery ends, pale soffits, slim metal rails and warm solid piers. The photograph labels a science activity centre. Its location within this mapped complex is unconfirmed.')
    o.geo('rooms','estimated','Room apertures and door positions interpolated along mapped elevations. campus_sanhao_sihao used as a family resemblance only.')
    o.protos['window']=arch.window_unit(2.44,1.74,cols=3,interior=None,frame_mat=METAL,glass_mat='atelier.glass.shadow',transom=0.71)
    o.protos['landing']=arch.window_unit(1.12,1.91,cols=2,interior=None,frame_mat=METAL,glass_mat='atelier.glass.sea')
    o.protos['door']=arch.window_unit(1.30,2.21,cols=2,interior=None,frame_mat=METAL,glass_mat='atelier.glass.shadow',sill=0)
    # Confine backing to each aperture. The generic oversize reveal projects through the
    # adjacent terracotta face at the narrow returns of the mapped plan.
    for name,w,h in (('window',2.44,1.74),('landing',1.12,1.91),('door',1.30,2.21)):
        o.protos[name].box('interior.dark',(0.018,0.69,0.018),(w-0.018,0.72,h-0.018))
    levels=(0,3.8,7.24,10.68,14.12,17.56)
    deck(shell,ring,levels[-1],'atelier.erhao.roof',0.19)
    deck(shell,ring,0,'stone.granite.grey',0.30)
    bridges(o,poly,levels)
    for a,b in split_spine(ring):
        dx,dy=b[0]-a[0],b[1]-a[1]
        L=math.hypot(dx,dy)
        nx,ny=dy/L,-dx/L
        ymid=(a[1]+b[1])/2
        is_bridge=min(a[0],b[0])>-30 and abs(nx)>0.95 and any(ya<ymid<yb for ya,yb in BRIDGE_SPANS)
        if is_bridge:
            continue
        gallery=abs(ny)>0.92 and L>21 and (ny>0 or -159<ymid<-120)
        coloured_pier=L<8 and abs(nx)>0.90 and a[0]<-30 and b[0]<-30
        back=2.00 if gallery else 0
        p=(a[0]-nx*back,a[1]-ny*back)
        q=(b[0]-nx*back,b[1]-ny*back)
        n=max(1,round(L/4.35))
        pitch=L/n
        for st,(z,top) in enumerate(zip(levels,levels[1:])):
            holes=[]
            for i in range(n):
                x=(i+0.5)*pitch
                if coloured_pier or (abs(nx)>0.9 and L<5.0):
                    continue
                if pitch>3.80 and gallery:
                    holes.extend([(x-1.65,x-0.35,z,z+2.21,'door'),(x+0.23,x+1.35,z+0.65,z+2.56,'landing')])
                elif pitch>2.84:
                    holes.append((x-1.22,x+1.22,z+0.90,z+2.64,'window'))
            b_yihao.facade(o,'rooms',p,q,z,top,holes,mat=ROSE if coloured_pier else WALL,t=0.24)
            if gallery:
                if st:
                    courts.polyn(EDGE,[(*a,z),(*b,z),(*q,z),(*p,z)],(0,0,1))
                    arch.railing(courts,[(*a,z),(*b,z)],h=1.05,mat=METAL,post=1.40,bars=0.13,
                                 bar_w=0.016,rail=0.042)
                if top<levels[-1]:
                    courts.polyn(EDGE,[(*a,top-0.19),(*b,top-0.19),(*q,top-0.19),(*p,top-0.19)],(0,0,-1))
                courts.polyn(EDGE,[(*a,top-0.19),(*b,top-0.19),(*b,top),(*a,top)],(nx,ny,0))
        if gallery:
            for i in range(n+1):
                t=max(0.008,min(0.992,i/n))
                x=a[0]+dx*t; y=a[1]+dy*t
                courts.box(EDGE,(x-0.145,y-0.25,0),(x+0.145,y+0.05,levels[-1]-0.19))
        b_yihao.local(o,'mapped_plates',a,b,lambda g,length,M:
                      arch.band(g,EDGE,0,length,levels[-1]-0.04,levels[-1]+0.43,0.085))
    yard=o.geo('court_floors','estimated','Outdoor surfacing and planting inferred within the two mapped open courts. No identifying lettering reproduced.')
    for ya,yb in ((-145.6,-125.0),(-175.4,-157.1)):
        yard.box('atelier.court.paving',(-63.3,ya,-0.14),(-26.2,yb,0.012))
        for i in range(9):
            x=-62.9+i*3.9
            yard.box('kerb.granite',(x,ya,0.014),(x+0.19,yb,0.021))
        for xa,xb in ((-58,-48),(-45.4,-37.9)):
            yard.box('kerb.granite',(xa,ya+4.3,0.012),(xb,yb-3.9,0.12))
            yard.box('atelier.court.lawn',(xa+0.10,ya+4.4,0.118),(xb-0.10,yb-4.0,0.13))
            rng=random.Random(round(100*xa+yb))
            for i in range(20):
                leaves(yard,(xa+0.38+(xb-xa-0.76)*i/19,ya+4.70,0.56),(0.44,0.36,0.39),95,rng)
            palm(yard,(xa+xb)/2,0.54*ya+0.46*yb,0.13,6.9+rng.random()*2.4,rng.randrange(10000))
    build.instantiate('south_classrooms',o,coll,Matrix.Translation((0,0,0.17)))
