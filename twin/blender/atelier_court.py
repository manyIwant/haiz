"""The court looking south from the Block 1 hall (scenery_17 and campus_erhao)."""
import math
import random
from mathutils import Vector
import arch
import kit

TILE='atelier.erhao.ceramic'
EDGE='atelier.erhao.coping'
SEAM='atelier.court.joint'
METAL='atelier.court.zinc'


def register():
    for key,color,r,metal in (
        (SEAM,(0.28,0.29,0.265),0.86,0),(METAL,(0.52,0.54,0.50),0.48,0.32),
        ('atelier.court.lawn',(0.28,0.375,0.17),0.93,0),
        ('atelier.court.bark',(0.34,0.31,0.245),0.93,0),
        ('atelier.court.leaf0',(0.18,0.315,0.115),0.79,0),
        ('atelier.court.leaf1',(0.255,0.40,0.145),0.75,0),
        ('atelier.court.leaf2',(0.345,0.45,0.18),0.78,0),
    ):
        kit.MATERIALS[key]=(color,r,metal,{})


def ground_arcade(out,left,right,front,count):
    from b_yihao import facade
    part='undercroft'
    g=out.geo(part,'photo-derived/estimated','scenery_17 shows a deep covered ground floor across the court with independent supports and openings behind. Width, column rhythm and rear infill inferred.')
    depth=3.85
    holes=[]
    w=(right-left)/count
    floor=-0.855
    for i in range(count):
        cx=(i+0.5)*w
        holes.append((cx-0.725,cx+0.725,floor,floor+2.25,'door') if i%3==0 else
                     (cx-1.10,cx+1.10,floor+0.95,floor+2.58,'room'))
    a,b=front(left),front(right)
    facade(out,part,(right,b-depth),(left,a-depth),floor,4.0,holes,mat=TILE)
    g.box('interior.ceiling',(left,min(a,b)-depth,3.69),(right,max(a,b)+0.09,3.98))
    g.box(EDGE,(left,min(a,b)-depth,floor-0.045),(right,max(a,b)+0.37,floor))
    for i in range(count+1):
        x=left+i*w
        if i==0 or i==count: x+=0.20 if i==0 else -0.20
        y=front(x)-0.24
        g.box(TILE,(x-0.22,y-0.24,floor),(x+0.22,y+0.24,3.69))
        g.box(SEAM,(x-0.227,y-0.247,floor),(x+0.227,y+0.247,floor+0.24))
    g.box(EDGE,(left,min(a,b)-0.13,3.44),(right,max(a,b)+0.09,3.73))


def condenser(g,cx,cy,cz):
    """Recessed fan grille, service cover, brackets and drain below the classroom light."""
    casing='atelier.ac'
    g.box(casing,(cx-0.44,cy-0.20,cz-0.26),(cx+0.44,cy+0.15,cz+0.26))
    face=cy+0.158
    x=cx-0.12
    pts=[(x+0.199*math.cos(i*math.tau/20),face,cz+0.199*math.sin(i*math.tau/20)) for i in range(20)]
    g.polyn(SEAM,pts,(0,1,0))
    for j in range(-4,5):
        dz=j*0.040
        half=math.sqrt(0.196**2-dz*dz)
        g.box(METAL,(x-half,face,cz+dz-0.006),(x+half,face+0.014,cz+dz+0.006))
    for dx in (-0.30,0.30):
        g.box(METAL,(cx+dx-0.023,cy-0.25,cz-0.293),(cx+dx+0.023,cy+0.125,cz-0.26))
    g.box(METAL,(cx+0.17,face,cz-0.21),(cx+0.19,face+0.009,cz+0.21))


def link_details(out, spec, lvl):
    g=out.geo('link_structure','photo-derived/estimated','Five open levels and repeated square pier/beam rhythm on the perpendicular gallery in campus_erhao. Roof axes from the map. Count, downpipes, slab seams and soffit fittings inferred.')
    ya,yb=spec['y']
    for xc in spec['x_centres']:
        for sign in (-1,1):
            x=xc+sign*(spec['width']/2-0.23)
            for j in range(1,6):
                y=ya+(yb-ya)*j/6
                # The inherited central pier is retained.
                if j!=3:
                    g.box(TILE,(x-0.18,y-0.24,-0.855),(x+0.18,y+0.24,lvl(6)-0.4))
                for st in range(2,6):
                    z=lvl(st)
                    g.box(EDGE,(x-0.23,y-0.29,z-0.50),(x+0.23,y+0.29,z-0.34))
            for st in range(2,6):
                z=lvl(st); a=xc+sign*(spec['width']/2-0.10)
                g.box(EDGE,(a-0.135,ya,z+1.046),(a+0.135,yb,z+1.105))
                g.box(SEAM,(a-0.115,ya,z-0.12),(a+0.115,yb,z-0.088))
            py=ya+(yb-ya)/6
            g.cylinder(METAL,(x+sign*0.22,py+0.30),0.057,-0.66,lvl(6)-0.21,seg=10)
        for j in range(1,6):
            y=ya+(yb-ya)*j/6
            for st in range(2,7):
                z=lvl(st)
                g.box(EDGE,(xc-spec['width']/2+0.12,y-0.15,z-0.61),
                           (xc+spec['width']/2-0.12,y+0.15,z-0.4))


