"""Science and chemistry block south of Block 2, including its mapped western return."""
import json
import math
from pathlib import Path
from mathutils import Matrix
from shapely.geometry import Polygon
from shapely.geometry.polygon import orient
from shapely import constrained_delaunay_triangles
import arch
import b_yihao
import build
import kit
from atelier_court import METAL, palm

WALL='atelier.erhao.ceramic'
WHITE='atelier.science.coping'
SCREEN='atelier.science.screen'
GLASS='atelier.glass.shadow'
TOP=21.05


def deck(g,ring,z,mat,thickness):
    """Triangulate the concave mapped plates before constructing soffit and fascia."""
    poly=Polygon(ring)
    triangles=constrained_delaunay_triangles(poly).geoms
    assert abs(sum(t.area for t in triangles)-poly.area)<1e-5
    for tri in triangles:
        a,b,c=list(tri.exterior.coords)[:3]
        g.polyn(mat,[(*p,z) for p in (a,b,c)],(0,0,1))
        g.polyn(mat,[(*p,z-thickness) for p in (a,b,c)],(0,0,-1))
    for a,b in zip(ring,ring[1:]+ring[:1]):
        g.polyn(mat,[(*a,z-thickness),(*b,z-thickness),(*b,z),(*a,z)],(b[1]-a[1],a[0]-b[0],0))


