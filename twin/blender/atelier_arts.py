"""Arts centre. The legacy portico and garden are kept as an independent source asset."""
import json
import math
import tempfile
from pathlib import Path
from mathutils import Vector, Matrix
import arch
import build
import kit
from b_yihao import Out

DATA = json.loads((Path(__file__).resolve().parents[1]/'evidence/calibration/arts_roofs.json').read_text())
UP = Vector((0, 0, 1))
TERRA = 'arts.ceramic.'
WHITE = 'wall.render.white'
CAP = 'arts.lime_coping'
REVEAL = 'arts.window_return'
FRAME = 'frame.alu.brown'
DECK = 'arts.weathered_roof'


def register():
    for key, color, rough in [
        ('body', (.715,.254,.201), .74), ('warm', (.754,.308,.235), .72),
        ('shade', (.692,.257,.200), .76), ('cover', (.744,.285,.220), .68),
        ('hip', (.635,.239,.189), .71)
    ]:
        kit.MATERIALS[TERRA+key] = (color,rough,0,{})
    kit.MATERIALS['arts.recess_glass']=((.175,.237,.231),.29,.14,{})
    for key,color in [(CAP,(.80,.785,.745)),(REVEAL,(.38,.365,.343)),(DECK,(.54,.548,.52))]:
        kit.MATERIALS[key] = (color,.85,0,{})


def xy(pixel, height):
    r = DATA['raster']
    u,v = pixel
    x,y = r['origin_twin']
    u0,v0 = r['origin_at_pixel']
    sx,sy = r['estimated_lean_per_metre']
    return Vector((x+(u-u0)/r['pixels_per_metre']-sx*height,
                   y+(v0-v)/r['pixels_per_metre']-sy*height,0))


def normal(direction):
    return Vector((-direction.y,direction.x,0))


def roof_slope(g, a,b, c,d):
    """Eave a-b to ridge c-d. Course ends follow the valley and hip mitres."""
    run = abs((c-a).dot(normal((b-a).normalized())))
    n = max(4,round(run/.35))
    rows=[]
    for i in range(n+1):
        t=i/n
        sag=.075*math.sin(math.pi*t)
        rows.append([a.lerp(c,t)-UP*sag,b.lerp(d,t)-UP*sag])
    for i, (low,high) in enumerate(zip(rows,rows[1:])):
        count=max(1,round((b-a).length/1.75))
        for j in range(count):
            v=((i*37+j*73+i*j*13)%101)
            mat='warm' if v<17 else 'shade' if v>87 else 'body'
            t0=j/count; t1=(j+1)/count
            lift=UP*.014
            g.polyn(TERRA+mat,[low[0].lerp(low[1],t0)+lift,low[0].lerp(low[1],t1)+lift,
                               high[0].lerp(high[1],t1),high[0].lerp(high[1],t0)],UP)
        g.polyn(TERRA+'shade',[low[0],low[1],low[1]+UP*.014,low[0]+UP*.014],(a-c))
    # Start the clips at the wide end, including the infill beside an inside corner.
    if (d-c).length>(b-a).length: rows.reverse()
    arch._parallel_cover_tiles(g,rows,TERRA+'cover',.218)


def outer_edge(g,a,b,side):
    section=[(-.10,-.32),(.03,-.32),(.035,-.20),(.085,-.18),(.085,-.09),(.045,-.07),(.045,0),(-.10,0)]
    for (dx,z),(dx1,z1) in zip(section,section[1:]):
        g.polyn(CAP,[a+side*dx+UP*z,b+side*dx+UP*z,b+side*dx1+UP*z1,a+side*dx1+UP*z1],
                side*(z1-z)+UP*(dx-dx1))


def wall(g,a,b,h, narrow=False):
    """Pier, deep punched plaster opening, coloured glazing, mullion and individual sill."""
    length=(b-a).length
    if length<.5: return
    u=(b-a).normalized(); v=normal(u)
    def box(mat,l,r,back,front,bottom,top):
        g.obox(mat,a+u*((l+r)/2)+v*((front+back)/2)+UP*((top+bottom)/2),
               (u,v,UP),((r-l)/2,(front-back)/2,(top-bottom)/2))
    bays=max(1,round(length/(4.15 if narrow else 4.65)))
    span=length/bays
    box(REVEAL,0,length,-.15,.18,-.90,.46)
    for floor in range(2):
        lo=.46 if floor==0 else h*.52
        hi=h*.52 if floor==0 else h
        sill=lo+.82; lint=hi-.76
        box(WHITE,0,length,-.165,.165,lo,sill)
        box(WHITE,0,length,-.165,.165,lint,hi)
        for i in range(bays):
            x=span*(i+.5); half=min(.51 if narrow else .96,span*.26)
            l=x-half;r=x+half
            box(WHITE,i*span,l,-.165,.165,sill,lint)
            box(WHITE,r,(i+1)*span,-.165,.165,sill,lint)
            box('arts.recess_glass',l,r,-.035,.035,sill,lint)
            for jamb in (l+.032,r-.032,x):
                box(FRAME,jamb-.029,jamb+.029,-.06,.06,sill,lint)
            box(FRAME,l,r,-.061,.061,lint-.49,lint-.44)
            box(CAP,l-.065,r+.065,-.235,.235,sill-.058,sill+.013)
    box(CAP,0,length,-.215,.215,h-.37,h-.19)