def stem(g,a,b,r0,r1):
    a,b=Vector(a),Vector(b)
    axis=(b-a).normalized()
    u=axis.cross(Vector((1,0,0))).normalized()
    v=axis.cross(u)
    prev=None
    for j in range(8):
        t=j*math.tau/7
        n=u*math.cos(t)+v*math.sin(t)
        pair=(a+n*r0,b+n*r1)
        if prev:
            g.polyn('atelier.court.bark',[prev[0],pair[0],pair[1],prev[1]],n)
        prev=pair


def leaves(g,origin,radii,n,rng):
    cx,cy,cz=origin
    for _ in range(n):
        ang=rng.uniform(0,math.tau); elev=rng.uniform(-0.9,1.0)
        r=rng.random()**0.35
        horizontal=r*math.sqrt(1-elev*elev)
        p=Vector((cx+radii[0]*math.cos(ang)*horizontal,cy+radii[1]*math.sin(ang)*horizontal,cz+radii[2]*r*elev))
        turn=ang+rng.uniform(-1.1,1.1)
        main=Vector((math.cos(turn),math.sin(turn),rng.uniform(-0.46,0.40)))*rng.uniform(0.09,0.17)
        side=Vector((-main.y,main.x,0))*rng.uniform(0.29,0.45)
        mid=p+main*0.54
        m='atelier.court.leaf'+str(rng.choice((0,1,1,2)))
        ridge=mid+Vector((0,0,0.019))
        for pts in ([p,mid-side,ridge],[mid-side,p+main,ridge],[p+main,mid+side,ridge],[mid+side,p,ridge]):
            g.polyn(m,pts,(0,0,1))


def landscape(out):
    g=out.geo('courtyard_garden','photo-derived/estimated','scenery_17 shows rectangular lawns, clipped hedges, intersecting paving and small trees seen through the hall. Dimensions, species and individual plants inferred.')
    rng=random.Random(1702)
    z=-0.855
    for xa,xb in ((-18.6,-2.5),(2.5,18.6)):
        for ya,yb in ((-38.7,-29.0),(-26.2,-16.7)):
            g.box(EDGE,(xa,ya,z-0.039),(xb,yb,z+0.08))
            g.box('atelier.court.lawn',(xa+0.105,ya+0.105,z+0.075),(xb-0.105,yb-0.105,z+0.10))
            y=yb-0.42 if ya<-28 else ya+0.42
            for i in range(32):
                x=xa+0.4+(xb-xa-0.8)*i/31
                leaves(g,(x,y,z+0.36),(0.36,0.32,0.26),125,rng)
            x=(xa+xb)/2+rng.uniform(-2,2); y=(ya+yb)/2
            h=rng.uniform(3.7,5.1)
            fork=Vector((x+0.12,y-0.09,z+h*0.44))
            stem(g,(x,y,z+0.07),fork,0.10,0.062)
            for j in range(8):
                a=j*math.tau/8+rng.uniform(-0.2,0.2); reach=rng.uniform(0.78,1.55)
                mid=fork+Vector((0.54*reach*math.cos(a),0.54*reach*math.sin(a),h*0.20))
                tip=mid+Vector((0.50*reach*math.cos(a),0.50*reach*math.sin(a),h*rng.uniform(0.16,0.36)))
                stem(g,fork,mid,0.045,0.030);stem(g,mid,tip,0.03,0.009)
                leaves(g,tip,(0.80,0.71,0.68),330,rng)
    for y in (-40.2,-14.8):
        g.box(SEAM,(-21,y,z-0.025),(21,y+0.10,z-0.019))


def palm(g,x,y,z,height,seed):
    """Curving ring-scarred bole; each arching frond carries two ranks of folded pinnae."""
    rng=random.Random(seed)
    lean=rng.uniform(-0.42,0.42)
    prev=Vector((x,y,z))
    for j in range(1,22):
        t=j/21
        at=Vector((x+lean*t*t,y+0.26*t*t,z+height*t))
        r=0.13+0.06*(1-t)**2
        stem(g,prev,at,r+0.008,r)
        if j<18:
            g.cylinder('atelier.court.bark',(at.x,at.y),r+0.016,at.z-0.032,at.z,seg=11,r1=r+0.005)
        prev=at
    for j in range(19):
        a=j*2.39996+rng.uniform(-0.22,0.22)
        u=Vector((math.cos(a),math.sin(a),0))
        v=Vector((-u.y,u.x,0))
        L=rng.uniform(2.16,3.23)
        rise=rng.uniform(1.32,2.83)
        drop=rng.uniform(0.95,2.52)
        old=prev
        for k in range(1,19):
            t=k/18
            mid=prev+u*L*t+Vector((0,0,rise*t-drop*t*t))
            stem(g,old,mid,0.032*(1-t)+0.004,0.025*(1-t)+0.003)
            for sign in (-1,1):
                leaf=(0.17+0.62*math.sin(math.pi*t)**0.7)*rng.uniform(0.86,1.1)
                tip=mid+leaf*(sign*v*0.80+0.45*u+Vector((0,0,-0.65)))
                rib=mid.lerp(tip,0.55)+Vector((0,0,0.075))
                width=u*(0.033+0.029*math.sin(math.pi*t))
                mat='atelier.court.leaf'+str((j+k//6)%3)
                g.polyn(mat,[mid,rib+width,tip,rib],(0,0,1))
                g.polyn(mat,[mid,rib,tip,rib-width],(0,0,1))
            old=mid
