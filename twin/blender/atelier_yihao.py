"""Editable architectural details for Block 1. All coordinates are building-local metres."""
import math

import arch
import kit
from mathutils import Vector

WHITE = 'trim.white'
PLASTER = 'atelier.yihao.render'
SHADOW = 'atelier.yihao.rebate'
STONE = 'atelier.yihao.floor'
FRAME = 'atelier.sash.charcoal'


def register_materials():
    for name, color, rough, metallic in (
        (PLASTER,(0.77,0.756,0.71),0.83,0),
        (SHADOW,(0.51,0.52,0.49),0.78,0),
        (STONE,(0.31,0.335,0.308),0.25,0.05),
        ('atelier.yihao.floor.light',(0.36,0.375,0.35),0.27,0.03),
        ('atelier.yihao.lamp',(0.89,0.855,0.71),0.47,0),
        ('atelier.yihao.gasket',(0.16,0.17,0.17),0.72,0),
        ('atelier.yihao.accent',(0.42,0.34,0.25),0.60,0),
    ):
        kit.MATERIALS[name] = (color,rough,metallic,{})


def crown_panel(g, length, top):
    """scenery_15 shows a projecting tablet with an inset field on the tower."""
    cx = length/2
    w = min(length*0.61,3.25)
    a,b = cx-w/2,cx+w/2
    low,high = top-2.36,top-0.24
    g.box(PLASTER,(a,-0.29,low),(b,0.13,high))
    for z in (low+0.14,high-0.19):
        g.box(WHITE,(a+0.13,-0.33,z),(b-0.13,-0.285,z+0.065))
    for x in (a+0.13,b-0.19):
        g.box(WHITE,(x,-0.33,low+0.2),(x+0.06,-0.285,high-0.19))
    arch.cornice(g,WHITE,a-0.09,b+0.09,high,[(0,0),(-0.34,0),(-0.39,0.08),(-0.39,0.14),(0,0.14)])


def corbel(g,x,z,scale=1):
    # A concave soffit carries the projecting shelf; the square foot reads in side light.
    prof = [(0,-0.50),(-0.23,-0.50),(-0.25,-0.43),(-0.26,-0.36),
            (-0.31,-0.30),(-0.42,-0.25),(-0.55,-0.22),(-0.57,-0.14),
            (-0.64,-0.14),(-0.64,0.02),(0,0.02)]
    arch.cornice(g,WHITE,x-0.20*scale,x+0.20*scale,z,
                 [(y*scale,h*scale) for y,h in prof])


def wing_roof(g, xa, xb, y0, y1, eave, roof):
    """Continuous long tile fields against the taller masses, as seen from above."""
    over=roof['overhang']
    # End overhang is limited at the adjoining raised roof blocks.
    xa,xb=xa-0.08,xb+0.08
    mid=(y0+y1)/2
    rise=(mid-y0+over)*math.tan(math.radians(roof['pitch']))
    for edge in (y0-over,y1+over):
        end=(xa,edge,eave)
        outward=1 if edge>mid else -1
        g.polyn('roof.tile.red',[end,(xb,edge,eave),(xb,mid,eave+rise),(xa,mid,eave+rise)],(0,outward,1))
        g.box(WHITE,(xa,min(edge,edge-outward*0.21),eave-0.22),
                    (xb,max(edge,edge-outward*0.21),eave))
        wall = y1 if outward>0 else y0
        g.polyn(WHITE,[(xa,wall,eave-0.22),(xb,wall,eave-0.22),
                       (xb,edge,eave-0.22),(xa,edge,eave-0.22)],(0,0,-1))
        # Parallel half-round cover tiles keep their width all the way to the ridge.
        e0,e1=Vector((xa,edge,eave)),Vector((xb,edge,eave))
        r0,r1=Vector((xa,mid,eave+rise)),Vector((xb,mid,eave+rise))
        arch._tile_rows(g,[[e0,e1],[r0,r1]],'roof.tile.red',0.22)
    for x,n in ((xa,-1),(xb,1)):
        g.polyn(PLASTER,[(x,y0-over,eave),(x,mid,eave+rise),(x,y1+over,eave)],(n,0,0))
    arch._ridge(g,WHITE,Vector((xa,mid,eave+rise)),Vector((xb,mid,eave+rise)),0.20,0.13)


def courtyard_wing(out, part, xa, xb, y, ztop, link, lvl, facade):
    """Retain an estimated enclosed courtyard wall; replace windows facing bridge decks with openings."""
    axis = next(x for x in link['x_centres'] if xa<x<xb)
    length=xb-xa
    side=part+'_rear'
    basis='South wing window pattern and gallery depth inferred. Link centreline and width inherited from mapped roof; decks meet real mesh openings.'
    g=out.geo(side,'public-map/invented',basis)
    half=link['width']/2-0.34
    windows=[]
    for st in range(1,7):
        z=lvl(st)
        if st<=5:
            windows.append((axis-xa-half,axis-xa+half,z,z+2.75,None))
        for bay in range(6):
            x=xa+(bay+0.5)*length/6
            if st<=5 and abs(x-axis)<half+1.22:
                continue
            windows.append((x-xa-1.2,x-xa+1.2,z+0.9,z+2.5,'w_rear'))
    facade(out,side,(xa,y),(xb,y),0,ztop,windows,mat=PLASTER,t=0.28)
    for st in range(1,7):
        z=lvl(st)
        g.box('interior.floor',(xa,y,z-0.14),(xb,y+2.45,z))
        g.box('interior.ceiling',(xa,y+0.22,lvl(st+1)-0.19),(xb,y+2.45,lvl(st+1)-0.14))
        g.box(PLASTER,(xa,y+2.41,z),(xb,y+2.49,lvl(st+1)-0.18))
        g.box(WHITE,(xa,y-0.08,z-0.12),(xb,y+0.03,z+0.04))
    arch.flat_roof(g,[(xa,y),(xb,y),(xb,y+0.61),(xa,y+0.61)],ztop,parapet_h=0)