def wing(out,spec):
    roof=out.geo('roof_'+spec['id'],'photo-derived/estimated','Red ceramic ridge path and courtyard widths traced in the aligned aerial. Pitch and tile scale inferred from campus_yishu.')
    walls=out.geo('walls_'+spec['id'],'estimated','Cream plaster, dark openings and double storeys follow campus_yishu; concealed elevations and bay count inferred.')
    h=spec['eave']; rise=spec['rise']; w=spec['half_span']
    p=[xy(pair,h) for pair in spec['ridge_px']]
    closed=spec.get('closed',False)
    n=len(p); edges=n if closed else n-1
    dirs=[(p[(i+1)%n]-p[i]).normalized() for i in range(edges)]
    mitres=[]
    for i in range(n):
        prev=dirs[(i-1)%edges]; nxt=dirs[i%edges]
        if not closed and i in (0,n-1):
            mitres.append(normal(dirs[0 if i==0 else -1]))
        else:
            mitres.append((normal(prev)+normal(nxt))/(1+prev.dot(nxt)))
    def offset(i,s,dist,end_extension):
        q=p[i]+mitres[i]*s*dist
        if not closed and i==0: q=q-dirs[0]*end_extension
        if not closed and i==n-1: q=q+dirs[-1]*end_extension
        return q
    ridge=[pt+UP*(h+rise) for pt in p]
    for i in range(edges):
        j=(i+1)%n; u=dirs[i]
        for s in (-1,1):
            a=offset(i,s,w,w); b=offset(j,s,w,w)
            roof_slope(roof,a+UP*h,b+UP*h,ridge[i],ridge[j])
            outer_edge(roof,a+UP*h,b+UP*h,normal(u)*s)
            wall(walls,offset(i,s,w-.58,w-.58),offset(j,s,w-.58,w-.58),h-.12,s==1)
            roof.polyn(CAP,[a+UP*(h-.30),b+UP*(h-.30),p[j]+UP*(h-.30),p[i]+UP*(h-.30)],-UP)
        # Square bedding below the half-round ridge tiles and a lighter lime crown.
        roof.sweep(TERRA+'hip',[(-.16,-.05),(.16,-.05),(.14,.075),(-.14,.075)],[ridge[i],ridge[j]])
        roof.sweep(CAP,[(-.095,.061),(.095,.061),(.082,.128),(-.082,.128)],[ridge[i],ridge[j]])
    if not closed:
        for i,s in ((0,-1),(n-1,1)):
            a=offset(i,-1,w,w); b=offset(i,1,w,w)
            roof_slope(roof,a+UP*h,b+UP*h,ridge[i],ridge[i])
            outer_edge(roof,a+UP*h,b+UP*h,dirs[0 if i==0 else -1]*s)
            wall(walls,offset(i,-1,w-.58,w-.58),offset(i,1,w-.58,w-.58),h-.12)


def flat_hall(g,x0,x1,y0,y1,h):
    g.box(WHITE,(x0,y0,.08),(x1,y1,h-.14))
    g.box(DECK,(x0-.09,y0-.09,h-.15),(x1+.09,y1+.09,h))
    for x in (x0,x1):
        g.box(CAP,(x-.11,y0,h),(x+.11,y1,h+.24))
    for y in (y0,y1):
        g.box(CAP,(x0,y-.11,h),(x1,y+.11,h+.24))
    # Expansion joints are recessed in the weathering layer.
    for i in range(1,math.ceil((x1-x0)/4.5)):
        x=x0+i*4.5
        g.box(REVEAL,(x-.013,y0+.11,h),(x+.013,y1-.11,h+.007))