def build_block(coll):
    data=json.loads((Path(__file__).resolve().parents[1]/'data/campus.json').read_text())
    ring=next(b['poly'][:-1] for b in data['buildings'] if b['record']=='w1165596687@1')
    ring=list(orient(Polygon(ring),sign=1).exterior.coords)[:-1]
    for key,col,r,m in ((WHITE,(0.76,0.75,0.69),0.76,0),(SCREEN,(0.23,0.215,0.20),0.62,0.22),
                        ('atelier.science.awning',(0.34,0.42,0.33),0.64,0.18)):
        kit.MATERIALS[key]=(col,r,m,{})
    o=b_yihao.Out()
    o.protos['classroom']=arch.window_unit(2.25,1.68,cols=3,frame_mat=METAL,glass_mat=GLASS,
        bars=0.81,transom=0.70,mull=0.028)
    o.protos['gallery_light']=arch.window_unit(1.65,1.51,cols=2,frame_mat=METAL,glass_mat='atelier.glass.sea',bars=0.60)
    o.protos['door']=arch.window_unit(1.35,2.24,cols=2,frame_mat=METAL,glass_mat=GLASS,sill=0)
    shell=o.geo('mapped_roof','public-map/estimated','OSM w1165596687@1 polygon, including its west wing and projecting north bay. Roof finish, parapet height and six-storey datum estimated from aerial_campus and campus_kexue.')
    # Narrow west return and the large asymmetric central projection share one mapped roof.
    deck(shell,ring,TOP,'roof.flat.grey',0.22)
    positions=[0,3.8,7.25,10.7,14.15,17.6,TOP]
    galleries=o.geo('north_gallery','photo-derived/estimated','campus_kexue shows continuous pale gallery fascias, exposed upper rails, barred recessed windows, shaded ground floor and dark screens. The broad northern band is visible in aerial_campus. Exact correspondence of bays inferred.')
    other='return_elevations'
    o.geo(other,'estimated','Window spacing on east and west returns, rear and chemistry wing inferred within the published footprint.')
    northwall='gallery_back'
    o.geo(northwall,'photo-derived/estimated','Six levels with classroom lights set behind the circulation edge. Door rhythm and gallery depth interpolated from campus_kexue.')
    for a,b in zip(ring,ring[1:]+ring[:1]):
        dx,dy=b[0]-a[0],b[1]-a[1]
        length=math.hypot(dx,dy)
        nx,ny=dy/length,-dx/length
        is_gallery=min(a[0],b[0])>=-15.5 and ny>0.16 and min(a[1],b[1])>-90
        for z0,z1 in zip(positions,positions[1:]):
            if is_gallery:
                def railing(g,L,M):
                    if z0:
                        arch.band(g,WHITE,0,L,z0-0.22,z0+0.67,0.14)
                        arch.railing(g,[(0,0.015,z0+0.65),(L,0.015,z0+0.65)],h=0.40,
                                     mat=METAL,rail=0.032,post=1.42,bars=0,bar_w=0.024)
                    else:
                        arch.band(g,WHITE,0,L,z1-0.52,z1-0.18,0.12)
                b_yihao.local(o,'north_gallery',a,b,railing)
                # Keep the recess shallow around the projecting central bay.
                back_a=(a[0],a[1]-2.15)
                back_b=(b[0],b[1]-2.15)
                if z0:
                    galleries.polyn(WHITE,[(*a,z0),(*b,z0),(*back_b,z0),(*back_a,z0)],(0,0,1))
                if z1<TOP:
                    galleries.polyn(WHITE,[(*a,z1-0.22),(*b,z1-0.22),(*back_b,z1-0.22),(*back_a,z1-0.22)],(0,0,-1))
                bays=max(1,round(length/4.8))
                pitch=length/bays
                holes=[]
                for i in range(bays):
                    x=(i+0.5)*pitch
                    if pitch>3.85:
                        holes.extend([(x-1.68,x-0.33,z0,z0+2.24,'door'),
                                      (x+0.11,x+1.76,z0+0.87,z0+2.38,'gallery_light')])
                    elif pitch>1.86:
                        holes.append((x-0.825,x+0.825,z0+0.87,z0+2.38,'gallery_light'))
                b_yihao.facade(o,northwall,back_a,back_b,z0,z1,holes,mat=WALL)
            else:
                slots=max(1,round(length/4.1))
                openings=[]
                if length/slots>2.67:
                    for k in range(slots):
                        cx=(k+0.5)*length/slots
                        openings.append((cx-1.125,cx+1.125,z0+0.82,z0+2.50,'classroom'))
                b_yihao.facade(o,other,a,b,z0,z1,openings,mat=WALL)
        arch.railing(shell,[(*a,TOP),(*b,TOP)],h=0.46,rail=0.09,mat=WHITE,bars=0,post=2.0)
        if is_gallery:
            n=max(1,round(length/4.35))
            for i in range(n):
                x=a[0]+(i/n)*dx; y=a[1]+(i/n)*dy
                galleries.box(WHITE,(x-0.16,y-0.30,0),(x+0.16,y+0.04,TOP))
    core=o.geo('shaded_landings','photo-derived/estimated','Dark stacked panels and higher white stair cap on campus_kexue and aerial_campus. Slats, fasteners and cap section interpreted.')
    cx,cy=35.15,-78.52
    for level,z in enumerate(positions[1:-1],1):
        for j in range(12):
            zz=z+0.99+j*0.175
            core.box(SCREEN,(cx-2.92,cy-0.02,zz),(cx+2.92,cy+0.14,zz+0.085))
        for x in (cx-2.93,cx,cx+2.93):
            core.box(METAL,(x-0.037,cy-0.15,z+0.68),(x+0.037,cy-0.06,z+3.14))
    for x in (cx-3.13,cx+3.13):
        core.box(WHITE,(x-0.14,cy-6.6,TOP),(x+0.14,cy-1.9,TOP+1.75))
    core.box(WALL,(cx-3.1,cy-6.5,TOP),(cx+3.1,cy-2.05,TOP+1.45))
    core.box(WHITE,(cx-3.5,cy-6.9,TOP+1.45),(cx+3.5,cy-1.62,TOP+1.69))
    for x in (cx-2.7,cx+2.7):
        core.cylinder(METAL,(x,cy-4.1),0.056,TOP+1.69,TOP+2.73,seg=8)
    for i in range(8):
        x=-13+i*9
        core.box('atelier.science.awning',(x,-91.55,2.60),(x+3.15,-90.48,2.72))
    garden=o.geo('science_court','estimated','campus_kexue shows a low lawn, forecourt walk and green awnings. Extents and planting positions between Block 2 and the science hall inferred.')
    garden.box('atelier.court.paving',(-15,-90,-0.14),(59,-57.2,-0.001))
    for left,right in ((-9.7,12.0),(16.1,39.8),(43.8,54.5)):
        garden.box('kerb.granite',(left,-74.5,-0.003),(right,-62.5,0.087))
        garden.box('atelier.court.lawn',(left+0.13,-74.37,0.085),(right-0.13,-62.63,0.10))
    for i,(x,y) in enumerate(((48,-69),(53,-67.2),(-4,-69))):
        palm(garden,x,y,0.10,5.6+i*0.64,663+i)
    # The pad covers the mapped building and supports it at local courtyard level.
    deck(shell,ring,0,'stone.granite.grey',0.32)
    build.instantiate('science',o,coll,Matrix.Translation((0,0,0.16)))