def through_hall(out, model):
    g=out.geo('hall_finishes','photo-derived/estimated',
        'scenery_17 shows a polished gridded floor, dark skirting, large framed wall work, pale columns, crossed ceiling beams and square lamps facing a windowed court. Assignment, depths, finish pattern and fixture spacing inferred.')
    hall=model.SPEC['porch']['through_hall']['x'][1]
    rear,front=model.PARTS['central']['y']
    nx,ny=12,9
    for i in range(nx):
        for j in range(ny):
            x=-hall+i*2*hall/nx; y=rear+j*(front-rear)/ny
            m='atelier.yihao.floor.light' if (i*19+j*7+i*j)%11<3 else STONE
            g.box(m,(x+0.002,y+0.002,0.002),(x+2*hall/nx-0.002,y+(front-rear)/ny-0.002,0.018),skip=('-z',))
    for sign in (-1,1):
        x=sign*hall
        a,b=sorted((x,x-sign*0.056))
        g.box(STONE,(a,rear,0.018),(b,front,0.29))
    for y in (rear+0.16,-6.94,-3.47,-0.18):
        g.box(WHITE,(-hall,y-0.14,3.87),(hall,y+0.14,4.19))
    for x in (-3.6,3.6):
        g.box(WHITE,(x-0.13,rear,3.93),(x+0.13,front,4.185))
    for x in (-5.36,0,5.36):
        for y in (-8.6,-5.2,-1.9):
            g.box(FRAME,(x-0.245,y-0.245,4.075),(x+0.245,y+0.245,4.175))
            g.box('atelier.yihao.lamp',(x-0.206,y-0.206,4.065),(x+0.206,y+0.206,4.077))
            for dy in (-0.077,0.077):
                g.box(FRAME,(x-0.21,y+dy-0.012,4.052),(x+0.21,y+dy+0.012,4.067))
    # Physically model the frame, backing and mat. The original wall artwork is not reproduced.
    x=hall-0.083
    a,b=rear+1.26,front-1.32
    g.box('atelier.yihao.accent',(x-0.012,a,0.88),(x+0.06,b,2.92))
    for z in (0.84,2.92):
        g.box(FRAME,(x-0.05,a-0.04,z),(x+0.075,b+0.04,z+0.047))
    for y in (a-0.04,b):
        g.box(FRAME,(x-0.05,y,0.88),(x+0.075,y+0.04,2.92))


def enrich(out, model):
    import atelier_court
    atelier_court.register()
    atelier_court.link_details(out,model.SPEC['links'],model.lvl)
    through_hall(out,model)
    A=model.ARCH
    out.protos['w_arch']=arch.window_unit(A['w'],A['h'],cols=2,arch=True,
        frame_mat=FRAME,glass_mat='atelier.glass.sea',frame=0.045,mull=0.028)
    for h in (0.34*A['h'],0.63*A['h']):
        out.protos['w_arch'].box(FRAME,(0.04,0.098,h),(A['w']-0.04,0.146,h+0.034))


def central_roof(out,xa,xb,y0,y1,zt):
    from mathutils import Matrix
    g=out.geo('roof_central','photo-derived/estimated',
        'aerial_campus shows an east-west ridge about half the eave length. The aligned aerial layer suggests a 1.2 degree bearing against the site X axis. scenery_15 constrains the depth of the shadow frieze and the upright tips. Pitch, local yaw and hidden returns inferred.')
    eave=zt+1.97
    g.box(PLASTER,(xa,y0,zt),(xb,y1,eave-0.62))
    g.box(SHADOW,(xa+0.07,y0+0.07,eave-0.62),(xb-0.07,y1-0.07,eave-0.23))
    g.box(WHITE,(xa-0.12,y0-0.12,eave-0.27),(xb+0.12,y1+0.12,eave-0.07))
    # Recess the bed of the eave and carry the projecting shelf on aligned corbels.
    for i in range(9):
        x=xa+1.05+i*(xb-xa-2.1)/8
        for front in (True,False):
            y=y1 if front else y0
            local=kit.Geo()
            corbel(local,0,eave-0.19,0.98)
            turn=math.pi if front else 0
            g.merge(local,Matrix.Translation((x,y,0))@Matrix.Rotation(turn,4,'Z'))
    skin=kit.Geo()
    arch.hip_roof(skin,xa,y0,xb,y1,eave,29.0,overhang=1.2,concave=0.148,
                  upturn=0.35,kick=0.12,ridge_mat=WHITE,ridge_ends=0.43,ridge_h=0.16,
                  hip_run=6.44,main_ridge_axis='x',fascia_h=0.38,closed_corners=True)
    pivot=Vector((0,(y0+y1)/2,0))
    g.merge(skin,Matrix.Translation(pivot)@Matrix.Rotation(math.radians(1.2),4,'Z')@Matrix.Translation(-pivot))