def entrance(out):
    e=DATA['entrance']; x=e['center_x']; y=e['front_y']; cy=y+3.9
    g=out.geo('portico_tiles','photo-derived/estimated','Photo shows concave red hip roof, square white cornice and stepped pale ridge with rail. Original piers, stairs, ridge furniture and door retained.')
    arch.hip_roof(g,x-8.635,cy-3.9,x+8.635,cy+3.9,e['eave_z'],29.8,overhang=.65,
                  mat=TERRA+'body',fascia_mat=CAP,fascia_h=.18,concave=.09,
                  upturn=.115,upturn_len=1.42,ridge_mat=TERRA+'hip',ridge_w=.21,ridge_h=.14,
                  tiles=True,tile_pitch=.158,nseg=12,closed_corners=True)
    g=out.geo('entrance_hall','photo-derived/estimated','Punched door recess and intermediate flat roof directly behind portico are present in campus_yishu. Width and atrium depth estimated.')
    left=x-8.7; right=x+8.7; rear=y-22
    for a,b in ((left,x-3.3),(x+3.3,right)):
        g.box(WHITE,(a,y-2.1,.15),(b,y,10.30))
    g.box(WHITE,(x-3.3,y-2.1,5.75),(x+3.3,y,10.30))
    g.box(REVEAL,(x-3.3,y-2.1,.14),(x+3.3,y,1.44))
    # The long west wing meets the side of this neck. A rectangular entrance
    # roof extending behind that wing would cut through its tile and clerestory.
    neck=26.65; shoulder=y-3.40
    for xa,xb,ya,yb in ((left,left+.28,shoulder,y-2.08),(right-.28,right,rear,y-2.08),
                        (neck,neck+.28,rear,shoulder),(left,neck,shoulder,shoulder+.28),
                        (neck,right,rear,rear+.28)):
        g.box(WHITE,(xa,ya,.15),(xb,yb,10.30))
    outline=[(left,y),(left,shoulder),(neck,shoulder),(neck,rear),(right,rear),(right,y)]
    g.prism(DECK,outline,10.26,10.36)
    for a,b in zip(outline,outline[1:]+outline[:1]):
        g.box(CAP,(min(a[0],b[0])-.07,min(a[1],b[1])-.07,10.36),
                  (max(a[0],b[0])+.07,max(a[1],b[1])+.07,10.59))
    g.box(REVEAL,(left,y-.01,4.49),(x-3.3,y+.004,4.513))
    g.box(REVEAL,(x+3.3,y-.01,4.49),(right,y+.004,4.513))


def walkway(out):
    from shapely import constrained_delaunay_triangles
    from shapely.geometry import LineString, Polygon
    from shapely.ops import unary_union
    paths=[]
    for spec in DATA['wings']:
        line=[tuple(xy(p,spec['eave'])[:2]) for p in spec['ridge_px']]
        if spec.get('closed'): line.append(line[0])
        paths.append(LineString(line).buffer(spec['half_span']-.58,cap_style='square',join_style='mitre'))
    walls=unary_union(paths)
    walk=walls.buffer(1.22,join_style='mitre').difference(walls)
    # At the entrance the existing deck takes over; leave its stairs and the shore clear.
    e=DATA['entrance']; x=e['center_x']; y=e['front_y']
    entry=Polygon([(x-9.22,y+11.6),(x-9.22,y-3.6),(26.5,y-3.6),
                   (26.5,y-22),(x+8.72,y-22),(x+8.72,y+11.6)])
    walk=walk.difference(entry)
    g=out.geo('perimeter_walk','estimated','Narrow service paving around courtyard walls. Path width, surface and extent inferred.')
    for tri in constrained_delaunay_triangles(walk).geoms:
        g.polyn('paving.granite.light',[(*p,.155) for p in list(tri.exterior.coords)[:3]],UP)


def build_roofs(coll):
    register()
    out=Out()
    for spec in DATA['wings']: wing(out,spec)
    g=out.geo('lower_halls','photo-derived/estimated','Three grey areas inside red perimeter roofs on courtyard aerial. Roofing, lower heights and bay joints interpreted; east slot left open.')
    for spec in DATA['lower_roofs']:
        l,t,r,b=spec['bounds_px']; h=spec['height']
        a=xy((l,b),h); z=xy((r,t),h)
        flat_hall(g,a.x,z.x,a.y,z.y,h)
    entrance(out)
    walkway(out)
    # Warm mineral patina in the membrane with fine normal and roughness variation.
    from atelier_materials import build_maps,apply_maps
    with tempfile.TemporaryDirectory() as tempdir:
        maps=build_maps(Path(tempdir),'arts.membrane','road',(.52,.515,.482),5.2,None)
        apply_maps(kit.get_material(DECK),maps,5.2)
    build.instantiate('arts.building',out,coll,Matrix.Identity(4))
